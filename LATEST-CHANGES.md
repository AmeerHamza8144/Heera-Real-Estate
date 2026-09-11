# 2026-09-07 — Production SEO and public-route repair

- Repaired property creation on legacy databases by removing the unconditional
  sub-project migration from ordinary property saves.
- Expanded automatic and phpMyAdmin property-schema repair, including all
  publishing fields, listing enums, media storage, and health diagnostics.
- Replaced generic property database failures with actionable schema,
  permissions, relationship, duplicate-slug, and data-size messages.
- Added explicit property-media checks for PHP upload limits, temporary upload
  failures, file-type support, and `uploads/` write permission.
- Added one canonical metadata generator for titles, descriptions, robots,
  Open Graph, Twitter cards, language alternates, and Google verification.
- Added RealEstateAgent/LocalBusiness, WebSite, WebPage, listing, breadcrumb,
  and location ItemList structured data.
- Added server-rendered homepage links for current properties, projects, and
  locations so discovery no longer depends only on JavaScript.
- Added server-rendered sub-project links and payment-plan summaries to project
  pages, including legacy slug recovery for URLs such as `/sub-project/5-marla-14`.
- Rebuilt the XML sitemap and robots response; uploaded property/gallery images
  are now crawlable while API and admin routes remain excluded.
- Added canonical utility-page metadata and noindex controls for private/internal
  pages, plus compression and conservative asset caching rules.
- Made property ID/slug reads tolerant of older schemas and expanded
  `project-schema-repair.sql` with public-property fields and visibility reports.
- Added `SEO-SETUP.md` with production domain, Search Console, sitemap, analytics,
  content, and publishing instructions.

# 2026-08-29 — Mobile app-style admin shell

- Added one responsive five-tab admin navigation shell: Home, Properties, Leads, Maps, More.
- Mobile uses a fixed bottom navigation bar with iOS safe-area spacing; desktop reflows the same markup into a left sidebar.
- Added live dashboard counts for new leads, pending client submissions, and published projects.
- Added a recent activity feed generated from real enquiries, submissions, projects, and property updates.
- Added a Leads screen with status filters, tap-to-call links, real status updates, notification badges, and chatbot/property source notes.
- Added sticky property filters for project, block, size, price, type, facing, and text search.
- Added a Plot Finder launcher inside the Maps screen and query-prefill support in Plot Finder.
- Added grouped More screen for projects/payment plans, engagement modules, accounts, Theme/UI and planned configuration screens.
- Added an admin command/search sheet for fast module navigation.
- Added dark-mode-aware app design tokens and accessible navigation/button labels.

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

## On Installments property listings
- Added `On Installments` beside For Sale and For Rent.
- Installment properties can optionally connect to one saved structured payment plan from the linked project.
- Payment plans now receive stable `plan_id` values, so property connections survive plan reordering.
- Public listing/detail screens show the installment label and selected plan summary.
- Added `installment-listing-migration.sql` for existing databases.

## 2026-08-29 — Installment listings + API v1
- Added `On Installments` as a first-class property listing type.
- Admin property editor now reveals a dedicated optional payment-plan selector for installment listings.
- Added normalized `payment_plans` table while retaining the existing project JSON field for backwards compatibility.
- Added versioned endpoints: `/api/v1/payment-plans` and `/api/v1/admin/payment-plans`.
- Added live payment-plan preview in the property editor.
- Reduced mobile property cards substantially (2-column, compact media/content/actions).
- Removed the Architectural Digest promotional credit from the home hero.

## 2026-08-29 — Admin API v1 rebuild
- Split shared PHP business/database logic into `api-core.php` so the public API and the new admin API use one source of truth.
- Added `admin-api.php` with versioned admin routes under `/api/v1/admin/*` and compatibility aliases for all previous admin action names.
- Added `admin-api.js` with CSRF handling, no-cache requests, pretty-route support, and automatic fallback when Apache rewrites are unavailable.
- Admin app waits for authenticated API bootstrap before opening workspaces.
- Every admin workspace refreshes its own server data when opened; legacy sidebar and app navigation states are synchronized.
- Added automatic admin schema checks/bootstrapping for core tables and a Settings → API & Database health check.
- Preserved the original `api.php?action=...` interface for the public website and backward compatibility.

## 2026-08-29 — Header menu integration
- Moved **Add Property** into the main public navigation on all public pages.
- Moved **Login** into the same main navigation; the homepage control still opens the existing login modal.
- Signed-in account/profile state now occupies the Login position inside the navigation.
- Removed use of the standalone `header-actions` area and dedicated Add Property button stylesheet from public templates.
- Unified Add Property/Login hover, spacing, typography and mobile menu behavior with other navigation items.
- Added compact desktop navigation spacing between 1051px and 1250px to prevent header crowding.

## Agent AI Property Advisor

- Added an admin-only AI Property Advisor for agents.
- Database-first ranking across live available properties using budget, location, project, block, property type, size, bedrooms, facing, listing type, and installment targets.
- Added optional agent/client reference fields and recent advisor search history.
- Added `/api/v1/admin/advisor/recommend` and `/api/v1/admin/advisor/history`.
- Added `ai_advisor_sessions` table plus `ai-property-advisor-migration.sql`.
- Optional server-side OpenAI Responses API brief with local fallback when no API key is configured.
- Client name is never included in the external AI prompt; email/phone-like text in notes is redacted before an external AI request.
- Added copy/share actions for agent briefs and property recommendations.

## AI Property Comparison

- Added public `property-comparison.html` for side-by-side comparison of two properties.
- Each side can use a live Heera Estate listing or a customer-entered external/manual property.
- Added compare buttons to homepage listing cards, property details, and AI Advisor results.
- Added a two-property comparison basket stored locally in the browser.
- Added deterministic price/space/installment/customer-priority scoring with an optional AI explanation layer.
- Added `POST /api/v1/property-comparison` with fallback to `api.php?action=compare_properties`.
- Manual external properties are clearly marked unverified and are not written into the property inventory database.
# September 2026 database and dashboard v4

- Fixed the XAMPP/MariaDB health checker falsely marking every property column as missing when native prepared statements reject `SHOW COLUMNS ... LIKE ?`.
- Added one shared server-side connection in `database-connection.php`, including configurable database-port support and safe API errors.
- Added 25 repeat-safe v4 read procedures for the dashboard, properties, projects, sub-projects, payment plans, media, CRM, submissions, maps, gallery, updates, agents, offices, users, roles, permissions, reusable Master Data, and module health.
- Connected public property/project/sub-project pages and Admin module lists to the procedures, with prepared-query fallbacks.
- Added six paste-ready v3 project write/link/report procedures with an audit log and collation-safe binary comparisons.
- Added a modern responsive Admin dashboard, live database/routine status, density control, and grouped permission controls.
- Added `DATABASE-REBUILD-V4.md` with safe new/existing database import paths and phpMyAdmin verification calls.
- Added a responsive Master Data CRUD screen for reusable Project, Sub-Project, Block, and Marla/size names; archive/restore preserves existing records.
- Converted relevant project, sub-project, property, payment-plan, and map forms to duplicate-safe Master Data selections.
- Removed duplicate dashboard navigation handlers and eager loading of every module; screens now open immediately and load data lazily with a short cache.
