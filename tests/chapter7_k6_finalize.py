"""Attach redacted logs, direct Worker timings and complete k6 counters."""
import json
import pathlib
import re
import subprocess

from chapter7_experiment import OUT, safe_log, write_csv


for folder in sorted((OUT/'03-load').glob('*-k6-*')):
    if not (folder/'summary.json').exists(): continue
    cfg=json.loads((folder/'config.json').read_text(encoding='utf-8'))
    summary=json.loads((folder/'summary.json').read_text(encoding='utf-8'))
    raw=json.loads((folder/'k6_summary.json').read_text(encoding='utf-8'))['metrics']
    summary['iterations_completed']=raw.get('iterations',{}).get('count',0)
    summary['post_errors_k6']=raw.get('submission_post_errors',{}).get('count',0)
    summary['finished_observed_by_k6']=raw.get('submission_finished',{}).get('count',0)
    summary['failed_observed_by_k6']=raw.get('submission_failed',{}).get('count',0)
    summary['terminal_timeouts_k6']=raw.get('submission_terminal_timeouts',{}).get('count',0)
    summary['http_200_with_id']=summary['api_ids_observed']
    summary['http_failed_or_no_id']=summary['post_errors_k6']
    (folder/'summary.json').write_text(json.dumps(summary,indent=2,ensure_ascii=False),encoding='utf-8')
    env=json.loads((OUT/'01-environment'/'environment.json').read_text(encoding='utf-8'))
    cfg['docker_logical_cpu']=env['docker_logical_cpu']
    cfg['docker_memory_bytes']=env['docker_memory_bytes']
    cfg['go_judge_memory_limit']=env['go_judge_memory_limit']
    (folder/'config.json').write_text(json.dumps(cfg,indent=2,ensure_ascii=False),encoding='utf-8')
    for service,name in [('backend','backend.log'),('worker','worker.log')]:
        cmd=['docker','compose','logs','--no-color','--since',cfg['started_at'],
             '--until',summary['ended_at'],service]
        result=subprocess.run(cmd,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=120)
        (folder/name).write_text(safe_log(result.stdout),encoding='utf-8')
    ids={int(row.split(',')[1]) for row in (folder/'submissions.csv').read_text(encoding='utf-8-sig').splitlines()[1:] if row.strip()}
    timings=[]
    for line in (folder/'worker.log').read_text(encoding='utf-8').splitlines():
        match=re.search(r'Task #(\d+) (compile_ms|execution_ms)=([\d.]+)',line)
        if match and int(match.group(1)) in ids:
            timings.append({'run_id':cfg['run_id'],'submission_id':int(match.group(1)),
                            'metric':match.group(2),'milliseconds':float(match.group(3))})
    write_csv(folder/'worker_timings.csv',timings,['run_id','submission_id','metric','milliseconds'])
    print(cfg['run_id'],'log_lines',len((folder/'backend.log').read_text(encoding='utf-8').splitlines()),
          'timing_samples',len(timings))
