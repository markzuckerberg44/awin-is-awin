"""Export the Torres Strait series from Camargo's 1° NASA MEaSUREs archive."""

import argparse
import json
from datetime import datetime, timedelta

import h5py
import numpy as np


def extract(path):
    start_year, end_year = 1993, 2014
    expected = [(year, month) for year in range(start_year, end_year + 1) for month in range(1, 13)]
    with h5py.File(path) as archive:
        sla = archive["sla"]
        time = archive["time"]
        if archive.attrs["DOI"].decode() != "10.5067/SLREF-CDRV3" or sla.attrs["units"].decode() != "m":
            raise ValueError("Expected NASA MEaSUREs v2205 sea-level anomaly in metres")
        epoch = datetime.fromisoformat(time.attrs["units"].decode().removeprefix("hours since "))
        dates = [epoch + timedelta(hours=float(hours)) for hours in time[:]]
        months = [index for index, date in enumerate(dates) if start_year <= date.year <= end_year]
        if [(dates[index].year, dates[index].month) for index in months] != expected:
            raise ValueError("Expected all 264 calendar months, with no gaps or duplicates")
        lat, lon = archive["lat"][:], archive["lon"][:]
        rows = np.flatnonzero((-10 <= lat) & (lat <= -8))
        columns = np.flatnonzero((143 <= lon) & (lon <= 145))
        grid = np.array([sla[index, rows[0]:rows[-1] + 1, columns[0]:columns[-1] + 1] for index in months])
    # Fix the spatial mask for the entire period so coverage changes cannot create a trend.
    valid = np.isfinite(grid).all(axis=0)
    if not valid.any():
        raise ValueError("No ocean cells have a complete record")
    lat_weights = np.broadcast_to(np.cos(np.deg2rad(lat[rows]))[:, None], valid.shape)
    monthly = np.average(grid[:, valid], axis=1, weights=lat_weights[valid])
    annual_mm = monthly.reshape(-1, 12).mean(axis=1) * 1000
    return [{
        "id": "torres-strait-measures-v2205",
        "site": "Torres Strait",
        "siteEs": "Estrecho de Torres",
        "variable": "seaLevel",
        "unit": "mm",
        "product": "NASA/JPL MEaSUREs v2205",
        "source": "https://doi.org/10.5067/SLREF-CDRV3",
        "archiveSource": "https://doi.org/10.5281/zenodo.16993112",
        "gridCentersLonLat": [[float(lon[columns[j]]), float(lat[rows[i]])] for i, j in zip(*np.where(valid))],
        "observations": [
            {"year": year, "value": round(float(value), 3)}
            for year, value in zip(range(start_year, end_year + 1), annual_mm, strict=True)
        ],
    }]


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("netcdf", help="alt-measures_v2205-monthly-1x1_RSL.nc from Zenodo")
    print(json.dumps(extract(parser.parse_args().netcdf), ensure_ascii=False, indent=2))
