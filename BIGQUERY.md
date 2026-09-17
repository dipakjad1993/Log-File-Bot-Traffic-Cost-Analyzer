# BigQuery / Snowflake native — logs.csv + partitioned DDL + waste queries

Module 6 / info bar → **Logs CSV (BQ)** downloads `logs.csv` (up to 100k rows,
bot + tier labeled) + **BQ .sql** downloads `bigquery-pack.sql`. Schema:

```
ip,tstamp,method,uri,status,ua,bytes,rt,referer,tls,cache,bot,tier
```

## Scale rule
- Browser: <500MB Fast Triage (sampled, 300k cap).
- CLI: 500MB–50GB exact — `node tools/cli.js --in access.log --exact --out summary.json --logs-csv logs.csv --bq-sql bq-pack.sql`
- BigQuery/Snowflake: 50GB+ — load logs.csv / parquet, run pack below.

## DuckDB (local, zero setup) + Parquet export

```sql
CREATE TABLE logs AS SELECT * FROM read_csv('logs.csv', header=true);

-- Parquet export (partitioned, for warehouse handoff)
COPY logs TO 'logs.parquet' (FORMAT PARQUET, PARTITION_BY (date));
```

## BigQuery DDL (partitioned)

```sql
CREATE SCHEMA IF NOT EXISTS bot_logs;
CREATE OR REPLACE TABLE bot_logs.logs (
  ip STRING, tstamp TIMESTAMP, method STRING, uri STRING, status INT64,
  ua STRING, bytes INT64, rt FLOAT64, referer STRING, tls STRING,
  cache STRING, bot STRING, tier STRING
) PARTITION BY DATE(tstamp)
OPTIONS (description="bot traffic logs from Log File Analyzer logs.csv");
```

```bash
bq load --source_format=CSV --skip_leading_rows=1 bot_logs.logs logs.csv
```

## Top-10 waste queries (also in-app via genBQPack)

```sql
-- Q1 top training waste
SELECT bot, COUNT(*) reqs, SUM(bytes)/1e9 gb, SUM(bytes)/1e9*0.09 usd
FROM bot_logs.logs WHERE tier='ai_training' GROUP BY bot ORDER BY reqs DESC LIMIT 50;

-- Q2 404 clusters
SELECT uri, COUNT(*) h404 FROM bot_logs.logs WHERE status=404
GROUP BY uri ORDER BY h404 DESC LIMIT 50;

-- Q3 JS-shell suspects
SELECT bot, uri, bytes FROM bot_logs.logs
WHERE status BETWEEN 200 AND 299 AND bytes < 5120
AND tier IN ('ai_training','ai_search_index') ORDER BY bytes LIMIT 200;

-- Q4 spoof hunt
SELECT ip, bot, COUNT(*) c FROM bot_logs.logs
WHERE tier IN ('ai_training','ai_search_index')
GROUP BY ip, bot HAVING c > 50 ORDER BY c DESC LIMIT 100;

-- Q5 hourly bursts
SELECT TIMESTAMP_TRUNC(tstamp, HOUR) h, bot, COUNT(*) c
FROM bot_logs.logs GROUP BY h, bot HAVING c > 500 ORDER BY c DESC LIMIT 100;

-- Q6 monthly blockable projection (7-day window)
SELECT SUM(bytes)/1e9*0.09*30/7 AS projected_monthly_usd
FROM bot_logs.logs WHERE tier IN ('ai_training','suspicious','unknown_bot');

-- Q7 trap bandwidth share
SELECT SUM(CASE WHEN uri LIKE '%?%' THEN bytes ELSE 0 END)/SUM(bytes)*100 AS pct_param_bytes
FROM bot_logs.logs;
```

Sample SQL is also embedded in-app (`BQ_SAMPLE_SQL`, `genBQPack()` in `js/analyzer.js`).
