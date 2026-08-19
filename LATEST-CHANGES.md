# Latest update

## Included functionality

- Modern dashboard menu groups with View/Add submenus for each content manager.
- Separated Properties, Projects, Agents, Addresses and Login Users so View shows only records and Add shows only the form.
- Added unlimited exclusive popup types: each popup is Content only, Image only or Video only.
- Fixed Digital Map PDF uploads, added visible saved-PDF links, and added a public PDF-only map viewer.
- Upgraded the multilingual chatbot with guided property type/size questions, live availability results and property-detail links.
- Added an Admin Chat Messages manager with visitor details, saved search context, Call/WhatsApp actions and message statuses.
- Fixed stale popup IDs after deleting or starting a new popup; uploaded video-only popups now save correctly and link URLs are optional.
- Removed the large empty area from image/video popups and hid carousel controls when only one popup is published.
- Added automatic 300-DPI PDF-to-JPG conversion through the PHP API. Generated dimensions are stored and the map appears immediately in Plot Finder.
- Bundled Mozilla PDF.js as the default converter so XAMPP does not need Imagick, Poppler or Ghostscript.
- Added **Convert PDF / Rebuild image** and **View in Plot Finder** actions to Admin Digital Maps.
- Added Apache/XAMPP and per-directory PHP upload-limit configuration for map PDFs up to 100 MB.
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

- `admin.html`, `admin.js`, `admin-submenus.css`, `admin-modern.css`
- `api.php`, `database.sql`, `digital-map-migration.sql`
- `chatbot.js`, `chatbot.css`
- `vendor/pdfjs/` (bundled converter, worker, fonts, CMaps, WASM decoders and license)
- `plot-finder.html`, `plot-finder.js`, `image-map.js`
- `plot-pdf.css`, `maps/uploads/.gitkeep`
- `index.html`, `script.js`, `site-nav.js`, `navigation-fixes.css`, `property-slider.css`
- `.htaccess`, `.user.ini`, `README.md`, `INSTALLATION.md`, `PLOT-FINDER-TESTS.md`
- `popup-type-migration.sql`
- `maps/plot-index-example.json`
