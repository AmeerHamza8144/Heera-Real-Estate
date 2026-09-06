# Heera Estate Structural Architecture v2

## Authoritative data model

```text
projects
   └── sub_projects
          ├── payment_plans
          └── properties
                └── payment_plan_id (optional, must belong to same project/sub-project)
```

`projects.plan_name` and `projects.payment_plans` are legacy compatibility fields. New code must not treat them as the source of truth. The runtime migrator reads old values once, creates normalized rows, and clears legacy payment-plan JSON after a successful migration.

## Roles and permissions

Admin accounts have a `role_id`. Roles are mapped to granular permission keys through `role_permissions`. The same checks are used by both `admin-api.php` and legacy `api.php?action=...` admin actions.

Default roles: Super Admin, Manager, Agent, Accountant, Content Editor. Custom roles can be created from **Admin → More → Roles & Permissions**.

## Relationship safety

Optional broken links are repaired to `NULL`; destructive child records are not silently deleted. Foreign keys then enforce project/sub-project/payment-plan consistency.

## Deployment

For an existing database, import `structural-upgrade-v2.sql` once, then open the Admin dashboard. The Admin API health screen will complete compatibility migrations and report foreign-key status.
