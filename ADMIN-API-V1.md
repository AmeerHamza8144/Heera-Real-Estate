# Heera Estate Admin API v1

The admin dashboard now uses a dedicated gateway: `admin-api.php`.
Pretty URLs are rewritten through `.htaccess` as `/api/v1/admin/<route>`. If URL rewriting is unavailable, `admin-api.js` automatically falls back to `admin-api.php?route=<route>`.

The original `api.php?action=...` API remains available for the public website and backward compatibility. Shared database/business logic lives in `api-core.php`, so the old and new APIs use the same source of truth.

## Main admin routes

- `bootstrap`, `session`, `csrf`, `logout`, `health`
- `dashboard`
- `properties`, `properties/save`, `properties/delete`
- `projects`, `projects/save`, `projects/delete`
- `payment-plans`
- `leads`, `leads/status`
- `submissions`, `submissions/save`, `submissions/approve`
- `maps`, `maps/save`, `maps/delete`, `maps/blocks/save`, `maps/blocks/delete`
- `gallery`, `gallery/save`, `gallery/delete`
- `popups`, `popups/save`, `popups/delete`
- `agents`, `agents/save`, `agents/delete`
- `offices`, `offices/save`, `offices/delete`
- `users`, `users/save`, `users/delete`
- `upload`

All writes keep the existing CSRF protection. All admin data routes require an authenticated admin session.

## Compatibility

The Admin API gateway also accepts the previous action names such as `admin_properties`, `save_property`, `admin_projects`, `save_project`, `admin_digital_maps`, etc. The browser client maps old action names to the new routes automatically.

## Reliability changes

- Required admin tables are checked/bootstrapped before module reads.
- A health endpoint reports database connectivity and table availability.
- Every app-style workspace refreshes its own data when opened instead of relying only on the initial dashboard load.
- The old sidebar and the app navigation are synchronized so one controller does not hide the workspace opened by the other.

## Agent AI Property Advisor

- `POST /api/v1/admin/advisor/recommend` — ranks current available inventory against agent-entered buyer criteria and returns the best matches plus an agent brief. Requires CSRF and an authenticated admin session.
- `GET /api/v1/admin/advisor/history` — returns the last 10 advisor searches for the signed-in admin.

The matching engine is database-first. If `OPENAI_API_KEY` is configured, the server optionally enhances the local result with an OpenAI Responses API brief; otherwise the endpoint returns a deterministic local brief. Client identity is excluded from the external AI prompt.


## CRM Leads

The app-style Leads tab now uses the CRM routes:

- `GET /api/v1/admin/crm/leads`
- `GET /api/v1/admin/crm/stats`
- `POST /api/v1/admin/crm/leads/create`
- `POST /api/v1/admin/crm/leads/update`

Legacy `admin_enquiries` and `save_enquiry_status` calls are mapped to the CRM layer.

## Structural v2 endpoints

### Sub-Projects

- `GET /api/v1/admin/sub-projects?project_id={id}` — list normalized phases/blocks/plans.
- `POST /api/v1/admin/sub-projects/save` — create/update a sub-project. Requires `subprojects.manage`.
- `POST /api/v1/admin/sub-projects/delete` — delete a sub-project and safely unlink optional property/payment-plan references. Requires `subprojects.manage`.

### Roles & permissions

- `GET /api/v1/admin/role-options` — role choices for user management. Requires `users.manage`.
- `GET /api/v1/admin/roles` — roles plus permission matrix. Requires `roles.manage`.
- `POST /api/v1/admin/roles/save` — create/update a role and its permission keys.
- `POST /api/v1/admin/roles/delete` — delete a custom unused role.

Every admin route is mapped to a permission key. The legacy `api.php?action=...` admin actions use the same permission mapping, so older clients cannot bypass RBAC.

### Health response additions

`GET /api/v1/admin/health` now includes `foreign_keys` and validates the `sub_projects`, `roles`, `permissions`, and `role_permissions` tables.
