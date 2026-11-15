# Forecasts tied to the species cards (2025–2030)

The module reads `data/pokedex/pokedex.sqlite:species_comparison_values`: exactly the annual values in each species' `survival_card.comparison_series`. The selected targets come from `variables-clave.json.species[id].variables`; their definitions and units must match the card. It supports a variable number of targets. The current catalogue still selects three per species.

## Outputs

- `output/<species_id>.json`: historical NASA values, `hindcast_2025`, future `forecast`, model selection, sources and backtest.
- `output/summary.json`: 133 available species/location/indicator series and empirical interval coverage.
- `output/charts/<species_id>.png`: rebuilt diagnostic plots.

**2025 is already observed.** `hindcast_2025` trains only through 2024 and compares its prediction against known 2025. `forecast` trains through 2025 and covers 2026–2030. NASA supplies the historical products; the project produces the forecasts. These are exploratory regional statistical extrapolations, not NASA forecasts, emission-scenario projections or survival predictions.

```js
const d = await fetch(`/data/ml/${encodeURIComponent(speciesId)}.json`).then(r => r.json());
const location = d.locations.find(l => l.location_id === locationId);
for (const variable of d.variables) {
  const s = location.indicators[variable.id];
  if (!s.available) continue;
  const validation2025 = s.hindcast_2025.prediction; // value, observed, low80, high80
  const future = s.forecast;                      // 2026–2030
  // Draw historical values and forecasts as distinct series; display unit and uncertainty.
}
```

## Models and validation

Six candidates compete by temporal cross-validation MAE:

| Model | Definition |
|---|---|
| Persistence | Last observed annual value |
| Historical mean | Mean of training years |
| Recent mean | Mean of last ten training years |
| Linear trend | Least-squares regression on time |
| Theil–Sen trend | Robust linear trend |
| Autoregressive Ridge | Three annual lags, training-only standardization, fixed L2=1, recursive forecasts |

Forecasts are univariate. Adding targets to the card does not create a multivariate model. Ridge uses past values of the same indicator, not future values of other environmental variables.

For ordinary indicators, final validation origins are 2005/2010/2015/2020; backtest selection uses 2000/2005/2010/2015. Each origin trains only on preceding years and evaluates up to five following years available within the outer training period.

Dry-season rainfall uses the species reference's four driest months selected from 1981–2014, with the same months applied to candidates. Because this definition was not known earlier, final selection origins are 2014/2015/2020 and backtest origins 2014/2015. There are few overlapping validation windows: skill and uncertainty estimates remain provisional. Legacy `key_indicator_values.precip_dry_season` is no longer a forecast input.

The outer backtest trains through 2020 and evaluates 2021–2025. The output reports MAE and skill against historical-mean and persistence baselines. Negative skill means the model was worse. The separate 2025 hindcast is a retrospective diagnostic; its data are excluded from its training and selection.

Intervals use pooled 10th/90th percentiles of validation residuals and respect physical bounds. They are **nominal**, not calibrated guarantees. In the current backtest they contain about **64.2%** of outcomes, below the nominal 80%. The sample is small, windows overlap and repeated locations/indicators are correlated. Do not interpret the pooled coverage as independent trials or the band as a validated probability.

## Scientific limits

- Grid values can differ substantially from mountain, forest, spring and coastal microhabitats.
- Surface skin temperature is not confirmed water temperature at the animal's depth.
- Historical ranges are not physiological limits. Habitat, pathogens, predators, groundwater extraction and flooding remain separate evidence.
- Reanalysis precipitation may have discontinuities. Verify against local gauges before strong causal interpretation.
- No model selection result establishes that one site supports survival.
- No monthly multivariate model or long-term climate-model scenario has been implemented.

## Reproduce

Python with numpy; matplotlib is needed only for charts. From the repository root:

```sh
python data/pokedex/construir_db.py
python data/pokedex/verificar_datos.py
python ml/forecast.py --charts
python ml/verify.py
```

`verify.py` checks that model inputs match the cards, output horizons and bounds are coherent, and perturbing held-out observations cannot alter backtest or 2025-hindcast predictions. Sources and a live NASA audit are in [AUDITORIA-Y-AMPLIACION.md](../data/pokedex/AUDITORIA-Y-AMPLIACION.md).
