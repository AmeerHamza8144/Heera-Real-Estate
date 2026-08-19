# Havenly Real Estate Website

This is a responsive real-estate website with an agent login and a PHP/MySQL admin panel. Agents can add, edit, delete, and publish sale or rental listings, set prices, and add image, video, or external-tour links. Uploaded files are stored in `uploads/`.

## Start it with XAMPP

1. Start **Apache** and **MySQL** in the XAMPP Control Panel.
2. Copy the `real-estate-website` folder into `C:\xampp\htdocs\`.
3. Open [phpMyAdmin](http://localhost/phpmyadmin), select **Import**, and import `database.sql`.
4. Visit `http://localhost/real-estate-website/` in your browser.

The public website is `index.html`; the **Agent login** button opens `admin.html`.

## Initial admin login

| Field | Value |
| --- | --- |
| Email | `admin@havenly.local` |
| Password | `Havenly2026!` |

Change this password before deploying the website. The API uses PHP sessions and password hashes; the database password is not exposed to the browser.

## MySQL configuration

The API defaults to the normal local XAMPP MySQL setup (`root` with no password and database `havenly_real_estate`). If your MySQL credentials differ, set these server environment variables before Apache starts:

`HAVENLY_DB_HOST`, `HAVENLY_DB_NAME`, `HAVENLY_DB_USER`, and `HAVENLY_DB_PASSWORD`.

## Important deployment notes

 - New fields added to properties: `size_label`, `property_facing`, `price_pkr`, `price_per_marla`.
- Make the `uploads/` directory writable by the web-server account for photo/video uploads.

## Automatic Digital Plot Finder and multi-map manager

The main navigation includes **PLOT FINDER**. The supplied Phase 2 map uses the unchanged PDF plus a 12009 × 9009 interactive image. Visitors can choose any published map and search a numeric plot number without registering plots individually. The viewer centres, marks and pulses each indexed result. Mouse-wheel zoom, buttons, drag/pan, mobile pinch zoom, full screen and an original-PDF button are included.

Admin Dashboard includes grouped submenus for every manager. Under **Digital Maps**, use **Add Map** to upload another high-resolution image, optional source PDF and optional normalized plot-index JSON. Use **Manage Blocks** to add any number of block names to the selected map. Blocks are never inferred from the map image or PDF.

A map can be created from a PDF or a manually supplied image. When an administrator uploads a PDF, the bundled Mozilla PDF.js files in `vendor/pdfjs/` rasterize page 1 to a high-resolution JPG in the browser. `api.php?action=save_digital_map` receives the original PDF and generated JPG together, validates them, and saves the image path and exact dimensions in `digital_maps`, so the map immediately uses the interactive Plot Finder canvas. No Imagick, Poppler or Ghostscript installation is required; those remain optional server-side fallbacks. Existing PDF-only records have a **Convert PDF** action that uses the same browser converter. Automatic plot-number search becomes available after an index JSON is uploaded. `maps/plot-index-example.json` documents the required record format.

API endpoints:

- `api.php?action=auto_plot_meta`
- `api.php?action=auto_plot_meta&map_id=1`
- `api.php?action=auto_plot_search&map_id=1&plot_number=125`
- `api.php?action=auto_plot_search&map_id=1&plot_number=125&block=B%20Block`

OCR results are location candidates, not legal survey data. Repeated plot numbers are deliberately shown as separate selectable matches.

## Property Block field

Properties and client submissions have an optional free-text **Block** field (`block_name`). It is editable in Admin and the Client Form, displayed on property details, copied when a client submission is approved, and used when matching a property to a Plot Finder result. Existing databases receive the column automatically.

## Compact login and modern Admin

`auth-compact.css` removes unnecessary vertical space from the unified login popup while keeping sign-in, sign-up, password recovery and Admin Login responsive. `admin-modern.css` provides a sticky desktop sidebar, overview cards, modern form panels and a touch-friendly mobile tab bar without replacing the existing session or CRUD functionality.

After a client or administrator signs in, the shared public header hides Login and displays a Profile button. Its dropdown identifies the current account, opens the Client Form, provides an Admin Dashboard link for administrators, and securely logs out through the PHP session API.

`admin-submenus.css` adds View/Add submenus for Properties, Projects, Digital Maps, Gallery, Popups, Agents, Office Addresses, Login Users and Client Submissions. The layout remains usable as a touch-friendly menu on mobile.

Properties, Projects, Agents, Office Addresses and Login Users use separated dashboard views. Their **View** submenu displays only the saved records, while **Add** displays only the corresponding editor form. Selecting Edit from a record opens that editor, and Cancel returns to the list.

The popup manager supports any number of popup records. Every popup must use exactly one selected type: **Content only**, **Image only**, or **Video only**. The Admin form displays only the selected type's fields, and the API clears incompatible media fields before saving. Published popups rotate on the homepage; video popups use player controls and pause automatic carousel advancement while selected.

## Homepage property slider and Land search

The homepage **Looking for** filter includes **Land**. Property cards show three at a time on desktop when more than three results exist, two at a time on tablets and one at a time on phones. Previous/Next controls change pages. **View all homes** expands every property into the responsive grid; **Show property slider** collapses it again.

## Multilingual property assistant

The public pages include a free built-in chatbot (`chatbot.js` and `chatbot.css`). It supports English, Urdu, and Roman Urdu, asks for the wanted property type and size, searches only live available properties, displays full result details with property-page links, and displays published dealer/agent information. Callback requests and the visitor's recent search are saved in the existing `enquiries` table through `api.php?action=chat_lead`. Admins can review them under **Chat Messages**, call or WhatsApp the visitor, and mark each request New, Contacted or Closed. No external AI service or API key is required.

## Client property submissions

The red **Client Form** button opens `client-form.html`, where sellers can submit contact details, property information, and up to five images. Submissions remain private in the **Client submissions** admin tab. An administrator can edit or reject a submission, or approve it to create an available property that appears on the main website. Existing installations do not require a manual migration because the API creates the submissions table when first used; `database.sql` also includes it for new installations.

## Liquid glass theme

`liquid-glass.css` provides the shared translucent header, top navigation, dropdown, chatbot, action-button, and footer styling. `theme.js` adds a light/dark mode control to every public footer (and the admin header), follows the visitor's system preference on first visit, and remembers their selection in local storage. Public detail and client-submission pages use the same responsive navigation as the home and project pages.

The public social links are rendered in the compact footer instead of a separate top strip. `footer-compact.css` keeps the brand, social links, copyright, and theme control in the smallest practical responsive layout.

The home gallery uses `gallery-compact.css` to reduce its section spacing and image-slider height to approximately half of the original layout while preserving responsive cropping.

The home-page hero directly below the navigation uses `images/al-rehman-garden-hero.png`. `hero-background.css` uses `background-size: contain` so the complete image remains visible without cropping, with a dark background filling any unused space.

Structured project payment plans support an optional `other_payment` amount. It is editable in the project admin form, stored in the existing payment-plan JSON, and displayed as the **Other Payment** column on the public project page.

Each payment-plan row also stores a `plan_name`. Rows with the same plan name are shown together, while different plan names are rendered as separate tables on the same project page. Existing rows without a plan name remain supported under the default **Payment Plans** heading.

Projects can optionally have a **Plan (Sub Project)** name. Admins may create multiple records with the same project name and different plan names. The public Projects menu groups those records under the shared project name and displays each plan as a submenu link. Existing databases are upgraded automatically by `api.php`; new installations receive the field from `database.sql`.

On screens up to 720px wide, structured payment-plan tables automatically become labeled cards for easier reading without horizontal scrolling. Payment-plan headings and values use DM Sans for clear mobile typography.

The property **Facing / Type** field is a free-text input in both Admin and the Client Form, allowing custom values such as Corner, Park Facing, Main Boulevard, or any other description.

The chatbot includes a persistent WhatsApp button that opens a pre-filled conversation with Heera Estate. Its label and message automatically follow the selected English, Urdu, or Roman Urdu chatbot language.

Office addresses are managed from the dedicated **Office addresses** Admin tab and displayed in their own homepage section immediately below Agents. Each entry supports an office name, full address, phone number, optional Google Maps link, and published/hidden status. The API creates the required table automatically for existing installations.

The homepage Contact Us section uses reduced vertical padding, smaller gaps, and a shorter message box for a more compact layout.

The homepage login modal combines Client Sign In, Client Sign Up, Forgot Password, and Admin Login. Client accounts are stored in `client_users`; administrators manage both client and admin accounts from the **Login users** Admin tab. Passwords are never returned or displayed: they are stored using PHP password hashes and can only be replaced with a new password. The original `admin@havenly.local` account and password remain valid, and the same account can also sign in with username `admin` after the automatic schema upgrade.

The Client Form requires an authenticated client or admin session. Unauthenticated visitors are redirected to the unified login form and returned to `client-form.html` after signing in. Client submissions accept up to five images and one MP4/WebM video smaller than 100 MB. `.user.ini` raises PHP's upload/post limits; if XAMPP ignores per-folder settings, set `upload_max_filesize=110M`, `post_max_size=190M`, and `max_execution_time=300` in the active `php.ini`, then restart Apache.

Client submissions require publication start and end dates. After approval, those dates are copied to the published property. Public listing and property queries automatically hide the property before its start date and after its end date, while the Admin portal retains it for editing and records.
