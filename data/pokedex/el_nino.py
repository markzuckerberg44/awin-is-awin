"""El Niño alert data for the game: NOAA's Oceanic Niño Index (ONI), El Niño / La Niña episodes,
the official status today and how each species' NASA variables responded to El Niño.

Input (archived, offline):  noaa/oni.data  (NOAA CPC ONI as distributed by NOAA PSL)
Output:                     el-nino.json
Usage (from data/pokedex):   python el_nino.py           build el-nino.json
                             python el_nino.py --check   rebuild in memory and compare with the file

Refresh: download https://psl.noaa.gov/data/correlation/oni.data to noaa/oni.data, update
SOURCE['sha256'] and CURRENT_STATUS from the latest CPC ENSO Diagnostic Discussion, run again.
"""
import hashlib, json, sqlite3, sys
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parent
RAW = ROOT / 'noaa' / 'oni.data'
OUT = ROOT / 'el-nino.json'

SOURCE = dict(
    provider='NOAA Climate Prediction Center (CPC), distributed by NOAA Physical Sciences Laboratory (PSL)',
    index='Oceanic Niño Index (ONI): 3-month running mean of ERSST.v6 sea-surface temperature anomalies, Niño 3.4 region (5°N–5°S, 120°–170°W)',
    url='https://psl.noaa.gov/data/correlation/oni.data',
    original_url='https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt',
    file='noaa/oni.data', sha256='27af499bc406f8e5f5e9655013d2299a97d6a1cc92f27db30990b04dbc872f60',
    downloaded='2026-11-15',
    note=('Each monthly value is the 3-month season centred on that month (January = DJF). Since 2026 CPC '
          'ranks El Niño strength with the Relative ONI (RONI), which removes tropical-wide warming and is '
          'usually somewhat lower than the traditional ONI used here.'))

# Official status today. Taken by hand from the CPC ENSO Diagnostic Discussion; update when refreshing.
CURRENT_STATUS = dict(
    as_of='2026-11-14',
    alert='El Niño Advisory',
    discussion_issued='2026-10-08',
    summary=('NOAA reports that El Niño keeps strengthening and that a strong-to-very strong event is likely '
             'through January–March 2027 (probability above 83%).'),
    latest_oni=None,  # filled from the data
    sources=[dict(title='NOAA CPC ENSO Diagnostic Discussion (8 October 2026)',
                  url='https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.shtml'),
             dict(title='NOAA Coral Reef Watch: ENSO conditions and alerts',
                  url='https://www.coralreefwatch.noaa.gov/satellite/analyses_guidance/enso_current_conditions.php')])

THRESHOLD, MIN_SEASONS = 0.5, 5                # NOAA operational definition of an episode
STRENGTH = [(2.0, 'very strong'), (1.5, 'strong'), (1.0, 'moderate'), (0.5, 'weak')]  # conventional peak categories
SEASONS = ['DJF', 'JFM', 'FMA', 'MAM', 'AMJ', 'MJJ', 'JJA', 'JAS', 'ASO', 'SON', 'OND', 'NDJ']
GAME_KNOWLEDGE_END = 2014                      # the game is set in 2015; its archive ends in 2014
LINK_R = 0.5                                   # |r| >= 0.5 (r² >= 0.25) counts as a clear link
r3 = lambda x: None if x is None else round(float(x), 3)


def read_oni():
    raw = RAW.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == SOURCE['sha256'], 'noaa/oni.data changed: update SOURCE'
    monthly = []
    for line in raw.decode('utf-8').splitlines()[1:]:
        parts = line.split()
        if len(parts) != 13:
            continue
        year = int(parts[0])
        for m, v in enumerate(parts[1:], 1):
            v = float(v)
            if v > -99:
                monthly.append(dict(year=year, month=m, season=SEASONS[m - 1], oni=v))
    return monthly


def strength(peak):
    return next(label for limit, label in STRENGTH if abs(peak) >= limit)


def episodes(monthly):
    """El Niño / La Niña episodes: at least five consecutive overlapping seasons beyond ±0.5 °C."""
    out, run, sign = [], [], 0
    def close():
        if len(run) >= MIN_SEASONS:
            peak = max(run, key=lambda r: abs(r['oni']))
            out.append(dict(type='El Niño' if sign > 0 else 'La Niña',
                            start=f"{run[0]['year']}-{run[0]['month']:02d}", end=f"{run[-1]['year']}-{run[-1]['month']:02d}",
                            seasons=len(run), peak_oni=peak['oni'], peak_season=f"{peak['season']} {peak['year']}",
                            strength=strength(peak['oni']), ongoing=run[-1] is monthly[-1]))
    for r in monthly:
        s = 1 if r['oni'] >= THRESHOLD else -1 if r['oni'] <= -THRESHOLD else 0
        if s != 0 and s == sign:
            run.append(r)
        else:
            close()
            run, sign = ([r], s) if s != 0 else ([], 0)
    close()
    return out


def annual(monthly):
    by = {}
    for r in monthly:
        by.setdefault(r['year'], {})[r['month']] = r['oni']
    out = {}
    for y, m in sorted(by.items()):
        full = len(m) == 12
        out[str(y)] = dict(mean=r3(np.mean(list(m.values()))) if full else None,
                           oct_dec=r3(np.mean([m[k] for k in (10, 11, 12)])) if all(k in m for k in (10, 11, 12)) else None,
                           months_available=len(m))
    return out


def species_links(ann, events):
    """How each species' three NASA indicators (reference place) moved with El Niño.
    Detrended correlation and slope with the annual-mean ONI of the same year."""
    db = sqlite3.connect((ROOT / 'pokedex.sqlite').as_uri() + '?mode=ro', uri=True)
    cards = json.loads((ROOT / 'fichas-supervivencia.json').read_text(encoding='utf-8'))['species']
    keys = json.loads((ROOT / 'variables-clave.json').read_text(encoding='utf-8'))
    strong_years = sorted({int(e['start'][:4]) for e in events if e['type'] == 'El Niño' and abs(e['peak_oni']) >= 1.5})
    out = {}
    for sid, card in cards.items():
        lid = card['reference_location']
        rows = []
        for req in card['requirements']:
            iid = req['indicator_id']
            series = dict(db.execute('SELECT year, value FROM species_comparison_values WHERE species_id=? AND location_id=? '
                                     'AND indicator_id=? ORDER BY year', (sid, lid, iid)).fetchall())
            if not series:
                rows.append(dict(indicator_id=iid, available=False)); continue
            stats = {}
            for label, end in (('game_period_1981_2014', GAME_KNOWLEDGE_END), ('full_period_1981_2025', 2025)):
                ys = [y for y in sorted(series) if y <= end and ann.get(str(y), {}).get('mean') is not None]
                y_arr = np.array(ys, float); v = np.array([series[y] for y in ys]); x = np.array([ann[str(y)]['mean'] for y in ys])
                trend = np.polyval(np.polyfit(y_arr, v, 1), y_arr)
                resid = v - trend
                r = float(np.corrcoef(resid, x)[0, 1])
                slope = float(np.polyfit(x, resid, 1)[0])
                stats[label] = dict(years=[ys[0], ys[-1]], r=r3(r), r_squared=r3(r * r), change_per_1c_oni=r3(slope),
                                    strong_el_nino_years={str(y): r3(resid[ys.index(y)]) for y in strong_years if y in ys})
            g = stats['game_period_1981_2014']
            linked = abs(g['r']) >= LINK_R
            unit = req['unit']
            text = None
            if linked:
                more = 'higher' if g['change_per_1c_oni'] > 0 else 'lower'
                amount = (f"{abs(g['change_per_1c_oni']):.2g} on its 0–1 scale" if unit == '0–1'
                          else f"{abs(g['change_per_1c_oni']):.2g} {unit}")
                text = (f"In El Niño years, {req['label'].lower()} here tends to run {more} than its trend: "
                        f"about {amount} per +1 °C of the Oceanic Niño Index "
                        f"(NASA POWER 1981–2014, r = {g['r']:+.2f}).")
            rows.append(dict(indicator_id=iid, label=req['label'], unit=unit, available=True, linked=linked,
                             player_text=text, **stats))
        out[sid] = dict(reference_location=lid, el_nino_sensitive=any(r.get('linked') for r in rows), indicators=rows)
    db.close()
    return out, strong_years


def build():
    monthly = read_oni()
    events = episodes(monthly)
    ann = annual(monthly)
    links, strong_years = species_links(ann, events)
    last = monthly[-1]
    status = dict(CURRENT_STATUS, latest_oni=dict(season=f"{last['season']} {last['year']}", value=last['oni']))
    # A player in 2015 only knows seasons that ended by December 2015 (the NDJ value needs January 2016).
    known = [r for r in monthly if (r['year'], r['month']) <= (2015, 11)]
    known_2015 = [r for r in known if r['year'] == 2015]
    ev2015 = next(e for e in episodes(known) if e['type'] == 'El Niño' and e['ongoing'])
    return dict(
        schema_version='1.0.0', source=SOURCE,
        definition=dict(threshold_c=THRESHOLD, min_consecutive_seasons=MIN_SEASONS,
                        rule='El Niño: ONI ≥ +0.5 °C for at least five consecutive overlapping 3-month seasons; La Niña: ≤ −0.5 °C.',
                        strength_categories={label: limit for limit, label in STRENGTH},
                        strength_note='Peak-based categories commonly used for the ONI; not an official NOAA classification.'),
        current_status=status,
        game_2015=dict(
            note='Only what a player in 2015 could know: ONI seasons ending by December 2015 and the event so far.',
            oni_2015=[dict(season=r['season'], value=r['oni']) for r in known_2015],
            event=ev2015,
            player_text=(f"2015: a {ev2015['strength']} El Niño is building in the Pacific (Oceanic Niño Index "
                         f"{known_2015[-1]['oni']:+.2f} °C in {known_2015[-1]['season']}). The last comparable events, "
                         "1982–83 and 1997–98, brought marine heatwaves and droughts across the tropics.")),
        present_alert=dict(
            player_text=(f"Today: NOAA has an El Niño Advisory in force. The Oceanic Niño Index reached "
                         f"{last['oni']:+.2f} °C in {last['season']} {last['year']}, close to the 1997 and 2015 record "
                         "events, and a strong-to-very strong El Niño is likely through early 2027."),
            comparable_events=[e for e in events if e['type'] == 'El Niño' and e['strength'] == 'very strong' and not e['ongoing']]),
        strong_el_nino_onset_years=strong_years,
        events=events, annual=ann, monthly=monthly, species=links)


def check():
    """Rebuild in memory and require an identical el-nino.json (used by verificar_datos.py)."""
    data = build()
    text = json.dumps(data, ensure_ascii=False, indent=1, allow_nan=False) + '\n'
    assert OUT.read_text(encoding='utf-8').replace('\r\n', '\n') == text, 'el-nino.json is out of date: run python el_nino.py'
    assert sum(e['ongoing'] for e in data['events']) <= 1
    assert all(abs(e['peak_oni']) >= THRESHOLD and e['seasons'] >= MIN_SEASONS for e in data['events'])
    # The 2015 game view must not contain anything a player could only know after November 2015.
    assert [x['season'] for x in data['game_2015']['oni_2015']] == SEASONS[:11]
    assert data['game_2015']['event']['end'] <= '2015-11'
    return data


def main():
    if '--check' in sys.argv:
        data = check()
        print(f"OK: el-nino.json matches noaa/oni.data ({len(data['events'])} episodes, "
              f"{sum(s['el_nino_sensitive'] for s in data['species'].values())} El Niño-sensitive species).")
        return
    data = build()
    text = json.dumps(data, ensure_ascii=False, indent=1, allow_nan=False) + '\n'
    OUT.write_text(text, encoding='utf-8')
    print(f"OK: {len(data['monthly'])} monthly ONI values, {len(data['events'])} episodes, "
          f"{sum(s['el_nino_sensitive'] for s in data['species'].values())}/15 species with a clear El Niño link.")


if __name__ == '__main__':
    main()
