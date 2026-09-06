-- Advanced API + normalized payment plan migration
-- Safe to run on existing Heera Estate databases.

ALTER TABLE properties
  MODIFY listing_type ENUM('sale','rent','installment') NOT NULL DEFAULT 'sale';

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS payment_plan_id VARCHAR(80) NULL AFTER project_id;

CREATE TABLE IF NOT EXISTS payment_plans (
  payment_plan_id VARCHAR(80) NOT NULL PRIMARY KEY,
  project_id INT UNSIGNED NOT NULL,
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
  INDEX idx_payment_plans_project (project_id,is_active,sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Existing JSON plans are automatically copied into this table by api.php when
-- the project is next opened/saved or its payment plans endpoint is requested.
