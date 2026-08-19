-- Havenly Real Estate database schema (MySQL 8+)
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
  listing_type ENUM('sale', 'rent') NOT NULL DEFAULT 'sale',
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
  seller_name VARCHAR(160) NOT NULL,
  seller_phone VARCHAR(30) NOT NULL,
  seller_email VARCHAR(255),
  seller_cnic VARCHAR(30),
  listing_type ENUM('sale','rent') NOT NULL DEFAULT 'sale',
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
  CONSTRAINT fk_submission_property FOREIGN KEY (approved_property_id) REFERENCES properties(property_id) ON DELETE SET NULL
);

CREATE TABLE digital_maps (
  map_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  map_image VARCHAR(500) NOT NULL,
  original_pdf VARCHAR(500),
  plot_index_file VARCHAR(500),
  original_width INT UNSIGNED NOT NULL,
  original_height INT UNSIGNED NOT NULL,
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
  name VARCHAR(160) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(30),
  interest ENUM('buying', 'selling', 'renting', 'agent') NOT NULL,
  message TEXT,
  status ENUM('new', 'contacted', 'closed') NOT NULL DEFAULT 'new',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_enquiries_property FOREIGN KEY (property_id) REFERENCES properties(property_id) ON DELETE SET NULL,
  INDEX idx_enquiry_status (status, created_at)
);

-- Chatbot enquiries use chatbot@heera-estate.local as their source email and
-- include the visitor's selected language in the message field.

CREATE TABLE saved_properties (
  saved_property_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  visitor_token CHAR(36) NOT NULL,
  property_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_saved_property FOREIGN KEY (property_id) REFERENCES properties(property_id) ON DELETE CASCADE,
  UNIQUE KEY uq_saved_property (visitor_token, property_id)
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
  payment_plans TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_project_slug (slug),
  INDEX idx_project_title_plan (title, plan_name),
  INDEX idx_project_status (status, updated_at)
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

-- Initial agent account. Change this password immediately after setup.
-- Email: admin@havenly.local  |  Password: Havenly2026!
INSERT INTO admin_users (first_name, last_name, email, username, password_hash) VALUES
('Havenly', 'Admin', 'admin@havenly.local', 'admin', '$2y$10$dIonOhhHnD5awtXtyMvIHuY1/xDY3eBV1EYqSClhFOFTB0dsdEwga');

INSERT INTO properties (listing_type, property_type, status, title, address_line1, city, state_region, postal_code, price, bedrooms, bathrooms, area_sqft, description) VALUES
('sale', 'House', 'available', 'Contemporary Pacific Heights Home', '4236 Mornington Road', 'San Francisco', 'CA', '94115', 1850000, 4, 3, 2820, 'Light-filled contemporary home with garden views and generous entertaining spaces.'),
('sale', 'Apartment', 'available', 'Williamsburg Skyline Apartment', '22 Wythe Avenue, Apt. 5B', 'Brooklyn', 'NY', '11249', 975000, 2, 2, 1240, 'A polished two-bedroom apartment in the heart of Williamsburg.'),
('sale', 'Villa', 'available', 'South Congress Design Villa', '818 Meadow Lane', 'Austin', 'TX', '78704', 1245000, 3, 2.5, 2460, 'Warm materials, clever details, and easy access to Austin’s most-loved neighborhood.'),
('rent', 'Apartment', 'available', 'West Village Retreat', '87 West 12th Street', 'New York', 'NY', '10011', 4800, 1, 1, 760, 'An elegant furnished rental in a peaceful West Village setting.');

INSERT INTO property_media (property_id, media_type, file_path, is_cover, sort_order) VALUES
(1, 'image', 'https://images.unsplash.com/photo-1600585152915-d208bec867a1?auto=format&fit=crop&w=900&q=85', TRUE, 0),
(2, 'image', 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=900&q=85', TRUE, 0),
(3, 'image', 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=85', TRUE, 0),
(4, 'image', 'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=900&q=85', TRUE, 0);

INSERT INTO projects (title, category, location, status, hero_image_url, headline, description) VALUES
('Harbor Point Residences', 'Waterfront residences', 'Harbor District', 'published', 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1800&q=85', 'Designed for the water’s edge', 'A collection of light-filled homes that balance quiet interiors with an open waterfront setting.'),
('Aster Heights', 'City apartments', 'Central District', 'published', 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1800&q=85', 'A new perspective on city living', 'Thoughtful apartments with generous daylight, crafted materials, and a connected city address.'),
('Parkside Villas', 'Private villas', 'Green Park', 'published', 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1800&q=85', 'Made for slower days', 'A considered collection of private villas surrounded by landscape and everyday ease.'),
('Cedar Square', 'Townhomes', 'Cedar Quarter', 'published', 'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=1800&q=85', 'A neighborhood within a neighborhood', 'Characterful townhomes shaped around walkable streets, gardens, and shared spaces.'),
('Bayview Residences', 'Coastal apartments', 'Bayview', 'published', 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1800&q=85', 'Coastal living, considered', 'Modern residences that bring the horizon, the breeze, and the sea closer to home.'),
('The Arc at Central', 'Urban residences', 'Central District', 'published', 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1800&q=85', 'A landmark for everyday life', 'A lively mixed-use address where home, work, and the city come together.'),
('Orchard House', 'Garden homes', 'Orchard Lane', 'published', 'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1800&q=85', 'A home among the trees', 'A calm residential retreat with a garden-first approach to modern living.');

INSERT INTO project_media (project_id, media_type, file_path, caption, sort_order) VALUES
(1, 'gallery', 'https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=1000&q=85', 'Harbor Point living room', 0),
(1, 'gallery', 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1000&q=85', 'Waterfront materials', 1),
(1, 'plan', 'https://placehold.co/1000x700/f8f6ef/1e2b27?text=Harbor+Point+Floor+Plan', 'Two bedroom residence', 0),
(2, 'gallery', 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1000&q=85', 'Aster Heights interiors', 0),
(2, 'plan', 'https://placehold.co/1000x700/f8f6ef/1e2b27?text=Aster+Heights+Floor+Plan', 'City apartment plan', 0),
(3, 'gallery', 'https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=1000&q=85', 'Parkside Villa living', 0),
(3, 'plan', 'https://placehold.co/1000x700/f8f6ef/1e2b27?text=Parkside+Villa+Plan', 'Villa plan', 0),
(4, 'gallery', 'https://images.unsplash.com/photo-1600585152915-d208bec867a1?auto=format&fit=crop&w=1000&q=85', 'Cedar Square facade', 0),
(4, 'plan', 'https://placehold.co/1000x700/f8f6ef/1e2b27?text=Cedar+Square+Plan', 'Townhome plan', 0),
(5, 'gallery', 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1000&q=85', 'Bayview residence', 0),
(5, 'plan', 'https://placehold.co/1000x700/f8f6ef/1e2b27?text=Bayview+Residence+Plan', 'Coastal plan', 0),
(6, 'gallery', 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1000&q=85', 'The Arc interiors', 0),
(6, 'plan', 'https://placehold.co/1000x700/f8f6ef/1e2b27?text=The+Arc+Plan', 'Urban residence plan', 0),
(7, 'gallery', 'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1000&q=85', 'Orchard House exterior', 0),
(7, 'plan', 'https://placehold.co/1000x700/f8f6ef/1e2b27?text=Orchard+House+Plan', 'Garden home plan', 0);

INSERT INTO home_gallery (image_url, caption, sort_order) VALUES
('https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=1000&q=85', 'Natural materials', 0),
('https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1000&q=85', 'Warm and considered interiors', 1),
('https://images.unsplash.com/photo-1600585152915-d208bec867a1?auto=format&fit=crop&w=1000&q=85', 'Architecture with presence', 2),
('https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1000&q=85', 'Indoor-outdoor living', 3),
('https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1000&q=85', 'A calm place to return to', 4);
