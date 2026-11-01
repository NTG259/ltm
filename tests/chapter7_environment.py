"""Capture local environment without credentials."""
import json
import os
import pathlib
import platform
import socket
from datetime import datetime, timezone

from chapter7_experiment import OUT, command, db, query

out=OUT/'01-environment'
out.mkdir(parents=True,exist_ok=True)
ports={}
for port in (18080,18000,18001,9000,5050):
    with socket.socket() as sock:
        sock.settimeout(1)
        ports[str(port)]=sock.connect_ex(('127.0.0.1',port))==0
with db() as conn:
    problem=query(conn,'select id,title,time_limit_ms,memory_limit_mb from problems where id=1')
    tests=query(conn,'select position,input,expected_output from test_cases where problem_id=1 order by position')
    workers=query(conn,"select id,status from workers where status in ('IDLE','BUSY') order by id")
data={'timestamp':datetime.now(timezone.utc).isoformat(),'git_commit':command('git','rev-parse','HEAD'),
      'host':platform.platform(),'host_logical_cpu':os.cpu_count(),
      'docker_logical_cpu':command('docker','info','--format','{{.NCPU}}'),
      'docker_memory_bytes':command('docker','info','--format','{{.MemTotal}}'),
      'ports_on_host':ports,'go_judge_parallelism':4,'go_judge_memory_limit':'4g',
      'problem_1':problem,'problem_1_testcases':tests,'workers_at_snapshot':workers}
(out/'environment.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
print('environment_saved')
