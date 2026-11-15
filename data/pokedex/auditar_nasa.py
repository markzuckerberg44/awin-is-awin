"""Verify archived numbers against live NASA responses; never replace the input series."""
import concurrent.futures
import datetime
import hashlib
import json
import math
import time
import urllib.request
from pathlib import Path
from descargar_nasa_extra import indicator

ROOT = Path(__file__).resolve().parent

def main():
    manifest = json.loads((ROOT/'manifest-nasa.json').read_text(encoding='utf-8'))
    extra = json.loads((ROOT/'nasa-power-extra-anual.json').read_text(encoding='utf-8'))
    catalog = json.loads((ROOT/'export/catalogo.json').read_text(encoding='utf-8'))
    jobs = []
    for src in manifest['sources']:
        jobs.append(dict(kind='base', location_id=src['location_id'], url=src['url'], source=src))
    for loc in catalog['locations']:
        if loc['id'] not in extra['series']:
            continue  # No additional indicators were downloaded or used at this location.
        url = extra['query_template'].format(lat=format(loc['latitude'],'g'),lon=format(loc['longitude'],'g'))
        jobs.append(dict(kind='extra', location_id=loc['id'], url=url))
    folder = ROOT/'nasa-power-extra'
    folder.mkdir(exist_ok=True)

    def check(job):
        lid, kind = job['location_id'], job['kind']
        try:
            for attempt in range(3):
                try:
                    with urllib.request.urlopen(job['url'],timeout=60) as r:
                        blob = r.read()
                    break
                except Exception:
                    if attempt == 2: raise
                    time.sleep(attempt+1)
            raw = json.loads(blob)
            params, fill = raw['properties']['parameter'], raw['header']['fill_value']
            checked, mismatch = 0, []
            if kind == 'base':
                old_blob = (ROOT/job['source']['path']).read_bytes()
                assert hashlib.sha256(old_blob).hexdigest()==job['source']['sha256']
                previous = json.loads(old_blob)['properties']['parameter']
                for var in ('T2M','RH2M','PRECTOTCORR'):
                    for year in range(1981,2026):
                        for month in range(1,13):
                            key = f'{year}{month:02}'
                            checked += 1
                            if not math.isclose(params[var][key], previous[var][key],abs_tol=1e-9):
                                mismatch.append(dict(variable=var,date=key,archived=previous[var][key],live=params[var][key]))
                old_hash = job['source']['sha256']
            else:
                for name, series in extra['series'][lid].items():
                    for year in range(1981,2026):
                        current, previous = indicator(params,name,year,fill), series[str(year)]
                        checked += 1
                        if (current is None)!=(previous is None) or (current is not None and not math.isclose(current,previous,abs_tol=1e-4)):
                            mismatch.append(dict(variable=name,year=year,archived=previous,live=current))
                old_hash = extra['raw_response_sha256'][lid]
                # Keep the full response that supports the independent recalculation.
                (folder/(lid+'.json')).write_bytes(blob)
            result = dict(kind=kind,location_id=lid,url=job['url'],checked_values=checked,
                          numeric_match=not mismatch,differences=mismatch,archived_response_sha256=old_hash,
                          live_response_sha256=hashlib.sha256(blob).hexdigest(),
                          exact_response_bytes_match=hashlib.sha256(blob).hexdigest()==old_hash,
                          parameters=raw['parameters'],header=raw['header'])
        except Exception as e:
            result = dict(kind=kind,location_id=lid,url=job['url'],numeric_match=False,error=str(e))
        print(kind, lid, 'OK' if result['numeric_match'] else 'REVIEW',flush=True)
        return result

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(check,jobs))
    report = dict(checked_at_utc=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                  provider='NASA POWER',period=[1981,2025],requests=len(results),
                  all_numeric_values_match=all(r['numeric_match'] for r in results),
                  checked_values=sum(r.get('checked_values',0) for r in results),
                  note='Live response hashes may differ because request headers contain generation metadata. Numerical equality is tested separately. Input series were not overwritten.',
                  results=results)
    (ROOT/'auditoria-nasa.json').write_text(json.dumps(report,ensure_ascii=False,indent=2,allow_nan=False),encoding='utf-8',newline='\n')
    print('RESULT',report['all_numeric_values_match'],report['checked_values'])
    if not report['all_numeric_values_match']: raise SystemExit(1)

if __name__=='__main__': main()
