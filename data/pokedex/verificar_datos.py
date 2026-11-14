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
        print('OK: integridad SQLite, conteos, 24 hashes NASA, 3240 agregaciones anuales, 15 exportaciones y resultados estadísticos.')
    finally:
        db.close()

if __name__ == '__main__':
    main()
