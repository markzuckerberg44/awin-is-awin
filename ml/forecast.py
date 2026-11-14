"""Climate forecast 2026–2030 for each species' three key survival indicators.

Self-contained module: reads the project database (data/pokedex/pokedex.sqlite) and
ml/data/power_extra_annual.json, and writes ml/output/. It does not change the game data.

Usage (from the repository root):  python ml/forecast.py        (requires numpy only)
Optional charts:                     python ml/forecast.py --charts   (also requires matplotlib)
"""
import calendar, json, sqlite3, sys
from pathlib import Path
import numpy as np

ML = Path(__file__).resolve().parent
ROOT = ML.parent
DB = ROOT / 'data/pokedex/pokedex.sqlite'
OUT = ML / 'output'

FIRST_YEAR, LAST_OBSERVED = 1981, 2025
HORIZON = list(range(2026, 2031))          # forecast years
BACKTEST_TRAIN_END = 2020                   # backtest: train ≤ 2020, predict 2021–2025
CV_FINAL = (2005, 2010, 2015, 2020)         # rolling origins for the final model (train ≤ o, predict o+1..o+5)
CV_BACKTEST = (2000, 2005, 2010, 2015)      # same, but only inside the backtest training window
NORMAL = (1991, 2020)                       # WMO-style reference period for "change vs normal"
BAND = (10, 90)                             # 80 % prediction interval from out-of-sample errors

MODELS = {
    'historical_mean': 'Average of all training years (assumes no change)',
    'recent_mean': 'Average of the last 10 training years (assumes recent conditions persist)',
    'linear_trend': 'Least-squares straight line through the training years',
    'theil_sen_trend': 'Robust straight line (median of pairwise slopes), less sensitive to extreme years',
}


# ---------- data ----------

def local_indicators(db):
    """Indicators computed from T2M, RH2M and PRECTOTCORR already stored in the project database."""
    out = {}
    for (lid,) in db.execute('SELECT id FROM locations'):
        monthly = {}
        for date, var, value in db.execute("SELECT date,variable,value FROM observations WHERE location_id=? AND frequency='monthly'", (lid,)):
            monthly.setdefault(var, {})[(int(date[:4]), int(date[5:]))] = value  # PRECTOTCORR here is mm/month
        cycle = {m: np.mean([monthly['PRECTOTCORR'][(y, m)] for y in range(FIRST_YEAR, LAST_OBSERVED + 1)]) for m in range(1, 13)}
        dry = sorted(sorted(cycle, key=cycle.get)[:4])
        series = {k: {} for k in ('t2m_mean', 'rh2m_mean', 'precip_annual', 'precip_dry_season')}
        for y in range(FIRST_YEAR, LAST_OBSERVED + 1):
            days = [calendar.monthrange(y, m)[1] for m in range(1, 13)]
            for key, var in (('t2m_mean', 'T2M'), ('rh2m_mean', 'RH2M')):
                series[key][y] = sum(monthly[var][(y, m)] * d for m, d in zip(range(1, 13), days)) / sum(days)
            series['precip_annual'][y] = sum(monthly['PRECTOTCORR'][(y, m)] for m in range(1, 13))
            series['precip_dry_season'][y] = sum(monthly['PRECTOTCORR'][(y, m)] for m in dry)
        out[lid] = dict(series=series, dry_months=dry)
    return out


def load_series(db):
    local = local_indicators(db)
    extra = json.loads((ML / 'data/power_extra_annual.json').read_text(encoding='utf-8'))
    data = {lid: dict(v['series']) for lid, v in local.items()}
    for lid, per in extra['series'].items():
        for ind, values in per.items():
            data[lid][ind] = {int(y): v for y, v in values.items()}
    return data, {lid: v['dry_months'] for lid, v in local.items()}


# ---------- models ----------

def theil_sen(x, y):
    i, j = np.triu_indices(len(x), 1)
    slope = float(np.median((y[j] - y[i]) / (x[j] - x[i])))
    return slope, float(np.median(y - slope * x))


def predict(model, years, values, targets):
    x, y, t = np.asarray(years, float), np.asarray(values, float), np.asarray(targets, float)
    if model == 'historical_mean':
        return np.full(len(t), y.mean())
    if model == 'recent_mean':
        return np.full(len(t), y[-10:].mean())
    if model == 'linear_trend':
        slope, intercept = np.polyfit(x, y, 1)
        return intercept + slope * t
    slope, intercept = theil_sen(x, y)
    return intercept + slope * t


def cv_errors(model, years, values, origins):
    """Out-of-sample errors (observed − predicted) for 1–5 year horizons from each origin."""
    errs = []
    for o in origins:
        tr = [(a, b) for a, b in zip(years, values) if a <= o]
        te = [(a, b) for a, b in zip(years, values) if o < a <= o + 5]
        if len(tr) < 15 or not te:
            continue
        p = predict(model, *zip(*tr), [a for a, _ in te])
        errs += [b - q for (_, b), q in zip(te, p)]
    return np.array(errs)


def fit(years, values, train_end, targets, origins, lower=None, upper=None):
    tr = [(a, b) for a, b in zip(years, values) if a <= train_end]
    ty, tv = zip(*tr)
    cv = {m: cv_errors(m, ty, tv, origins) for m in MODELS}
    mae = {m: float(np.mean(np.abs(e))) for m, e in cv.items()}
    best = min(MODELS, key=lambda m: (round(mae[m], 9), list(MODELS).index(m)))
    pred = predict(best, ty, tv, targets)
    qlo, qhi = np.percentile(cv[best], BAND)
    rows = []
    for t, p in zip(targets, pred):
        lo, hi = p + min(qlo, 0), p + max(qhi, 0)  # interval always contains the point forecast
        if lower is not None: lo, p, hi = max(lo, lower), max(p, lower), max(hi, lower)
        if upper is not None: lo, p, hi = min(lo, upper), min(p, upper), min(hi, upper)
        rows.append(dict(year=int(t), value=r(p), low80=r(lo), high80=r(hi)))
    return best, {m: r(v) for m, v in mae.items()}, rows


def r(x, n=3): return round(float(x), n)


BOUNDS = {'rh2m_mean': (0, 100), 'cloud_cover': (0, 100), 'soil_wetness': (0, 1), 'precip_annual': (0, None), 'precip_dry_season': (0, None), 'wind_speed': (0, None)}


def forecast_series(values_by_year):
    years = [y for y in sorted(values_by_year) if values_by_year[y] is not None]
    values = [values_by_year[y] for y in years]
    lo, hi = BOUNDS.get(forecast_series.indicator, (None, None))
    # Backtest: pretend we are in 2020, forecast 2021–2025 and compare with what happened.
    b_model, b_cv, b_rows = fit(years, values, BACKTEST_TRAIN_END, list(range(2021, 2026)), CV_BACKTEST, lo, hi)
    observed = dict(zip(years, values))
    for row in b_rows: row['observed'] = r(observed[row['year']])
    err = [row['observed'] - row['value'] for row in b_rows]
    base = np.mean([v for y, v in observed.items() if y <= BACKTEST_TRAIN_END])
    base_mae = np.mean([abs(row['observed'] - base) for row in b_rows])
    backtest = dict(train_period=[years[0], BACKTEST_TRAIN_END], test_period=[2021, 2025], selected_model=b_model, years=b_rows,
                    mae=r(np.mean(np.abs(err))), mae_if_no_change=r(base_mae),
                    skill_vs_no_change=r(1 - np.mean(np.abs(err)) / base_mae) if base_mae > 0 else None,
                    years_inside_80_interval=sum(row['low80'] <= row['observed'] <= row['high80'] for row in b_rows))
    # Final model: all known data 1981–2025, forecast 2026–2030.
    f_model, f_cv, f_rows = fit(years, values, LAST_OBSERVED, HORIZON, CV_FINAL, lo, hi)
    normal = float(np.mean([v for y, v in observed.items() if NORMAL[0] <= y <= NORMAL[1]]))
    recent = float(np.mean([v for y, v in observed.items() if 2016 <= y <= 2025]))
    slope, _ = theil_sen(np.array(years, float), np.array(values, float))
    return dict(
        observed=[dict(year=y, value=r(v)) for y, v in zip(years, values)],
        forecast=f_rows, selected_model=f_model, model_description=MODELS[f_model], cv_mae_by_model=f_cv,
        context=dict(normal_1991_2020=r(normal), mean_2016_2025=r(recent),
                     forecast_mean_2026_2030=r(np.mean([x['value'] for x in f_rows])),
                     change_vs_normal=r(np.mean([x['value'] for x in f_rows]) - normal),
                     trend_per_decade_1981_2025=r(slope * 10)),
        backtest=backtest)


def summary_text(meta, s):
    c, f = s['context'], s['forecast']
    unit = meta['unit']
    def fmt(v): return f"{v:,.2f}" if abs(v) < 10 else f"{v:,.1f}" if abs(v) < 1000 else f"{v:,.0f}"
    chg = c['change_vs_normal']
    direction = 'about the same as' if abs(chg) < 0.05 * max(abs(c['normal_1991_2020']), 1e-9) and abs(chg) < 0.2 else ('above' if chg > 0 else 'below')
    return (f"{meta['label']} in 2026–2030 is forecast to average {fmt(c['forecast_mean_2026_2030'])} {unit} "
            f"(80% range for 2030: {fmt(f[-1]['low80'])}–{fmt(f[-1]['high80'])} {unit}), "
            f"{direction} the 1991–2020 average of {fmt(c['normal_1991_2020'])} {unit}"
            + (f" ({'+' if chg > 0 else ''}{fmt(chg)} {unit})." if direction != 'about the same as' else '.'))


def main(charts=False):
    db = sqlite3.connect(DB.as_uri() + '?mode=ro', uri=True)
    spec = json.loads((ML / 'species_variables.json').read_text(encoding='utf-8'))
    catalog = json.loads((ROOT / 'data/pokedex/export/catalogo.json').read_text(encoding='utf-8'))
    names = {l['id']: l['name'] for l in catalog['locations']}
    scen = {sid: json.loads(p) for sid, p in db.execute('SELECT species_id,payload FROM scenarios')}
    data, dry_months = load_series(db)
    elev = json.loads((ML / 'data/power_extra_annual.json').read_text(encoding='utf-8'))['grid_elevation_m']
    OUT.mkdir(exist_ok=True)
    summary = []
    for sp in catalog['species']:
        sid = sp['id']; cfg = spec['species'][sid]; sc = scen[sid]
        locs = [(sc['reference_location'], 'species_habitat')] + [(l, 'relocation_candidate') for l in sc['candidate_locations']]
        result = dict(schema_version='1.0.0', species_id=sid, species_name=sp['name'], scientific_name=sp['scientific_name'],
                      forecast_years=HORIZON, trained_on=[FIRST_YEAR, LAST_OBSERVED],
                      brief_favorable_conditions=cfg['brief_favorable_conditions'],
                      brief_ranges_validated=False, why_these_variables=cfg['rationale'],
                      absolute_value_caution=cfg.get('absolute_value_caution'),
                      variables=[dict(id=v, **spec['indicators'][v]) for v in cfg['variables']], locations=[])
        for lid, role in locs:
            entry = dict(location_id=lid, name=names[lid], role=role, grid_elevation_m=elev[lid], indicators={})
            for v in cfg['variables']:
                series = data[lid].get(v)
                if series is None or all(x is None for x in series.values()):
                    entry['indicators'][v] = dict(available=False, reason='NASA POWER does not provide this variable for this grid cell (e.g. soil wetness over ocean).')
                    continue
                forecast_series.indicator = v
                s = forecast_series(series)
                s['available'] = True
                if v == 'precip_dry_season': s['dry_months'] = dry_months[lid]
                if v.startswith('precip'): s['data_caution'] = spec['rainfall_caution']
                s['summary_text'] = summary_text(spec['indicators'][v], s)
                entry['indicators'][v] = s
                bt = s['backtest']
                summary.append(dict(species_id=sid, location_id=lid, role=role, indicator=v, model=s['selected_model'],
                                    forecast_2030=s['forecast'][-1]['value'], change_vs_normal=s['context']['change_vs_normal'],
                                    backtest_skill_vs_no_change=bt['skill_vs_no_change'], backtest_years_inside_80=bt['years_inside_80_interval']))
            result['locations'].append(entry)
        (OUT / f'{sid}.json').write_text(json.dumps(result, ensure_ascii=False, indent=1, allow_nan=False), encoding='utf-8')
    (OUT / 'summary.json').write_text(json.dumps(dict(schema_version='1.0.0', forecast_years=HORIZON, records=summary), ensure_ascii=False, indent=1, allow_nan=False), encoding='utf-8')
    db.close()
    print(f'OK: {len(catalog["species"])} species files, {len(summary)} forecast series (2026–2030).')
    if charts:
        make_charts(spec)


def make_charts(spec):
    import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
    folder = OUT / 'charts'; folder.mkdir(exist_ok=True)
    for path in sorted(OUT.glob('*.json')):
        if path.name == 'summary.json': continue
        d = json.loads(path.read_text(encoding='utf-8'))
        ref = d['locations'][0]
        fig, axes = plt.subplots(1, 3, figsize=(15, 4), layout='constrained')
        for ax, var in zip(axes, d['variables']):
            s = ref['indicators'][var['id']]
            ax.set_title(f"{var['label']} ({var['unit']})", fontsize=10); ax.grid(alpha=.2)
            if not s['available']:
                ax.text(.5, .5, 'Not available here', ha='center', transform=ax.transAxes); continue
            ax.plot([o['year'] for o in s['observed']], [o['value'] for o in s['observed']], color='#182c42', lw=1.4, label='Observed (NASA POWER)')
            f = s['forecast']; yrs = [x['year'] for x in f]
            ax.fill_between(yrs, [x['low80'] for x in f], [x['high80'] for x in f], color='#8e44ad', alpha=.2, label='80% range')
            ax.plot(yrs, [x['value'] for x in f], color='#8e44ad', marker='o', ms=3, lw=2, label=f"Forecast ({s['selected_model'].replace('_', ' ')})")
            ax.axhline(s['context']['normal_1991_2020'], color='#888', ls=':', lw=1, label='1991–2020 average')
        axes[0].legend(fontsize=7.5, loc='best')
        fig.suptitle(f"{d['species_name']} · {ref['name']} · forecast 2026–2030", fontsize=12)
        fig.savefig(folder / f"{d['species_id']}.png", dpi=110); plt.close(fig)
    print(f'OK: charts in {folder}')


if __name__ == '__main__':
    main(charts='--charts' in sys.argv)
