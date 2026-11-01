"""Rebuild run totals from PostgreSQL and a source-code run marker."""
import csv
import json
import pathlib
import re
import sys
from datetime import datetime

from chapter7_experiment import db, event_details, peak_concurrency, percentile, query, queue_waits, summary_stats, write_csv


def reconcile(folder):
    folder = pathlib.Path(folder)
    config = json.loads((folder / 'config.json').read_text(encoding='utf-8'))
    run_id = config['run_id']
    with (folder / 'submissions.csv').open(encoding='utf-8-sig', newline='') as f:
        requests = list(csv.DictReader(f))
    api_ids = {int(row['submission_id']) for row in requests if row['submission_id']}
    with db() as conn:
        rows = query(conn, "select id from submissions where source_code like %s order by id",
                     ('// chapter7 run_id=' + run_id + '%',))
        ids = [row[0] for row in rows]
        submissions, events = event_details(conn, ids)
        if len(ids) != len(set(ids)):
            raise RuntimeError('Duplicate database IDs')
        write_csv(folder / 'db_only_submissions.csv',
                  [dict(run_id=run_id, **submissions[sid]) for sid in ids if sid not in api_ids],
                  ['run_id','submission_id','status','verdict','worker_id','attempts','created_at','started_at','finished_at','time_ms','memory_kb'])
        write_csv(folder / 'verdicts.csv', [dict(run_id=run_id, **v) for v in submissions.values()],
                  ['run_id','submission_id','status','verdict','worker_id','attempts','created_at','started_at','finished_at','time_ms','memory_kb'])
        write_csv(folder / 'events.csv', events, ['submission_id','event','time','worker_id','attempt','note'])
        old = json.loads((folder / 'summary.json').read_text(encoding='utf-8'))
        if not (folder / 'summary_initial.json').exists():
            (folder / 'summary_initial.json').write_text(json.dumps(old, indent=2, ensure_ascii=False), encoding='utf-8')
        starts = [float(r['request_at']) for r in requests]
        ends = [datetime.fromisoformat(v['finished_at']).timestamp() for v in submissions.values() if v['finished_at']]
        finished = [v for v in submissions.values() if v['status'] == 'FINISHED']
        failed = [v for v in submissions.values() if v['status'] == 'FAILED']
        verdict_ms = [(datetime.fromisoformat(v['finished_at'])-datetime.fromisoformat(v['created_at'])).total_seconds()*1000
                      for v in submissions.values() if v['finished_at']]
        waits = queue_waits(submissions, events)
        duration = max(ends or starts)-min(starts)
        observation_end = datetime.fromisoformat(old['ended_at'])
        finished_by_observation = sum(v['status']=='FINISHED' and v['finished_at'] and
                                  datetime.fromisoformat(v['finished_at']) <= observation_end for v in submissions.values())
        failed_by_observation = sum(v['status']=='FAILED' and v['finished_at'] and
                                datetime.fromisoformat(v['finished_at']) <= observation_end for v in submissions.values())
        old.update({'db_submission_count': len(ids), 'db_only_ids': len(set(ids)-api_ids),
                    'unique_submission_ids': len(api_ids), 'finished': len(finished), 'failed': len(failed),
                    'finished_at_observation_end': finished_by_observation,
                    'failed_at_observation_end': failed_by_observation,
                    'unfinished_at_observation_end': len(ids)-finished_by_observation-failed_by_observation,
                    'unresolved_after_recovery': len(ids)-len(finished)-len(failed),
                    'verdict_ms': summary_stats(verdict_ms), 'queue_wait_ms': summary_stats(waits),
                    'queue_wait_attempts': len(waits), 'peak_concurrent_submissions': peak_concurrency(submissions),
                    'duration_s': round(duration,3),
                    'observed_duration_s': round(observation_end.timestamp()-min(starts),3),
                    'observed_throughput_per_s': round(finished_by_observation/(observation_end.timestamp()-min(starts)),4),
                    'completion_throughput_per_s': round(len(finished)/duration,4) if duration>0 else None,
                    'reconciled_at': datetime.now().astimezone().isoformat()})
        (folder / 'summary.json').write_text(json.dumps(old, indent=2, ensure_ascii=False), encoding='utf-8')
        # Direct Worker measurements; never infer from go-judge per-test CPU time.
        samples = []
        log_text=(folder / 'worker.log').read_text(encoding='utf-8', errors='replace') if (folder / 'worker.log').exists() else ''
        for line in log_text.splitlines():
            match = re.search(r'Task #(\d+) (compile_ms|execution_ms)=([\d.]+)', line)
            if match and int(match.group(1)) in submissions:
                samples.append({'run_id':run_id,'submission_id':int(match.group(1)),
                                'metric':match.group(2),'milliseconds':float(match.group(3))})
        write_csv(folder / 'worker_timings.csv', samples, ['run_id','submission_id','metric','milliseconds'])
        return {k:old[k] for k in ('run_id','requests','http_200','http_failed','db_submission_count','db_only_ids','finished','failed','unfinished_at_observation_end','peak_concurrent_submissions')}


if __name__ == '__main__':
    print(json.dumps(reconcile(sys.argv[1]), ensure_ascii=False))
