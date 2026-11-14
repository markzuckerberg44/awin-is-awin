# Climate forecast 2026–2030 (machine learning module)

A self-contained module: it **reads** the project data and **writes only to `ml/output/`**. The game can load these JSON files in its main flow or in a separate screen; nothing in `data/` depends on this folder.

## What it gives you

For each of the 15 species, a forecast of its **three key survival indicators** for **2026, 2027, 2028, 2029 and 2030**, at the species' habitat and, for the ten land species, at its three relocation candidates.

| File | Content |
|---|---|
| `output/<species_id>.json` | Observed 1981–2025, forecast 2026–2030 with an 80 % range, comparison with the 1991–2020 average, an English `summary_text`, and a backtest |
| `output/summary.json` | One row per species × location × indicator: 2030 forecast, change vs. normal, backtest skill |
| `output/charts/<species_id>.png` | Ready-made chart of the habitat's three indicators |
| `species_variables.json` | The three indicators per species, why they were chosen, and the project brief's favorable conditions |
| `data/power_extra_annual.json` | Extra NASA POWER indicators (max/min temperature, surface/sea temperature, soil wetness, cloud cover, wind) with source hashes |

## Using it in the game

```js
const f = await fetch(`/data/ml/${encodeURIComponent(speciesId)}.json`).then(r => r.json());
const habitat = f.locations.find(l => l.role === 'species_habitat');
for (const v of f.variables) {
  const s = habitat.indicators[v.id];
  if (!s.available) continue;                        // e.g. soil wetness over ocean
  const history  = s.observed.map(o => ({x: o.year, y: o.value}));
  const forecast = s.forecast.map(o => ({x: o.year, y: o.value, min: o.low80, max: o.high80}));
  showCard(v.label, v.unit, s.summary_text, s.context.change_vs_normal);
}
// Optional: compare candidates — f.locations.filter(l => l.role === 'relocation_candidate')
```

Two ways to integrate:
- **Main flow:** after a round, show "What happens next? 2026–2030" for the habitat or the chosen refuge.
- **Separate feature:** a "Forecast lab" screen that reads `summary.json` and the charts.

### Display rules

- Always show the 80 % range, not just the line. In the backtest (see below) real values fell inside that range in about 66 % of cases, not 80 %. The range is a minimum estimate of the uncertainty.
- When the file includes `absolute_value_caution` (mountain species), show the **change versus 1991–2020** (`context.change_vs_normal`), not the absolute value. NASA's grid cell sits far below cloud forests: Monteverde's cell averages 381 m, so its temperature reads about 25 °C instead of the 14–19 °C of the toad's forest.
- Rainfall indicators carry `data_caution`: present them as uncertain.
- `brief_favorable_conditions` comes from the project brief and is **not validated** (`brief_ranges_validated: false`). Do not turn it into a "survives / dies" rule.
- This is not a survival prediction. Threats such as chytrid fungus, invasive predators, sea-level rise or water extraction are not in the data.

## Method

**Data.** NASA POWER monthly data 1981–2025 for 24 locations. Temperature, humidity and rainfall come from the project database. The other indicators come from `data/power_extra_annual.json`. Each indicator is turned into one value per year; the aggregation rule is in `species_variables.json`.

**Models.** Four simple, explainable models compete for each series:

| Model | Idea |
|---|---|
| `historical_mean` | No change: average of all years |
| `recent_mean` | Recent conditions persist: average of the last 10 years |
| `linear_trend` | Least-squares straight line |
| `theil_sen_trend` | Robust straight line, less sensitive to extreme years |

**Selection (the machine-learning step).** Time-series cross-validation. The script trains up to 2005, 2010, 2015 and 2020, predicts the following 5 years each time, and keeps the model with the lowest mean absolute error. That model is retrained on 1981–2025 to forecast 2026–2030. The 80 % range comes from the 10th and 90th percentiles of those out-of-sample errors.

**Backtest.** The same procedure is run as if it were 2020: train up to 2020 and predict 2021–2025, which already happened. `verify.py` checks that the backtest never sees 2021–2025.

Results across 133 series:
- **Beats "no change":** in 73 % of series. Median error reduction is 17 %.
- **By variable:** temperature does best (31 %), rainfall barely improves (6 %).
- **80 % range:** contained 66 % of real values.

Selected models: 49 linear trend, 29 Theil–Sen, 28 recent mean, 27 historical mean.

## Limits

- **Regional climate only.** These are statistical extrapolations of a regional grid cell, not climate-model projections (CMIP6). There are no emission scenarios, El Niño forecasts or abrupt changes.
- **Rainfall data.** Reanalysis rainfall can contain artificial shifts; see `rainfall_caution` in `species_variables.json`.
- **Missing variables.** Water temperature, stream flow, oxygen, sea level and acidification are not available. For aquatic species the indicators are proxies, and `why_these_variables` says so.
- **Sea-surface temperature.** It is skin temperature from the grid cell. It behaves like sea temperature at Coiba and Galápagos; Tasmania's cell is likely influenced by land.

## Reproduce

From the repository root, with Python 3 and `numpy` (`matplotlib` only for charts):

```sh
python ml/forecast.py --charts   # rebuilds ml/output/
python ml/verify.py              # checks outputs, intervals and the backtest
python ml/fetch_power.py         # optional: re-download the extra NASA variables (internet)
```

`forecast.py` is deterministic. To change a species' indicators, edit `species_variables.json` and rerun. A new indicator needs to be added to `forecast.py` or `fetch_power.py` first.
