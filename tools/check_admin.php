<?php
$host = getenv('HAVENLY_DB_HOST') ?: '127.0.0.1';
$name = getenv('HAVENLY_DB_NAME') ?: 'havenly_real_estate';
$user = getenv('HAVENLY_DB_USER') ?: 'root';
$pass = getenv('HAVENLY_DB_PASSWORD') ?: '';
try {
    $pdo = new PDO("mysql:host={$host};dbname={$name};charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $stmt = $pdo->query('SELECT admin_id, first_name, last_name, email FROM admin_users LIMIT 10');
    $rows = $stmt->fetchAll();
    echo json_encode($rows, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
} catch (Throwable $e) {
    echo 'ERROR: ' . $e->getMessage();
}
