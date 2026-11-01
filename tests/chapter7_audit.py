"""Cross-check chapter 7 artifacts against PostgreSQL and detect credential leaks."""
import csv
import json
import pathlib
import re
from datetime import datetime

from PIL import Image

from chapter7_experiment import OUT, db, percentile, query, queue_waits

issues=[]
checked=[]
with db() as conn:
    for group in ('02-accuracy','03-load','04-worker-scaling','05-failover'):
        for folder in sorted((OUT/group).iterdir()):
            if not folder.is_dir() or not (folder/'summary.json').exists(): continue
            summary=json.loads((folder/'summary.json').read_text(encoding='utf-8'))
            rid=summary['run_id']
            ids=[x[0] for x in query(conn,'select id from submissions where source_code like %s',
                                      ('// chapter7 run_id='+rid+'%',))]
            expected=summary.get('db_submission_count',summary.get('unique_submission_ids',
                      len(summary.get('submission_ids',[])) if 'submission_ids' in summary else 1))
            if len(ids)!=expected: issues.append(f'{rid}: DB {len(ids)} != summary {expected}')
            if len(ids)!=len(set(ids)): issues.append(f'{rid}: duplicate DB IDs')
            if summary.get('kind')=='scaling' and len(summary['registered_workers']) not in (1,2,4):
                issues.append(f'{rid}: unexpected Worker count')
            if (folder/'verdicts.csv').exists() and summary.get('kind')!='k6':
                with (folder/'verdicts.csv').open(encoding='utf-8-sig',newline='') as f:
                    rows=list(csv.DictReader(f))
                values=[(datetime.fromisoformat(r['finished_at'])-datetime.fromisoformat(r['created_at'])).total_seconds()*1000
                        for r in rows if r['finished_at']]
                observed=summary.get('verdict_ms',{}).get('p95')
                if observed is not None and abs(percentile(values,.95)-observed)>.02:
                    issues.append(f'{rid}: verdict p95 mismatch')
            checked.append({'run_id':rid,'db_ids':len(ids),'expected_db_ids':expected})

manifest=json.loads((OUT/'07-tables'/'manifest.json').read_text(encoding='utf-8'))
for entry in manifest['figures']+manifest['tables']:
    path=OUT/entry['path']
    if not path.exists(): issues.append(f'missing artifact {entry["path"]}')
    for source in entry['source_files']:
        if not (OUT/source).exists(): issues.append(f'missing source {source}')
    if path.suffix.lower()=='.png':
        with Image.open(path) as img:
            if img.width<1200 or img.height<400: issues.append(f'undersized figure {entry["path"]}')

secret_pat=re.compile(r'\b[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\b|admin123|Bearer [A-Za-z0-9_-]{10,}|expected=[0-9a-f]{8}-',re.I)
for path in OUT.rglob('*'):
    if path.is_file() and path.suffix.lower() in ('.csv','.json','.log','.md'):
        if secret_pat.search(path.read_text(encoding='utf-8-sig',errors='replace')):
            issues.append(f'potential secret in {path.relative_to(OUT)}')

result={'checked_runs':len(checked),'runs':checked,'figures':len(manifest['figures']),
        'tables':len(manifest['tables']),'issues':issues,'pass':not issues}
path=OUT/'08-report'/'quality_audit.json'
path.write_text(json.dumps(result,indent=2,ensure_ascii=False),encoding='utf-8')
print(json.dumps({'checked_runs':len(checked),'issues':issues,'pass':not issues},ensure_ascii=False))
