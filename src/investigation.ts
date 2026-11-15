export type Observation = { year: number; value: number }
export type Series = {
  id: string
  site: string
  siteEs?: string
  variable: string
  unit: string
  product: string
  source: string
  archiveSource?: string
  observations: Observation[]
}
export type Stamp = 'up' | 'down' | 'unproven'
export type Evidence = {
  series: string
  from: number
  to: number
  count: number
  slope: number | null
  p: number | null
  stamp: Stamp
}
export type ChartAnswers = { reading?: number; prediction?: number }
export type ChartPractice = {
  from: number
  to: number
  answers: Partial<Record<string, ChartAnswers>>
}
export type Query = Pick<Evidence, 'series' | 'from' | 'to' | 'count'> & { trend?: Evidence }
export type ChartReview = Pick<Evidence, 'from' | 'to'> & { trend?: Evidence }
export type SiteReading = 'high' | 'outside' | 'unknown'
export type Relocation = {
  origin?: string
  listing?: string
  indicator?: string
  siteReading?: SiteReading
  stamp?: Stamp
  habitatPending?: boolean
  rationale?: string
  signed?: ChartReview
}
export type Investigation = {
  evidence: Query[]
  notes: string
  habitatRequests?: Record<string, string[]>
  habitatChats?: Partial<Record<string, { prompt: 'property' | 'compare' | 'site'; sentAt: number }>>
  rentalAnalyses?: Partial<Record<string, string[]>>
  rentalPractice?: Partial<Record<string, Partial<Record<string, ChartPractice>>>>
  rentalEvidence?: Partial<Record<string, Partial<Record<string, ChartReview>>>>
  relocation?: Relocation
}

export const emptyInvestigation: Investigation = { evidence: [], notes: '' }
export const queryBudget = 4
export const queryId = (query: Query) => `${query.series}/${query.from}/${query.to}`
export const chartObservationDecimals = 4

export function chartQuestions(first: Observation | undefined, last: Observation | undefined, unit: string) {
  if (!first || !last || last.year <= first.year) return undefined
  const annualChange = (last.value - first.value) / (last.year - first.year)
  const clamp = (value: number) => unit === '0–1' ? Math.min(1, Math.max(0, value))
    : unit === 'mm/year' ? Math.max(0, value) : value
  const project = (year: number) => clamp(last.value + annualChange * (year - last.year))
  return {
    reading: Math.sign(Number(last.value.toFixed(chartObservationDecimals)) - Number(first.value.toFixed(chartObservationDecimals))),
    prediction: project(last.year + 1),
    annualChange, clamp, project,
  }
}

export function gradeChartQuestions(questions: ReturnType<typeof chartQuestions>, answers?: ChartAnswers) {
  return {
    readingCorrect: Boolean(questions && questions.reading === answers?.reading),
    predictionCorrect: Boolean(questions && questions.prediction === answers?.prediction),
  }
}

function senSlope(points: Observation[]) {
  const slopes = points.flatMap((a, i) => points.slice(i + 1).map(b => (b.value - a.value) / (b.year - a.year)))
  slopes.sort((a, b) => a - b)
  return (slopes[Math.floor((slopes.length - 1) / 2)] + slopes[Math.floor(slopes.length / 2)]) / 2
}

function mannKendallP(values: number[]) {
  const counts = new Map<number, number>()
  let score = 0
  for (const [i, value] of values.entries()) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
    for (const other of values.slice(i + 1)) score += Math.sign(other - value)
  }
  const n = values.length
  const ties = [...counts.values()].reduce((total, count) => total + count * (count - 1) * (2 * count + 5), 0)
  const variance = (n * (n - 1) * (2 * n + 5) - ties) / 18
  if (!score || variance <= 0) return 1
  const z = (Math.abs(score) - 1) / Math.sqrt(variance)
  // Two-sided normal tail approximation.
  const t = 1 / (1 + 0.2316419 * z)
  return Math.min(1, 2 * Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI) *
    t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429)))))
}

export function analyze(series: string, points: Observation[], from: number, to: number): Evidence {
  const n = points.length
  const slope = n >= 2 ? senSlope(points) : null
  const result: Evidence = { series, from, to, count: n, slope: slope === null ? null : slope * 10, p: null, stamp: 'unproven' }
  // Annual lag-1 correction requires a contiguous window.
  if (n < 10 || points.some((point, index) => point.year !== from + index) || points.at(-1)?.year !== to || slope === null) return result
  const residuals = points.map((point, i) => point.value - slope * i)
  const mean = residuals.reduce((total, value) => total + value, 0) / n
  const centered = residuals.map(value => value - mean)
  const variance = centered.reduce((total, value) => total + value * value, 0)
  const lag = variance > 0 ? centered.slice(1).reduce((total, value, i) => total + value * centered[i], 0) / variance : 0
  const adjusted = residuals.slice(1).map((value, i) => value - lag * residuals[i] + slope * (i + 1))
  const p = mannKendallP(adjusted)
  return { ...result, p, stamp: p < 0.05 ? slope > 0 ? 'up' : slope < 0 ? 'down' : 'unproven' : 'unproven' }
}
