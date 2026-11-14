"""Validación independiente del paquete; solo biblioteca estándar, sin red."""
import calendar
import hashlib
import json
import math
import sqlite3
import statistics
from pathlib import Path

ROOT = Path(__file__).resolve().parent

def read(path):
    return json.loads(path.read_text(encoding='utf-8'),
                      parse_constant=lambda value: (_ for _ in ()).throw(ValueError(value)))

def verify_numeric_cards(db, catalog):
    cards = read(ROOT / 'fichas-supervivencia.json')
    assert cards['schema_version'] == '2.0.0'
    assert len(cards['species']) == 15
    available_comparisons = missing_comparisons = 0
    extra = read(ROOT / 'nasa-power-extra-anual.json')
    for species in catalog['species']:
        sid = species['id']
        export = read(ROOT / 'export' / (sid + '.json'))
        card = cards['species'][sid]
        assert card == export['survival_card']
        assert len(card['requirements']) == 3
        ref = card['reference_location']
        assert card['biological_limits_available'] is False
        assert [r['indicator_id'] for r in card['requirements']] == [v['id'] for v in export['key_variables']['variables']]
        for req in card['requirements']:
            iid = req['indicator_id']
            assert type(req['value']) in (int, float) and math.isfinite(req['value'])
            assert req['unit'] == req['range']['unit']
            assert req['physiological_limit_validated'] is False
            per = {r['year']:r['value'] for r in card['comparison_series'][ref][iid]}
            years = sorted(y for y in per if 1981 <= y <= 2014)
            expected = [per[y] for y in years]
            assert req['period'] == dict(start_year=min(years), end_year=max(years), n_years=len(years))
            assert req['value'] == statistics.mean(expected)
            assert req['range']['min'] == min(expected) and req['range']['max'] == max(expected)
            sql = db.execute('SELECT value, range_min, range_max, unit, n_years, typeof(value) FROM survival_requirements WHERE species_id=? AND indicator_id=?', (sid,iid)).fetchone()
            assert sql == (req['value'],min(expected),max(expected),req['unit'],len(years),'real')
            if iid == 'precip_dry_season':
                # Independently select months using ONLY the pre-decision reference archive.
                monthly = [r for r in export['series'][ref]['monthly'] if r['year']<=2014]
                cycle = {m:statistics.mean(r['PRECTOTCORR'] for r in monthly if r['month']==m) for m in range(1,13)}
                assert req['months'] == sorted(sorted(cycle,key=lambda m:(cycle[m],m))[:4])
            for lid, comparisons in card['comparisons'].items():
                c = comparisons[iid]
                rows = card['comparison_series'][lid][iid]
                stored = db.execute('SELECT year,value FROM species_comparison_values WHERE species_id=? AND location_id=? AND indicator_id=? ORDER BY year',(sid,lid,iid)).fetchall()
                assert [(r['year'],r['value']) for r in rows] == stored
                for r in rows:
                    if iid == 'precip_dry_season':
                        expected_value = sum(m['PRECTOTCORR'] for m in export['series'][lid]['monthly'] if m['year']==r['year'] and m['month'] in req['months'])
                    else:
                        expected_value = next(x['value'] for x in export['key_variable_series'][lid][iid] if x['year']==r['year'])
                    assert math.isclose(r['value'],expected_value,abs_tol=1e-8)
                common = sorted(y for y in years if any(r['year']==y for r in rows))
                assert c['comparison_years'] == common and c['unit'] == req['unit']
                assert c['survival_verdict'] is None
                if not common:
                    missing_comparisons += 1
                    assert c['available'] is False and c['value'] is None and c['delta_from_reference'] is None
                    assert c['missing_reason']
                else:
                    available_comparisons += 1
                    assert c['available'] is True
                    ref_mean = statistics.mean(per[y] for y in common)
                    site_mean = statistics.mean(r['value'] for r in rows if r['year'] in common)
                    assert c['value'] == site_mean and c['reference_value'] == ref_mean
                    assert math.isclose(c['delta_from_reference'],site_mean-ref_mean,abs_tol=1e-10)
                source = c['source']
                assert hashlib.sha256((ROOT/source['file']).read_bytes()).hexdigest() == source['file_sha256']
                if 'original_response_sha256' in source:
                    assert source['original_response_sha256'] == extra['raw_response_sha256'][lid]
    assert missing_comparisons > 0
    print(f'OK: 45 fichas numéricas de variables; {available_comparisons} comparaciones disponibles y {missing_comparisons} faltantes explícitos; unidades, período, fuentes y estacionalidad verificados.')

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
        cards = read(ROOT / 'requisitos-ecologicos.json')
        for species in catalog['species']:
            sid = species['id']
            card = read(ROOT / 'export' / (sid + '.json'))['habitat_evidence']
            assert len(card['requirements']) == 3
            rows = db.execute('SELECT rank, requirement, status, nasa_proxy, sources FROM habitat_requirements WHERE species_id=? ORDER BY rank', (sid,)).fetchall()
            for r, row in zip(card['requirements'], rows):
                assert (r['rank'], r['requirement'], r['status'], r['nasa_proxy']) == row[:4] and json.loads(row[4]) == r['sources']
                assert r['status_label'] == cards['status_labels'][r['status']]
                assert r['nasa_proxy'] is None or r['nasa_proxy'] in [v['id'] for v in read(ROOT / 'export' / (sid + '.json'))['key_variables']['variables']]
        verify_numeric_cards(db, catalog)
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
        print('OK: integridad SQLite, conteos, 24 hashes NASA, 3240 agregaciones anuales, 15 exportaciones, 3 variables clave por especie recalculadas, 15 fichas de supervivencia y resultados estadísticos.')
    finally:
        db.close()

if __name__ == '__main__':
    main()
