<?php
declare(strict_types=1);
$host = getenv('HAVENLY_DB_HOST') ?: '127.0.0.1';
$name = getenv('HAVENLY_DB_NAME') ?: 'havenly_real_estate';
$user = getenv('HAVENLY_DB_USER') ?: 'root';
$pass = getenv('HAVENLY_DB_PASSWORD') ?: '';
$pdo = new PDO("mysql:host={$host};dbname={$name};charset=utf8mb4", $user, $pass, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);

$requiredTables = ['projects','sub_projects','payment_plans','properties','roles','permissions','role_permissions','admin_users','system_migrations'];
$requiredColumns = [
    ['properties','sub_project_id'],['properties','payment_plan_id'],['payment_plans','sub_project_id'],['admin_users','role_id']
];
$requiredFks = ['fk_sub_project_project','fk_payment_plan_project','fk_payment_plan_sub_project','fk_property_project','fk_property_sub_project','fk_property_payment_plan','fk_admin_role'];
$fail = false;
foreach ($requiredTables as $table) {
    $stmt=$pdo->prepare('SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?');$stmt->execute([$table]);$ok=(int)$stmt->fetchColumn()===1;
    echo ($ok?'[PASS] ':'[FAIL] ')."table {$table}\n"; $fail = $fail || !$ok;
}
foreach ($requiredColumns as [$table,$column]) {
    $stmt=$pdo->prepare('SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?');$stmt->execute([$table,$column]);$ok=(int)$stmt->fetchColumn()===1;
    echo ($ok?'[PASS] ':'[FAIL] ')."column {$table}.{$column}\n"; $fail = $fail || !$ok;
}
foreach ($requiredFks as $fk) {
    $stmt=$pdo->prepare("SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND CONSTRAINT_NAME=? AND CONSTRAINT_TYPE='FOREIGN KEY'");$stmt->execute([$fk]);$ok=(int)$stmt->fetchColumn()===1;
    echo ($ok?'[PASS] ':'[FAIL] ')."foreign key {$fk}\n"; $fail = $fail || !$ok;
}
$orphanChecks = [
    'property project orphans' => 'SELECT COUNT(*) FROM properties pr LEFT JOIN projects p ON p.project_id=pr.project_id WHERE pr.project_id IS NOT NULL AND p.project_id IS NULL',
    'property sub-project orphans' => 'SELECT COUNT(*) FROM properties pr LEFT JOIN sub_projects sp ON sp.sub_project_id=pr.sub_project_id WHERE pr.sub_project_id IS NOT NULL AND sp.sub_project_id IS NULL',
    'property payment-plan orphans' => 'SELECT COUNT(*) FROM properties pr LEFT JOIN payment_plans pp ON pp.payment_plan_id=pr.payment_plan_id WHERE pr.payment_plan_id IS NOT NULL AND pp.payment_plan_id IS NULL',
];
foreach ($orphanChecks as $label=>$sql) {
    $count=(int)$pdo->query($sql)->fetchColumn();$ok=$count===0;echo ($ok?'[PASS] ':'[FAIL] ')."{$label}: {$count}\n";$fail=$fail||!$ok;
}
exit($fail?1:0);
