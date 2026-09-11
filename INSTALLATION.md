# Installation

## SEO and Google setup

Set `HEERA_SITE_URL` to the final HTTPS domain. Add the Google Search Console HTML-tag token as `HEERA_GOOGLE_SITE_VERIFICATION`, and add the GA4 measurement ID as `HEERA_GA_MEASUREMENT_ID`. See `.env.example` for every supported value. Submit `/sitemap.xml` in Search Console after deployment. Apache `mod_rewrite` must be enabled for friendly `/property/slug`, `/project/slug`, and `/location/slug` URLs.

Existing databases can import `seo-migration.sql`; the application then backfills unique slugs automatically. New installations already include the slug fields in `database.sql`.

For Advanced Property Search on an existing database, import `advanced-search-migration.sql` once. Then edit each property in Admin and choose its optional **Linked project / payment plan**. Project, payment-plan, block, size, price, property-type, facing and availability filters populate from published property data.

1. Extract the complete `heera-chatbot` folder into `C:\xampp\htdocs\`.
2. Start Apache and MySQL in XAMPP.
3. For a new installation, import `database.sql`, `project-schema-repair.sql`, `project-data-stored-procedures.sql`, and `module-data-stored-procedures.sql` in that order.
4. For an existing installation, back up the database and import `project-schema-repair.sql`, `project-data-stored-procedures.sql`, and `module-data-stored-procedures.sql` in that order. The repair is additive and does not remove project/property records.
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


## Optional Agent AI Property Advisor

The advisor always ranks properties locally from your MySQL inventory. To add AI-generated agent briefs, configure `OPENAI_API_KEY` on the server and optionally set `HEERA_AI_ADVISOR_MODEL` (the project defaults to `gpt-5.6-luna`). Do not expose the API key in JavaScript or HTML. If you are upgrading an existing database, import `ai-property-advisor-migration.sql`; the Admin API also creates the history table automatically when permitted.

## Existing database upgrade (Structural v2)

After backing up your database, import `structural-upgrade-v2.sql` in phpMyAdmin. Then log in as Super Admin and open **More → API & Database** to confirm all tables and foreign keys are healthy. Existing `projects.plan_name` values are migrated into `sub_projects`; legacy `projects.payment_plans` JSON is copied into the normalized `payment_plans` table by the runtime compatibility migrator.

If an upgraded installation cannot save or display properties, import `project-schema-repair.sql` into the same database configured in `.env`, refresh the Admin page, and run **More → API & Database** again. The health check now reports every missing property column. Property media uploads also require PHP's `fileinfo` extension and a writable `uploads/` directory.

The shared connection lives in `database-connection.php`. It uses the `HAVENLY_DB_HOST`, `HAVENLY_DB_PORT`, `HAVENLY_DB_NAME`, `HAVENLY_DB_USER`, and `HAVENLY_DB_PASSWORD` server variables, with standard XAMPP defaults. Every major Admin/public list module calls its `heera_v4_*` read procedure when installed and safely falls back to its prepared query if the procedure is unavailable. See `DATABASE-REBUILD-V4.md` for exact phpMyAdmin import and verification steps.
