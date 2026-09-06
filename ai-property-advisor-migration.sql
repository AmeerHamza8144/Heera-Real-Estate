-- Agent AI Property Advisor history (MySQL 8+)
USE havenly_real_estate;

CREATE TABLE IF NOT EXISTS ai_advisor_sessions (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
