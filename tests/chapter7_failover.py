"""Controlled Worker interruption and Master restart in the local Compose stack."""
import csv
import json
import os
import pathlib
import subprocess
import time
import uuid
from datetime import datetime, timezone

import requests

from chapter7_experiment import OUT, BASE, SOURCES, command, db, event_details, mark, query, safe_log, submit, token, wait_terminal, worker_ids, write_csv
from chapter7_scaling import wait_no_active, wait_workers


def new_run(name):
    rid = datetime.now().strftime('%Y%m%dT%H%M%S')+'-'+name+'-'+uuid.uuid4().hex[:6]
    folder = OUT/'05-failover'/rid
    folder.mkdir(parents=True)
    return rid, folder


def ids_by_marker(conn, rid):
    return [x[0] for x in query(conn, 'select id from submissions where source_code like %s order by id',
                                ('// chapter7 run_id='+rid+'%',))]


def wait_assigned(conn, ids, timeout=20):
    deadline = time.monotonic()+timeout
    while time.monotonic()<deadline:
        rows = query(conn, "select submission_id,worker_id from submission_events where submission_id = any(%s) and event='ASSIGNED' order by created_at", (ids,))
        if rows:
            return rows[0]
        time.sleep(.05)
    raise RuntimeError('No ASSIGNED event before timeout')


def save(folder, rid, ids, before, started_at, outcome):
    with db() as conn:
        after_subs, after_events = event_details(conn, ids)
    write_csv(folder/'events_before.csv', before, ['submission_id','event','time','worker_id','attempt','note'])
    write_csv(folder/'events_after.csv', after_events, ['submission_id','event','time','worker_id','attempt','note'])
    write_csv(folder/'submissions.csv', [dict(run_id=rid, **v) for v in after_subs.values()],
              ['run_id','submission_id','status','verdict','worker_id','attempts','created_at','started_at','finished_at','time_ms','memory_kb'])
    (folder/'backend.log').write_text(safe_log(command('docker','compose','logs','--no-color','--since',started_at,'backend')),encoding='utf-8')
    (folder/'worker.log').write_text(safe_log(command('docker','compose','logs','--no-color','--since',started_at,'worker')),encoding='utf-8')
    (folder/'summary.json').write_text(json.dumps(outcome,indent=2,ensure_ascii=False),encoding='utf-8')
    print(json.dumps(outcome,ensure_ascii=False),flush=True)


def worker_failure():
    wait_no_active()
    wait_workers(2)
    rid, folder = new_run('worker-failure')
    start = datetime.now(timezone.utc).isoformat()
    with db() as conn:
        workers = worker_ids(conn)
    (folder/'config.json').write_text(json.dumps({'run_id':rid,'started_at':start,'workers':workers,
             'test':'worker failure','source':'TLE'},indent=2),encoding='utf-8')
    session=requests.Session()
    session.headers.update({'Authorization':'Bearer '+token()})
    row=submit(session,SOURCES['TLE'],rid)
    if not row['submission_id']:
        raise RuntimeError('Worker failure submission not accepted')
    sid=row['submission_id']
    with db() as conn:
        assigned=wait_assigned(conn,[sid])
        _, before=event_details(conn,[sid])
    wid=assigned[1]
    containers=command('docker','compose','ps','-q','worker').splitlines()
    target=next((cid for cid in containers if cid.startswith(wid)),None)
    if not target:
        raise RuntimeError('Assigned Worker container not found: '+wid)
    subprocess.run(['docker','stop',target],check=True,capture_output=True,text=True)
    with db() as conn:
        wait_terminal(conn,[sid],120)
    with db() as conn:
        sub, events=event_details(conn,[sid])
    names=[e['event'] for e in events]
    outcome={'run_id':rid,'scenario':'worker_failure','submission_id':sid,'killed_worker':wid,
             'status':sub[sid]['status'],'verdict':sub[sid]['verdict'],'attempts':sub[sid]['attempts'],
             'requeued':'REQUEUED' in names,'assigned_count':names.count('ASSIGNED'),
             'pass':sub[sid]['status']=='FINISHED' and 'REQUEUED' in names and names.count('ASSIGNED')>=2,
             'ended_at':datetime.now(timezone.utc).isoformat()}
    save(folder,rid,[sid],before,start,outcome)
    subprocess.run(['docker','start',target],check=True,capture_output=True,text=True)
    wait_workers(2)


def master_restart():
    wait_no_active()
    wait_workers(2)
    rid,folder=new_run('master-restart')
    start=datetime.now(timezone.utc).isoformat()
    with db() as conn:
        workers=worker_ids(conn)
    (folder/'config.json').write_text(json.dumps({'run_id':rid,'started_at':start,'workers':workers,
            'test':'master restart','source':'TLE','count':10},indent=2),encoding='utf-8')
    session=requests.Session()
    session.headers.update({'Authorization':'Bearer '+token()})
    rows=[submit(session,SOURCES['TLE'],rid) for _ in range(10)]
    ids=[r['submission_id'] for r in rows if r['submission_id']]
    if len(ids)!=10:
        raise RuntimeError('Master restart test did not accept all 10 submissions')
    with db() as conn:
        assigned=wait_assigned(conn,ids)
        _,before=event_details(conn,ids)
        pending=query(conn,"select count(*) from submissions where id = any(%s) and status='IN_QUEUE'",(ids,))[0][0]
    subprocess.run(['docker','compose','restart','backend'],check=True,capture_output=True,text=True)
    with db() as conn:
        wait_terminal(conn,ids,180)
    with db() as conn:
        subs,events=event_details(conn,ids)
    outcome={'run_id':rid,'scenario':'master_restart','submission_ids':ids,
             'in_queue_before_restart':pending,'assigned_before_restart':assigned[0],
             'finished':sum(v['status']=='FINISHED' for v in subs.values()),
             'failed':sum(v['status']=='FAILED' for v in subs.values()),
             'unresolved':sum(v['status'] not in ('FINISHED','FAILED') for v in subs.values()),
             'pass':len(subs)==10 and all(v['status']=='FINISHED' for v in subs.values()),
             'ended_at':datetime.now(timezone.utc).isoformat()}
    save(folder,rid,ids,before,start,outcome)


if __name__=='__main__':
    worker_failure()
    master_restart()
