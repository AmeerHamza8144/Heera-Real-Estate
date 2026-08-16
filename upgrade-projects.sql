-- Run this once if you already imported an earlier version of database.sql.
USE havenly_real_estate;

CREATE TABLE IF NOT EXISTS projects (
  project_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  category VARCHAR(100) NOT NULL,
  location VARCHAR(180) NOT NULL,
  status ENUM('published', 'draft') NOT NULL DEFAULT 'draft',
  hero_image_url VARCHAR(500),
  headline VARCHAR(255),
  description TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_project_title (title),
  INDEX idx_project_status (status, updated_at)
);

CREATE TABLE IF NOT EXISTS project_media (
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

CREATE TABLE IF NOT EXISTS home_gallery (
  gallery_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  image_url VARCHAR(500) NOT NULL,
  caption VARCHAR(255),
  sort_order TINYINT UNSIGNED NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_home_gallery_image (image_url),
  INDEX idx_home_gallery (is_published, sort_order, gallery_id)
);

INSERT IGNORE INTO projects (title, category, location, status, hero_image_url, headline, description) VALUES
('Harbor Point Residences', 'Waterfront residences', 'Harbor District', 'published', 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1800&q=85', 'Designed for the water’s edge', 'A collection of light-filled homes that balance quiet interiors with an open waterfront setting.'),
('Aster Heights', 'City apartments', 'Central District', 'published', 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1800&q=85', 'A new perspective on city living', 'Thoughtful apartments with generous daylight, crafted materials, and a connected city address.'),
('Parkside Villas', 'Private villas', 'Green Park', 'published', 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1800&q=85', 'Made for slower days', 'A considered collection of private villas surrounded by landscape and everyday ease.'),
('Cedar Square', 'Townhomes', 'Cedar Quarter', 'published', 'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=1800&q=85', 'A neighborhood within a neighborhood', 'Characterful townhomes shaped around walkable streets, gardens, and shared spaces.'),
('Bayview Residences', 'Coastal apartments', 'Bayview', 'published', 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1800&q=85', 'Coastal living, considered', 'Modern residences that bring the horizon, the breeze, and the sea closer to home.'),
('The Arc at Central', 'Urban residences', 'Central District', 'published', 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1800&q=85', 'A landmark for everyday life', 'A lively mixed-use address where home, work, and the city come together.'),
('Orchard House', 'Garden homes', 'Orchard Lane', 'published', 'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1800&q=85', 'A home among the trees', 'A calm residential retreat with a garden-first approach to modern living.');

INSERT IGNORE INTO project_media (project_id, media_type, file_path, caption, sort_order) VALUES
(1, 'gallery', 'https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=1000&q=85', 'Harbor Point living room', 0),
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

INSERT IGNORE INTO home_gallery (image_url, caption, sort_order) VALUES
('https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=1000&q=85', 'Natural materials', 0),
('https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1000&q=85', 'Warm and considered interiors', 1),
('https://images.unsplash.com/photo-1600585152915-d208bec867a1?auto=format&fit=crop&w=1000&q=85', 'Architecture with presence', 2),
('https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1000&q=85', 'Indoor-outdoor living', 3),
('https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1000&q=85', 'A calm place to return to', 4);
