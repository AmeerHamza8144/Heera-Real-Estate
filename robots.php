<?php
declare(strict_types=1);require_once __DIR__.'/seo.php';header('Content-Type: text/plain; charset=utf-8');echo "User-agent: *\nAllow: /\nDisallow: /admin.html\nDisallow: /api.php\nDisallow: /client-form.html\nDisallow: /uploads/\nSitemap: ".seo_url('sitemap.xml')."\n";
