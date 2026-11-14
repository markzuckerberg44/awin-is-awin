"""Construye SQLite y exportación JSON. No toca progreso.sqlite ni requiere red."""
import calendar, hashlib, json, math, sqlite3, os, warnings
from pathlib import Path
import numpy as np
import pymannkendall as mk
from scipy.stats import norm, theilslopes
from seed import ROOT
VARS=['T2M','RH2M','PRECTOTCORR']
PERIODS={'archivo_1981_2008':(1981,2008),'retrospectivo_1981_2025':(1981,2025)}

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
                corrected_test_valid=valid,invalid_reason=None if valid else 'Hamed–Rao con todos los rezagos produce varianza no positiva; no se emite p ni se sustituye silenciosamente otro método.',
                tau=float(hr.Tau),s=float(hr.s),z=float(hr.z) if valid else None,variance_factor=float(hr.var_s/original.var_s),
                method='Hamed–Rao 1998, todos los rezagos significativos sobre rangos sin tendencia',
                p_sensitivity={lag:float(2*norm.sf(abs(test.z))) if test.var_s>0 and np.isfinite(test.z) else None for lag,test in sensitivity.items()})

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
    CREATE TABLE audit(pdf_row INTEGER PRIMARY KEY,species_id TEXT REFERENCES species(id),pdf_threshold_claim TEXT,disposition TEXT);
    ''')
    db.executemany('INSERT INTO metadata VALUES (?,?)',[('schema_version','1.0.0'),('review_date','2026-11-14'),('title','Biodiversidad y clima: colección de 15 fichas'),('climate_scope','NASA POWER: aire regional, no agua ni microhábitat')])
    for src in cat['sources']:db.execute('INSERT INTO sources VALUES (?,?,?,?,NULL)',(src['id'],src['title'],src['url'],src['accessed']))
    varmeta={'T2M':('Temperatura del aire a 2 m','°C','°C','air'),'RH2M':('Humedad relativa del aire a 2 m','%','%','air'),'PRECTOTCORR':('Precipitación','mm/mes','mm/año','precipitation')}
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
            cycle=[float(np.mean([r[v] for r in months if r['year']<=2008 and r['month']==m])) for m in range(1,13)]
            climates[lid][v]=cycle;scales[lid][v]=float(np.std([r[v] for r in months if r['year']<=2008],ddof=1))
            for m,value in enumerate(cycle,1):db.execute('INSERT INTO climatology VALUES (?,?,?,?,?,?,?)',(lid,m,v,value,varmeta[v][1],1981,2008))
            for period,(start,end) in PERIODS.items():
                t=analyze([r[v] for r in years if start<=r['year']<=end]);t.update(start_year=start,end_year=end,unit=varmeta[v][2],slope_unit=varmeta[v][2]+'/década')
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
            scenario=dict(kind='climate_analogue_exercise',title='¿Qué opción reproduce mejor el ciclo climático regional?',
                reference_location=ref,candidate_locations=candidates,accepted_answers=accepted,scores=scores,
                period='archivo_1981_2008',scenario_year=2009 if sid=='melomys' else None,
                period_note='Recreación educativa con archivo 1981–2008; no supone que la especie siguiera viva ni que estos datos estuvieran disponibles entonces.',
                question='Compara los 12 meses típicos de las tres variables. Elige el candidato con menor distancia climática estandarizada.',
                model_rule='Media de RMSE de 12 meses por variable dividida por desviación estándar mensual 1981–2008 del sitio de referencia; tres pesos iguales. Regla didáctica, no modelo ecológico.',
                feedback='El menor índice identifica el análogo regional entre estas tres opciones. Los p prueban tendencia, no adecuación. Aún se requieren '+', '.join(sp['required_local_evidence'])+'.',
                limitations='Las parcelas y condiciones de manejo son ficticias. No es recomendación de translocación ni predicción de supervivencia.',
                habitat_decision_validated=False,
                game_assumptions='Para comparar clima, todos los candidatos se suponen con las demás condiciones equivalentes y apropiadas; este supuesto no ha sido comprobado en terreno.',
                adjusted_tests={})
            for period in PERIODS:
                family=[]
                for lid in [ref]+candidates:
                    for v in VARS:family.append(dict(location_id=lid,variable=v,**stats[(lid,v,period)]))
                ordered=sorted(family,key=lambda r:r['p_corrected'] if r['p_corrected'] is not None else 1);last=0
                for idx,t in enumerate(ordered):
                    if t['p_corrected'] is None:
                        t['p_holm']=None;t['stamp']='NO EVALUABLE';continue
                    last=min(1,max(last,(len(ordered)-idx)*t['p_corrected']));t['p_holm']=last
                    t['stamp']=('REAL ↑' if t['slope_per_decade']>0 else 'REAL ↓') if last<.05 else 'NO PROBADO'
                scenario['adjusted_tests'][period]=family
        else:
            water='marina y del fondo' if sp['system']=='marine' else 'del manantial'
            scenario=dict(kind='evidence_gap_exercise',title='¿Qué evidencia falta antes de comparar refugios acuáticos?',
                reference_location=ref,candidate_locations=[],accepted_answers=['water_data'],period='archivo_1981_2008',scenario_year=None,
                question='Tenemos temperatura y humedad del aire y lluvia de NASA POWER. ¿Qué harías antes de decidir sobre el hábitat acuático?',
                choices=[dict(id='air_equals_water',label='Usar temperatura del aire como temperatura del agua'),dict(id='lowest_p',label='Elegir el lugar con el p más pequeño'),dict(id='water_data',label='Pedir series del agua y evidencia del hábitat')],
                feedback='Correcto: se requieren '+', '.join(sp['required_local_evidence'])+'. La temperatura del aire no sustituye a la '+water+'.',
                limitations='Ficha completa y ejercicio de evidencia; no hay todavía tres arriendos acuáticos ni series acuáticas validadas.',
                habitat_decision_validated=False)
        scenarios[sid]=scenario
        db.execute('INSERT INTO scenarios VALUES (?,?,?)',(sid,scenario['kind'],jd(scenario)))
        db.execute('INSERT INTO scenario_locations VALUES (?,?,?)',(sid,ref,'reference'))
        for lid in scenario['candidate_locations']:db.execute('INSERT INTO scenario_locations VALUES (?,?,?)',(sid,lid,'candidate'))
    assert db.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
    assert not db.execute('PRAGMA foreign_key_check').fetchall()
    db.commit();counts={t:db.execute('SELECT COUNT(*) FROM '+t).fetchone()[0] for t in ['species','locations','observations','trends','climatology','scenarios','sources']};db.close();os.replace(tmp,ROOT/'pokedex.sqlite')
    export=ROOT/'export';export.mkdir(exist_ok=True)
    (export/'catalogo.json').write_text(jd(dict(schema_version='1.0.0',species=cat['species'],locations=cat['locations'],sources=cat['sources'],variables=varmeta,counts=counts)),encoding='utf-8')
    for sp in cat['species']:
        sid=sp['id'];scenario=scenarios[sid];lids=[scenario['reference_location']]+scenario['candidate_locations']
        payload=dict(species=sp,scenario=scenario,locations=[l for l in cat['locations'] if l['id'] in lids],series={lid:series[lid] for lid in lids},climatology={lid:climates[lid] for lid in lids},reference_trends={period:{v:stats[(scenario['reference_location'],v,period)] for v in VARS} for period in PERIODS},sources=[s for s in cat['sources'] if s['id'] in sp['source_ids']+['power','hamed']])
        (export/(sid+'.json')).write_text(jd(payload),encoding='utf-8')
    (ROOT/'validacion.json').write_text(jd(dict(counts=counts,sqlite_integrity='ok',foreign_keys='ok',nasa_months_per_location=540,annual_years_per_location=45,climate_rounds=10,evidence_rounds=5,physical_tolerance_thresholds_validated=0)),encoding='utf-8')
    print(counts)
if __name__=='__main__':main()
