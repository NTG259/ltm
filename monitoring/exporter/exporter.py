"""Read-only PostgreSQL metrics for local Chapter 7 monitoring."""
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

import psycopg

SQL = {
    "codejudge_submissions_active": "select count(*) from submissions where status not in ('FINISHED','FAILED')",
    "codejudge_submissions_queued": "select count(*) from submissions where status='IN_QUEUE'",
    "codejudge_submissions_finished_total": "select count(*) from submissions where status='FINISHED'",
    "codejudge_submissions_failed_total": "select count(*) from submissions where status='FAILED'",
    "codejudge_workers_online": "select count(*) from workers where status in ('IDLE','BUSY')",
    "codejudge_workers_busy": "select count(*) from workers where status='BUSY'",
    "codejudge_verdict_p95_ms_5m": """select coalesce(percentile_cont(.95) within group
        (order by extract(epoch from finished_at-created_at)*1000),0)
        from submissions where finished_at > now()-interval '5 minutes' and status='FINISHED'""",
    "codejudge_verdict_p50_ms_5m": """select coalesce(percentile_cont(.5) within group
        (order by extract(epoch from finished_at-created_at)*1000),0)
        from submissions where finished_at > now()-interval '5 minutes' and status='FINISHED'""",
    "codejudge_queue_wait_p95_ms_5m": """select coalesce(percentile_cont(.95) within group
        (order by extract(epoch from e.created_at-coalesce(
          (select max(r.created_at) from submission_events r where r.submission_id=e.submission_id
           and r.event='REQUEUED' and r.created_at<e.created_at),s.created_at))*1000),0)
        from submission_events e join submissions s on s.id=e.submission_id
        where e.event='ASSIGNED' and e.created_at>now()-interval '5 minutes'""",
    "codejudge_queue_wait_p50_ms_5m": """select coalesce(percentile_cont(.5) within group
        (order by extract(epoch from e.created_at-coalesce(
          (select max(r.created_at) from submission_events r where r.submission_id=e.submission_id
           and r.event='REQUEUED' and r.created_at<e.created_at),s.created_at))*1000),0)
        from submission_events e join submissions s on s.id=e.submission_id
        where e.event='ASSIGNED' and e.created_at>now()-interval '5 minutes'""",
}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != '/metrics':
            self.send_response(404)
            self.end_headers()
            return
        try:
            with psycopg.connect(host=os.getenv('DB_HOST','db'), dbname=os.getenv('DB_NAME','codejudge'),
                                 user=os.getenv('DB_USERNAME','codejudge'), password=os.getenv('DB_PASSWORD','codejudge')) as conn:
                with conn.cursor() as cur:
                    lines = []
                    for name, sql in SQL.items():
                        cur.execute(sql)
                        value = cur.fetchone()[0]
                        lines.append(f'{name} {float(value):.6f}')
            body = ('\n'.join(lines)+'\n').encode()
            self.send_response(200)
            self.send_header('Content-Type','text/plain; version=0.0.4')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except Exception:
            self.send_response(503)
            self.end_headers()


HTTPServer(('0.0.0.0', 9100), Handler).serve_forever()
