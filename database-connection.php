<?php
declare(strict_types=1);

/**
 * One database connection for public pages, APIs, admin modules and routines.
 * XAMPP defaults work without configuration; production can use environment
 * variables HAVENLY_DB_HOST/PORT/NAME/USER/PASSWORD.
 */
function heeraDatabaseConfig(): array {
    return [
        'host' => trim((string)(getenv('HAVENLY_DB_HOST') ?: '127.0.0.1')),
        'port' => max(1, (int)(getenv('HAVENLY_DB_PORT') ?: 3306)),
        'name' => trim((string)(getenv('HAVENLY_DB_NAME') ?: 'havenly_real_estate')),
        'user' => (string)(getenv('HAVENLY_DB_USER') ?: 'root'),
        'password' => (string)(getenv('HAVENLY_DB_PASSWORD') ?: ''),
    ];
}

function heeraDatabase(): PDO {
    static $connection = null;
    if ($connection instanceof PDO) return $connection;
    $config = heeraDatabaseConfig();
    if (!preg_match('/^[A-Za-z0-9_]+$/', $config['name'])) throw new RuntimeException('The configured database name is invalid.');
    $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $config['host'], $config['port'], $config['name']);
    try {
        $connection = new PDO($dsn, $config['user'], $config['password'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_TIMEOUT => 8,
        ]);
        $connection->exec("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
        return $connection;
    } catch (PDOException $exception) {
        error_log('[Heera database] '.$exception->getMessage());
        throw new RuntimeException('Database connection failed. Check MySQL, database credentials, and project-schema-repair.sql.');
    }
}

function heeraStoredProcedureExists(PDO $pdo, string $name): bool {
    static $cache = [];
    if (!preg_match('/^[A-Za-z][A-Za-z0-9_]{2,63}$/', $name)) return false;
    $key = spl_object_id($pdo).':'.$name;
    if (array_key_exists($key, $cache)) return $cache[$key];
    try {
        $statement = $pdo->prepare('SELECT COUNT(*) FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA=DATABASE() AND ROUTINE_TYPE=\'PROCEDURE\' AND ROUTINE_NAME=?');
        $statement->execute([$name]);
        return $cache[$key] = (int)$statement->fetchColumn() > 0;
    } catch (Throwable $exception) {
        return $cache[$key] = false;
    }
}

/**
 * Returns the first routine result set, or null when the optional routine is
 * not installed/available. Callers retain their existing SQL as a fallback.
 */
function heeraStoredRows(PDO $pdo, string $name, array $parameters = []): ?array {
    if (!heeraStoredProcedureExists($pdo, $name)) return null;
    try {
        $placeholders = implode(',', array_fill(0, count($parameters), '?'));
        $statement = $pdo->prepare("CALL `{$name}`({$placeholders})");
        $statement->execute(array_values($parameters));
        $rows = $statement->fetchAll();
        while ($statement->nextRowset()) { /* release every result set */ }
        $statement->closeCursor();
        return $rows;
    } catch (Throwable $exception) {
        error_log('[Heera stored procedure]['.$name.'] '.$exception->getMessage());
        return null;
    }
}
