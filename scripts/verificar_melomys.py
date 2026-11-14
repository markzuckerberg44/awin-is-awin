"""Checks de contrato, integridad y agregación independientes de la generación."""
import calendar
import hashlib
import json
import math
from pathlib import Path

BASE=Path(__file__).resolve().parents[1]/'data/bramble-cay-melomys'
SCENARIO_YEAR=2015
ARCHIVE_END=SCENARIO_YEAR-1
ARCHIVE_YEARS=ARCHIVE_END-1981+1
def read(name):
    return json.loads((BASE/name).read_text(encoding='utf-8'))
def close(a,b):
    assert math.isclose(a,b,rel_tol=1e-10,abs_tol=1e-8),(a,b)

annual=read('series-anuales.json')['records']
assert read('clima-mensual.json')['scenario_year']==SCENARIO_YEAR
assert read('ciclo-mensual.json')['period']==[1981,ARCHIVE_END]
trends=read('tendencias.json')['records']
cycles=read('ciclo-mensual.json')
monthly=read('clima-mensual.json')
assert len({(r['site_id'],r['year']) for r in annual})==180
assert len({(r['site_id'],r['variable'],r['period_id']) for r in trends})==24
assert len({(r['site_id'],r['month']) for r in cycles['records']})==48
for source in read('fuentes-analisis.json')['nasa_inputs']:
    assert hashlib.sha256((BASE/source['archived_file']).read_bytes()).hexdigest()==source['sha256']
for site in monthly['sites']:
    for year in range(1981,2026):
        rows=[r for r in site['series'] if r['month'].startswith(str(year))]
        assert len(rows)==12
        a=next(r for r in annual if r['site_id']==site['id'] and r['year']==year)
        days=[calendar.monthrange(year,int(r['month'][-2:]))[1] for r in rows]
        assert a['days_used']==(366 if calendar.isleap(year) else 365)
        close(a['PRECTOTCORR'],math.fsum(r['PRECTOTCORR']*d for r,d in zip(rows,days)))
        for v in ('T2M','RH2M'):
            close(a[v],math.fsum(r[v]*d for r,d in zip(rows,days))/sum(days))
    archive=[r for r in site['series'] if int(r['month'][:4])<=ARCHIVE_END]
    assert site[f'mean_1981_{ARCHIVE_END}']=={v:round(sum(r[v] for r in archive)/len(archive),3) for v in ('T2M','RH2M','PRECTOTCORR')}
    yearly=[r for r in annual if r['site_id']==site['id'] and r['year']<=ARCHIVE_END]
    typical=[r for r in cycles['records'] if r['site_id']==site['id']]
    close(sum(r['precipitation_mm_month'] for r in typical),sum(r['PRECTOTCORR'] for r in yearly)/ARCHIVE_YEARS)
for r in trends:
    assert r['n_years']==r['end_year']-r['start_year']+1
    assert r['end_year'] in (ARCHIVE_END,2025)
    assert r['period_id'] in (f'decision_{SCENARIO_YEAR}','revelacion')
    assert 0<=r['p_value']<=r['p_value_holm']<=1
    assert r['significant_005']==(r['p_value']<.05)
    assert r['significant_holm_005']==(r['p_value_holm']<.05)
    expected=('REAL ↑' if r['sen_slope_per_decade']>0 else 'REAL ↓') if r['significant_holm_005'] else 'NOT PROVEN'
    assert r['game_stamp']==expected
    close(r['trend_change_over_period'],r['sen_slope_per_decade']/10*(r['end_year']-r['start_year']))
for mode in ('monthly_rmse_vs_bramble','dry_months_rmse_vs_bramble'):
    candidates=[c for c in cycles['comparisons'] if c['site_id']!='bramble-cay']
    for var in ('T2M','RH2M','PRECTOTCORR'):
        assert min(candidates,key=lambda c:c[mode][var])['site_id']=='erub'
print('OK: source hashes, 180 annual rows, leap years, previous monthly JSON, 48 climatology rows, 24 trends, stamps and seasonal ranking.')
