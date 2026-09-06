<?php
declare(strict_types=1);

/**
 * Shared SEO and server-rendering helpers.
 *
 * Production configuration is read from environment variables so credentials
 * and Google verification values never need to be committed to the repository.
 */

function seo_h(?string $value): string {
    return htmlspecialchars((string)$value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function seo_site_name(): string {
    return trim((string)(getenv('HEERA_SITE_NAME') ?: 'Heera Estate'));
}

function seo_site_url(): string {
    $configured = trim((string)(getenv('HEERA_SITE_URL') ?: ''));
    if ($configured !== '') return rtrim($configured, '/');

    $https = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    $scheme = $https ? 'https' : 'http';
    $host = preg_replace('/[^A-Za-z0-9.\-:\[\]]/', '', (string)($_SERVER['HTTP_HOST'] ?? 'localhost'));
    $script = str_replace('\\', '/', (string)($_SERVER['SCRIPT_NAME'] ?? '/index.php'));
    $basePath = rtrim(str_replace('/index.php', '', dirname($script) . '/index.php'), '/');
    if ($basePath === '/' || $basePath === '.') $basePath = '';
    return $scheme . '://' . $host . $basePath;
}

function seo_url(string $path = ''): string {
    if (preg_match('#^https?://#i', $path)) return $path;
    return seo_site_url() . ($path === '' ? '/' : '/' . ltrim($path, '/'));
}

function seo_asset_url(?string $path): string {
    $path = trim((string)$path);
    if ($path === '') return seo_url('images/home-logo.jpg');
    if (preg_match('#^https?://#i', $path)) return $path;
    return seo_url($path);
}

function seo_db(): PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;
    $host = getenv('HAVENLY_DB_HOST') ?: '127.0.0.1';
    $name = getenv('HAVENLY_DB_NAME') ?: 'havenly_real_estate';
    $user = getenv('HAVENLY_DB_USER') ?: 'root';
    $password = getenv('HAVENLY_DB_PASSWORD') ?: '';
    $pdo = new PDO("mysql:host={$host};dbname={$name};charset=utf8mb4", $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    return $pdo;
}

function seo_slugify(string $value): string {
    $value = trim($value);
    if ($value === '') return 'item';
    if (function_exists('transliterator_transliterate')) {
        $converted = transliterator_transliterate('Any-Latin; Latin-ASCII; Lower()', $value);
        if (is_string($converted)) $value = $converted;
    } elseif (function_exists('iconv')) {
        $converted = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
        if (is_string($converted)) $value = $converted;
    }
    $value = strtolower($value);
    $value = preg_replace('/[^a-z0-9]+/', '-', $value) ?? '';
    return trim($value, '-') ?: 'item';
}

function seo_column_exists(PDO $pdo, string $table, string $column): bool {
    $statement = $pdo->prepare("SHOW COLUMNS FROM `{$table}` LIKE ?");
    $statement->execute([$column]);
    return (bool)$statement->fetch();
}

function seo_index_exists(PDO $pdo, string $table, string $index): bool {
    $statement = $pdo->prepare("SHOW INDEX FROM `{$table}` WHERE Key_name = ?");
    $statement->execute([$index]);
    return (bool)$statement->fetch();
}

function seo_unique_slug(PDO $pdo, string $table, string $idColumn, string $slugColumn, string $source, int $excludeId = 0): string {
    $base = substr(seo_slugify($source), 0, 175);
    $candidate = $base;
    $suffix = 2;
    do {
        $sql = "SELECT `{$idColumn}` FROM `{$table}` WHERE `{$slugColumn}` = ?" . ($excludeId > 0 ? " AND `{$idColumn}` <> ?" : '') . ' LIMIT 1';
        $statement = $pdo->prepare($sql);
        $statement->execute($excludeId > 0 ? [$candidate, $excludeId] : [$candidate]);
        if (!$statement->fetch()) return $candidate;
        $candidate = substr($base, 0, 170) . '-' . $suffix++;
    } while ($suffix < 10000);
    return $base . '-' . bin2hex(random_bytes(3));
}

function seo_ensure_schema(PDO $pdo): void {
    static $completed = [];
    $key = spl_object_id($pdo);
    if (!empty($completed[$key])) return;

    if (!seo_column_exists($pdo, 'projects', 'plan_name')) {
        $pdo->exec('ALTER TABLE projects ADD COLUMN plan_name VARCHAR(180) NULL AFTER title');
    }
    if (!seo_column_exists($pdo, 'projects', 'payment_plans')) {
        $pdo->exec('ALTER TABLE projects ADD COLUMN payment_plans TEXT NULL AFTER description');
    }
    if (!seo_column_exists($pdo, 'properties', 'project_id')) {
        $pdo->exec('ALTER TABLE properties ADD COLUMN project_id INT UNSIGNED NULL AFTER property_id');
    }
    if (!seo_column_exists($pdo, 'properties', 'sub_project_id')) {
        $pdo->exec('ALTER TABLE properties ADD COLUMN sub_project_id INT UNSIGNED NULL AFTER project_id');
    }
    $pdo->exec("CREATE TABLE IF NOT EXISTS sub_projects (sub_project_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,project_id INT UNSIGNED NOT NULL,name VARCHAR(180) NOT NULL,slug VARCHAR(190) DEFAULT NULL,description TEXT DEFAULT NULL,status ENUM('published','draft','archived') NOT NULL DEFAULT 'published',sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,UNIQUE KEY uq_sub_project_name(project_id,name),UNIQUE KEY uq_sub_project_slug(slug),INDEX idx_sub_project_project(project_id,status,sort_order)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    if (!seo_column_exists($pdo, 'properties', 'payment_plan_id')) {
        $pdo->exec('ALTER TABLE properties ADD COLUMN payment_plan_id VARCHAR(80) NULL AFTER project_id');
    }
    try {
        $listingTypeColumn = $pdo->query("SHOW COLUMNS FROM properties LIKE 'listing_type'")->fetch();
        if ($listingTypeColumn && stripos((string)($listingTypeColumn['Type'] ?? ''), "'installment'") === false) {
            $pdo->exec("ALTER TABLE properties MODIFY listing_type ENUM('sale','rent','installment') NOT NULL DEFAULT 'sale'");
        }
    } catch (Throwable $exception) { }
    if (!seo_index_exists($pdo, 'properties', 'idx_property_project')) {
        $pdo->exec('ALTER TABLE properties ADD INDEX idx_property_project (project_id)');
    }
    if (!seo_column_exists($pdo, 'properties', 'slug')) {
        $pdo->exec('ALTER TABLE properties ADD COLUMN slug VARCHAR(190) NULL AFTER title');
    }
    if (!seo_column_exists($pdo, 'projects', 'slug')) {
        $pdo->exec('ALTER TABLE projects ADD COLUMN slug VARCHAR(190) NULL AFTER plan_name');
    }

    $propertyRows = $pdo->query("SELECT property_id,title,city,slug FROM properties ORDER BY property_id")->fetchAll();
    $propertyUpdate = $pdo->prepare('UPDATE properties SET slug=? WHERE property_id=?');
    foreach ($propertyRows as $row) {
        $currentSlug = trim((string)($row['slug'] ?? ''));
        $duplicateCount = 0;
        if ($currentSlug !== '') {$duplicateCheck=$pdo->prepare('SELECT COUNT(*) FROM properties WHERE slug=?');$duplicateCheck->execute([$currentSlug]);$duplicateCount=(int)$duplicateCheck->fetchColumn();}
        if ($currentSlug !== '' && $duplicateCount < 2) continue;
        $source = trim($row['title'] . ' ' . $row['city']);
        $slug = seo_unique_slug($pdo, 'properties', 'property_id', 'slug', $source, (int)$row['property_id']);
        $propertyUpdate->execute([$slug, (int)$row['property_id']]);
    }

    $planSelection = seo_column_exists($pdo, 'projects', 'plan_name') ? 'plan_name' : 'NULL AS plan_name';
    $projectRows = $pdo->query("SELECT project_id,title,{$planSelection},slug FROM projects ORDER BY project_id")->fetchAll();
    $projectUpdate = $pdo->prepare('UPDATE projects SET slug=? WHERE project_id=?');
    foreach ($projectRows as $row) {
        $currentSlug = trim((string)($row['slug'] ?? ''));
        $duplicateCount = 0;
        if ($currentSlug !== '') {$duplicateCheck=$pdo->prepare('SELECT COUNT(*) FROM projects WHERE slug=?');$duplicateCheck->execute([$currentSlug]);$duplicateCount=(int)$duplicateCheck->fetchColumn();}
        if ($currentSlug !== '' && $duplicateCount < 2) continue;
        $source = trim($row['title'] . ' ' . ($row['plan_name'] ?? ''));
        $slug = seo_unique_slug($pdo, 'projects', 'project_id', 'slug', $source, (int)$row['project_id']);
        $projectUpdate->execute([$slug, (int)$row['project_id']]);
    }

    try{if(!seo_index_exists($pdo,'properties','uq_property_slug'))$pdo->exec('ALTER TABLE properties ADD UNIQUE INDEX uq_property_slug (slug)');}catch(Throwable $e){}
    try{if(!seo_index_exists($pdo,'projects','uq_project_slug'))$pdo->exec('ALTER TABLE projects ADD UNIQUE INDEX uq_project_slug (slug)');}catch(Throwable $e){}
    $completed[$key] = true;
}

function seo_normalize_payment_plans(array $plans): array {
    $normalized = [];
    foreach (array_values($plans) as $index => $plan) {
        if (!is_array($plan)) continue;
        $id = trim((string)($plan['plan_id'] ?? ''));
        if (!preg_match('/^plan_[A-Za-z0-9_-]{8,72}$/', $id)) {
            $copy = $plan;
            unset($copy['plan_id']);
            $encoded = json_encode($copy, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?: (string)$index;
            $id = 'plan_' . substr(hash('sha256', $encoded), 0, 20);
        }
        $plan['plan_id'] = $id;
        $normalized[] = $plan;
    }
    return $normalized;
}

function seo_decode_payment_plans(?string $raw): array {
    if ($raw === null || trim($raw) === '') return [];
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? seo_normalize_payment_plans($decoded) : [];
}

function seo_find_payment_plan(?string $raw, ?string $planId): ?array {
    $planId = trim((string)$planId);
    if ($planId === '') return null;
    foreach (seo_decode_payment_plans($raw) as $plan) {
        if (hash_equals((string)$plan['plan_id'], $planId)) return $plan;
    }
    return null;
}

function seo_payment_plan_record(PDO $pdo, ?string $planId): ?array {
    $planId = trim((string)$planId);
    if ($planId === '') return null;
    try {
        if (!seo_column_exists($pdo, 'payment_plans', 'sub_project_id')) {
            try { $pdo->exec('ALTER TABLE payment_plans ADD COLUMN sub_project_id INT UNSIGNED NULL AFTER project_id'); } catch (Throwable $e) {}
        }
        $stmt=$pdo->prepare("SELECT pp.payment_plan_id AS plan_id,pp.project_id,pp.sub_project_id,pp.plan_name,pp.size_label,pp.booking_amount,pp.monthly_installment_count,pp.monthly_installment,pp.half_yearly_count,pp.half_yearly_installment,pp.balloting,pp.on_possession,pp.other_payment,pp.total_price,pp.full_payment_discount_percent,pp.half_payment_discount_percent,pp.preferred_location_charge_percent,sp.name AS sub_project_name FROM payment_plans pp LEFT JOIN sub_projects sp ON sp.sub_project_id=pp.sub_project_id WHERE pp.payment_plan_id=? AND pp.is_active=TRUE LIMIT 1");
        $stmt->execute([$planId]);$row=$stmt->fetch();return $row?:null;
    } catch (Throwable $e) { return null; }
}

function seo_project_sub_projects(PDO $pdo, int $projectId): array {
    try{$stmt=$pdo->prepare("SELECT sub_project_id,project_id,name,slug,description,status,sort_order FROM sub_projects WHERE project_id=? AND status='published' ORDER BY sort_order,name");$stmt->execute([$projectId]);return $stmt->fetchAll();}catch(Throwable $e){return [];}
}

function seo_project_payment_plans(PDO $pdo, int $projectId): array {
    try{$stmt=$pdo->prepare("SELECT pp.payment_plan_id AS plan_id,pp.project_id,pp.sub_project_id,pp.plan_name,pp.size_label,pp.booking_amount,pp.monthly_installment_count,pp.monthly_installment,pp.half_yearly_count,pp.half_yearly_installment,pp.balloting,pp.on_possession,pp.other_payment,pp.total_price,pp.full_payment_discount_percent,pp.half_payment_discount_percent,pp.preferred_location_charge_percent,sp.name AS sub_project_name FROM payment_plans pp LEFT JOIN sub_projects sp ON sp.sub_project_id=pp.sub_project_id WHERE pp.project_id=? AND pp.is_active=TRUE ORDER BY pp.sort_order,pp.payment_plan_id");$stmt->execute([$projectId]);return $stmt->fetchAll();}catch(Throwable $e){return [];}
}

function seo_listing_label(?string $type): string {
    return match ((string)$type) {
        'sale' => 'For sale',
        'rent' => 'For rent',
        'installment' => 'On Installments',
        default => ucwords(str_replace(['_', '-'], ' ', (string)$type)),
    };
}

function seo_description(?string $value, int $limit = 158): string {
    $text = trim(preg_replace('/\s+/u', ' ', strip_tags((string)$value)) ?? '');
    if ($text === '') return 'Explore verified properties, payment plans and real-estate projects with Heera Estate.';
    if (mb_strlen($text) <= $limit) return $text;
    return rtrim(mb_substr($text, 0, $limit - 1), " \t\n\r\0\x0B,.;:-") . '…';
}

function seo_meta_tags(array $meta): string {
    $title = trim((string)($meta['title'] ?? seo_site_name()));
    $description = seo_description((string)($meta['description'] ?? ''));
    $canonical = (string)($meta['canonical'] ?? seo_url());
    $image = seo_asset_url((string)($meta['image'] ?? 'images/al-rehman-garden-hero.png'));
    $type = (string)($meta['type'] ?? 'website');
    $robots = (string)($meta['robots'] ?? 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1');
    $verification = trim((string)(getenv('HEERA_GOOGLE_SITE_VERIFICATION') ?: ''));
    $tags = [
        '<title>' . seo_h($title) . '</title>',
        '<meta name="description" content="' . seo_h($description) . '" />',
        '<meta name="robots" content="' . seo_h($robots) . '" />',
        '<link rel="canonical" href="' . seo_h($canonical) . '" />',
        '<meta property="og:site_name" content="' . seo_h(seo_site_name()) . '" />',
        '<meta property="og:type" content="' . seo_h($type) . '" />',
        '<meta property="og:title" content="' . seo_h($title) . '" />',
        '<meta property="og:description" content="' . seo_h($description) . '" />',
        '<meta property="og:url" content="' . seo_h($canonical) . '" />',
        '<meta property="og:image" content="' . seo_h($image) . '" />',
        '<meta property="og:image:alt" content="' . seo_h((string)($meta['image_alt'] ?? $title)) . '" />',
        '<meta name="twitter:card" content="summary_large_image" />',
        '<meta name="twitter:title" content="' . seo_h($title) . '" />',
        '<meta name="twitter:description" content="' . seo_h($description) . '" />',
        '<meta name="twitter:image" content="' . seo_h($image) . '" />',
    ];
    if ($verification !== '') $tags[] = '<meta name="google-site-verification" content="' . seo_h($verification) . '" />';
    return implode("\n  ", $tags);
}

function seo_json_ld(array $data): string {
    return '<script type="application/ld+json">' . json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP) . '</script>';
}

function seo_analytics(): string {
    $measurementId = trim((string)(getenv('HEERA_GA_MEASUREMENT_ID') ?: ''));
    if (!preg_match('/^G-[A-Z0-9]+$/i', $measurementId)) return '';
    $safeId = seo_h(strtoupper($measurementId));
    return '<script async src="https://www.googletagmanager.com/gtag/js?id=' . $safeId . '"></script>' . "\n" .
        '<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag("js",new Date());gtag("config","' . $safeId . '",{anonymize_ip:true});</script>';
}

function seo_breadcrumb_schema(array $items): array {
    $elements = [];
    foreach (array_values($items) as $index => $item) {
        $elements[] = [
            '@type' => 'ListItem',
            'position' => $index + 1,
            'name' => (string)$item['name'],
            'item' => (string)$item['url'],
        ];
    }
    return ['@context' => 'https://schema.org', '@type' => 'BreadcrumbList', 'itemListElement' => $elements];
}

function seo_fetch_property(PDO $pdo, ?string $slug, int $id = 0): ?array {
    seo_ensure_schema($pdo);
    $where = $slug !== null && $slug !== '' ? 'slug=?' : 'property_id=?';
    $value = $slug !== null && $slug !== '' ? $slug : $id;
    $qualifiedWhere = $slug !== null && $slug !== '' ? 'pr.slug=?' : 'pr.property_id=?';
    $statement = $pdo->prepare("SELECT pr.property_id,pr.project_id,pr.sub_project_id,pr.payment_plan_id,pr.slug,pr.listing_type,pr.property_type,pr.status,pr.title,pr.address_line1,pr.city,pr.state_region,pr.block_name,pr.postal_code,pr.price,pr.bedrooms,pr.bathrooms,pr.area_sqft,pr.description,pr.size_label,pr.property_facing,pr.price_pkr,pr.price_per_marla,pr.publish_start_date,pr.publish_end_date,pr.created_at,pr.updated_at,pj.title AS project_title,COALESCE(sp.name,pj.plan_name) AS project_plan_name,sp.name AS sub_project_name,pj.payment_plans AS project_payment_plans,CASE WHEN pj.payment_plans IS NOT NULL AND TRIM(pj.payment_plans) NOT IN ('','[]','null') THEN 1 ELSE 0 END AS has_payment_plan FROM properties pr LEFT JOIN projects pj ON pj.project_id=pr.project_id LEFT JOIN sub_projects sp ON sp.sub_project_id=pr.sub_project_id WHERE {$qualifiedWhere} AND pr.status='available' AND (pr.publish_start_date IS NULL OR pr.publish_start_date<=CURRENT_DATE) AND (pr.publish_end_date IS NULL OR pr.publish_end_date>=CURRENT_DATE) LIMIT 1");
    $statement->execute([$value]);
    $property = $statement->fetch();
    if (!$property) return null;
    $media = $pdo->prepare('SELECT media_id,media_type,file_path,is_cover,sort_order FROM property_media WHERE property_id=? ORDER BY media_type,is_cover DESC,sort_order,media_id');
    $media->execute([(int)$property['property_id']]);
    $property['media'] = $media->fetchAll();
    $property['selected_payment_plan'] = seo_payment_plan_record($pdo, $property['payment_plan_id'] ?? null) ?: seo_find_payment_plan($property['project_payment_plans'] ?? null, $property['payment_plan_id'] ?? null);
    if ($property['selected_payment_plan']) $property['has_payment_plan'] = 1;
    $property['payment_plans'] = [];
    return $property;
}

function seo_fetch_project(PDO $pdo, ?string $slug, int $id = 0): ?array {
    seo_ensure_schema($pdo);
    $where = $slug !== null && $slug !== '' ? 'slug=?' : 'project_id=?';
    $value = $slug !== null && $slug !== '' ? $slug : $id;
    $statement = $pdo->prepare("SELECT project_id,slug,title,plan_name,category,location,status,hero_image_url,headline,description,payment_plans,created_at,updated_at FROM projects WHERE {$where} AND status='published' LIMIT 1");
    $statement->execute([$value]);
    $project = $statement->fetch();
    if (!$project) return null;
    $media = $pdo->prepare('SELECT media_id,media_type,file_path,caption,sort_order FROM project_media WHERE project_id=? ORDER BY media_type,sort_order,media_id');
    $media->execute([(int)$project['project_id']]);
    $project['media'] = $media->fetchAll();
    $normalizedPlans = seo_project_payment_plans($pdo,(int)$project['project_id']);
    $project['payment_plans'] = $normalizedPlans ?: seo_decode_payment_plans((string)($project['payment_plans'] ?? ''));
    $project['sub_projects'] = seo_project_sub_projects($pdo,(int)$project['project_id']);
    return $project;
}

function seo_property_price(array $property): string {
    $value = (float)($property['price_pkr'] ?: $property['price'] ?: 0);
    if ($value <= 0) return 'Price on request';
    $currency = !empty($property['price_pkr']) ? 'PKR ' : '$';
    return $currency . number_format($value, 0) . (($property['listing_type'] ?? '') === 'rent' ? ' / month' : '');
}

function seo_location_records(PDO $pdo, string $slug): array {
    seo_ensure_schema($pdo);
    $properties = $pdo->query("SELECT property_id,slug,title,city,property_type,listing_type,price,price_pkr,description FROM properties WHERE status='available' AND (publish_start_date IS NULL OR publish_start_date<=CURRENT_DATE) AND (publish_end_date IS NULL OR publish_end_date>=CURRENT_DATE) ORDER BY updated_at DESC")->fetchAll();
    $projects = $pdo->query("SELECT project_id,slug,title,plan_name,location,category,description,hero_image_url FROM projects WHERE status='published' ORDER BY updated_at DESC")->fetchAll();
    $matchedProperties = array_values(array_filter($properties, fn(array $row): bool => seo_slugify((string)$row['city']) === $slug));
    $matchedProjects = array_values(array_filter($projects, fn(array $row): bool => seo_slugify((string)$row['location']) === $slug));
    $name = $matchedProperties[0]['city'] ?? $matchedProjects[0]['location'] ?? ucwords(str_replace('-', ' ', $slug));
    return ['name' => $name, 'properties' => $matchedProperties, 'projects' => $matchedProjects];
}
