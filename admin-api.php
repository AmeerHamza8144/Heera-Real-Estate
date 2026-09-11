<?php
declare(strict_types=1);
require_once __DIR__ . '/api-core.php';
require_once __DIR__ . '/ai-property-advisor.php';

header('X-Heera-Admin-API-Version: 2');

function adminApiEnsureBaseTables(PDO $pdo): void {
    $pdo->exec("CREATE TABLE IF NOT EXISTS admin_users (
        admin_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        first_name VARCHAR(80) NOT NULL,
        last_name VARCHAR(80) NOT NULL DEFAULT '',
        email VARCHAR(255) NOT NULL UNIQUE,
        username VARCHAR(100) DEFAULT NULL UNIQUE,
        phone VARCHAR(30) DEFAULT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS properties (
        property_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        project_id INT UNSIGNED DEFAULT NULL,
        sub_project_id INT UNSIGNED DEFAULT NULL,
        payment_plan_id VARCHAR(80) DEFAULT NULL,
        listing_type ENUM('sale','rent','installment') NOT NULL DEFAULT 'sale',
        property_type ENUM('House','Apartment','Villa','Condo','Land') NOT NULL,
        status ENUM('available','pending','sold','rented') NOT NULL DEFAULT 'available',
        title VARCHAR(180) NOT NULL,
        slug VARCHAR(190) DEFAULT NULL,
        address_line1 VARCHAR(255) NOT NULL,
        city VARCHAR(100) NOT NULL,
        state_region VARCHAR(100) DEFAULT NULL,
        block_name VARCHAR(120) DEFAULT NULL,
        postal_code VARCHAR(25) DEFAULT NULL,
        price DECIMAL(12,2) DEFAULT NULL,
        bedrooms DECIMAL(3,1) DEFAULT NULL,
        bathrooms DECIMAL(3,1) DEFAULT NULL,
        area_sqft INT UNSIGNED DEFAULT NULL,
        size_label VARCHAR(60) DEFAULT NULL,
        property_facing VARCHAR(60) DEFAULT NULL,
        price_pkr DECIMAL(15,2) DEFAULT NULL,
        price_per_marla DECIMAL(12,2) DEFAULT NULL,
        description TEXT,
        publish_start_date DATE DEFAULT NULL,
        publish_end_date DATE DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_property_slug (slug),
        INDEX idx_property_project (project_id),
        INDEX idx_property_sub_project (sub_project_id),
        INDEX idx_property_search (status, listing_type, property_type, city, price)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS property_media (
        media_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        property_id INT UNSIGNED NOT NULL,
        media_type ENUM('image','video','link') NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        is_cover BOOLEAN NOT NULL DEFAULT FALSE,
        sort_order TINYINT UNSIGNED NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_media_property (property_id, media_type, is_cover, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS enquiries (
        enquiry_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        property_id INT UNSIGNED DEFAULT NULL,
        name VARCHAR(160) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(30) DEFAULT NULL,
        interest ENUM('buying','selling','renting','agent') NOT NULL DEFAULT 'buying',
        message TEXT,
        status ENUM('new','contacted','closed') NOT NULL DEFAULT 'new',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_enquiry_status (status, created_at),
        INDEX idx_enquiry_property (property_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS home_gallery (
        gallery_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        image_url VARCHAR(500) NOT NULL,
        caption VARCHAR(255) DEFAULT NULL,
        sort_order TINYINT UNSIGNED NOT NULL DEFAULT 0,
        is_published BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_home_gallery_image (image_url),
        INDEX idx_home_gallery (is_published, sort_order, gallery_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
}

function adminApiEnsureSchema(PDO $pdo): array {
    static $done = false;
    static $messages = [];
    if ($done) return $messages;

    $steps = [
        'base' => static fn() => adminApiEnsureBaseTables($pdo),
        'login_users' => static fn() => ensureLoginUsersSchema($pdo),
        'projects' => static fn() => ensureProjectPlanSchema($pdo),
        'sub_projects' => static fn() => ensureSubProjectsSchema($pdo),
        'payment_plans' => static fn() => ensurePaymentPlansTable($pdo),
        'access_control' => static fn() => ensureAccessControlSchema($pdo),
        'relations' => static fn() => ensureRelationalIntegrity($pdo),
        'property_publishing' => static fn() => ensurePropertyPublishingSchema($pdo),
        'submissions' => static fn() => ensurePropertySubmissionsTable($pdo),
        'crm_leads' => static fn() => ensureEnquiriesTable($pdo),
        'agents' => static fn() => ensureAgentsTable($pdo),
        'offices' => static fn() => ensureOfficeAddressesTable($pdo),
        'popups' => static fn() => ensurePopupAdsTable($pdo),
        'digital_maps' => static fn() => ensureDigitalMapSchema($pdo),
        'master_data' => static fn() => ensureMasterOptionsSchema($pdo),
        'ai_advisor' => static fn() => ensureAiAdvisorSchema($pdo),
    ];
    foreach ($steps as $name => $step) {
        try {
            $step();
            $messages[$name] = 'ok';
        } catch (Throwable $exception) {
            $messages[$name] = 'error';
            error_log('[Heera Admin API schema][' . $name . '] ' . $exception->getMessage());
        }
    }
    $done = true;
    $_SESSION['heera_schema_session']='master-data-v2';
    return $messages;
}

function adminApiTableExists(PDO $pdo, string $table): bool {
    try {
        $statement = $pdo->query('SHOW TABLES LIKE ' . $pdo->quote($table));
        return (bool)$statement->fetchColumn();
    } catch (Throwable $exception) {
        return false;
    }
}

function adminApiSchemaReport(PDO $pdo): array {
    $tables = ['admin_users','client_users','roles','permissions','role_permissions','system_migrations','properties','property_media','projects','sub_projects','project_media','payment_plans','enquiries','property_submissions','digital_maps','digital_map_blocks','home_gallery','popup_ads','agents','office_addresses','master_options','ai_advisor_sessions'];
    $report = [];
    foreach ($tables as $table) $report[$table] = adminApiTableExists($pdo, $table);
    return $report;
}

function adminApiPropertyColumnReport(PDO $pdo): array {
    $required = ['property_id','project_id','sub_project_id','payment_plan_id','listing_type','property_type','status','title','slug','address_line1','city','state_region','block_name','postal_code','price','bedrooms','bathrooms','area_sqft','description','size_label','property_facing','price_pkr','price_per_marla','publish_start_date','publish_end_date','created_at','updated_at'];
    $report = [];
    foreach ($required as $column) $report[$column] = databaseColumnExists($pdo, 'properties', $column);
    return $report;
}

function adminApiHealth(): array {
    requireAdmin();
    $pdo = db();
    $schemaSteps = adminApiEnsureSchema($pdo);
    $database = false;
    try { $database = (int)$pdo->query('SELECT 1')->fetchColumn() === 1; } catch (Throwable $exception) { $database = false; }
    $tables = adminApiSchemaReport($pdo);
    $propertyColumns = adminApiPropertyColumnReport($pdo);
    $stepsReady = !in_array('error', $schemaSteps, true);
    $columnsReady = !in_array(false, $propertyColumns, true);
    $routineNames=[
        'heera_v4_properties','heera_v4_projects','heera_v4_subprojects','heera_v4_payment_plans',
        'heera_v4_crm_leads','heera_v4_submissions','heera_v4_maps','heera_v4_map_blocks',
        'heera_v4_gallery','heera_v4_updates','heera_v4_agents','heera_v4_offices',
        'heera_v4_admin_users','heera_v4_client_users','heera_v4_roles','heera_v4_permissions','heera_v4_role_permissions',
        'heera_v4_property_detail','heera_v4_property_media','heera_v4_project_detail','heera_v4_project_media','heera_v4_project_properties',
        'heera_v4_master_options','heera_v4_dashboard_counts','heera_v4_module_health'
    ];
    $routines=[];foreach($routineNames as $routine)$routines[$routine]=heeraStoredProcedureExists($pdo,$routine);
    return [
        'api_version' => 'v2',
        'database' => $database ? 'connected' : 'error',
        'schema_ready' => !in_array(false, $tables, true) && $stepsReady && $columnsReady,
        'tables' => $tables,
        'property_columns' => $propertyColumns,
        'schema_steps' => $schemaSteps,
        'foreign_keys' => relationalHealth($pdo),
        'stored_procedures' => $routines,
        'module_health' => heeraStoredRows($pdo,'heera_v4_module_health') ?? [],
        'server_time' => date(DATE_ATOM),
    ];
}

function adminApiBootstrap(): array {
    $pdo = db();
    adminApiEnsureSchema($pdo);
    $user = currentAdmin();
    if (!$user) {
        return ['authenticated' => false, 'user' => null, 'csrf_token' => csrfToken(), 'api_version' => 'v2'];
    }
    return [
        'authenticated' => true,
        'user' => userPayload($user),
        'csrf_token' => csrfToken(),
        'api_version' => 'v2',
        'dashboard' => adminHasPermission($user,'dashboard.view') ? adminDashboardData() : null,
        'capabilities' => adminCapabilitiesFromPermissions($user),
    ];
}

$route = trim((string)($_GET['route'] ?? $_GET['action'] ?? ''), '/');
$route = strtolower($route);

$aliases = [
    // Previous admin API action names remain valid.
    'admin_dashboard' => 'dashboard',
    'admin_properties' => 'properties',
    'save_property' => 'properties/save',
    'delete_property' => 'properties/delete',
    'admin_projects' => 'projects',
    'save_project' => 'projects/save',
    'delete_project' => 'projects/delete',
    'admin_sub_projects' => 'sub-projects',
    'save_sub_project' => 'sub-projects/save',
    'delete_sub_project' => 'sub-projects/delete',
    'admin_payment_plans' => 'payment-plans',
    'admin_enquiries' => 'crm/leads',
    'admin_crm_leads' => 'crm/leads',
    'crm_stats' => 'crm/stats',
    'crm_create_lead' => 'crm/leads/create',
    'save_enquiry_status' => 'crm/leads/update',
    'save_crm_lead' => 'crm/leads/update',
    'admin_submissions' => 'submissions',
    'save_submission' => 'submissions/save',
    'approve_submission' => 'submissions/approve',
    'admin_digital_maps' => 'maps',
    'save_digital_map' => 'maps/save',
    'delete_digital_map' => 'maps/delete',
    'save_digital_map_block' => 'maps/blocks/save',
    'delete_digital_map_block' => 'maps/blocks/delete',
    'admin_home_gallery' => 'gallery',
    'save_home_gallery' => 'gallery/save',
    'delete_home_gallery' => 'gallery/delete',
    'admin_popups' => 'popups',
    'save_popup' => 'popups/save',
    'delete_popup' => 'popups/delete',
    'admin_agents' => 'agents',
    'save_agent' => 'agents/save',
    'delete_agent' => 'agents/delete',
    'ai_advisor_recommend' => 'advisor/recommend',
    'ai_advisor_history' => 'advisor/history',
    'admin_office_addresses' => 'offices',
    'save_office_address' => 'offices/save',
    'delete_office_address' => 'offices/delete',
    'admin_login_users' => 'users',
    'save_login_user' => 'users/save',
    'delete_login_user' => 'users/delete',
    'admin_role_options' => 'role-options',
    'admin_roles' => 'roles',
    'save_role' => 'roles/save',
    'delete_role' => 'roles/delete',
    'admin_master_data' => 'master-data',
    'save_master_option' => 'master-data/save',
    'archive_master_option' => 'master-data/archive',
];
if (isset($aliases[$route])) $route = $aliases[$route];

$csrfProtectedRoutes = [
    'logout',
    'properties/save','properties/delete',
    'projects/save','projects/delete','sub-projects/save','sub-projects/delete',
    'crm/leads/create','crm/leads/update',
    'leads/status',
    'submissions/save','submissions/approve',
    'maps/save','maps/delete','maps/blocks/save','maps/blocks/delete',
    'gallery/save','gallery/delete',
    'popups/save','popups/delete',
    'agents/save','agents/delete',
    'advisor/recommend',
    'offices/save','offices/delete',
    'users/save','users/delete','roles/save','roles/delete',
    'master-data/save','master-data/archive',
    'upload',
];

try {
    if ($route === '' || $route === 'bootstrap') respond(adminApiBootstrap());
    if ($route === 'csrf') respond(['csrf_token' => csrfToken(), 'api_version' => 'v2']);
    if ($route === 'session') {
        $pdo = db(); adminApiEnsureSchema($pdo);
        $user = currentAdmin();
        respond(['authenticated' => $user !== null, 'user' => $user ? userPayload($user) : null, 'csrf_token' => csrfToken(), 'api_version' => 'v2']);
    }

    requireAdmin();
    $pdo = db();
    $requiredPermission = permissionForAdminRoute($route);
    if ($requiredPermission !== null) requirePermission($requiredPermission);
    if (in_array($route, $csrfProtectedRoutes, true)) verifyCsrf();

    switch ($route) {
        case 'health':
        case 'system/health': respond(adminApiHealth());
        case 'dashboard': respond(adminDashboardData());

        case 'properties': respond(listings(false));
        case 'properties/save': saveProperty(requestData());
        case 'properties/delete': deleteProperty(requestData());

        case 'projects': respond(projects(false));
        case 'projects/save': saveProject(requestData());
        case 'projects/delete': deleteProject(requestData());
        case 'sub-projects': respond(subProjects((int)($_GET['project_id'] ?? 0), true));
        case 'sub-projects/save': saveSubProject(requestData());
        case 'sub-projects/delete': deleteSubProject(requestData());
        case 'payment-plans': respond(paymentPlansForProject((int)($_GET['project_id'] ?? 0), true, (int)($_GET['sub_project_id'] ?? 0)));

        case 'leads':
        case 'crm/leads': respond(adminCrmLeads());
        case 'crm/stats': respond(crmLeadStats());
        case 'crm/leads/create': createCrmLeadAdmin(requestData());
        case 'crm/leads/update': updateCrmLead(requestData());
        case 'leads/status': saveEnquiryStatus(requestData());

        case 'submissions': respond(adminSubmissions());
        case 'submissions/save': saveSubmission(requestData());
        case 'submissions/approve': approveSubmission(requestData());

        case 'maps': respond(digitalMaps(false));
        case 'maps/save': saveDigitalMap();
        case 'maps/delete': deleteDigitalMap(requestData());
        case 'maps/blocks/save': saveDigitalMapBlock(requestData());
        case 'maps/blocks/delete': deleteDigitalMapBlock(requestData());

        case 'gallery': respond(homeGallery(true));
        case 'gallery/save': saveHomeGallery(requestData());
        case 'gallery/delete': deleteHomeGallery(requestData());

        case 'popups': respond(adminPopups());
        case 'popups/save': savePopup(requestData());
        case 'popups/delete': deletePopup(requestData());

        case 'agents': respond(agents(false));
        case 'agents/save': saveAgent(requestData());
        case 'agents/delete': deleteAgent(requestData());

        case 'advisor/recommend': respond(aiAdvisorRecommend(requestData()));
        case 'advisor/history': respond(aiAdvisorHistory());

        case 'offices': respond(officeAddresses(false));
        case 'offices/save': saveOfficeAddress(requestData());
        case 'offices/delete': deleteOfficeAddress(requestData());

        case 'users': respond(loginUsers());
        case 'users/save': saveLoginUser(requestData());
        case 'users/delete': deleteLoginUser(requestData());
        case 'role-options': respond(roleOptions());
        case 'roles': respond(rolesAndPermissions());
        case 'roles/save': saveRole(requestData());
        case 'roles/delete': deleteRole(requestData());

        case 'master-data': respond(masterOptions(true));
        case 'master-data/save': saveMasterOption(requestData());
        case 'master-data/archive': archiveMasterOption(requestData());

        case 'upload': uploadMedia();
        case 'logout':
            $_SESSION = [];
            session_destroy();
            respond(['logged_out' => true]);
        default: errorResponse('Unknown Admin API route.', 404);
    }
} catch (Throwable $exception) {
    error_log('[Heera Admin API] ' . get_class($exception) . ': ' . $exception->getMessage());
    $message = $exception instanceof PDOException
        ? (in_array($route, ['properties','properties/save','upload'], true)
            ? propertyDatabaseErrorMessage($exception)
            : 'The database request could not be completed. Check database credentials and schema health.')
        : ($exception->getMessage() ?: 'An unexpected Admin API error occurred.');
    errorResponse($message, 500);
}
