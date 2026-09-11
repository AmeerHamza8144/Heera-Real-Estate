<?php
declare(strict_types=1);

require_once __DIR__ . '/seo.php';

header('Content-Type: text/plain; charset=utf-8');

echo "User-agent: *\n";
echo "Allow: /\n";
echo "Disallow: /admin.html\n";
echo "Disallow: /admin-api.php\n";
echo "Disallow: /api.php\n";
echo "Disallow: /tests/\n";
echo "Disallow: /tools/\n";
echo 'Sitemap: ' . seo_url('sitemap.xml') . "\n";
