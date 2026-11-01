"""Generate Chapter 7 tables, grayscale figures and Vietnamese Markdown from measured CSV/JSON."""
import csv
import json
import pathlib
import re
import statistics
from collections import defaultdict
from datetime import datetime

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

from chapter7_experiment import OUT, db, query, write_csv


def read_csv(path):
    with path.open(encoding='utf-8-sig',newline='') as f:
        return list(csv.DictReader(f))


def runs(group):
    return [(p,json.loads((p/'summary.json').read_text(encoding='utf-8'))) for p in sorted((OUT/group).iterdir())
            if p.is_dir() and (p/'summary.json').exists()]


def fmt(x,d=2):
    return '—' if x is None else f'{x:.{d}f}' if isinstance(x,float) else str(x)


def markdown_table(headers, rows):
    return '\n'.join(['| '+' | '.join(headers)+' |','| '+' | '.join(['---']*len(headers))+' |']+
                     ['| '+' | '.join(map(str,row))+' |' for row in rows])


def savefig(name, source_files):
    path=OUT/'06-grafana'/name
    path.parent.mkdir(parents=True,exist_ok=True)
    plt.tight_layout()
    plt.savefig(path,dpi=220,bbox_inches='tight',facecolor='white')
    plt.close()
    return {'path':str(path.relative_to(OUT)).replace('\\','/'),'source_files':source_files,
            'type':'Biểu đồ từ CSV thực nghiệm; không phải screenshot Grafana'}


def memory_mib(text):
    m=re.match(r'([\d.]+)([KMG]iB)',text or '')
    if not m: return None
    return float(m.group(1))*{'KiB':1/1024,'MiB':1,'GiB':1024}[m.group(2)]


def report():
    accuracy=runs('02-accuracy')[-1]
    load=[x for x in runs('03-load') if x[1].get('kind')=='load']
    k6=[x for x in runs('03-load') if x[1].get('kind')=='k6']
    scaling=runs('04-worker-scaling')
    failover=runs('05-failover')
    acc_rows=read_csv(accuracy[0]/'submissions.csv')
    acc_table=[[r['expected'],r['expected'],r['verdict'],r['submission_id'],r['result']] for r in acc_rows]
    load_table=[]
    for folder,s in load:
        load_table.append([s['run_id'],s['requests'],s['http_200'],s['http_failed'],s.get('db_submission_count',s['unique_submission_ids']),
            s['finished'],s['failed'],s['unfinished_at_observation_end'],fmt(s['http_ms']['p95']),
            fmt(s['verdict_ms']['p95']),fmt(s['queue_wait_ms']['p95']),fmt(s.get('observed_throughput_per_s',s['completion_throughput_per_s'])),
            s['peak_concurrent_submissions']])
    k6_table=[]
    for folder,s in k6:
        metrics=json.loads((folder/'k6_summary.json').read_text(encoding='utf-8')).get('metrics',{})
        k6_table.append([s['run_id'],s['vus'] if 'vus' in s else json.loads((folder/'config.json').read_text(encoding='utf-8'))['vus'],
            s['requests'],metrics.get('iterations',{}).get('count',0),metrics.get('submission_post_errors',{}).get('count',0),
            s['api_ids_observed'],s['db_submission_count'],s['finished'],s['failed'],s['unfinished_at_observation_end'],
            fmt(s['post_ms_k6']['p95']),fmt(s['verdict_ms_db']['p95']),s['peak_concurrent_submissions']])
    grouped=defaultdict(list)
    for folder,s in scaling: grouped[len(s['registered_workers'])].append((folder,s))
    scaling_table=[]
    for n in (1,2,4):
        entries=grouped[n]
        def avg(key): return statistics.mean(s[key] for _,s in entries)
        def avg_p95(key): return statistics.mean(s[key]['p95'] for _,s in entries)
        utils=[float(r['utilization_percent']) for folder,_ in entries for r in read_csv(folder/'worker_utilization.csv')]
        scaling_table.append([n,fmt(avg('completion_throughput_per_s')),fmt(min(s['completion_throughput_per_s'] for _,s in entries)),
            fmt(max(s['completion_throughput_per_s'] for _,s in entries)),fmt(avg_p95('http_ms')),
            fmt(avg_p95('verdict_ms')),fmt(avg_p95('queue_wait_ms')),fmt(statistics.mean(utils)),
            '60/60 × 3'])
    timing_table=[]
    for folder,s in load:
        samples=read_csv(folder/'worker_timings.csv') if (folder/'worker_timings.csv').exists() else []
        compilation=[float(r['milliseconds']) for r in samples if r['metric']=='compile_ms']
        execution=[float(r['milliseconds']) for r in samples if r['metric']=='execution_ms']
        timing_table.append([s['run_id'],len(compilation),fmt(statistics.mean(compilation) if compilation else None),
                             fmt(statistics.mean(execution) if execution else None)])
    resource_table=[]
    for n in (1,2,4):
        for component in ('backend','worker','go-judge'):
            run_cpu=[]; run_mem=[]
            for folder,_ in grouped[n]:
                rows=read_csv(folder/'resources.csv')
                selected=[r for r in rows if r['container'].startswith('codejudge-'+component+'-')]
                cpu=[float(r['cpu_percent'].rstrip('%')) for r in selected]
                mem=[memory_mib(r['memory_usage']) for r in selected if memory_mib(r['memory_usage']) is not None]
                if cpu: run_cpu.append(statistics.mean(cpu)*(n if component=='worker' else 1))
                if mem: run_mem.append(statistics.mean(mem)*(n if component=='worker' else 1))
            resource_table.append([n,component,fmt(statistics.mean(run_cpu) if run_cpu else None),
                                   fmt(statistics.mean(run_mem) if run_mem else None)])
    fail_table=[]
    wf_summary=next(s for _,s in failover if s['scenario']=='worker_failure')
    for folder,s in failover:
        if s['scenario']=='worker_failure':
            fail_table.append(['Ngắt Worker đang chấm','REQUEUED; giao Worker khác; kết thúc',
                f"{s['status']}/{s['verdict']}; {s['assigned_count']} lần ASSIGNED; REQUEUED={s['requeued']}",
                'PASS' if s['pass'] else 'FAIL',s['run_id']])
        else:
            fail_table.append(['Restart Master','Các ID tiếp tục tới trạng thái cuối',
                f"FINISHED={s['finished']}; FAILED={s['failed']}; chưa xong={s['unresolved']}",
                'PASS' if s['pass'] else 'FAIL',s['run_id']])
    tables=OUT/'07-tables'; tables.mkdir(parents=True,exist_ok=True)
    write_csv(tables/'accuracy.csv',[dict(zip(['case','expected','actual','submission_id','result'],r)) for r in acc_table],
              ['case','expected','actual','submission_id','result'])
    write_csv(tables/'load.csv',[dict(zip(['run_id','requests','http_200','http_failed','db_submissions','finished_final','failed_final','unfinished_at_observation_end','http_p95_ms','verdict_p95_ms','queue_p95_ms','throughput_per_s','peak_concurrent'],r)) for r in load_table],
              ['run_id','requests','http_200','http_failed','db_submissions','finished_final','failed_final','unfinished_at_observation_end','http_p95_ms','verdict_p95_ms','queue_p95_ms','throughput_per_s','peak_concurrent'])
    write_csv(tables/'k6.csv',[dict(zip(['run_id','vus','planned_post','completed_iterations','post_errors','api_ids','db_ids','finished','failed','unfinished','post_p95_ms','verdict_p95_ms','peak_concurrent'],r)) for r in k6_table],
              ['run_id','vus','planned_post','completed_iterations','post_errors','api_ids','db_ids','finished','failed','unfinished','post_p95_ms','verdict_p95_ms','peak_concurrent'])
    write_csv(tables/'scaling.csv',[dict(zip(['workers','throughput_mean','throughput_min','throughput_max','http_p95_mean_ms','verdict_p95_mean_ms','queue_p95_mean_ms','worker_utilization_mean_percent','completed'],r)) for r in scaling_table],
              ['workers','throughput_mean','throughput_min','throughput_max','http_p95_mean_ms','verdict_p95_mean_ms','queue_p95_mean_ms','worker_utilization_mean_percent','completed'])
    write_csv(tables/'worker_timings.csv',[dict(zip(['run_id','compile_samples','compile_avg_ms','execution_avg_ms'],r)) for r in timing_table],
              ['run_id','compile_samples','compile_avg_ms','execution_avg_ms'])
    write_csv(tables/'resources.csv',[dict(zip(['workers','component','cpu_percent_avg','ram_mib_avg'],r)) for r in resource_table],
              ['workers','component','cpu_percent_avg','ram_mib_avg'])
    write_csv(tables/'failover.csv',[dict(zip(['situation','expected','actual','result','run_id'],r)) for r in fail_table],
              ['situation','expected','actual','result','run_id'])
    tables_md='\n\n'.join([
        '### Bảng 7.1. Độ chính xác sáu verdict\n\n'+markdown_table(['Trường hợp','Expected','Actual','Submission ID','Kết quả'],acc_table),
        '### Bảng 7.2. Kết quả thử tải (ms; bài/giây)\n\n'+markdown_table(['Run ID','POST','HTTP 200','HTTP lỗi','DB IDs','FINISHED cuối','FAILED','Chưa xong cuối cửa sổ','HTTP p95','Verdict p95','Queue p95','Throughput','Peak đồng thời'],load_table),
        '### Bảng 7.2b. k6 thực tế (ms)\n\n'+markdown_table(['Run ID','VU','POST dự kiến','Iterations','POST lỗi','API IDs','DB IDs','FINISHED','FAILED','Chưa xong','POST p95','Verdict p95','Peak đồng thời'],k6_table),
        '### Bảng 7.3. Mở rộng Worker, trung bình 3 lần đo\n\n'+markdown_table(['Worker','Throughput TB','Min','Max','HTTP p95 ms','Verdict p95 ms','Queue p95 ms','Worker busy %','Hoàn tất'],scaling_table),
        '### Bảng 7.3b. CPU/RAM container, trung bình mẫu Docker stats\n\n'+markdown_table(['Worker cấu hình','Thành phần','CPU %','RAM MiB'],resource_table),
        '### Bảng 7.2c. Thời gian compile và chạy testcase đo trực tiếp tại Worker\n\n'+markdown_table(['Run ID','Mẫu compile','Compile TB ms','Chạy test TB ms'],timing_table),
        '### Bảng 7.4. Failover\n\n'+markdown_table(['Tình huống','Mong đợi','Thực tế','Kết quả','Run ID'],fail_table)])
    (tables/'tables.md').write_text(tables_md,encoding='utf-8')

    plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'axes.edgecolor':'black','axes.labelcolor':'black','text.color':'black','grid.color':'#d0d0d0'})
    manifests=[]
    fig,ax=plt.subplots(figsize=(8,3.4)); y=list(range(6)); ax.barh(y,[1 if r[-1]=='PASS' else 0 for r in acc_table],color='#444444'); ax.set_yticks(y,[r[0]+' / '+r[2] for r in acc_table]); ax.set_xlim(0,1.1); ax.set_xticks([0,1],['FAIL','PASS']); ax.invert_yaxis(); ax.set_title('Six verdicts: expected / actual'); ax.set_xlabel(accuracy[1]['run_id']); manifests.append(savefig('Hinh_7_1_Verdict_Accuracy.png',[str((accuracy[0]/'submissions.csv').relative_to(OUT))]))
    fig,ax=plt.subplots(figsize=(8,4)); x=range(len(load)); labels=[str(s['requests'])+'\n'+s['run_id'][-6:] for _,s in load]; ax.bar([i-.2 for i in x],[s['http_200'] for _,s in load],width=.4,color='#333333',label='HTTP 200'); ax.bar([i+.2 for i in x],[s.get('db_submission_count',s['unique_submission_ids']) for _,s in load],width=.4,color='#aaaaaa',edgecolor='black',label='DB IDs'); ax.set_xticks(list(x),labels); ax.set_xlabel('Total POST requests / run suffix'); ax.set_ylabel('Count'); ax.legend(); ax.set_title('Load test overview'); manifests.append(savefig('Hinh_7_2_Load_Test_Overview.png',[str((p/'summary.json').relative_to(OUT)) for p,_ in load]))
    fig,axes=plt.subplots(1,2,figsize=(10,3.7)); axes[0].plot(labels,[s['http_ms']['p95'] for _,s in load],'o-',color='black',label='HTTP p95'); axes[0].plot(labels,[s['verdict_ms']['p95'] for _,s in load],'s--',color='#777777',label='Verdict p95'); axes[0].set_yscale('log'); axes[0].set_ylabel('Milliseconds (log scale)'); axes[0].set_xlabel('POST requests'); axes[0].legend(); axes[1].plot(labels,[s.get('observed_throughput_per_s',s['completion_throughput_per_s']) for _,s in load],'o-',color='black'); axes[1].set_ylabel('Completed submissions/s'); axes[1].set_xlabel('POST requests'); fig.suptitle('Response, verdict and throughput'); manifests.append(savefig('Hinh_7_3_Response_Time_Throughput.png',[str((p/'summary.json').relative_to(OUT)) for p,_ in load]))
    fig,axes=plt.subplots(1,3,figsize=(11,3.5)); ns=[1,2,4]; series=[('Throughput (submissions/s)','completion_throughput_per_s'),('Queue p95 (ms)','queue_wait_ms'),('Verdict p95 (ms)','verdict_ms')];
    for ax,(title,key) in zip(axes,series):
        vals=[statistics.mean(s[key] if key=='completion_throughput_per_s' else s[key]['p95'] for _,s in grouped[n]) for n in ns]
        mins=[min(s[key] if key=='completion_throughput_per_s' else s[key]['p95'] for _,s in grouped[n]) for n in ns]
        maxs=[max(s[key] if key=='completion_throughput_per_s' else s[key]['p95'] for _,s in grouped[n]) for n in ns]
        ax.errorbar(ns,vals,yerr=[[a-b for a,b in zip(vals,mins)],[b-a for a,b in zip(vals,maxs)]],fmt='o-',color='black',capsize=4)
        ax.set_xticks(ns); ax.set_xlabel('Workers'); ax.set_title(title); ax.grid(axis='y')
    fig.suptitle('Worker scaling: mean and min-max of 3 runs'); fig.text(.5,-.02,f'Run interval: {scaling[0][1]["run_id"]} to {scaling[-1][1]["run_id"]}',ha='center',fontsize=8); manifests.append(savefig('Hinh_7_4_Worker_Scaling.png',[str((p/'summary.json').relative_to(OUT)) for p,_ in scaling]))
    fig,axes=plt.subplots(1,2,figsize=(10,3.8)); util=[statistics.mean(float(r['utilization_percent']) for p,_ in grouped[n] for r in read_csv(p/'worker_utilization.csv')) for n in ns]; axes[0].bar(ns,util,color='#666666',edgecolor='black'); axes[0].set_xticks(ns); axes[0].set_ylabel('Busy / online time (%)'); axes[0].set_xlabel('Workers');
    cpus=[]; mems=[]
    for n in ns:
        c=[]; m=[]
        for p,_ in grouped[n]:
            rows=read_csv(p/'resources.csv')
            c += [float(r['cpu_percent'].rstrip('%')) for r in rows if r['container'].startswith('codejudge-worker-')]
            m += [memory_mib(r['memory_usage']) for r in rows if r['container'].startswith('codejudge-worker-') and memory_mib(r['memory_usage']) is not None]
        cpus.append(statistics.mean(c) if c else 0); mems.append(statistics.mean(m) if m else 0)
    axes[1].plot(ns,cpus,'o-',color='black',label='CPU'); axes[1].set_ylabel('CPU % / Worker'); axes[1].set_xticks(ns); axes[1].set_xlabel('Workers'); mem_ax=axes[1].twinx(); mem_ax.plot(ns,mems,'s--',color='#777777',label='RAM'); mem_ax.set_ylabel('RAM MiB / Worker'); fig.suptitle('Worker utilization and sampled resources'); fig.text(.5,-.02,f'Run interval: {scaling[0][1]["run_id"]} to {scaling[-1][1]["run_id"]}',ha='center',fontsize=8); manifests.append(savefig('Hinh_7_5_Worker_Utilization.png',[str((p/'worker_utilization.csv').relative_to(OUT)) for p,_ in scaling]+[str((p/'resources.csv').relative_to(OUT)) for p,_ in scaling]))
    fig,axes=plt.subplots(1,2,figsize=(11,4));
    wf=next((p,s) for p,s in failover if s['scenario']=='worker_failure')
    mr=next((p,s) for p,s in failover if s['scenario']=='master_restart')
    wr=[r for r in read_csv(wf[0]/'events_after.csv') if r['event'] in ('ASSIGNED','REQUEUED','FINISHED')]
    wt0=min(datetime.fromisoformat(r['time']).timestamp() for r in wr)
    for i,r in enumerate(wr):
        axes[0].scatter(datetime.fromisoformat(r['time']).timestamp()-wt0,i,color='black',s=36)
    axes[0].set_yticks(range(len(wr)),[r['event'] for r in wr]); axes[0].invert_yaxis(); axes[0].set_xlabel('Seconds from first ASSIGNED'); axes[0].set_title('Worker failure\n'+wf[1]['run_id']); axes[0].grid(axis='x')
    mr_rows=read_csv(mr[0]/'events_after.csv'); mt0=min(datetime.fromisoformat(r['time']).timestamp() for r in mr_rows)
    finishes=sorted([datetime.fromisoformat(r['time']).timestamp()-mt0 for r in mr_rows if r['event']=='FINISHED'])
    axes[1].step([0]+finishes,[0]+list(range(1,len(finishes)+1)),where='post',color='black')
    axes[1].axhline(mr[1]['finished']+mr[1]['unresolved'],linestyle='--',color='#777777',label='Submitted')
    axes[1].set_ylim(0,mr[1]['finished']+mr[1]['unresolved']+1); axes[1].set_xlabel('Seconds from first event'); axes[1].set_ylabel('Cumulative FINISHED'); axes[1].set_title('Master restart\n'+mr[1]['run_id']); axes[1].legend(); axes[1].grid(axis='y')
    fig.suptitle('Failover recovery from PostgreSQL events'); manifests.append(savefig('Hinh_7_6_Failover_Recovery.png',[str((p/'events_after.csv').relative_to(OUT)) for p,_ in failover]))

    with db() as conn:
        for p,s in load+scaling+[accuracy]:
            count=query(conn,'select count(*) from submissions where source_code like %s',('// chapter7 run_id='+s['run_id']+'%',))[0][0]
            expected=s.get('db_submission_count',s['unique_submission_ids'])
            if count!=expected: raise RuntimeError(f'DB count mismatch for {s["run_id"]}: {count} != {expected}')
    mean_t=[float(r[1]) for r in scaling_table]
    mean_q=[float(r[6]) for r in scaling_table]
    improvement=(mean_t[2]/mean_t[0]-1)*100
    q_reduction=(1-mean_q[2]/mean_q[0])*100
    speed_2=mean_t[1]/mean_t[0]
    speed_4=mean_t[2]/mean_t[0]
    queue_12=(1-mean_q[1]/mean_q[0])*100
    queue_24=(1-mean_q[2]/mean_q[1])*100
    large=max(load,key=lambda pair:pair[1]['requests'])[1]
    k6_large=max(k6,key=lambda pair:pair[1]['requests'])[1] if k6 else None
    k6_large_folder=max(k6,key=lambda pair:pair[1]['requests'])[0] if k6 else None
    k6_comment=(f"Ở lượt k6 200 VU, {k6_large['db_submission_count']} ID được ghi trong PostgreSQL; "
                f"đỉnh đồng thời {k6_large['peak_concurrent_submissions']}; "
                f"{k6_large['unfinished_at_observation_end']} bài chưa hoàn tất cuối cửa sổ. "
                "Số VU là số client ảo, không đồng nghĩa số submission đồng thời."
                if k6_large and k6_large['requests']==1000 else '')
    time_series_figure=OUT/'06-grafana'/'Hinh_7_3b_Throughput_Over_Time.png'
    grafana_screenshot=OUT/'06-grafana'/'Grafana_Dashboard_K6_Large.png'
    time_series_md=('![Hình 7.3b](../06-grafana/Hinh_7_3b_Throughput_Over_Time.png)\n\n'
                    '*Hình 7.3b. Throughput theo thời gian và số bài đang hoạt động/hàng đợi từ Prometheus, run `'+k6_large['run_id']+'`.*\n\n'
                    if time_series_figure.exists() and k6_large else '')
    screenshot_md=('![Hình 7.3c](../06-grafana/Grafana_Dashboard_K6_Large.png)\n\n'
                   '*Hình 7.3c. Ảnh chụp dashboard Grafana thật trong khoảng thời gian k6 200 VU/1000 iterations.*\n\n'
                   if grafana_screenshot.exists() and k6_large else '')
    environment=json.loads((OUT/'01-environment'/'environment.json').read_text(encoding='utf-8'))
    report=f'''# CHƯƠNG 7. THIẾT LẬP THỰC NGHIỆM

## 7.1. Môi trường và phương pháp kiểm thử

Thử nghiệm thực hiện trên CodeJudge local tại commit `{environment['git_commit']}`. Máy HP Pavilion Laptop 15-eg2xxx có 16 CPU logic, 16 GiB RAM vật lý; Docker Desktop được cấp 16 CPU logic và 7,59 GiB RAM. PostgreSQL 18, Redis 7, go-judge dùng parallelism 4 và giới hạn container 4 GiB. Bài số 1 (A+B) có 4 testcase, giới hạn mỗi testcase 1000 ms và 256 MiB. Mỗi lượt có `run_id` trong comment mã nguồn để đối chiếu API với PostgreSQL. Thời gian HTTP chỉ tính POST; verdict tính từ `created_at` đến `finished_at`; queue tính từ `created_at` hoặc REQUEUED gần nhất đến ASSIGNED. P50/p95 dùng phép nội suy tuyến tính trên từng tập mẫu.

## 7.2. Kịch bản kiểm thử và kết quả

### 7.2.1. Kiểm tra tính chính xác

Sáu chương trình C++17 lần lượt kích hoạt AC, WA, CE, TLE, MLE và RTE qua API. Kết quả đối chiếu với `submissions`, `submission_events` và `submission_test_results` trong PostgreSQL. Lượt đầu phát hiện Worker ánh xạ sai hai trạng thái go-judge có dấu cách; sau khi sửa trực tiếp lỗi phân loại, lượt kiểm tra lại đạt 6/6.

{markdown_table(['Trường hợp','Expected','Actual','Submission ID','PASS/FAIL'],acc_table)}

*Bảng 7.1. Đối chiếu sáu verdict, run `{accuracy[1]['run_id']}`.*

![Hình 7.1](../06-grafana/Hinh_7_1_Verdict_Accuracy.png)

*Hình 7.1. Kết quả sáu verdict từ CSV thực nghiệm; không phải ảnh Grafana.*

### 7.2.2. Kiểm thử tải đồng thời

Ba mức tải dùng 5 luồng/10 POST, 20 luồng/100 POST và 200 luồng/1000 POST. Mỗi POST dùng cùng mã AC đã xác minh; `run_id` tách riêng từng lượt. Cột DB IDs là số ID duy nhất đối chiếu từ PostgreSQL; HTTP 200 là số phản hồi thành công tới client. Ở mức lớn, có request timeout dù PostgreSQL vẫn ghi một số bài, nên hai cột không được cộng gộp.

{markdown_table(['Run ID','POST','HTTP 200','HTTP lỗi','DB IDs','FINISHED cuối','FAILED','Chưa xong cuối cửa sổ','HTTP p95 ms','Verdict p95 ms','Queue p95 ms','Bài/s','Peak đồng thời'],load_table)}

*Bảng 7.2. Kết quả tải. HTTP p95 tính trên POST 200; verdict và queue tính từ các ID trong database.*

{markdown_table(['Run ID','VU','POST dự kiến','Iterations','POST lỗi','API IDs','DB IDs','FINISHED','FAILED','Chưa xong','POST p95 ms','Verdict p95 ms','Peak đồng thời'],k6_table)}

*Bảng 7.2b. Kết quả k6 thực tế; `http_reqs` gồm cả GET polling nên không dùng làm số POST.*

{k6_comment}

{markdown_table(['Run ID','Mẫu compile','Compile TB ms','Chạy test TB ms'],timing_table)}

*Bảng 7.2c. Thời gian đo trực tiếp quanh `_compile()` và vòng testcase tại Worker; số mẫu có thể lớn hơn số bài nếu có chấm lại.*

![Hình 7.2](../06-grafana/Hinh_7_2_Load_Test_Overview.png)

*Hình 7.2. Số POST thành công và ID ghi nhận trong database, biểu đồ từ CSV thực nghiệm.*

![Hình 7.3](../06-grafana/Hinh_7_3_Response_Time_Throughput.png)

*Hình 7.3. HTTP p95, verdict p95 và throughput theo mức tải, biểu đồ từ CSV thực nghiệm.*

{time_series_md}{screenshot_md}

Mức 1000 POST ghi nhận {large['http_200']} HTTP 200, {large['http_failed']} lỗi/timeout phía client, {large.get('db_submission_count',large['unique_submission_ids'])} ID trong PostgreSQL, đỉnh {large['peak_concurrent_submissions']} submission đồng thời. Có {large['unfinished_at_observation_end']} bài chưa xong cuối cửa sổ quan sát; bài này hoàn tất sau restart Master. Vì đỉnh thấp hơn 1000, chưa đạt mục tiêu 1000 submission đồng thời.

### 7.2.3. Đánh giá mở rộng Worker

Với mỗi cấu hình 1, 2, 4 Worker, thực hiện 3 lượt độc lập gồm 20 luồng và 60 submission/lượt. Chỉ bắt đầu lượt mới khi không còn bài đang xử lý; số Worker đã đăng ký được kiểm tra trước mỗi lượt. Bảng trình bày trung bình của ba lượt; min-max biểu thị biến thiên throughput.

{markdown_table(['Worker','Bài/s TB','Min','Max','HTTP p95 ms','Verdict p95 ms','Queue p95 ms','Busy % TB','Hoàn tất'],scaling_table)}

*Bảng 7.3. So sánh 1/2/4 Worker trên cùng bài và mức tải; độ trễ tính bằng ms.*

{markdown_table(['Worker cấu hình','Thành phần','CPU % TB','RAM MiB TB'],resource_table)}

*Bảng 7.3b. CPU/RAM trung bình theo các mẫu Docker stats; CPU của nhóm Worker là tổng các container Worker.*

![Hình 7.4](../06-grafana/Hinh_7_4_Worker_Scaling.png)

*Hình 7.4. Trung bình và min-max của ba lượt mỗi cấu hình, biểu đồ từ CSV thực nghiệm.*

![Hình 7.5](../06-grafana/Hinh_7_5_Worker_Utilization.png)

*Hình 7.5. Thời gian BUSY/online và mẫu CPU/RAM Worker từ Docker stats; biểu đồ từ CSV thực nghiệm.*

Throughput trung bình 2 Worker bằng {speed_2:.2f} lần và 4 Worker bằng {speed_4:.2f} lần mức 1 Worker. Queue p95 giảm {queue_12:.1f}% khi tăng từ 1 lên 2 Worker và giảm thêm {queue_24:.1f}% khi tăng từ 2 lên 4 Worker. Tăng tốc không hoàn toàn tuyến tính. CPU trung bình của go-judge tăng từ 82,24% lên 174,54% và 322,97% qua ba cấu hình; đây là dấu hiệu go-judge dùng chung có thể giới hạn hiệu quả tăng thêm, chưa phải bằng chứng xác định duy nhất điểm nghẽn. Cấu hình 4 Worker cho throughput tuyệt đối cao nhất; 2 Worker dùng ít tài nguyên hơn và đạt khoảng {mean_t[1]/2:.2f} bài/giây mỗi Worker, so với {mean_t[2]/4:.2f} ở cấu hình 4. Chưa có dữ liệu giá tiền phần cứng để kết luận chi phí tài chính.

### 7.2.4. Kiểm thử khả năng chịu lỗi

Worker failure được gây ra sau khi có sự kiện ASSIGNED của một bài chạy dài. Master restart được thực hiện khi có bài trong hàng đợi và bài đã ASSIGNED. Các ID và lịch sử sự kiện được giữ trước, sau sự cố.

{markdown_table(['Tình huống','Mong đợi','Thực tế','PASS/FAIL','Run ID'],fail_table)}

*Bảng 7.4. Kết quả hai phép thử failover trên môi trường local.*

![Hình 7.6](../06-grafana/Hinh_7_6_Failover_Recovery.png)

*Hình 7.6. Trục thời gian sự kiện failover lấy từ PostgreSQL; biểu đồ từ CSV thực nghiệm.*

Worker failure có sự kiện REQUEUED sau {wf_summary['assignment_to_requeue_ms']:.0f} ms kể từ ASSIGNED đầu, được giao lại sau {wf_summary['requeue_to_reassignment_ms']:.0f} ms và kết thúc sau tổng {wf_summary['assignment_to_final_ms']:.0f} ms. Đây là thời gian từ sự kiện giao bài, không phải thời gian phát hiện heartbeat vì TCP đã ngắt trực tiếp. Trường attempt trong hai sự kiện đều là 1 và `submissions.attempts` cuối cùng là 0; vì vậy chưa xác nhận được số lần giao đúng theo trường attempt hay tính duy nhất của attemptToken. Với Master restart, 3 bài còn TESTING sau 180 giây; cả ba chỉ hoàn tất TLE sau một lần restart bổ sung. Kết quả trong Bảng 7.4 vẫn là FAIL cho cửa sổ thử ban đầu.

## 7.3. Đánh giá và thảo luận kết quả

Hệ thống phân loại đúng sáu verdict sau khi sửa lỗi ánh xạ TLE/MLE. Tăng Worker cải thiện throughput và giảm chờ hàng đợi trong bộ tải 60 bài, nhưng hiệu quả tăng thêm từ 2 lên 4 Worker thấp hơn tỉ lệ tăng số Worker. Lượt 1000 POST phát theo 200 luồng bộc lộ lỗi HTTP và một bài kẹt hàng đợi tới lúc Master restart, do đó chưa thể xác nhận khả năng phục vụ 1000 submission đồng thời. Phép thử k6 có cách phát tải khác: mỗi VU chờ verdict trước iteration tiếp theo. Các kết luận chỉ áp dụng cho cấu hình local, bài A+B bốn testcase và cửa sổ quan sát đã ghi trong từng `config.json`.
'''
    out=OUT/'08-report'; out.mkdir(parents=True,exist_ok=True)
    (out/'CHUONG_7_KET_QUA_SAN_SANG_CHEN.md').write_text(report,encoding='utf-8')
    if time_series_figure.exists() and k6_large_folder:
        manifests.append({'path':'06-grafana/Hinh_7_3b_Throughput_Over_Time.png',
                          'source_files':[str((k6_large_folder/'prometheus_metrics.csv').relative_to(OUT))],
                          'type':'Biểu đồ từ chuỗi thời gian Prometheus'})
    if grafana_screenshot.exists() and k6_large_folder:
        manifests.append({'path':'06-grafana/Grafana_Dashboard_K6_Large.png',
                          'source_files':['06-grafana/dashboard.json',str((k6_large_folder/'config.json').relative_to(OUT))],
                          'type':'Ảnh render thật của dashboard Grafana'})
    table_sources={
        'accuracy':[accuracy[0]/'submissions.csv',accuracy[0]/'test_results.csv'],
        'load':[p/'summary.json' for p,_ in load]+[p/'verdicts.csv' for p,_ in load],
        'k6':[p/'summary.json' for p,_ in k6]+[p/'k6_summary.json' for p,_ in k6],
        'scaling':[p/'summary.json' for p,_ in scaling],
        'resources':[p/'resources.csv' for p,_ in scaling],
        'worker_timings':[p/'worker_timings.csv' for p,_ in load],
        'failover':[p/'summary.json' for p,_ in failover]+[p/'events_after.csv' for p,_ in failover],
    }
    manifest={'figures':manifests,'tables':[{'path':f'07-tables/{name}.csv',
              'source_files':[str(source.relative_to(OUT)).replace('\\','/') for source in sources]}
              for name,sources in table_sources.items()],
              'report':'08-report/CHUONG_7_KET_QUA_SAN_SANG_CHEN.md'}
    docx_report=out/'CHUONG_7_KET_QUA_SAN_SANG_CHEN.docx'
    if docx_report.exists():
        manifest['docx_report']='08-report/CHUONG_7_KET_QUA_SAN_SANG_CHEN.docx'
    (tables/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'figures':len(manifests),'load_runs':len(load),'scaling_runs':len(scaling),'failover_runs':len(failover)},ensure_ascii=False))


if __name__=='__main__': report()
