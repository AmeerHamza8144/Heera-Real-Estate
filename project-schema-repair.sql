-- Heera Real Estate project/schema repair for phpMyAdmin (MySQL 5.7+, MariaDB 10.3+)
-- Open phpMyAdmin > Import and import this file once. It creates the database
-- when missing and repairs it in place without removing project/property rows.
-- The script is repeat-safe: existing columns and indexes are left in place.

CREATE DATABASE IF NOT EXISTS havenly_real_estate
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE havenly_real_estate;
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS system_migrations (
  migration_key VARCHAR(120) PRIMARY KEY,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  details VARCHAR(500) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS master_options (
  option_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  option_type ENUM('project','subproject','block','marla') NOT NULL,
  name VARCHAR(180) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_master_option_type_name (option_type,name),
  INDEX idx_master_option_list (option_type,is_active,sort_order,name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Keep this repair import usable even when the database is completely empty.
-- CREATE TABLE IF NOT EXISTS never replaces or removes an existing table/data.
CREATE TABLE IF NOT EXISTS properties (
  property_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id INT UNSIGNED DEFAULT NULL,
  sub_project_id INT UNSIGNED DEFAULT NULL,
  payment_plan_id VARCHAR(80) DEFAULT NULL,
  listing_type ENUM('sale','rent','installment') NOT NULL DEFAULT 'sale',
  property_type ENUM('House','Apartment','Villa','Condo','Land') NOT NULL,
  status ENUM('available','pending','sold','rented') NOT NULL DEFAULT 'available',
  title VARCHAR(180) NOT NULL,
  slug VARCHAR(190) DEFAULT NULL,
  address_line1 VARCHAR(255) NOT NULL,
  city VARCHAR(100) NOT NULL,
  state_region VARCHAR(100) DEFAULT NULL,
  block_name VARCHAR(120) DEFAULT NULL,
  postal_code VARCHAR(25) DEFAULT NULL,
  price DECIMAL(12,2) DEFAULT NULL,
  bedrooms DECIMAL(3,1) DEFAULT NULL,
  bathrooms DECIMAL(3,1) DEFAULT NULL,
  area_sqft INT UNSIGNED DEFAULT NULL,
  size_label VARCHAR(60) DEFAULT NULL,
  property_facing VARCHAR(60) DEFAULT NULL,
  price_pkr DECIMAL(15,2) DEFAULT NULL,
  price_per_marla DECIMAL(12,2) DEFAULT NULL,
  description TEXT,
  publish_start_date DATE DEFAULT NULL,
  publish_end_date DATE DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_property_slug (slug),
  INDEX idx_property_project (project_id),
  INDEX idx_property_sub_project (sub_project_id),
  INDEX idx_property_search (status,listing_type,property_type,city,price)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS projects (
  project_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  plan_name VARCHAR(180) DEFAULT NULL,
  slug VARCHAR(190) DEFAULT NULL,
  category VARCHAR(100) NOT NULL,
  location VARCHAR(180) NOT NULL,
  status ENUM('published','draft') NOT NULL DEFAULT 'draft',
  hero_image_url VARCHAR(500) DEFAULT NULL,
  headline VARCHAR(255) DEFAULT NULL,
  description TEXT,
  payment_plans TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_project_slug (slug),
  INDEX idx_project_title_plan (title,plan_name),
  INDEX idx_project_status (status,updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='projects' AND COLUMN_NAME='plan_name')=0,'ALTER TABLE projects ADD COLUMN plan_name VARCHAR(180) NULL AFTER title','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='projects' AND COLUMN_NAME='slug')=0,'ALTER TABLE projects ADD COLUMN slug VARCHAR(190) NULL AFTER plan_name','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='projects' AND COLUMN_NAME='payment_plans')=0,'ALTER TABLE projects ADD COLUMN payment_plans TEXT NULL AFTER description','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;

-- Remove the legacy restriction that prevented two project records with the same title.
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='projects' AND INDEX_NAME='uq_project_title')>0,'ALTER TABLE projects DROP INDEX uq_project_title','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_old_title_index=(SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='projects' AND NON_UNIQUE=0 AND INDEX_NAME<>'PRIMARY' GROUP BY INDEX_NAME HAVING COUNT(*)=1 AND MAX(COLUMN_NAME)='title' LIMIT 1);
SET @heera_sql=IF(@heera_old_title_index IS NULL,'SELECT 1',CONCAT('ALTER TABLE projects DROP INDEX `',REPLACE(@heera_old_title_index,'`','``'),'`'));
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='projects' AND INDEX_NAME='idx_project_title_plan')=0,'ALTER TABLE projects ADD INDEX idx_project_title_plan (title,plan_name)','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;

CREATE TABLE IF NOT EXISTS sub_projects (
  sub_project_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id INT UNSIGNED NOT NULL,
  name VARCHAR(180) NOT NULL,
  slug VARCHAR(190) DEFAULT NULL,
  description TEXT,
  status ENUM('published','draft','archived') NOT NULL DEFAULT 'published',
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sub_project_name (project_id,name),
  UNIQUE KEY uq_sub_project_slug (slug),
  INDEX idx_sub_project_project (project_id,status,sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS project_media (
  media_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id INT UNSIGNED NOT NULL,
  media_type ENUM('gallery','plan') NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  caption VARCHAR(255) DEFAULT NULL,
  sort_order TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_project_media (project_id,media_type,file_path),
  INDEX idx_project_media (project_id,media_type,sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='project_media' AND COLUMN_NAME='caption')=0,'ALTER TABLE project_media ADD COLUMN caption VARCHAR(255) NULL AFTER file_path','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='project_media' AND COLUMN_NAME='sort_order')=0,'ALTER TABLE project_media ADD COLUMN sort_order TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER caption','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='project_media' AND COLUMN_NAME='created_at')=0,'ALTER TABLE project_media ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER sort_order','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;

CREATE TABLE IF NOT EXISTS payment_plans (
  payment_plan_id VARCHAR(80) NOT NULL PRIMARY KEY,
  project_id INT UNSIGNED NOT NULL,
  sub_project_id INT UNSIGNED DEFAULT NULL,
  plan_name VARCHAR(180) NOT NULL DEFAULT 'Payment Plan',
  size_label VARCHAR(80) DEFAULT NULL,
  booking_amount DECIMAL(15,2) DEFAULT NULL,
  monthly_installment_count INT UNSIGNED DEFAULT NULL,
  monthly_installment DECIMAL(15,2) DEFAULT NULL,
  half_yearly_count INT UNSIGNED DEFAULT NULL,
  half_yearly_installment DECIMAL(15,2) DEFAULT NULL,
  balloting VARCHAR(120) DEFAULT NULL,
  on_possession DECIMAL(15,2) DEFAULT NULL,
  other_payment DECIMAL(15,2) DEFAULT NULL,
  total_price DECIMAL(15,2) DEFAULT NULL,
  full_payment_discount_percent DECIMAL(6,2) DEFAULT NULL,
  half_payment_discount_percent DECIMAL(6,2) DEFAULT NULL,
  preferred_location_charge_percent DECIMAL(6,2) DEFAULT NULL,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_payment_plans_project (project_id,is_active,sort_order),
  INDEX idx_payment_plans_sub_project (sub_project_id,is_active,sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_plans' AND COLUMN_NAME='sub_project_id')=0,'ALTER TABLE payment_plans ADD COLUMN sub_project_id INT UNSIGNED NULL AFTER project_id','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_plans' AND COLUMN_NAME='plan_name')=0,'ALTER TABLE payment_plans ADD COLUMN plan_name VARCHAR(180) NOT NULL DEFAULT ''Payment Plan'' AFTER sub_project_id','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_plans' AND COLUMN_NAME='size_label')=0,'ALTER TABLE payment_plans ADD COLUMN size_label VARCHAR(80) NULL AFTER plan_name','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_plans' AND COLUMN_NAME='booking_amount')=0,'ALTER TABLE payment_plans ADD COLUMN booking_amount DECIMAL(15,2) NULL AFTER size_label','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_plans' AND COLUMN_NAME='monthly_installment_count')=0,'ALTER TABLE payment_plans ADD COLUMN monthly_installment_count INT UNSIGNED NULL AFTER booking_amount','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_plans' AND COLUMN_NAME='monthly_installment')=0,'ALTER TABLE payment_plans ADD COLUMN monthly_installment DECIMAL(15,2) NULL AFTER monthly_installment_count','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_plans' AND COLUMN_NAME='half_yearly_count')=0,'ALTER TABLE payment_plans ADD COLUMN half_yearly_count INT UNSIGNED NULL AFTER monthly_installment','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_plans' AND COLUMN_NAME='half_yearly_installment')=0,'ALTER TABLE payment_plans ADD COLUMN half_yearly_installment DECIMAL(15,2) NULL AFTER half_yearly_count','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_plans' AND COLUMN_NAME='balloting')=0,'ALTER TABLE payment_plans ADD COLUMN balloting VARCHAR(120) NULL AFTER half_yearly_installment','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_plans' AND COLUMN_NAME='on_possession')=0,'ALTER TABLE payment_plans ADD COLUMN on_possession DECIMAL(15,2) NULL AFTER balloting','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_plans' AND COLUMN_NAME='other_payment')=0,'ALTER TABLE payment_plans ADD COLUMN other_payment DECIMAL(15,2) NULL AFTER on_possession','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_plans' AND COLUMN_NAME='total_price')=0,'ALTER TABLE payment_plans ADD COLUMN total_price DECIMAL(15,2) NULL AFTER other_payment','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_plans' AND COLUMN_NAME='full_payment_discount_percent')=0,'ALTER TABLE payment_plans ADD COLUMN full_payment_discount_percent DECIMAL(6,2) NULL AFTER total_price','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_plans' AND COLUMN_NAME='half_payment_discount_percent')=0,'ALTER TABLE payment_plans ADD COLUMN half_payment_discount_percent DECIMAL(6,2) NULL AFTER full_payment_discount_percent','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_plans' AND COLUMN_NAME='preferred_location_charge_percent')=0,'ALTER TABLE payment_plans ADD COLUMN preferred_location_charge_percent DECIMAL(6,2) NULL AFTER half_payment_discount_percent','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_plans' AND COLUMN_NAME='sort_order')=0,'ALTER TABLE payment_plans ADD COLUMN sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER preferred_location_charge_percent','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_plans' AND COLUMN_NAME='is_active')=0,'ALTER TABLE payment_plans ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE AFTER sort_order','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_plans' AND COLUMN_NAME='created_at')=0,'ALTER TABLE payment_plans ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER is_active','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_plans' AND COLUMN_NAME='updated_at')=0,'ALTER TABLE payment_plans ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;

SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_plans' AND INDEX_NAME='idx_payment_plans_project')=0,'ALTER TABLE payment_plans ADD INDEX idx_payment_plans_project (project_id,is_active,sort_order)','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_plans' AND INDEX_NAME='idx_payment_plans_sub_project')=0,'ALTER TABLE payment_plans ADD INDEX idx_payment_plans_sub_project (sub_project_id,is_active,sort_order)','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;

-- Public property pages and normalized project/sub-project links.
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='properties' AND COLUMN_NAME='property_id')=0,'ALTER TABLE properties ADD COLUMN property_id INT UNSIGNED NOT NULL AUTO_INCREMENT UNIQUE FIRST','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='properties' AND COLUMN_NAME='listing_type')=0,'ALTER TABLE properties ADD COLUMN listing_type ENUM(''sale'',''rent'',''installment'') NOT NULL DEFAULT ''sale''','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='properties' AND COLUMN_NAME='property_type')=0,'ALTER TABLE properties ADD COLUMN property_type ENUM(''House'',''Apartment'',''Villa'',''Condo'',''Land'') NOT NULL DEFAULT ''Land''','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='properties' AND COLUMN_NAME='status')=0,'ALTER TABLE properties ADD COLUMN status ENUM(''available'',''pending'',''sold'',''rented'') NOT NULL DEFAULT ''available''','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='properties' AND COLUMN_NAME='title')=0,'ALTER TABLE properties ADD COLUMN title VARCHAR(180) NOT NULL DEFAULT ''Untitled property''','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='properties' AND COLUMN_NAME='address_line1')=0,'ALTER TABLE properties ADD COLUMN address_line1 VARCHAR(255) NOT NULL DEFAULT ''''','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='properties' AND COLUMN_NAME='city')=0,'ALTER TABLE properties ADD COLUMN city VARCHAR(100) NOT NULL DEFAULT ''''','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='properties' AND COLUMN_NAME='state_region')=0,'ALTER TABLE properties ADD COLUMN state_region VARCHAR(100) NULL','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='properties' AND COLUMN_NAME='postal_code')=0,'ALTER TABLE properties ADD COLUMN postal_code VARCHAR(25) NULL','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='properties' AND COLUMN_NAME='price')=0,'ALTER TABLE properties ADD COLUMN price DECIMAL(12,2) NULL','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='properties' AND COLUMN_NAME='bedrooms')=0,'ALTER TABLE properties ADD COLUMN bedrooms DECIMAL(3,1) NULL','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='properties' AND COLUMN_NAME='bathrooms')=0,'ALTER TABLE properties ADD COLUMN bathrooms DECIMAL(3,1) NULL','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='properties' AND COLUMN_NAME='area_sqft')=0,'ALTER TABLE properties ADD COLUMN area_sqft INT UNSIGNED NULL','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='properties' AND COLUMN_NAME='description')=0,'ALTER TABLE properties ADD COLUMN description TEXT NULL','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='properties' AND COLUMN_NAME='created_at')=0,'ALTER TABLE properties ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='properties' AND COLUMN_NAME='updated_at')=0,'ALTER TABLE properties ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='properties')>0 AND (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='properties' AND COLUMN_NAME='project_id')=0,'ALTER TABLE properties ADD COLUMN project_id INT UNSIGNED NULL AFTER property_id','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='properties')>0 AND (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='properties' AND COLUMN_NAME='sub_project_id')=0,'ALTER TABLE properties ADD COLUMN sub_project_id INT UNSIGNED NULL AFTER project_id','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='properties')>0 AND (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='properties' AND COLUMN_NAME='payment_plan_id')=0,'ALTER TABLE properties ADD COLUMN payment_plan_id VARCHAR(80) NULL AFTER sub_project_id','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='properties' AND COLUMN_NAME='slug')=0,'ALTER TABLE properties ADD COLUMN slug VARCHAR(190) NULL AFTER title','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='properties' AND COLUMN_NAME='block_name')=0,'ALTER TABLE properties ADD COLUMN block_name VARCHAR(120) NULL AFTER state_region','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='properties' AND COLUMN_NAME='size_label')=0,'ALTER TABLE properties ADD COLUMN size_label VARCHAR(60) NULL AFTER area_sqft','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='properties' AND COLUMN_NAME='property_facing')=0,'ALTER TABLE properties ADD COLUMN property_facing VARCHAR(60) NULL AFTER size_label','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='properties' AND COLUMN_NAME='price_pkr')=0,'ALTER TABLE properties ADD COLUMN price_pkr DECIMAL(15,2) NULL AFTER property_facing','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='properties' AND COLUMN_NAME='price_per_marla')=0,'ALTER TABLE properties ADD COLUMN price_per_marla DECIMAL(12,2) NULL AFTER price_pkr','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='properties' AND COLUMN_NAME='publish_start_date')=0,'ALTER TABLE properties ADD COLUMN publish_start_date DATE NULL AFTER description','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='properties' AND COLUMN_NAME='publish_end_date')=0,'ALTER TABLE properties ADD COLUMN publish_end_date DATE NULL AFTER publish_start_date','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_listing_type=(SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='properties' AND COLUMN_NAME='listing_type' LIMIT 1);
SET @heera_sql=IF(@heera_listing_type IS NOT NULL AND @heera_listing_type NOT LIKE '%installment%','ALTER TABLE properties MODIFY listing_type ENUM(''sale'',''rent'',''installment'') NOT NULL DEFAULT ''sale''','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_property_type=(SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='properties' AND COLUMN_NAME='property_type' LIMIT 1);
SET @heera_sql=IF(@heera_property_type IS NOT NULL AND @heera_property_type NOT LIKE '%Land%','ALTER TABLE properties MODIFY property_type ENUM(''House'',''Apartment'',''Villa'',''Condo'',''Land'') NOT NULL','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='properties')>0 AND (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='properties' AND COLUMN_NAME='sub_project_id')>0 AND (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='properties' AND INDEX_NAME='idx_property_sub_project')=0,'ALTER TABLE properties ADD INDEX idx_property_sub_project (sub_project_id)','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='properties' AND INDEX_NAME='idx_property_project')=0,'ALTER TABLE properties ADD INDEX idx_property_project (project_id)','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;

CREATE TABLE IF NOT EXISTS property_media (
  media_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  property_id INT UNSIGNED NOT NULL,
  media_type ENUM('image','video','link') NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  is_cover BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_media_property (property_id,media_type,is_cover,sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='property_media' AND COLUMN_NAME='is_cover')=0,'ALTER TABLE property_media ADD COLUMN is_cover BOOLEAN NOT NULL DEFAULT FALSE AFTER file_path','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='property_media' AND COLUMN_NAME='sort_order')=0,'ALTER TABLE property_media ADD COLUMN sort_order TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER is_cover','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_media_type=(SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='property_media' AND COLUMN_NAME='media_type' LIMIT 1);
SET @heera_sql=IF(@heera_media_type IS NOT NULL AND @heera_media_type NOT LIKE '%link%','ALTER TABLE property_media MODIFY media_type ENUM(''image'',''video'',''link'') NOT NULL','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;

-- Permit image-only, PDF-only, or combined digital maps.
CREATE TABLE IF NOT EXISTS digital_maps (
  map_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  map_image VARCHAR(500) DEFAULT NULL,
  original_pdf VARCHAR(500) DEFAULT NULL,
  plot_index_file VARCHAR(500) DEFAULT NULL,
  original_width INT UNSIGNED NOT NULL DEFAULT 0,
  original_height INT UNSIGNED NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_digital_map_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='digital_maps' AND COLUMN_NAME='map_image' AND IS_NULLABLE='NO')>0,'ALTER TABLE digital_maps MODIFY COLUMN map_image VARCHAR(500) NULL','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;

-- Upgrade older digital_maps tables. CREATE TABLE IF NOT EXISTS does not add
-- missing columns to an existing table, so every PDF field is repaired here.
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='digital_maps' AND COLUMN_NAME='map_image')=0,'ALTER TABLE digital_maps ADD COLUMN map_image VARCHAR(500) NULL AFTER name','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='digital_maps' AND COLUMN_NAME='original_pdf')=0,'ALTER TABLE digital_maps ADD COLUMN original_pdf VARCHAR(500) NULL AFTER map_image','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='digital_maps' AND COLUMN_NAME='plot_index_file')=0,'ALTER TABLE digital_maps ADD COLUMN plot_index_file VARCHAR(500) NULL AFTER original_pdf','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='digital_maps' AND COLUMN_NAME='original_width')=0,'ALTER TABLE digital_maps ADD COLUMN original_width INT UNSIGNED NOT NULL DEFAULT 0 AFTER plot_index_file','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='digital_maps' AND COLUMN_NAME='original_height')=0,'ALTER TABLE digital_maps ADD COLUMN original_height INT UNSIGNED NOT NULL DEFAULT 0 AFTER original_width','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='digital_maps' AND COLUMN_NAME='is_active')=0,'ALTER TABLE digital_maps ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE AFTER original_height','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='digital_maps' AND COLUMN_NAME='created_at')=0,'ALTER TABLE digital_maps ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER is_active','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='digital_maps' AND COLUMN_NAME='updated_at')=0,'ALTER TABLE digital_maps ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;

CREATE TABLE IF NOT EXISTS digital_map_blocks (
  block_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  map_id INT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_digital_block_map FOREIGN KEY (map_id) REFERENCES digital_maps(map_id) ON DELETE CASCADE,
  UNIQUE KEY uq_digital_map_block (map_id,name),
  INDEX idx_digital_blocks_map (map_id,name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Preserve legacy labels as normalized sub-project suggestions.
INSERT IGNORE INTO sub_projects (project_id,name,slug,status,sort_order)
SELECT project_id,TRIM(plan_name),LEFT(CONCAT('legacy-',project_id,'-',LOWER(REPLACE(TRIM(plan_name),' ','-'))),190),'published',0
FROM projects WHERE plan_name IS NOT NULL AND TRIM(plan_name)<>'';

-- Build reusable dropdown options from existing records without changing them.
INSERT IGNORE INTO master_options(option_type,name)
SELECT 'project',TRIM(title) FROM projects WHERE title IS NOT NULL AND TRIM(title)<>'';
INSERT IGNORE INTO master_options(option_type,name)
SELECT 'subproject',TRIM(name) FROM sub_projects WHERE name IS NOT NULL AND TRIM(name)<>'';
INSERT IGNORE INTO master_options(option_type,name)
SELECT 'block',TRIM(block_name) FROM properties WHERE block_name IS NOT NULL AND TRIM(block_name)<>'';
INSERT IGNORE INTO master_options(option_type,name)
SELECT 'block',TRIM(name) FROM digital_map_blocks WHERE name IS NOT NULL AND TRIM(name)<>'';
INSERT IGNORE INTO master_options(option_type,name)
SELECT 'marla',TRIM(size_label) FROM properties WHERE size_label IS NOT NULL AND TRIM(size_label)<>'';
INSERT IGNORE INTO master_options(option_type,name)
SELECT 'marla',TRIM(size_label) FROM payment_plans WHERE size_label IS NOT NULL AND TRIM(size_label)<>'';

INSERT INTO system_migrations (migration_key,details)
VALUES ('project_schema_repair_20260907','Repairs projects/media/payment plans, text sub-project links, and optional digital-map files')
ON DUPLICATE KEY UPDATE applied_at=CURRENT_TIMESTAMP,details=VALUES(details);

SELECT 'Heera project schema repair completed successfully.' AS result;

-- phpMyAdmin diagnostic: "public" rows should open on the website. Rows marked
-- otherwise need their status or publication dates corrected in the admin UI.
SELECT property_id,title,status,publish_start_date,publish_end_date,
  CASE
    WHEN status<>'available' THEN CONCAT('hidden: status is ',status)
    WHEN publish_start_date IS NOT NULL AND publish_start_date>CURRENT_DATE THEN 'hidden: publication has not started'
    WHEN publish_end_date IS NOT NULL AND publish_end_date<CURRENT_DATE THEN 'hidden: publication has expired'
    ELSE 'public'
  END AS website_visibility
FROM properties
ORDER BY property_id DESC;

SELECT sp.sub_project_id,sp.name,sp.slug,sp.status AS sub_project_status,
  p.project_id,p.title AS project_title,p.status AS project_status,
  CASE
    WHEN sp.status<>'published' THEN CONCAT('hidden: sub-project status is ',sp.status)
    WHEN p.status<>'published' THEN CONCAT('hidden: parent project status is ',p.status)
    ELSE 'public'
  END AS website_visibility
FROM sub_projects sp
JOIN projects p ON p.project_id=sp.project_id
ORDER BY sp.sub_project_id DESC;
