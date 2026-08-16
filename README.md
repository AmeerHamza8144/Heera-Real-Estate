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

## Multilingual property assistant

The public pages include a free built-in chatbot (`chatbot.js` and `chatbot.css`). It supports English, Urdu, and Roman Urdu, searches the live property catalogue, displays published dealer/agent information, and saves callback requests in the existing `enquiries` table through `api.php?action=chat_lead`. No external AI service or API key is required.
