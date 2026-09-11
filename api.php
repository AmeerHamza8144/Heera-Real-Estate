<?php
declare(strict_types=1);
require_once __DIR__ . '/api-core.php';
require_once __DIR__ . '/ai-property-comparison.php';

$action = $_GET['action'] ?? '';
$csrfProtectedActions = [
    'logout','submit_property','save_submission','approve_submission','save_property','delete_property',
    'save_project','delete_project','save_sub_project','delete_sub_project','save_home_gallery','delete_home_gallery','save_popup','delete_popup',
    'save_agent','delete_agent','save_office_address','delete_office_address','save_login_user','delete_login_user','save_role','delete_role',
    'save_master_option','archive_master_option',
    'save_digital_map','delete_digital_map','save_digital_map_block','delete_digital_map_block','save_enquiry_status','upload'
];
if (in_array($action, $csrfProtectedActions, true)) verifyCsrf();
try {
    $legacyPermission = permissionForLegacyAction((string)$action);
    if ($legacyPermission !== null) requirePermission($legacyPermission);
    switch ($action) {
        case 'csrf': respond(['csrf_token' => csrfToken()]);
        case 'properties': respond(listings(true));
        case 'projects': respond(projects(true));
        case 'sub_projects': respond(subProjects((int)($_GET['project_id'] ?? 0), false));
        case 'payment_plans': respond(paymentPlansForProject((int)($_GET['project_id'] ?? 0), false, (int)($_GET['sub_project_id'] ?? 0)));
        case 'compare_properties': respond(compareProperties(requestData()));
        case 'admin_payment_plans': respond(paymentPlansForProject((int)($_GET['project_id'] ?? 0), true, (int)($_GET['sub_project_id'] ?? 0)));
        case 'auto_plot_meta': respond(automaticPlotMeta());
        case 'auto_plot_search': respond(automaticPlotSearch());
        case 'project':
            $projectId = (int)($_GET['id'] ?? 0);
            $projectSlug = trim((string)($_GET['slug'] ?? ''));
            $subProjectId = (int)($_GET['sub_project_id'] ?? 0);
            $subProjectSlug = trim((string)($_GET['sub_project_slug'] ?? ''));
            if ($subProjectSlug !== '' || ($projectId < 1 && $projectSlug === '' && $subProjectId > 0)) {
                $subProject = seo_fetch_published_sub_project(db(), $subProjectSlug ?: null, $subProjectId);
                if ($subProject) {
                    $projectId = (int)$subProject['project_id'];
                    $projectSlug = '';
                    $subProjectId = (int)$subProject['sub_project_id'];
                }
            }
            $project = projectById($projectId, $projectSlug, $subProjectId);
            if (!$project) errorResponse('Project not found.', 404);
            respond($project);
        case 'home_gallery': respond(homeGallery(false));
        case 'agents': respond(agents(true));
        case 'office_addresses': respond(officeAddresses(true));
        case 'crm_lead': saveCrmLead(requestData());
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
            $authenticatedAdmin = currentAdmin();
            respond(['user' => $authenticatedAdmin ? userPayload($authenticatedAdmin) : null]);
        case 'logout':
            $_SESSION = [];
            session_destroy();
            respond(['logged_out' => true]);
        case 'admin_properties':
            requireAdmin();
            respond(listings(false));
        case 'admin_projects': respond(projects(false));
        case 'admin_project_diagnostics':
            requireAdmin();
            respond(projectRelationshipDiagnostics((int)($_GET['id'] ?? 0), trim((string)($_GET['sub_project_slug'] ?? ''))));
        case 'admin_sub_projects': respond(subProjects((int)($_GET['project_id'] ?? 0), true));
        case 'save_sub_project': saveSubProject(requestData());
        case 'delete_sub_project': deleteSubProject(requestData());
        case 'admin_dashboard': respond(adminDashboardData());
        case 'admin_enquiries': respond(adminEnquiries());
        case 'save_enquiry_status': saveEnquiryStatus(requestData());
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
        case 'admin_role_options': respond(roleOptions());
        case 'admin_roles': respond(rolesAndPermissions());
        case 'save_role': saveRole(requestData());
        case 'delete_role': deleteRole(requestData());
        case 'admin_master_data': respond(masterOptions(true));
        case 'save_master_option': saveMasterOption(requestData());
        case 'archive_master_option': archiveMasterOption(requestData());
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
    $message = $exception instanceof PDOException
        ? (in_array((string)$action, ['admin_properties','properties','save_property','upload'], true) ? propertyDatabaseErrorMessage($exception) : 'The database request could not be completed.')
        : ($exception->getMessage() ?: 'An unexpected server error occurred.');
    errorResponse($message, 500);
}
