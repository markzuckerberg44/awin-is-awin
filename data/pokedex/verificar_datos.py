"""Validación independiente del paquete; solo biblioteca estándar, sin red."""
import calendar
import hashlib
import json
import math
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent

def read(path):
    return json.loads(path.read_text(encoding='utf-8'),
                      parse_constant=lambda value: (_ for _ in ()).throw(ValueError(value)))

def main():
    catalog = read(ROOT / 'export/catalogo.json')
    db = sqlite3.connect((ROOT / 'pokedex.sqlite').as_uri() + '?mode=ro', uri=True)
    try:
        assert db.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
        assert not db.execute('PRAGMA foreign_key_check').fetchall()
        for table, count in catalog['counts'].items():
            assert db.execute('SELECT COUNT(*) FROM ' + table).fetchone()[0] == count
        for source in read(ROOT / 'manifest-nasa.json')['sources']:
            path = ROOT / source['path']
            assert hashlib.sha256(path.read_bytes()).hexdigest() == source['sha256']
            raw = read(path)['properties']['parameter']
            for year in range(1981, 2026):
                for var in ('T2M', 'RH2M', 'PRECTOTCORR'):
                    days = [calendar.monthrange(year, m)[1] for m in range(1, 13)]
                    total = sum(raw[var][f'{year}{m:02}'] * days[m-1] for m in range(1, 13))
                    expected = total if var == 'PRECTOTCORR' else total / sum(days)
                    actual = db.execute("SELECT value FROM observations WHERE location_id=? AND date=? AND variable=? AND frequency='annual'", (source['location_id'], str(year), var)).fetchone()[0]
                    assert math.isclose(actual, expected, abs_tol=1e-8)
        for species in catalog['species']:
            data = read(ROOT / 'export' / (species['id'] + '.json'))
            assert data['species']['id'] == species['id']
            scenario = data['scenario']
            stored = json.loads(db.execute('SELECT payload FROM scenarios WHERE species_id=?', (species['id'],)).fetchone()[0])
            assert scenario == stored
            for lid, series in data['series'].items():
                assert len(series['monthly']) == 540 and len(series['annual']) == 45
                for frequency, rows in [('monthly', series['monthly']), ('annual', series['annual'])]:
                    for row in rows:
                        date = row['date'] if frequency == 'monthly' else str(row['year'])
                        for var in ('T2M', 'RH2M', 'PRECTOTCORR'):
                            actual = db.execute('SELECT value FROM observations WHERE location_id=? AND date=? AND variable=? AND frequency=?', (lid, date, var, frequency)).fetchone()[0]
                            assert math.isclose(row[var], actual, abs_tol=1e-8)
        spec = read(ROOT / 'variables-clave.json')
        extra = read(ROOT / 'nasa-power-extra-anual.json')
        for species in catalog['species']:
            sid = species['id']
            ranks = db.execute('SELECT indicator_id FROM species_key_variables WHERE species_id=? ORDER BY rank', (sid,)).fetchall()
            assert [r[0] for r in ranks] == spec['species'][sid]['variables'] and len(ranks) == 3
            data = read(ROOT / 'export' / (sid + '.json'))
            assert [v['id'] for v in data['key_variables']['variables']] == spec['species'][sid]['variables']
            for lid, per in data['key_variable_series'].items():
                for iid, rows in per.items():
                    stored = db.execute('SELECT year, value FROM key_indicator_values WHERE location_id=? AND indicator_id=? ORDER BY year', (lid, iid)).fetchall()
                    assert [(r['year'], r['value']) for r in rows] == [tuple(s) for s in stored]
                    if not rows:
                        assert iid in data['key_variables']['not_available'][lid]
        # Recalcular variables clave desde las observaciones y el archivo extra de NASA.
        for (lid,) in db.execute('SELECT id FROM locations'):
            months = {(int(d[:4]), int(d[5:])): v for d, v in db.execute("SELECT date, value FROM observations WHERE location_id=? AND variable='PRECTOTCORR' AND frequency='monthly'", (lid,))}
            cycle = {m: sum(months[(y, m)] for y in range(1981, 2026)) / 45 for m in range(1, 13)}
            dry = sorted(sorted(cycle, key=lambda m: (cycle[m], m))[:4])
            assert dry == [r[0] for r in db.execute('SELECT month FROM dry_season WHERE location_id=? ORDER BY month', (lid,))]
            for year in range(1981, 2026):
                checks = {'precip_dry_season': sum(months[(year, m)] for m in dry)}
                for iid, var in (('t2m_mean', 'T2M'), ('rh2m_mean', 'RH2M'), ('precip_annual', 'PRECTOTCORR')):
                    checks[iid] = db.execute("SELECT value FROM observations WHERE location_id=? AND date=? AND variable=? AND frequency='annual'", (lid, str(year), var)).fetchone()[0]
                for iid, value in extra['series'].get(lid, {}).items():
                    if value[str(year)] is not None:
                        checks[iid] = value[str(year)]
                for iid, expected in checks.items():
                    actual = db.execute('SELECT value FROM key_indicator_values WHERE location_id=? AND indicator_id=? AND year=?', (lid, iid, year)).fetchone()[0]
                    assert math.isclose(actual, expected, abs_tol=1e-8)
        invalid = 0
        for (payload,) in db.execute('SELECT payload FROM trends'):
            t = json.loads(payload)
            assert 0 <= t['p_original'] <= 1
            if t['corrected_test_valid']:
                assert 0 <= t['p_corrected'] <= 1
            else:
                invalid += 1
                assert t['p_corrected'] is None and t['invalid_reason']
        assert invalid == 4
        print('OK: integridad SQLite, conteos, 24 hashes NASA, 3240 agregaciones anuales, 15 exportaciones, 3 variables clave por especie recalculadas y resultados estadísticos.')
    finally:
        db.close()

if __name__ == '__main__':
    main()
