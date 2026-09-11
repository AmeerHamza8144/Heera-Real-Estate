-- Heera Real Estate project data procedures (v3)
-- MySQL 8 / MariaDB 10.4+ / phpMyAdmin
-- Import after project-schema-repair.sql. Re-importing replaces only these
-- procedure definitions; these statements never delete application rows.
-- BINARY comparisons prevent utf8mb4_general_ci / utf8mb4_unicode_ci errors.

USE havenly_real_estate;

CREATE TABLE IF NOT EXISTS heera_data_change_log (
  log_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  action_name VARCHAR(80) NOT NULL,
  entity_type VARCHAR(40) NOT NULL,
  entity_id VARCHAR(80) DEFAULT NULL,
  project_id INT UNSIGNED DEFAULT NULL,
  sub_project_id INT UNSIGNED DEFAULT NULL,
  details TEXT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_heera_log_project (project_id, sub_project_id, created_at),
  INDEX idx_heera_log_action (action_name, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DELIMITER $$

DROP PROCEDURE IF EXISTS heera_v3_save_project$$
CREATE PROCEDURE heera_v3_save_project(
  IN p_project_id INT UNSIGNED,
  IN p_title VARCHAR(180),
  IN p_slug VARCHAR(190),
  IN p_category VARCHAR(100),
  IN p_location VARCHAR(180),
  IN p_status VARCHAR(20),
  IN p_headline VARCHAR(255),
  IN p_description TEXT,
  OUT p_saved_project_id INT UNSIGNED
)
BEGIN
  DECLARE v_id INT UNSIGNED DEFAULT 0;
  DECLARE v_status VARCHAR(20) DEFAULT 'draft';
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  SET v_status=CASE WHEN BINARY LOWER(TRIM(p_status))=BINARY 'published' THEN 'published' ELSE 'draft' END;
  START TRANSACTION;

  IF COALESCE(p_project_id,0)>0 THEN
    SET v_id=(SELECT project_id FROM projects WHERE project_id=p_project_id LIMIT 1);
  ELSEIF TRIM(COALESCE(p_slug,''))<>'' THEN
    SET v_id=(SELECT project_id FROM projects WHERE BINARY slug=BINARY TRIM(p_slug) LIMIT 1);
  ELSEIF TRIM(COALESCE(p_title,''))<>'' THEN
    SET v_id=(SELECT project_id FROM projects WHERE BINARY LOWER(TRIM(title))=BINARY LOWER(TRIM(p_title)) ORDER BY project_id LIMIT 1);
  END IF;

  IF COALESCE(v_id,0)>0 THEN
    UPDATE projects
    SET title=COALESCE(NULLIF(TRIM(p_title),''),title),
        slug=COALESCE(NULLIF(TRIM(p_slug),''),slug),
        category=COALESCE(NULLIF(TRIM(p_category),''),category),
        location=COALESCE(NULLIF(TRIM(p_location),''),location),
        status=v_status,
        headline=COALESCE(NULLIF(TRIM(p_headline),''),headline),
        description=COALESCE(NULLIF(TRIM(p_description),''),description)
    WHERE project_id=v_id;
  ELSE
    IF TRIM(COALESCE(p_title,''))='' OR TRIM(COALESCE(p_category,''))='' OR TRIM(COALESCE(p_location,''))='' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='New project requires title, category and location.';
    END IF;
    INSERT INTO projects (title,slug,category,location,status,headline,description)
    VALUES (TRIM(p_title),NULLIF(TRIM(p_slug),''),TRIM(p_category),TRIM(p_location),v_status,NULLIF(TRIM(p_headline),''),NULLIF(TRIM(p_description),''));
    SET v_id=LAST_INSERT_ID();
  END IF;

  INSERT INTO heera_data_change_log(action_name,entity_type,entity_id,project_id,details)
  VALUES('save_project','project',CAST(v_id AS CHAR),v_id,CONCAT('title=',TRIM(p_title),'; status=',v_status));
  COMMIT;
  SET p_saved_project_id=v_id;
  SELECT project_id,title,slug,category,location,status,headline,description,updated_at FROM projects WHERE project_id=v_id;
END$$

DROP PROCEDURE IF EXISTS heera_v3_save_subproject$$
CREATE PROCEDURE heera_v3_save_subproject(
  IN p_project_id INT UNSIGNED,
  IN p_sub_project_id INT UNSIGNED,
  IN p_name VARCHAR(180),
  IN p_slug VARCHAR(190),
  IN p_description TEXT,
  IN p_status VARCHAR(20),
  OUT p_saved_sub_project_id INT UNSIGNED
)
BEGIN
  DECLARE v_id INT UNSIGNED DEFAULT 0;
  DECLARE v_status VARCHAR(20) DEFAULT 'published';
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  IF NOT EXISTS(SELECT 1 FROM projects WHERE project_id=p_project_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Parent project does not exist.';
  END IF;
  IF TRIM(COALESCE(p_name,''))='' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Subproject name is required.';
  END IF;
  SET v_status=CASE
    WHEN BINARY LOWER(TRIM(p_status))=BINARY 'draft' THEN 'draft'
    WHEN BINARY LOWER(TRIM(p_status))=BINARY 'archived' THEN 'archived'
    ELSE 'published'
  END;

  START TRANSACTION;
  IF COALESCE(p_sub_project_id,0)>0 THEN
    SET v_id=(SELECT sub_project_id FROM sub_projects WHERE sub_project_id=p_sub_project_id AND project_id=p_project_id LIMIT 1);
  ELSEIF TRIM(COALESCE(p_slug,''))<>'' THEN
    SET v_id=(SELECT sub_project_id FROM sub_projects WHERE project_id=p_project_id AND BINARY slug=BINARY TRIM(p_slug) LIMIT 1);
  END IF;
  IF COALESCE(v_id,0)=0 THEN
    SET v_id=(SELECT sub_project_id FROM sub_projects WHERE project_id=p_project_id AND BINARY LOWER(TRIM(name))=BINARY LOWER(TRIM(p_name)) ORDER BY sub_project_id LIMIT 1);
  END IF;

  IF COALESCE(v_id,0)>0 THEN
    UPDATE sub_projects
    SET name=TRIM(p_name),
        slug=COALESCE(NULLIF(TRIM(p_slug),''),slug),
        description=COALESCE(NULLIF(TRIM(p_description),''),description),
        status=v_status
    WHERE sub_project_id=v_id AND project_id=p_project_id;
  ELSE
    INSERT INTO sub_projects(project_id,name,slug,description,status)
    VALUES(p_project_id,TRIM(p_name),NULLIF(TRIM(p_slug),''),NULLIF(TRIM(p_description),''),v_status);
    SET v_id=LAST_INSERT_ID();
  END IF;

  IF BINARY v_status=BINARY 'published' THEN
    UPDATE projects SET status='published' WHERE project_id=p_project_id;
  END IF;
  INSERT INTO heera_data_change_log(action_name,entity_type,entity_id,project_id,sub_project_id,details)
  VALUES('save_subproject','subproject',CAST(v_id AS CHAR),p_project_id,v_id,CONCAT('name=',TRIM(p_name),'; slug=',COALESCE(TRIM(p_slug),''),'; status=',v_status));
  COMMIT;
  SET p_saved_sub_project_id=v_id;
  SELECT sp.sub_project_id,sp.project_id,sp.name,sp.slug,sp.description,sp.status,p.title AS parent_project,p.status AS parent_status
  FROM sub_projects sp JOIN projects p ON p.project_id=sp.project_id WHERE sp.sub_project_id=v_id;
END$$

DROP PROCEDURE IF EXISTS heera_v3_link_property$$
CREATE PROCEDURE heera_v3_link_property(
  IN p_property_id INT UNSIGNED,
  IN p_project_id INT UNSIGNED,
  IN p_sub_project_id INT UNSIGNED
)
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;
  IF NOT EXISTS(SELECT 1 FROM properties WHERE property_id=p_property_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Property does not exist.';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM projects WHERE project_id=p_project_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Project does not exist.';
  END IF;
  IF COALESCE(p_sub_project_id,0)>0 AND NOT EXISTS(
    SELECT 1 FROM sub_projects WHERE sub_project_id=p_sub_project_id AND project_id=p_project_id
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Subproject does not belong to the selected project.';
  END IF;
  START TRANSACTION;
  UPDATE properties SET project_id=p_project_id,sub_project_id=NULLIF(p_sub_project_id,0) WHERE property_id=p_property_id;
  INSERT INTO heera_data_change_log(action_name,entity_type,entity_id,project_id,sub_project_id,details)
  VALUES('link_property','property',CAST(p_property_id AS CHAR),p_project_id,NULLIF(p_sub_project_id,0),'Linked existing property');
  COMMIT;
  SELECT property_id,title,status,project_id,sub_project_id,publish_start_date,publish_end_date FROM properties WHERE property_id=p_property_id;
END$$

DROP PROCEDURE IF EXISTS heera_v3_link_payment_plan$$
CREATE PROCEDURE heera_v3_link_payment_plan(
  IN p_payment_plan_id VARCHAR(80),
  IN p_project_id INT UNSIGNED,
  IN p_sub_project_id INT UNSIGNED
)
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;
  IF NOT EXISTS(SELECT 1 FROM payment_plans WHERE BINARY payment_plan_id=BINARY p_payment_plan_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Payment plan does not exist.';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM sub_projects WHERE sub_project_id=p_sub_project_id AND project_id=p_project_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Subproject does not belong to the selected project.';
  END IF;
  START TRANSACTION;
  UPDATE payment_plans SET project_id=p_project_id,sub_project_id=p_sub_project_id WHERE BINARY payment_plan_id=BINARY p_payment_plan_id;
  INSERT INTO heera_data_change_log(action_name,entity_type,entity_id,project_id,sub_project_id,details)
  VALUES('link_payment_plan','payment_plan',p_payment_plan_id,p_project_id,p_sub_project_id,'Linked existing payment plan');
  COMMIT;
  SELECT payment_plan_id,plan_name,size_label,is_active,project_id,sub_project_id FROM payment_plans WHERE BINARY payment_plan_id=BINARY p_payment_plan_id;
END$$

DROP PROCEDURE IF EXISTS heera_v3_project_report$$
CREATE PROCEDURE heera_v3_project_report(
  IN p_project_id INT UNSIGNED,
  IN p_subproject_slug VARCHAR(190)
)
BEGIN
  DECLARE v_sub_project_id INT UNSIGNED DEFAULT 0;
  IF TRIM(COALESCE(p_subproject_slug,''))<>'' THEN
    SET v_sub_project_id=COALESCE((SELECT sub_project_id FROM sub_projects WHERE project_id=p_project_id AND BINARY slug=BINARY TRIM(p_subproject_slug) LIMIT 1),0);
  END IF;

  SELECT p.project_id,p.title,p.slug,p.status AS project_status,
         sp.sub_project_id,sp.name AS subproject_name,sp.slug AS subproject_slug,sp.status AS subproject_status,
         CASE
           WHEN p.project_id IS NULL THEN 'PROJECT MISSING'
           WHEN v_sub_project_id=0 AND TRIM(COALESCE(p_subproject_slug,''))<>'' THEN 'SUBPROJECT SLUG MISSING'
           WHEN p.status<>'published' THEN 'PARENT PROJECT NOT PUBLISHED'
           WHEN sp.sub_project_id IS NOT NULL AND sp.status<>'published' THEN 'SUBPROJECT NOT PUBLISHED'
           ELSE 'PUBLIC RELATION OK'
         END AS visibility_result
  FROM (SELECT p_project_id AS requested_project_id) request_row
  LEFT JOIN projects p ON p.project_id=request_row.requested_project_id
  LEFT JOIN sub_projects sp ON sp.sub_project_id=NULLIF(v_sub_project_id,0)
  LIMIT 1;

  SELECT pp.payment_plan_id,pp.plan_name,pp.size_label,pp.is_active,pp.project_id,pp.sub_project_id,
         CASE WHEN pp.project_id<>p_project_id THEN 'WRONG PROJECT'
              WHEN v_sub_project_id>0 AND COALESCE(pp.sub_project_id,0) NOT IN (0,v_sub_project_id) THEN 'WRONG SUBPROJECT'
              WHEN pp.is_active=0 THEN 'INACTIVE'
              ELSE 'VISIBLE' END AS link_result
  FROM payment_plans pp
  WHERE pp.project_id=p_project_id
  ORDER BY pp.sub_project_id,pp.sort_order,pp.payment_plan_id;

  SELECT pr.property_id,pr.title,pr.slug,pr.status,pr.project_id,pr.sub_project_id,pr.publish_start_date,pr.publish_end_date,
         CASE WHEN pr.status<>'available' THEN 'STATUS NOT AVAILABLE'
              WHEN pr.publish_start_date IS NOT NULL AND pr.publish_start_date>CURRENT_DATE THEN 'PUBLISH DATE IS FUTURE'
              WHEN pr.publish_end_date IS NOT NULL AND pr.publish_end_date<CURRENT_DATE THEN 'PUBLISH DATE EXPIRED'
              WHEN v_sub_project_id>0 AND COALESCE(pr.sub_project_id,0)<>v_sub_project_id THEN 'NOT LINKED TO THIS SUBPROJECT'
              ELSE 'VISIBLE' END AS visibility_result
  FROM properties pr
  WHERE pr.project_id=p_project_id
  ORDER BY pr.sub_project_id,pr.property_id;

  SELECT pm.media_id,pm.media_type,pm.file_path,pm.caption,pm.sort_order
  FROM project_media pm WHERE pm.project_id=p_project_id ORDER BY pm.media_type,pm.sort_order,pm.media_id;

  SELECT log_id,action_name,entity_type,entity_id,project_id,sub_project_id,details,created_at
  FROM heera_data_change_log WHERE project_id=p_project_id ORDER BY log_id DESC LIMIT 100;
END$$

DROP PROCEDURE IF EXISTS heera_v3_property_report$$
CREATE PROCEDURE heera_v3_property_report(IN p_property_id INT UNSIGNED)
BEGIN
  SELECT pr.property_id,pr.title,pr.slug,pr.status,pr.project_id,pr.sub_project_id,pr.payment_plan_id,
         pr.publish_start_date,pr.publish_end_date,p.title AS project_title,p.status AS project_status,
         sp.name AS subproject_name,sp.slug AS subproject_slug,sp.status AS subproject_status,
         (SELECT COUNT(*) FROM property_media pm WHERE pm.property_id=pr.property_id) AS media_count,
         CASE
           WHEN pr.property_id IS NULL THEN 'PROPERTY MISSING'
           WHEN pr.status<>'available' THEN 'STATUS NOT AVAILABLE'
           WHEN pr.publish_start_date IS NOT NULL AND pr.publish_start_date>CURRENT_DATE THEN 'PUBLISH DATE IS FUTURE'
           WHEN pr.publish_end_date IS NOT NULL AND pr.publish_end_date<CURRENT_DATE THEN 'PUBLISH DATE EXPIRED'
           WHEN pr.project_id IS NOT NULL AND p.project_id IS NULL THEN 'LINKED PROJECT MISSING'
           WHEN pr.sub_project_id IS NOT NULL AND sp.sub_project_id IS NULL THEN 'LINKED SUBPROJECT MISSING'
           WHEN pr.sub_project_id IS NOT NULL AND sp.project_id<>pr.project_id THEN 'PROJECT/SUBPROJECT MISMATCH'
           ELSE 'PUBLIC PROPERTY OK'
         END AS visibility_result
  FROM (SELECT p_property_id AS requested_property_id) request_row
  LEFT JOIN properties pr ON pr.property_id=request_row.requested_property_id
  LEFT JOIN projects p ON p.project_id=pr.project_id
  LEFT JOIN sub_projects sp ON sp.sub_project_id=pr.sub_project_id
  LIMIT 1;
END$$

DELIMITER ;

-- Paste-ready examples (remove the leading -- before the calls you need):
-- SET @saved_project_id=0;
-- CALL heera_v3_save_project(15,'Your project','your-project','Residential','Lahore','published','Your headline','Your description',@saved_project_id);
-- SELECT @saved_project_id;
-- SET @saved_subproject_id=0;
-- CALL heera_v3_save_subproject(15,0,'2 Year Installment Plan','2-year-installment-plan-15','Subproject details','published',@saved_subproject_id);
-- SELECT @saved_subproject_id;
-- CALL heera_v3_link_property(8,15,@saved_subproject_id);
-- CALL heera_v3_link_payment_plan('paste-payment-plan-id-here',15,@saved_subproject_id);
-- CALL heera_v3_project_report(15,'2-year-installment-plan-15');
-- CALL heera_v3_property_report(8);
