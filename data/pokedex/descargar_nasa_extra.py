"""Re-downloads the extra NASA POWER variables and rebuilds nasa-power-extra-anual.json.

Only needed to refresh or audit the data (the archived file is enough to build the database).
Usage (from data/pokedex, internet required):  python descargar_nasa_extra.py   then   python construir_db.py
"""
import calendar, hashlib, json, time, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PATH = ROOT / 'nasa-power-extra-anual.json'
PARAMS = 'T2M_MAX,T2M_MIN,TS,GWETROOT,CLOUD_AMT,WS2M,ALLSKY_SFC_SW_DWN'


def indicator(P, name, y, fill):
    g = {k: [P[k][f'{y}{m:02}'] for m in range(1, 13)] for k in P}
    days = [calendar.monthrange(y, m)[1] for m in range(1, 13)]
    wmean = lambda k: sum(v * d for v, d in zip(g[k], days)) / sum(days)
    if name == 't2m_max_mean': vals, out = g['T2M_MAX'], sum(g['T2M_MAX']) / 12
    elif name == 't2m_min_mean': vals, out = g['T2M_MIN'], sum(g['T2M_MIN']) / 12
    elif name == 'thermal_range': vals, out = g['T2M_MAX'] + g['T2M_MIN'], sum(a - b for a, b in zip(g['T2M_MAX'], g['T2M_MIN'])) / 12
    elif name == 'soil_wetness': vals, out = g['GWETROOT'], wmean('GWETROOT')
    elif name == 'cloud_cover': vals, out = g['CLOUD_AMT'], wmean('CLOUD_AMT')
    elif name == 'surface_temp_mean': vals, out = g['TS'], wmean('TS')
    elif name == 'surface_temp_warmest_month': vals, out = g['TS'], max(g['TS'])
    elif name == 'wind_speed': vals, out = g['WS2M'], wmean('WS2M')
    else: raise ValueError(name)
    return None if fill in vals else round(out, 4)


def main():
    archive = json.loads(PATH.read_text(encoding='utf-8'))
    catalog = json.loads((ROOT / 'export/catalogo.json').read_text(encoding='utf-8'))
    coords = {l['id']: (l['latitude'], l['longitude']) for l in catalog['locations']}
    changed = []
    for lid, per in archive['series'].items():
        lat, lon = coords[lid]
        url = archive['query_template'].format(lat=format(lat, 'g'), lon=format(lon, 'g'))  # same spelling as the archived queries
        body = urllib.request.urlopen(url, timeout=120).read()
        if hashlib.sha256(body).hexdigest() != archive['raw_response_sha256'][lid]:
            changed.append(lid)  # NASA may revise data; the archive keeps the original hash
        raw = json.loads(body)
        P, fill = raw['properties']['parameter'], raw['header']['fill_value']
        for name in per:
            per[name] = {str(y): indicator(P, name, y, fill) for y in range(1981, 2026)}
        time.sleep(1)
    PATH.write_text(json.dumps(archive, ensure_ascii=False, indent=1), encoding='utf-8')
    print('OK: rebuilt', PATH.name, '| responses that differ from the archived hash:', changed or 'none')


if __name__ == '__main__':
    main()
