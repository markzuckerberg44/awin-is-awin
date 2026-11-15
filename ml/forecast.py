"""Climate forecast 2026–2030 for the indicators on each species' survival card.

Model: an equal-weight ensemble of six simple statistical forecasts, averaged with a
global LightGBM model trained on all NASA series at once (other variables of the same
place are inputs). Prediction bands are calibrated with pooled out-of-sample errors.

Self-contained: reads data/pokedex/pokedex.sqlite (series identical to survival_card.comparison_series)
and writes ml/output/. It does not change the game data.

Usage (from the repository root):  python ml/forecast.py          (packages: ml/requirements.txt)
Optional charts:                     python ml/forecast.py --charts (also matplotlib)
"""
import json, sqlite3, sys
from functools import lru_cache
from pathlib import Path
import numpy as np

ML = Path(__file__).resolve().parent
ROOT = ML.parent
POKEDEX = ROOT / 'data/pokedex'
DB = POKEDEX / 'pokedex.sqlite'
OUT = ML / 'output'

FIRST_YEAR, LAST_OBSERVED = 1981, 2025
HORIZON = list(range(2026, 2031))          # forecast years
BACKTEST_TRAIN_END = 2020                   # backtest: train ≤ 2020, predict 2021–2025
NORMAL = (1991, 2020)                       # WMO-style reference period for "change vs normal"
BAND = (10, 90)                             # 80 % prediction interval from out-of-sample errors

MODELS = {
    'persistence': 'Last observed annual value',
    'historical_mean': 'Average of all training years (assumes no change)',
    'recent_mean': 'Average of the last 10 training years (assumes recent conditions persist)',
    'linear_trend': 'Least-squares straight line through the training years',
    'theil_sen_trend': 'Robust straight line (median of pairwise slopes), less sensitive to extreme years',
    'autoregressive_ridge': 'Recursive ridge regression on the previous three annual values (fixed L2=1)',
}


# ---------- data ----------

def load_series(db):
    """Exactly the species-specific series used by the numeric cards."""
    data, dry = {}, {}
    for sid, lid, iid, year, value in db.execute('SELECT species_id, location_id, indicator_id, year, value FROM species_comparison_values'):
        data.setdefault(sid, {}).setdefault(lid, {}).setdefault(iid, {})[year] = value
    for path in (POKEDEX/'export').glob('*.json'):
        if path.stem=='catalogo': continue
        d=json.loads(path.read_text(encoding='utf-8'))
        dry[d['species']['id']]=next((r['months'] for r in d['survival_card']['requirements'] if r['indicator_id']=='precip_dry_season'),None)
    return data, dry


# ---------- models ----------

def theil_sen(x, y):
    i, j = np.triu_indices(len(x), 1)
    slope = float(np.median((y[j] - y[i]) / (x[j] - x[i])))
    return slope, float(np.median(y - slope * x))


def predict(model, years, values, targets):
    x, y, t = np.asarray(years, float), np.asarray(values, float), np.asarray(targets, float)
    if model == 'persistence':
        return np.full(len(t),y[-1])
    if model == 'autoregressive_ridge':
        assert len(y)>=15 and np.all(np.diff(x)==1)
        center, scale = y.mean(), max(y.std(),1e-9)
        z=(y-center)/scale
        features=np.array([[1,z[i-1],z[i-2],z[i-3]] for i in range(3,len(z))])
        penalty=np.diag([0,1,1,1])
        coef=np.linalg.solve(features.T@features+penalty,features.T@z[3:])
        history=list(z); future={}
        for year in range(int(x[-1])+1,int(max(t))+1):
            next_value=float(np.dot([1,history[-1],history[-2],history[-3]],coef))
            history.append(next_value);future[year]=next_value*scale+center
        return np.array([future[int(year)] for year in t])
    if model == 'historical_mean':
        return np.full(len(t), y.mean())
    if model == 'recent_mean':
        return np.full(len(t), y[-10:].mean())
    if model == 'linear_trend':
        slope, intercept = np.polyfit(x, y, 1)
        return intercept + slope * t
    slope, intercept = theil_sen(x, y)
    return intercept + slope * t


SIMPLE_MODELS = list(MODELS)
MIN_TRAIN = 15                               # years of history needed before any forecast
CONTEXT = ('t2m_mean', 'rh2m_mean', 'precip_annual')   # same-place variables used as LightGBM inputs
DRY_FIRST_ORIGIN = 2014                      # dry months were defined with 1981–2014 data
FIRST_ORIGIN = 2000                          # first rolling origin used to measure errors (LightGBM needs earlier targets)
GBM_PARAMS = dict(n_estimators=300, learning_rate=0.03, num_leaves=15, min_child_samples=40, subsample=0.8,
                  subsample_freq=1, colsample_bytree=0.8, random_state=0, n_jobs=1, deterministic=True,
                  force_row_wise=True, verbose=-1)
METHOD = 'ensemble6_plus_lightgbm'
METHOD_DESCRIPTION = ('Average of (a) the mean of six simple forecasts (persistence, historical mean, recent mean, '
                      'linear trend, Theil-Sen trend, autoregressive ridge) and (b) a global LightGBM model trained '
                      'on every NASA series up to the cutoff year. Dry-season rainfall uses (a) only.')


class Engine:
    """Holds every distinct NASA series and the global LightGBM models, one per cutoff year.

    A model with cutoff c is trained only on targets in years <= c; nothing later can leak in.
    `perturb(year, value) -> value` is used by verify.py to prove that.
    """

    def __init__(self, db, perturb=None):
        f = perturb or (lambda year, value: value)
        data, dry = load_series(db)
        self.dry_months = dry
        self.series = {}                                  # (location, indicator, dry months) -> {year: value}
        for sid, by_loc in data.items():
            for lid, by_ind in by_loc.items():
                for iid, values in by_ind.items():
                    key = (lid, iid, tuple(dry[sid]) if iid == 'precip_dry_season' else None)
                    self.series[key] = {y: f(y, v) for y, v in values.items() if v is not None}
        self.context = {}
        for lid, iid, y, v in db.execute('SELECT location_id, indicator_id, year, value FROM key_indicator_values'):
            if iid in CONTEXT:
                self.context.setdefault(lid, {}).setdefault(iid, {})[y] = f(y, v)
        self.indicators = sorted({k[1] for k in self.series})
        self._models = {}

    # ----- LightGBM -----
    def features(self, values, lid, iid, origin, h):
        v = np.array([values[y] for y in sorted(values) if y <= origin], float)
        mu, sd = v.mean(), v.std() + 1e-9
        z = (v - mu) / sd
        row = list(z[-5:]) + [np.polyfit(range(10), z[-10:], 1)[0], np.polyfit(range(len(z)), z, 1)[0],
                               z[-10:].mean(), h, self.indicators.index(iid)]
        for other in CONTEXT:
            c = self.context.get(lid, {}).get(other)
            if c is None or other == iid:
                row += [np.nan] * 3; continue
            w = np.array([c[y] for y in sorted(c) if y <= origin], float)
            zz = (w - w.mean()) / (w.std() + 1e-9)
            row += [zz[-1], zz[-3:].mean(), np.polyfit(range(10), zz[-10:], 1)[0]]
        return row, mu, sd

    def gbm(self, cutoff):
        if cutoff not in self._models:
            import lightgbm as lgb
            X, Y = [], []
            for (lid, iid, months), d in self.series.items():
                if months is not None:
                    continue                              # dry-season definitions are not known before 2014
                first = min(d)
                for o in range(first + MIN_TRAIN - 1, cutoff):
                    for h in range(1, 6):
                        t = o + h
                        if t > cutoff or t not in d:
                            continue
                        assert t <= cutoff
                        row, mu, sd = self.features(d, lid, iid, o, h)
                        X.append(row); Y.append((d[t] - mu) / sd)
            self._models[cutoff] = lgb.LGBMRegressor(**GBM_PARAMS).fit(np.array(X), np.array(Y))
        return self._models[cutoff]

    # ----- one forecast -----
    def components(self, values, lid, iid, months, cutoff, targets):
        """Point forecasts for `targets` using only `values` up to `cutoff`."""
        years = [y for y in sorted(values) if y <= cutoff]
        tv = [values[y] for y in years]
        lo, hi = BOUNDS.get(iid, (None, None))
        clip = lambda p: np.clip(p, lo if lo is not None else -np.inf, hi if hi is not None else np.inf)
        simple = {m: clip(predict(m, years, tv, targets)) for m in SIMPLE_MODELS}
        ens = np.mean(list(simple.values()), axis=0)
        out = dict(simple, ensemble6=ens)
        if months is None:
            model = self.gbm(cutoff)
            rows = [self.features(values, lid, iid, cutoff, t - cutoff) for t in targets]
            g = model.predict(np.array([r[0] for r in rows])) * np.array([r[2] for r in rows]) + np.array([r[1] for r in rows])
            out['lightgbm'] = clip(g)
            out['combined'] = clip((ens + out['lightgbm']) / 2)
        else:
            out['combined'] = ens
        sd = float(np.std(tv)) + 1e-9
        return out, sd

    # ----- calibrated bands -----
    @lru_cache(maxsize=None)
    def residual_pool(self, cutoff, dry):
        """Standardized out-of-sample errors of the combined forecast, by horizon, from every distinct
        series of the same kind, for origins whose target years are all <= cutoff."""
        pool = {h: [] for h in range(1, 6)}
        for (lid, iid, months), d in self.series.items():
            if (months is not None) != dry:
                continue
            first = DRY_FIRST_ORIGIN if dry else max(min(d) + MIN_TRAIN - 1, FIRST_ORIGIN)
            for o in range(first, cutoff):
                targets = [t for t in range(o + 1, min(o + 5, cutoff) + 1) if t in d]
                if not targets:
                    continue
                comp, sd = self.components(d, lid, iid, months, o, targets)
                for t, p in zip(targets, comp['combined']):
                    pool[t - o].append((d[t] - p) / sd)
        return {h: np.array(v) for h, v in pool.items()}

    def forecast(self, values, lid, iid, months, cutoff, targets):
        comp, sd = self.components(values, lid, iid, months, cutoff, targets)
        pool = self.residual_pool(cutoff, months is not None)
        lo_b, hi_b = BOUNDS.get(iid, (None, None))
        rows = []
        for t, p in zip(targets, comp['combined']):
            res = pool[min(t - cutoff, 5)]
            q_lo, q_hi = np.percentile(res, BAND)
            lo, hi = p + min(q_lo, 0) * sd, p + max(q_hi, 0) * sd
            if lo_b is not None: lo, hi = max(lo, lo_b), max(hi, lo_b)
            if hi_b is not None: lo, hi = min(lo, hi_b), min(hi, hi_b)
            rows.append(dict(year=int(t), value=r(p), low80=r(lo), high80=r(hi)))
        return rows, comp

    def cv_mae(self, values, lid, iid, months, cutoff):
        """Mean absolute out-of-sample error of each component for this series (origins up to cutoff-1)."""
        errs = {}
        first = DRY_FIRST_ORIGIN if months is not None else max(min(values) + MIN_TRAIN - 1, FIRST_ORIGIN)
        for o in range(first, cutoff):
            targets = [t for t in range(o + 1, min(o + 5, cutoff) + 1) if t in values]
            if not targets: continue
            comp, _ = self.components(values, lid, iid, months, o, targets)
            for k, p in comp.items():
                errs.setdefault(k, []).extend(abs(values[t] - q) for t, q in zip(targets, p))
        return {k: r(np.mean(v)) for k, v in errs.items()}


def r(x, n=3): return round(float(x), n)


BOUNDS = {'rh2m_mean': (0, 100), 'cloud_cover': (0, 100), 'soil_wetness': (0, 1), 'precip_annual': (0, None), 'precip_dry_season': (0, None), 'wind_speed': (0, None), 'thermal_range': (0,None)}


def forecast_series(engine, values_by_year, lid, iid, months=None):
    values = {y: v for y, v in values_by_year.items() if v is not None}
    years = sorted(values)
    # Backtest: pretend we are in 2020, forecast 2021–2025 and compare with what happened.
    b_rows, _ = engine.forecast(values, lid, iid, months, BACKTEST_TRAIN_END, list(range(2021, 2026)))
    for row in b_rows: row['observed'] = r(values[row['year']])
    err = [row['observed'] - row['value'] for row in b_rows]
    base = np.mean([v for y, v in values.items() if y <= BACKTEST_TRAIN_END])
    base_mae = np.mean([abs(row['observed'] - base) for row in b_rows])
    persistence_mae = np.mean([abs(row['observed'] - values[BACKTEST_TRAIN_END]) for row in b_rows])
    backtest = dict(train_period=[years[0], BACKTEST_TRAIN_END], test_period=[2021, 2025], method=METHOD, years=b_rows,
                    mae=r(np.mean(np.abs(err))), mae_if_no_change=r(base_mae),
                    skill_vs_no_change=r(1 - np.mean(np.abs(err)) / base_mae) if base_mae > 0 else None,
                    mae_persistence=r(persistence_mae),
                    skill_vs_persistence=r(1 - np.mean(np.abs(err)) / persistence_mae) if persistence_mae > 0 else None,
                    years_inside_80_interval=sum(row['low80'] <= row['observed'] <= row['high80'] for row in b_rows))
    # 2025 is known: predict it from data up to 2024 and compare.
    h_rows, _ = engine.forecast(values, lid, iid, months, 2024, [2025])
    h_rows[0]['observed'] = r(values[2025])
    hindcast = dict(train_end=2024, target_year=2025, method=METHOD, prediction=h_rows[0],
                    absolute_error=r(abs(h_rows[0]['value'] - values[2025])),
                    inside_80_interval=h_rows[0]['low80'] <= h_rows[0]['observed'] <= h_rows[0]['high80'],
                    kind='retrospective_holdout_not_future_forecast')
    # Final forecast: all data 1981–2025, forecast 2026–2030.
    f_rows, comp = engine.forecast(values, lid, iid, months, LAST_OBSERVED, HORIZON)
    normal = float(np.mean([v for y, v in values.items() if NORMAL[0] <= y <= NORMAL[1]]))
    recent = float(np.mean([v for y, v in values.items() if 2016 <= y <= 2025]))
    slope, _ = theil_sen(np.array(years, float), np.array([values[y] for y in years], float))
    return dict(
        observed=[dict(year=y, value=r(values[y])) for y in years],
        forecast=f_rows, hindcast_2025=hindcast,
        selected_model=METHOD, model_description=METHOD_DESCRIPTION if months is None else
            'Mean of six simple forecasts (LightGBM is not used: the dry months were only defined in 2014).',
        components_2026_2030={k: [r(x) for x in v] for k, v in comp.items()},
        cv_mae_by_model=engine.cv_mae(values, lid, iid, months, LAST_OBSERVED),
        interval_note=('80% band from pooled, standardized out-of-sample errors of the combined forecast '
                       '(all distinct series, same horizon, only years up to the training cutoff).'),
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
            f"(80% band for 2030: {fmt(f[-1]['low80'])}–{fmt(f[-1]['high80'])} {unit}; coverage is not guaranteed), "
            f"{direction} the 1991–2020 average of {fmt(c['normal_1991_2020'])} {unit}"
            + (f" ({'+' if chg > 0 else ''}{fmt(chg)} {unit})." if direction != 'about the same as' else '.'))


def main(charts=False):
    db = sqlite3.connect(DB.as_uri() + '?mode=ro', uri=True)
    spec = json.loads((POKEDEX / 'variables-clave.json').read_text(encoding='utf-8'))
    catalog = json.loads((POKEDEX / 'export/catalogo.json').read_text(encoding='utf-8'))
    names = {l['id']: l['name'] for l in catalog['locations']}
    scen = {sid: json.loads(p) for sid, p in db.execute('SELECT species_id,payload FROM scenarios')}
    data, dry_months = load_series(db)
    engine = Engine(db)
    done = {}                                   # distinct series are forecast once and shared by species
    elev = json.loads((POKEDEX / 'nasa-power-extra-anual.json').read_text(encoding='utf-8'))['grid_elevation_m']
    OUT.mkdir(exist_ok=True)
    summary = []
    for sp in catalog['species']:
        sid = sp['id']; cfg = spec['species'][sid]; sc = scen[sid]
        locs = [(sc['reference_location'], 'species_habitat')] + [(l, 'relocation_candidate') for l in sc['candidate_locations']]
        card=json.loads((POKEDEX/'export'/f'{sid}.json').read_text(encoding='utf-8'))['survival_card']
        card_defs={r['indicator_id']:r for r in card['requirements']}
        result = dict(schema_version='3.0.0', species_id=sid, species_name=sp['name'], scientific_name=sp['scientific_name'],
                      series_source='pokedex.sqlite:species_comparison_values; identical to survival_card.comparison_series',
                      data_provider='NASA POWER',forecast_provider='Project model, not a NASA prediction',
                      forecast_years=HORIZON, trained_on=[FIRST_YEAR, LAST_OBSERVED],
                      brief_favorable_conditions=cfg['brief_favorable_conditions'],
                      brief_ranges_validated=False, why_these_variables=cfg['rationale'],
                      absolute_value_caution=cfg.get('absolute_value_caution'),
                      variables=[dict(id=v, **{**spec['indicators'][v],'aggregation':card_defs[v]['aggregation']}) for v in cfg['variables']], locations=[])
        for lid, role in locs:
            entry = dict(location_id=lid, name=names[lid], role=role, grid_elevation_m=elev[lid], indicators={})
            for v in cfg['variables']:
                series = data[sid].get(lid,{}).get(v)
                if series is None or all(x is None for x in series.values()):
                    entry['indicators'][v] = dict(available=False, reason='NASA POWER does not provide this variable for this grid cell (e.g. soil wetness over ocean).')
                    continue
                months = tuple(dry_months[sid]) if v == 'precip_dry_season' else None
                key = (lid, v, months)
                if key not in done:
                    done[key] = forecast_series(engine, series, lid, v, months)
                s = json.loads(json.dumps(done[key]))
                s['available'] = True
                if v == 'precip_dry_season': s['dry_months'] = dry_months[sid]
                s['source']=card['comparisons'][lid][v]['source']
                if v.startswith('precip'): s['data_caution'] = spec['rainfall_caution']
                s['summary_text'] = summary_text(spec['indicators'][v], s)
                entry['indicators'][v] = s
                bt = s['backtest']
                summary.append(dict(species_id=sid, location_id=lid, role=role, indicator=v, series_key=f"{lid}|{v}|{','.join(map(str, months or ()))}", model=s['selected_model'],
                                    forecast_2030=s['forecast'][-1]['value'], change_vs_normal=s['context']['change_vs_normal'],
                                    backtest_skill_vs_no_change=bt['skill_vs_no_change'], backtest_skill_vs_persistence=bt['skill_vs_persistence'],
                                    backtest_years_inside_80=bt['years_inside_80_interval'], hindcast_2025_inside_80=s['hindcast_2025']['inside_80_interval']))
            result['locations'].append(entry)
        (OUT / f'{sid}.json').write_text(json.dumps(result, ensure_ascii=False, indent=1, allow_nan=False), encoding='utf-8')
    distinct = list({x['series_key']: x for x in summary}.values())
    (OUT / 'summary.json').write_text(json.dumps(dict(schema_version='3.0.0', method=METHOD, method_description=METHOD_DESCRIPTION,
        forecast_years=HORIZON, records=summary, distinct_series=len(distinct),
        backtest_2021_2025=dict(
            interval_coverage=r(sum(x['backtest_years_inside_80'] for x in distinct) / (5 * len(distinct))),
            series_better_than_historical_mean=sum(x['backtest_skill_vs_no_change'] > 0 for x in distinct),
            series_better_than_persistence=sum(x['backtest_skill_vs_persistence'] > 0 for x in distinct),
            median_skill_vs_historical_mean=r(np.median([x['backtest_skill_vs_no_change'] for x in distinct])),
            median_skill_vs_persistence=r(np.median([x['backtest_skill_vs_persistence'] for x in distinct]))),
        hindcast_2025_interval_coverage=r(np.mean([x['hindcast_2025_inside_80'] for x in distinct])),
        note='Statistics count each distinct series once. Neighbouring sites and related indicators are still correlated.'),
        ensure_ascii=False, indent=1, allow_nan=False), encoding='utf-8')
    db.close()
    print(f'OK: {len(catalog["species"])} species files, {len(summary)} species series ({len(distinct)} distinct), 2026–2030.')
    if charts:
        make_charts(spec)


def make_charts(spec):
    import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
    folder = OUT / 'charts'; folder.mkdir(exist_ok=True)
    for path in sorted(OUT.glob('*.json')):
        if path.name == 'summary.json': continue
        d = json.loads(path.read_text(encoding='utf-8'))
        ref = d['locations'][0]
        fig, axes = plt.subplots(1, len(d['variables']), figsize=(5*len(d['variables']), 4), layout='constrained',squeeze=False)
        axes=axes[0]
        for ax, var in zip(axes, d['variables']):
            s = ref['indicators'][var['id']]
            ax.set_title(f"{var['label']} ({var['unit']})", fontsize=10); ax.grid(alpha=.2)
            if not s['available']:
                ax.text(.5, .5, 'Not available here', ha='center', transform=ax.transAxes); continue
            ax.plot([o['year'] for o in s['observed']], [o['value'] for o in s['observed']], color='#182c42', lw=1.4, label='Observed (NASA POWER)')
            f = s['forecast']; yrs = [x['year'] for x in f]
            ax.fill_between(yrs, [x['low80'] for x in f], [x['high80'] for x in f], color='#8e44ad', alpha=.2, label='80% band (calibrated)')
            ax.plot(yrs, [x['value'] for x in f], color='#8e44ad', marker='o', ms=3, lw=2, label='Forecast (ensemble + LightGBM)')
            ax.axhline(s['context']['normal_1991_2020'], color='#888', ls=':', lw=1, label='1991–2020 average')
            ax.legend(fontsize=6.5,loc='best')
        fig.supxlabel('Regional NASA grid values, not physiological limits. Project forecast, not a NASA prediction.',fontsize=8)
        fig.suptitle(f"{d['species_name']} · {ref['name']} · forecast 2026–2030", fontsize=12)
        fig.savefig(folder / f"{d['species_id']}.png", dpi=110); plt.close(fig)
    print(f'OK: charts in {folder}')


if __name__ == '__main__':
    main(charts='--charts' in sys.argv)
