/** Cached NASA series selected by the species card; no fixed number of indicators. */
export async function consultarSeriesEspecie({speciesId, locationId, endYear = 2014,
  baseUrl = '/data/pokedex', fetchFn = globalThis.fetch}) {
  if (!Number.isInteger(endYear) || endYear < 1981 || endYear > 2025) {
    throw new Error('endYear must be an integer between 1981 and 2025');
  }
  const response = await fetchFn(`${baseUrl}/${encodeURIComponent(speciesId)}.json`);
  if (!response.ok) throw new Error(`Species data unavailable: ${response.status}`);
  const data = await response.json();
  if (data.species.id !== speciesId) throw new Error('Species ID mismatch');
  const card = data.survival_card;
  const selectedLocation = locationId ?? card.reference_location;
  const perLocation = card.comparison_series[selectedLocation];
  if (!perLocation) throw new Error('Location is not available for this species');
  return {
    speciesId, locationId: selectedLocation, endYear,
    variables: card.requirements.map(variable => {
      const rows = perLocation[variable.indicator_id];
      if (!Array.isArray(rows)) throw new Error(`Missing series mapping: ${variable.indicator_id}`);
      const series = rows.filter(r => r.year <= endYear);
      if (series.some(r => !Number.isFinite(r.value))) throw new Error('Invalid numeric value');
      return {indicatorId: variable.indicator_id, label: variable.label, unit: variable.unit,
        nasaParameters: variable.nasa_parameters,
        aggregation: variable.aggregation, medium: variable.medium,
        source: card.comparisons[selectedLocation][variable.indicator_id].source,
        reference: {value: variable.value, range: variable.range, period: variable.period},
        available: series.length > 0, series,
        missingReason: series.length ? null : 'No NASA values available for this indicator, location and period.'};
    }),
  };
}
