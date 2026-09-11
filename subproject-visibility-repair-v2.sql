-- Heera Real Estate subproject visibility repair v2
-- Target URL /sub-project/2-year-installment-plan-15
-- Safe: no DELETE, DROP, TRUNCATE, or table-wide UPDATE statements.
-- Binary comparisons avoid utf8mb4_general_ci / utf8mb4_unicode_ci conflicts.

START TRANSACTION;

-- Assign the public URL when the matching row has no slug. The self join also
-- prevents taking a slug that already belongs to another row.
UPDATE sub_projects AS target
LEFT JOIN sub_projects AS owner
  ON BINARY owner.slug=BINARY '2-year-installment-plan-15'
 AND owner.sub_project_id<>target.sub_project_id
SET target.slug='2-year-installment-plan-15'
WHERE target.project_id=15
  AND BINARY LOWER(TRIM(target.name))=BINARY '2 year installment plan'
  AND (target.slug IS NULL OR TRIM(target.slug)='')
  AND owner.sub_project_id IS NULL;

-- Publish only the reported subproject.
UPDATE sub_projects
SET status='published'
WHERE project_id=15
  AND (
    BINARY slug=BINARY '2-year-installment-plan-15'
    OR BINARY LOWER(TRIM(name))=BINARY '2 year installment plan'
  );

-- Publish only its parent project.
UPDATE projects
SET status='published'
WHERE project_id=15
  AND EXISTS (
    SELECT 1
    FROM sub_projects
    WHERE project_id=15
      AND (
        BINARY slug=BINARY '2-year-installment-plan-15'
        OR BINARY LOWER(TRIM(name))=BINARY '2 year installment plan'
      )
  );

COMMIT;

-- Both status values must show "published".
SELECT
  sp.sub_project_id,
  sp.name AS subproject_name,
  sp.slug,
  sp.status AS subproject_status,
  p.project_id,
  p.title AS parent_project,
  p.status AS parent_project_status,
  (SELECT COUNT(*) FROM payment_plans AS pp
   WHERE pp.project_id=sp.project_id AND pp.sub_project_id=sp.sub_project_id) AS linked_payment_plans,
  (SELECT COUNT(*) FROM properties AS pr
   WHERE pr.project_id=sp.project_id AND pr.sub_project_id=sp.sub_project_id) AS linked_properties
FROM sub_projects AS sp
JOIN projects AS p ON p.project_id=sp.project_id
WHERE sp.project_id=15
  AND (
    BINARY sp.slug=BINARY '2-year-installment-plan-15'
    OR BINARY LOWER(TRIM(sp.name))=BINARY '2 year installment plan'
  );
