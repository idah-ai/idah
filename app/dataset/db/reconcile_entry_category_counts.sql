-- Rows returned by this query indicate counter drift. Read-only; run against
-- the dataset service database after migration or as a periodic operations check.
WITH expected AS (
  SELECT entry_id, dataset_id, project_id, category, COUNT(*)::integer AS count
  FROM annotations
  WHERE deleted_at IS NULL
  GROUP BY entry_id, dataset_id, project_id, category
), actual AS (
  SELECT entry_id, dataset_id, project_id, category, count
  FROM entry_category_counts
)
SELECT
  COALESCE(e.entry_id, a.entry_id) AS entry_id,
  COALESCE(e.category, a.category) AS category,
  e.dataset_id AS expected_dataset_id,
  a.dataset_id AS actual_dataset_id,
  e.project_id AS expected_project_id,
  a.project_id AS actual_project_id,
  COALESCE(e.count, 0) AS expected_count,
  COALESCE(a.count, 0) AS actual_count
FROM expected e
FULL OUTER JOIN actual a USING (entry_id, category)
WHERE e.count IS DISTINCT FROM a.count
   OR e.dataset_id IS DISTINCT FROM a.dataset_id
   OR e.project_id IS DISTINCT FROM a.project_id;
