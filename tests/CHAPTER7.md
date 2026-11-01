# Chapter 7 local experiments

Run only against the local `codejudge` Docker Compose project. The scripts mark every C++ submission with a unique `run_id` comment and never reset PostgreSQL.

## Prerequisites

- `docker compose up -d` with a healthy backend, db, Redis, go-judge and registered Workers.
- Python 3.13 with `requests`, `psycopg`, `matplotlib` and `Pillow`.
- Set `TEST_USERNAME` and `TEST_PASSWORD` in the process environment. Do not put either in a command log or tracked file.

## Runs

```powershell
py -3.13 tests/chapter7_environment.py
py -3.13 tests/chapter7_experiment.py accuracy --vus 1 --observe 120
py -3.13 tests/chapter7_experiment.py load --vus 5 --count 10 --observe 180
py -3.13 tests/chapter7_experiment.py load --vus 20 --count 100 --observe 180
py -3.13 tests/chapter7_experiment.py load --vus 200 --count 1000 --observe 300
py -3.13 tests/chapter7_scaling.py
docker compose up -d --no-deps --scale worker=2 worker
py -3.13 tests/chapter7_failover.py
```

For the monitoring stack, start the main Compose project first, then run `docker compose -f monitoring/compose.yaml --profile monitoring up -d --build`. Grafana is bound to `127.0.0.1:13000`, Prometheus to `127.0.0.1:19090`, and the read-only metric exporter to `127.0.0.1:19100`. The Grafana image renderer supplies real dashboard PNGs through Grafana's `/render` endpoint.

For k6, set the same credentials in the process environment and run `py -3.13 tests/chapter7_k6.py`. Its Docker container joins `codejudge_default` and sends requests only to `http://backend:8000`. Then run `py -3.13 tests/chapter7_k6_finalize.py` for redacted logs. The k6 CSV contains POST and GET samples; use `submission_post_ms` for POST latency. A VU waits for the terminal verdict, so VU count is not the measured number of concurrent submissions.

To regenerate the report and audit:

```powershell
py -3.13 tests/chapter7_report.py
py -3.13 tests/chapter7_audit.py
```

All evidence is under `results/chapter7/`, which is ignored by Git. `config.json` and `summary.json` live in each run directory. `submissions.csv`, `verdicts.csv`, `events.csv`, Worker timings and logs provide the underlying evidence. `07-tables/manifest.json` maps each output to its sources. A timeout can still create a DB row; always reconcile by the `run_id` marker before reporting accepted counts.
