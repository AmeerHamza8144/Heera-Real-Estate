-- Heera Real Estate module read procedures (v4)
-- MySQL 8 / MariaDB 10.4+ / phpMyAdmin
-- Fresh installation: import database.sql, then project-schema-repair.sql, then this file.
-- Existing installation: import project-schema-repair.sql, then this file.
-- Re-importing replaces only these procedure definitions. It does not delete
-- application rows. PHP keeps a prepared-query fallback for every routine.

USE havenly_real_estate;

DELIMITER $$

DROP PROCEDURE IF EXISTS heera_v4_properties$$
CREATE PROCEDURE heera_v4_properties(IN p_admin TINYINT)
BEGIN
  SELECT pr.*,pj.title AS project_title,COALESCE(sp.name,pj.plan_name) AS project_plan_name,
         sp.name AS sub_project_name,pj.payment_plans AS project_payment_plans,
         CASE WHEN pj.payment_plans IS NOT NULL AND TRIM(pj.payment_plans) NOT IN ('','[]','null') THEN 1 ELSE 0 END AS has_payment_plan
  FROM properties pr
  LEFT JOIN projects pj ON pj.project_id=pr.project_id
  LEFT JOIN sub_projects sp ON sp.sub_project_id=pr.sub_project_id
  WHERE p_admin=1 OR (
    pr.status='available'
    AND (pr.publish_start_date IS NULL OR pr.publish_start_date<=CURRENT_DATE)
    AND (pr.publish_end_date IS NULL OR pr.publish_end_date>=CURRENT_DATE)
  )
  ORDER BY pr.updated_at DESC,pr.property_id DESC;
END$$

DROP PROCEDURE IF EXISTS heera_v4_projects$$
CREATE PROCEDURE heera_v4_projects(IN p_admin TINYINT)
BEGIN
  SELECT * FROM projects
  WHERE p_admin=1 OR status='published'
  ORDER BY updated_at DESC,project_id ASC;
END$$

DROP PROCEDURE IF EXISTS heera_v4_subprojects$$
CREATE PROCEDURE heera_v4_subprojects(IN p_project_id INT UNSIGNED,IN p_admin TINYINT)
BEGIN
  SELECT sp.sub_project_id,sp.project_id,sp.name,sp.slug,sp.description,sp.status,sp.sort_order,sp.created_at,sp.updated_at,
         p.title AS project_title,p.location AS project_location,
         (SELECT COUNT(*) FROM payment_plans pp WHERE pp.sub_project_id=sp.sub_project_id AND pp.is_active=1) AS payment_plan_count,
         (SELECT COUNT(*) FROM properties pr WHERE pr.sub_project_id=sp.sub_project_id) AS property_count
  FROM sub_projects sp JOIN projects p ON p.project_id=sp.project_id
  WHERE (p_project_id=0 OR sp.project_id=p_project_id)
    AND (p_admin=1 OR (sp.status='published' AND p.status='published'))
  ORDER BY p.title,sp.sort_order,sp.name,sp.sub_project_id;
END$$

DROP PROCEDURE IF EXISTS heera_v4_payment_plans$$
CREATE PROCEDURE heera_v4_payment_plans(IN p_project_id INT UNSIGNED,IN p_sub_project_id INT UNSIGNED,IN p_admin TINYINT)
BEGIN
  SELECT pp.payment_plan_id AS plan_id,pp.project_id,pp.sub_project_id,pp.plan_name,pp.size_label,
         pp.booking_amount,pp.monthly_installment_count,pp.monthly_installment,pp.half_yearly_count,
         pp.half_yearly_installment,pp.balloting,pp.on_possession,pp.other_payment,pp.total_price,
         pp.full_payment_discount_percent,pp.half_payment_discount_percent,pp.preferred_location_charge_percent,
         pp.sort_order,pp.is_active,sp.name AS sub_project_name
  FROM payment_plans pp LEFT JOIN sub_projects sp ON sp.sub_project_id=pp.sub_project_id
  WHERE pp.project_id=p_project_id
    AND (p_admin=1 OR pp.is_active=1)
    AND (p_sub_project_id=0 OR pp.sub_project_id IS NULL OR pp.sub_project_id=p_sub_project_id)
  ORDER BY pp.sort_order,pp.payment_plan_id;
END$$

DROP PROCEDURE IF EXISTS heera_v4_crm_leads$$
CREATE PROCEDURE heera_v4_crm_leads()
BEGIN
  SELECT e.*,p.title AS property_title,a.name AS assigned_agent_name
  FROM enquiries e
  LEFT JOIN properties p ON p.property_id=e.property_id
  LEFT JOIN agents a ON a.agent_id=e.assigned_agent_id
  ORDER BY FIELD(e.priority,'hot','high','medium','low'),e.created_at DESC,e.enquiry_id DESC;
END$$

DROP PROCEDURE IF EXISTS heera_v4_submissions$$
CREATE PROCEDURE heera_v4_submissions()
BEGIN
  SELECT * FROM property_submissions ORDER BY created_at DESC,submission_id DESC;
END$$

DROP PROCEDURE IF EXISTS heera_v4_maps$$
CREATE PROCEDURE heera_v4_maps(IN p_admin TINYINT)
BEGIN
  SELECT * FROM digital_maps WHERE p_admin=1 OR is_active=1 ORDER BY name,map_id;
END$$

DROP PROCEDURE IF EXISTS heera_v4_map_blocks$$
CREATE PROCEDURE heera_v4_map_blocks()
BEGIN
  SELECT block_id,map_id,name,created_at FROM digital_map_blocks ORDER BY map_id,name;
END$$

DROP PROCEDURE IF EXISTS heera_v4_gallery$$
CREATE PROCEDURE heera_v4_gallery(IN p_admin TINYINT)
BEGIN
  SELECT gallery_id,image_url,caption,sort_order,is_published,created_at
  FROM home_gallery WHERE p_admin=1 OR is_published=1 ORDER BY sort_order,gallery_id;
END$$

DROP PROCEDURE IF EXISTS heera_v4_updates$$
CREATE PROCEDURE heera_v4_updates(IN p_admin TINYINT)
BEGIN
  SELECT popup_id,popup_type,image_url,video_url,link_url,headline,html_content,is_published,sort_order,created_at,updated_at
  FROM popup_ads WHERE p_admin=1 OR is_published=1 ORDER BY sort_order,popup_id DESC;
END$$

DROP PROCEDURE IF EXISTS heera_v4_agents$$
CREATE PROCEDURE heera_v4_agents(IN p_admin TINYINT)
BEGIN
  SELECT agent_id,name,title,email,phone,photo_url,bio,is_published
  FROM agents WHERE p_admin=1 OR is_published=1 ORDER BY name,agent_id;
END$$

DROP PROCEDURE IF EXISTS heera_v4_offices$$
CREATE PROCEDURE heera_v4_offices(IN p_admin TINYINT)
BEGIN
  SELECT office_id,office_name,address_text,phone,map_url,is_published
  FROM office_addresses WHERE p_admin=1 OR is_published=1 ORDER BY office_id;
END$$

DROP PROCEDURE IF EXISTS heera_v4_admin_users$$
CREATE PROCEDURE heera_v4_admin_users()
BEGIN
  SELECT a.admin_id AS user_id,CONCAT(a.first_name,' ',a.last_name) AS full_name,a.email,a.phone,a.username,a.is_active,
         'admin' AS user_type,a.role_id,r.role_key,r.name AS role_name,a.created_at
  FROM admin_users a LEFT JOIN roles r ON r.role_id=a.role_id ORDER BY a.admin_id;
END$$

DROP PROCEDURE IF EXISTS heera_v4_client_users$$
CREATE PROCEDURE heera_v4_client_users()
BEGIN
  SELECT client_id AS user_id,full_name,email,phone,NULL AS username,is_active,'client' AS user_type,
         NULL AS role_id,NULL AS role_key,'Client' AS role_name,created_at
  FROM client_users ORDER BY client_id;
END$$

DROP PROCEDURE IF EXISTS heera_v4_roles$$
CREATE PROCEDURE heera_v4_roles()
BEGIN
  SELECT r.role_id,r.role_key,r.name,r.description,r.is_system,
         (SELECT COUNT(*) FROM admin_users a WHERE a.role_id=r.role_id) AS user_count
  FROM roles r ORDER BY r.is_system DESC,r.name;
END$$

DROP PROCEDURE IF EXISTS heera_v4_permissions$$
CREATE PROCEDURE heera_v4_permissions()
BEGIN
  SELECT permission_key,label,module_name,description FROM permissions ORDER BY module_name,label;
END$$

DROP PROCEDURE IF EXISTS heera_v4_role_permissions$$
CREATE PROCEDURE heera_v4_role_permissions()
BEGIN
  SELECT role_id,permission_key FROM role_permissions ORDER BY role_id,permission_key;
END$$

DROP PROCEDURE IF EXISTS heera_v4_property_detail$$
CREATE PROCEDURE heera_v4_property_detail(IN p_property_id INT UNSIGNED,IN p_slug VARCHAR(190))
BEGIN
  SELECT pr.*,pj.title AS project_title,COALESCE(sp.name,pj.plan_name) AS project_plan_name,
         sp.name AS sub_project_name,pj.payment_plans AS project_payment_plans,
         CASE WHEN pj.payment_plans IS NOT NULL AND TRIM(pj.payment_plans) NOT IN ('','[]','null') THEN 1 ELSE 0 END AS has_payment_plan
  FROM properties pr
  LEFT JOIN projects pj ON pj.project_id=pr.project_id
  LEFT JOIN sub_projects sp ON sp.sub_project_id=pr.sub_project_id
  WHERE pr.status='available'
    AND (pr.publish_start_date IS NULL OR pr.publish_start_date<=CURRENT_DATE)
    AND (pr.publish_end_date IS NULL OR pr.publish_end_date>=CURRENT_DATE)
    AND ((p_property_id>0 AND pr.property_id=p_property_id) OR (p_property_id=0 AND BINARY pr.slug=BINARY TRIM(p_slug)))
  LIMIT 1;
END$$

DROP PROCEDURE IF EXISTS heera_v4_property_media$$
CREATE PROCEDURE heera_v4_property_media(IN p_property_id INT UNSIGNED)
BEGIN
  SELECT media_id,media_type,file_path,is_cover,sort_order FROM property_media
  WHERE property_id=p_property_id ORDER BY media_type,is_cover DESC,sort_order,media_id;
END$$

DROP PROCEDURE IF EXISTS heera_v4_project_detail$$
CREATE PROCEDURE heera_v4_project_detail(IN p_project_id INT UNSIGNED,IN p_slug VARCHAR(190))
BEGIN
  SELECT project_id,slug,title,plan_name,category,location,status,hero_image_url,headline,description,payment_plans,created_at,updated_at
  FROM projects
  WHERE status='published'
    AND ((p_project_id>0 AND project_id=p_project_id) OR (p_project_id=0 AND BINARY slug=BINARY TRIM(p_slug)))
  LIMIT 1;
END$$

DROP PROCEDURE IF EXISTS heera_v4_project_media$$
CREATE PROCEDURE heera_v4_project_media(IN p_project_id INT UNSIGNED)
BEGIN
  SELECT media_id,media_type,file_path,caption,sort_order FROM project_media
  WHERE project_id=p_project_id ORDER BY media_type,sort_order,media_id;
END$$

DROP PROCEDURE IF EXISTS heera_v4_project_properties$$
CREATE PROCEDURE heera_v4_project_properties(IN p_project_id INT UNSIGNED)
BEGIN
  SELECT pr.property_id,pr.project_id,pr.sub_project_id,pr.slug,pr.listing_type,pr.property_type,pr.status,pr.title,
         pr.address_line1,pr.city,pr.block_name,pr.size_label,pr.bedrooms,pr.bathrooms,pr.area_sqft,pr.price,
         pr.price_pkr,pr.description,pr.updated_at,
         (SELECT pm.file_path FROM property_media pm WHERE pm.property_id=pr.property_id AND pm.media_type='image'
          ORDER BY pm.is_cover DESC,pm.sort_order,pm.media_id LIMIT 1) AS image_url
  FROM properties pr
  WHERE pr.project_id=p_project_id AND pr.status='available'
    AND (pr.publish_start_date IS NULL OR pr.publish_start_date<=CURRENT_DATE)
    AND (pr.publish_end_date IS NULL OR pr.publish_end_date>=CURRENT_DATE)
  ORDER BY pr.updated_at DESC,pr.property_id DESC;
END$$

DROP PROCEDURE IF EXISTS heera_v4_master_options$$
CREATE PROCEDURE heera_v4_master_options(IN p_admin TINYINT)
BEGIN
  SELECT option_id,option_type,name,is_active,sort_order,created_at,updated_at
  FROM master_options
  WHERE p_admin=1 OR is_active=1
  ORDER BY FIELD(option_type,'project','subproject','block','marla'),sort_order,name,option_id;
END$$

DROP PROCEDURE IF EXISTS heera_v4_dashboard_counts$$
CREATE PROCEDURE heera_v4_dashboard_counts()
BEGIN
  SELECT
    (SELECT COUNT(*) FROM enquiries WHERE lead_stage='new') AS new_leads,
    (SELECT COUNT(*) FROM property_submissions WHERE status='pending') AS pending_submissions,
    (SELECT COUNT(*) FROM projects WHERE status='published') AS active_projects,
    (SELECT COUNT(*) FROM properties) AS properties,
    (SELECT COUNT(*) FROM sub_projects) AS subprojects,
    (SELECT COUNT(*) FROM payment_plans WHERE is_active=1) AS payment_plans,
    (SELECT COUNT(*) FROM admin_users WHERE is_active=1) AS active_admins;
END$$

DROP PROCEDURE IF EXISTS heera_v4_module_health$$
CREATE PROCEDURE heera_v4_module_health()
BEGIN
  SELECT required.table_name,
         CASE WHEN actual.TABLE_NAME IS NULL THEN 0 ELSE 1 END AS table_ready,
         COALESCE(actual.TABLE_ROWS,0) AS approximate_rows
  FROM (
    SELECT 'properties' table_name UNION ALL SELECT 'projects' UNION ALL SELECT 'sub_projects' UNION ALL
    SELECT 'payment_plans' UNION ALL SELECT 'project_media' UNION ALL SELECT 'property_media' UNION ALL
    SELECT 'enquiries' UNION ALL SELECT 'property_submissions' UNION ALL SELECT 'digital_maps' UNION ALL
    SELECT 'digital_map_blocks' UNION ALL SELECT 'home_gallery' UNION ALL SELECT 'popup_ads' UNION ALL
    SELECT 'agents' UNION ALL SELECT 'office_addresses' UNION ALL SELECT 'admin_users' UNION ALL
    SELECT 'client_users' UNION ALL SELECT 'roles' UNION ALL SELECT 'permissions' UNION ALL SELECT 'role_permissions' UNION ALL
    SELECT 'master_options'
  ) required
  LEFT JOIN information_schema.TABLES actual
    ON actual.TABLE_SCHEMA=DATABASE() AND BINARY actual.TABLE_NAME=BINARY required.table_name
  ORDER BY required.table_name;
END$$

DELIMITER ;

-- Paste-ready checks:
-- CALL heera_v4_module_health();
-- CALL heera_v4_properties(1);
-- CALL heera_v4_projects(1);
-- CALL heera_v4_subprojects(15,1);
-- CALL heera_v4_payment_plans(15,0,1);
