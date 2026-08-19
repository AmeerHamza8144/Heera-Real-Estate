-- Multi-map manager for existing Heera Estate installations.
USE havenly_real_estate;

CREATE TABLE IF NOT EXISTS digital_maps (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS digital_map_blocks (
  block_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  map_id INT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_digital_block_map FOREIGN KEY (map_id) REFERENCES digital_maps(map_id) ON DELETE CASCADE,
  UNIQUE KEY uq_digital_map_block (map_id, name),
  INDEX idx_digital_blocks_map (map_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO digital_maps (name,map_image,original_pdf,plot_index_file,original_width,original_height)
VALUES ('Al-Rehman Garden Phase 2','maps/al-rehman-garden-phase-2-highres.jpg','maps/al-rehman-garden-phase-2-original.pdf','maps/phase2-plot-index.json',12009,9009)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Block names are intentionally not inferred or seeded. Add every block manually
-- from Admin Dashboard > Digital Maps > Manage Blocks.
