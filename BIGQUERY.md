# BigQuery / DuckDB bridge — `logs.csv` export + 3 SQL queries

Module 6 / info bar → **Logs CSV (BQ)** downloads `logs.csv` (up to 100k rows,
bot + tier labeled). Schema:

```
ip,tstamp,method,uri,status,ua,bytes,rt,referer,tls,cache,bot,tier
```

## DuckDB (local, zero setup)

```sql
CREATE TABLE logs AS SELECT * FROM read_csv('logs.csv', header=true);

-- 1) Training-bot egress cost (measured bytes × $0.09/GB)
SELECT bot, COUNT(*) AS reqs, SUM(bytes)/1e9 AS gb,
       SUM(bytes)/1e9 * 0.09 AS egress_usd
FROM logs WHERE tier = 'ai_training' GROUP BY bot ORDER BY reqs DESC;

-- 2) Top 404s (crawl-budget waste candidates)
SELECT uri, COUNT(*) AS hits_404 FROM logs
WHERE status = 404 GROUP BY uri ORDER BY hits_404 DESC LIMIT 50;

-- 3) Trap bandwidth share
SELECT SUM(CASE WHEN uri LIKE '%?%' THEN bytes ELSE 0 END)/SUM(bytes)*100 AS pct_param_bytes
FROM logs;
```

## BigQuery

```bash
bq load --source_format=CSV --skip_leading_rows=1 myds.logs logs.csv
```

```sql
-- Monthly blockable waste projection from a 7-day log window
SELECT SUM(bytes)/1e9*0.09*30/7 AS projected_monthly_usd
FROM `myds.logs` WHERE tier IN ('ai_training','suspicious','unknown_bot');
```

Sample SQL is also embedded in-app (`BQ_SAMPLE_SQL` in `js/analyzer.js`) and on the
Module 6 export card.
