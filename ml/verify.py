"""Checks ml/output against the inputs. Usage (repository root): python ml/verify.py"""
import json, math, sqlite3, sys
from pathlib import Path
import numpy as np

ML = Path(__file__).resolve().parent
sys.path.insert(0, str(ML))
import forecast as F


def main():
    spec = json.loads((ML / 'species_variables.json').read_text(encoding='utf-8'))
    catalog = json.loads((F.ROOT / 'data/pokedex/export/catalogo.json').read_text(encoding='utf-8'))
    db = sqlite3.connect(F.DB.as_uri() + '?mode=ro', uri=True)
    data, _ = F.load_series(db)
    rng = np.random.default_rng(1)
    n = 0
    for sp in catalog['species']:
        d = json.loads((ML / 'output' / f"{sp['id']}.json").read_text(encoding='utf-8'))
        assert [v['id'] for v in d['variables']] == spec['species'][sp['id']]['variables'] and len(d['variables']) == 3
        assert d['forecast_years'] == [2026, 2027, 2028, 2029, 2030]
        for loc in d['locations']:
            for v, s in loc['indicators'].items():
                if not s['available']:
                    assert all(x is None for x in data[loc['location_id']].get(v, {None: None}).values())
                    continue
                n += 1
                # Observed values match the inputs.
                src = {y: x for y, x in data[loc['location_id']][v].items() if x is not None}
                assert [o['year'] for o in s['observed']] == sorted(src)
                assert all(math.isclose(o['value'], round(src[o['year']], 3), abs_tol=1e-9) for o in s['observed'])
                # Forecast covers 2026–2030 with a coherent interval.
                assert [f['year'] for f in s['forecast']] == F.HORIZON
                assert all(f['low80'] <= f['value'] <= f['high80'] for f in s['forecast'])
                # Backtest never sees 2021–2025: replacing them with noise changes nothing.
                noisy = {y: (x if y <= 2020 else x + rng.normal(0, 50)) for y, x in src.items()}
                F.forecast_series.indicator = v
                again = F.forecast_series(noisy)['backtest']
                assert again['selected_model'] == s['backtest']['selected_model']
                assert [r['value'] for r in again['years']] == [r['value'] for r in s['backtest']['years']]
                inside = sum(r['low80'] <= r['observed'] <= r['high80'] for r in s['backtest']['years'])
                assert inside == s['backtest']['years_inside_80_interval']
    summary = json.loads((ML / 'output/summary.json').read_text(encoding='utf-8'))
    assert len(summary['records']) == n
    print(f'OK: {len(catalog["species"])} species, {n} forecast series, 2026–2030 horizon, intervals coherent, backtest free of 2021–2025 data.')


if __name__ == '__main__':
    main()
