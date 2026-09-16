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

// Inventory/project/location discovery is handled by the main interactive sections and sitemap.
// Keep the homepage focused instead of duplicating listing and location blocks.

$html = str_replace('</main>', $seoSections . '</main>', $html);
$html = str_replace('</body>', seo_analytics() . "\n</body>", $html);
echo $html;
