-- Heera Real Estate: safely publish the reported subproject and its parent.
-- Target URL: /sub-project/2-year-installment-plan-15
-- This script performs no DELETE operations and preserves all existing data.

START TRANSACTION;

-- Fill a missing slug only for the exact matching record and only if that slug
-- is not already assigned to another subproject.
UPDATE sub_projects AS target
LEFT JOIN sub_projects AS owner
  ON BINARY owner.slug=BINARY '2-year-installment-plan-15'
 AND owner.sub_project_id<>target.sub_project_id
SET target.slug='2-year-installment-plan-15'
WHERE target.project_id=15
  AND BINARY LOWER(TRIM(target.name))=BINARY '2 year installment plan'
  AND (target.slug IS NULL OR TRIM(target.slug)='')
  AND owner.sub_project_id IS NULL;

-- Publishing a subproject also requires its parent project to be published.
UPDATE projects AS p
JOIN sub_projects AS sp ON sp.project_id=p.project_id
SET p.status='published', sp.status='published'
WHERE BINARY sp.slug=BINARY '2-year-installment-plan-15'
   OR (sp.project_id=15
       AND BINARY LOWER(TRIM(sp.name))=BINARY '2 year installment plan');

COMMIT;

-- Verification: both status columns must display "published".
SELECT
  sp.sub_project_id,
  sp.name AS subproject_name,
  sp.slug AS subproject_slug,
  sp.status AS subproject_status,
  p.project_id,
  p.title AS parent_project,
  p.status AS parent_project_status,
  CASE
    WHEN sp.status='published' AND p.status='published' THEN 'PUBLIC - URL should work'
    ELSE 'NOT PUBLIC - check the selected record'
  END AS result
FROM sub_projects AS sp
JOIN projects AS p ON p.project_id=sp.project_id
WHERE BINARY sp.slug=BINARY '2-year-installment-plan-15'
   OR (sp.project_id=15
       AND BINARY LOWER(TRIM(sp.name))=BINARY '2 year installment plan');
