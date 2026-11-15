import habitat from './data/melomys-habitat.json'
import marineSeries from './data/bramble-series.json'
import { archiveEndYear, type Labels, type Language } from './config'
import { chartQuestions, gradeChartQuestions, type ChartReview, type Investigation, type Series } from './investigation'
import { erubPlots } from './ErubTerrain'

export const { species, source_revision: sourceRevision } = habitat
export const card = habitat.survival_card
export type Indicator = keyof typeof card.comparison_series['bramble-cay']
type Place = keyof typeof card.comparison_series
export const reference = card.reference_location as Place

export const requirements = card.requirements.map(entry => ({ ...entry, indicator_id: entry.indicator_id as Indicator }))

export const indicatorLabels: Record<Indicator, Labels> = {
  t2m_max_mean: ['Temperatura máxima mensual media', 'Average monthly maximum temperature'],
  precip_annual: ['Lluvia anual', 'Annual rainfall'],
  soil_wetness: ['Humedad del suelo en la zona radicular', 'Root-zone soil wetness'],
}

export const catalogue: Series[] = [
  ...marineSeries,
  ...requirements.map(entry => ({
    id: `bramble-cay-${entry.indicator_id}`, site: 'Bramble Cay', variable: entry.indicator_id,
    unit: entry.unit, product: entry.sources[0].provider, source: entry.sources[0].url,
    observations: card.comparison_series[reference][entry.indicator_id].flatMap(({ year, value }) =>
      year <= archiveEndYear && typeof value === 'number' ? [{ year, value }] : []),
  })),
]

export function seriesLabels(variable: string): Labels {
  return indicatorLabels[variable as Indicator] ?? ['Nivel medio del mar (anomalía)', 'Mean sea level (anomaly)']
}

export const seriesSite = (series: Series, language: Language) =>
  language === 'es' ? series.siteEs ?? series.site : series.site

const hosts: Record<string, { owner: string; listing: Labels }> = {
  erub: { owner: 'Mara Reed', listing: ['Cabaña de la ladera', 'Hillside cottage'] },
  funafuti: { owner: 'Tavi Shell', listing: ['Casa de la laguna', 'Lagoon house'] },
  'alice-springs': { owner: 'Riley Banks', listing: ['Refugio de roca roja', 'Red rock hideaway'] },
}

type Listing = { id: string; climateId: Place; name: string; owner: string; listing: Labels }
export const listings: Listing[] = [
  ...habitat.locations.filter(location => habitat.candidates.includes(location.id))
    .map(location => ({ ...hosts[location.id], id: location.id, climateId: location.id as Place, name: location.name })),
  { id: 'erub-coast', climateId: 'erub', name: 'Erub', owner: 'Noa Tide', listing: ['Casa frente al mar', 'Shorefront house'] },
]

export function compareHabitat(place: Place, indicator: Indicator) {
  const local = card.comparisons[place][indicator]
  const home = card.comparisons[reference][indicator]
  if (!local.available || local.indicator_id !== home.indicator_id || local.unit !== home.unit) return null
  const years = new Map(card.comparison_series[reference][indicator].map(point => [point.year, point.value]))
  const shared = card.comparison_series[place][indicator].flatMap(({ year, value }) => {
    const origin = years.get(year)
    return year <= archiveEndYear && typeof origin === 'number' && typeof value === 'number'
      ? [{ year, origin, value }] : []
  })
  if (!shared.length) return null
  const stats = (values: number[]) => ({ mean: values.reduce((sum, value) => sum + value, 0) / values.length, min: Math.min(...values), max: Math.max(...values) })
  return {
    unit: local.unit, source: local.source, shared,
    home: stats(shared.map(point => point.origin)),
    destination: stats(shared.map(point => point.value)),
  }
}

export type RentalReviewItem = Indicator | 'terrain'
export const reviewableRentals = listings.map(listing => {
  const items: RentalReviewItem[] = requirements.filter(({ indicator_id }) => compareHabitat(listing.climateId, indicator_id) !== null)
    .map(({ indicator_id }) => indicator_id)
  if (erubPlots[listing.id]) items.push('terrain')
  return { ...listing, items }
})

export function rentalQuizPassed(progress: Investigation, id: string, indicator: Indicator, review: ChartReview) {
  const samples = progress.rentalPractice?.[id]?.[indicator]?.answers[`${review.from}-${review.to}`]
  if (!samples) return false
  const listing = listings.find(item => item.id === id)
  const comparison = listing && compareHabitat(listing.climateId, indicator)
  const first = comparison?.shared.find(point => point.year === review.from)
  const last = comparison?.shared.find(point => point.year === review.to)
  if (!comparison) return false
  const { readingCorrect, predictionCorrect } = gradeChartQuestions(chartQuestions(first, last, comparison.unit), samples)
  return readingCorrect && predictionCorrect
}

export function rentalReviewSaved(progress: Investigation | undefined, id: string, item: RentalReviewItem) {
  if (!progress?.rentalAnalyses?.[id]?.includes(item)) return false
  // Signed dossiers and terrain reviews are already finalized.
  if (item === 'terrain' || progress.relocation?.signed) return true
  const review = progress.rentalEvidence?.[id]?.[item]
  return Boolean(review && rentalQuizPassed(progress, id, item, review))
}

export function rentalReview(progress?: Investigation) {
  const review = { done: 0, total: 0 }
  for (const { id, items } of reviewableRentals) {
    review.total += items.length
    review.done += items.filter(item => rentalReviewSaved(progress, id, item)).length
  }
  return review
}
