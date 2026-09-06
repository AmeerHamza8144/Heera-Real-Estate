-- Heera Estate: On Installments listing type + property-to-payment-plan link
-- Run on an existing MySQL database if the web database user cannot ALTER tables automatically.

ALTER TABLE properties
  MODIFY listing_type ENUM('sale','rent','installment') NOT NULL DEFAULT 'sale';

ALTER TABLE properties
  ADD COLUMN payment_plan_id VARCHAR(80) NULL AFTER project_id;

ALTER TABLE property_submissions
  MODIFY listing_type ENUM('sale','rent','installment') NOT NULL DEFAULT 'sale';
