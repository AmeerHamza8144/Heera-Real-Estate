-- Heera Estate SEO migration (safe for existing data)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS slug VARCHAR(190) NULL AFTER title;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS slug VARCHAR(190) NULL AFTER plan_name;
-- The application backfills unique slugs on first API/public-page request,
-- then creates uq_property_slug and uq_project_slug automatically.
