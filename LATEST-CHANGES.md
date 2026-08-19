# Latest update

## Installment calculator and navigation

- Added a responsive standalone **Installment Calculator** that can load any published project payment plan or accept manual figures.
- Calculates total monthly installments, one-installment amounts, half-yearly totals, down payment, balloting, possession, other payments, discounts, preferred-location charges and remaining balance.
- Added monthly installment count and optional discount/location-charge fields to the Admin project payment-plan editor; the existing JSON storage requires no SQL migration.
- Project detail pages now display the calculator below their saved payment-plan tables.
- Added **Features** navigation with Plot Finder and Installment Calculator submenus.
- Moved Agents into the **Contact** submenu alongside Contact Us on desktop and mobile navigation.

## Existing content visibility fix

- Property and project API reads no longer stop when an automatic SEO/search schema upgrade or index cannot be created.
- Added fallback property queries and compatibility reads for older existing databases.
- Duplicate legacy slugs are repaired before unique indexes are created.

## Security hardening

- Added CSRF tokens to authenticated dashboard, logout, upload, map and client-property write actions.
- Added session-cookie hardening, browser security headers and a five-attempt/ten-minute login throttle.
- Database exceptions are logged server-side without exposing SQL details to visitors.
- Direct access to environment, SQL, log, INI and Markdown files is blocked by Apache.
- Script execution and directory browsing are blocked inside public upload folders.

## Advanced property search

- Added Project, Block, Size, minimum/maximum Price, Property Type, Facing, Availability and Payment Plan filters.
- Added an optional Linked Project field to Admin properties.
- Search choices are populated from real property/project data and remain responsive on desktop and mobile.

## SEO system

- Dynamic titles, descriptions, canonical URLs, Open Graph and Twitter previews.
- Stable property/project slugs and friendly canonical routes.
- Server-rendered property, project, and location pages with breadcrumbs and JSON-LD.
- Database-driven `sitemap.xml`, dynamic `robots.txt`, and internal location links.
- Environment-based Search Console verification and GA4 integration.
- Automatic WebP conversion and 2400px resizing for future uploads when PHP GD is available.

## Included functionality

- Modern dashboard menu groups with View/Add submenus for each content manager.
- Separated Properties, Projects, Agents, Addresses and Login Users so View shows only records and Add shows only the form.
- Added unlimited exclusive popup types: each popup is Content only, Image only or Video only.
- Multi-map Digital Maps manager with image, PDF and normalized JSON-index uploads.
- Unlimited block names per map, entered only through Admin; no block-name detection or seeding.
- Public Plot Finder project selector and per-map block selector.
- Responsive property paging: three cards on desktop, two on tablet and one on mobile.
- Previous and Next property controls plus View all homes / Show property slider.
- Land option in the homepage Looking for filter.
- Fixed Client Sign In and Sign Up form reset error after an asynchronous login request.
- Added a session-aware Profile button to every public header; Login is hidden while authenticated and the profile dropdown includes Logout.
- Existing properties, projects, chatbot, client submissions, logins, gallery, agents, addresses and payment plans are preserved.

## Main files changed or added

- `admin.html`, `admin.js`, `admin-submenus.css`
- `api.php`, `database.sql`, `digital-map-migration.sql`
- `plot-finder.html`, `plot-finder.js`, `image-map.js`
- `index.html`, `script.js`, `site-nav.js`, `navigation-fixes.css`, `property-slider.css`
- `.user.ini`, `README.md`, `INSTALLATION.md`, `PLOT-FINDER-TESTS.md`
- `popup-type-migration.sql`
- `maps/plot-index-example.json`
