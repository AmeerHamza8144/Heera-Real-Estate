-- Heera Real Estate database schema (MySQL 8+)
-- Import this file in phpMyAdmin before opening admin.html through XAMPP.
CREATE DATABASE IF NOT EXISTS havenly_real_estate
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE havenly_real_estate;

CREATE TABLE admin_users (
  admin_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  username VARCHAR(100) UNIQUE,
  phone VARCHAR(30),
  role_id SMALLINT UNSIGNED DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE client_users (
  client_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(160) NOT NULL,
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(30) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_client_active (is_active, full_name)
);

CREATE TABLE properties (
  property_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id INT UNSIGNED DEFAULT NULL,
  sub_project_id INT UNSIGNED DEFAULT NULL,
  payment_plan_id VARCHAR(80) DEFAULT NULL,
  listing_type ENUM('sale', 'rent', 'installment') NOT NULL DEFAULT 'sale',
  property_type ENUM('House', 'Apartment', 'Villa', 'Condo', 'Land') NOT NULL,
  status ENUM('available', 'pending', 'sold', 'rented') NOT NULL DEFAULT 'available',
  title VARCHAR(180) NOT NULL,
  slug VARCHAR(190) DEFAULT NULL,
  address_line1 VARCHAR(255) NOT NULL,
  city VARCHAR(100) NOT NULL,
  state_region VARCHAR(100),
  block_name VARCHAR(120),
  postal_code VARCHAR(25),
  price DECIMAL(12,2) DEFAULT NULL,
  bedrooms DECIMAL(3,1),
  bathrooms DECIMAL(3,1),
  area_sqft INT UNSIGNED,
  size_label VARCHAR(60),
  property_facing VARCHAR(60),
  price_pkr DECIMAL(15,2),
  price_per_marla DECIMAL(12,2),
  description TEXT,
  publish_start_date DATE,
  publish_end_date DATE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_property_slug (slug),
  INDEX idx_property_project (project_id),
  INDEX idx_property_sub_project (sub_project_id),
  INDEX idx_property_search (status, listing_type, property_type, city, price)
);

CREATE TABLE property_media (
  media_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  property_id INT UNSIGNED NOT NULL,
  media_type ENUM('image', 'video', 'link') NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  is_cover BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_media_property FOREIGN KEY (property_id) REFERENCES properties(property_id) ON DELETE CASCADE,
  INDEX idx_media_property (property_id, media_type, is_cover, sort_order)
);

CREATE TABLE property_submissions (
  submission_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  client_id INT UNSIGNED DEFAULT NULL,
  seller_name VARCHAR(160) NOT NULL,
  seller_phone VARCHAR(30) NOT NULL,
  seller_email VARCHAR(255),
  seller_cnic VARCHAR(30),
  listing_type ENUM('sale','rent','installment') NOT NULL DEFAULT 'sale',
  property_type ENUM('House','Apartment','Villa','Condo','Land') NOT NULL,
  title VARCHAR(180) NOT NULL,
  address_line1 VARCHAR(255) NOT NULL,
  city VARCHAR(100) NOT NULL,
  state_region VARCHAR(100),
  block_name VARCHAR(120),
  size_label VARCHAR(60),
  property_facing VARCHAR(60),
  price_pkr DECIMAL(15,2),
  bedrooms DECIMAL(3,1),
  bathrooms DECIMAL(3,1),
  area_sqft INT UNSIGNED,
  description TEXT,
  media_json TEXT,
  video_path VARCHAR(500),
  publish_start_date DATE NOT NULL,
  publish_end_date DATE NOT NULL,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  approved_property_id INT UNSIGNED,
  admin_notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_submission_status (status, created_at),
  INDEX idx_submission_client (client_id, created_at),
  CONSTRAINT fk_submission_property FOREIGN KEY (approved_property_id) REFERENCES properties(property_id) ON DELETE SET NULL
);

CREATE TABLE digital_maps (
  map_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  map_image VARCHAR(500) DEFAULT NULL,
  original_pdf VARCHAR(500),
  plot_index_file VARCHAR(500),
  original_width INT UNSIGNED NOT NULL DEFAULT 0,
  original_height INT UNSIGNED NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_digital_map_name (name)
);

CREATE TABLE digital_map_blocks (
  block_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  map_id INT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_digital_block_map FOREIGN KEY (map_id) REFERENCES digital_maps(map_id) ON DELETE CASCADE,
  UNIQUE KEY uq_digital_map_block (map_id, name),
  INDEX idx_digital_blocks_map (map_id, name)
);

INSERT INTO digital_maps (name,map_image,original_pdf,plot_index_file,original_width,original_height) VALUES
('Al-Rehman Garden Phase 2','maps/al-rehman-garden-phase-2-highres.jpg','maps/al-rehman-garden-phase-2-original.pdf','maps/phase2-plot-index.json',12009,9009);

CREATE TABLE enquiries (
  enquiry_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  property_id INT UNSIGNED NULL,
  assigned_agent_id INT UNSIGNED NULL,
  name VARCHAR(160) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(30),
  interest ENUM('buying', 'selling', 'renting', 'agent') NOT NULL DEFAULT 'buying',
  message TEXT,
  status ENUM('new', 'contacted', 'closed') NOT NULL DEFAULT 'new',
  source VARCHAR(60) NOT NULL DEFAULT 'website',
  lead_stage VARCHAR(30) NOT NULL DEFAULT 'new',
  priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  lead_score TINYINT UNSIGNED NOT NULL DEFAULT 0,
  budget_min DECIMAL(15,2),
  budget_max DECIMAL(15,2),
  preferred_project VARCHAR(180),
  preferred_location VARCHAR(180),
  preferred_property_type VARCHAR(80),
  preferred_size VARCHAR(80),
  preferred_listing_type VARCHAR(20),
  next_follow_up DATETIME,
  crm_notes TEXT,
  utm_source VARCHAR(120),
  utm_medium VARCHAR(120),
  utm_campaign VARCHAR(180),
  landing_page VARCHAR(500),
  referrer VARCHAR(500),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_enquiries_property FOREIGN KEY (property_id) REFERENCES properties(property_id) ON DELETE SET NULL,
  INDEX idx_enquiry_status (status, created_at),
  INDEX idx_enquiry_stage (lead_stage, priority, created_at),
  INDEX idx_enquiry_source (source, created_at),
  INDEX idx_enquiry_property (property_id)
);

-- Chatbot enquiries use chatbot@heera-estate.local as their source email and
-- include the visitor's selected language in the message field.

CREATE TABLE ai_advisor_sessions (
  advisor_session_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  admin_id INT UNSIGNED NOT NULL,
  agent_id INT UNSIGNED DEFAULT NULL,
  client_name VARCHAR(160) DEFAULT NULL,
  criteria_json LONGTEXT NOT NULL,
  results_json LONGTEXT NOT NULL,
  provider VARCHAR(40) NOT NULL DEFAULT 'local',
  model VARCHAR(100) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ai_advisor_admin (admin_id, created_at),
  INDEX idx_ai_advisor_agent (agent_id, created_at)
);

CREATE TABLE saved_properties (
  saved_property_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  visitor_token CHAR(36) DEFAULT NULL,
  client_id INT UNSIGNED DEFAULT NULL,
  property_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_saved_property FOREIGN KEY (property_id) REFERENCES properties(property_id) ON DELETE CASCADE,
  UNIQUE KEY uq_saved_property (visitor_token, property_id),
  UNIQUE KEY uq_saved_property_client (client_id, property_id),
  INDEX idx_saved_client (client_id, created_at),
  INDEX idx_saved_property (property_id)
);

CREATE TABLE projects (
  project_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  plan_name VARCHAR(180) DEFAULT NULL,
  slug VARCHAR(190) DEFAULT NULL,
  category VARCHAR(100) NOT NULL,
  location VARCHAR(180) NOT NULL,
status ENUM('published', 'draft') NOT NULL DEFAULT 'draft',
  hero_image_url VARCHAR(500),
  headline VARCHAR(255),
  description TEXT,
  payment_plans TEXT, -- LEGACY migration source only; normalized payment_plans table is authoritative
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_project_slug (slug),
  INDEX idx_project_title_plan (title, plan_name),
  INDEX idx_project_status (status, updated_at)
);

CREATE TABLE sub_projects (
  sub_project_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id INT UNSIGNED NOT NULL,
  name VARCHAR(180) NOT NULL,
  slug VARCHAR(190) DEFAULT NULL,
  description TEXT,
  status ENUM('published','draft','archived') NOT NULL DEFAULT 'published',
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sub_project_name (project_id, name),
  UNIQUE KEY uq_sub_project_slug (slug),
  INDEX idx_sub_project_project (project_id, status, sort_order)
);

CREATE TABLE payment_plans (
  payment_plan_id VARCHAR(80) NOT NULL PRIMARY KEY,
  project_id INT UNSIGNED NOT NULL,
  sub_project_id INT UNSIGNED DEFAULT NULL,
  plan_name VARCHAR(180) NOT NULL DEFAULT 'Payment Plan',
  size_label VARCHAR(80),
  booking_amount DECIMAL(15,2),
  monthly_installment_count INT UNSIGNED,
  monthly_installment DECIMAL(15,2),
  half_yearly_count INT UNSIGNED,
  half_yearly_installment DECIMAL(15,2),
  balloting VARCHAR(120),
  on_possession DECIMAL(15,2),
  other_payment DECIMAL(15,2),
  total_price DECIMAL(15,2),
  full_payment_discount_percent DECIMAL(6,2),
  half_payment_discount_percent DECIMAL(6,2),
  preferred_location_charge_percent DECIMAL(6,2),
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_payment_plans_project (project_id, is_active, sort_order),
  INDEX idx_payment_plans_sub_project (sub_project_id, is_active, sort_order)
);

CREATE TABLE project_media (
  media_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id INT UNSIGNED NOT NULL,
  media_type ENUM('gallery', 'plan') NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  caption VARCHAR(255),
  sort_order TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_project_media FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
  UNIQUE KEY uq_project_media (project_id, media_type, file_path),
  INDEX idx_project_media (project_id, media_type, sort_order)
);

CREATE TABLE home_gallery (
  gallery_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  image_url VARCHAR(500) NOT NULL,
  caption VARCHAR(255),
  sort_order TINYINT UNSIGNED NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_home_gallery_image (image_url),
  INDEX idx_home_gallery (is_published, sort_order, gallery_id)
);

CREATE TABLE agents (
  agent_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  title VARCHAR(120),
  email VARCHAR(255),
  phone VARCHAR(30),
  photo_url VARCHAR(500),
  bio TEXT,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_agent_email (email),
  INDEX idx_agent_published (is_published, name)
);

CREATE TABLE popup_ads (
  popup_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  popup_type ENUM('content','image','video') NOT NULL DEFAULT 'content',
  image_url VARCHAR(500) DEFAULT NULL,
  video_url VARCHAR(500) DEFAULT NULL,
  link_url VARCHAR(500) DEFAULT NULL,
  headline VARCHAR(255) DEFAULT NULL,
  html_content TEXT DEFAULT NULL,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_popup_published (is_published, sort_order, popup_id)
);

CREATE TABLE office_addresses (
  office_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  office_name VARCHAR(160) NOT NULL,
  address_text TEXT NOT NULL,
  phone VARCHAR(30),
  map_url VARCHAR(500),
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_office_published (is_published, office_id)
);

-- Role based access control
CREATE TABLE master_options (
  option_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  option_type ENUM('project','subproject','block','marla') NOT NULL,
  name VARCHAR(180) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_master_option_type_name (option_type,name),
  INDEX idx_master_option_list (option_type,is_active,sort_order,name)
);

-- Platform v5: client engagement, CRM timeline, audit and reporting support.
CREATE TABLE saved_searches (
  saved_search_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  client_id INT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  criteria_json LONGTEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_saved_search_client (client_id, updated_at)
);

CREATE TABLE site_visits (
  site_visit_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  client_id INT UNSIGNED NOT NULL,
  property_id INT UNSIGNED NOT NULL,
  enquiry_id INT UNSIGNED DEFAULT NULL,
  assigned_agent_id INT UNSIGNED DEFAULT NULL,
  visit_date DATE NOT NULL,
  visit_time TIME NOT NULL,
  status ENUM('requested','confirmed','completed','cancelled','no_show') NOT NULL DEFAULT 'requested',
  client_notes VARCHAR(1500),
  admin_notes VARCHAR(2000),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_site_visit_client (client_id, visit_date, status),
  INDEX idx_site_visit_property (property_id, visit_date),
  INDEX idx_site_visit_agent (assigned_agent_id, visit_date),
  INDEX idx_site_visit_status (status, visit_date)
);

CREATE TABLE crm_activities (
  activity_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  enquiry_id INT UNSIGNED NOT NULL,
  admin_id INT UNSIGNED DEFAULT NULL,
  activity_type VARCHAR(30) NOT NULL DEFAULT 'note',
  subject VARCHAR(180),
  notes TEXT,
  occurred_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_crm_activity_lead (enquiry_id, occurred_at),
  INDEX idx_crm_activity_admin (admin_id, occurred_at)
);

CREATE TABLE property_price_history (
  price_history_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  property_id INT UNSIGNED NOT NULL,
  old_price_pkr DECIMAL(15,2),
  new_price_pkr DECIMAL(15,2),
  old_status VARCHAR(30),
  new_status VARCHAR(30),
  changed_by_admin_id INT UNSIGNED,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_price_history_property (property_id, created_at),
  INDEX idx_price_history_admin (changed_by_admin_id, created_at)
);

CREATE TABLE audit_logs (
  audit_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_type ENUM('admin','client','system') NOT NULL DEFAULT 'system',
  actor_id INT UNSIGNED,
  action_key VARCHAR(100) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(100),
  summary VARCHAR(500) NOT NULL,
  metadata_json LONGTEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_created (created_at),
  INDEX idx_audit_entity (entity_type, entity_id, created_at),
  INDEX idx_audit_actor (actor_type, actor_id, created_at)
);

CREATE TABLE password_reset_tokens (
  reset_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  account_type ENUM('admin','client') NOT NULL,
  account_id INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  used_at DATETIME,
  requested_ip VARCHAR(45),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_password_reset_account (account_type, account_id, created_at),
  INDEX idx_password_reset_expiry (expires_at, used_at)
);

CREATE TABLE roles (
  role_id SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role_key VARCHAR(60) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(500),
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE permissions (
  permission_key VARCHAR(100) PRIMARY KEY,
  label VARCHAR(160) NOT NULL,
  module_name VARCHAR(80) NOT NULL,
  description VARCHAR(500)
);

CREATE TABLE role_permissions (
  role_id SMALLINT UNSIGNED NOT NULL,
  permission_key VARCHAR(100) NOT NULL,
  PRIMARY KEY (role_id, permission_key),
  INDEX idx_role_permission_key (permission_key)
);

INSERT INTO roles (role_key,name,description,is_system) VALUES
('super_admin','Super Admin','Full system access.',TRUE),
('manager','Manager','Manage inventory, projects, CRM, submissions, maps and team content.',TRUE),
('agent','Agent','Work with CRM leads, properties and AI advisor tools.',TRUE),
('accountant','Accountant','Read business inventory and payment-plan data.',TRUE),
('editor','Content Editor','Manage listing/project/content records without security administration.',TRUE);

INSERT INTO permissions (permission_key,label,module_name) VALUES
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
('master_data.view','View reusable master data','Configuration'),('master_data.manage','Manage reusable master data','Configuration'),
('ai_advisor.use','Use AI property advisor','AI'),('system.health','View API/database health','System'),
('site_visits.view','View site visits','CRM'),('site_visits.manage','Manage site visits','CRM'),
('reports.view','View reports & analytics','Reports'),('audit.view','View audit log','Security');

INSERT INTO role_permissions (role_id,permission_key)
SELECT r.role_id,p.permission_key FROM roles r CROSS JOIN permissions p WHERE r.role_key='super_admin';
INSERT INTO role_permissions (role_id,permission_key)
SELECT r.role_id,p.permission_key FROM roles r CROSS JOIN permissions p WHERE r.role_key='manager' AND p.permission_key NOT IN ('roles.manage','audit.view');
INSERT INTO role_permissions (role_id,permission_key)
SELECT r.role_id,p.permission_key FROM roles r JOIN permissions p ON p.permission_key IN ('dashboard.view','properties.view','projects.view','subprojects.view','payment_plans.view','crm.view','crm.manage','agents.view','master_data.view','ai_advisor.use','site_visits.view','site_visits.manage') WHERE r.role_key='agent';
INSERT INTO role_permissions (role_id,permission_key)
SELECT r.role_id,p.permission_key FROM roles r JOIN permissions p ON p.permission_key IN ('dashboard.view','properties.view','projects.view','subprojects.view','payment_plans.view','crm.view','master_data.view','system.health','reports.view') WHERE r.role_key='accountant';
INSERT INTO role_permissions (role_id,permission_key)
SELECT r.role_id,p.permission_key FROM roles r JOIN permissions p ON p.permission_key IN ('dashboard.view','properties.view','properties.manage','projects.view','projects.manage','subprojects.view','subprojects.manage','payment_plans.view','payment_plans.manage','maps.view','gallery.manage','popups.manage','agents.view','uploads.manage','master_data.view','master_data.manage') WHERE r.role_key='editor';

-- Initial agent account. Change this password immediately after setup.
-- Email: admin@havenly.local  |  Password: Havenly2026!
INSERT INTO admin_users (first_name, last_name, email, username, password_hash) VALUES
('Heera', 'Admin', 'admin@havenly.local', 'admin', '$2y$10$dIonOhhHnD5awtXtyMvIHuY1/xDY3eBV1EYqSClhFOFTB0dsdEwga');
UPDATE admin_users SET role_id=(SELECT role_id FROM roles WHERE role_key='super_admin' LIMIT 1) WHERE role_id IS NULL;

-- Core relational constraints
ALTER TABLE sub_projects ADD CONSTRAINT fk_sub_project_project FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE payment_plans ADD CONSTRAINT fk_payment_plan_project FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE payment_plans ADD CONSTRAINT fk_payment_plan_sub_project FOREIGN KEY (sub_project_id) REFERENCES sub_projects(sub_project_id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE properties ADD CONSTRAINT fk_property_project FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE properties ADD CONSTRAINT fk_property_sub_project FOREIGN KEY (sub_project_id) REFERENCES sub_projects(sub_project_id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE properties ADD CONSTRAINT fk_property_payment_plan FOREIGN KEY (payment_plan_id) REFERENCES payment_plans(payment_plan_id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE role_permissions ADD CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE role_permissions ADD CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_key) REFERENCES permissions(permission_key) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE admin_users ADD CONSTRAINT fk_admin_role FOREIGN KEY (role_id) REFERENCES roles(role_id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE saved_properties ADD CONSTRAINT fk_saved_client FOREIGN KEY (client_id) REFERENCES client_users(client_id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE saved_searches ADD CONSTRAINT fk_saved_search_client FOREIGN KEY (client_id) REFERENCES client_users(client_id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE site_visits ADD CONSTRAINT fk_site_visit_client FOREIGN KEY (client_id) REFERENCES client_users(client_id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE site_visits ADD CONSTRAINT fk_site_visit_property FOREIGN KEY (property_id) REFERENCES properties(property_id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE site_visits ADD CONSTRAINT fk_site_visit_enquiry FOREIGN KEY (enquiry_id) REFERENCES enquiries(enquiry_id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE site_visits ADD CONSTRAINT fk_site_visit_agent FOREIGN KEY (assigned_agent_id) REFERENCES agents(agent_id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE crm_activities ADD CONSTRAINT fk_crm_activity_enquiry FOREIGN KEY (enquiry_id) REFERENCES enquiries(enquiry_id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE property_submissions ADD CONSTRAINT fk_submission_client FOREIGN KEY (client_id) REFERENCES client_users(client_id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE property_price_history ADD CONSTRAINT fk_price_history_property FOREIGN KEY (property_id) REFERENCES properties(property_id) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE property_price_history ADD CONSTRAINT fk_price_history_admin FOREIGN KEY (changed_by_admin_id) REFERENCES admin_users(admin_id) ON DELETE SET NULL ON UPDATE CASCADE;


-- Public properties, projects and gallery start empty on a clean production install.
-- Add verified Heera Estate inventory through Admin after deployment.
