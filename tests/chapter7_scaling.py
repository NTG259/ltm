"""Run 3 independent identical load trials for 1, 2 and 4 registered Workers."""
import json
import subprocess
import time

from chapter7_experiment import db, query, run, worker_ids


def wait_workers(target, timeout=90):
    deadline = time.monotonic()+timeout
    while time.monotonic()<deadline:
        with db() as conn:
            online = worker_ids(conn)
        if len(online)==target:
            return online
        time.sleep(2)
    raise RuntimeError(f'Expected {target} registered Workers; got {online}')


def wait_no_active(timeout=180):
    deadline = time.monotonic()+timeout
    while time.monotonic()<deadline:
        with db() as conn:
            count = query(conn, "select count(*) from submissions where status not in ('FINISHED','FAILED')")[0][0]
        if count==0:
            return
        time.sleep(2)
    raise RuntimeError(f'{count} pre-existing submissions still active; refusing overlapping run')


if __name__=='__main__':
    wait_no_active()
    for n in (1,2,4):
        subprocess.run(['docker','compose','up','-d','--no-deps','--scale',f'worker={n}','worker'],check=True)
        online = wait_workers(n)
        print(json.dumps({'workers':n,'registered_ids':online}),flush=True)
        for repeat in range(1,4):
            wait_no_active()
            print(json.dumps({'workers':n,'repeat':repeat,'state':'started'}),flush=True)
            run('scaling',20,60,180)
    print('SCALING_COMPLETE',flush=True)
