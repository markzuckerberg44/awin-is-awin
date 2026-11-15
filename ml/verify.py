"""Checks ml/output against the inputs and proves the forecasts cannot see future data.

Usage (repository root): python ml/verify.py
"""
import json, math, sqlite3, sys
from pathlib import Path
import numpy as np

ML = Path(__file__).resolve().parent
sys.path.insert(0, str(ML))
import forecast as F


def series_of(data, sid, lid, v):
    return {y: x for y, x in data[sid].get(lid, {}).get(v, {}).items() if x is not None}


def main():
    spec = json.loads((F.POKEDEX / 'variables-clave.json').read_text(encoding='utf-8'))
    catalog = json.loads((F.POKEDEX / 'export/catalogo.json').read_text(encoding='utf-8'))
    db = sqlite3.connect(F.DB.as_uri() + '?mode=ro', uri=True)
    data, dry = F.load_series(db)
    engine = F.Engine(db)
    rng = np.random.default_rng(1)
    n, checked, sample = 0, set(), []
    for sp in catalog['species']:
        sid = sp['id']
        d = json.loads((ML / 'output' / f'{sid}.json').read_text(encoding='utf-8'))
        assert [v['id'] for v in d['variables']] == spec['species'][sid]['variables']
        card = json.loads((F.POKEDEX / 'export' / f'{sid}.json').read_text(encoding='utf-8'))['survival_card']
        assert d['forecast_years'] == [2026, 2027, 2028, 2029, 2030]
        for loc in d['locations']:
            lid = loc['location_id']
            for v, s in loc['indicators'].items():
                if not s['available']:
                    assert all(x is None for x in data[sid].get(lid, {}).get(v, {None: None}).values())
                    continue
                n += 1
                src = series_of(data, sid, lid, v)
                # Observed values are exactly the card's NASA series.
                assert src == {r['year']: r['value'] for r in card['comparison_series'][lid][v]}
                assert [o['year'] for o in s['observed']] == sorted(src)
                assert all(math.isclose(o['value'], round(src[o['year']], 3), abs_tol=1e-9) for o in s['observed'])
                # Forecast covers 2026–2030 with a coherent band inside physical bounds.
                assert [f['year'] for f in s['forecast']] == F.HORIZON
                lo, hi = F.BOUNDS.get(v, (None, None))
                for f in s['forecast'] + s['backtest']['years'] + [s['hindcast_2025']['prediction']]:
                    assert f['low80'] <= f['value'] <= f['high80']
                    assert (lo is None or f['low80'] >= lo) and (hi is None or f['high80'] <= hi)
                months = tuple(dry[sid]) if v == 'precip_dry_season' else None
                key = (lid, v, months)
                if v == 'precip_dry_season':
                    assert s['dry_months'] == next(r['months'] for r in card['requirements'] if r['indicator_id'] == v)
                    assert 'lightgbm' not in s['components_2026_2030']
                inside = sum(r['low80'] <= r['observed'] <= r['high80'] for r in s['backtest']['years'])
                assert inside == s['backtest']['years_inside_80_interval']
                if key in checked:
                    continue
                checked.add(key)
                # The series' own 2021–2025 values cannot change the backtest...
                noisy = {y: (x if y <= 2020 else x + rng.normal(0, 50)) for y, x in src.items()}
                again = F.forecast_series(engine, noisy, lid, v, months)
                assert again['backtest']['years'] == [dict(r, observed=F.r(noisy[r['year']])) for r in s['backtest']['years']]
                # ...and its own 2025 value cannot change the 2025 hindcast.
                noisy_2025 = {y: (x if y <= 2024 else x + 10000) for y, x in src.items()}
                h = F.forecast_series(engine, noisy_2025, lid, v, months)['hindcast_2025']['prediction']
                assert (h['value'], h['low80'], h['high80']) == (s['hindcast_2025']['prediction']['value'],
                                                                s['hindcast_2025']['prediction']['low80'],
                                                                s['hindcast_2025']['prediction']['high80'])
                if len(sample) < 12 and (months is None or len(sample) % 4 == 0):
                    sample.append((key, src, s))
    # Global check: corrupt EVERY series (and the LightGBM inputs) after 2020. The global model,
    # the calibration errors and therefore the backtest must not move at all.
    shaken = F.Engine(db, perturb=lambda year, value: value + 1000.0 if year > 2020 else value)
    for (lid, v, months), src, s in sample:
        noisy = {y: (x + 1000.0 if y > 2020 else x) for y, x in src.items()}
        b = shaken.forecast(noisy, lid, v, months, F.BACKTEST_TRAIN_END, list(range(2021, 2026)))[0]
        assert [(r['value'], r['low80'], r['high80']) for r in b] == \
               [(r['value'], r['low80'], r['high80']) for r in s['backtest']['years']], (lid, v)
    summary = json.loads((ML / 'output/summary.json').read_text(encoding='utf-8'))
    assert len(summary['records']) == n and summary['distinct_series'] == len(checked)
    db.close()
    print(f'OK: {len(catalog["species"])} species, {n} species series ({len(checked)} distinct), 2026–2030 horizon, '
          f'bands coherent and bounded, no 2021–2025 leakage into the backtest (own series and all series via LightGBM), '
          f'no 2025 leakage into the hindcast.')


if __name__ == '__main__':
    main()
