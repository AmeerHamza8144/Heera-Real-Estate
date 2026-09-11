# Database rebuild and stored procedures (v4)

This upgrade preserves existing projects, sub-projects, properties, maps, users, and uploaded-file references. Back up the database first, then use the matching path below.

## Existing XAMPP database (recommended)

In phpMyAdmin, import these files one at a time and wait for each success message:

1. `project-schema-repair.sql`
2. `subproject-visibility-repair-v2.sql` only when repairing the named `2 Year Installment Plan` URL
3. `project-data-stored-procedures.sql`
4. `module-data-stored-procedures.sql`

Do not import `database.sql` over an existing database. It is the clean-install schema.

## New empty database

Import these files in order:

1. `database.sql`
2. `project-schema-repair.sql`
3. `project-data-stored-procedures.sql`
4. `module-data-stored-procedures.sql`

The schema and repair scripts select `havenly_real_estate` automatically. If you use another name, set `HAVENLY_DB_NAME` and change the `USE havenly_real_estate;` lines before importing.

## XAMPP connection

The whole site now uses `database-connection.php`. Defaults are:

- Host: `127.0.0.1`
- Port: `3306`
- Database: `havenly_real_estate`
- User: `root`
- Password: empty

Set the `HAVENLY_DB_*` Apache environment variables when your MySQL setup differs. Never put a production password in browser JavaScript.

## Verify in phpMyAdmin

Run:

```sql
USE havenly_real_estate;
CALL heera_v4_module_health();
CALL heera_v4_dashboard_counts();
CALL heera_v4_projects(1);
CALL heera_v4_subprojects(0,1);
CALL heera_v4_properties(1);
CALL heera_v4_master_options(1);
```

Then sign in as a role with `system.health` and open **Admin → More → API & Database**. A healthy installation reports the connection, normalized relationships, and 25 v4 read procedures as ready.

## Procedure-to-page map

| Module/page | Procedure |
| --- | --- |
| Dashboard | `heera_v4_dashboard_counts`, `heera_v4_module_health` |
| Properties/public inventory/detail | `heera_v4_properties`, `heera_v4_property_detail`, `heera_v4_property_media` |
| Projects/detail/property links | `heera_v4_projects`, `heera_v4_project_detail`, `heera_v4_project_media`, `heera_v4_project_properties` |
| Sub-projects | `heera_v4_subprojects` |
| Payment plans | `heera_v4_payment_plans` |
| CRM leads | `heera_v4_crm_leads` |
| Client submissions | `heera_v4_submissions` |
| Digital maps/blocks | `heera_v4_maps`, `heera_v4_map_blocks` |
| Home gallery | `heera_v4_gallery` |
| Important updates | `heera_v4_updates` |
| Agents/offices | `heera_v4_agents`, `heera_v4_offices` |
| Login users | `heera_v4_admin_users`, `heera_v4_client_users` |
| Roles/permissions | `heera_v4_roles`, `heera_v4_permissions`, `heera_v4_role_permissions` |
| Reusable Master Data | `heera_v4_master_options` |

The PHP connection helper checks whether each routine exists. If a routine was not installed, that module uses its existing prepared SQL query instead of failing. Re-importing either procedure file replaces procedure definitions only; it does not remove application records.

The v3 procedures in `project-data-stored-procedures.sql` are optional paste-ready write/link/report tools. They use binary string comparisons to prevent the `#1267 Illegal mix of collations` error and write an audit row to `heera_data_change_log`.

## Apache URL correction

Use:

`http://localhost:8080/real-estate-website/`

Do not use a Windows path inside the URL such as `http://localhost:8080/C:/xampp/htdocs/...`; Apache correctly rejects that form with `403 Forbidden`.
