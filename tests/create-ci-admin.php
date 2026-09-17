<?php
declare(strict_types=1);
require_once __DIR__ . '/../database-connection.php';
$pdo = heeraDatabase();
$hash = password_hash('CI-Only-2026-Test!', PASSWORD_DEFAULT);
$stmt = $pdo->prepare("INSERT INTO admin_users (first_name,last_name,email,username,password_hash,is_active,role_id) VALUES ('CI','Admin','ci-admin@example.invalid','ci-admin',?,TRUE,(SELECT role_id FROM roles WHERE role_key='super_admin' LIMIT 1))");
$stmt->execute([$hash]);
