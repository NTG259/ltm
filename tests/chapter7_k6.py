"""Run the checked-in k6 scenarios on the isolated local Compose network."""
import csv
import json
import os
import pathlib
import re
import subprocess
import time
import uuid
from datetime import datetime, timezone

from chapter7_experiment import OUT, command, db, event_details, peak_concurrency, query, queue_waits, summary_stats, token, wait_terminal, worker_ids, write_csv
from chapter7_scaling import wait_no_active


def run_k6(vus,count,script,observe_s=300):
    wait_no_active()
    rid=datetime.now().strftime('%Y%m%dT%H%M%S')+'-k6-'+uuid.uuid4().hex[:6]
    folder=OUT/'03-load'/rid
    folder.mkdir(parents=True)
    start=datetime.now(timezone.utc).isoformat()
    with db() as conn:
        workers=worker_ids(conn)
    cfg={'run_id':rid,'kind':'k6','started_at':start,'vus':vus,'iterations':count,
         'registered_workers':workers,'script':script,'observation_s':observe_s,
         'git_commit':command('git','rev-parse','HEAD'),'go_judge_parallelism':4}
    (folder/'config.json').write_text(json.dumps(cfg,indent=2),encoding='utf-8')
    env=os.environ.copy()
    env.update({'K6_TOKEN':token(),'RUN_ID':rid,'BASE_URL':'http://backend:8000',
                'VUS':str(vus),'ITERATIONS':str(count),'OBSERVE_MS':str(observe_s*1000)})
    cmd=['docker','run','--rm','--network','codejudge_default',
         '-e','K6_TOKEN','-e','RUN_ID','-e','BASE_URL','-e','VUS','-e','ITERATIONS','-e','OBSERVE_MS',
         '-v',str((OUT.parent.parent/'tests'/'k6').resolve())+':/scripts:ro',
         '-v',str(folder.resolve())+':/results',
         'grafana/k6:latest','run','--out','csv=/results/k6.csv','--summary-export','/results/k6_summary.json',
         '/scripts/'+script]
    with (folder/'k6-console.log').open('w',encoding='utf-8') as log:
        result=subprocess.run(cmd,env=env,stdout=log,stderr=subprocess.STDOUT,text=True)
    # The console log contains IDs only, not the token or password.
    api_ids=[int(x) for x in re.findall(r'CHAPTER7_SUBMISSION '+re.escape(rid)+r' (\d+)',
                                         (folder/'k6-console.log').read_text(encoding='utf-8',errors='replace'))]
    with db() as conn:
        db_ids=[x[0] for x in query(conn,'select id from submissions where source_code like %s order by id',
                                    ('// chapter7 run_id='+rid+'%',))]
        wait_terminal(conn,db_ids,observe_s)
        subs,events=event_details(conn,db_ids)
    write_csv(folder/'submissions.csv',[{'run_id':rid,'submission_id':sid,'api_id_observed':sid in api_ids,
                                         'status':s['status'],'verdict':s['verdict']} for sid,s in subs.items()],
              ['run_id','submission_id','api_id_observed','status','verdict'])
    write_csv(folder/'events.csv',events,['submission_id','event','time','worker_id','attempt','note'])
    write_csv(folder/'verdicts.csv',[dict(run_id=rid,**s) for s in subs.values()],
              ['run_id','submission_id','status','verdict','worker_id','attempts','created_at','started_at','finished_at','time_ms','memory_kb'])
    metrics=json.loads((folder/'k6_summary.json').read_text(encoding='utf-8')).get('metrics',{}) if (folder/'k6_summary.json').exists() else {}
    post_metric=metrics.get('submission_post_ms',{})
    posts=metrics.get('http_reqs',{}).get('count')
    accepted=len(api_ids)
    finished=sum(s['status']=='FINISHED' for s in subs.values())
    failed=sum(s['status']=='FAILED' for s in subs.values())
    end=datetime.now(timezone.utc).isoformat()
    summary={'run_id':rid,'kind':'k6','ended_at':end,'requests':count,'k6_http_requests_including_polls':posts,
             'api_ids_observed':accepted,'db_submission_count':len(db_ids),'db_only_ids':len(set(db_ids)-set(api_ids)),
             'finished':finished,'failed':failed,'unfinished_at_observation_end':len(db_ids)-finished-failed,
             'post_ms_k6':{'avg':post_metric.get('avg'),'p50':post_metric.get('med'),'p95':post_metric.get('p(95)')},
             'verdict_ms_db':summary_stats([(datetime.fromisoformat(s['finished_at'])-datetime.fromisoformat(s['created_at'])).total_seconds()*1000 for s in subs.values() if s['finished_at']]),
             'queue_wait_ms_db':summary_stats(queue_waits(subs,events)),'peak_concurrent_submissions':peak_concurrency(subs),
             'registered_workers':workers,'k6_exit_code':result.returncode}
    (folder/'summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
    print(json.dumps({'folder':str(folder),**summary},ensure_ascii=False),flush=True)


if __name__=='__main__':
    run_k6(5,10,'scenario_a_throughput.js')
    run_k6(20,100,'scenario_a_throughput.js')
    run_k6(200,1000,'scenario_1000.js')
