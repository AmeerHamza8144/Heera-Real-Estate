<?php
declare(strict_types=1);
require_once __DIR__ . '/seo.php';

/*
 * Havenly's small same-origin JSON API. Configure the database using environment
 * variables HAVENLY_DB_HOST, HAVENLY_DB_NAME, HAVENLY_DB_USER, and HAVENLY_DB_PASSWORD.
 */
$isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');
session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax', 'secure' => $isHttps]);
session_start();
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
header('Cross-Origin-Resource-Policy: same-origin');
header('Cache-Control: no-store, private');
if ($isHttps) header('Strict-Transport-Security: max-age=31536000; includeSubDomains');

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

function csrfToken(): string {
    if (empty($_SESSION['csrf_token']) || !is_string($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function verifyCsrf(): void {
    $provided = trim((string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? $_POST['_csrf'] ?? ''));
    if ($provided === '' || !hash_equals(csrfToken(), $provided)) errorResponse('Your secure session expired. Refresh the page and try again.', 419);
}

function loginRateLimit(string $scope): void {
    $now = time();
    $attempts = array_values(array_filter((array)($_SESSION['login_attempts'][$scope] ?? []), static fn($attempt): bool => is_int($attempt) && $attempt > $now - 600));
    $_SESSION['login_attempts'][$scope] = $attempts;
    if (count($attempts) >= 5) errorResponse('Too many login attempts. Wait 10 minutes and try again.', 429);
}

function recordLoginFailure(string $scope): void {
    $_SESSION['login_attempts'][$scope][] = time();
}

function clearLoginFailures(string $scope): void {
    unset($_SESSION['login_attempts'][$scope]);
}

function currentAdmin(): ?array {
    if (empty($_SESSION['admin_id'])) return null;
    $pdo=db(); ensureLoginUsersSchema($pdo);
    $statement = $pdo->prepare('SELECT admin_id, first_name, last_name, email FROM admin_users WHERE admin_id = ? AND is_active=TRUE');
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

function ensureLoginUsersSchema(PDO $pdo): void {
    static $ready = false;
    if ($ready) return;
    foreach ([
        'username' => "ALTER TABLE admin_users ADD COLUMN username VARCHAR(100) NULL UNIQUE AFTER email",
        'phone' => "ALTER TABLE admin_users ADD COLUMN phone VARCHAR(30) NULL AFTER username",
        'is_active' => "ALTER TABLE admin_users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE AFTER phone"
    ] as $column => $sql) {
        if (!$pdo->query("SHOW COLUMNS FROM admin_users LIKE " . $pdo->quote($column))->fetch()) $pdo->exec($sql);
    }
    $pdo->exec("UPDATE IGNORE admin_users SET username='admin' WHERE email='admin@havenly.local' AND (username IS NULL OR username='')");
    $pdo->exec("CREATE TABLE IF NOT EXISTS client_users (
        client_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        full_name VARCHAR(160) NOT NULL,
        email VARCHAR(255) DEFAULT NULL UNIQUE,
        phone VARCHAR(30) DEFAULT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_client_active (is_active, full_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $ready = true;
}

function clientSignup(array $data): void {
    $pdo = db(); ensureLoginUsersSchema($pdo);
    $name = stringValue($data, 'full_name', 160);
    $email = strtolower(optionalStringValue($data, 'email', 255));
    $phone = preg_replace('/\s+/', '', optionalStringValue($data, 'phone', 30));
    $password = (string)($data['password'] ?? '');
    if ($name === '' || ($email === '' && $phone === '')) errorResponse('Name and an email or phone number are required.');
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) errorResponse('Enter a valid email address.');
    if (strlen($password) < 8) errorResponse('Password must contain at least 8 characters.');
    try {
        $stmt = $pdo->prepare('INSERT INTO client_users (full_name,email,phone,password_hash) VALUES (?,?,?,?)');
        $stmt->execute([$name, $email ?: null, $phone ?: null, password_hash($password, PASSWORD_DEFAULT)]);
        respond(['created' => true]);
    } catch (PDOException $e) { errorResponse('An account already exists with this email or phone number.', 409); }
}

function clientLogin(array $data): void {
    $pdo = db(); ensureLoginUsersSchema($pdo);
    loginRateLimit('client');
    $identity = trim((string)($data['login'] ?? ''));
    $password = (string)($data['password'] ?? '');
    $stmt = $pdo->prepare('SELECT client_id,full_name,email,phone,password_hash,is_active FROM client_users WHERE email=? OR phone=? LIMIT 1');
    $stmt->execute([strtolower($identity), preg_replace('/\s+/', '', $identity)]);
    $user = $stmt->fetch();
    if (!$user || !$user['is_active'] || !password_verify($password, $user['password_hash'])) {recordLoginFailure('client');errorResponse('Incorrect login details.', 401);}
    clearLoginFailures('client');
    session_regenerate_id(true); unset($_SESSION['admin_id']); $_SESSION['client_id'] = (int)$user['client_id'];
    respond(['user' => ['id'=>(int)$user['client_id'],'name'=>$user['full_name'],'email'=>$user['email'],'phone'=>$user['phone'],'role'=>'client']]);
}

function currentClient(): ?array {
    if (empty($_SESSION['client_id'])) return null;
    $pdo=db(); ensureLoginUsersSchema($pdo);
    $stmt=$pdo->prepare('SELECT client_id,full_name,email,phone FROM client_users WHERE client_id=? AND is_active=TRUE');
    $stmt->execute([$_SESSION['client_id']]); $user=$stmt->fetch(); return $user?:null;
}

function accountSession(): array {
    $admin=currentAdmin();
    if($admin) return ['authenticated'=>true,'role'=>'admin','user'=>userPayload($admin),'csrf_token'=>csrfToken()];
    $client=currentClient();
    if($client) return ['authenticated'=>true,'role'=>'client','user'=>['id'=>(int)$client['client_id'],'name'=>$client['full_name'],'email'=>$client['email'],'phone'=>$client['phone']],'csrf_token'=>csrfToken()];
    return ['authenticated'=>false,'role'=>null,'user'=>null,'csrf_token'=>csrfToken()];
}

function requirePropertySubmitter(): array {
    $session=accountSession(); if(!$session['authenticated']) errorResponse('Please sign in before submitting a property.',401); return $session;
}

function loginUsers(): array {
    requireAdmin(); $pdo = db(); ensureLoginUsersSchema($pdo);
    $admins = $pdo->query("SELECT admin_id AS user_id, CONCAT(first_name,' ',last_name) AS full_name,email,phone,username,is_active,'admin' AS user_type,created_at FROM admin_users ORDER BY admin_id")->fetchAll();
    $clients = $pdo->query("SELECT client_id AS user_id,full_name,email,phone,NULL AS username,is_active,'client' AS user_type,created_at FROM client_users ORDER BY client_id")->fetchAll();
    return array_merge($admins, $clients);
}

function saveLoginUser(array $data): void {
    $currentAdmin=requireAdmin(); $pdo = db(); ensureLoginUsersSchema($pdo);
    $type = allowedValue(stringValue($data,'user_type'), ['admin','client'], 'user type');
    $id = (int)($data['user_id'] ?? 0); $name = stringValue($data,'full_name',160);
    $email = strtolower(optionalStringValue($data,'email',255)); $phone = optionalStringValue($data,'phone',30);
    $username = optionalStringValue($data,'username',100); $password = (string)($data['new_password'] ?? '');
    $active = !empty($data['is_active']) ? 1 : 0;
    if($type==='admin' && $id===(int)$currentAdmin['admin_id'] && !$active) errorResponse('You cannot disable your own signed-in admin account.');
    if ($name === '' || ($email === '' && $phone === '')) errorResponse('Name and an email or phone number are required.');
    if ($email !== '' && !filter_var($email,FILTER_VALIDATE_EMAIL)) errorResponse('Enter a valid email address.');
    if ($id < 1 && strlen($password) < 8) errorResponse('A new account password must contain at least 8 characters.');
    if ($password !== '' && strlen($password) < 8) errorResponse('Password must contain at least 8 characters.');
    try {
        if ($type === 'admin') {
            if ($email === '') errorResponse('Admin accounts require an email address.');
            $parts = preg_split('/\s+/', $name, 2); $first=$parts[0]; $last=$parts[1] ?? '';
            if ($id > 0) {
                $sql='UPDATE admin_users SET first_name=?,last_name=?,email=?,username=?,phone=?,is_active=?' . ($password!==''?',password_hash=?':'') . ' WHERE admin_id=?';
                $values=[$first,$last,$email,$username?:null,$phone?:null,$active]; if($password!=='')$values[]=password_hash($password,PASSWORD_DEFAULT); $values[]=$id;
                $pdo->prepare($sql)->execute($values);
            } else { $pdo->prepare('INSERT INTO admin_users (first_name,last_name,email,username,phone,is_active,password_hash) VALUES (?,?,?,?,?,?,?)')->execute([$first,$last,$email,$username?:null,$phone?:null,$active,password_hash($password,PASSWORD_DEFAULT)]); }
        } else {
            if ($id > 0) {
                $sql='UPDATE client_users SET full_name=?,email=?,phone=?,is_active=?' . ($password!==''?',password_hash=?':'') . ' WHERE client_id=?';
                $values=[$name,$email?:null,$phone?:null,$active]; if($password!=='')$values[]=password_hash($password,PASSWORD_DEFAULT); $values[]=$id;
                $pdo->prepare($sql)->execute($values);
            } else { $pdo->prepare('INSERT INTO client_users (full_name,email,phone,is_active,password_hash) VALUES (?,?,?,?,?)')->execute([$name,$email?:null,$phone?:null,$active,password_hash($password,PASSWORD_DEFAULT)]); }
        }
        respond(['saved'=>true]);
    } catch (PDOException $e) { errorResponse('That email, phone number, or username is already in use.',409); }
}

function deleteLoginUser(array $data): void {
    $admin=requireAdmin(); $pdo=db(); ensureLoginUsersSchema($pdo); $type=allowedValue(stringValue($data,'user_type'),['admin','client'],'user type'); $id=(int)($data['user_id']??0);
    if($id<1) errorResponse('A valid user is required.');
    if($type==='admin' && $id===(int)$admin['admin_id']) errorResponse('You cannot delete your own signed-in admin account.');
    if($type==='admin' && (int)$pdo->query('SELECT COUNT(*) FROM admin_users')->fetchColumn()<=1) errorResponse('At least one admin account must remain.');
    $stmt=$pdo->prepare($type==='admin'?'DELETE FROM admin_users WHERE admin_id=?':'DELETE FROM client_users WHERE client_id=?'); $stmt->execute([$id]);
    if(!$stmt->rowCount()) errorResponse('This user no longer exists.',404); respond(['deleted'=>true]);
}

function propertyMedia(PDO $pdo, int $propertyId): array {
    $statement = $pdo->prepare('SELECT media_id, media_type, file_path, is_cover, sort_order FROM property_media WHERE property_id = ? ORDER BY media_type, is_cover DESC, sort_order, media_id');
    $statement->execute([$propertyId]);
    return $statement->fetchAll();
}

function propertiesMedia(PDO $pdo, array $propertyIds): array {
    if (!$propertyIds) return [];
    $placeholders = implode(',', array_fill(0, count($propertyIds), '?'));
    try {
        $statement = $pdo->prepare("SELECT media_id, property_id, media_type, file_path, is_cover, sort_order FROM property_media WHERE property_id IN ($placeholders) ORDER BY property_id, media_type, is_cover DESC, sort_order, media_id");
        $statement->execute($propertyIds);
    } catch (PDOException $exception) {
        return [];
    }
    $grouped = [];
    foreach ($statement->fetchAll() as $media) {
        $grouped[(int)$media['property_id']][] = $media;
    }
    return $grouped;
}

function ensurePropertyPublishingSchema(PDO $pdo): void {
    static $ready=false;if($ready)return;
    foreach(['project_id'=>"ALTER TABLE properties ADD COLUMN project_id INT UNSIGNED NULL AFTER property_id",'block_name'=>"ALTER TABLE properties ADD COLUMN block_name VARCHAR(120) NULL AFTER state_region",'publish_start_date'=>"ALTER TABLE properties ADD COLUMN publish_start_date DATE NULL AFTER description",'publish_end_date'=>"ALTER TABLE properties ADD COLUMN publish_end_date DATE NULL AFTER publish_start_date"] as $column=>$sql){try{if(!$pdo->query("SHOW COLUMNS FROM properties LIKE ".$pdo->quote($column))->fetch())$pdo->exec($sql);}catch(Throwable $e){/* Existing rows must remain readable even if ALTER is unavailable. */}}
    try{if(!$pdo->query("SHOW INDEX FROM properties WHERE Key_name='idx_property_project'")->fetch())$pdo->exec('ALTER TABLE properties ADD INDEX idx_property_project (project_id)');}catch(Throwable $e){}
    try{seo_ensure_schema($pdo);}catch(Throwable $e){}
    $ready=true;
}

function databaseColumnExists(PDO $pdo, string $table, string $column): bool {
    try { return seo_column_exists($pdo, $table, $column); } catch (Throwable $exception) { return false; }
}

function listings(bool $onlyAvailable): array {
    $pdo = db();
    ensurePropertyPublishingSchema($pdo);
    $sql = "SELECT pr.property_id,pr.project_id,pr.slug,pr.listing_type,pr.property_type,pr.status,pr.title,pr.address_line1,pr.city,pr.state_region,pr.block_name,pr.postal_code,pr.price,pr.bedrooms,pr.bathrooms,pr.area_sqft,pr.description,pr.size_label,pr.property_facing,pr.price_pkr,pr.price_per_marla,pr.publish_start_date,pr.publish_end_date,pr.created_at,pr.updated_at,pj.title AS project_title,pj.plan_name AS project_plan_name,pj.payment_plans AS project_payment_plans,CASE WHEN pj.payment_plans IS NOT NULL AND TRIM(pj.payment_plans) NOT IN ('','[]','null') THEN 1 ELSE 0 END AS has_payment_plan FROM properties pr LEFT JOIN projects pj ON pj.project_id=pr.project_id";
    if ($onlyAvailable) $sql .= " WHERE pr.status = 'available' AND (pr.publish_start_date IS NULL OR pr.publish_start_date <= CURRENT_DATE) AND (pr.publish_end_date IS NULL OR pr.publish_end_date >= CURRENT_DATE)";
    $sql .= ' ORDER BY pr.updated_at DESC, pr.property_id DESC';
    try {
        $rows = $pdo->query($sql)->fetchAll();
    } catch (PDOException $exception) {
        $fallback = "SELECT pr.*,NULL AS project_title,NULL AS project_plan_name,NULL AS project_payment_plans,0 AS has_payment_plan FROM properties pr";
        $conditions = [];
        if ($onlyAvailable && databaseColumnExists($pdo, 'properties', 'status')) $conditions[] = "pr.status='available'";
        if ($onlyAvailable && databaseColumnExists($pdo, 'properties', 'publish_start_date')) $conditions[] = '(pr.publish_start_date IS NULL OR pr.publish_start_date<=CURRENT_DATE)';
        if ($onlyAvailable && databaseColumnExists($pdo, 'properties', 'publish_end_date')) $conditions[] = '(pr.publish_end_date IS NULL OR pr.publish_end_date>=CURRENT_DATE)';
        if ($conditions) $fallback .= ' WHERE ' . implode(' AND ', $conditions);
        $fallback .= databaseColumnExists($pdo, 'properties', 'updated_at') ? ' ORDER BY pr.updated_at DESC,pr.property_id DESC' : ' ORDER BY pr.property_id DESC';
        $rows = $pdo->query($fallback)->fetchAll();
    }
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

function property(int $propertyId, string $slug = ''): array {
    $pdo = db();
    ensurePropertyPublishingSchema($pdo);
    $hasSlug = databaseColumnExists($pdo, 'properties', 'slug');
    if ($slug !== '' && !$hasSlug && $propertyId < 1) errorResponse('Property not found.', 404);
    $useSlug = $slug !== '' && $hasSlug;
    $selector = $useSlug ? 'pr.slug = ?' : 'pr.property_id = ?';
    $value = $useSlug ? $slug : $propertyId;
    try {
        $statement = $pdo->prepare("SELECT pr.property_id,pr.project_id,pr.slug,pr.listing_type,pr.property_type,pr.status,pr.title,pr.address_line1,pr.city,pr.state_region,pr.block_name,pr.postal_code,pr.price,pr.bedrooms,pr.bathrooms,pr.area_sqft,pr.description,pr.size_label,pr.property_facing,pr.price_pkr,pr.price_per_marla,pr.publish_start_date,pr.publish_end_date,pr.created_at,pr.updated_at,pj.title AS project_title,pj.plan_name AS project_plan_name,pj.payment_plans AS project_payment_plans,CASE WHEN pj.payment_plans IS NOT NULL AND TRIM(pj.payment_plans) NOT IN ('','[]','null') THEN 1 ELSE 0 END AS has_payment_plan FROM properties pr LEFT JOIN projects pj ON pj.project_id=pr.project_id WHERE {$selector} AND pr.status='available' AND (pr.publish_start_date IS NULL OR pr.publish_start_date<=CURRENT_DATE) AND (pr.publish_end_date IS NULL OR pr.publish_end_date>=CURRENT_DATE)");
        $statement->execute([$value]);
        $row = $statement->fetch();
    } catch (PDOException $exception) {
        $conditions = [str_replace('pr.', '', $selector)];
        if (databaseColumnExists($pdo, 'properties', 'status')) $conditions[] = "status='available'";
        if (databaseColumnExists($pdo, 'properties', 'publish_start_date')) $conditions[] = '(publish_start_date IS NULL OR publish_start_date<=CURRENT_DATE)';
        if (databaseColumnExists($pdo, 'properties', 'publish_end_date')) $conditions[] = '(publish_end_date IS NULL OR publish_end_date>=CURRENT_DATE)';
        $statement = $pdo->prepare('SELECT properties.*,NULL AS project_title,NULL AS project_plan_name,NULL AS project_payment_plans,0 AS has_payment_plan FROM properties WHERE ' . implode(' AND ', $conditions) . ' LIMIT 1');
        $statement->execute([$value]);
        $row = $statement->fetch();
    }
    if (!$row) errorResponse('Property not found.', 404);
    try {$row['media'] = propertyMedia($pdo, (int)$row['property_id']);} catch (PDOException $exception) {$row['media'] = [];}
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

function dateValue(array $data, string $key, bool $required = false): ?string {
    $value=trim((string)($data[$key]??''));
    if($value===''){if($required)errorResponse("{$key} is required.");return null;}
    $date=DateTime::createFromFormat('Y-m-d',$value);
    if(!$date||$date->format('Y-m-d')!==$value) errorResponse("{$key} must be a valid date.");
    return $value;
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

function storeOptimizedImageUpload(string $temporaryFile, string $directory, string $mime, string $baseName): string {
    $fallbackExtensions = ['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp','image/gif'=>'gif'];
    $canOptimize = in_array($mime, ['image/jpeg','image/png','image/webp'], true) && function_exists('imagewebp') && function_exists('imagecreatetruecolor');
    if ($canOptimize) {
        $source = $mime === 'image/jpeg' && function_exists('imagecreatefromjpeg') ? @imagecreatefromjpeg($temporaryFile) : ($mime === 'image/png' && function_exists('imagecreatefrompng') ? @imagecreatefrompng($temporaryFile) : ($mime === 'image/webp' && function_exists('imagecreatefromwebp') ? @imagecreatefromwebp($temporaryFile) : false));
        if ($source) {
            $width=imagesx($source);$height=imagesy($source);$scale=min(1,2400/max($width,$height));$newWidth=max(1,(int)round($width*$scale));$newHeight=max(1,(int)round($height*$scale));$target=imagecreatetruecolor($newWidth,$newHeight);imagealphablending($target,false);imagesavealpha($target,true);imagecopyresampled($target,$source,0,0,0,0,$newWidth,$newHeight,$width,$height);$filename=$baseName.'.webp';$saved=imagewebp($target,$directory.DIRECTORY_SEPARATOR.$filename,82);imagedestroy($source);imagedestroy($target);if($saved)return $filename;
        }
    }
    $filename=$baseName.'.'.($fallbackExtensions[$mime]??'jpg');
    if(!move_uploaded_file($temporaryFile,$directory.DIRECTORY_SEPARATOR.$filename))errorResponse('The image could not be saved.',500);
    return $filename;
}

function validPopupVideoUrl(string $url): bool {
    if (preg_match('#^uploads/[A-Za-z0-9_-]+\.(?:mp4|webm)$#i', $url)) return true;
    if (!validMediaUrl($url)) return false;
    $path = (string)(parse_url($url, PHP_URL_PATH) ?? '');
    return preg_match('/\.(?:mp4|webm)$/i', $path) === 1;
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
        return strip_tags($html, '<a><b><strong><em><i><p><br><ul><ol><li><span><div><h1><h2><h3><h4>');
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
    $allowedTags = ['a','b','strong','em','i','p','br','ul','ol','li','span','div','h1','h2','h3','h4'];
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
    ensurePropertyPublishingSchema($pdo);
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
    $projectId = (int)($data['project_id'] ?? 0);
    if($projectId>0){$projectCheck=$pdo->prepare('SELECT project_id FROM projects WHERE project_id=?');$projectCheck->execute([$projectId]);if(!$projectCheck->fetch())errorResponse('The selected project no longer exists.');}
    $existingSlug = '';
    if ($propertyId > 0) {
        $slugStatement = $pdo->prepare('SELECT slug FROM properties WHERE property_id=?');
        $slugStatement->execute([$propertyId]);
        $existingSlug = (string)($slugStatement->fetchColumn() ?: '');
    }
    $slug = $existingSlug !== '' ? $existingSlug : seo_unique_slug($pdo, 'properties', 'property_id', 'slug', $title . ' ' . $city, $propertyId);
    $publishStart=dateValue($data,'publish_start_date');$publishEnd=dateValue($data,'publish_end_date');
    if($publishStart&&$publishEnd&&$publishEnd<$publishStart) errorResponse('The removal date must be the same as or later than the publication start date.');
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
            $statement = $pdo->prepare('UPDATE properties SET project_id=?, listing_type=?, property_type=?, status=?, title=?, address_line1=?, state_region=?, block_name=?, postal_code=?, city=?, price=?, bedrooms=?, bathrooms=?, area_sqft=?, description=?, size_label=?, property_facing=?, price_pkr=?, price_per_marla=?, publish_start_date=?, publish_end_date=? WHERE property_id=?');
            $statement->execute([
                $projectId ?: null,
                $listingType,
                $propertyType,
                $status,
                $title,
                $address,
                stringValue($data, 'state_region', 100),
                optionalStringValue($data, 'block_name', 120),
                stringValue($data, 'postal_code', 25),
                $city,
                $price,
                nullableNumber($data, 'bedrooms'),
                nullableNumber($data, 'bathrooms'),
                nullableNumber($data, 'area_sqft'),
                stringValue($data, 'description', 5000),
                optionalStringValue($data, 'size_label', 60),
                optionalStringValue($data, 'property_facing', 60),
                $pricePkr,
                nullableNumber($data, 'price_per_marla'),
                $publishStart,
                $publishEnd,
                $propertyId
            ]);
        } else {
            $statement = $pdo->prepare('INSERT INTO properties (project_id, listing_type, property_type, status, title, slug, address_line1, state_region, block_name, postal_code, city, price, bedrooms, bathrooms, area_sqft, description, size_label, property_facing, price_pkr, price_per_marla, publish_start_date, publish_end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            array_splice($values, 6, 0, [optionalStringValue($data, 'block_name', 120)]);
            array_splice($values, 4, 0, [$slug]);
            $statement->execute([$projectId ?: null, ...$values, optionalStringValue($data, 'size_label', 60), optionalStringValue($data, 'property_facing', 60), nullableNumber($data, 'price_pkr'), nullableNumber($data, 'price_per_marla'),$publishStart,$publishEnd]);
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
    try {
        $statement = $pdo->prepare('SELECT media_id, media_type, file_path, caption, sort_order FROM project_media WHERE project_id = ? ORDER BY media_type, sort_order, media_id');
        $statement->execute([$projectId]);
        return $statement->fetchAll();
    } catch (PDOException $exception) {
        return [];
    }
}

function projectsMedia(PDO $pdo, array $projectIds): array {
    if (!$projectIds) return [];
    $placeholders = implode(',', array_fill(0, count($projectIds), '?'));
    try {
        $statement = $pdo->prepare("SELECT media_id, project_id, media_type, file_path, caption, sort_order FROM project_media WHERE project_id IN ($placeholders) ORDER BY project_id, media_type, sort_order, media_id");
        $statement->execute($projectIds);
    } catch (PDOException $exception) {
        return [];
    }
    $grouped = [];
    foreach ($statement->fetchAll() as $media) {
        $grouped[(int)$media['project_id']][] = $media;
    }
    return $grouped;
}

function ensureProjectPlanSchema(PDO $pdo): void {
    static $ready = false;
    if ($ready) return;
    try{$column=$pdo->query("SHOW COLUMNS FROM projects LIKE 'plan_name'")->fetch();if(!$column)$pdo->exec("ALTER TABLE projects ADD COLUMN plan_name VARCHAR(180) NULL AFTER title");}catch(Throwable $e){}
    try{$oldUnique=$pdo->query("SHOW INDEX FROM projects WHERE Key_name = 'uq_project_title'")->fetch();if($oldUnique)$pdo->exec("ALTER TABLE projects DROP INDEX uq_project_title");}catch(Throwable $e){}
    try{$newIndex=$pdo->query("SHOW INDEX FROM projects WHERE Key_name = 'idx_project_title_plan'")->fetch();if(!$newIndex)$pdo->exec("ALTER TABLE projects ADD INDEX idx_project_title_plan (title, plan_name)");}catch(Throwable $e){}
    try{seo_ensure_schema($pdo);}catch(Throwable $e){}
    $ready = true;
}

function projects(bool $onlyPublished): array {
    $pdo = db();
    ensureProjectPlanSchema($pdo);
    $sql = 'SELECT * FROM projects';
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

function projectById(int $projectId, string $slug = ''): ?array {
    if ($projectId < 1 && $slug === '') return null;
    $pdo = db();
    ensureProjectPlanSchema($pdo);
    $hasSlug = false;try{$hasSlug=(bool)$pdo->query("SHOW COLUMNS FROM projects LIKE 'slug'")->fetch();}catch(Throwable $e){}
    $selector = $slug !== '' && $hasSlug ? 'slug = ?' : 'project_id = ?';
    $statement = $pdo->prepare("SELECT * FROM projects WHERE {$selector} AND status = 'published'");
    $statement->execute([$slug !== '' && $hasSlug ? $slug : $projectId]);
    $project = $statement->fetch();
    if (!$project) return null;
$project['media'] = projectMedia(db(), (int)$project['project_id']);
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
    ensureProjectPlanSchema($pdo);
    $projectId = (int)($data['project_id'] ?? 0);
    $title = stringValue($data, 'title', 180);
    $planName = stringValue($data, 'plan_name', 180);
    $category = stringValue($data, 'category', 100);
    $location = stringValue($data, 'location', 180);
    $heroImage = stringValue($data, 'hero_image_url', 500);
    if ($title === '' || $category === '' || $location === '') errorResponse('Project name, category, and location are required.');
    if ($heroImage !== '' && !validMediaUrl($heroImage)) errorResponse('The hero image URL is invalid.');
    $status = allowedValue(stringValue($data, 'status'), ['published', 'draft'], 'project status');
    $existingSlug = '';
    if ($projectId > 0) {
        $slugStatement = $pdo->prepare('SELECT slug FROM projects WHERE project_id=?');
        $slugStatement->execute([$projectId]);
        $existingSlug = (string)($slugStatement->fetchColumn() ?: '');
    }
    $slug = $existingSlug !== '' ? $existingSlug : seo_unique_slug($pdo, 'projects', 'project_id', 'slug', trim($title . ' ' . $planName), $projectId);
    // payment_plans will be stored as JSON text (optional)
    $paymentPlansJson = null;
    if (isset($data['payment_plans']) && is_array($data['payment_plans'])) {
        $paymentPlansJson = json_encode(array_values($data['payment_plans']), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    }
    $values = [$title, $planName ?: null, $category, $location, $status, $heroImage ?: null, stringValue($data, 'headline', 255), stringValue($data, 'description', 8000), $paymentPlansJson];
    try {
        $pdo->beginTransaction();
        if ($projectId > 0) {
            $exists = $pdo->prepare('SELECT project_id FROM projects WHERE project_id = ?');
            $exists->execute([$projectId]);
            if (!$exists->fetch()) errorResponse('This project no longer exists.', 404);
            $statement = $pdo->prepare('UPDATE projects SET title=?, plan_name=?, category=?, location=?, status=?, hero_image_url=?, headline=?, description=?, payment_plans=? WHERE project_id=?');
            $statement->execute([...$values, $projectId]);
        } else {
            $statement = $pdo->prepare('INSERT INTO projects (title, plan_name, slug, category, location, status, hero_image_url, headline, description, payment_plans) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            array_splice($values, 2, 0, [$slug]);
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

function ensureOfficeAddressesTable(PDO $pdo): void {
    $pdo->exec("CREATE TABLE IF NOT EXISTS office_addresses (
        office_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        office_name VARCHAR(160) NOT NULL,
        address_text TEXT NOT NULL,
        phone VARCHAR(30) DEFAULT NULL,
        map_url VARCHAR(500) DEFAULT NULL,
        is_published BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_office_published (is_published, office_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function officeAddresses(bool $onlyPublished): array {
    $pdo = db();
    ensureOfficeAddressesTable($pdo);
    $sql = 'SELECT office_id, office_name, address_text, phone, map_url, is_published FROM office_addresses';
    if ($onlyPublished) $sql .= ' WHERE is_published = TRUE';
    $sql .= ' ORDER BY office_id ASC';
    return $pdo->query($sql)->fetchAll();
}

function saveOfficeAddress(array $data): void {
    requireAdmin();
    $pdo = db();
    ensureOfficeAddressesTable($pdo);
    $id = (int)($data['office_id'] ?? 0);
    $name = stringValue($data, 'office_name', 160);
    $address = stringValue($data, 'address_text', 1000);
    $phone = optionalStringValue($data, 'phone', 30);
    $mapUrl = optionalStringValue($data, 'map_url', 500);
    if ($name === '' || $address === '') errorResponse('Office name and full address are required.');
    $mapParts = $mapUrl !== '' ? parse_url($mapUrl) : [];
    if ($mapUrl !== '' && (!filter_var($mapUrl, FILTER_VALIDATE_URL) || !is_array($mapParts) || !in_array(strtolower((string)($mapParts['scheme'] ?? '')), ['http', 'https'], true))) errorResponse('The Google Maps link is invalid.');
    $published = !empty($data['is_published']) ? 1 : 0;
    if ($id > 0) {
        $statement = $pdo->prepare('UPDATE office_addresses SET office_name=?, address_text=?, phone=?, map_url=?, is_published=? WHERE office_id=?');
        $statement->execute([$name, $address, $phone ?: null, $mapUrl ?: null, $published, $id]);
        if ($statement->rowCount() === 0) {
            $check = $pdo->prepare('SELECT office_id FROM office_addresses WHERE office_id=?');
            $check->execute([$id]);
            if (!$check->fetch()) errorResponse('This office address no longer exists.', 404);
        }
    } else {
        $statement = $pdo->prepare('INSERT INTO office_addresses (office_name,address_text,phone,map_url,is_published) VALUES (?,?,?,?,?)');
        $statement->execute([$name, $address, $phone ?: null, $mapUrl ?: null, $published]);
        $id = (int)$pdo->lastInsertId();
    }
    respond(['office_id' => $id]);
}

function deleteOfficeAddress(array $data): void {
    requireAdmin();
    $pdo = db();
    ensureOfficeAddressesTable($pdo);
    $id = (int)($data['office_id'] ?? 0);
    if ($id < 1) errorResponse('A valid office address is required.');
    $statement = $pdo->prepare('DELETE FROM office_addresses WHERE office_id=?');
    $statement->execute([$id]);
    if ($statement->rowCount() === 0) errorResponse('This office address no longer exists.', 404);
    respond(['deleted' => true]);
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
        block_name VARCHAR(120) DEFAULT NULL,
        size_label VARCHAR(60) DEFAULT NULL,
        property_facing VARCHAR(60) DEFAULT NULL,
        price_pkr DECIMAL(15,2) DEFAULT NULL,
        bedrooms DECIMAL(3,1) DEFAULT NULL,
        bathrooms DECIMAL(3,1) DEFAULT NULL,
        area_sqft INT UNSIGNED DEFAULT NULL,
        description TEXT,
        media_json TEXT,
        video_path VARCHAR(500) DEFAULT NULL,
        publish_start_date DATE DEFAULT NULL,
        publish_end_date DATE DEFAULT NULL,
        status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
        approved_property_id INT UNSIGNED DEFAULT NULL,
        admin_notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_submission_status (status, created_at),
        CONSTRAINT fk_submission_property FOREIGN KEY (approved_property_id) REFERENCES properties(property_id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    foreach(['block_name'=>"ALTER TABLE property_submissions ADD COLUMN block_name VARCHAR(120) NULL AFTER state_region",'video_path'=>"ALTER TABLE property_submissions ADD COLUMN video_path VARCHAR(500) NULL AFTER media_json",'publish_start_date'=>"ALTER TABLE property_submissions ADD COLUMN publish_start_date DATE NULL AFTER video_path",'publish_end_date'=>"ALTER TABLE property_submissions ADD COLUMN publish_end_date DATE NULL AFTER publish_start_date"] as $column=>$sql){if(!$pdo->query("SHOW COLUMNS FROM property_submissions LIKE ".$pdo->quote($column))->fetch())$pdo->exec($sql);}
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
    requirePropertySubmitter();
    $pdo = db();
    ensurePropertySubmissionsTable($pdo);
    ensurePropertyPublishingSchema($pdo);
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
    $publishStart=dateValue($_POST,'publish_start_date',true);$publishEnd=dateValue($_POST,'publish_end_date',true);
    if($publishStart<date('Y-m-d')) errorResponse('Publication start date cannot be in the past.');
    if($publishEnd<$publishStart) errorResponse('The removal date must be the same as or later than the publication start date.');

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
            $filename = storeOptimizedImageUpload($temporaryFile, $directory, $mime, bin2hex(random_bytes(16)));
            $uploaded[] = 'uploads/' . $filename;
        }
    }

    $videoPath=null;
    if(isset($_FILES['video']) && ($_FILES['video']['error']??UPLOAD_ERR_NO_FILE)!==UPLOAD_ERR_NO_FILE){
        if($_FILES['video']['error']!==UPLOAD_ERR_OK) errorResponse('The video could not be uploaded. Check the server upload size settings.');
        if($_FILES['video']['size']>=100*1024*1024) errorResponse('Video must be smaller than 100 MB.');
        $finfo=$finfo??new finfo(FILEINFO_MIME_TYPE);$mime=$finfo->file($_FILES['video']['tmp_name']);$allowedVideos=['video/mp4'=>'mp4','video/webm'=>'webm'];
        if(!isset($allowedVideos[$mime])) errorResponse('Only MP4 and WebM videos are supported.');
        $directory=$directory??(__DIR__.DIRECTORY_SEPARATOR.'uploads');if(!is_dir($directory)&&!mkdir($directory,0755,true))errorResponse('The upload folder could not be created.',500);
        $filename=bin2hex(random_bytes(16)).'.'.$allowedVideos[$mime];if(!move_uploaded_file($_FILES['video']['tmp_name'],$directory.DIRECTORY_SEPARATOR.$filename))errorResponse('The video could not be saved.',500);$videoPath='uploads/'.$filename;
    }

    $statement = $pdo->prepare("INSERT INTO property_submissions (seller_name,seller_phone,seller_email,seller_cnic,listing_type,property_type,title,address_line1,city,state_region,block_name,size_label,property_facing,price_pkr,bedrooms,bathrooms,area_sqft,description,media_json,video_path,publish_start_date,publish_end_date) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
    $statement->execute([$name,$phone,$email ?: null,optionalStringValue($_POST,'seller_cnic',30) ?: null,$listingType,$propertyType,$title,$address,$city,optionalStringValue($_POST,'state_region',100) ?: null,optionalStringValue($_POST,'block_name',120) ?: null,optionalStringValue($_POST,'size_label',60) ?: null,optionalStringValue($_POST,'property_facing',60) ?: null,nullableNumber($_POST,'price_pkr'),nullableNumber($_POST,'bedrooms'),nullableNumber($_POST,'bathrooms'),nullableNumber($_POST,'area_sqft'),optionalStringValue($_POST,'description',5000) ?: null,json_encode($uploaded),$videoPath,$publishStart,$publishEnd]);
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
    $publishStart=dateValue($data,'publish_start_date',true);$publishEnd=dateValue($data,'publish_end_date',true);if($publishEnd<$publishStart)errorResponse('The removal date must be the same as or later than the publication start date.');
    $statement = $pdo->prepare('UPDATE property_submissions SET seller_name=?,seller_phone=?,seller_email=?,seller_cnic=?,listing_type=?,property_type=?,title=?,address_line1=?,city=?,state_region=?,block_name=?,size_label=?,property_facing=?,price_pkr=?,bedrooms=?,bathrooms=?,area_sqft=?,description=?,admin_notes=?,status=?,publish_start_date=?,publish_end_date=? WHERE submission_id=? AND approved_property_id IS NULL');
    $statement->execute([stringValue($data,'seller_name',160),stringValue($data,'seller_phone',30),optionalStringValue($data,'seller_email',255) ?: null,optionalStringValue($data,'seller_cnic',30) ?: null,allowedValue(stringValue($data,'listing_type'),['sale','rent'],'listing type'),allowedValue(stringValue($data,'property_type'),['House','Apartment','Villa','Condo','Land'],'property type'),stringValue($data,'title',180),stringValue($data,'address_line1',255),stringValue($data,'city',100),optionalStringValue($data,'state_region',100) ?: null,optionalStringValue($data,'block_name',120) ?: null,optionalStringValue($data,'size_label',60) ?: null,optionalStringValue($data,'property_facing',60) ?: null,nullableNumber($data,'price_pkr'),nullableNumber($data,'bedrooms'),nullableNumber($data,'bathrooms'),nullableNumber($data,'area_sqft'),optionalStringValue($data,'description',5000) ?: null,optionalStringValue($data,'admin_notes',2000) ?: null,$status,$publishStart,$publishEnd,$id]);
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
        ensurePropertyPublishingSchema($pdo);
        $insert = $pdo->prepare("INSERT INTO properties (listing_type,property_type,status,title,address_line1,city,state_region,block_name,price,bedrooms,bathrooms,area_sqft,size_label,property_facing,price_pkr,description,publish_start_date,publish_end_date) VALUES (?,?, 'available',?,?,?,?,?,NULL,?,?,?,?,?,?,?,?,?)");
        $insert->execute([$item['listing_type'],$item['property_type'],$item['title'],$item['address_line1'],$item['city'],$item['state_region'],$item['block_name'],$item['bedrooms'],$item['bathrooms'],$item['area_sqft'],$item['size_label'],$item['property_facing'],$item['price_pkr'],$item['description'],$item['publish_start_date'],$item['publish_end_date']]);
        $propertyId = (int)$pdo->lastInsertId();
        $images = json_decode($item['media_json'] ?: '[]', true);
        $mediaInsert = $pdo->prepare("INSERT INTO property_media (property_id,media_type,file_path,is_cover,sort_order) VALUES (?,'image',?,?,?)");
        foreach ((array)$images as $order => $path) $mediaInsert->execute([$propertyId,$path,$order === 0 ? 1 : 0,$order]);
        if(!empty($item['video_path'])){$videoInsert=$pdo->prepare("INSERT INTO property_media (property_id,media_type,file_path,is_cover,sort_order) VALUES (?,'video',?,FALSE,0)");$videoInsert->execute([$propertyId,$item['video_path']]);}
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
        popup_type ENUM('content','image','video') NOT NULL DEFAULT 'content',
        image_url VARCHAR(500) DEFAULT NULL,
        video_url VARCHAR(500) DEFAULT NULL,
        link_url VARCHAR(500) DEFAULT NULL,
        headline VARCHAR(255) DEFAULT NULL,
        html_content TEXT DEFAULT NULL,
        is_published BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order TINYINT UNSIGNED NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    if (!$pdo->query("SHOW COLUMNS FROM popup_ads LIKE 'popup_type'")->fetch()) {
        $pdo->exec("ALTER TABLE popup_ads ADD COLUMN popup_type ENUM('content','image','video') NOT NULL DEFAULT 'content' AFTER popup_id");
        $pdo->exec("UPDATE popup_ads SET popup_type='image' WHERE image_url IS NOT NULL AND image_url<>''");
    }
    if (!$pdo->query("SHOW COLUMNS FROM popup_ads LIKE 'video_url'")->fetch()) {
        $pdo->exec("ALTER TABLE popup_ads ADD COLUMN video_url VARCHAR(500) DEFAULT NULL AFTER image_url");
    }
}

function homePopup(): ?array {
    $pdo = db();
    ensurePopupAdsTable($pdo);
    $statement = $pdo->prepare('SELECT popup_id, popup_type, image_url, video_url, link_url, headline, html_content, is_published FROM popup_ads WHERE is_published = TRUE ORDER BY sort_order ASC, popup_id ASC LIMIT 1');
    $statement->execute();
    $row = $statement->fetch();
    return $row ?: null;
}

function homePopups(): array {
    $pdo = db();
    ensurePopupAdsTable($pdo);
    return $pdo->query('SELECT popup_id, popup_type, image_url, video_url, link_url, headline, html_content, is_published FROM popup_ads WHERE is_published = TRUE ORDER BY sort_order ASC, popup_id ASC')->fetchAll();
}

function adminPopups(): array {
    requireAdmin();
    $pdo = db();
    ensurePopupAdsTable($pdo);
    return $pdo->query('SELECT popup_id, popup_type, image_url, video_url, link_url, headline, html_content, is_published, sort_order, created_at FROM popup_ads ORDER BY sort_order, popup_id')->fetchAll();
}

function savePopup(array $data): void {
    requireAdmin();
    $pdo = db();
    ensurePopupAdsTable($pdo);
    $popupId = (int)($data['popup_id'] ?? 0);
    $popupType = allowedValue(stringValue($data, 'popup_type'), ['content', 'image', 'video'], 'popup type');
    $image = optionalStringValue($data, 'image_url', 500);
    if ($image !== '' && !validMediaUrl($image)) errorResponse('The image URL is invalid.');
    $video = optionalStringValue($data, 'video_url', 500);
    if ($video !== '' && !validPopupVideoUrl($video)) errorResponse('Use an uploaded video or a direct MP4/WebM URL.');
    $link = optionalStringValue($data, 'link_url', 500);
    if ($link !== '' && !filter_var($link, FILTER_VALIDATE_URL)) errorResponse('The link URL is invalid.');
    $headline = optionalStringValue($data, 'headline', 255);
    $html = optionalStringValue($data, 'html_content', 20000);
    // sanitize user-provided HTML to prevent script injection and dangerous attributes
    $html = sanitize_html($html);
    if ($popupType === 'image') {
        if ($image === '') errorResponse('Choose or upload one image for an image popup.');
        $video = ''; $headline = ''; $html = '';
    } elseif ($popupType === 'video') {
        if ($video === '') errorResponse('Choose or upload one video for a video popup.');
        $image = ''; $headline = ''; $html = '';
    } else {
        if ($headline === '' && $html === '') errorResponse('Enter a headline or content for a content popup.');
        $image = ''; $video = '';
    }
    $isPublished = !empty($data['is_published']) ? 1 : 0;
    $sortOrder = isset($data['sort_order']) ? (int)$data['sort_order'] : 0;
    try {
        if ($popupId > 0) {
            $exists = $pdo->prepare('SELECT popup_id FROM popup_ads WHERE popup_id = ?');
            $exists->execute([$popupId]);
            if (!$exists->fetch()) errorResponse('This popup no longer exists.', 404);
            $stmt = $pdo->prepare('UPDATE popup_ads SET popup_type = ?, image_url = ?, video_url = ?, link_url = ?, headline = ?, html_content = ?, is_published = ?, sort_order = ? WHERE popup_id = ?');
            $stmt->execute([$popupType, $image ?: null, $video ?: null, $link ?: null, $headline ?: null, $html ?: null, $isPublished, $sortOrder, $popupId]);
        } else {
            $stmt = $pdo->prepare('INSERT INTO popup_ads (popup_type, image_url, video_url, link_url, headline, html_content, is_published, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
            $stmt->execute([$popupType, $image ?: null, $video ?: null, $link ?: null, $headline ?: null, $html ?: null, $isPublished, $sortOrder]);
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
        $filename = $type === 'image' ? storeOptimizedImageUpload($temporaryFile,$directory,$mime,bin2hex(random_bytes(16))) : bin2hex(random_bytes(16)).'.'.$extension;
        if ($type !== 'image' && !move_uploaded_file($temporaryFile, $directory . DIRECTORY_SEPARATOR . $filename)) errorResponse('The file could not be moved to the upload folder.', 500);
        $uploaded[] = ['url' => 'uploads/' . $filename, 'type' => $type];
    }
    respond(['files' => $uploaded]);
}

function ensureDigitalMapSchema(PDO $pdo): void {
    static $ready=false;if($ready)return;
    $pdo->exec("CREATE TABLE IF NOT EXISTS digital_maps (map_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,name VARCHAR(180) NOT NULL,map_image VARCHAR(500) NOT NULL,original_pdf VARCHAR(500) DEFAULT NULL,plot_index_file VARCHAR(500) DEFAULT NULL,original_width INT UNSIGNED NOT NULL,original_height INT UNSIGNED NOT NULL,is_active BOOLEAN NOT NULL DEFAULT TRUE,created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,UNIQUE KEY uq_digital_map_name (name)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("CREATE TABLE IF NOT EXISTS digital_map_blocks (block_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,map_id INT UNSIGNED NOT NULL,name VARCHAR(120) NOT NULL,created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT fk_digital_block_map FOREIGN KEY (map_id) REFERENCES digital_maps(map_id) ON DELETE CASCADE,UNIQUE KEY uq_digital_map_block (map_id,name),INDEX idx_digital_blocks_map (map_id,name)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $ready=true;
}

function digitalMaps(bool $onlyActive=true): array {
    $pdo=db();ensureDigitalMapSchema($pdo);$sql='SELECT * FROM digital_maps'.($onlyActive?' WHERE is_active=1':'').' ORDER BY name,map_id';$rows=$pdo->query($sql)->fetchAll();
    $blocks=$pdo->query('SELECT block_id,map_id,name,created_at FROM digital_map_blocks ORDER BY map_id,name')->fetchAll();$grouped=[];foreach($blocks as $block)$grouped[(int)$block['map_id']][]=['block_id'=>(int)$block['block_id'],'map_id'=>(int)$block['map_id'],'name'=>$block['name'],'created_at'=>$block['created_at']];
    return array_map(function($row)use($grouped){$id=(int)$row['map_id'];return ['map_id'=>$id,'name'=>$row['name'],'map_image'=>$row['map_image'],'original_pdf'=>$row['original_pdf'],'plot_index_file'=>$row['plot_index_file'],'original_width'=>(int)$row['original_width'],'original_height'=>(int)$row['original_height'],'is_active'=>(int)$row['is_active'],'blocks'=>$grouped[$id]??[],'created_at'=>$row['created_at'],'updated_at'=>$row['updated_at']];},$rows);
}

function digitalMapById(int $mapId,bool $onlyActive=true): ?array {foreach(digitalMaps($onlyActive) as $map)if((int)$map['map_id']===$mapId)return $map;return null;}

function automaticPlotIndex(array $map): array {
    $relative=trim((string)($map['plot_index_file']??''));if($relative==='')return ['plots'=>[],'method'=>'No plot index uploaded'];
    $path=realpath(__DIR__.DIRECTORY_SEPARATOR.str_replace(['/', '\\'],DIRECTORY_SEPARATOR,$relative));$mapsRoot=realpath(__DIR__.DIRECTORY_SEPARATOR.'maps');
    $mapsPrefix=$mapsRoot?$mapsRoot.DIRECTORY_SEPARATOR:'';$insideMaps=$path&&$mapsRoot&&($path===$mapsRoot||strncmp($path,$mapsPrefix,strlen($mapsPrefix))===0);
    if(!$insideMaps||!is_readable($path))return ['plots'=>[],'method'=>'Plot index unavailable'];
    $decoded=json_decode((string)file_get_contents($path),true);if(!is_array($decoded)||!isset($decoded['plots'])||!is_array($decoded['plots']))return ['plots'=>[],'method'=>'Invalid plot index'];return $decoded;
}

function automaticPlotMeta(): array {
    $maps=digitalMaps(true);if(!count($maps))errorResponse('No published digital map is available.',404);$requested=(int)($_GET['map_id']??0);$selected=$requested?digitalMapById($requested,true):$maps[0];if(!$selected)errorResponse('The selected map is unavailable.',404);$index=automaticPlotIndex($selected);
    $publicMaps=array_map(fn($map)=>['map_id'=>$map['map_id'],'name'=>$map['name'],'map_image'=>$map['map_image'],'original_pdf'=>$map['original_pdf'],'original_width'=>$map['original_width'],'original_height'=>$map['original_height'],'blocks'=>array_map(fn($block)=>$block['name'],$map['blocks'])],$maps);
    return ['maps'=>$publicMaps,'map_id'=>$selected['map_id'],'project'=>$selected['name'],'map_image'=>$selected['map_image'],'original_pdf'=>$selected['original_pdf'],'original_width'=>$selected['original_width'],'original_height'=>$selected['original_height'],'blocks'=>array_map(fn($block)=>$block['name'],$selected['blocks']),'detected_plot_count'=>count($index['plots']),'generated_at'=>$index['generated_at']??null,'method'=>$index['method']??'OCR'];
}

function automaticPlotProperty(string $plotNumber, string $block): ?array {
    try {
        $pdo=db();ensurePropertyPublishingSchema($pdo);$needle='%'.$plotNumber.'%';
        $sql="SELECT property_id,slug,title,property_type,status,size_label,property_facing,price_pkr,address_line1,city,block_name FROM properties WHERE status='available' AND (publish_start_date IS NULL OR publish_start_date<=CURRENT_DATE) AND (publish_end_date IS NULL OR publish_end_date>=CURRENT_DATE) AND (title LIKE ? OR address_line1 LIKE ?)";
        $values=[$needle,$needle];
        if($block!==''){$sql.=' AND (block_name LIKE ? OR title LIKE ? OR address_line1 LIKE ?)';$bn='%'.$block.'%';array_push($values,$bn,$bn,$bn);}
        $sql.=' ORDER BY updated_at DESC LIMIT 1';$statement=$pdo->prepare($sql);$statement->execute($values);$property=$statement->fetch();
        if(!$property&&$block!=='')return automaticPlotProperty($plotNumber,'');if(!$property)return null;
        return ['property_id'=>(int)$property['property_id'],'slug'=>$property['slug'],'title'=>$property['title'],'property_type'=>$property['property_type'],'status'=>$property['status'],'size_label'=>$property['size_label'],'facing'=>$property['property_facing'],'block_name'=>$property['block_name'],'price_pkr'=>$property['price_pkr']===null?null:(float)$property['price_pkr'],'address'=>$property['address_line1'],'city'=>$property['city']];
    } catch(Throwable $exception){return null;}
}

function automaticPlotSearch(): array {
    $maps=digitalMaps(true);if(!count($maps))errorResponse('No published digital map is available.',404);$mapId=(int)($_GET['map_id']??0);$map=$mapId?digitalMapById($mapId,true):$maps[0];if(!$map)errorResponse('The selected map is unavailable.',404);$index=automaticPlotIndex($map);$plotNumber=trim((string)($_GET['plot_number']??''));$block=trim((string)($_GET['block']??''));
    if(!preg_match('/^[1-9][0-9]{0,3}$/',$plotNumber))errorResponse('Enter a plot number from 1 to 9999.');
    $matches=array_values(array_filter($index['plots'],fn($plot)=>isset($plot['plot_number'])&&(string)$plot['plot_number']===(string)((int)$plotNumber)));
    $blockMatches=$block===''?$matches:array_values(array_filter($matches,fn($plot)=>strcasecmp((string)($plot['block']??''),$block)===0));$fallback=$block!==''&&!count($blockMatches)&&count($matches);$results=$fallback?$matches:$blockMatches;
    usort($results,fn($a,$b)=>(float)($b['confidence']??0)<=>(float)($a['confidence']??0));$results=array_slice($results,0,40);
    return ['found'=>count($results)>0,'map_id'=>$map['map_id'],'project'=>$map['name'],'plot_number'=>(string)((int)$plotNumber),'requested_block'=>$block,'block_fallback'=>$fallback,'matches'=>$results,'total_matches'=>count($results),'property'=>automaticPlotProperty((string)((int)$plotNumber),$block),'source'=>$index['method']??'Uploaded plot index'];
}

function saveDigitalMap(): void {
    requireAdmin();$pdo=db();ensureDigitalMapSchema($pdo);$id=(int)($_POST['map_id']??0);$name=stringValue($_POST,'name',180);if($name==='')errorResponse('Map name is required.');$existing=$id?digitalMapById($id,false):null;if($id&&!$existing)errorResponse('This map no longer exists.',404);
    $image=$existing['map_image']??'';$pdf=$existing['original_pdf']??null;$indexFile=$existing['plot_index_file']??null;$width=(int)($existing['original_width']??0);$height=(int)($existing['original_height']??0);$directory=__DIR__.DIRECTORY_SEPARATOR.'maps'.DIRECTORY_SEPARATOR.'uploads';if(!is_dir($directory)&&!mkdir($directory,0755,true))errorResponse('The map upload folder could not be created.',500);$finfo=new finfo(FILEINFO_MIME_TYPE);
    if(isset($_FILES['map_image'])&&($_FILES['map_image']['error']??UPLOAD_ERR_NO_FILE)!==UPLOAD_ERR_NO_FILE){$file=$_FILES['map_image'];if($file['error']!==UPLOAD_ERR_OK||$file['size']>60*1024*1024)errorResponse('Map image upload failed or is larger than 60 MB.');$mime=$finfo->file($file['tmp_name']);$ext=['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp'][$mime]??null;if(!$ext)errorResponse('Map image must be JPG, PNG or WebP.');$size=getimagesize($file['tmp_name']);if(!$size)errorResponse('The map image is invalid.');[$width,$height]=$size;$filename=bin2hex(random_bytes(16)).'.'.$ext;if(!move_uploaded_file($file['tmp_name'],$directory.DIRECTORY_SEPARATOR.$filename))errorResponse('The map image could not be saved.');$image='maps/uploads/'.$filename;}
    if($image===''||$width<100||$height<100)errorResponse('Upload a valid high-resolution map image.');
    if(isset($_FILES['original_pdf'])&&($_FILES['original_pdf']['error']??UPLOAD_ERR_NO_FILE)!==UPLOAD_ERR_NO_FILE){$file=$_FILES['original_pdf'];if($file['error']!==UPLOAD_ERR_OK||$file['size']>100*1024*1024)errorResponse('PDF upload failed or is larger than 100 MB.');if($finfo->file($file['tmp_name'])!=='application/pdf')errorResponse('Original map document must be a PDF.');$filename=bin2hex(random_bytes(16)).'.pdf';if(!move_uploaded_file($file['tmp_name'],$directory.DIRECTORY_SEPARATOR.$filename))errorResponse('The PDF could not be saved.');$pdf='maps/uploads/'.$filename;}
    if(isset($_FILES['plot_index'])&&($_FILES['plot_index']['error']??UPLOAD_ERR_NO_FILE)!==UPLOAD_ERR_NO_FILE){$file=$_FILES['plot_index'];if($file['error']!==UPLOAD_ERR_OK||$file['size']>15*1024*1024)errorResponse('Plot index upload failed or is larger than 15 MB.');$decoded=json_decode((string)file_get_contents($file['tmp_name']),true);if(!is_array($decoded)||!isset($decoded['plots'])||!is_array($decoded['plots']))errorResponse('Plot index JSON must contain a plots array.');foreach($decoded['plots'] as $plot){if(!isset($plot['plot_number'],$plot['normalized_x'],$plot['normalized_y'])||(float)$plot['normalized_x']<0||(float)$plot['normalized_x']>1||(float)$plot['normalized_y']<0||(float)$plot['normalized_y']>1)errorResponse('A plot-index record is invalid.');}$decoded['project']=$name;$decoded['map_image']=$image;$decoded['original_pdf']=$pdf;$decoded['original_width']=$width;$decoded['original_height']=$height;$filename=bin2hex(random_bytes(16)).'.json';$written=file_put_contents($directory.DIRECTORY_SEPARATOR.$filename,json_encode($decoded,JSON_UNESCAPED_SLASHES));if($written===false)errorResponse('The plot index could not be saved.',500);$indexFile='maps/uploads/'.$filename;}
    $active=!empty($_POST['is_active'])?1:0;
    try{if($id){$stmt=$pdo->prepare('UPDATE digital_maps SET name=?,map_image=?,original_pdf=?,plot_index_file=?,original_width=?,original_height=?,is_active=? WHERE map_id=?');$stmt->execute([$name,$image,$pdf,$indexFile,$width,$height,$active,$id]);}else{$stmt=$pdo->prepare('INSERT INTO digital_maps (name,map_image,original_pdf,plot_index_file,original_width,original_height,is_active) VALUES (?,?,?,?,?,?,?)');$stmt->execute([$name,$image,$pdf,$indexFile,$width,$height,$active]);$id=(int)$pdo->lastInsertId();}respond(['saved'=>true,'map_id'=>$id]);}catch(PDOException $e){errorResponse('A map with this name already exists.',409);}
}

function deleteDigitalMap(array $data): void {requireAdmin();$pdo=db();ensureDigitalMapSchema($pdo);$id=(int)($data['map_id']??0);if($id<1)errorResponse('Choose a valid map.');$stmt=$pdo->prepare('DELETE FROM digital_maps WHERE map_id=?');$stmt->execute([$id]);if(!$stmt->rowCount())errorResponse('This map no longer exists.',404);respond(['deleted'=>true]);}
function saveDigitalMapBlock(array $data): void {requireAdmin();$pdo=db();ensureDigitalMapSchema($pdo);$mapId=(int)($data['map_id']??0);$name=stringValue($data,'name',120);if(!$mapId||$name==='')errorResponse('Choose a map and enter a block name.');if(!digitalMapById($mapId,false))errorResponse('The selected map does not exist.',404);try{$stmt=$pdo->prepare('INSERT INTO digital_map_blocks (map_id,name) VALUES (?,?)');$stmt->execute([$mapId,$name]);respond(['saved'=>true,'block_id'=>(int)$pdo->lastInsertId()]);}catch(PDOException $e){errorResponse('This block already exists in the selected map.',409);}}
function deleteDigitalMapBlock(array $data): void {requireAdmin();$pdo=db();ensureDigitalMapSchema($pdo);$id=(int)($data['block_id']??0);$stmt=$pdo->prepare('DELETE FROM digital_map_blocks WHERE block_id=?');$stmt->execute([$id]);if(!$stmt->rowCount())errorResponse('This block no longer exists.',404);respond(['deleted'=>true]);}

$action = $_GET['action'] ?? '';
$csrfProtectedActions = [
    'logout','submit_property','save_submission','approve_submission','save_property','delete_property',
    'save_project','delete_project','save_home_gallery','delete_home_gallery','save_popup','delete_popup',
    'save_agent','delete_agent','save_office_address','delete_office_address','save_login_user','delete_login_user',
    'save_digital_map','delete_digital_map','save_digital_map_block','delete_digital_map_block','upload'
];
if (in_array($action, $csrfProtectedActions, true)) verifyCsrf();
try {
    switch ($action) {
        case 'csrf': respond(['csrf_token' => csrfToken()]);
        case 'properties': respond(listings(true));
        case 'projects': respond(projects(true));
        case 'auto_plot_meta': respond(automaticPlotMeta());
        case 'auto_plot_search': respond(automaticPlotSearch());
        case 'project':
            $projectId = (int)($_GET['id'] ?? 0);
            $project = projectById($projectId, trim((string)($_GET['slug'] ?? '')));
            if (!$project) errorResponse('Project not found.', 404);
            respond($project);
        case 'home_gallery': respond(homeGallery(false));
        case 'agents': respond(agents(true));
        case 'office_addresses': respond(officeAddresses(true));
        case 'chat_lead': saveChatLead(requestData());
        case 'client_signup': clientSignup(requestData());
        case 'client_login': clientLogin(requestData());
        case 'account_session': respond(accountSession());
        case 'forgot_password': respond(['message' => 'If the account exists, please contact Heera Estate administration to reset the password.']);
        case 'submit_property': submitProperty();
        case 'session':
            $user = currentAdmin();
            respond(['authenticated' => $user !== null, 'user' => $user ? userPayload($user) : null, 'csrf_token' => csrfToken()]);
        case 'login':
            loginRateLimit('admin');
            $data = requestData();
            $pdo = db(); ensureLoginUsersSchema($pdo);
            $identity = strtolower(trim((string)($data['login'] ?? $data['email'] ?? '')));
            $password = (string)($data['password'] ?? '');
            $statement = $pdo->prepare('SELECT admin_id, first_name, last_name, email, password_hash, is_active FROM admin_users WHERE email = ? OR username = ? LIMIT 1');
            $statement->execute([$identity, $identity]);
            $user = $statement->fetch();
            if (!$user || !$user['is_active'] || !password_verify($password, $user['password_hash'])) {recordLoginFailure('admin');errorResponse('Incorrect username/email or password.', 401);}
            clearLoginFailures('admin');
            session_regenerate_id(true);
            unset($_SESSION['client_id']);
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
        case 'admin_digital_maps': requireAdmin(); respond(digitalMaps(false));
        case 'property':
            $propertyId = isset($_GET['property_id']) ? (int)$_GET['property_id'] : 0;
            $propertySlug = trim((string)($_GET['slug'] ?? ''));
            if ($propertyId < 1 && $propertySlug === '') errorResponse('Invalid property specified.', 400);
            respond(property($propertyId, $propertySlug));
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
        case 'admin_office_addresses':
            requireAdmin();
            respond(officeAddresses(false));
        case 'admin_login_users': respond(loginUsers());
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
        case 'save_office_address': saveOfficeAddress(requestData());
        case 'delete_office_address': deleteOfficeAddress(requestData());
        case 'save_login_user': saveLoginUser(requestData());
        case 'delete_login_user': deleteLoginUser(requestData());
        case 'save_digital_map': saveDigitalMap();
        case 'delete_digital_map': deleteDigitalMap(requestData());
        case 'save_digital_map_block': saveDigitalMapBlock(requestData());
        case 'delete_digital_map_block': deleteDigitalMapBlock(requestData());
        case 'upload': uploadMedia();
        default: errorResponse('Unknown API action.', 404);
    }
} catch (Throwable $exception) {
    error_log('[Heera API] ' . get_class($exception) . ': ' . $exception->getMessage());
    $message = $exception instanceof PDOException ? 'The database request could not be completed.' : ($exception->getMessage() ?: 'An unexpected server error occurred.');
    errorResponse($message, 500);
}
