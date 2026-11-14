"""Reproduce los JSON, tablas y figuras desde las respuestas NASA archivadas.
Uso: python scripts/analizar_melomys.py (no requiere red).
"""
import calendar
import hashlib
import json
import math
from pathlib import Path
import numpy as np
import scipy
from scipy.stats import rankdata, norm, theilslopes
import pymannkendall as mk
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/bramble-cay-melomys'
NAMES = {'bramble-cay': 'Bramble Cay', 'erub': 'Erub', 'funafuti': 'Funafuti', 'alice-springs': 'Alice Springs'}
VARS = {'T2M': ('Temperatura', '°C', '°C/década'), 'RH2M': ('Humedad relativa', '%', 'puntos porcentuales/década'), 'PRECTOTCORR': ('Precipitación anual', 'mm/año', '(mm/año)/década')}
PERIODS = {'decision_2009': (1981, 2008), 'revelacion': (1981, 2025)}

def save(name, data):
    (OUT/name).write_text(json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False)+'\n', encoding='utf-8')

def trend(values):
    x = np.asarray(values, dtype=float)
    n = len(x)
    base = mk.original_test(x)
    hr = mk.hamed_rao_modification_test(x)  # all lags; significant detrended rank ACF only
    assert hr.var_s > 0 and np.isfinite(hr.var_s)
    # Independent slope cross-check (actual spacing is one complete year).
    assert math.isclose(hr.slope, theilslopes(x, np.arange(n)).slope, abs_tol=1e-10)
    r = rankdata(x - hr.slope*np.arange(1, n+1))
    r = r-r.mean()
    acf = np.correlate(r, r, 'full')[n-1:]/np.dot(r, r)
    significant_lags = [i for i in range(1,n) if abs(acf[i]) > norm.ppf(.975)/np.sqrt(n)]
    # Independent audit of Hamed-Rao variance multiplier.
    factor = 1+2*sum((n-i)*(n-i-1)*(n-i-2)*acf[i] for i in significant_lags)/(n*(n-1)*(n-2))
    assert math.isclose(hr.var_s/base.var_s, factor, abs_tol=1e-10)
    p = float(2*norm.sf(abs(hr.z)))  # stable tails; do not store rounded zero
    sensitivity = {}
    for lag in (1,3):
        test = mk.hamed_rao_modification_test(x, lag=lag)
        assert test.var_s > 0
        sensitivity[f'lag_{lag}'] = float(2*norm.sf(abs(test.z)))
    return dict(sen_slope_per_decade=float(hr.slope*10),
                trend_change_over_period=float(hr.slope*(n-1)),
                observed_last_minus_first=float(x[-1]-x[0]),
                sen_line_at_first_year=float(hr.intercept),
                mk_s=float(hr.s), tau=float(hr.Tau), z=float(hr.z),
                p_value=p, significant_005=bool(p<.05),
                p_value_uncorrected=float(2*norm.sf(abs(base.z))),
                variance_correction_factor=float(factor),
                detrended_rank_acf_lag1=float(acf[1]),
                significant_acf_lags=significant_lags,
                sensitivity_p_values=sensitivity,
                significance_sensitive_to_lag_choice=any((v<.05)!=(p<.05) for v in sensitivity.values()))

def main():
    annual, cycles, sources, records = [], [], [], []
    months_by_site = {}
    for site, name in NAMES.items():
        path = OUT/'nasa-power'/f'{site}.json'
        blob = path.read_bytes()
        raw = json.loads(blob)
        params = raw['properties']['parameter']
        lon, lat, *_ = raw['geometry']['coordinates']
        url = f'https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=T2M,RH2M,PRECTOTCORR&community=AG&longitude={lon}&latitude={lat}&format=JSON&start=1981&end=2025'
        sources.append(dict(id=f'nasa-power-{site}', provider='NASA POWER', url=url,
                            archived_file=f'nasa-power/{site}.json',sha256=hashlib.sha256(blob).hexdigest(),
                            header=raw['header'], parameters=raw['parameters']))
        monthly = []
        for year in range(1981,2026):
            rows = []
            for month in range(1,13):
                key = f'{year}{month:02d}'
                row = dict(year=year, month=month, days=calendar.monthrange(year,month)[1])
                for var in VARS:
                    value = params[var][key]
                    assert math.isfinite(value) and value != raw['header']['fill_value'], (site,key,var)
                    row[var] = value
                assert 0 <= row['RH2M'] <= 100 and row['PRECTOTCORR'] >= 0
                row['precipitation_mm_month'] = row['PRECTOTCORR']*row['days']
                rows.append(row)
            yearly = dict(year=year, months_used=12, days_used=sum(r['days'] for r in rows))
            for var in VARS:
                yearly[var] = (sum(r['precipitation_mm_month'] for r in rows) if var=='PRECTOTCORR'
                               else sum(r[var]*r['days'] for r in rows)/yearly['days_used'])
            annual.append(dict(site_id=site, **yearly))
            monthly.extend(rows)
        months_by_site[site] = monthly
        for month in range(1,13):
            subset = [r for r in monthly if r['year']<=2008 and r['month']==month]
            assert len(subset)==28
            cycles.append(dict(site_id=site,month=month,n_years=28,
                               **{v:float(np.mean([r[v] for r in subset])) for v in VARS},
                               precipitation_mm_month=float(np.mean([r['precipitation_mm_month'] for r in subset]))))
        for period,(start,end) in PERIODS.items():
            subset = [r for r in annual if r['site_id']==site and start<=r['year']<=end]
            for var,(label,unit,slope_unit) in VARS.items():
                records.append(dict(site_id=site,site_name=name,variable=var,label=label,
                                    period_id=period,start_year=start,end_year=end,n_years=len(subset),
                                    annual_unit=unit,slope_unit=slope_unit,
                                    source_id=f'nasa-power-{site}',**trend([r[var] for r in subset])))
    # Holm controls the family-wise error across the 12 site-variable tests in each period.
    for period in PERIODS:
        family = sorted([r for r in records if r['period_id']==period],key=lambda r:r['p_value'])
        previous=0
        for index,record in enumerate(family):
            adjusted=min(1,max(previous,(len(family)-index)*record['p_value']))
            previous=adjusted
            record['p_value_holm']=adjusted
            record['significant_holm_005']=bool(adjusted<.05)
            record['game_stamp']=('REAL ↑' if record['sen_slope_per_decade']>0 else 'REAL ↓') if adjusted<.05 else 'NO PROBADO'
    reference = [r for r in cycles if r['site_id']=='bramble-cay']
    # Operational, comparative dry season: six driest reference months, no biological threshold.
    dry = sorted(r['month'] for r in sorted(reference,key=lambda r:r['PRECTOTCORR'])[:6])
    comparisons=[]
    for site in NAMES:
        own=[r for r in cycles if r['site_id']==site]
        comparisons.append(dict(site_id=site,
            monthly_rmse_vs_bramble={v:float(np.sqrt(np.mean([(a[v]-b[v])**2 for a,b in zip(own,reference)]))) for v in VARS},
            dry_months_rmse_vs_bramble={v:float(np.sqrt(np.mean([(a[v]-b[v])**2 for a,b in zip(own,reference) if a['month'] in dry]))) for v in VARS},
            dry_season_precipitation_mm=float(sum(r['precipitation_mm_month'] for r in own if r['month'] in dry)),
            driest_month=min(own,key=lambda r:r['PRECTOTCORR'])['month']))
    save('series-anuales.json',dict(schema_version='1.0.0',period=[1981,2025],units={v:t[1] for v,t in VARS.items()},records=annual))
    save('ciclo-mensual.json',dict(schema_version='1.0.0',period=[1981,2008],
         units={'T2M':'°C','RH2M':'%','PRECTOTCORR':'mm/día','precipitation_mm_month':'mm/mes'},
         reference_dry_months=dry,dry_month_definition='Seis meses de menor lluvia media diaria de Bramble Cay en 1981–2008; mismos meses para todos.',
         records=cycles,comparisons=comparisons))
    save('tendencias.json',dict(schema_version='1.0.0',species='Melomys rubicola',
         method=dict(slope='Sen; mediana de pendientes entre todos los pares anuales',test='Mann–Kendall modificado Hamed–Rao (1998)',
                     autocorrelation='Rangos tras quitar pendiente de Sen; lags 1..n-1 significativos al 5%; corrección de varianza; sensibilidad lag=1 y lag=3.',
                     alpha=.05,multiple_testing='Holm: 12 tests por período; game_stamp usa p_value_holm',
                     aggregation='Precipitación: suma(mm/día × días del mes). Temperatura y humedad: media ponderada por días.',
                     incomplete_years='2026 excluido; solo años con 12 meses válidos',
                     versions={'numpy':np.__version__,'scipy':scipy.__version__,'pymannkendall':mk.__version__}),
         periods={k:dict(start_year=v[0],end_year=v[1]) for k,v in PERIODS.items()},records=records))
    save('fuentes-analisis.json',dict(analysis_date='2026-11-14',nasa_inputs=sources,
         methodology_urls=['https://power.larc.nasa.gov/docs/methodology/data/sources_meteorology/',
                           'https://doi.org/10.1016/S0022-1694(97)00125-X',
                           'https://github.com/mmhs013/pyMannKendall'],
         local_evidence_urls=['https://www.dcceew.gov.au/sites/default/files/env/consultations/d678432e-1ee8-4316-b1ef-af29634401d7/files/consultation-document-bramble-cay-melomys-2018.pdf',
                              'https://tsirc.qld.gov.au/wp-content/uploads/2024/11/Part-7-Erub-Darnley-Island-local-plan-code.pdf'],
         pending_regional_sea_level_urls=['https://psmsl.org/data/obtaining/stations/1570.php','https://www.bom.gov.au/oceanography/projects/ntc/monthly/index.shtml']))
    lines=['# Resultados de tendencias','', 'Generado por `scripts/analizar_melomys.py`. p corregido por autocorrelación; p Holm también corrige los 12 contrastes de cada período.','']
    for period,(start,end) in PERIODS.items():
        lines += [f'## {period}: {start}–{end}','','| Sitio | Variable | Sen por década | Unidad | p Hamed–Rao | p Holm | Sello | Sensible a lags |','|---|---|---:|---|---:|---:|---|---|']
        for r in records:
            if r['period_id']!=period: continue
            lines.append(f"| {r['site_name']} | {r['label']} | {r['sen_slope_per_decade']:+.3f} | {r['slope_unit']} | {r['p_value']:.4g} | {r['p_value_holm']:.4g} | {r['game_stamp']} | {'Sí' if r['significance_sensitive_to_lag_choice'] else 'No'} |")
        lines.append('')
    lines += ['## Semejanza estacional (1981–2008)','','RMSE menor significa mayor semejanza, dentro de cada variable. No sumar RMSE con unidades diferentes.','','| Sitio | RMSE T (°C) | RMSE HR (pp) | RMSE lluvia (mm/día) | Lluvia en seis meses secos (mm) |','|---|---:|---:|---:|---:|']
    for c in comparisons:
        e=c['monthly_rmse_vs_bramble']
        lines.append(f"| {NAMES[c['site_id']]} | {e['T2M']:.3f} | {e['RH2M']:.3f} | {e['PRECTOTCORR']:.3f} | {c['dry_season_precipitation_mm']:.1f} |")
    (OUT/'RESULTADOS.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
    figures=OUT/'figuras'
    figures.mkdir(exist_ok=True)
    colors={'bramble-cay':'#182c42','erub':'#008568','funafuti':'#be6a00','alice-springs':'#a13b73'}
    fig,axes=plt.subplots(3,1,figsize=(10,10),sharex=True,layout='constrained')
    for ax,var,ylabel in zip(axes,VARS,['Temperatura (°C)','Humedad relativa (%)','Precipitación (mm/mes)']):
        field='precipitation_mm_month' if var=='PRECTOTCORR' else var
        for site,name in NAMES.items():
            own=[r for r in cycles if r['site_id']==site]
            ax.plot(range(1,13),[r[field] for r in own],marker='o',label=name,color=colors[site])
        for m in dry: ax.axvspan(m-.45,m+.45,color='#d8cfae',alpha=.25,zorder=0)
        ax.set_ylabel(ylabel); ax.grid(alpha=.2)
    axes[0].legend(ncol=4,fontsize=9)
    axes[2].set_xticks(range(1,13),['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'])
    fig.suptitle('Clima típico antes de la decisión · 1981–2008\nSombreado: seis meses más secos de Bramble Cay',fontsize=14)
    fig.supxlabel('Fuente: NASA POWER · Medias de 28 años · Escala regional, no microclima del arriendo',fontsize=9)
    fig.savefig(figures/'ciclo-mensual.png',dpi=160); plt.close(fig)
    for period,(start,end) in PERIODS.items():
        fig,axes=plt.subplots(4,3,figsize=(15,12),layout='constrained')
        for i,site in enumerate(NAMES):
            for j,var in enumerate(VARS):
                ax=axes[i,j]
                subset=[r for r in annual if r['site_id']==site and start<=r['year']<=end]
                r=next(r for r in records if r['site_id']==site and r['variable']==var and r['period_id']==period)
                years=np.array([r['year'] for r in subset])
                ax.plot(years,[r[var] for r in subset],color=colors[site],alpha=.65,lw=1)
                ax.plot(years,r['sen_line_at_first_year']+r['sen_slope_per_decade']/10*(years-start),color='#202020',ls='--')
                ax.set_title(f"{NAMES[site]} · {VARS[var][0]}\nSen {r['sen_slope_per_decade']:+.2f}/década · {r['game_stamp']}",fontsize=10)
                ax.set_ylabel(VARS[var][1]); ax.grid(alpha=.2)
                ax.set_xticks([1981,1990,2000,2008] if end==2008 else [1981,1995,2010,2025])
        fig.suptitle(f'Tendencias anuales · {start}–{end}\nLínea discontinua: ajuste de Sen; sellos con Hamed–Rao + Holm',fontsize=15)
        fig.supxlabel('Fuente: NASA POWER · Años completos · Tendencia histórica, no pronóstico de supervivencia',fontsize=10)
        fig.savefig(figures/f'tendencias-{period}.png',dpi=140); plt.close(fig)
    assert len(records)==24 and len(cycles)==48 and len(annual)==180
    print('OK: 24 trends, 48 monthly climatology rows, 180 annual rows, 3 figures.')

if __name__=='__main__':
    main()
