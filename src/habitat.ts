import habitat from './data/melomys-habitat.json'
import { archiveEndYear, type Labels } from './config'
import type { Investigation } from './investigation'
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

const reviewableRentals = listings.map(listing => ({
  ...listing,
  signals: requirements.filter(({ indicator_id }) => compareHabitat(listing.climateId, indicator_id) !== null)
    .map(({ indicator_id }) => indicator_id),
}))

export function rentalReview(progress?: Investigation, listingId?: string) {
  const review = { done: 0, total: 0 }
  for (const { id, signals } of reviewableRentals) {
    if (listingId && listingId !== id) continue
    review.total += signals.length + Number(Boolean(erubPlots[id]))
    review.done += signals.filter(signal => progress?.rentalAnalyses?.[id]?.includes(signal)).length
    if (erubPlots[id] && progress?.rentalAnalyses?.[id]?.includes('terrain')) review.done++
  }
  return review
}
