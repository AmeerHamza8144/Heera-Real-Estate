# Acceptance tests

1. Open `plot-finder.html` and confirm the high-resolution map loads.
2. Search a detected plot number and select each returned candidate.
3. Confirm the selected location centres and pulses.
4. Test wheel zoom, buttons, panning, full screen and the original PDF button.
5. Test pinch zoom and match selection on a mobile browser.
6. Confirm Admin has no manual Register Plot option.
7. In **Digital Maps > Add Map**, save a second high-resolution map and confirm it appears in the public Project selector.
8. In **Digital Maps > Manage Blocks**, add several block names to that map and confirm only those manually added names appear in its public Block selector.
9. Confirm duplicate block names are rejected inside the same map and that the same block name is allowed in a different map.
10. Confirm a published map without an index remains zoomable and reports that no automatic index is available.
11. Add and edit a property with a Block value; verify it is saved and displayed on `property.html`.
12. Submit and approve a client property with a Block value; verify the value is copied to the published property.
13. Open every Login view and confirm the popup is compact without top or bottom overflow.
14. Test every Admin View/Add submenu at desktop and mobile widths.
15. Add at least four properties. Confirm desktop shows three per slider page, mobile shows one, Previous/Next work, and View all homes expands the full grid.
16. Select Land in the homepage Looking for filter and confirm only Land listings remain.
17. Confirm `vendor/pdfjs/pdf.mjs` and `vendor/pdfjs/pdf.worker.mjs` load successfully in the browser without an external CDN.
18. Upload a new single-page map PDF in **Digital Maps > Add Map** without selecting a map image. Confirm the browser conversion finishes, the API accepts both files, and the Admin card displays the generated pixel dimensions.
19. Confirm **Open saved PDF**, **Open image**, and **View in Plot Finder** appear for the converted map.
20. Click **View in Plot Finder** and confirm the correct project is selected from the `map_id` URL, the generated image loads, and pan, wheel zoom, pinch zoom, buttons and full screen work.
21. On an older PDF-only map, click **Convert PDF** and confirm the high-resolution image and Plot Finder link appear after conversion.
