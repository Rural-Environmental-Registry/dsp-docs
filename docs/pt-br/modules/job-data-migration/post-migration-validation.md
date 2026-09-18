# rer-dsp-job-data-migration — Validação pós-migração

Checklist e consultas para confirmar que a migração via `rer-dsp-job-data-migration` concluiu com sucesso e que o destino está consistente.

## Quando validar

| Momento | Objetivo |
|---------|----------|
| Após cada job (L1, L2, L3, área de interesse, camadas) | Isolar problemas por nível |
| Após a sequência completa | Confirmar base pronta para o DSP |
| Antes de liberar GeoServer/API | Evitar publicação de dados incompletos |

## Checklist rápido

- [ ] Última execução do job com `status = COMPLETED`
- [ ] Sem steps `FAILED` em `BATCH_STEP_EXECUTION`
- [ ] Watermark gravado em `BATCH_JOB_EXECUTION_SYNC_STATE` para o `sync-key` do job
- [ ] Contagem do destino coerente com a origem (respeitando `where-clause` e o recorte do watermark)
- [ ] PK/unique presentes nas colunas de conflito
- [ ] Amostra de geometrias com `ST_IsValid` e SRID conforme `srid` do YAML — em ambos os destinos (`dsp-db`: bbox/centroid; `geoserver-db`: `geom`)
- [ ] FKs de hierarquia resolvidas (se aplicável)
- [ ] Layer GeoServer aponta para a tabela/view correta

## 1. Status do Spring Batch

Conecte no banco de destino (`spring.datasource.target` / `dsp-db`), schema `data_migration`:

```bash
psql -h localhost -p 6666 -U postgres -d dsp_db
SET search_path TO data_migration;
```

### Últimas execuções

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

A linha mais recente deve estar `COMPLETED`. Se aparecer `FAILED`, use a consulta de steps abaixo e os logs da aplicação para achar a causa.

### Steps da última execução de um job

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

!!! tip "Nomes dos jobs"
    Use o nome do **bean** (`adminUnitLevel1GeoserverJob`, etc.), não a flag `execution-jobs` em kebab-case.

### Watermark incremental

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

| Leitura | Significado |
|---------|-------------|
| `watermark_last_event_at` nulo | Ainda não houve carga `COMPLETED` com delta |
| `last_orphan_check_at` antigo (> 24 h) | A próxima execução deve varrer órfãos |
| Job `COMPLETED` mas watermark igual | Sem delta temporal (SKIP ou só órfãos) |

Para reprocessar do zero um job, apague a linha do `sync-key` correspondente (e, se precisar, os dados do destino).

## 2. Contagens origem × destino

Valide **os dois destinos** após cada job. Adapte schema/tabela ao seu YAML. No contrato oficial do DSP:

### dsp-db (operacional — sem geom completa)

```sql
SELECT COUNT(*) AS dsp_db_count
FROM dsp.territory_level_1
WHERE boundary_box IS NOT NULL;
```

### geoserver-db (geometria completa)

```sql
SELECT COUNT(*) AS geoserver_count
FROM dsp.territory_level_1
WHERE geom IS NOT NULL;
```

A primeira carga deve refletir a origem filtrada por `where-clause` e `creation-date-column IS NOT NULL`. Cargas seguintes só entram registros novos ou atualizados depois do watermark; órfãos saem no scan periódico.

## 3. Integridade de chave e órfãos

### PK no destino

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

IDs e FKs no destino oficial são `VARCHAR` (`territory_level_*`: `varchar(64)`; AOI/camadas: `varchar(255)` no `id`).

## 4. Geometrias

### geoserver-db — geom completa

```sql
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE NOT ST_IsValid(geom)) AS invalidas,
  COUNT(*) FILTER (WHERE ST_SRID(geom) <> 4326) AS srid_diferente,
  COUNT(*) FILTER (WHERE geom IS NULL) AS nulas
FROM dsp.territory_level_1;
```

Substitua `4326` pelo valor de `srid` do bloco YAML correspondente. AOI e camadas também usam `geom`.

### dsp-db — bbox e centroid

```sql
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE NOT ST_IsValid(boundary_box)) AS bbox_invalidas,
  COUNT(*) FILTER (WHERE ST_SRID(boundary_box) <> 4326) AS bbox_srid_diferente,
  COUNT(*) FILTER (WHERE NOT ST_IsValid(centroid_coordinates)) AS centroid_invalidos,
  COUNT(*) FILTER (WHERE ST_SRID(centroid_coordinates) <> 4326) AS centroid_srid_diferente
FROM dsp.territory_level_1;
```

| Verificação | Critério de aceite |
|-------------|---------------------|
| `invalidas` | 0 (ou lista conhecida tratada à parte) |
| `srid_diferente` | 0 em relação ao `srid` do YAML |
| `nulas` | Compatível com regras de negócio |

## 5. Hierarquia entre levels

```sql
SELECT c.id, c.parent_id
FROM dsp.territory_level_2 c
LEFT JOIN dsp.territory_level_1 p
  ON p.id = c.parent_id
WHERE p.id IS NULL
LIMIT 50;
```

Repita o padrão para level-3 → level-2. AOI: `territory_level_3_id` deve existir em `dsp.territory_level_3`.

## 6. Paralelização e performance

| Sinal | Interpretação |
|-------|----------------|
| `write_count` muito menor que esperado | Filtros de geometria / skips no writer / só delta do watermark |
| Muitos erros de conexão | `thread-pool-size` maior que o pool Hikari |
| Job lento com `thread-pool-size: 1` | Esperado em tabelas grandes |
| `SKIP` imediato | Sem delta temporal — confirme se a origem realmente mudou depois do watermark |

## 7. GeoServer

| Checagem | Como |
|----------|------|
| Layer existe | UI/REST do GeoServer com o mesmo `layer-name` do YAML |
| Store aponta para geoserver-db | Conferir datastore JDBC/PostGIS → `dsp-geoserver-db` (não `dsp-db`) |
| Preview WMS | Bounding box coerente com a amostra SQL do geoserver-db |

## Sinais de falha frequentes

| Sintoma | Causa provável | Correção |
|---------|-----------------|----------|
| `batch_job_instance does not exist` | Schema BATCH ausente | Rodar `01_spring_batch_schema.sql` |
| Erro `ON CONFLICT` | Sem PK/unique no destino | Criar constraint |
| Contagem destino = 0 | Job em SKIP, flags false, JDBC errado ou watermark já avançado | Revisar `execution-jobs`, URLs e `SYNC_STATE` |
| Geometrias nulas | Mapping da coluna geom incorreto | Revisar `geometry-column` / `column-mapping` (destino: `geom`) |
| FK quebrada entre levels | Ordem invertida ou L1 incompleto | Reexecutar L1 → L2 → L3 |
| App sobe e encerra "ok" sem dados | Nenhuma flag `true` | Habilitar ao menos um job |
| Incremental “atrasado” | `updated-at-column` nula ou ausente | Preencher a coluna ou resetar o `sync-key` |

Visão do job: [Visão geral](overview.md).
