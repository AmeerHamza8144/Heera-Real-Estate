<?php
declare(strict_types=1);
require_once __DIR__ . '/seo.php';

$title = 'Real Estate, Plots & Property in Lahore | ' . seo_site_name();
$description = 'Explore verified plots, homes, commercial property and installment projects in Lahore, Al Rehman Garden, Zafarwal and Sialkot with Heera Real Estate.';
$canonical = seo_url();
$html = (string)file_get_contents(__DIR__ . '/index.html');
$html = seo_inject_document_meta($html, [
    'title' => $title,
    'description' => $description,
    'canonical' => $canonical,
    'image' => 'images/al-rehman-garden-hero.png',
    'image_alt' => 'Heera Real Estate properties and plots in Lahore',
]);

$websiteSchema = [
    '@context' => 'https://schema.org',
    '@type' => 'WebSite',
    '@id' => seo_url('#website'),
    'name' => seo_site_name(),
    'url' => $canonical,
    'inLanguage' => 'en-PK',
    'publisher' => ['@id' => seo_url('#organization')],
];
$pageSchema = [
    '@context' => 'https://schema.org',
    '@type' => 'WebPage',
    '@id' => seo_url('#webpage'),
    'name' => $title,
    'description' => $description,
    'url' => $canonical,
    'inLanguage' => 'en-PK',
    'isPartOf' => ['@id' => seo_url('#website')],
    'about' => ['@id' => seo_url('#organization')],
];
$html = str_replace('</head>', "\n  " . seo_json_ld(seo_organization_schema()) . "\n  " . seo_json_ld($websiteSchema) . "\n  " . seo_json_ld($pageSchema) . "\n</head>", $html);

$seoSections = '<section class="seo-home-intro section" aria-labelledby="seoHomeTitle"><div><p class="eyebrow">Property specialists in Punjab</p><h2 id="seoHomeTitle">Plots, homes and property investment in Lahore</h2></div><div><p>Heera Real Estate helps buyers and investors explore residential plots, commercial property, homes and installment opportunities across Al Rehman Garden communities, Lahore, Zafarwal and Sialkot.</p><p>Browse current listings, compare payment plans, view project details and use the digital Plot Finder before contacting our team.</p><div class="seo-home-actions"><a href="?listing=sale#listings">Properties for sale</a><a href="?listing=installment#listings">Installment properties</a><a href="plot-finder.html">Digital Plot Finder</a></div></div></section>';

try {
    $pdo = seo_db();
    seo_ensure_schema($pdo);

    $projects = $pdo->query("SELECT project_id,slug,title,category,location,description,updated_at FROM projects WHERE status='published' AND slug IS NOT NULL AND slug<>'' ORDER BY updated_at DESC LIMIT 6")->fetchAll();
    $properties = $pdo->query("SELECT property_id,slug,title,property_type,listing_type,city,price,price_pkr,description,updated_at FROM properties WHERE status='available' AND slug IS NOT NULL AND slug<>'' AND (publish_start_date IS NULL OR publish_start_date<=CURRENT_DATE) AND (publish_end_date IS NULL OR publish_end_date>=CURRENT_DATE) ORDER BY updated_at DESC LIMIT 6")->fetchAll();

    if ($projects || $properties) {
        $cards = '';
        foreach ($projects as $project) {
            $cards .= '<article class="seo-discovery-card"><p class="eyebrow">' . seo_h($project['category']) . ' project</p><h3><a href="project/' . seo_h($project['slug']) . '">' . seo_h($project['title']) . '</a></h3><p>' . seo_h($project['location']) . '</p><span>' . seo_h(seo_description($project['description'], 115)) . '</span></article>';
        }
        foreach ($properties as $property) {
            $cards .= '<article class="seo-discovery-card"><p class="eyebrow">' . seo_h($property['property_type']) . ' · ' . seo_h(seo_listing_label($property['listing_type'])) . '</p><h3><a href="property/' . seo_h($property['slug']) . '">' . seo_h($property['title']) . '</a></h3><p>' . seo_h($property['city']) . '</p><span>' . seo_h(seo_property_price($property)) . '</span></article>';
        }
        $seoSections .= '<section class="seo-home-discovery section"><div class="section-heading"><div><p class="eyebrow">Explore our inventory</p><h2>Latest properties and projects</h2></div></div><div class="seo-discovery-grid">' . $cards . '</div></section>';
    }

    $places = [];
    $placeRows = $pdo->query("SELECT place,MAX(updated_at) AS updated_at FROM (SELECT city AS place,updated_at FROM properties WHERE status='available' UNION ALL SELECT location AS place,updated_at FROM projects WHERE status='published') locations WHERE place IS NOT NULL AND TRIM(place)<>'' GROUP BY place ORDER BY MAX(updated_at) DESC LIMIT 12")->fetchAll();
    foreach ($placeRows as $row) {
        $place = trim((string)$row['place']);
        if ($place !== '') $places[$place] = seo_slugify($place);
    }
    if ($places) {
        $links = '';
        foreach ($places as $place => $placeSlug) $links .= '<a href="location/' . seo_h($placeSlug) . '">' . seo_h($place) . '</a>';
        $seoSections .= '<section class="seo-home-locations section"><div class="section-heading"><div><p class="eyebrow">Explore by area</p><h2>Popular property locations</h2></div></div><div class="seo-location-links">' . $links . '</div></section>';
    }
} catch (Throwable $exception) {
    // The marketing page remains available while database connectivity is restored.
}

$html = str_replace('</main>', $seoSections . '</main>', $html);
$html = str_replace('</body>', seo_analytics() . "\n</body>", $html);
echo $html;
