<?php
declare(strict_types=1);

require_once __DIR__ . '/seo.php';

$slug = seo_slugify((string)($_GET['slug'] ?? ''));
try {
    $records = seo_location_records(seo_db(), $slug);
} catch (Throwable $exception) {
    $records = ['name'=>ucwords(str_replace('-', ' ', $slug)), 'properties'=>[], 'projects'=>[]];
}
$found = count($records['properties']) + count($records['projects']) > 0;
if (!$found) http_response_code(404);

$title = 'Property, Plots & Projects in ' . $records['name'] . ' | ' . seo_site_name();
$description = seo_description('Explore available residential and commercial property, plots, homes and real-estate projects in ' . $records['name'] . ' with Heera Estate.');
$canonical = seo_url('location/' . $slug);
$crumbs = [['name'=>'Home','url'=>seo_url()], ['name'=>$records['name'],'url'=>$canonical]];
$listItems = [];
$position = 1;
foreach ($records['properties'] as $property) {
    if (empty($property['slug'])) continue;
    $listItems[] = ['@type'=>'ListItem','position'=>$position++,'name'=>$property['title'],'url'=>seo_url('property/'.$property['slug'])];
}
foreach ($records['projects'] as $project) {
    if (empty($project['slug'])) continue;
    $listItems[] = ['@type'=>'ListItem','position'=>$position++,'name'=>$project['title'],'url'=>seo_url('project/'.$project['slug'])];
}
$collectionSchema = ['@context'=>'https://schema.org','@type'=>'CollectionPage','@id'=>$canonical.'#page','name'=>$title,'description'=>$description,'url'=>$canonical,'inLanguage'=>'en-PK','about'=>['@type'=>'Place','name'=>$records['name']],'mainEntity'=>['@type'=>'ItemList','numberOfItems'=>count($listItems),'itemListElement'=>$listItems]];
?><!DOCTYPE html>
<html lang="en-PK"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<?=seo_meta_tags(['title'=>$title,'description'=>$description,'canonical'=>$canonical,'robots'=>$found?null:'noindex,follow'])?>
<base href="<?=seo_h(seo_site_url().'/')?>"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="styles.css"><link rel="stylesheet" href="seo.css"><link rel="stylesheet" href="liquid-glass.css"><link rel="stylesheet" href="navigation-fixes.css"><link rel="stylesheet" href="footer-compact.css"><?=seo_json_ld(seo_breadcrumb_schema($crumbs))?><?=seo_json_ld($collectionSchema)?></head>
<body><header class="site-header"><a class="brand" href="./"><span class="brand-logo"><img src="images/home-logo.jpg" alt="Heera Estate logo" width="56" height="56"></span><span>Heera Estate</span></a><button class="menu-toggle" type="button" aria-label="Open menu" aria-expanded="false"><span></span><span></span><span></span></button><nav class="main-nav" aria-label="Main navigation"><a href="./">Home</a><a href="./?listing=sale#listings">Buy</a><a href="./?listing=rent#listings">Rent</a><a href="./?listing=installment#listings">Installments</a><a href="./#agents">Agents</a><div class="projects-nav"><button class="projects-toggle" type="button" aria-expanded="false">Projects <span>⌄</span></button><div class="projects-menu" id="projectsMenu"><span class="projects-loading">Loading projects…</span></div></div><a href="plot-finder.html">PLOT FINDER</a><a href="./#contact">Contact</a><a class="nav-add-property" href="add-property.html">Add Property</a><a class="login-button nav-login-item" href="./#admin-login">Login</a></nav></header>
<main class="seo-location-page"><nav class="seo-breadcrumbs" aria-label="Breadcrumb"><ol><li><a href="./">Home</a></li><li aria-current="page"><?=seo_h($records['name'])?></li></ol></nav><header class="seo-location-hero"><p class="eyebrow">Explore by location</p><h1>Real estate in <?=seo_h($records['name'])?></h1><p><?=seo_h($description)?></p></header>
<?php if(!$found):?><section class="seo-empty"><h2>No published listings yet</h2><a href="./#listings">Browse all properties</a></section><?php else:?>
<?php if($records['properties']):?><section class="seo-result-section"><h2>Available properties in <?=seo_h($records['name'])?></h2><div class="seo-card-grid"><?php foreach($records['properties'] as $property):?><article class="seo-card"><p class="eyebrow"><?=seo_h($property['property_type'])?> · <?=seo_h(seo_listing_label($property['listing_type']))?></p><h3><a href="property/<?=seo_h($property['slug'])?>"><?=seo_h($property['title'])?></a></h3><p><?=seo_h(seo_property_price($property))?></p></article><?php endforeach;?></div></section><?php endif;?>
<?php if($records['projects']):?><section class="seo-result-section"><h2>Projects in <?=seo_h($records['name'])?></h2><div class="seo-card-grid"><?php foreach($records['projects'] as $project):?><article class="seo-card"><p class="eyebrow"><?=seo_h($project['category'])?></p><h3><a href="project/<?=seo_h($project['slug'])?>"><?=seo_h($project['title'].($project['plan_name']?' – '.$project['plan_name']:''))?></a></h3><p><?=seo_h(seo_description($project['description'],110))?></p></article><?php endforeach;?></div></section><?php endif;?>
<?php endif;?></main><footer class="site-footer"><span>© <?=date('Y')?> Heera Estate</span></footer><script src="site-nav.js?v=20260907-6"></script><script src="theme.js" defer></script><?=seo_analytics()?></body></html>
