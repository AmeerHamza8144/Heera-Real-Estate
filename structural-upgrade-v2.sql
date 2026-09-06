-- Heera Real Estate Structural Upgrade v2 (MySQL 8+)
-- Adds normalized sub-projects, RBAC tables, and relationship columns.
-- The PHP runtime completes legacy JSON payment-plan migration safely on first Admin API request.

USE havenly_real_estate;

CREATE TABLE IF NOT EXISTS system_migrations (
  migration_key VARCHAR(120) PRIMARY KEY,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  details VARCHAR(500) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sub_projects (
  sub_project_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id INT UNSIGNED NOT NULL,
  name VARCHAR(180) NOT NULL,
  slug VARCHAR(190) DEFAULT NULL,
  description TEXT DEFAULT NULL,
  status ENUM('published','draft','archived') NOT NULL DEFAULT 'published',
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sub_project_name (project_id,name),
  UNIQUE KEY uq_sub_project_slug (slug),
  INDEX idx_sub_project_project (project_id,status,sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS roles (
  role_id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role_key VARCHAR(60) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(500) DEFAULT NULL,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS permissions (
  permission_key VARCHAR(100) PRIMARY KEY,
  label VARCHAR(160) NOT NULL,
  module_name VARCHAR(80) NOT NULL,
  description VARCHAR(500) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id SMALLINT UNSIGNED NOT NULL,
  permission_key VARCHAR(100) NOT NULL,
  PRIMARY KEY(role_id,permission_key),
  INDEX idx_role_permission_key(permission_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DELIMITER $$
CREATE PROCEDURE heera_add_column_if_missing(IN tbl VARCHAR(64), IN col VARCHAR(64), IN ddl TEXT)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=tbl AND COLUMN_NAME=col) THEN
    SET @sql=ddl; PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
  END IF;
END$$
CREATE PROCEDURE heera_add_index_if_missing(IN tbl VARCHAR(64), IN idx VARCHAR(64), IN ddl TEXT)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=tbl AND INDEX_NAME=idx) THEN
    SET @sql=ddl; PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
  END IF;
END$$
CREATE PROCEDURE heera_add_fk_if_missing(IN tbl VARCHAR(64), IN fk VARCHAR(64), IN ddl TEXT)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME=tbl AND CONSTRAINT_NAME=fk AND CONSTRAINT_TYPE='FOREIGN KEY') THEN
    SET @sql=ddl; PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
  END IF;
END$$
DELIMITER ;

CALL heera_add_column_if_missing('properties','sub_project_id','ALTER TABLE properties ADD COLUMN sub_project_id INT UNSIGNED NULL AFTER project_id');
CALL heera_add_column_if_missing('payment_plans','sub_project_id','ALTER TABLE payment_plans ADD COLUMN sub_project_id INT UNSIGNED NULL AFTER project_id');
CALL heera_add_column_if_missing('admin_users','role_id','ALTER TABLE admin_users ADD COLUMN role_id SMALLINT UNSIGNED NULL AFTER phone');
CALL heera_add_index_if_missing('properties','idx_property_sub_project','ALTER TABLE properties ADD INDEX idx_property_sub_project(sub_project_id)');
CALL heera_add_index_if_missing('payment_plans','idx_payment_plans_sub_project','ALTER TABLE payment_plans ADD INDEX idx_payment_plans_sub_project(sub_project_id,is_active,sort_order)');
CALL heera_add_index_if_missing('admin_users','idx_admin_role','ALTER TABLE admin_users ADD INDEX idx_admin_role(role_id)');

-- Migrate the old projects.plan_name label into a normalized sub-project record.
INSERT IGNORE INTO sub_projects(project_id,name,slug,status)
SELECT project_id,TRIM(plan_name),CONCAT('legacy-',project_id,'-',LOWER(REPLACE(TRIM(plan_name),' ','-'))),'published'
FROM projects
WHERE plan_name IS NOT NULL AND TRIM(plan_name)<>'';

INSERT INTO roles(role_key,name,description,is_system) VALUES
('super_admin','Super Admin','Full system access.',TRUE),
('manager','Manager','Manage inventory, projects, CRM, submissions, maps and content.',TRUE),
('agent','Agent','CRM, inventory and advisor access.',TRUE),
('accountant','Accountant','Read inventory and payment-plan records.',TRUE),
('editor','Content Editor','Content and inventory management without security administration.',TRUE)
ON DUPLICATE KEY UPDATE name=VALUES(name),description=VALUES(description),is_system=VALUES(is_system);

INSERT INTO permissions(permission_key,label,module_name) VALUES
('dashboard.view','View dashboard','Dashboard'),
('properties.view','View properties','Properties'),('properties.manage','Manage properties','Properties'),
('projects.view','View projects','Projects'),('projects.manage','Manage projects','Projects'),
('subprojects.view','View sub-projects','Projects'),('subprojects.manage','Manage sub-projects','Projects'),
('payment_plans.view','View payment plans','Payments'),('payment_plans.manage','Manage payment plans','Payments'),
('crm.view','View CRM leads','CRM'),('crm.manage','Manage CRM leads','CRM'),
('submissions.view','View client submissions','Submissions'),('submissions.manage','Manage client submissions','Submissions'),
('maps.view','View maps','Maps'),('maps.manage','Manage maps','Maps'),
('gallery.manage','Manage gallery','Content'),('popups.manage','Manage popups','Content'),
('agents.view','View agents','Agents'),('agents.manage','Manage agents','Agents'),
('offices.manage','Manage offices','Settings'),('users.manage','Manage login users','Security'),
('roles.manage','Manage roles and permissions','Security'),('uploads.manage','Upload media','Media'),
('ai_advisor.use','Use AI property advisor','AI'),('system.health','View API/database health','System')
ON DUPLICATE KEY UPDATE label=VALUES(label),module_name=VALUES(module_name);

-- Seed Super Admin with all permissions only if not already configured.
INSERT IGNORE INTO role_permissions(role_id,permission_key)
SELECT r.role_id,p.permission_key FROM roles r CROSS JOIN permissions p WHERE r.role_key='super_admin';

UPDATE admin_users
SET role_id=(SELECT role_id FROM roles WHERE role_key='super_admin' LIMIT 1)
WHERE role_id IS NULL;

-- Clean only orphaned OPTIONAL relationships before adding constraints.
UPDATE properties pr LEFT JOIN projects p ON p.project_id=pr.project_id SET pr.project_id=NULL WHERE pr.project_id IS NOT NULL AND p.project_id IS NULL;
UPDATE properties pr LEFT JOIN sub_projects sp ON sp.sub_project_id=pr.sub_project_id SET pr.sub_project_id=NULL WHERE pr.sub_project_id IS NOT NULL AND sp.sub_project_id IS NULL;
UPDATE properties pr LEFT JOIN payment_plans pp ON pp.payment_plan_id=pr.payment_plan_id SET pr.payment_plan_id=NULL WHERE pr.payment_plan_id IS NOT NULL AND pp.payment_plan_id IS NULL;
UPDATE payment_plans pp LEFT JOIN sub_projects sp ON sp.sub_project_id=pp.sub_project_id SET pp.sub_project_id=NULL WHERE pp.sub_project_id IS NOT NULL AND (sp.sub_project_id IS NULL OR sp.project_id<>pp.project_id);

CALL heera_add_fk_if_missing('sub_projects','fk_sub_project_project','ALTER TABLE sub_projects ADD CONSTRAINT fk_sub_project_project FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE ON UPDATE CASCADE');
CALL heera_add_fk_if_missing('payment_plans','fk_payment_plan_project','ALTER TABLE payment_plans ADD CONSTRAINT fk_payment_plan_project FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE CASCADE ON UPDATE CASCADE');
CALL heera_add_fk_if_missing('payment_plans','fk_payment_plan_sub_project','ALTER TABLE payment_plans ADD CONSTRAINT fk_payment_plan_sub_project FOREIGN KEY(sub_project_id) REFERENCES sub_projects(sub_project_id) ON DELETE SET NULL ON UPDATE CASCADE');
CALL heera_add_fk_if_missing('properties','fk_property_project','ALTER TABLE properties ADD CONSTRAINT fk_property_project FOREIGN KEY(project_id) REFERENCES projects(project_id) ON DELETE SET NULL ON UPDATE CASCADE');
CALL heera_add_fk_if_missing('properties','fk_property_sub_project','ALTER TABLE properties ADD CONSTRAINT fk_property_sub_project FOREIGN KEY(sub_project_id) REFERENCES sub_projects(sub_project_id) ON DELETE SET NULL ON UPDATE CASCADE');
CALL heera_add_fk_if_missing('properties','fk_property_payment_plan','ALTER TABLE properties ADD CONSTRAINT fk_property_payment_plan FOREIGN KEY(payment_plan_id) REFERENCES payment_plans(payment_plan_id) ON DELETE SET NULL ON UPDATE CASCADE');
CALL heera_add_fk_if_missing('role_permissions','fk_role_permissions_role','ALTER TABLE role_permissions ADD CONSTRAINT fk_role_permissions_role FOREIGN KEY(role_id) REFERENCES roles(role_id) ON DELETE CASCADE ON UPDATE CASCADE');
CALL heera_add_fk_if_missing('role_permissions','fk_role_permissions_permission','ALTER TABLE role_permissions ADD CONSTRAINT fk_role_permissions_permission FOREIGN KEY(permission_key) REFERENCES permissions(permission_key) ON DELETE CASCADE ON UPDATE CASCADE');
CALL heera_add_fk_if_missing('admin_users','fk_admin_role','ALTER TABLE admin_users ADD CONSTRAINT fk_admin_role FOREIGN KEY(role_id) REFERENCES roles(role_id) ON DELETE SET NULL ON UPDATE CASCADE');

INSERT IGNORE INTO system_migrations(migration_key,details) VALUES('structural_v2_relations','Normalized sub-projects, RBAC and core foreign keys');

DROP PROCEDURE heera_add_fk_if_missing;
DROP PROCEDURE heera_add_index_if_missing;
DROP PROCEDURE heera_add_column_if_missing;

-- IMPORTANT: projects.payment_plans remains temporarily for migration only.
-- The PHP structural-v2 migration copies any valid legacy JSON into payment_plans
-- and clears projects.payment_plans on the first API/Admin API request.
