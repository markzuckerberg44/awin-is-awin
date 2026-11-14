import concurrent.futures, hashlib, json, math, shutil, time, urllib.parse, urllib.request
from pathlib import Path
from seed import make,ROOT

def download(loc):
    raw=ROOT/'nasa-power';raw.mkdir(exist_ok=True)
    path=raw/(loc['id']+'.json')
    old=(ROOT.parent/'bramble-cay-melomys'/'nasa-power')/path.name
    params=dict(parameters='T2M,RH2M,PRECTOTCORR',community='AG',longitude=loc['longitude'],latitude=loc['latitude'],format='JSON',start=1981,end=2025)
    url='https://power.larc.nasa.gov/api/temporal/monthly/point?'+urllib.parse.urlencode(params)
    reused=False
    if not path.exists() and old.exists():shutil.copy2(old,path);reused=True
    if not path.exists():
        for attempt in range(4):
            try:
                with urllib.request.urlopen(url,timeout=60) as response: blob=response.read()
                d=json.loads(blob)
                assert 'parameter' in d['properties']
                path.write_bytes(blob);break
            except Exception:
                if attempt==3:raise
                time.sleep(2*(attempt+1))
    blob=path.read_bytes();d=json.loads(blob)
    for variable in ('T2M','RH2M','PRECTOTCORR'):
        for year in range(1981,2026):
            for month in range(1,13):
                value=d['properties']['parameter'][f'{variable}'][f'{year}{month:02}']
                assert math.isfinite(value) and value!=d['header']['fill_value'],(loc['id'],variable,year,month)
    print('OK '+loc['id'],flush=True)
    return dict(location_id=loc['id'],url=url,path='nasa-power/'+path.name,sha256=hashlib.sha256(blob).hexdigest(),header=d['header'],parameters=d['parameters'],retrieved_for_this_build=not reused)
if __name__=='__main__':
    catalog=make()
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool: sources=list(pool.map(download,catalog['locations']))
    (ROOT/'manifest-nasa.json').write_text(json.dumps(dict(analysis_date='2026-11-14',period=[1981,2025],sources=sources),ensure_ascii=False,indent=2),encoding='utf-8')
    print('Completed: '+str(len(sources))+' NASA responses.')

