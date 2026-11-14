"""Genera el paquete simplificado desde los datos del directorio padre."""
import calendar, json, shutil
from pathlib import Path

ROOT=Path(__file__).resolve().parent
SOURCE=ROOT.parent
def read(name): return json.loads((SOURCE/name).read_text(encoding='utf-8'))
def write(name,obj): (ROOT/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2,allow_nan=False)+'\n',encoding='utf-8')
monthly=read('clima-mensual.json');annual=read('series-anuales.json')['records'];trends=read('tendencias.json');cycle=read('ciclo-mensual.json')
names={'bramble-cay':'Bramble Cay','erub':'Erub','funafuti':'Funafuti','alice-springs':'Alice Springs'}
variables={'T2M':{'label':'Temperatura','monthly_unit':'°C','annual_unit':'°C'},'RH2M':{'label':'Humedad relativa','monthly_unit':'%','annual_unit':'%'},'PRECTOTCORR':{'label':'Precipitación','monthly_unit':'mm/mes','annual_unit':'mm/año'}}
for period,dates in trends['periods'].items():
    records=[]
    for t in trends['records']:
        if t['period_id']!=period:continue
        site,var=t['site_id'],t['variable']
        ms=next(s for s in monthly['sites'] if s['id']==site)['series']
        points=[]
        for r in ms:
            y,m=map(int,r['month'].split('-'))
            if y>dates['end_year']:continue
            points.append({'x':r['month'],'y':r[var]*(calendar.monthrange(y,m)[1] if var=='PRECTOTCORR' else 1)})
        ys=[r for r in annual if r['site_id']==site and r['year']<=dates['end_year']]
        records.append(dict(site_id=site,variable=var,monthly_points=points,
            annual_points=[dict(x=r['year'],y=r[var]) for r in ys],
            sen_line_points=[dict(x=r['year'],y=t['sen_line_at_first_year']+t['sen_slope_per_decade']/10*(r['year']-t['start_year'])) for r in ys],
            slope_per_decade=t['sen_slope_per_decade'],slope_unit=t['slope_unit'],
            tests=[dict(id='mk_original',label='Mann–Kendall original',p_value=t['p_value_uncorrected'],reject_null_005=t['p_value_uncorrected']<.05),
                   dict(id='mk_hamed_rao',label='Mann–Kendall con autocorrelación',p_value=t['p_value'],reject_null_005=t['significant_005'])],
            advanced=dict(p_holm=t['p_value_holm'],game_stamp=t['game_stamp'],sensitive_to_lags=t['significance_sensitive_to_lag_choice']),
            trend_feedback=('La serie aporta evidencia de '+('aumento' if t['sen_slope_per_decade']>0 else 'descenso')+' con el criterio Hamed–Rao + Holm.' if t['significant_holm_005'] else 'La pendiente indica un cambio estimado, pero la evidencia no alcanza el criterio Hamed–Rao + Holm. Esto no demuestra estabilidad.'),
            source_id=t['source_id']))
    assert len(records)==12
    for r in records:
        n=dates['end_year']-dates['start_year']+1
        assert len(r['monthly_points'])==n*12 and len(r['annual_points'])==n
        assert len(r['sen_line_points'])==n and len(r['tests'])==2
    write(f'{period}.json',dict(schema_version='1.0.0',period_id=period,**dates,variables=variables,sites=names,records=records))
comparative=[]
for var,meta in variables.items():
    comparative.append(dict(variable=var,unit=meta['monthly_unit'],series=[dict(site_id=site,name=name,points=[dict(x=r['month'],y=r['precipitation_mm_month'] if var=='PRECTOTCORR' else r[var]) for r in cycle['records'] if r['site_id']==site]) for site,name in names.items()]))
dry={r['site_id']:r['dry_season_precipitation_mm'] for r in cycle['comparisons']}
def feedback(site,correct,title,text):
    return dict(selected_site=site,correct=correct,title=title,message=text,
        show_comparative_charts=True,comparison_source='retroalimentacion.json',comparison_period=[1981,2008],
        highlight_site_ids=['bramble-cay',site] if site=='erub' else ['bramble-cay',site,'erub'],
        climate_evidence=[dict(variable=c['variable'],unit=c['unit']) for c in comparative],
        simulation_note='La altura y vegetación del arriendo son supuestos de la demo. Esta elección no demuestra supervivencia real.')
write('retroalimentacion.json',dict(schema_version='1.0.0',correct_site_id='erub',period=[1981,2008],dry_months=cycle['reference_dry_months'],
    comparative_charts=comparative,dry_season_precipitation_mm=dry,
    by_choice={
        'erub':feedback('erub',True,'Elección correcta para esta simulación',f'Erub reproduce mejor el ciclo de temperatura, humedad y lluvia de Bramble Cay. Aun así, entre junio y noviembre recibe {dry["erub"]:.1f} mm frente a {dry["bramble-cay"]:.1f} mm: aproximadamente 22 % menos. El arriendo ficticio interior elevado responde a la amenaza de inundación marina.'),
        'funafuti':feedback('funafuti',False,'Revisa la estación seca y la inundación',f'Funafuti es cálido y húmedo, pero su ciclo de lluvia difiere: acumula {dry["funafuti"]:.1f} mm entre junio y noviembre, frente a {dry["bramble-cay"]:.1f} mm en Bramble Cay. Además, la ficha ofrece un arriendo ficticio en atolón bajo. Compara con el clima y el terreno interior elevado de Erub.'),
        'alice-springs':feedback('alice-springs',False,'Estar lejos del mar no basta',f'Alice Springs muestra mayor contraste térmico estacional y mucha menos humedad. Entre junio y noviembre acumula {dry["alice-springs"]:.1f} mm, frente a {dry["bramble-cay"]:.1f} mm en Bramble Cay. La menor exposición marina no compensa esas diferencias en la regla de esta demo.')},
    teaching_points=['Los p evalúan tendencia temporal, no semejanza ni calidad del hábitat.',
                     'La pendiente de Sen cuantifica la magnitud; no es un segundo test con p.',
                     'Mann–Kendall original y Hamed–Rao son variantes del mismo contraste, no dos evidencias independientes.',
                     'No rechazar una tendencia no demuestra estabilidad; ninguna tendencia garantiza supervivencia.']))
shutil.copy2(SOURCE/'fuentes-analisis.json',ROOT/'fuentes.json')
print('OK: 12 fichas por periodo, dos tests por ficha, 12 curvas comparativas y retroalimentacion para tres elecciones.')
