-- Advanced property search: optional project relationship.
ALTER TABLE properties ADD COLUMN IF NOT EXISTS project_id INT UNSIGNED NULL AFTER property_id;
-- Run the following only if the index does not already exist:
-- ALTER TABLE properties ADD INDEX idx_property_project (project_id);
