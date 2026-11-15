"""Construye SQLite y exportación JSON. No toca progreso.sqlite ni requiere red."""
import calendar, hashlib, json, math, sqlite3, os, warnings
from pathlib import Path
import numpy as np
import pymannkendall as mk
from scipy.stats import norm, theilslopes
from seed import ROOT
from fichas_numericas import build_numeric_cards
VARS=['T2M','RH2M','PRECTOTCORR']
# El juego ocurre en 2015: el archivo visible antes de decidir termina en 2014.
SCENARIO_YEAR=2015
ARCHIVE_END=SCENARIO_YEAR-1
ARCHIVE=f'archivo_1981_{ARCHIVE_END}'
PERIODS={ARCHIVE:(1981,ARCHIVE_END),'retrospectivo_1981_2025':(1981,2025)}

def jd(v):return json.dumps(v,ensure_ascii=False,allow_nan=False)
def analyze(x):
    x=np.asarray(x,float);original=mk.original_test(x)
    with warnings.catch_warnings():
        warnings.simplefilter('ignore',RuntimeWarning)
        hr=mk.hamed_rao_modification_test(x)
        sensitivity={str(lag):mk.hamed_rao_modification_test(x,lag=lag) for lag in [1,3]}
    valid=bool(np.isfinite(hr.var_s) and hr.var_s>0 and np.isfinite(hr.z))
    assert math.isclose(hr.slope,theilslopes(x,np.arange(len(x))).slope,abs_tol=1e-9)
    return dict(n=len(x),slope_per_decade=float(hr.slope*10),sen_intercept=float(hr.intercept),
                p_original=float(2*norm.sf(abs(original.z))),p_corrected=float(2*norm.sf(abs(hr.z))) if valid else None,
                corrected_test_valid=valid,invalid_reason=None if valid else 'Hamed–Rao with all lags gives a non-positive variance; no p-value is reported and no other method is silently substituted.',
                tau=float(hr.Tau),s=float(hr.s),z=float(hr.z) if valid else None,variance_factor=float(hr.var_s/original.var_s),
                method='Hamed–Rao 1998, all significant lags on detrended ranks',
                p_sensitivity={lag:float(2*norm.sf(abs(test.z))) if test.var_s>0 and np.isfinite(test.z) else None for lag,test in sensitivity.items()})

LOCAL_KEY={'t2m_mean','rh2m_mean','precip_annual','precip_dry_season'}
def build_key_variables(db,cat,series):
    """Variables clave por especie: definición en variables-clave.json; valores anuales 1981–2025.
    Temperatura, humedad y lluvia se calculan aquí desde las series mensuales; las demás vienen de
    nasa-power-extra-anual.json (descargar_nasa_extra.py)."""
    spec=json.loads((ROOT/'variables-clave.json').read_text(encoding='utf-8'))
    extra=json.loads((ROOT/'nasa-power-extra-anual.json').read_text(encoding='utf-8'))
    assert {s['id'] for s in cat['species']}==set(spec['species'])
    for iid,m in spec['indicators'].items():db.execute('INSERT INTO key_indicators VALUES (?,?,?,?,?)',(iid,m['label'],m['unit'],m['source'],m['aggregation']))
    for sid,s in spec['species'].items():
        assert len(s['variables'])>=1 and len(set(s['variables']))==len(s['variables'])
        for rank,iid in enumerate(s['variables'],1):db.execute('INSERT INTO species_key_variables VALUES (?,?,?)',(sid,rank,iid))
    values={};dry={}
    for lid,ser in series.items():
        monthly=ser['monthly'];cycle={m:sum(r['PRECTOTCORR'] for r in monthly if r['month']==m)/45 for m in range(1,13)}
        dry[lid]=sorted(sorted(cycle,key=lambda m:(cycle[m],m))[:4])
        for m in dry[lid]:db.execute('INSERT INTO dry_season VALUES (?,?)',(lid,m))
        v={k:{} for k in LOCAL_KEY}
        for a in ser['annual']:
            y=a['year'];v['t2m_mean'][y]=a['T2M'];v['rh2m_mean'][y]=a['RH2M'];v['precip_annual'][y]=a['PRECTOTCORR']
            v['precip_dry_season'][y]=sum(r['PRECTOTCORR'] for r in monthly if r['year']==y and r['month'] in dry[lid])
        for iid,per in extra['series'].get(lid,{}).items():v[iid]={int(y):x for y,x in per.items() if x is not None}
        values[lid]=v
        for iid,per in v.items():
            for y,x in per.items():db.execute('INSERT INTO key_indicator_values VALUES (?,?,?,?)',(lid,iid,y,x))
    return spec,values,dry
def build_survival_cards(db,key_spec):
    """Legacy ecological evidence, explicitly separate from numeric comparison cards."""
    cards=json.loads((ROOT/'requisitos-ecologicos.json').read_text(encoding='utf-8'))
    assert set(cards['species'])==set(key_spec['species'])
    for sid,card in cards['species'].items():
        reqs=card['requirements'];assert [r['rank'] for r in reqs]==[1,2,3]
        for r in reqs:
            assert r['status'] in cards['status_labels'] and r['sources'] and all(s['url'].startswith('https://') for s in r['sources'])
            assert r['nasa_proxy'] is None or r['nasa_proxy'] in key_spec['species'][sid]['variables']
            g=r['range'] or {}
            db.execute('INSERT INTO habitat_requirements VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',(sid,r['rank'],r['requirement'],r['category'],r['brief_value'],r['value'],g.get('min'),g.get('max'),g.get('unit'),r['status'],r['evidence'],r['nasa_proxy'],jd(r['sources'])))
    return cards
def survival_card(cards,sid):
    c=cards['species'][sid]
    return dict(requirements=[dict(r,status_label=cards['status_labels'][r['status']]) for r in c['requirements']],
                brief_claims_not_supported=c['brief_claims_not_supported'],use_rule=cards['use_rule'],review_date=cards['review_date'])
def key_card(spec,sid,dry,lids,values):
    s=spec['species'][sid]
    return dict(variables=[dict(id=i,rank=k,**spec['indicators'][i]) for k,i in enumerate(s['variables'],1)],
                brief_favorable_conditions=s['brief_favorable_conditions'],brief_ranges_validated=False,why_these_variables=s['rationale'],
                absolute_value_caution=s.get('absolute_value_caution'),
                rainfall_caution=spec['rainfall_caution'] if any(i.startswith('precip') for i in s['variables']) else None,
                dry_season_months={l:dry[l] for l in lids} if 'precip_dry_season' in s['variables'] else None,
                not_available={l:[i for i in s['variables'] if not values[l].get(i)] for l in lids if any(not values[l].get(i) for i in s['variables'])} or None,
                cloud_cover_starts=1984 if 'cloud_cover' in s['variables'] else None)
def main():
    cat=json.loads((ROOT/'catalogo-curado.json').read_text(encoding='utf-8'));manifest=json.loads((ROOT/'manifest-nasa.json').read_text(encoding='utf-8'))
    tmp=ROOT/'pokedex.build.sqlite'
    if tmp.exists():tmp.unlink()  # fixed build artifact; never delete player data
    db=sqlite3.connect(tmp);db.execute('PRAGMA foreign_keys=ON')
    db.executescript('''
    CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);
    CREATE TABLE sources(id TEXT PRIMARY KEY,title TEXT NOT NULL,url TEXT NOT NULL,accessed TEXT NOT NULL,sha256 TEXT);
    CREATE TABLE locations(id TEXT PRIMARY KEY,name TEXT NOT NULL,latitude REAL NOT NULL CHECK(latitude BETWEEN -90 AND 90),longitude REAL NOT NULL CHECK(longitude BETWEEN -180 AND 180),coordinate_basis TEXT NOT NULL,nasa_source_id TEXT REFERENCES sources(id));
    CREATE TABLE species(id TEXT PRIMARY KEY,number INTEGER NOT NULL UNIQUE,scientific_name TEXT NOT NULL UNIQUE,name TEXT NOT NULL,taxonomic_rank TEXT NOT NULL,status TEXT NOT NULL,system TEXT NOT NULL,reference_location TEXT NOT NULL REFERENCES locations(id),payload TEXT NOT NULL CHECK(json_valid(payload)));
    CREATE TABLE species_sources(species_id TEXT REFERENCES species(id),source_id TEXT REFERENCES sources(id),PRIMARY KEY(species_id,source_id));
    CREATE TABLE variables(id TEXT PRIMARY KEY,label TEXT,monthly_unit TEXT,annual_unit TEXT,medium TEXT);
    CREATE TABLE observations(location_id TEXT REFERENCES locations(id),date TEXT,frequency TEXT CHECK(frequency IN ('monthly','annual')),variable TEXT REFERENCES variables(id),value REAL NOT NULL,unit TEXT NOT NULL,source_id TEXT REFERENCES sources(id),PRIMARY KEY(location_id,date,frequency,variable));
    CREATE INDEX observations_lookup ON observations(location_id,variable,frequency,date);
    CREATE TABLE trends(location_id TEXT REFERENCES locations(id),variable TEXT REFERENCES variables(id),period TEXT,start_year INTEGER,end_year INTEGER,payload TEXT NOT NULL CHECK(json_valid(payload)),PRIMARY KEY(location_id,variable,period));
    CREATE TABLE climatology(location_id TEXT REFERENCES locations(id),month INTEGER CHECK(month BETWEEN 1 AND 12),variable TEXT REFERENCES variables(id),value REAL NOT NULL,unit TEXT NOT NULL,start_year INTEGER,end_year INTEGER,PRIMARY KEY(location_id,month,variable));
    CREATE TABLE scenarios(species_id TEXT PRIMARY KEY REFERENCES species(id),kind TEXT NOT NULL,payload TEXT NOT NULL CHECK(json_valid(payload)));
    CREATE TABLE scenario_locations(species_id TEXT REFERENCES scenarios(species_id),location_id TEXT REFERENCES locations(id),role TEXT CHECK(role IN ('reference','candidate')),PRIMARY KEY(species_id,location_id));
    CREATE TABLE key_indicators(id TEXT PRIMARY KEY,label TEXT NOT NULL,unit TEXT NOT NULL,source TEXT NOT NULL,aggregation TEXT NOT NULL);
    CREATE TABLE species_key_variables(species_id TEXT REFERENCES species(id),rank INTEGER CHECK(rank >= 1),indicator_id TEXT REFERENCES key_indicators(id),PRIMARY KEY(species_id,rank),UNIQUE(species_id,indicator_id));
    CREATE TABLE key_indicator_values(location_id TEXT REFERENCES locations(id),indicator_id TEXT REFERENCES key_indicators(id),year INTEGER CHECK(year BETWEEN 1981 AND 2025),value REAL NOT NULL,PRIMARY KEY(location_id,indicator_id,year));
    CREATE TABLE dry_season(location_id TEXT REFERENCES locations(id),month INTEGER CHECK(month BETWEEN 1 AND 12),PRIMARY KEY(location_id,month));
    CREATE TABLE habitat_requirements(species_id TEXT REFERENCES species(id),rank INTEGER CHECK(rank >= 1),requirement TEXT NOT NULL,category TEXT NOT NULL,brief_value TEXT NOT NULL,value TEXT NOT NULL,range_min REAL,range_max REAL,range_unit TEXT,status TEXT NOT NULL CHECK(status IN ('confirmed','corrected','partly_supported','no_published_data')),evidence TEXT NOT NULL,nasa_proxy TEXT REFERENCES key_indicators(id),sources TEXT NOT NULL CHECK(json_valid(sources)),PRIMARY KEY(species_id,rank));
    CREATE TABLE audit(pdf_row INTEGER PRIMARY KEY,species_id TEXT REFERENCES species(id),pdf_threshold_claim TEXT,disposition TEXT);
    ''')
    db.executemany('INSERT INTO metadata VALUES (?,?)',[('schema_version','2.0.0'),('review_date','2026-11-14'),('title','Biodiversity and climate: a collection of 15 species'),('climate_scope','NASA POWER: regional air climate, not water or microhabitat'),('scenario_year',str(SCENARIO_YEAR)),('archive_period',f'1981-{ARCHIVE_END}')])
    for src in cat['sources']:db.execute('INSERT INTO sources VALUES (?,?,?,?,NULL)',(src['id'],src['title'],src['url'],src['accessed']))
    varmeta={'T2M':('Air temperature at 2 m','°C','°C','air'),'RH2M':('Relative humidity at 2 m','%','%','air'),'PRECTOTCORR':('Precipitation','mm/month','mm/year','precipitation')}
    for v,meta in varmeta.items():db.execute('INSERT INTO variables VALUES (?,?,?,?,?)',(v,*meta))
    series={};climates={};stats={};scales={}
    for loc in cat['locations']:
        lid=loc['id'];src=next(s for s in manifest['sources'] if s['location_id']==lid)
        blob=(ROOT/src['path']).read_bytes();assert hashlib.sha256(blob).hexdigest()==src['sha256'];raw=json.loads(blob)
        ns='power:'+lid;db.execute('INSERT INTO sources VALUES (?,?,?,?,?)',(ns,'NASA POWER '+loc['name'],src['url'],manifest['analysis_date'],src['sha256']))
        db.execute('INSERT INTO locations VALUES (?,?,?,?,?,?)',(lid,loc['name'],loc['latitude'],loc['longitude'],loc['coordinate_basis'],ns))
        months=[];years=[]
        for y in range(1981,2026):
            yy=[]
            for m in range(1,13):
                days=calendar.monthrange(y,m)[1];r={'date':f'{y}-{m:02}','year':y,'month':m,'days':days}
                for v in VARS:
                    value=raw['properties']['parameter'][v][f'{y}{m:02}'];assert math.isfinite(value) and value!=raw['header']['fill_value']
                    r[v]=value*days if v=='PRECTOTCORR' else value
                    db.execute('INSERT INTO observations VALUES (?,?,?,?,?,?,?)',(lid,r['date'],'monthly',v,r[v],varmeta[v][1],ns))
                yy.append(r);months.append(r)
            a={'year':y}
            for v in VARS:
                a[v]=sum(r[v] for r in yy) if v=='PRECTOTCORR' else sum(r[v]*r['days'] for r in yy)/sum(r['days'] for r in yy)
                db.execute('INSERT INTO observations VALUES (?,?,?,?,?,?,?)',(lid,str(y),'annual',v,a[v],varmeta[v][2],ns))
            years.append(a)
        series[lid]={'monthly':months,'annual':years};climates[lid]={};scales[lid]={}
        for v in VARS:
            cycle=[float(np.mean([r[v] for r in months if r['year']<=ARCHIVE_END and r['month']==m])) for m in range(1,13)]
            climates[lid][v]=cycle;scales[lid][v]=float(np.std([r[v] for r in months if r['year']<=ARCHIVE_END],ddof=1))
            for m,value in enumerate(cycle,1):db.execute('INSERT INTO climatology VALUES (?,?,?,?,?,?,?)',(lid,m,v,value,varmeta[v][1],1981,ARCHIVE_END))
            for period,(start,end) in PERIODS.items():
                t=analyze([r[v] for r in years if start<=r['year']<=end]);t.update(start_year=start,end_year=end,unit=varmeta[v][2],slope_unit=varmeta[v][2]+'/decade')
                stats[(lid,v,period)]=t
                db.execute('INSERT INTO trends VALUES (?,?,?,?,?,?)',(lid,v,period,start,end,jd(t)))
    scenarios={}
    for sp in cat['species']:
        sid=sp['id'];ref=sp['reference_location']
        db.execute('INSERT INTO species VALUES (?,?,?,?,?,?,?,?,?)',(sid,sp['number'],sp['scientific_name'],sp['name'],sp['taxonomic_rank'],sp['status'],sp['system'],ref,jd(sp)))
        for source in sp['source_ids']:db.execute('INSERT INTO species_sources VALUES (?,?)',(sid,source))
        db.execute('INSERT INTO audit VALUES (?,?,?,?)',(sp['pdf_row'],sid,sp['pdf_threshold_claim'],'replacement' if sp['replacement_of'] else 'thresholds_not_validated'))
        if sp['system']=='terrestrial':
            candidates=[sp['analogue_candidate'],'funafuti','alice-springs']
            scores=[]
            for candidate in candidates:
                rmse={v:float(np.sqrt(np.mean((np.array(climates[candidate][v])-climates[ref][v])**2))) for v in VARS}
                normalized={v:rmse[v]/scales[ref][v] for v in VARS}
                scores.append(dict(location_id=candidate,rmse=rmse,normalized_rmse=normalized,score=float(np.mean(list(normalized.values())))))
            best=min(r['score'] for r in scores)
            accepted=[r['location_id'] for r in scores if math.isclose(r['score'],best,abs_tol=1e-8)]
            if sid=='melomys':assert accepted==['erub']
            scenario=dict(kind='climate_analogue_exercise',title='Which option best matches the regional climate cycle?',
                reference_location=ref,candidate_locations=candidates,accepted_answers=accepted,scores=scores,
                period=ARCHIVE,scenario_year=SCENARIO_YEAR,
                period_note=f'Educational recreation set in {SCENARIO_YEAR} with the 1981–{ARCHIVE_END} archive; it does not assume the species was still alive or that these data were available at the time.',
                question='Compare the 12 typical months of the three variables. Choose the candidate with the smallest standardized climate distance.',
                model_rule=f'Mean of the 12-month RMSE per variable divided by the reference site’s 1981–{ARCHIVE_END} monthly standard deviation; three equal weights. A teaching rule, not an ecological model.',
                feedback='The lowest index identifies the regional climate analogue among these three options. p-values test for trends, not suitability. Still needed: '+', '.join(sp['required_local_evidence'])+'.',
                limitations='The plots and management conditions are fictional. This is not a translocation recommendation or a survival prediction.',
                habitat_decision_validated=False,
                game_assumptions='To compare climate, all candidates are assumed to have otherwise equivalent and suitable conditions; this has not been checked in the field.',
                adjusted_tests={})
            for period in PERIODS:
                family=[]
                for lid in [ref]+candidates:
                    for v in VARS:family.append(dict(location_id=lid,variable=v,**stats[(lid,v,period)]))
                ordered=sorted(family,key=lambda r:r['p_corrected'] if r['p_corrected'] is not None else 1);last=0
                for idx,t in enumerate(ordered):
                    if t['p_corrected'] is None:
                        t['p_holm']=None;t['stamp']='NOT TESTABLE';continue
                    last=min(1,max(last,(len(ordered)-idx)*t['p_corrected']));t['p_holm']=last
                    t['stamp']=('REAL ↑' if t['slope_per_decade']>0 else 'REAL ↓') if last<.05 else 'NOT PROVEN'
                scenario['adjusted_tests'][period]=family
        else:
            water='sea and seabed temperature' if sp['system']=='marine' else 'spring water temperature'
            scenario=dict(kind='evidence_gap_exercise',title='What evidence is missing before comparing aquatic refuges?',
                reference_location=ref,candidate_locations=[],accepted_answers=['water_data'],period=ARCHIVE,scenario_year=SCENARIO_YEAR,
                question='We have air temperature, humidity and rainfall from NASA POWER. What would you do before deciding on the aquatic habitat?',
                choices=[dict(id='air_equals_water',label='Use air temperature as water temperature'),dict(id='lowest_p',label='Pick the site with the smallest p-value'),dict(id='water_data',label='Ask for water data series and habitat evidence')],
                feedback='Correct: still needed: '+', '.join(sp['required_local_evidence'])+'. Air temperature is not a substitute for '+water+'.',
                limitations='Complete species card and evidence exercise; there are not yet three aquatic refuge options or validated water series.',
                habitat_decision_validated=False)
        scenarios[sid]=scenario
        db.execute('INSERT INTO scenarios VALUES (?,?,?)',(sid,scenario['kind'],jd(scenario)))
        db.execute('INSERT INTO scenario_locations VALUES (?,?,?)',(sid,ref,'reference'))
        for lid in scenario['candidate_locations']:db.execute('INSERT INTO scenario_locations VALUES (?,?,?)',(sid,lid,'candidate'))
    assert db.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
    assert not db.execute('PRAGMA foreign_key_check').fetchall()
    key_spec,key_values,dry=build_key_variables(db,cat,series)
    survival=build_survival_cards(db,key_spec)
    numeric_cards=build_numeric_cards(db,ROOT,cat,key_spec,key_values,series,scenarios,ARCHIVE_END)
    assert not db.execute('PRAGMA foreign_key_check').fetchall()
    db.commit();counts={t:db.execute('SELECT COUNT(*) FROM '+t).fetchone()[0] for t in ['species','locations','observations','trends','climatology','scenarios','sources','key_indicator_values','survival_requirements','habitat_requirements','species_comparison_values']};db.close();os.replace(tmp,ROOT/'pokedex.sqlite')
    export=ROOT/'export';export.mkdir(exist_ok=True)
    (export/'catalogo.json').write_text(jd(dict(schema_version='2.0.0',species=cat['species'],locations=cat['locations'],sources=cat['sources'],variables=varmeta,counts=counts)),encoding='utf-8')
    for sp in cat['species']:
        sid=sp['id'];scenario=scenarios[sid];lids=[scenario['reference_location']]+scenario['candidate_locations']
        payload=dict(species=sp,scenario=scenario,locations=[l for l in cat['locations'] if l['id'] in lids],series={lid:series[lid] for lid in lids},climatology={lid:climates[lid] for lid in lids},reference_trends={period:{v:stats[(scenario['reference_location'],v,period)] for v in VARS} for period in PERIODS},sources=[s for s in cat['sources'] if s['id'] in sp['source_ids']+['power','hamed']],key_variables=key_card(key_spec,sid,dry,lids,key_values),survival_card=numeric_cards[sid],habitat_evidence=survival_card(survival,sid),key_variable_series={lid:{v:[dict(year=y,value=x) for y,x in sorted(key_values[lid].get(v,{}).items())] for v in key_spec['species'][sid]['variables']} for lid in lids})
        (export/(sid+'.json')).write_text(jd(payload),encoding='utf-8')
    (ROOT/'validacion.json').write_text(jd(dict(counts=counts,sqlite_integrity='ok',foreign_keys='ok',nasa_months_per_location=540,annual_years_per_location=45,climate_rounds=10,evidence_rounds=5,key_variables_per_species=3,physical_tolerance_thresholds_validated=0)),encoding='utf-8')
    print(counts)
if __name__=='__main__':main()
