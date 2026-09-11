-- Multi-map manager for existing Heera Estate installations.
USE havenly_real_estate;

CREATE TABLE IF NOT EXISTS digital_maps (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='digital_maps' AND COLUMN_NAME='map_image')=0,'ALTER TABLE digital_maps ADD COLUMN map_image VARCHAR(500) NULL AFTER name','SELECT 1');
PREPARE heera_stmt FROM @heera_sql; EXECUTE heera_stmt; DEALLOCATE PREPARE heera_stmt;
SET @heera_sql=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='digital_maps' AND COLUMN_NAME='map_image' AND IS_NULLABLE='NO')>0,'ALTER TABLE digital_maps MODIFY COLUMN map_image VARCHAR(500) NULL','SELECT 1');
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
  UNIQUE KEY uq_digital_map_block (map_id, name),
  INDEX idx_digital_blocks_map (map_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO digital_maps (name,map_image,original_pdf,plot_index_file,original_width,original_height)
VALUES ('Al-Rehman Garden Phase 2','maps/al-rehman-garden-phase-2-highres.jpg','maps/al-rehman-garden-phase-2-original.pdf','maps/phase2-plot-index.json',12009,9009)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Block names are intentionally not inferred or seeded. Add every block manually
-- from Admin Dashboard > Digital Maps > Manage Blocks.
