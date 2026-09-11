<?php
declare(strict_types=1);

$root = dirname(__DIR__);
$failures = [];
function check(bool $condition, string $message): void {
    global $failures;
    echo ($condition ? "[PASS] " : "[FAIL] ") . $message . PHP_EOL;
    if (!$condition) $failures[] = $message;
}
function contents(string $path): string {
    $data = @file_get_contents($path);
    return is_string($data) ? $data : '';
}

$db = contents($root.'/database.sql');
$core = contents($root.'/api-core.php');
$structural = contents($root.'/structural-v2.php');
$adminApi = contents($root.'/admin-api.php');
$legacyApi = contents($root.'/api.php');
$adminHtml = contents($root.'/admin.html');
$adminJs = contents($root.'/admin.js');
$siteNav = contents($root.'/site-nav.js');
$projectJs = contents($root.'/project.js');

check(str_contains($db, 'CREATE TABLE sub_projects'), 'database.sql defines normalized sub_projects');
check(str_contains($db, 'sub_project_id INT UNSIGNED'), 'database.sql links properties/payment plans to sub-projects');
check(str_contains($db, 'CREATE TABLE roles') && str_contains($db, 'CREATE TABLE role_permissions'), 'database.sql defines RBAC tables');
check(str_contains($db, 'fk_property_payment_plan'), 'database.sql declares property → payment plan foreign key');
check(str_contains($structural, 'function ensureRelationalIntegrity'), 'runtime relational repair is available');
check(str_contains($structural, 'function requirePermission'), 'server-side permission enforcement helper exists');
check(str_contains($adminApi, "case 'sub-projects'"), 'Admin API exposes sub-projects');
check(str_contains($adminApi, "case 'roles'"), 'Admin API exposes roles and permissions');
check(str_contains($legacyApi, 'permissionForLegacyAction'), 'legacy admin API actions are permission-gated');
check(str_contains($adminHtml, 'id="subProjectsWorkspace"'), 'admin contains Sub-Projects workspace');
check(str_contains($adminHtml, 'id="rolesWorkspace"'), 'admin contains Roles & Permissions workspace');
check(str_contains($adminHtml, 'name="sub_project_id"') && str_contains($adminHtml, 'name="sub_project_name"'), 'property editor accepts a text sub-project and keeps its normalized ID');
check(str_contains($adminHtml, 'id="projectSubProjectName"') && !str_contains($adminHtml, '<input type="hidden" name="plan_name"'), 'project editor exposes Sub-Project as a textbox');
check(str_contains($adminJs, 'project_plan_sub_project_name_') && str_contains($core, "['sub_project_name']"), 'payment-plan Sub-Project textbox is normalized by the API');
check(!str_contains($core, 'legacy label can be read'), 'project Sub-Project textbox does not depend on the legacy plan_name column');
check(str_contains($adminJs, 'loadSubProjects') && str_contains($adminJs, 'loadRoles'), 'admin JS loads new structural modules');
check(str_contains($core, "'payment_plans'] = null") || str_contains($core, "'payment_plans' => null"), 'project writes deprecate legacy payment-plan JSON');
check(is_file($root.'/project-schema-repair.sql'), 'phpMyAdmin project schema repair is included');
check(str_contains(contents($root.'/index.html'), 'id="importantUpdates"'), 'landing page contains the important-updates ticker');
check(str_contains($siteNav, 'sub_project_id=') && !str_contains($siteNav, 'Project overview'), 'public Projects menu links real Sub-Project names');
check(str_contains($projectJs, 'selected_sub_project') && str_contains($projectJs, 'About the sub-project'), 'project page renders the selected Sub-Project identity');

if ($failures) {
    fwrite(STDERR, PHP_EOL.'Static contract failures: '.count($failures).PHP_EOL);
    exit(1);
}
echo PHP_EOL."All structural contracts passed.".PHP_EOL;
