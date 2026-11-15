import { useEffect, useRef, useState, type Ref } from 'react'
import { archiveEndYear, translate, type Language } from './config'
import { indicatorLabels, type Indicator } from './habitat'
import projection from './data/melomys-forecast.json'

const { locations, validation } = projection
const siteNames = {
  'bramble-cay': 'Bramble Cay', erub: 'Erub', funafuti: 'Funafuti', 'alice-springs': 'Alice Springs',
}
type Site = keyof typeof locations
type Band = keyof typeof validation.coverage
type ForecastSeries = NonNullable<typeof locations.erub[Indicator]>
const sites = Object.keys(locations) as Site[]
const bands = ['50', '80', '90'] as const
const indicators = Object.keys(indicatorLabels) as Indicator[]
const bandColumn: Record<Band, number> = { '50': 1, '80': 3, '90': 5 }
const lastObservedYear = 2025
const forecastStart = lastObservedYear + 1

function ForecastChart({ language, data, band, label, hideLast = false }: {
  language: Language
  data: ForecastSeries
  band: Band
  label: string
  hideLast?: boolean
}) {
  const t = (es: string, en: string) => translate(language, [es, en])
  const left = 55
  const right = 485
  const top = 15
  const bottom = 138
  const column = bandColumn[band]
  const points = data.observed.map((value, i) => ({ year: data.firstYear + i, value }))
  const historical = points.filter(point => point.year <= archiveEndYear)
  const visibleThrough = hideLast ? lastObservedYear - 1 : lastObservedYear
  const later = points.filter(point => point.year >= archiveEndYear && point.year <= visibleThrough)
  const forecast = data.forecast.map((row, i) => ({ year: forecastStart + i, value: row[0], low: row[column], high: row[column + 1] }))
  const lastYear = forecast.at(-1)!.year
  const values = [...points.map(point => point.value), ...forecast.flatMap(point => [point.low, point.high])]
  const min = Math.min(...values)
  const max = Math.max(...values)
  const targetStep = (max - min || 1) / 4
  const power = 10 ** Math.floor(Math.log10(targetStep))
  const step = [1, 2, 2.5, 5, 10].map(value => value * power).find(value => value >= targetStep) ?? power * 10
  const low = Math.floor(min / step) * step
  const high = Math.max(low + step, Math.ceil(max / step) * step)
  const ticks = Array.from({ length: Math.round((high - low) / step) + 1 }, (_, i) => low + step * i)
  const axis = new Intl.NumberFormat(language, { maximumFractionDigits: 3 })
  const x = (year: number) => left + (right - left) * (year - data.firstYear) / (lastYear - data.firstYear)
  const y = (value: number) => bottom - (bottom - top) * (value - low) / (high - low)
  const xy = (year: number, value: number) => x(year) + ',' + y(value)
  const line = (series: { year: number; value: number }[]) => series.map(({year, value}) => xy(year, value)).join(' ')
  const envelope = [...forecast.map(point => xy(point.year, point.high)), ...forecast.map(point => xy(point.year, point.low)).reverse()]
  const projectionStart = x(lastObservedYear + .5)

  return <svg className="viewer-chart" viewBox="0 0 520 170" role="img"
    aria-label={label + '. ' + t(`Histórico hasta ${visibleThrough}. Pronóstico ${forecastStart}–${lastYear} con banda del ${band} %.`, `Historical data through ${visibleThrough}. Forecast for ${forecastStart}–${lastYear} with a ${band}% band.`)}>
    <rect x={projectionStart} y={top} width={right - projectionStart} height={bottom - top} fill="#84bfd0" opacity=".1" />
    {ticks.map(value => <g key={value}>
      <line x1={left} x2={right} y1={y(value)} y2={y(value)} stroke="currentColor" opacity=".2" />
      <text x={left - 7} y={y(value)} textAnchor="end" dominantBaseline="middle">{axis.format(value)}</text>
    </g>)}
    <path d={`M${left} ${top}V${bottom}H${right}`} fill="none" stroke="currentColor" />
    {[archiveEndYear + .5, lastObservedYear + .5].map(year => <line key={year} x1={x(year)} x2={x(year)}
      y1={top} y2={bottom} stroke="currentColor" opacity=".45" strokeDasharray="3 4" />)}
    {[data.firstYear, 2000, archiveEndYear].map(year => <text key={year} x={x(year)} y={158} textAnchor="middle">{year}</text>)}
    <text x={x(lastObservedYear) + 6} y={158} textAnchor="end">{lastObservedYear}</text>
    <text x={514} y={158} textAnchor="end">{lastYear}</text>
    <polygon points={envelope.join(' ')} fill="#84bfd0" opacity=".36" />
    <polyline points={line(historical)} fill="none" stroke="#e9c47a" strokeWidth="2.5" />
    <polyline points={line(later)} fill="none" stroke="#a4d0a5" strokeWidth="2.5" />
    <polyline points={line(forecast)} fill="none" stroke="#b3dce7" strokeWidth="2.5" strokeDasharray="4 3" />
    {!hideLast && <circle cx={x(lastObservedYear)} cy={y(points.at(-1)!.value)} r="3.8" fill="#c8ec9d" stroke="#1f2d23" strokeWidth="1.5" />}
  </svg>
}

export function CreditsForecast({ language, quiz, onAnswer }: {
  language: Language
  quiz: Ref<HTMLFieldSetElement>
  onAnswer: (correct: boolean) => void
}) {
  const t = (es: string, en: string) => translate(language, [es, en])
  const [site, setSite] = useState<Site>('erub')
  const [band, setBand] = useState<Band>('80')
  const [answers, setAnswers] = useState<Partial<Record<Site, boolean>>>({})
  const answerResult = useRef<HTMLDivElement>(null)
  const { t2m_max_mean: temperature } = locations[site]
  const [estimate, low, high, actual] = temperature.hindcast
  const inside = actual >= low && actual <= high
  const answered = answers[site] !== undefined
  const format = new Intl.NumberFormat(language, { maximumFractionDigits: 3 })
  const degrees = new Intl.NumberFormat(language, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const percent = new Intl.NumberFormat(language, { style: 'percent', maximumFractionDigits: 0 })
  const units: Record<Indicator, string> = { t2m_max_mean: '°C', precip_annual: t('mm/año', 'mm/year'), soil_wetness: '0–1' }

  useEffect(() => { if (answered) answerResult.current?.focus({ preventScroll: true }) }, [answered])

  function reveal(guess: boolean) {
    setAnswers(current => ({ ...current, [site]: guess }))
    onAnswer(guess === inside)
  }

  return <div className="credit-forecast">
    <p className="credit-source-note">{t('Archivo 2026', '2026 archive')} · NASA POWER {temperature.firstYear}–{lastObservedYear}</p>
    <div className="credit-forecast-controls">
      <div><label htmlFor="credit-forecast-site">{t('Lugar', 'Location')}</label><select id="credit-forecast-site" value={site} onChange={event => setSite(event.target.value as Site)}>
        {sites.map(id => <option key={id} value={id}>{siteNames[id]}</option>)}
      </select></div>
      <div><label htmlFor="credit-forecast-band">{t('Banda de predicción', 'Prediction band')}</label><select id="credit-forecast-band" value={band} onChange={event => setBand(event.target.value as Band)}>
        {bands.map(value => <option key={value} value={value}>{value} %</option>)}
      </select></div>
    </div>
    <ul className="viewer-legend credit-chart-key">
      <li><span data-key="archive" aria-hidden="true" />{t('Expediente hasta 2014', 'Case file through 2014')}</li>
      <li><span data-key="later" aria-hidden="true" />{t('Datos posteriores', 'Later data')}</li>
      <li><span data-key="forecast" aria-hidden="true" />{t(`Pronóstico · banda del ${band} %`, `Forecast · ${band}% band`)}</li>
    </ul>
    {indicators.map(indicator => {
      const data = locations[site][indicator]
      const label = translate(language, indicatorLabels[indicator])
      const unit = units[indicator]
      return <section className="credit-forecast-variable" key={indicator} data-indicator={indicator}>
        <h3>{label} · {unit}</h3>
        {data ? <>
          <ForecastChart language={language} data={data} band={band} label={`${siteNames[site]} · ${label} (${unit})`}
            hideLast={indicator === 't2m_max_mean' && !answered} />
          <details className="credit-details credit-forecast-details">
            <summary>{t('Ver cifras del pronóstico', 'See forecast figures')}</summary>
            <table>
              <thead><tr><th scope="col">{t('Año', 'Year')}</th><th scope="col">{t('Estimación', 'Estimate')} ({unit})</th>
                <th scope="col">{t('Banda', 'Band')} {band} % ({unit})</th></tr></thead>
              <tbody>{data.forecast.map((point, i) => <tr key={i}><th scope="row">{forecastStart + i}</th><td>{format.format(point[0])}</td>
                <td>{format.format(point[bandColumn[band]])}–{format.format(point[bandColumn[band] + 1])}</td></tr>)}</tbody>
            </table>
          </details>
        </> : <p className="credit-source-note">{t('La serie de este indicador no está disponible para este lugar.', 'This indicator has no available series for this location.')}</p>}
        {indicator === 't2m_max_mean' && <fieldset className="credit-quiz" ref={quiz}>
          <legend>{t('¿Acertó el modelo en 2025?', 'Did the model get 2025 right?')}</legend>
          <p>{t(`Con datos hasta 2024, estimó ${degrees.format(estimate)} °C. ¿El valor real quedó entre ${degrees.format(low)} y ${degrees.format(high)} °C?`,
            `Using data through 2024, it estimated ${degrees.format(estimate)} °C. Was the actual value between ${degrees.format(low)} and ${degrees.format(high)} °C?`)}</p>
          {!answered && <div className="credit-choices">
            <button type="button" onClick={() => reveal(true)}>{t('Dentro del intervalo', 'Inside the interval')}</button>
            <button type="button" onClick={() => reveal(false)}>{t('Fuera del intervalo', 'Outside the interval')}</button>
          </div>}
          <div role="status" ref={answerResult} tabIndex={answered ? -1 : undefined}
            className="credit-reveal" data-correct={answered ? answers[site] === inside : undefined}>
            {answered && <p>{answers[site] === inside && <>{t('Acertaste.', 'Correct.')} </>}
              <strong>{degrees.format(actual)} °C</strong>{' '}
              {inside ? t('fue el valor real. Cayó dentro de la banda.', 'was the actual value. It fell inside the band.')
                : t('fue el valor real. Quedó fuera de la banda.', 'was the actual value. It fell outside the band.')}</p>}
          </div>
        </fieldset>}
      </section>
    })}
    <p>{t(`En la prueba de ${validation.from}–${validation.to}, el `, `In the ${validation.from}–${validation.to} test, `)}
      <strong>{percent.format(validation.coverage[band])}</strong>{t(` de los valores reales cayó en la banda del ${band} %.`, ` of actual values fell inside the ${band}% band.`)}</p>
    <details className="credit-details">
      <summary>{t('Cómo se hizo el pronóstico', 'How the forecast was made')}</summary>
      <p>{t(`El equipo combinó seis modelos simples con LightGBM. La prueba reunió ${validation.seriesCount} series regionales de NASA POWER. El pronóstico 2026–2030 proviene del prototipo archivado.`,
        `The team combined six simple models with LightGBM. The test pooled ${validation.seriesCount} regional NASA POWER series. The 2026–2030 forecast comes from the archived prototype.`)}</p>
      <p className="credit-sources"><a href="https://power.larc.nasa.gov/" target="_blank" rel="noreferrer">NASA POWER</a></p>
    </details>
  </div>
}
