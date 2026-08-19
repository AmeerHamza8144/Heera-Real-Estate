-- Adds exclusive Content, Image and Video popup types to an existing website.
USE havenly_real_estate;

ALTER TABLE popup_ads
  ADD COLUMN popup_type ENUM('content','image','video') NOT NULL DEFAULT 'content' AFTER popup_id,
  ADD COLUMN video_url VARCHAR(500) DEFAULT NULL AFTER image_url;

UPDATE popup_ads
SET popup_type = CASE
  WHEN image_url IS NOT NULL AND image_url <> '' THEN 'image'
  ELSE 'content'
END;

-- The PHP API also performs this migration automatically when the columns are absent.
