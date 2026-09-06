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
check(str_contains($adminHtml, 'name="sub_project_id"'), 'property editor has normalized sub-project selector');
check(str_contains($adminJs, 'loadSubProjects') && str_contains($adminJs, 'loadRoles'), 'admin JS loads new structural modules');
check(str_contains($core, "'payment_plans'] = null") || str_contains($core, "'payment_plans' => null"), 'project writes deprecate legacy payment-plan JSON');

if ($failures) {
    fwrite(STDERR, PHP_EOL.'Static contract failures: '.count($failures).PHP_EOL);
    exit(1);
}
echo PHP_EOL."All structural contracts passed.".PHP_EOL;
