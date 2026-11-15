# Forecasts tied to the species cards (2025–2030)

The module reads `data/pokedex/pokedex.sqlite:species_comparison_values`: exactly the annual values in each species' `survival_card.comparison_series`. The targets come from `variables-clave.json.species[id].variables`, with the same definitions and units as the card. Any number of targets per species is supported; the current catalogue uses three.

## Outputs

- `output/<species_id>.json`: historical NASA values, `hindcast_2025`, `forecast` 2026–2030, every component's forecast, validation errors, sources and backtest.
- `output/summary.json`: the 133 species/location/indicator records, the 95 **distinct** series behind them and overall validation numbers.
- `output/charts/<species_id>.png`: diagnostic plots.

**2025 is already observed.** `hindcast_2025` trains only through 2024 and is compared with the known 2025 value. `forecast` trains through 2025 and covers 2026–2030. NASA supplies the historical data; the forecasts are the project's own statistical extrapolations, not NASA predictions, emission-scenario projections or survival predictions.

```js
const d = await fetch(`/data/ml/${encodeURIComponent(speciesId)}.json`).then(r => r.json());
const location = d.locations.find(l => l.location_id === locationId);
for (const variable of d.variables) {
  const s = location.indicators[variable.id];
  if (!s.available) continue;
  const check2025 = s.hindcast_2025.prediction; // value, observed, low80, high80
  const future = s.forecast;                    // 2026–2030: value, low80, high80
  // Draw observed values and the forecast as different series, with unit and band.
}
```

## How the model works, step by step

1. **Data.** Each series is one indicator at one place, one value per year, 1981–2025 (cloud cover from 1984), computed from NASA POWER monthly data.
2. **Six simple forecasts.** Persistence (last year), historical mean, mean of the last 10 years, linear trend, robust Theil–Sen trend and an autoregressive ridge regression on the three previous years.
3. **Ensemble.** The six forecasts are averaged with equal weights (`ensemble6`). With 45 annual values, picking a single "best" model is mostly picking noise; averaging is more stable.
4. **Global LightGBM.** One gradient-boosting model learns from *all* distinct series at once (about 10,000 training rows at the 2025 cutoff) instead of 45 values. Inputs, all standardized within each series using only past data:
   - the last five values, the 10-year and full-period slopes and the 10-year mean;
   - the forecast horizon (1–5 years) and the indicator type;
   - temperature, humidity and annual rainfall *of the same place* (last value, 3-year mean, 10-year slope), so one variable can inform another.
   A separate LightGBM is trained for every cutoff year, and only on target years up to that cutoff.
5. **Combination.** Final value = average of `ensemble6` and `lightgbm` (`combined`). Dry-season rainfall uses `ensemble6` only: its dry months were defined with 1981–2014 data, so earlier training examples would leak that definition.
6. **Calibrated 80% band.** For each cutoff, the combined model is re-run from every earlier origin (2000 onwards; dry-season from 2014), across all distinct series. The standardized errors are pooled by horizon (1–5 years) and their 10th/90th percentiles, scaled by the series' variability, give the band. Only errors whose target year is ≤ the cutoff are used. Bands respect physical bounds (0–100 % humidity, non-negative rain…).
7. **Honest evaluation.** The same full procedure is run as if we were in 2020 (predict 2021–2025) and in 2024 (predict 2025), then compared with what NASA observed.

## Validation (each distinct series counted once)

| | Previous method (pick one model) | Current (ensemble + LightGBM) |
|---|---|---|
| Real 2021–2025 values inside the 80 % band | 62 % | **77 %** |
| Real 2025 values inside the 80 % band | 69 % | **85 %** |
| Series whose 2025 hindcast error went down | – | **52 / 93** |
| 2021–2025 error relative to "historical mean" (lower is better) | 0.85 | 0.85 |
| Series better than the historical mean in 2021–2025 | 61 / 93 | 64 / 95 |
| Series better than persistence in 2021–2025 | 49 / 93 | 48 / 95 |

Over a longer exploratory test (origins 2008–2020, 511 five-year forecasts, dry-season rainfall excluded), relative error was 0.98 for "pick one model", 0.93 for LightGBM alone and **0.90** for the ensemble and for ensemble + LightGBM.

**What this means.** The bands are now close to honest. Point accuracy is similar to before: year-to-year climate at a single grid cell is dominated by unpredictable variability (El Niño, single storms), so no statistical model, simple or complex, can predict a particular year well. Use the forecasts as "likely range and direction", not as exact values. Neighbouring sites and related indicators are correlated, so these counts are not independent experiments.

## Scientific limits

- Grid values can differ substantially from mountain, forest, spring and coastal microhabitats.
- Surface skin temperature is not water temperature at the animal's depth.
- Historical ranges are not physiological limits. Habitat, pathogens, predators, groundwater extraction and flooding are separate evidence.
- Reanalysis rainfall can have discontinuities (see the jump in several dry-season series after 2014). Check local gauges before strong conclusions.
- No climate-model (CMIP6) scenarios are used yet; for multi-year climate change these would be the physically grounded input.

## Reproduce

Requires Python with the packages in `ml/requirements.txt` (matplotlib only for charts). From the repository root:

```sh
python -m pip install -r ml/requirements.txt
python data/pokedex/construir_db.py
python data/pokedex/verificar_datos.py
python ml/forecast.py --charts
python ml/verify.py
```

`forecast.py` takes about one minute. `verify.py` checks that model inputs match the cards, horizons and bands are coherent, and that the forecasts cannot see the future: it corrupts every series after 2020 (including LightGBM's inputs) and confirms that the 2021–2025 backtest does not change, and corrupts each series' 2025 value to confirm the 2025 hindcast does not change. LightGBM runs with fixed seed, one thread and deterministic mode; another operating system may differ in the last decimals.
