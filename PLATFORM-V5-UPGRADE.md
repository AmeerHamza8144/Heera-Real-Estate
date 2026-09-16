# Heera Estate Platform v5 Upgrade

This release upgrades the non-map parts of Heera Estate. The Digital Maps / Plot Finder implementation is intentionally unchanged.

## What is included

- Client dashboard with server-synced saved properties, reusable saved searches, property submissions, and site visits.
- Site-visit booking from property pages plus Admin confirmation, rescheduling, agent assignment and CRM synchronization.
- CRM activity timeline for calls, WhatsApp, email, meetings, notes, site visits and next follow-up dates.
- Property price/status history and an Admin history viewer.
- Audit log for important admin/client changes.
- Reports & Analytics for inventory, lead pipeline, lead sources, projects, submissions and site visits.
- Secure, single-use password reset tokens with a 30-minute expiry.
- PKR as the primary property price in Admin.
- Added Platform v5 permissions for site visits, reports and audit access.

## Existing database

1. Back up the database.
2. Import the existing repair/procedure scripts required by your current installation if you have not already done so.
3. Import `platform-v5-migration.sql` once in phpMyAdmin.
4. Upload the full project files, keeping `uploads/` writable.
5. Sign in as Super Admin and open **More → API & Database**. `platform_v5` should report `ok` and the new tables should be present.

The application also performs additive Platform v5 schema checks at runtime, so an omitted migration can be repaired automatically when the database user has ALTER/CREATE permissions. Importing the SQL migration is still recommended for production.

## Password-reset email

Set these server environment variables:

- `HEERA_SITE_URL` — your final HTTPS public URL.
- `HEERA_PASSWORD_RESET_FROM` — a valid mailbox on your domain, for example `no-reply@yourdomain.com`.
- `HEERA_PASSWORD_RESET_DEBUG=0` — keep this disabled in production.

The current implementation uses PHP `mail()`. On hosting where PHP mail is disabled, configure the hosting mail transport or replace it with your SMTP provider before enabling self-service recovery.

## Permissions

- Super Admin: site visits, reports and audit log.
- Manager: site visits and reports.
- Agent: site visits.
- Accountant: reports.
- Audit access is deliberately not granted to Manager by the Platform v5 migration.

Existing custom roles can be updated from **Roles & Permissions**.

## Production checks

- Change the initial clean-install administrator password immediately.
- Use HTTPS.
- Keep `.env`, SQL, Markdown and log files blocked from public access (the included `.htaccess` does this on Apache).
- Keep `uploads/` writable but disallow PHP execution in upload directories at the hosting layer.
- Turn off `HEERA_PASSWORD_RESET_DEBUG`.
- Schedule database and uploaded-media backups through the hosting control panel.
- Test: client signup/login, saved property, saved search, site-visit request, admin confirmation, CRM timeline, password reset, audit log and reports.
