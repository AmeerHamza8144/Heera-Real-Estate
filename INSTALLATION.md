# Installation

1. Extract the complete `heera-chatbot` folder into `C:\xampp\htdocs\`.
2. Start Apache and MySQL in XAMPP.
3. For a new installation, import `database.sql` in phpMyAdmin.
4. For an existing installation, replace the code files after backing up the website and database. The API automatically adds the new `block_name` columns when the related features are first used.
5. Keep `uploads/` and `maps/uploads/` writable. `.htaccess` and `.user.ini` request `upload_max_filesize=110M`, `post_max_size=190M`, `memory_limit=1024M`, and a 600-second timeout. If XAMPP ignores these folder settings, apply the same values in the active `php.ini`, then restart Apache.
6. Automatic map-PDF conversion uses the bundled files in `vendor/pdfjs/` and works in the administrator's browser. Imagick, Poppler and Ghostscript are optional server-side fallbacks, not installation requirements.
7. Open the site, sign in through the compact Login popup, and test Admin on desktop and mobile. Use a current Chrome, Edge or Firefox browser for very large map PDFs.

## Add another digital map

1. Sign in as an administrator and open **Digital Maps > Add Map**.
2. Enter the map/project name.
3. Upload the original PDF. Bundled PDF.js converts page 1 into a high-resolution JPG; the API uploads both files, saves the exact width and height, and uses the JPG as the Plot Finder map. The manual image field is only an optional replacement.
4. Optionally upload a normalized plot-index JSON. Use `maps/plot-index-example.json` as the format reference.
5. Keep **Publish this map in Plot Finder** checked and save.
6. Confirm that **Open saved PDF**, **Open image**, and **View in Plot Finder** appear on the map card in Admin.
7. Open **Digital Maps > Manage Blocks**, select the saved map, and type every block name you want. You can add unlimited blocks; the application does not infer them.
8. Open `plot-finder.html` and choose the new map. The generated high-resolution image provides custom pan/zoom and can display indexed plot markers.
9. For a PDF saved before this update, click **Convert PDF** on its Admin map card.

For an existing database, import `digital-map-migration.sql` once. The API also creates the two map tables safely when first used.

Plot Finder requires these files:

- `maps/al-rehman-garden-phase-2-original.pdf`
- `maps/al-rehman-garden-phase-2-highres.jpg`
- `maps/phase2-plot-index.json`
- `maps/plot-index-example.json`
- `maps/uploads/` (must be writable)
- `plot-finder.html`, `plot-finder.css`, `plot-finder.js`, `image-map.js`
