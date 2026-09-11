<?php
declare(strict_types=1);
require_once __DIR__.'/database-connection.php';

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

function seo_business_phone(): string {
    return trim((string)(getenv('HEERA_PHONE') ?: '+923091496014'));
}

function seo_whatsapp_number(): string {
    $digits = preg_replace('/\D+/', '', seo_business_phone()) ?? '';
    return $digits !== '' ? $digits : '923091496014';
}

function seo_business_address(): array {
    return [
        '@type' => 'PostalAddress',
        'streetAddress' => trim((string)(getenv('HEERA_STREET_ADDRESS') ?: '85, Hassan Commercial Zone, Gate 4, Al Rehman Garden Phase 2, Faizpur Interchange')),
        'addressLocality' => trim((string)(getenv('HEERA_CITY') ?: 'Lahore')),
        'addressRegion' => trim((string)(getenv('HEERA_REGION') ?: 'Punjab')),
        'postalCode' => trim((string)(getenv('HEERA_POSTAL_CODE') ?: '')),
        'addressCountry' => trim((string)(getenv('HEERA_COUNTRY') ?: 'PK')),
    ];
}

function seo_social_urls(): array {
    return array_values(array_filter(array_map(static function (string $url): string {
        $url = trim($url);
        return filter_var($url, FILTER_VALIDATE_URL) ? $url : '';
    }, explode(',', (string)(getenv('HEERA_SOCIAL_URLS') ?: '')))));
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
    return heeraDatabase();
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
    try {
        // MariaDB/MySQL native prepares do not consistently accept a bound
        // placeholder in SHOW COLUMNS ... LIKE. information_schema does, and
        // prevents the health page from reporting every column as missing.
        $statement = $pdo->prepare('SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND BINARY TABLE_NAME=BINARY ? AND BINARY COLUMN_NAME=BINARY ?');
        $statement->execute([$table, $column]);
        return (int)$statement->fetchColumn() > 0;
    } catch (Throwable $exception) {
        error_log('[Heera schema column check]['.$table.'.'.$column.'] '.$exception->getMessage());
        return false;
    }
}

function seo_table_exists(PDO $pdo, string $table): bool {
    try {
        $statement = $pdo->prepare('SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?');
        $statement->execute([$table]);
        return (int)$statement->fetchColumn() > 0;
    } catch (Throwable $exception) {
        return false;
    }
}

function seo_index_exists(PDO $pdo, string $table, string $index): bool {
    try {
        $statement = $pdo->prepare('SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND BINARY TABLE_NAME=BINARY ? AND BINARY INDEX_NAME=BINARY ?');
        $statement->execute([$table, $index]);
        return (int)$statement->fetchColumn() > 0;
    } catch (Throwable $exception) {
        error_log('[Heera schema index check]['.$table.'.'.$index.'] '.$exception->getMessage());
        return false;
    }
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
    $stored=heeraStoredRows($pdo,'heera_v4_subprojects',[$projectId,0]);
    if($stored!==null)return $stored;
    try{$stmt=$pdo->prepare("SELECT sub_project_id,project_id,name,slug,description,status,sort_order FROM sub_projects WHERE project_id=? AND status='published' ORDER BY sort_order,name");$stmt->execute([$projectId]);return $stmt->fetchAll();}catch(Throwable $e){return [];}
}

function seo_fetch_published_sub_project(PDO $pdo, ?string $slug, int $id = 0): ?array {
    try { seo_ensure_schema($pdo); } catch (Throwable $exception) { }
    $slug = trim((string)$slug);
    if ($slug === '' && $id < 1) return null;
    $stored=heeraStoredRows($pdo,'heera_v4_subprojects',[0,0]);
    if($stored!==null){foreach($stored as $candidate){if(($id>0&&(int)$candidate['sub_project_id']===$id)||($slug!==''&&hash_equals((string)($candidate['slug']??''),$slug)))return $candidate;}}
    $where = $slug !== '' ? 'sp.slug=?' : 'sp.sub_project_id=?';
    $value = $slug !== '' ? $slug : $id;
    $projectSlugColumn = seo_column_exists($pdo, 'projects', 'slug') ? 'p.slug' : 'NULL';
    $stmt = $pdo->prepare("SELECT sp.sub_project_id,sp.project_id,sp.name,sp.slug,sp.description,sp.status,sp.sort_order,{$projectSlugColumn} AS project_slug,p.title AS project_title FROM sub_projects sp JOIN projects p ON p.project_id=sp.project_id WHERE {$where} AND sp.status='published' AND p.status='published' LIMIT 1");
    $stmt->execute([$value]);
    $row = $stmt->fetch();
    if ($row) return $row;

    // Older databases sometimes contain a sub-project name but no generated
    // slug. Resolve the public name-project URL and repair that row in place.
    if ($slug !== '') {
        $candidates = $pdo->query("SELECT sp.sub_project_id,sp.project_id,sp.name,sp.slug,sp.description,sp.status,sp.sort_order,{$projectSlugColumn} AS project_slug,p.title AS project_title FROM sub_projects sp JOIN projects p ON p.project_id=sp.project_id WHERE sp.status='published' AND p.status='published'")->fetchAll();
        foreach ($candidates as $candidate) {
            $expected = seo_slugify((string)$candidate['name'] . '-' . (int)$candidate['project_id']);
            if (!hash_equals($expected, $slug)) continue;
            if (trim((string)$candidate['slug']) === '') {
                try {
                    $repair = $pdo->prepare('UPDATE sub_projects SET slug=? WHERE sub_project_id=? AND (slug IS NULL OR slug=\'\')');
                    $repair->execute([$expected, (int)$candidate['sub_project_id']]);
                    $candidate['slug'] = $expected;
                } catch (Throwable $exception) {
                    // The matched record can still be rendered for this request.
                }
            }
            return $candidate;
        }
    }
    return null;
}

function seo_project_payment_plans(PDO $pdo, int $projectId): array {
    $stored=heeraStoredRows($pdo,'heera_v4_payment_plans',[$projectId,0,0]);
    if($stored!==null)return $stored;
    try{$stmt=$pdo->prepare("SELECT pp.payment_plan_id AS plan_id,pp.project_id,pp.sub_project_id,pp.plan_name,pp.size_label,pp.booking_amount,pp.monthly_installment_count,pp.monthly_installment,pp.half_yearly_count,pp.half_yearly_installment,pp.balloting,pp.on_possession,pp.other_payment,pp.total_price,pp.full_payment_discount_percent,pp.half_payment_discount_percent,pp.preferred_location_charge_percent,sp.name AS sub_project_name FROM payment_plans pp LEFT JOIN sub_projects sp ON sp.sub_project_id=pp.sub_project_id WHERE pp.project_id=? AND pp.is_active=TRUE ORDER BY pp.sort_order,pp.payment_plan_id");$stmt->execute([$projectId]);return $stmt->fetchAll();}catch(Throwable $e){return [];}
}

/**
 * Public properties linked to a project. The selected sub-project is applied
 * later so one query can serve both the server-rendered page and JSON API.
 */
function seo_project_properties(PDO $pdo, int $projectId): array {
    if ($projectId < 1 || !seo_table_exists($pdo, 'properties')) return [];
    $stored=heeraStoredRows($pdo,'heera_v4_project_properties',[$projectId]);
    if($stored!==null)return $stored;
    try {
        $optional = static function (string $column, string $fallback = 'NULL') use ($pdo): string {
            return seo_column_exists($pdo, 'properties', $column) ? "pr.`{$column}`" : "{$fallback} AS `{$column}`";
        };
        $columns = [
            'pr.property_id', $optional('project_id'), $optional('sub_project_id'), $optional('slug'),
            $optional('listing_type'), $optional('property_type'), $optional('status'), $optional('title'),
            $optional('address_line1'), $optional('city'), $optional('block_name'), $optional('size_label'),
            $optional('bedrooms'), $optional('bathrooms'), $optional('area_sqft'), $optional('price'),
            $optional('price_pkr'), $optional('description'), $optional('updated_at'),
        ];
        $hasMedia = seo_table_exists($pdo, 'property_media');
        $columns[] = $hasMedia
            ? "(SELECT pm.file_path FROM property_media pm WHERE pm.property_id=pr.property_id AND pm.media_type='image' ORDER BY pm.is_cover DESC,pm.sort_order,pm.media_id LIMIT 1) AS image_url"
            : 'NULL AS image_url';
        $conditions = ['pr.project_id=?'];
        if (seo_column_exists($pdo, 'properties', 'status')) $conditions[] = "pr.status='available'";
        if (seo_column_exists($pdo, 'properties', 'publish_start_date')) $conditions[] = '(pr.publish_start_date IS NULL OR pr.publish_start_date<=CURRENT_DATE)';
        if (seo_column_exists($pdo, 'properties', 'publish_end_date')) $conditions[] = '(pr.publish_end_date IS NULL OR pr.publish_end_date>=CURRENT_DATE)';
        $order = seo_column_exists($pdo, 'properties', 'updated_at') ? 'pr.updated_at DESC,pr.property_id DESC' : 'pr.property_id DESC';
        $stmt = $pdo->prepare('SELECT '.implode(',', $columns).' FROM properties pr WHERE '.implode(' AND ', $conditions).' ORDER BY '.$order);
        $stmt->execute([$projectId]);
        return $stmt->fetchAll();
    } catch (Throwable $exception) {
        error_log('[Heera project properties] '.$exception->getMessage());
        return [];
    }
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

function seo_compact_schema($value) {
    if (!is_array($value)) return $value;
    $result = [];
    foreach ($value as $key => $item) {
        $item = seo_compact_schema($item);
        if ($item === null || $item === '' || (is_array($item) && !$item)) continue;
        $result[$key] = $item;
    }
    $isList = function_exists('array_is_list') ? array_is_list($value) : (!$value || array_keys($value) === range(0, count($value) - 1));
    return $isList ? array_values($result) : $result;
}

function seo_organization_schema(): array {
    $schema = [
        '@context' => 'https://schema.org',
        '@type' => ['RealEstateAgent','LocalBusiness'],
        '@id' => seo_url('#organization'),
        'name' => seo_site_name(),
        'url' => seo_url(),
        'logo' => seo_url('images/home-logo.jpg'),
        'image' => seo_url('images/al-rehman-garden-hero.png'),
        'description' => 'Real estate agency for plots, homes, commercial property and property investment in Lahore and Al Rehman Garden communities.',
        'telephone' => seo_business_phone(),
        'priceRange' => 'PKR',
        'address' => seo_business_address(),
        'areaServed' => [
            ['@type'=>'City','name'=>'Lahore'],
            ['@type'=>'Place','name'=>'Al Rehman Garden'],
            ['@type'=>'City','name'=>'Zafarwal'],
            ['@type'=>'City','name'=>'Sialkot'],
        ],
        'sameAs' => seo_social_urls(),
    ];
    $latitude = trim((string)(getenv('HEERA_LATITUDE') ?: ''));
    $longitude = trim((string)(getenv('HEERA_LONGITUDE') ?: ''));
    if (is_numeric($latitude) && is_numeric($longitude)) {
        $schema['geo'] = ['@type'=>'GeoCoordinates','latitude'=>(float)$latitude,'longitude'=>(float)$longitude];
    }
    return seo_compact_schema($schema);
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
        '<link rel="alternate" hreflang="en-PK" href="' . seo_h($canonical) . '" />',
        '<link rel="alternate" hreflang="x-default" href="' . seo_h($canonical) . '" />',
        '<meta property="og:site_name" content="' . seo_h(seo_site_name()) . '" />',
        '<meta property="og:locale" content="en_PK" />',
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
        '<meta name="twitter:image:alt" content="' . seo_h((string)($meta['image_alt'] ?? $title)) . '" />',
    ];
    if ($verification !== '') $tags[] = '<meta name="google-site-verification" content="' . seo_h($verification) . '" />';
    return implode("\n  ", $tags);
}

function seo_inject_document_meta(string $html, array $meta): string {
    $patterns = [
        '#\s*<title>.*?</title>#is',
        '#\s*<meta\s+name=["\'](?:description|robots|twitter:[^"\']+|google-site-verification)["\'][^>]*>#i',
        '#\s*<meta\s+property=["\']og:[^"\']+["\'][^>]*>#i',
        '#\s*<link\s+rel=["\'](?:canonical|alternate)["\'][^>]*>#i',
    ];
    $clean = preg_replace($patterns, '', $html) ?? $html;
    return str_replace('</head>', "\n  ".seo_meta_tags($meta)."\n</head>", $clean);
}

function seo_json_ld(array $data): string {
    return '<script type="application/ld+json">' . json_encode(seo_compact_schema($data), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP) . '</script>';
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
    try { seo_ensure_schema($pdo); } catch (Throwable $exception) { }
    $hasSlug = seo_column_exists($pdo, 'properties', 'slug');
    if ($slug !== null && $slug !== '' && !$hasSlug) return null;
    $qualifiedWhere = $slug !== null && $slug !== '' ? 'pr.slug=?' : 'pr.property_id=?';
    $value = $slug !== null && $slug !== '' ? $slug : $id;
    $optional = static function (string $column, string $fallback = 'NULL') use ($pdo): string {
        return seo_column_exists($pdo, 'properties', $column) ? "pr.`{$column}`" : "{$fallback} AS `{$column}`";
    };
    $propertyColumns = [
        'pr.property_id', $optional('project_id'), $optional('sub_project_id'), $optional('payment_plan_id'), $optional('slug'),
        'pr.listing_type', 'pr.property_type', 'pr.status', 'pr.title', 'pr.address_line1', 'pr.city',
        $optional('state_region'), $optional('block_name'), $optional('postal_code'), $optional('price'),
        $optional('bedrooms'), $optional('bathrooms'), $optional('area_sqft'), $optional('description'),
        $optional('size_label'), $optional('property_facing'), $optional('price_pkr'), $optional('price_per_marla'),
        $optional('publish_start_date'), $optional('publish_end_date'), $optional('created_at'), $optional('updated_at'),
    ];
    $hasProjectLink = seo_column_exists($pdo, 'properties', 'project_id') && seo_table_exists($pdo, 'projects');
    $hasSubProjectLink = seo_column_exists($pdo, 'properties', 'sub_project_id') && seo_table_exists($pdo, 'sub_projects');
    $projectPlanName = $hasProjectLink && seo_column_exists($pdo, 'projects', 'plan_name') ? 'pj.plan_name' : 'NULL';
    $projectPaymentPlans = $hasProjectLink && seo_column_exists($pdo, 'projects', 'payment_plans') ? 'pj.payment_plans' : 'NULL';
    $joins = $hasProjectLink ? ' LEFT JOIN projects pj ON pj.project_id=pr.project_id' : '';
    $joins .= $hasSubProjectLink ? ' LEFT JOIN sub_projects sp ON sp.sub_project_id=pr.sub_project_id' : '';
    $propertyColumns[] = $hasProjectLink ? 'pj.title AS project_title' : 'NULL AS project_title';
    $propertyColumns[] = $hasSubProjectLink ? "COALESCE(sp.name,{$projectPlanName}) AS project_plan_name" : "{$projectPlanName} AS project_plan_name";
    $propertyColumns[] = $hasSubProjectLink ? 'sp.name AS sub_project_name' : 'NULL AS sub_project_name';
    $propertyColumns[] = "{$projectPaymentPlans} AS project_payment_plans";
    $propertyColumns[] = $projectPaymentPlans !== 'NULL' ? "CASE WHEN {$projectPaymentPlans} IS NOT NULL AND TRIM({$projectPaymentPlans}) NOT IN ('','[]','null') THEN 1 ELSE 0 END AS has_payment_plan" : '0 AS has_payment_plan';
    $dateFilter = '';
    if (seo_column_exists($pdo, 'properties', 'publish_start_date')) $dateFilter .= ' AND (pr.publish_start_date IS NULL OR pr.publish_start_date<=CURRENT_DATE)';
    if (seo_column_exists($pdo, 'properties', 'publish_end_date')) $dateFilter .= ' AND (pr.publish_end_date IS NULL OR pr.publish_end_date>=CURRENT_DATE)';
    $stored = heeraStoredRows($pdo,'heera_v4_property_detail',[$slug !== null && $slug !== '' ? 0 : $id,$slug ?? '']);
    if ($stored !== null) {
        $property = $stored[0] ?? null;
    } else {
        $statement = $pdo->prepare('SELECT ' . implode(',', $propertyColumns) . " FROM properties pr{$joins} WHERE {$qualifiedWhere} AND pr.status='available'{$dateFilter} LIMIT 1");
        $statement->execute([$value]);
        $property = $statement->fetch();
    }
    if (!$property) return null;
    try {
        $storedMedia=heeraStoredRows($pdo,'heera_v4_property_media',[(int)$property['property_id']]);
        if($storedMedia!==null)$property['media']=$storedMedia;
        else{$media = $pdo->prepare('SELECT media_id,media_type,file_path,is_cover,sort_order FROM property_media WHERE property_id=? ORDER BY media_type,is_cover DESC,sort_order,media_id');$media->execute([(int)$property['property_id']]);$property['media'] = $media->fetchAll();}
    } catch (Throwable $exception) {
        $property['media'] = [];
    }
    $property['selected_payment_plan'] = seo_payment_plan_record($pdo, $property['payment_plan_id'] ?? null) ?: seo_find_payment_plan($property['project_payment_plans'] ?? null, $property['payment_plan_id'] ?? null);
    if ($property['selected_payment_plan']) $property['has_payment_plan'] = 1;
    $property['payment_plans'] = [];
    return $property;
}

function seo_fetch_project(PDO $pdo, ?string $slug, int $id = 0): ?array {
    try { seo_ensure_schema($pdo); } catch (Throwable $exception) { }
    $hasSlug = seo_column_exists($pdo, 'projects', 'slug');
    $hasPlanName = seo_column_exists($pdo, 'projects', 'plan_name');
    $hasPaymentPlans = seo_column_exists($pdo, 'projects', 'payment_plans');
    if ($slug !== null && $slug !== '' && !$hasSlug) return null;
    $where = $slug !== null && $slug !== '' ? 'slug=?' : 'project_id=?';
    $value = $slug !== null && $slug !== '' ? $slug : $id;
    $columns = 'project_id,'.($hasSlug?'slug':'NULL AS slug').',title,'.($hasPlanName?'plan_name':'NULL AS plan_name').',category,location,status,hero_image_url,headline,description,'.($hasPaymentPlans?'payment_plans':'NULL AS payment_plans').',created_at,updated_at';
    $stored=heeraStoredRows($pdo,'heera_v4_project_detail',[$slug !== null && $slug !== '' ? 0 : $id,$slug ?? '']);
    if($stored!==null)$project=$stored[0]??null;
    else{$statement = $pdo->prepare("SELECT {$columns} FROM projects WHERE {$where} AND status='published' LIMIT 1");$statement->execute([$value]);$project = $statement->fetch();}
    if (!$project) return null;
    try {
        $storedMedia=heeraStoredRows($pdo,'heera_v4_project_media',[(int)$project['project_id']]);
        if($storedMedia!==null)$project['media']=$storedMedia;
        else{$media = $pdo->prepare('SELECT media_id,media_type,file_path,caption,sort_order FROM project_media WHERE project_id=? ORDER BY media_type,sort_order,media_id');$media->execute([(int)$project['project_id']]);$project['media'] = $media->fetchAll();}
    } catch (Throwable $e) {
        $project['media'] = [];
    }
    $normalizedPlans = seo_project_payment_plans($pdo,(int)$project['project_id']);
    $project['payment_plans'] = $normalizedPlans ?: seo_decode_payment_plans((string)($project['payment_plans'] ?? ''));
    $project['sub_projects'] = seo_project_sub_projects($pdo,(int)$project['project_id']);
    $project['properties'] = seo_project_properties($pdo,(int)$project['project_id']);
    return $project;
}

function seo_select_project_sub_project(array $project, int $subProjectId): ?array {
    if ($subProjectId < 1) {
        $project['selected_sub_project'] = null;
        return $project;
    }
    $selected = null;
    foreach ((array)($project['sub_projects'] ?? []) as $subProject) {
        if ((int)($subProject['sub_project_id'] ?? 0) === $subProjectId) {
            $selected = $subProject;
            break;
        }
    }
    if (!$selected) return null;
    $project['selected_sub_project'] = $selected;
    $project['payment_plans'] = array_values(array_filter(
        (array)($project['payment_plans'] ?? []),
        static fn(array $plan): bool => empty($plan['sub_project_id']) || (int)$plan['sub_project_id'] === $subProjectId
    ));
    $includeUnassigned = count((array)($project['sub_projects'] ?? [])) === 1;
    $project['properties'] = array_values(array_filter(
        (array)($project['properties'] ?? []),
        static fn(array $property): bool => (int)($property['sub_project_id'] ?? 0) === $subProjectId
            || ($includeUnassigned && empty($property['sub_project_id']))
    ));
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
