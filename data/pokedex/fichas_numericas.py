"""Numeric reference cards. No physiological limits are inferred from climate."""
import hashlib
import json
import math
import statistics

SCHEMA = '2.0.0'
RULE = ('Compare the same indicator, unit, annual aggregation and years. Values describe '
        'the historical regional grid cell, not measured physiological tolerances. '
        'A difference or an out-of-range value does not establish survival or death.')
MEDIA = {'t2m_mean': 'air', 't2m_max_mean': 'air', 't2m_min_mean': 'air',
         'thermal_range': 'air', 'rh2m_mean': 'air', 'precip_annual': 'precipitation',
         'precip_dry_season': 'precipitation', 'soil_wetness': 'soil',
         'cloud_cover': 'atmosphere', 'surface_temp_mean': 'surface_skin',
         'surface_temp_warmest_month': 'surface_skin', 'wind_speed': 'air'}


def summary(per, years):
    selected = [per[y] for y in years]
    if not selected:
        return dict(available=False, value=None, minimum=None, maximum=None,
                    standard_deviation=None, n_years=0, start_year=None, end_year=None)
    assert all(type(v) in (int, float) and math.isfinite(v) for v in selected)
    return dict(available=True, value=statistics.mean(selected), minimum=min(selected),
                maximum=max(selected), standard_deviation=statistics.stdev(selected) if len(selected)>1 else 0.0,
                n_years=len(selected), start_year=min(years), end_year=max(years))


def build_numeric_cards(db, root, catalog, spec, values, series, scenarios, archive_end):
    manifest = json.loads((root/'manifest-nasa.json').read_text(encoding='utf-8'))
    extra_path = root/'nasa-power-extra-anual.json'
    extra = json.loads(extra_path.read_text(encoding='utf-8'))
    extra_sha = hashlib.sha256(extra_path.read_bytes()).hexdigest()
    locations = {loc['id']: loc for loc in catalog['locations']}

    def provenance(lid, iid):
        if iid in {'t2m_mean', 'rh2m_mean', 'precip_annual', 'precip_dry_season'}:
            src = next(s for s in manifest['sources'] if s['location_id']==lid)
            return dict(provider='NASA POWER', url=src['url'], file=src['path'],
                        file_sha256=src['sha256'], parameter=spec['indicators'][iid]['source'])
        loc = locations[lid]
        return dict(provider='NASA POWER', url=extra['query_template'].format(
                    lat=format(loc['latitude'],'g'), lon=format(loc['longitude'],'g')),
                    file=extra_path.name, file_sha256=extra_sha,
                    original_response_sha256=extra['raw_response_sha256'].get(lid),
                    parameter=spec['indicators'][iid]['source'])

    db.executescript('''
    CREATE TABLE survival_requirements(
      species_id TEXT REFERENCES species(id), rank INTEGER CHECK(rank BETWEEN 1 AND 3),
      indicator_id TEXT REFERENCES key_indicators(id), value REAL NOT NULL CHECK(typeof(value) IN ('real','integer')),
      range_min REAL NOT NULL, range_max REAL NOT NULL, unit TEXT NOT NULL,
      start_year INTEGER NOT NULL, end_year INTEGER NOT NULL, n_years INTEGER NOT NULL,
      reference_location TEXT REFERENCES locations(id), value_kind TEXT NOT NULL,
      physiological_limit_validated INTEGER NOT NULL CHECK(physiological_limit_validated=0),
      source TEXT NOT NULL CHECK(json_valid(source)), PRIMARY KEY(species_id,rank),
      CHECK(range_min<=value AND value<=range_max));
    CREATE TABLE species_comparison_values(
      species_id TEXT REFERENCES species(id), location_id TEXT REFERENCES locations(id),
      indicator_id TEXT REFERENCES key_indicators(id), year INTEGER NOT NULL, value REAL NOT NULL,
      PRIMARY KEY(species_id,location_id,indicator_id,year));
    ''')
    cards = {}
    for sp in catalog['species']:
        sid, ref = sp['id'], sp['reference_location']
        lids = [ref] + scenarios[sid]['candidate_locations']
        reqs, comparisons, annual = [], {lid: {} for lid in lids}, {lid: {} for lid in lids}
        baseline_rows = [r for r in series[ref]['monthly'] if r['year']<=archive_end]
        cycle = {m: statistics.mean(r['PRECTOTCORR'] for r in baseline_rows if r['month']==m) for m in range(1,13)}
        dry = sorted(sorted(cycle, key=lambda m:(cycle[m],m))[:4])
        for rank, iid in enumerate(spec['species'][sid]['variables'],1):
            meta = spec['indicators'][iid]
            per_site = {}
            for lid in lids:
                if iid=='precip_dry_season':
                    # Reference months fixed before the decision, identical for every candidate.
                    per = {y:sum(r['PRECTOTCORR'] for r in series[lid]['monthly']
                                 if r['year']==y and r['month'] in dry) for y in range(1981,2026)}
                else:
                    per = values[lid].get(iid,{})
                per_site[lid] = per
                annual[lid][iid] = [dict(year=y,value=x) for y,x in sorted(per.items())]
                db.executemany('INSERT INTO species_comparison_values VALUES (?,?,?,?,?)',
                               [(sid,lid,iid,y,x) for y,x in sorted(per.items())])
            reference = per_site[ref]
            years = sorted(y for y in reference if 1981<=y<=archive_end)
            stats = summary(reference,years)
            assert stats['available'], (sid,iid,'Reference data required for a numeric card')
            aggregation = (f'Annual rainfall sum over reference months {dry}; months selected using only 1981–{archive_end}, fixed for all locations.'
                           if iid=='precip_dry_season' else meta['aggregation'])
            req = dict(rank=rank, indicator_id=iid, label=meta['label'], value=stats['value'],
                       unit=meta['unit'], range=dict(min=stats['minimum'],max=stats['maximum'],unit=meta['unit']),
                       standard_deviation=stats['standard_deviation'], value_kind='regional_climate_reference',
                       range_kind='observed_min_max_of_annual_indicator', medium=MEDIA[iid],
                       aggregation=aggregation, period=dict(start_year=stats['start_year'],end_year=stats['end_year'],n_years=stats['n_years']),
                       reference_location=ref, physiological_limit_validated=False,
                       allowed_use='regional_context_only' if sp['system']!='terrestrial' else 'regional_climate_comparison',
                       sources=[provenance(ref,iid)], months=dry if iid=='precip_dry_season' else None)
            reqs.append(req)
            db.execute('INSERT INTO survival_requirements VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
                       (sid,rank,iid,req['value'],req['range']['min'],req['range']['max'],req['unit'],
                        stats['start_year'],stats['end_year'],stats['n_years'],ref,req['value_kind'],0,json.dumps(req['sources'],ensure_ascii=False)))
            for lid in lids:
                common = sorted(y for y in years if y in per_site[lid])
                site_stats = summary(per_site[lid],common)
                ref_stats = summary(reference,common)
                comparisons[lid][iid] = dict(**site_stats, indicator_id=iid, unit=meta['unit'],
                    reference_value=ref_stats['value'],
                    delta_from_reference=(site_stats['value']-ref_stats['value']) if common else None,
                    comparison_years=common, same_months_as_reference=dry if iid=='precip_dry_season' else None,
                    missing_reason=None if common else 'No matching NASA data for this indicator and location.',
                    source=provenance(lid,iid), survival_verdict=None)
        cards[sid] = dict(schema_version=SCHEMA, reference_location=ref, scenario_year=archive_end+1,
                         requirements=reqs, comparisons=comparisons, comparison_series=annual,
                         use_rule=RULE, biological_limits_available=False,
                         absolute_value_caution=spec['species'][sid].get('absolute_value_caution'),
                         aquatic_data_validated=False if sp['system']!='terrestrial' else None)
    (root/'fichas-supervivencia.json').write_text(json.dumps(dict(schema_version=SCHEMA,
        description='Numeric regional reference cards: three indicators per species, not survival thresholds.',
        use_rule=RULE,species=cards),ensure_ascii=False,allow_nan=False,indent=2),encoding='utf-8')
    report = ['# Valores numéricos por especie', '',
              'Referencias regionales NASA: media y rango de los indicadores anuales hasta 2014. '
              '**No son temperaturas óptimas ni límites de supervivencia.** '
              'En montaña, costa y manantiales no representan necesariamente el microhábitat. '
              'Los cinco casos acuáticos son solo contexto regional. '
              'Valores redondeados aquí; JSON y SQLite conservan la precisión completa.', '',
              '| Especie | Indicador | Media | Mínimo observado | Máximo observado | Unidad | Período | Años |',
              '|---|---|---:|---:|---:|---|---|---:|']
    for sp in catalog['species']:
        for req in cards[sp['id']]['requirements']:
            p = req['period']
            report.append(f"| {sp['scientific_name']} | {req['label']} | {req['value']:.3f} | "
                          f"{req['range']['min']:.3f} | {req['range']['max']:.3f} | {req['unit']} | "
                          f"{p['start_year']}–{p['end_year']} | {p['n_years']} |")
    report += ['', 'Fuentes y contratos: [FICHAS-NUMERICAS.md](FICHAS-NUMERICAS.md), '
               '[consultas originales](manifest-nasa.json), [variables adicionales](nasa-power-extra-anual.json). '
               'Cada ficha JSON contiene la consulta exacta y el hash de sus archivos.', '']
    (root/'RESUMEN-NUMERICO.md').write_text('\n'.join(report),encoding='utf-8')
    return cards
