-- Digital Plot Locator migration for existing Heera Estate databases.
-- Import once in phpMyAdmin. The API also creates these tables safely when first used.
USE havenly_real_estate;

CREATE TABLE IF NOT EXISTS map_projects (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  map_image VARCHAR(500) NOT NULL,
  original_width INT UNSIGNED NOT NULL,
  original_height INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_map_project_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS map_blocks (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id INT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_map_block_project FOREIGN KEY (project_id) REFERENCES map_projects(id) ON DELETE CASCADE,
  UNIQUE KEY uq_map_block_name (project_id, name),
  INDEX idx_map_blocks_project (project_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS map_plots (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  project_id INT UNSIGNED NOT NULL,
  block_id INT UNSIGNED NOT NULL,
  plot_number VARCHAR(80) NOT NULL,
  plot_size VARCHAR(80),
  plot_type VARCHAR(80),
  facing VARCHAR(120),
  status ENUM('Available', 'Reserved', 'Sold', 'Unavailable') NOT NULL DEFAULT 'Available',
  price DECIMAL(15,2),
  normalized_x DECIMAL(10,8) NOT NULL,
  normalized_y DECIMAL(10,8) NOT NULL,
  marker_size SMALLINT UNSIGNED NOT NULL DEFAULT 24,
  polygon_coordinates LONGTEXT,
  property_id INT UNSIGNED,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_map_plot_project FOREIGN KEY (project_id) REFERENCES map_projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_map_plot_block FOREIGN KEY (block_id) REFERENCES map_blocks(id) ON DELETE CASCADE,
  CONSTRAINT fk_map_plot_property FOREIGN KEY (property_id) REFERENCES properties(property_id) ON DELETE SET NULL,
  UNIQUE KEY uq_map_plot_number (project_id, block_id, plot_number),
  INDEX idx_map_plot_search (project_id, block_id, plot_number),
  INDEX idx_map_plot_status (project_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO map_projects (name, map_image, original_width, original_height) VALUES
('Al-Rehman Garden Phase 2', 'maps/al-rehman-garden-phase-2.jpg', 6005, 4505);
