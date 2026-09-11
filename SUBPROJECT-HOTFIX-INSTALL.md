# Subproject data hotfix

This update keeps existing records. It does not delete projects, subprojects, properties, plans, or media.

## Install on XAMPP

1. Stop Apache briefly and make a backup copy of `C:\xampp\htdocs\real-estate-website`.
2. Extract the supplied ZIP into `C:\xampp\htdocs\real-estate-website` and allow Windows to replace files with the same names.
3. In phpMyAdmin, select the `havenly_real_estate` database.
4. Import `project-schema-repair.sql` if it has not already completed successfully.
5. Import `subproject-visibility-repair-v2.sql`. This is the collation-safe repair for `/sub-project/2-year-installment-plan-15`.
6. Import `project-data-stored-procedures.sql` once to add the tracking/report/link helpers.
7. Restart Apache, then hard-refresh the browser with `Ctrl+F5`.

Both visibility repair filenames in this package are collation-safe and contain no session-variable string comparisons. `subproject-visibility-repair-v2.sql` is the recommended copy.

## Verify the exact project

Run this in phpMyAdmin:

```sql
CALL heera_v3_project_report(15,'2-year-installment-plan-15');
```

The first result should say `PUBLIC RELATION OK`. Later result sets show linked payment plans, properties, media, and the change log.

To inspect the unavailable property reported as ID 8:

```sql
CALL heera_v3_property_report(8);
```

## Link existing data

Use the subproject ID returned by the report:

```sql
CALL heera_v3_link_property(8,15,YOUR_SUBPROJECT_ID);
CALL heera_v3_link_payment_plan('YOUR_PAYMENT_PLAN_ID',15,YOUR_SUBPROJECT_ID);
```

## API health check

While logged into Admin, open:

`api.php?action=admin_project_diagnostics&id=15&sub_project_slug=2-year-installment-plan-15`

It returns `database: connected`, visibility issues, and linked record counts. The public endpoint is:

`api.php?action=project&sub_project_slug=2-year-installment-plan-15`
