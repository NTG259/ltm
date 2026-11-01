"""Export Prometheus time series for a measured k6 run and render a grayscale chart."""
import csv
import json
import pathlib
import sys
from datetime import datetime, timezone

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import requests

from chapter7_experiment import OUT, write_csv


def export(folder):
    folder=pathlib.Path(folder)
    cfg=json.loads((folder/'config.json').read_text(encoding='utf-8'))
    summary=json.loads((folder/'summary.json').read_text(encoding='utf-8'))
    start=datetime.fromisoformat(cfg['started_at']).timestamp()
    if cfg.get('kind')=='k6' and (folder/'k6_summary.json').exists():
        iterations=json.loads((folder/'k6_summary.json').read_text(encoding='utf-8'))['metrics']['iterations']
        end=start+iterations['count']/iterations['rate']
    else:
        end=datetime.fromisoformat(summary['ended_at']).timestamp()
    expressions={'active':'codejudge_submissions_active',
                 'queued':'codejudge_submissions_queued',
                 'throughput_per_s':'rate(codejudge_submissions_finished_total[30s])'}
    rows=[]
    for label,expr in expressions.items():
        response=requests.get('http://127.0.0.1:19090/api/v1/query_range',
            params={'query':expr,'start':start,'end':end,'step':'5s'},timeout=30)
        response.raise_for_status()
        result=response.json()['data']['result']
        if not result: continue
        for t,v in result[0]['values']:
            if v not in ('NaN','+Inf','-Inf'):
                rows.append({'run_id':cfg['run_id'],'metric':label,
                    'timestamp_utc':datetime.fromtimestamp(float(t),timezone.utc).isoformat(),
                    'seconds_from_start':round(float(t)-start,3),'value':float(v)})
    write_csv(folder/'prometheus_metrics.csv',rows,
              ['run_id','metric','timestamp_utc','seconds_from_start','value'])
    fig,axes=plt.subplots(2,1,figsize=(9,5.5),sharex=True)
    for metric,color,style in [('active','black','-'),('queued','#888888','--')]:
        subset=[r for r in rows if r['metric']==metric]
        axes[0].plot([r['seconds_from_start'] for r in subset],[r['value'] for r in subset],
                     color=color,linestyle=style,label=metric)
    axes[0].set_ylabel('Submissions'); axes[0].legend(); axes[0].grid(axis='y',color='#ddd')
    subset=[r for r in rows if r['metric']=='throughput_per_s']
    axes[1].plot([r['seconds_from_start'] for r in subset],[r['value'] for r in subset],color='black')
    axes[1].set_ylabel('Finished submissions/s'); axes[1].set_xlabel('Seconds from run start')
    axes[1].grid(axis='y',color='#ddd')
    fig.suptitle('Prometheus time series: '+cfg['run_id'])
    fig.tight_layout()
    output=OUT/'06-grafana'/'Hinh_7_3b_Throughput_Over_Time.png'
    fig.savefig(output,dpi=220,bbox_inches='tight',facecolor='white')
    plt.close(fig)
    print(json.dumps({'rows':len(rows),'figure':str(output)},ensure_ascii=False))


if __name__=='__main__': export(sys.argv[1])
