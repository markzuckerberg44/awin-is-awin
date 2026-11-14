"""Genera el paquete simplificado desde los datos del directorio padre."""
import calendar, json, shutil
from pathlib import Path

ROOT=Path(__file__).resolve().parent
SOURCE=ROOT.parent
def read(name): return json.loads((SOURCE/name).read_text(encoding='utf-8'))
def write(name,obj): (ROOT/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2,allow_nan=False)+'\n',encoding='utf-8')
monthly=read('clima-mensual.json');archive=read('ciclo-mensual.json')['period'];annual=read('series-anuales.json')['records'];trends=read('tendencias.json');cycle=read('ciclo-mensual.json')
names={'bramble-cay':'Bramble Cay','erub':'Erub','funafuti':'Funafuti','alice-springs':'Alice Springs'}
variables={'T2M':{'label':'Temperature','monthly_unit':'°C','annual_unit':'°C'},'RH2M':{'label':'Relative humidity','monthly_unit':'%','annual_unit':'%'},'PRECTOTCORR':{'label':'Rainfall','monthly_unit':'mm/month','annual_unit':'mm/year'}}
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
            tests=[dict(id='mk_original',label='Original Mann–Kendall',p_value=t['p_value_uncorrected'],reject_null_005=t['p_value_uncorrected']<.05),
                   dict(id='mk_hamed_rao',label='Mann–Kendall with autocorrelation',p_value=t['p_value'],reject_null_005=t['significant_005'])],
            advanced=dict(p_holm=t['p_value_holm'],game_stamp=t['game_stamp'],sensitive_to_lags=t['significance_sensitive_to_lag_choice']),
            trend_feedback=('The series shows evidence of '+('an increase' if t['sen_slope_per_decade']>0 else 'a decrease')+' under the Hamed–Rao + Holm criterion.' if t['significant_holm_005'] else 'The slope shows an estimated change, but the evidence does not meet the Hamed–Rao + Holm criterion. This does not prove stability.'),
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
        show_comparative_charts=True,comparison_source='retroalimentacion.json',comparison_period=archive,
        highlight_site_ids=['bramble-cay',site] if site=='erub' else ['bramble-cay',site,'erub'],
        climate_evidence=[dict(variable=c['variable'],unit=c['unit']) for c in comparative],
        simulation_note='The plot’s height and vegetation are demo assumptions. This choice does not prove real survival.')
write('retroalimentacion.json',dict(schema_version='1.0.0',correct_site_id='erub',period=archive,scenario_year=cycle['scenario_year'],dry_months=cycle['reference_dry_months'],
    comparative_charts=comparative,dry_season_precipitation_mm=dry,
    by_choice={
        'erub':feedback('erub',True,'Correct choice for this simulation',f'Erub best matches Bramble Cay’s cycle of temperature, humidity and rainfall. Even so, from June to November it gets {dry["erub"]:.1f} mm versus {dry["bramble-cay"]:.1f} mm: about {round(100*(1-dry["erub"]/dry["bramble-cay"]))} % less. The fictional raised inland plot answers the threat of seawater flooding.'),
        'funafuti':feedback('funafuti',False,'Check the dry season and the flooding',f'Funafuti is warm and humid, but its rainfall cycle differs: it gets {dry["funafuti"]:.1f} mm from June to November, versus {dry["bramble-cay"]:.1f} mm at Bramble Cay. The listing also offers a fictional plot on a low-lying atoll. Compare with Erub’s climate and raised inland ground.'),
        'alice-springs':feedback('alice-springs',False,'Being far from the sea is not enough',f'Alice Springs has a much larger seasonal temperature swing and far less humidity. From June to November it gets {dry["alice-springs"]:.1f} mm, versus {dry["bramble-cay"]:.1f} mm at Bramble Cay. Less exposure to the sea does not make up for those differences under this demo’s rule.')},
    teaching_points=['p-values test for a trend over time, not similarity or habitat quality.',
                     'The Sen slope measures the size of the change; it is not a second test with a p-value.',
                     'Original Mann–Kendall and Hamed–Rao are versions of the same test, not two independent pieces of evidence.',
                     'Failing to reject a trend does not prove stability; no trend guarantees survival.']))
shutil.copy2(SOURCE/'fuentes-analisis.json',ROOT/'fuentes.json')
print('OK: 12 fichas por periodo, dos tests por ficha, 12 curvas comparativas y retroalimentacion para tres elecciones.')
