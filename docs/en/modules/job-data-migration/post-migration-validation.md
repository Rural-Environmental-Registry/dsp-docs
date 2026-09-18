# rer-dsp-job-data-migration — Post-migration validation

Checklist and queries to confirm that migration via `rer-dsp-job-data-migration` completed successfully and that the destination is consistent.

## When to validate

| Moment | Goal |
|--------|------|
| After each job (L1, L2, L3, area of interest, layers) | Isolate problems by level |
| After the full sequence | Confirm base ready for the DSP |
| Before enabling GeoServer/API | Avoid publishing incomplete data |

## Quick checklist

- [ ] Last job run with `status = COMPLETED`
- [ ] No `FAILED` steps in `BATCH_STEP_EXECUTION`
- [ ] Watermark stored in `BATCH_JOB_EXECUTION_SYNC_STATE` for the job’s `sync-key`
- [ ] Destination count consistent with source (respecting `where-clause` and watermark window)
- [ ] PK/unique present on conflict columns
- [ ] Geometry sample with `ST_IsValid` and SRID per YAML `srid` — in both destinations (`dsp-db`: bbox/centroid; `geoserver-db`: `geom`)
- [ ] Hierarchy FKs resolved (if applicable)
- [ ] GeoServer layer points to the correct table/view

## 1. Spring Batch status

Connect to the destination database (`spring.datasource.target` / `dsp-db`), schema `data_migration`:

```bash
psql -h localhost -p 6666 -U postgres -d dsp_db
SET search_path TO data_migration;
```

### Latest runs

```sql
SELECT i.job_name,
       e.status,
       e.exit_code,
       e.start_time,
       e.end_time
FROM batch_job_execution e
JOIN batch_job_instance i
  ON e.job_instance_id = i.job_instance_id
ORDER BY e.job_execution_id DESC
LIMIT 20;
```

The most recent row should be `COMPLETED`. If you see `FAILED`, use the steps query below and application logs to find the cause.

### Steps for the latest run of a job

```sql
SELECT se.step_name,
       se.status,
       se.read_count,
       se.write_count,
       se.skip_count,
       se.exit_message
FROM batch_step_execution se
JOIN batch_job_execution je
  ON se.job_execution_id = je.job_execution_id
JOIN batch_job_instance ji
  ON je.job_instance_id = ji.job_instance_id
WHERE ji.job_name = 'adminUnitLevel1GeoserverJob'
ORDER BY se.step_execution_id DESC
LIMIT 20;
```

!!! tip "Job names"
    Use the **bean** name (`adminUnitLevel1GeoserverJob`, etc.), not the kebab-case `execution-jobs` flag.

### Incremental watermark

```sql
SELECT sync_key,
       source_table,
       watermark_last_event_at,
       last_success_at,
       last_orphan_check_at,
       last_job_execution_id
FROM data_migration.BATCH_JOB_EXECUTION_SYNC_STATE
ORDER BY sync_key;
```

| Reading | Meaning |
|---------|---------|
| `watermark_last_event_at` null | No `COMPLETED` load with delta yet |
| `last_orphan_check_at` old (> 24 h) | Next run should sweep orphans |
| Job `COMPLETED` but watermark unchanged | No temporal delta (SKIP or orphans only) |

To reprocess a job from scratch, delete the row for the corresponding `sync-key` (and destination data if needed).

## 2. Source × destination counts

Validate **both destinations** after each job. Adapt schema/table to your YAML. In the official DSP contract:

### dsp-db (operational — no full geom)

```sql
SELECT COUNT(*) AS dsp_db_count
FROM dsp.territory_level_1
WHERE boundary_box IS NOT NULL;
```

### geoserver-db (full geometry)

```sql
SELECT COUNT(*) AS geoserver_count
FROM dsp.territory_level_1
WHERE geom IS NOT NULL;
```

The first load should reflect the source filtered by `where-clause` and `creation-date-column IS NOT NULL`. Later loads only add records new or updated after the watermark; orphans are removed in the periodic scan.

## 3. Key integrity and orphans

### PK on destination

```sql
SELECT tc.constraint_type, kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.table_schema = kcu.table_schema
WHERE tc.table_schema = 'dsp'
  AND tc.table_name = 'territory_level_1'
  AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE');
```

IDs and FKs in the official destination are `VARCHAR` (`territory_level_*`: `varchar(64)`; AOI/layers: `varchar(255)` on `id`).

## 4. Geometries

### geoserver-db — full geom

```sql
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE NOT ST_IsValid(geom)) AS invalidas,
  COUNT(*) FILTER (WHERE ST_SRID(geom) <> 4326) AS srid_diferente,
  COUNT(*) FILTER (WHERE geom IS NULL) AS nulas
FROM dsp.territory_level_1;
```

Replace `4326` with the `srid` value from the corresponding YAML block. AOI and layers also use `geom`.

### dsp-db — bbox and centroid

```sql
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE NOT ST_IsValid(boundary_box)) AS bbox_invalidas,
  COUNT(*) FILTER (WHERE ST_SRID(boundary_box) <> 4326) AS bbox_srid_diferente,
  COUNT(*) FILTER (WHERE NOT ST_IsValid(centroid_coordinates)) AS centroid_invalidos,
  COUNT(*) FILTER (WHERE ST_SRID(centroid_coordinates) <> 4326) AS centroid_srid_diferente
FROM dsp.territory_level_1;
```

| Check | Acceptance criteria |
|-------|---------------------|
| `invalidas` | 0 (or known list handled separately) |
| `srid_diferente` | 0 relative to YAML `srid` |
| `nulas` | Consistent with business rules |

## 5. Hierarchy between levels

```sql
SELECT c.id, c.parent_id
FROM dsp.territory_level_2 c
LEFT JOIN dsp.territory_level_1 p
  ON p.id = c.parent_id
WHERE p.id IS NULL
LIMIT 50;
```

Repeat the pattern for level-3 → level-2. AOI: `territory_level_3_id` must exist in `dsp.territory_level_3`.

## 6. Parallelization and performance

| Signal | Interpretation |
|--------|----------------|
| `write_count` much lower than expected | Geometry filters / writer skips / watermark delta only |
| Many connection errors | `thread-pool-size` larger than Hikari pool |
| Slow job with `thread-pool-size: 1` | Expected on large tables |
| Immediate `SKIP` | No temporal delta — confirm source actually changed after watermark |

## 7. GeoServer

| Check | How |
|-------|-----|
| Layer exists | GeoServer UI/REST with same `layer-name` as YAML |
| Store points to geoserver-db | Check JDBC/PostGIS datastore → `dsp-geoserver-db` (not `dsp-db`) |
| WMS preview | Bounding box consistent with geoserver-db SQL sample |

## Common failure signals

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `batch_job_instance does not exist` | Missing BATCH schema | Run `01_spring_batch_schema.sql` |
| `ON CONFLICT` error | No PK/unique on destination | Create constraint |
| Destination count = 0 | SKIP job, flags false, wrong JDBC, or watermark already advanced | Review `execution-jobs`, URLs, and `SYNC_STATE` |
| Null geometries | Wrong geom column mapping | Review `geometry-column` / `column-mapping` (destination: `geom`) |
| Broken FK between levels | Wrong order or incomplete L1 | Re-run L1 → L2 → L3 |
| App starts and exits “ok” with no data | No flag `true` | Enable at least one job |
| Incremental “lagging” | Null or missing `updated-at-column` | Fill column or reset `sync-key` |

Job overview: [Overview](overview.md).
