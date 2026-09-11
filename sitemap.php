<?php
declare(strict_types=1);

require_once __DIR__ . '/seo.php';

header('Content-Type: application/xml; charset=utf-8');

$today = date('Y-m-d');
$staticModified = static function (string $file) use ($today): string {
    $timestamp = @filemtime(__DIR__ . '/' . $file);
    return $timestamp ? date('Y-m-d', $timestamp) : $today;
};
$urls = [
    seo_url() => ['loc' => seo_url(), 'lastmod' => $staticModified('index.php')],
    seo_url('plot-finder.html') => ['loc' => seo_url('plot-finder.html'), 'lastmod' => $staticModified('plot-finder.html')],
    seo_url('installment-calculator.html') => ['loc' => seo_url('installment-calculator.html'), 'lastmod' => $staticModified('installment-calculator.html')],
    seo_url('property-comparison.html') => ['loc' => seo_url('property-comparison.html'), 'lastmod' => $staticModified('property-comparison.html')],
];

$addUrl = static function (array &$collection, string $location, ?string $modified = null): void {
    if ($location === '') return;
    $date = $modified && preg_match('/^\d{4}-\d{2}-\d{2}/', $modified)
        ? substr($modified, 0, 10)
        : date('Y-m-d');
    if (!isset($collection[$location]) || $date > $collection[$location]['lastmod']) {
        $collection[$location] = ['loc' => $location, 'lastmod' => $date];
    }
};

try {
    $pdo = seo_db();
    seo_ensure_schema($pdo);

    $properties = $pdo->query("SELECT slug,city,updated_at FROM properties WHERE status='available' AND slug IS NOT NULL AND slug<>'' AND (publish_start_date IS NULL OR publish_start_date<=CURRENT_DATE) AND (publish_end_date IS NULL OR publish_end_date>=CURRENT_DATE)")->fetchAll();
    foreach ($properties as $row) {
        $addUrl($urls, seo_url('property/' . $row['slug']), $row['updated_at']);
        if (trim((string)$row['city']) !== '') {
            $addUrl($urls, seo_url('location/' . seo_slugify((string)$row['city'])), $row['updated_at']);
        }
    }

    $projects = $pdo->query("SELECT slug,location,updated_at FROM projects WHERE status='published' AND slug IS NOT NULL AND slug<>''")->fetchAll();
    foreach ($projects as $row) {
        $addUrl($urls, seo_url('project/' . $row['slug']), $row['updated_at']);
        if (trim((string)$row['location']) !== '') {
            $addUrl($urls, seo_url('location/' . seo_slugify((string)$row['location'])), $row['updated_at']);
        }
    }

    $subProjects = $pdo->query("SELECT sp.slug,sp.updated_at FROM sub_projects sp JOIN projects p ON p.project_id=sp.project_id WHERE sp.status='published' AND p.status='published' AND sp.slug IS NOT NULL AND sp.slug<>''")->fetchAll();
    foreach ($subProjects as $row) {
        $addUrl($urls, seo_url('sub-project/' . $row['slug']), $row['updated_at']);
    }
} catch (Throwable $exception) {
    // Static URLs still make a valid sitemap while the database is unavailable.
}

echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
foreach ($urls as $url) {
    echo "  <url>\n";
    echo '    <loc>' . htmlspecialchars($url['loc'], ENT_XML1 | ENT_QUOTES, 'UTF-8') . "</loc>\n";
    echo '    <lastmod>' . htmlspecialchars($url['lastmod'], ENT_XML1 | ENT_QUOTES, 'UTF-8') . "</lastmod>\n";
    echo "  </url>\n";
}
echo '</urlset>';
