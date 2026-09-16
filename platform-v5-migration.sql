-- Heera Estate Platform v5 non-map upgrade
-- Safe for existing installations. Back up the database first.
USE havenly_real_estate;

CREATE TABLE IF NOT EXISTS saved_properties (
  saved_property_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  visitor_token CHAR(36) DEFAULT NULL,
  client_id INT UNSIGNED DEFAULT NULL,
  property_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_saved_property (visitor_token, property_id),
  INDEX idx_saved_client (client_id, created_at),
  INDEX idx_saved_property (property_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='saved_properties' AND COLUMN_NAME='client_id')=0,
 'ALTER TABLE saved_properties ADD COLUMN client_id INT UNSIGNED NULL AFTER visitor_token','SELECT 1'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
ALTER TABLE saved_properties MODIFY visitor_token CHAR(36) NULL;
SET @sql := IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='saved_properties' AND INDEX_NAME='idx_saved_client')=0,
 'ALTER TABLE saved_properties ADD INDEX idx_saved_client (client_id,created_at)','SELECT 1'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql := IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='saved_properties' AND INDEX_NAME='uq_saved_property_client')=0,
 'ALTER TABLE saved_properties ADD UNIQUE KEY uq_saved_property_client (client_id,property_id)','SELECT 1'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='property_submissions' AND COLUMN_NAME='client_id')=0,
 'ALTER TABLE property_submissions ADD COLUMN client_id INT UNSIGNED NULL AFTER submission_id','SELECT 1'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
SET @sql := IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='property_submissions' AND INDEX_NAME='idx_submission_client')=0,
 'ALTER TABLE property_submissions ADD INDEX idx_submission_client (client_id,created_at)','SELECT 1'); PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

CREATE TABLE IF NOT EXISTS saved_searches (
  saved_search_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  client_id INT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  criteria_json LONGTEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_saved_search_client (client_id, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS site_visits (
  site_visit_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  client_id INT UNSIGNED NOT NULL,
  property_id INT UNSIGNED NOT NULL,
  enquiry_id INT UNSIGNED DEFAULT NULL,
  assigned_agent_id INT UNSIGNED DEFAULT NULL,
  visit_date DATE NOT NULL,
  visit_time TIME NOT NULL,
  status ENUM('requested','confirmed','completed','cancelled','no_show') NOT NULL DEFAULT 'requested',
  client_notes VARCHAR(1500) DEFAULT NULL,
  admin_notes VARCHAR(2000) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_site_visit_client (client_id, visit_date, status),
  INDEX idx_site_visit_property (property_id, visit_date),
  INDEX idx_site_visit_agent (assigned_agent_id, visit_date),
  INDEX idx_site_visit_status (status, visit_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS crm_activities (
  activity_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  enquiry_id INT UNSIGNED NOT NULL,
  admin_id INT UNSIGNED DEFAULT NULL,
  activity_type VARCHAR(30) NOT NULL DEFAULT 'note',
  subject VARCHAR(180) DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  occurred_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_crm_activity_lead (enquiry_id, occurred_at),
  INDEX idx_crm_activity_admin (admin_id, occurred_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS property_price_history (
  price_history_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  property_id INT UNSIGNED NOT NULL,
  old_price_pkr DECIMAL(15,2) DEFAULT NULL,
  new_price_pkr DECIMAL(15,2) DEFAULT NULL,
  old_status VARCHAR(30) DEFAULT NULL,
  new_status VARCHAR(30) DEFAULT NULL,
  changed_by_admin_id INT UNSIGNED DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_price_history_property (property_id, created_at),
  INDEX idx_price_history_admin (changed_by_admin_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  audit_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_type ENUM('admin','client','system') NOT NULL DEFAULT 'system',
  actor_id INT UNSIGNED DEFAULT NULL,
  action_key VARCHAR(100) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(100) DEFAULT NULL,
  summary VARCHAR(500) NOT NULL,
  metadata_json LONGTEXT DEFAULT NULL,
  ip_address VARCHAR(45) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_created (created_at),
  INDEX idx_audit_entity (entity_type, entity_id, created_at),
  INDEX idx_audit_actor (actor_type, actor_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  reset_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  account_type ENUM('admin','client') NOT NULL,
  account_id INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  used_at DATETIME DEFAULT NULL,
  requested_ip VARCHAR(45) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_password_reset_account (account_type, account_id, created_at),
  INDEX idx_password_reset_expiry (expires_at, used_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO permissions (permission_key,label,module_name,description) VALUES
('site_visits.view','View site visits','CRM','View customer property viewing requests.'),
('site_visits.manage','Manage site visits','CRM','Confirm, assign, complete, or cancel site visits.'),
('reports.view','View reports & analytics','Reports','View business pipeline, inventory, and performance summaries.'),
('audit.view','View audit log','Security','Review administrative and client data-change activity.');

INSERT IGNORE INTO role_permissions (role_id,permission_key)
SELECT r.role_id,p.permission_key FROM roles r JOIN permissions p ON p.permission_key IN ('site_visits.view','site_visits.manage','reports.view','audit.view') WHERE r.role_key='super_admin';
INSERT IGNORE INTO role_permissions (role_id,permission_key)
SELECT r.role_id,p.permission_key FROM roles r JOIN permissions p ON p.permission_key IN ('site_visits.view','site_visits.manage','reports.view') WHERE r.role_key='manager';
INSERT IGNORE INTO role_permissions (role_id,permission_key)
SELECT r.role_id,p.permission_key FROM roles r JOIN permissions p ON p.permission_key IN ('site_visits.view','site_visits.manage') WHERE r.role_key='agent';
INSERT IGNORE INTO role_permissions (role_id,permission_key)
SELECT r.role_id,p.permission_key FROM roles r JOIN permissions p ON p.permission_key='reports.view' WHERE r.role_key='accountant';

-- Foreign keys are installed by platform-v5.php when permitted by the hosting account.
-- This keeps the migration compatible with shared-hosting accounts that restrict ALTER CONSTRAINT.
