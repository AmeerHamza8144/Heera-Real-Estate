<?php
declare(strict_types=1);

/*
 * Havenly's small same-origin JSON API. Configure the database using environment
 * variables HAVENLY_DB_HOST, HAVENLY_DB_NAME, HAVENLY_DB_USER, and HAVENLY_DB_PASSWORD.
 */
$isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
session_set_cookie_params(['httponly' => true, 'samesite' => 'Lax', 'secure' => $isHttps]);
session_start();
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function respond($data, int $status = 200): void {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function errorResponse(string $message, int $status = 400): void {
    respond(['error' => $message], $status);
}

function db(): PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;
    $host = getenv('HAVENLY_DB_HOST') ?: '127.0.0.1';
    $name = getenv('HAVENLY_DB_NAME') ?: 'havenly_real_estate';
    $user = getenv('HAVENLY_DB_USER') ?: 'root';
    $password = getenv('HAVENLY_DB_PASSWORD') ?: '';
    try {
        $pdo = new PDO("mysql:host={$host};dbname={$name};charset=utf8mb4", $user, $password, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        return $pdo;
    } catch (PDOException $exception) {
        throw new RuntimeException('Database connection failed. Import database.sql and check the MySQL settings.');
    }
}

function requestData(): array {
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') return $_POST;
    // strip UTF-8 BOM if present
    $rawClean = preg_replace('/^\xEF\xBB\xBF/', '', $raw);
    $data = json_decode($rawClean, true);
    if (is_array($data)) return $data;
    // fall back to parsing urlencoded form body (some clients send this)
    parse_str($raw, $parsed);
    if (is_array($parsed) && count($parsed) > 0) return array_merge($_POST, $parsed);
    errorResponse('Invalid request data.');
}

function currentAdmin(): ?array {
    if (empty($_SESSION['admin_id'])) return null;
    $statement = db()->prepare('SELECT admin_id, first_name, last_name, email FROM admin_users WHERE admin_id = ?');
    $statement->execute([$_SESSION['admin_id']]);
    $user = $statement->fetch();
    return $user ?: null;
}

function requireAdmin(): array {
    $user = currentAdmin();
    if (!$user) errorResponse('Please log in to manage listings.', 401);
    return $user;
}

function userPayload(array $user): array {
    return ['id' => (int)$user['admin_id'], 'email' => $user['email'], 'name' => trim($user['first_name'] . ' ' . $user['last_name'])];
}

function propertyMedia(PDO $pdo, int $propertyId): array {
    $statement = $pdo->prepare('SELECT media_id, media_type, file_path, is_cover, sort_order FROM property_media WHERE property_id = ? ORDER BY media_type, is_cover DESC, sort_order, media_id');
    $statement->execute([$propertyId]);
    return $statement->fetchAll();
}

function propertiesMedia(PDO $pdo, array $propertyIds): array {
    if (!$propertyIds) return [];
    $placeholders = implode(',', array_fill(0, count($propertyIds), '?'));
    $statement = $pdo->prepare("SELECT media_id, property_id, media_type, file_path, is_cover, sort_order FROM property_media WHERE property_id IN ($placeholders) ORDER BY property_id, media_type, is_cover DESC, sort_order, media_id");
    $statement->execute($propertyIds);
    $grouped = [];
    foreach ($statement->fetchAll() as $media) {
        $grouped[(int)$media['property_id']][] = $media;
    }
    return $grouped;
}

function listings(bool $onlyAvailable): array {
    $pdo = db();
    $sql = 'SELECT property_id, listing_type, property_type, status, title, address_line1, city, state_region, postal_code, price, bedrooms, bathrooms, area_sqft, description, size_label, property_facing, price_pkr, price_per_marla, created_at, updated_at FROM properties';
    if ($onlyAvailable) $sql .= " WHERE status = 'available'";
    $sql .= ' ORDER BY updated_at DESC, property_id DESC';
    $rows = $pdo->query($sql)->fetchAll();
    $mediaByProperty = propertiesMedia($pdo, array_map('intval', array_column($rows, 'property_id')));
    foreach ($rows as &$row) {
        $pid = (int)$row['property_id'];
        $media = $mediaByProperty[$pid] ?? [];
        if ($onlyAvailable) {
            $cover = null;
            $imageCount = 0;
            $videoUrl = null;
            $externalUrl = null;
            foreach ($media as $item) {
                if ($item['media_type'] === 'image') {
                    $imageCount++;
                    if ($cover === null) $cover = $item['file_path'];
                }
                if ($item['media_type'] === 'video' && $videoUrl === null) $videoUrl = $item['file_path'];
                if ($item['media_type'] === 'link' && $externalUrl === null) $externalUrl = $item['file_path'];
            }
            $row['image_url'] = $cover;
            $row['image_count'] = $imageCount;
            $row['video_url'] = $videoUrl;
            $row['external_url'] = $externalUrl;
        } else {
            $row['media'] = $media;
        }
        $row['payment_plans'] = [];
    }
    return $rows;
}

function property(int $propertyId): array {
    $pdo = db();
    $statement = $pdo->prepare('SELECT property_id, listing_type, property_type, status, title, address_line1, city, state_region, postal_code, price, bedrooms, bathrooms, area_sqft, description, size_label, property_facing, price_pkr, price_per_marla, created_at, updated_at FROM properties WHERE property_id = ?');
    $statement->execute([$propertyId]);
    $row = $statement->fetch();
    if (!$row) errorResponse('Property not found.', 404);
    $row['media'] = propertyMedia($pdo, $propertyId);
    $row['payment_plans'] = [];
    return $row;
}

function stringValue(array $data, string $key, int $max = 0): string {
    $value = trim((string)($data[$key] ?? ''));
    if ($max && mb_strlen($value) > $max) errorResponse("{$key} is too long.");
    return $value;
}

function optionalStringValue(array $data, string $key, int $max = 0): string {
    $value = trim((string)($data[$key] ?? ''));
    if ($max && mb_strlen($value) > $max) errorResponse("{$key} is too long.");
    return $value;
}

function nullableNumber(array $data, string $key): ?float {
    $value = trim((string)($data[$key] ?? ''));
    if ($value === '') return null;
    if (!is_numeric($value) || (float)$value < 0) errorResponse("{$key} must be a positive number.");
    return (float)$value;
}

function allowedValue(string $value, array $allowed, string $label): string {
    if (!in_array($value, $allowed, true)) errorResponse("Invalid {$label}.");
    return $value;
}

function validMediaUrl(string $url): bool {
    if (preg_match('#^uploads/[A-Za-z0-9_-]+\.(?:jpg|jpeg|png|gif|webp|mp4|webm)$#i', $url)) return true;
    $parts = parse_url($url);
    return is_array($parts) && isset($parts['scheme']) && in_array(strtolower($parts['scheme']), ['http', 'https'], true)
        && filter_var($url, FILTER_VALIDATE_URL) !== false;
}

function sanitize_html(string $html): string {
    $html = trim($html);
    if ($html === '') return '';
    // Use DOMDocument to remove scripts, styles and dangerous attributes.
    libxml_use_internal_errors(true);
    $doc = new DOMDocument();
    // prepend XML encoding to keep UTF-8 characters intact
    $loaded = $doc->loadHTML('<?xml encoding="utf-8" ?>' . $html, LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD);
    if ($loaded === false) {
        libxml_clear_errors();
        // fallback: strip tags except a small whitelist
        return strip_tags($html, '<a><b><strong><em><i><p><br><ul><ol><li><img><span><div><h1><h2><h3><h4>');
    }
    libxml_clear_errors();
    // remove script and style elements
    foreach (['script', 'style'] as $tag) {
        $nodes = $doc->getElementsByTagName($tag);
        for ($i = $nodes->length - 1; $i >= 0; $i--) {
            $node = $nodes->item($i);
            if ($node && $node->parentNode) $node->parentNode->removeChild($node);
        }
    }
    $xpath = new DOMXPath($doc);
    $allowedTags = ['a','b','strong','em','i','p','br','ul','ol','li','img','span','div','h1','h2','h3','h4'];
    foreach ($xpath->query('//*') as $node) {
        $name = strtolower($node->nodeName);
        if (!in_array($name, $allowedTags, true)) {
            // unwrap disallowed tag but keep children
            $fragment = $doc->createDocumentFragment();
            while ($node->firstChild) $fragment->appendChild($node->removeChild($node->firstChild));
            $node->parentNode->replaceChild($fragment, $node);
            continue;
        }
        // prune attributes
        if ($node->hasAttributes()) {
            $attrs = [];
            foreach ($node->attributes as $attr) $attrs[] = $attr->name;
            foreach ($attrs as $attrName) {
                $val = $node->getAttribute($attrName);
                // remove event handlers and style
                if (preg_match('/^on/i', $attrName) || strtolower($attrName) === 'style') {
                    $node->removeAttribute($attrName);
                    continue;
                }
                // sanitize href for anchors
                if ($name === 'a' && strtolower($attrName) === 'href') {
                    if ($val === '' || (!preg_match('#^(https?:)?//#i', $val) && !preg_match('#^/|^uploads/#', $val))) {
                        $node->removeAttribute('href');
                    }
                    continue;
                }
                // sanitize src for images
                if ($name === 'img' && strtolower($attrName) === 'src') {
                    if ($val === '' || (!preg_match('#^(https?:)?//#i', $val) && !preg_match('#^uploads/#', $val))) {
                        $node->removeAttribute('src');
                    }
                    continue;
                }
                // keep only href/src/alt/title for safety on allowed tags
                if (!in_array(strtolower($attrName), ['href','src','alt','title'], true)) {
                    $node->removeAttribute($attrName);
                }
            }
        }
    }
    $out = $doc->saveHTML();
    // strip possible added doctype or html/body wrappers
    $out = preg_replace('/^<!DOCTYPE.+?>/s', '', $out);
    $out = preg_replace('/^<\?xml.+?\?>/s', '', $out);
    return trim($out);
}

function saveMedia(PDO $pdo, int $propertyId, array $media): void {
    $types = ['images' => 'image', 'videos' => 'video', 'links' => 'link'];
    $delete = $pdo->prepare('DELETE FROM property_media WHERE property_id = ? AND media_type = ?');
    $insert = $pdo->prepare('INSERT INTO property_media (property_id, media_type, file_path, is_cover, sort_order) VALUES (?, ?, ?, ?, ?)');
    foreach ($types as $inputKey => $type) {
        $urls = $media[$inputKey] ?? [];
        if (!is_array($urls)) errorResponse('Media must be a list of URLs.');
        if (count($urls) > 20) errorResponse('A property may have at most 20 items of each media type.');
        $delete->execute([$propertyId, $type]);
        $sortOrder = 0;
        foreach ($urls as $url) {
            $url = trim((string)$url);
            if ($url === '') continue;
            if (mb_strlen($url) > 500 || !validMediaUrl($url)) errorResponse('A media URL is invalid.');
            $insert->execute([$propertyId, $type, $url, $type === 'image' && $sortOrder === 0 ? 1 : 0, $sortOrder]);
            $sortOrder++;
        }
    }
}

// Payment plans removed: keep a placeholder empty array when returning listings

function saveProperty(array $data): void {
    requireAdmin();
    $pdo = db();
    $propertyId = (int)($data['property_id'] ?? 0);
    $title = stringValue($data, 'title', 180);
    $address = stringValue($data, 'address_line1', 255);
    $city = stringValue($data, 'city', 100);
    $price = nullableNumber($data, 'price');
    $pricePkr = nullableNumber($data, 'price_pkr');
    if ($title === '' || $address === '' || $city === '') errorResponse('Title, address, and city are required.');
    if ($price === null && $pricePkr === null) errorResponse('Price (USD) or Total price (PKR) is required.');
    $listingType = allowedValue(stringValue($data, 'listing_type'), ['sale', 'rent'], 'listing type');
    $propertyType = allowedValue(stringValue($data, 'property_type'), ['House', 'Apartment', 'Villa', 'Condo', 'Land'], 'property type');
    $status = allowedValue(stringValue($data, 'status'), ['available', 'pending', 'sold', 'rented'], 'status');
    $values = [
        $listingType, $propertyType, $status, $title, $address, stringValue($data, 'state_region', 100), stringValue($data, 'postal_code', 25),
        $city, $price, nullableNumber($data, 'bedrooms'), nullableNumber($data, 'bathrooms'), nullableNumber($data, 'area_sqft'), stringValue($data, 'description', 5000)
    ];
    try {
        $pdo->beginTransaction();
        if ($propertyId > 0) {
            $exists = $pdo->prepare('SELECT property_id FROM properties WHERE property_id = ?');
            $exists->execute([$propertyId]);
            if (!$exists->fetch()) errorResponse('This property no longer exists.', 404);
            $statement = $pdo->prepare('UPDATE properties SET listing_type=?, property_type=?, status=?, title=?, address_line1=?, state_region=?, postal_code=?, city=?, price=?, bedrooms=?, bathrooms=?, area_sqft=?, description=?, size_label=?, property_facing=?, price_pkr=?, price_per_marla=? WHERE property_id=?');
            $statement->execute([
                $listingType,
                $propertyType,
                $status,
                $title,
                $address,
                stringValue($data, 'state_region', 100),
                stringValue($data, 'postal_code', 25),
                $price,
                nullableNumber($data, 'bedrooms'),
                nullableNumber($data, 'bathrooms'),
                nullableNumber($data, 'area_sqft'),
                stringValue($data, 'description', 5000),
                optionalStringValue($data, 'size_label', 60),
                optionalStringValue($data, 'property_facing', 60),
                $pricePkr,
                nullableNumber($data, 'price_per_marla'),
                $propertyId
            ]);
        } else {
            $statement = $pdo->prepare('INSERT INTO properties (listing_type, property_type, status, title, address_line1, state_region, postal_code, city, price, bedrooms, bathrooms, area_sqft, description, size_label, property_facing, price_pkr, price_per_marla) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            $statement->execute([...$values, optionalStringValue($data, 'size_label', 60), optionalStringValue($data, 'property_facing', 60), nullableNumber($data, 'price_pkr'), nullableNumber($data, 'price_per_marla')]);
            $propertyId = (int)$pdo->lastInsertId();
        }
        saveMedia($pdo, $propertyId, is_array($data['media'] ?? null) ? $data['media'] : []);
        $pdo->commit();
        respond(['property_id' => $propertyId]);
    } catch (PDOException $exception) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        errorResponse('The listing could not be saved.', 500);
    }
}

function deleteProperty(array $data): void {
    requireAdmin();
    $id = (int)($data['property_id'] ?? 0);
    if ($id < 1) errorResponse('A valid property is required.');
    $statement = db()->prepare('DELETE FROM properties WHERE property_id = ?');
    $statement->execute([$id]);
    if ($statement->rowCount() === 0) errorResponse('This property no longer exists.', 404);
    respond(['deleted' => true]);
}

function projectMedia(PDO $pdo, int $projectId): array {
    $statement = $pdo->prepare('SELECT media_id, media_type, file_path, caption, sort_order FROM project_media WHERE project_id = ? ORDER BY media_type, sort_order, media_id');
    $statement->execute([$projectId]);
    return $statement->fetchAll();
}

function projectsMedia(PDO $pdo, array $projectIds): array {
    if (!$projectIds) return [];
    $placeholders = implode(',', array_fill(0, count($projectIds), '?'));
    $statement = $pdo->prepare("SELECT media_id, project_id, media_type, file_path, caption, sort_order FROM project_media WHERE project_id IN ($placeholders) ORDER BY project_id, media_type, sort_order, media_id");
    $statement->execute($projectIds);
    $grouped = [];
    foreach ($statement->fetchAll() as $media) {
        $grouped[(int)$media['project_id']][] = $media;
    }
    return $grouped;
}

function projects(bool $onlyPublished): array {
    $pdo = db();
    $sql = 'SELECT project_id, title, category, location, status, hero_image_url, headline, description, payment_plans, created_at, updated_at FROM projects';
    if ($onlyPublished) $sql .= " WHERE status = 'published'";
    $sql .= ' ORDER BY updated_at DESC, project_id ASC';
    $rows = $pdo->query($sql)->fetchAll();
    $mediaByProject = projectsMedia($pdo, array_map('intval', array_column($rows, 'project_id')));
    foreach ($rows as &$row) {
        $row['media'] = $mediaByProject[(int)$row['project_id']] ?? [];
        $rawPlans = $row['payment_plans'] ?? null;
        $row['payment_plans'] = [];
        if (!empty($rawPlans)) {
            $decoded = json_decode($rawPlans, true);
            if (is_array($decoded)) $row['payment_plans'] = $decoded;
        }
    }
    return $rows;
}

function projectById(int $projectId): ?array {
    if ($projectId < 1) return null;
    $statement = db()->prepare("SELECT project_id, title, category, location, status, hero_image_url, headline, description, payment_plans, created_at, updated_at FROM projects WHERE project_id = ? AND status = 'published'");
    $statement->execute([$projectId]);
    $project = $statement->fetch();
    if (!$project) return null;
$project['media'] = projectMedia(db(), $projectId);
    // decode optional payment plans stored as JSON
    $rawPlans = $project['payment_plans'] ?? null;
    $project['payment_plans'] = [];
    if (!empty($rawPlans)) {
        $decoded = json_decode($rawPlans, true);
        if (is_array($decoded)) $project['payment_plans'] = $decoded;
    }
    return $project;
}

function saveProjectMedia(PDO $pdo, int $projectId, array $media): void {
    $types = ['gallery' => 'gallery', 'plans' => 'plan'];
    $delete = $pdo->prepare('DELETE FROM project_media WHERE project_id = ? AND media_type = ?');
    $insert = $pdo->prepare('INSERT INTO project_media (project_id, media_type, file_path, sort_order) VALUES (?, ?, ?, ?)');
    foreach ($types as $inputKey => $type) {
        $urls = $media[$inputKey] ?? [];
        if (!is_array($urls)) errorResponse('Project media must be a list of image URLs.');
        if (count($urls) > 20) errorResponse('A project may have at most 20 gallery images or plans.');
        $delete->execute([$projectId, $type]);
        $sortOrder = 0;
        foreach ($urls as $url) {
            $url = trim((string)$url);
            if ($url === '') continue;
            if (mb_strlen($url) > 500 || !validMediaUrl($url)) errorResponse('A project media URL is invalid.');
            $insert->execute([$projectId, $type, $url, $sortOrder++]);
        }
    }
}

function saveProject(array $data): void {
    requireAdmin();
    $pdo = db();
    $projectId = (int)($data['project_id'] ?? 0);
    $title = stringValue($data, 'title', 180);
    $category = stringValue($data, 'category', 100);
    $location = stringValue($data, 'location', 180);
    $heroImage = stringValue($data, 'hero_image_url', 500);
    if ($title === '' || $category === '' || $location === '') errorResponse('Project name, category, and location are required.');
    if ($heroImage !== '' && !validMediaUrl($heroImage)) errorResponse('The hero image URL is invalid.');
    $status = allowedValue(stringValue($data, 'status'), ['published', 'draft'], 'project status');
    // payment_plans will be stored as JSON text (optional)
    $paymentPlansJson = null;
    if (isset($data['payment_plans']) && is_array($data['payment_plans'])) {
        $paymentPlansJson = json_encode(array_values($data['payment_plans']), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }
    $values = [$title, $category, $location, $status, $heroImage ?: null, stringValue($data, 'headline', 255), stringValue($data, 'description', 8000), $paymentPlansJson];
    try {
        $pdo->beginTransaction();
        if ($projectId > 0) {
            $exists = $pdo->prepare('SELECT project_id FROM projects WHERE project_id = ?');
            $exists->execute([$projectId]);
            if (!$exists->fetch()) errorResponse('This project no longer exists.', 404);
            $statement = $pdo->prepare('UPDATE projects SET title=?, category=?, location=?, status=?, hero_image_url=?, headline=?, description=?, payment_plans=? WHERE project_id=?');
            $statement->execute([...$values, $projectId]);
        } else {
            $statement = $pdo->prepare('INSERT INTO projects (title, category, location, status, hero_image_url, headline, description, payment_plans) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
            $statement->execute($values);
            $projectId = (int)$pdo->lastInsertId();
        }
        saveProjectMedia($pdo, $projectId, is_array($data['media'] ?? null) ? $data['media'] : []);
        $pdo->commit();
        respond(['project_id' => $projectId]);
    } catch (PDOException $exception) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        errorResponse('The project could not be saved.', 500);
    }
}

function deleteProject(array $data): void {
    requireAdmin();
    $id = (int)($data['project_id'] ?? 0);
    if ($id < 1) errorResponse('A valid project is required.');
    $statement = db()->prepare('DELETE FROM projects WHERE project_id = ?');
    $statement->execute([$id]);
    if ($statement->rowCount() === 0) errorResponse('This project no longer exists.', 404);
    respond(['deleted' => true]);
}

function homeGallery(bool $admin = false): array {
    $sql = 'SELECT gallery_id, image_url, caption, sort_order, is_published, created_at FROM home_gallery';
    if (!$admin) $sql .= ' WHERE is_published = TRUE';
    $sql .= ' ORDER BY sort_order, gallery_id';
    return db()->query($sql)->fetchAll();
}

function ensureAgentsTable(PDO $pdo): void {
    $pdo->exec("CREATE TABLE IF NOT EXISTS agents (
        agent_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(160) NOT NULL,
        title VARCHAR(120),
        email VARCHAR(255),
        phone VARCHAR(30),
        photo_url VARCHAR(500),
        bio TEXT,
        is_published BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_agent_email (email),
        INDEX idx_agent_published (is_published, name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function agents(bool $onlyPublished): array {
    $pdo = db();
    ensureAgentsTable($pdo);
    $sql = 'SELECT agent_id, name, title, email, phone, photo_url, bio, is_published FROM agents';
    if ($onlyPublished) $sql .= ' WHERE is_published = TRUE';
    $sql .= ' ORDER BY name ASC, agent_id ASC';
    return $pdo->query($sql)->fetchAll();
}

function saveChatLead(array $data): void {
    // Honeypot for simple bots. Real visitors never see or fill this field.
    if (trim((string)($data['website'] ?? '')) !== '') respond(['saved' => true]);

    $name = stringValue($data, 'name', 160);
    $phone = stringValue($data, 'phone', 30);
    $language = optionalStringValue($data, 'language', 20);
    $message = optionalStringValue($data, 'message', 1500);
    $propertyId = (int)($data['property_id'] ?? 0);

    if ($name === '' || mb_strlen($name) < 2) errorResponse('Please enter your name.');
    $phoneDigits = preg_replace('/\D+/', '', $phone);
    if (strlen($phoneDigits) < 10 || strlen($phoneDigits) > 15) errorResponse('Please enter a valid phone number.');

    // Limit one lead submission per session every 30 seconds.
    $now = time();
    if (!empty($_SESSION['last_chat_lead']) && $now - (int)$_SESSION['last_chat_lead'] < 30) {
        errorResponse('Your request was already received. Please wait a moment.', 429);
    }

    if ($propertyId > 0) {
        $check = db()->prepare('SELECT property_id FROM properties WHERE property_id = ?');
        $check->execute([$propertyId]);
        if (!$check->fetchColumn()) $propertyId = 0;
    }

    $details = trim("Chatbot lead" . ($language !== '' ? " ({$language})" : '') . ($message !== '' ? "\n{$message}" : ''));
    $statement = db()->prepare("INSERT INTO enquiries (property_id, name, email, phone, interest, message) VALUES (?, ?, ?, ?, 'buying', ?)");
    $statement->execute([$propertyId ?: null, $name, 'chatbot@heera-estate.local', $phone, $details]);
    $_SESSION['last_chat_lead'] = $now;
    respond(['saved' => true, 'enquiry_id' => (int)db()->lastInsertId()]);
}

function ensurePropertySubmissionsTable(PDO $pdo): void {
    $pdo->exec("CREATE TABLE IF NOT EXISTS property_submissions (
        submission_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        seller_name VARCHAR(160) NOT NULL,
        seller_phone VARCHAR(30) NOT NULL,
        seller_email VARCHAR(255) DEFAULT NULL,
        seller_cnic VARCHAR(30) DEFAULT NULL,
        listing_type ENUM('sale','rent') NOT NULL DEFAULT 'sale',
        property_type ENUM('House','Apartment','Villa','Condo','Land') NOT NULL,
        title VARCHAR(180) NOT NULL,
        address_line1 VARCHAR(255) NOT NULL,
        city VARCHAR(100) NOT NULL,
        state_region VARCHAR(100) DEFAULT NULL,
        size_label VARCHAR(60) DEFAULT NULL,
        property_facing VARCHAR(60) DEFAULT NULL,
        price_pkr DECIMAL(15,2) DEFAULT NULL,
        bedrooms DECIMAL(3,1) DEFAULT NULL,
        bathrooms DECIMAL(3,1) DEFAULT NULL,
        area_sqft INT UNSIGNED DEFAULT NULL,
        description TEXT,
        media_json TEXT,
        status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
        approved_property_id INT UNSIGNED DEFAULT NULL,
        admin_notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_submission_status (status, created_at),
        CONSTRAINT fk_submission_property FOREIGN KEY (approved_property_id) REFERENCES properties(property_id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function submissionPayload(array $row): array {
    $row['media'] = [];
    if (!empty($row['media_json'])) {
        $decoded = json_decode($row['media_json'], true);
        if (is_array($decoded)) $row['media'] = $decoded;
    }
    unset($row['media_json']);
    return $row;
}

function submitProperty(): void {
    $pdo = db();
    ensurePropertySubmissionsTable($pdo);
    if (trim((string)($_POST['website'] ?? '')) !== '') respond(['submitted' => true]);
    $now = time();
    if (!empty($_SESSION['last_property_submission']) && $now - (int)$_SESSION['last_property_submission'] < 60) errorResponse('Your property was already submitted. Please wait a moment.', 429);

    $name = stringValue($_POST, 'seller_name', 160);
    $phone = stringValue($_POST, 'seller_phone', 30);
    $email = optionalStringValue($_POST, 'seller_email', 255);
    $title = stringValue($_POST, 'title', 180);
    $address = stringValue($_POST, 'address_line1', 255);
    $city = stringValue($_POST, 'city', 100);
    if ($name === '' || $title === '' || $address === '' || $city === '') errorResponse('Seller name, property title, address, and city are required.');
    if (strlen(preg_replace('/\D+/', '', $phone)) < 10) errorResponse('Enter a valid seller phone number.');
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) errorResponse('Enter a valid email address.');
    $listingType = allowedValue(stringValue($_POST, 'listing_type'), ['sale','rent'], 'listing type');
    $propertyType = allowedValue(stringValue($_POST, 'property_type'), ['House','Apartment','Villa','Condo','Land'], 'property type');

    $uploaded = [];
    if (!empty($_FILES['images']['tmp_name']) && is_array($_FILES['images']['tmp_name'])) {
        if (count($_FILES['images']['tmp_name']) > 5) errorResponse('Upload at most 5 property images.');
        $allowed = ['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp'];
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $directory = __DIR__ . DIRECTORY_SEPARATOR . 'uploads';
        if (!is_dir($directory) && !mkdir($directory, 0755, true)) errorResponse('The upload folder could not be created.', 500);
        foreach ($_FILES['images']['tmp_name'] as $index => $temporaryFile) {
            if ($_FILES['images']['error'][$index] !== UPLOAD_ERR_OK) errorResponse('One image could not be uploaded.');
            if ($_FILES['images']['size'][$index] > 8 * 1024 * 1024) errorResponse('Each image must be 8 MB or smaller.');
            $mime = $finfo->file($temporaryFile);
            if (!isset($allowed[$mime])) errorResponse('Only JPG, PNG, and WebP images are supported.');
            $filename = bin2hex(random_bytes(16)) . '.' . $allowed[$mime];
            if (!move_uploaded_file($temporaryFile, $directory . DIRECTORY_SEPARATOR . $filename)) errorResponse('An image could not be saved.', 500);
            $uploaded[] = 'uploads/' . $filename;
        }
    }

    $statement = $pdo->prepare("INSERT INTO property_submissions (seller_name,seller_phone,seller_email,seller_cnic,listing_type,property_type,title,address_line1,city,state_region,size_label,property_facing,price_pkr,bedrooms,bathrooms,area_sqft,description,media_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
    $statement->execute([$name,$phone,$email ?: null,optionalStringValue($_POST,'seller_cnic',30) ?: null,$listingType,$propertyType,$title,$address,$city,optionalStringValue($_POST,'state_region',100) ?: null,optionalStringValue($_POST,'size_label',60) ?: null,optionalStringValue($_POST,'property_facing',60) ?: null,nullableNumber($_POST,'price_pkr'),nullableNumber($_POST,'bedrooms'),nullableNumber($_POST,'bathrooms'),nullableNumber($_POST,'area_sqft'),optionalStringValue($_POST,'description',5000) ?: null,json_encode($uploaded)]);
    $_SESSION['last_property_submission'] = $now;
    respond(['submitted'=>true,'reference'=>'HEERA-' . str_pad((string)$pdo->lastInsertId(), 5, '0', STR_PAD_LEFT)]);
}

function adminSubmissions(): array {
    requireAdmin();
    $pdo = db();
    ensurePropertySubmissionsTable($pdo);
    return array_map('submissionPayload', $pdo->query('SELECT * FROM property_submissions ORDER BY status = \'pending\' DESC, created_at DESC')->fetchAll());
}

function saveSubmission(array $data): void {
    requireAdmin();
    $pdo = db();
    ensurePropertySubmissionsTable($pdo);
    $id = (int)($data['submission_id'] ?? 0);
    if ($id < 1) errorResponse('A valid submission is required.');
    $status = allowedValue(stringValue($data,'status'), ['pending','rejected'], 'submission status');
    $statement = $pdo->prepare('UPDATE property_submissions SET seller_name=?,seller_phone=?,seller_email=?,seller_cnic=?,listing_type=?,property_type=?,title=?,address_line1=?,city=?,state_region=?,size_label=?,property_facing=?,price_pkr=?,bedrooms=?,bathrooms=?,area_sqft=?,description=?,admin_notes=?,status=? WHERE submission_id=? AND approved_property_id IS NULL');
    $statement->execute([stringValue($data,'seller_name',160),stringValue($data,'seller_phone',30),optionalStringValue($data,'seller_email',255) ?: null,optionalStringValue($data,'seller_cnic',30) ?: null,allowedValue(stringValue($data,'listing_type'),['sale','rent'],'listing type'),allowedValue(stringValue($data,'property_type'),['House','Apartment','Villa','Condo','Land'],'property type'),stringValue($data,'title',180),stringValue($data,'address_line1',255),stringValue($data,'city',100),optionalStringValue($data,'state_region',100) ?: null,optionalStringValue($data,'size_label',60) ?: null,optionalStringValue($data,'property_facing',60) ?: null,nullableNumber($data,'price_pkr'),nullableNumber($data,'bedrooms'),nullableNumber($data,'bathrooms'),nullableNumber($data,'area_sqft'),optionalStringValue($data,'description',5000) ?: null,optionalStringValue($data,'admin_notes',2000) ?: null,$status,$id]);
    respond(['saved'=>true]);
}

function approveSubmission(array $data): void {
    requireAdmin();
    $pdo = db();
    ensurePropertySubmissionsTable($pdo);
    $id = (int)($data['submission_id'] ?? 0);
    $pdo->beginTransaction();
    try {
        $select = $pdo->prepare("SELECT * FROM property_submissions WHERE submission_id=? AND status='pending' FOR UPDATE");
        $select->execute([$id]);
        $item = $select->fetch();
        if (!$item) { $pdo->rollBack(); errorResponse('Only pending submissions can be approved.', 400); }
        $insert = $pdo->prepare("INSERT INTO properties (listing_type,property_type,status,title,address_line1,city,state_region,price,bedrooms,bathrooms,area_sqft,size_label,property_facing,price_pkr,description) VALUES (?,?, 'available',?,?,?,?,NULL,?,?,?,?,?,?,?)");
        $insert->execute([$item['listing_type'],$item['property_type'],$item['title'],$item['address_line1'],$item['city'],$item['state_region'],$item['bedrooms'],$item['bathrooms'],$item['area_sqft'],$item['size_label'],$item['property_facing'],$item['price_pkr'],$item['description']]);
        $propertyId = (int)$pdo->lastInsertId();
        $images = json_decode($item['media_json'] ?: '[]', true);
        $mediaInsert = $pdo->prepare("INSERT INTO property_media (property_id,media_type,file_path,is_cover,sort_order) VALUES (?,'image',?,?,?)");
        foreach ((array)$images as $order => $path) $mediaInsert->execute([$propertyId,$path,$order === 0 ? 1 : 0,$order]);
        $update = $pdo->prepare("UPDATE property_submissions SET status='approved',approved_property_id=? WHERE submission_id=?");
        $update->execute([$propertyId,$id]);
        $pdo->commit();
        respond(['approved'=>true,'property_id'=>$propertyId]);
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        errorResponse('The submission could not be approved.', 500);
    }
}

function saveAgent(array $data): void {
    requireAdmin();
    $pdo = db();
    ensureAgentsTable($pdo);
    $agentId = (int)($data['agent_id'] ?? 0);
    $name = stringValue($data, 'name', 160);
    $title = optionalStringValue($data, 'title', 120);
    $email = strtolower(optionalStringValue($data, 'email', 255));
    $phone = optionalStringValue($data, 'phone', 30);
    $photoUrl = optionalStringValue($data, 'photo_url', 500);
    $bio = optionalStringValue($data, 'bio', 2000);
    if ($name === '') errorResponse('Agent name is required.');
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) errorResponse('A valid email address is required.');
    if ($photoUrl !== '' && !validMediaUrl($photoUrl)) errorResponse('The photo URL is invalid.');
    $values = [$name, $title ?: null, $email ?: null, $phone ?: null, $photoUrl ?: null, $bio ?: null];
    try {
        $pdo->beginTransaction();
        if ($agentId > 0) {
            $exists = $pdo->prepare('SELECT agent_id FROM agents WHERE agent_id = ?');
            $exists->execute([$agentId]);
            if (!$exists->fetch()) errorResponse('This agent no longer exists.', 404);
            $statement = $pdo->prepare('UPDATE agents SET name=?, title=?, email=?, phone=?, photo_url=?, bio=? WHERE agent_id=?');
            $statement->execute([...$values, $agentId]);
        } else {
            $statement = $pdo->prepare('INSERT INTO agents (name, title, email, phone, photo_url, bio) VALUES (?, ?, ?, ?, ?, ?)');
            $statement->execute($values);
            $agentId = (int)$pdo->lastInsertId();
        }
        $pdo->commit();
        respond(['agent_id' => $agentId]);
    } catch (PDOException $exception) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        errorResponse('The agent could not be saved.', 500);
    }
}

function deleteAgent(array $data): void {
    requireAdmin();
    $pdo = db();
    ensureAgentsTable($pdo);
    $id = (int)($data['agent_id'] ?? 0);
    if ($id < 1) errorResponse('A valid agent is required.');
    $statement = $pdo->prepare('DELETE FROM agents WHERE agent_id = ?');
    $statement->execute([$id]);
    if ($statement->rowCount() === 0) errorResponse('This agent no longer exists.', 404);
    respond(['deleted' => true]);
}

function saveHomeGallery(array $data): void {
    requireAdmin();
    $image = stringValue($data, 'image_url', 500);
    if ($image === '' || !validMediaUrl($image)) errorResponse('A valid gallery image URL is required.');
    $caption = stringValue($data, 'caption', 255);
    try {
        $sortOrder = (int)db()->query('SELECT COALESCE(MAX(sort_order), -1) + 1 FROM home_gallery')->fetchColumn();
        $statement = db()->prepare('INSERT INTO home_gallery (image_url, caption, sort_order) VALUES (?, ?, ?)');
        $statement->execute([$image, $caption ?: null, $sortOrder]);
        respond(['gallery_id' => (int)db()->lastInsertId()]);
    } catch (PDOException $exception) {
        errorResponse('This image is already in the gallery or could not be saved.', 400);
    }
}

function deleteHomeGallery(array $data): void {
    requireAdmin();
    $id = (int)($data['gallery_id'] ?? 0);
    if ($id < 1) errorResponse('A valid gallery image is required.');
    $statement = db()->prepare('DELETE FROM home_gallery WHERE gallery_id = ?');
    $statement->execute([$id]);
    if ($statement->rowCount() === 0) errorResponse('This gallery image no longer exists.', 404);
    respond(['deleted' => true]);
}

function ensurePopupAdsTable(PDO $pdo): void {
    $pdo->exec("CREATE TABLE IF NOT EXISTS popup_ads (
        popup_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        image_url VARCHAR(500) DEFAULT NULL,
        link_url VARCHAR(500) DEFAULT NULL,
        headline VARCHAR(255) DEFAULT NULL,
        html_content TEXT DEFAULT NULL,
        is_published BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order TINYINT UNSIGNED NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function homePopup(): ?array {
    $pdo = db();
    ensurePopupAdsTable($pdo);
    $statement = $pdo->prepare('SELECT popup_id, image_url, link_url, headline, html_content, is_published FROM popup_ads WHERE is_published = TRUE ORDER BY sort_order ASC, popup_id ASC LIMIT 1');
    $statement->execute();
    $row = $statement->fetch();
    return $row ?: null;
}

function homePopups(): array {
    $pdo = db();
    ensurePopupAdsTable($pdo);
    return $pdo->query('SELECT popup_id, image_url, link_url, headline, html_content, is_published FROM popup_ads WHERE is_published = TRUE ORDER BY sort_order ASC, popup_id ASC')->fetchAll();
}

function adminPopups(): array {
    requireAdmin();
    $pdo = db();
    ensurePopupAdsTable($pdo);
    return $pdo->query('SELECT popup_id, image_url, link_url, headline, html_content, is_published, sort_order, created_at FROM popup_ads ORDER BY sort_order, popup_id')->fetchAll();
}

function savePopup(array $data): void {
    requireAdmin();
    $pdo = db();
    ensurePopupAdsTable($pdo);
    $popupId = (int)($data['popup_id'] ?? 0);
    $image = optionalStringValue($data, 'image_url', 500);
    if ($image !== '' && !validMediaUrl($image)) errorResponse('The image URL is invalid.');
    $link = optionalStringValue($data, 'link_url', 500);
    if ($link !== '' && !filter_var($link, FILTER_VALIDATE_URL)) errorResponse('The link URL is invalid.');
    $headline = optionalStringValue($data, 'headline', 255);
    $html = optionalStringValue($data, 'html_content', 20000);
    // sanitize user-provided HTML to prevent script injection and dangerous attributes
    $html = sanitize_html($html);
    $isPublished = !empty($data['is_published']) ? 1 : 0;
    $sortOrder = isset($data['sort_order']) ? (int)$data['sort_order'] : 0;
    try {
        if ($popupId > 0) {
            $exists = $pdo->prepare('SELECT popup_id FROM popup_ads WHERE popup_id = ?');
            $exists->execute([$popupId]);
            if (!$exists->fetch()) errorResponse('This popup no longer exists.', 404);
            $stmt = $pdo->prepare('UPDATE popup_ads SET image_url = ?, link_url = ?, headline = ?, html_content = ?, is_published = ?, sort_order = ? WHERE popup_id = ?');
            $stmt->execute([$image ?: null, $link ?: null, $headline ?: null, $html ?: null, $isPublished, $sortOrder, $popupId]);
        } else {
            $stmt = $pdo->prepare('INSERT INTO popup_ads (image_url, link_url, headline, html_content, is_published, sort_order) VALUES (?, ?, ?, ?, ?, ?)');
            $stmt->execute([$image ?: null, $link ?: null, $headline ?: null, $html ?: null, $isPublished, $sortOrder]);
            $popupId = (int)$pdo->lastInsertId();
        }
        respond(['popup_id' => $popupId]);
    } catch (PDOException $e) {
        errorResponse('The popup could not be saved.', 500);
    }
}

function deletePopup(array $data): void {
    requireAdmin();
    $pdo = db();
    $id = (int)($data['popup_id'] ?? 0);
    if ($id < 1) errorResponse('A valid popup is required.');
    $stmt = $pdo->prepare('DELETE FROM popup_ads WHERE popup_id = ?');
    $stmt->execute([$id]);
    if ($stmt->rowCount() === 0) errorResponse('This popup no longer exists.', 404);
    respond(['deleted' => true]);
}

function uploadMedia(): void {
    requireAdmin();
    if (empty($_FILES['files'])) errorResponse('Choose at least one file to upload.');
    $files = $_FILES['files'];
    $allowed = [
        'image/jpeg' => ['image', 'jpg'], 'image/png' => ['image', 'png'], 'image/gif' => ['image', 'gif'], 'image/webp' => ['image', 'webp'],
        'video/mp4' => ['video', 'mp4'], 'video/webm' => ['video', 'webm']
    ];
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $directory = __DIR__ . DIRECTORY_SEPARATOR . 'uploads';
    if (!is_dir($directory) && !mkdir($directory, 0755, true)) errorResponse('The upload folder could not be created.', 500);
    $uploaded = [];
    foreach ($files['tmp_name'] as $index => $temporaryFile) {
        if ($files['error'][$index] !== UPLOAD_ERR_OK) errorResponse('One of the files could not be uploaded.');
        if ($files['size'][$index] > 15 * 1024 * 1024) errorResponse('Each file must be 15 MB or smaller.');
        $mime = $finfo->file($temporaryFile);
        if (!isset($allowed[$mime])) errorResponse('Only JPG, PNG, GIF, WebP, MP4, and WebM files are supported.');
        [$type, $extension] = $allowed[$mime];
        $filename = bin2hex(random_bytes(16)) . '.' . $extension;
        if (!move_uploaded_file($temporaryFile, $directory . DIRECTORY_SEPARATOR . $filename)) errorResponse('The file could not be moved to the upload folder.', 500);
        $uploaded[] = ['url' => 'uploads/' . $filename, 'type' => $type];
    }
    respond(['files' => $uploaded]);
}

$action = $_GET['action'] ?? '';
try {
    switch ($action) {
        case 'properties': respond(listings(true));
        case 'projects': respond(projects(true));
        case 'project':
            $projectId = (int)($_GET['id'] ?? 0);
            $project = projectById($projectId);
            if (!$project) errorResponse('Project not found.', 404);
            respond($project);
        case 'home_gallery': respond(homeGallery(false));
        case 'agents': respond(agents(true));
        case 'chat_lead': saveChatLead(requestData());
        case 'submit_property': submitProperty();
        case 'session':
            $user = currentAdmin();
            respond(['authenticated' => $user !== null, 'user' => $user ? userPayload($user) : null]);
        case 'login':
            $data = requestData();
            $email = strtolower(stringValue($data, 'email', 255));
            $password = (string)($data['password'] ?? '');
            $statement = db()->prepare('SELECT admin_id, first_name, last_name, email, password_hash FROM admin_users WHERE email = ?');
            $statement->execute([$email]);
            $user = $statement->fetch();
            if (!$user || !password_verify($password, $user['password_hash'])) errorResponse('Incorrect email address or password.', 401);
            session_regenerate_id(true);
            $_SESSION['admin_id'] = (int)$user['admin_id'];
            respond(['user' => userPayload($user)]);
        case 'logout':
            $_SESSION = [];
            session_destroy();
            respond(['logged_out' => true]);
        case 'admin_properties':
            requireAdmin();
            respond(listings(false));
        case 'admin_projects':
            requireAdmin();
            respond(projects(false));
        case 'property':
            $propertyId = isset($_GET['property_id']) ? (int)$_GET['property_id'] : 0;
            if ($propertyId < 1) errorResponse('Invalid property specified.', 400);
            respond(property($propertyId));
        case 'admin_home_gallery':
            requireAdmin();
            respond(homeGallery(true));
        case 'home_popup':
            respond(homePopup());
        case 'home_popups':
            respond(homePopups());
        case 'admin_popups':
            requireAdmin();
            respond(adminPopups());
        case 'save_popup': savePopup(requestData());
        case 'delete_popup': deletePopup(requestData());
        case 'admin_agents':
            requireAdmin();
            respond(agents(false));
        case 'admin_submissions': respond(adminSubmissions());
        case 'save_submission': saveSubmission(requestData());
        case 'approve_submission': approveSubmission(requestData());
        case 'save_property': saveProperty(requestData());
        case 'delete_property': deleteProperty(requestData());
        case 'save_project': saveProject(requestData());
        case 'delete_project': deleteProject(requestData());
        case 'save_home_gallery': saveHomeGallery(requestData());
        case 'delete_home_gallery': deleteHomeGallery(requestData());
        case 'save_agent': saveAgent(requestData());
        case 'delete_agent': deleteAgent(requestData());
        case 'upload': uploadMedia();
        default: errorResponse('Unknown API action.', 404);
    }
} catch (Throwable $exception) {
    $message = $exception->getMessage() ?: 'An unexpected server error occurred.';
    errorResponse($message, 500);
}
