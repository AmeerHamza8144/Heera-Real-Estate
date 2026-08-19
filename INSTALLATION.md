# Installation

## SEO and Google setup

Set `HEERA_SITE_URL` to the final HTTPS domain. Add the Google Search Console HTML-tag token as `HEERA_GOOGLE_SITE_VERIFICATION`, and add the GA4 measurement ID as `HEERA_GA_MEASUREMENT_ID`. See `.env.example` for every supported value. Submit `/sitemap.xml` in Search Console after deployment. Apache `mod_rewrite` must be enabled for friendly `/property/slug`, `/project/slug`, and `/location/slug` URLs.

Existing databases can import `seo-migration.sql`; the application then backfills unique slugs automatically. New installations already include the slug fields in `database.sql`.

For Advanced Property Search on an existing database, import `advanced-search-migration.sql` once. Then edit each property in Admin and choose its optional **Linked project / payment plan**. Project, payment-plan, block, size, price, property-type, facing and availability filters populate from published property data.

1. Extract the complete `heera-chatbot` folder into `C:\xampp\htdocs\`.
2. Start Apache and MySQL in XAMPP.
3. For a new installation, import `database.sql` in phpMyAdmin.
4. For an existing installation, replace the code files after backing up the website and database. The API automatically adds the new `block_name` columns when the related features are first used.
5. Keep `uploads/` and `maps/uploads/` writable. For client videos and map uploads, set `upload_max_filesize=110M`, `post_max_size=190M`, and `max_execution_time=300` in PHP and restart Apache.
6. Open the site, sign in through the compact Login popup, and test Admin on desktop and mobile.

## Add another digital map

1. Sign in as an administrator and open **Digital Maps > Add Map**.
2. Enter the map/project name and upload its high-resolution JPG, PNG or WebP image.
3. Optionally upload the original PDF and a normalized plot-index JSON. Use `maps/plot-index-example.json` as the format reference.
4. Keep **Publish this map in Plot Finder** checked and save.
5. Open **Digital Maps > Manage Blocks**, select the saved map, and type every block name you want. You can add unlimited blocks; the application does not infer them.
6. Open `plot-finder.html`, choose the new map and test it. A map without a plot-index JSON can be viewed and zoomed, but automatic plot-number search has no locations until an index is uploaded.

For an existing database, import `digital-map-migration.sql` once. The API also creates the two map tables safely when first used.

Plot Finder requires these files:

- `maps/al-rehman-garden-phase-2-original.pdf`
- `maps/al-rehman-garden-phase-2-highres.jpg`
- `maps/phase2-plot-index.json`
- `maps/plot-index-example.json`
- `plot-finder.html`, `plot-finder.css`, `plot-finder.js`, `image-map.js`
