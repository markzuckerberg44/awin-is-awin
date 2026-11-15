import { useEffect, useRef, useState, type ReactNode } from 'react'
import { archiveEndYear, translate, type Language } from './config'
import { analyze, chartObservationDecimals, chartQuestions, gradeChartQuestions, type ChartAnswers, type ChartPractice, type ChartReview, type Evidence } from './investigation'

export type ChartPoint = { year: number; value: number; reference?: number }
type ChartType = 'line' | 'bars' | 'points'

const width = 560
const height = 280
const left = 85
const right = 20
const top = 18
const bottom = 45
const colors = { value: '#e9c47a', reference: '#9bc5a2' }

export function DataViewer({ language, label, unit, site, points, onBack, source, requestAction, calculatorTrigger, onReview, review, reviewSaved, onTrend, savedPractice, onPracticeChange }: {
  language: Language
  label: string
  unit: string
  site: string
  points: ChartPoint[]
  onBack?: () => void
  source?: { provider: string; url: string }
  requestAction?: ReactNode
  calculatorTrigger?: ReactNode
  onReview?: (review: ChartReview) => void
  review?: ChartReview
  reviewSaved?: boolean
  onTrend?: (result: Evidence) => void
  savedPractice?: ChartPractice
  onPracticeChange?: (practice: ChartPractice) => void
}) {
  const t = (es: string, en: string) => translate(language, [es, en])
  const [localPractice, setLocalPractice] = useState<ChartPractice>(() => ({ from: points[0].year, to: points.at(-1)!.year, answers: {} }))
  const [chart, setChart] = useState<ChartType>('line')
  const [series, setSeries] = useState('both')
  const [showTrend, setShowTrend] = useState(false)
  const title = useRef<HTMLHeadingElement>(null)
  const questionsHeading = useRef<HTMLHeadingElement>(null)
  const standalone = Boolean(onBack)
  useEffect(() => {
    if (!standalone) return
    title.current?.parentElement?.scrollIntoView({ block: 'start' })
    title.current?.focus({ preventScroll: true })
  }, [standalone])

  const format = new Intl.NumberFormat(language, { maximumFractionDigits: 3 })
  const observationFormat = new Intl.NumberFormat(language, { maximumFractionDigits: chartObservationDecimals })
  const years = points.map(point => point.year)
  const practice = savedPractice && savedPractice.from <= savedPractice.to && years.includes(savedPractice.from) && years.includes(savedPractice.to)
    ? savedPractice : localPractice
  const { from, to } = practice
  const period = `${from}-${to}`
  const answers = practice.answers[period] ?? {}
  const { reading: readingAnswer, prediction: predictionAnswer } = answers
  const savePractice = onPracticeChange ?? setLocalPractice

  function changePeriod(from: number, to: number) {
    savePractice({ ...practice, from, to })
    setShowTrend(false)
  }

  function chooseAnswer(question: keyof ChartAnswers, answer: number) {
    savePractice({ ...practice, answers: { ...practice.answers, [period]: { ...answers, [question]: answer } } })
  }

  const filtered = points.filter(point => point.year >= from && point.year <= to)
  const comparable = points.some(point => point.reference !== undefined)
  const displayUnit = language === 'es' && unit === 'mm/year' ? 'mm/año' : unit
  const exerciseMeasure = `${label.toLocaleLowerCase(language)} (${unit === '0–1' ? t('escala de 0 a 1', 'scale from 0 to 1') : displayUnit})`
  const lines = ([
    { key: 'value', name: site, show: series !== 'reference' },
    { key: 'reference', name: 'Bramble Cay', show: comparable && series !== 'value' },
  ] as const).filter(line => line.show)
  const first = filtered[0]
  const last = filtered.at(-1)
  const exercise = !standalone && series !== 'reference' && chartQuestions(first, last, unit)
  const { readingCorrect, predictionCorrect } = gradeChartQuestions(exercise || undefined, answers)
  const correctCount = Number(readingCorrect) + Number(predictionCorrect)
  const nextYear = to + 1
  const projected = exercise && predictionCorrect ? Array.from({ length: to === archiveEndYear ? 5 : 1 }, (_, i) => ({
    year: nextYear + i, value: exercise.project(nextYear + i),
  })) : []
  const showProjection = projected.length > 0
  const chartEnd = showProjection ? projected[projected.length - 1].year : to
  const projectionPeriod = nextYear === chartEnd ? `${nextYear}` : `${nextYear}–${chartEnd}`
  const projectionLabel = nextYear <= archiveEndYear ? t('Estimación', 'Estimate') : t('Proyección', 'Projection')
  const values = lines.flatMap(line => filtered.flatMap(point => {
    const value = point[line.key]
    return value === undefined ? [] : [value]
  }))
  const trends = showTrend ? lines.map(line => {
    const observations = filtered.flatMap(({ year, [line.key]: value }) => value === undefined ? [] : [{ year, value }])
    const result = analyze(line.key, observations, from, to)
    const rate = (result.slope ?? 0) / 10
    const offsets = observations.map(({ year, value }) => value - rate * (year - from)).sort((a, b) => a - b)
    const intercept = (offsets[Math.floor((offsets.length - 1) / 2)] + offsets[Math.floor(offsets.length / 2)]) / 2
    const fit = result.slope === null ? null : { start: intercept, end: intercept + rate * (to - from) }
    if (fit) values.push(fit.start, fit.end)
    return { ...line, result, fit }
  }) : []
  const destinationTrend = trends.find(line => line.key === 'value')?.result
  const matchesReview = review?.from === from && review.to === to
  const alreadyRecorded = reviewSaved && matchesReview && (!destinationTrend || Boolean(review?.trend))
  if (showProjection) values.push(...projected.map(point => point.value))
  const minimum = values.length ? Math.min(...values) : 0
  const maximum = values.length ? Math.max(...values) : 0
  const padding = (maximum - minimum) * .06 || Math.abs(maximum) * .05 || 1
  const low = chart === 'bars' ? Math.min(0, minimum) : minimum - padding
  const high = chart === 'bars' ? Math.max(0, maximum) || (minimum === 0 ? 1 : 0) : maximum + padding
  const axisFormat = new Intl.NumberFormat(language, { maximumFractionDigits: high - low >= 20 ? 0 : high - low >= 2 ? 1 : 3 })
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const spacing = plotWidth / (chartEnd - from + 1)
  const x = (year: number) => left + spacing * (year - from + .5)
  const y = (value: number) => top + plotHeight * (high - value) / (high - low || 1)
  const barWidth = Math.min(24, spacing * .72 / lines.length)
  const tickYears = [...new Set(Array.from({ length: 5 }, (_, i) => Math.round(from + (to - from) * i / 4)))].filter(year => !showProjection || year < to - (to - from > 15 ? 3 : 0))
  const alternateStep = unit === '0–1' ? .035 : unit === 'mm/year' ? 30 : .45
  const estimates: number[] = []
  if (exercise && last) {
    const { prediction: projectedValue, annualChange, clamp } = exercise
    const candidates = [projectedValue, last.value, last.value - annualChange, projectedValue + alternateStep,
      projectedValue - alternateStep, projectedValue + alternateStep * 2, projectedValue - alternateStep * 2]
    for (const candidate of candidates.map(clamp)) {
      if (!estimates.some(option => format.format(option) === format.format(candidate))) estimates.push(candidate)
      if (estimates.length === 3) break
    }
    estimates.sort((a, b) => a - b)
    const offset = (from + site.length + Math.round(Math.abs(first.value) * 1000)) % estimates.length
    estimates.push(...estimates.splice(0, offset))
  }
  const readingChoices = [
    { answer: 1, label: t('Mayor', 'Higher') },
    { answer: -1, label: t('Menor', 'Lower') },
    { answer: 0, label: t('Igual', 'Equal') },
  ]

  return <section className="data-viewer" aria-labelledby="data-viewer-title">
    {onBack && <button className="back" onClick={onBack}>← {t('Volver a los datos', 'Back to the data')}</button>}
    <h3 id="data-viewer-title" className={standalone ? undefined : 'dialogue-reader'} ref={title} tabIndex={-1}>{t('Visualizador de datos', 'Data Viewer')}</h3>
    {requestAction}
    <p className="viewer-variable"><strong>{label}</strong> · {displayUnit}
      {source && <> · <a href={source.url} target="_blank" rel="noreferrer">{source.provider}</a></>}
    </p>
    <p role="status">{from === to ? from : `${from}–${to}`} · {filtered.length} {filtered.length === 1 ? t('año con datos', 'year with data') : t('años con datos', 'years with data')}</p>
    <ul className="viewer-legend">
      {lines.map(line => <li key={line.key}><span style={{ background: colors[line.key] }} aria-hidden="true" />{line.name}</li>)}
      {trends.some(line => line.fit) && <li className="viewer-trend-key">{t('Pendiente de Sen', 'Sen slope')}</li>}
      {showProjection && <li className="viewer-projection-key">{projectionLabel} · {projectionPeriod}</li>}
    </ul>
    <svg className="viewer-chart" viewBox={`0 0 ${width} ${height}`} role="img"
      aria-label={`${label} (${displayUnit}), ${lines.map(line => line.name).join(' / ')}, ${from}–${to}${showProjection ? `, ${projectionLabel} ${projectionPeriod}` : ''}`}>
      {showProjection && <rect x={x(nextYear) - spacing / 2} y={top} width={(chartEnd - to) * spacing} height={plotHeight} fill="#e9c47a" opacity=".10" />}
      {Array.from({ length: 5 }, (_, i) => high - (high - low) * i / 4).map(tick => <g key={tick}>
        <line x1={left} y1={y(tick)} x2={width - right} y2={y(tick)} stroke="currentColor" opacity=".22" />
        <text x={left - 7} y={y(tick)} textAnchor="end" dominantBaseline="middle">{axisFormat.format(tick)}</text>
      </g>)}
      <path d={`M${left} ${top}V${height - bottom}H${width - right}`} fill="none" stroke="currentColor" />
      {tickYears.map(year => <text key={year} x={x(year)} y={height - 19} textAnchor="middle">{year}</text>)}
      {showProjection && last && <g>
        <path d={`M${x(last.year)} ${y(last.value)}${projected.map(point => `L${x(point.year)} ${y(point.value)}`).join('')}`}
          fill="none" stroke={colors.value} strokeWidth="3" strokeDasharray="6 5" />
        <text x={width - right} y={height - 19} textAnchor="end">{projectionPeriod}</text>
      </g>}
      {lines.map((line, index) => <g key={line.key} fill={colors[line.key]}>
        {filtered.map((point, i) => {
          const value = point[line.key]
          if (value === undefined) return null
          const previous = filtered[i - 1]
          const previousValue = previous?.[line.key]
          const hint = `${line.name} · ${point.year} · ${observationFormat.format(value)} ${displayUnit}`
          if (chart === 'bars') return <rect key={point.year}
            x={x(point.year) + (index - lines.length / 2) * barWidth}
            y={Math.min(y(value), y(0))} width={Math.max(1, barWidth - 1)} height={Math.max(1, Math.abs(y(value) - y(0)))}>
            <title>{hint}</title>
          </rect>
          return <g key={point.year}>
            {chart === 'line' && previousValue !== undefined && previous.year === point.year - 1 &&
              <line x1={x(previous.year)} y1={y(previousValue)} x2={x(point.year)} y2={y(value)} stroke={colors[line.key]} strokeWidth="2" />}
            <circle cx={x(point.year)} cy={y(value)} r={chart === 'points' ? 3.5 : 2.4}><title>{hint}</title></circle>
          </g>
        })}
      </g>)}
      {trends.map(({ key, fit }) => fit && <line key={key} className="viewer-fit-line"
        x1={x(from)} y1={y(fit.start)} x2={x(to)} y2={y(fit.end)}
        stroke={colors[key]} strokeWidth="2" strokeDasharray="2 5" />)}
    </svg>
    <div className="viewer-actions">
      {onReview && exercise && <button type="button" onClick={() => questionsHeading.current?.focus()}>
        {t('Ir a las preguntas', 'Go to the questions')} ↓
      </button>}
      <button className="viewer-open trend-trigger" onClick={() => {
        if (!showTrend && onTrend) onTrend(analyze('value', filtered, from, to))
        setShowTrend(!showTrend)
      }} aria-expanded={showTrend}>
        {showTrend ? t('Ocultar Mann–Kendall', 'Hide Mann–Kendall') : t('Trazar tendencia (Mann–Kendall)', 'Plot trend (Mann–Kendall)')}
      </button>
    </div>
    {onReview && comparable && <>
      {reviewSaved && review && <p className="viewer-record" role="status">{t('En el expediente', 'In the dossier')} · {review.from}–{review.to} · {review.trend
        ? t('Prueba guardada', 'Test saved') : t('Sin prueba estadística', 'No statistical test')}</p>}
      {!exercise && <p>{t('Para responder las preguntas y registrar el análisis, muestra el arriendo y selecciona al menos dos años.', 'To answer the questions and record the analysis, show the rental and select at least two years.')}</p>}
    </>}
    {showTrend && <div className="viewer-trends">
      {trends.map(({ key, name, result }) => {
        const direction = result.slope === null ? '—' : result.slope > 0 ? t('Aumento', 'Increase')
          : result.slope < 0 ? t('Descenso', 'Decrease') : t('Sin cambio estimado', 'No estimated change')
        return <article key={key} className="habitat-card">
          <h4>{name} · {from}–{to}</h4>
          <p>{direction} · {result.slope === null ? '—' : format.format(result.slope)} {displayUnit}/{t('década', 'decade')}</p>
          <p>{result.p === null ? t('La prueba necesita 10 años válidos consecutivos.', 'The test needs 10 consecutive valid years.')
            : `${result.p < .05 ? t('Significativa', 'Significant') : t('No significativa', 'Not significant')} · p ${result.p < .001 ? '< 0.001' : result.p.toLocaleString(language, { maximumFractionDigits: 4 })}`}</p>
        </article>
      })}
      <p>{t('Pendiente de Sen y Mann–Kendall bilateral con preblanqueo sin tendencia de rezago 1 (p < 0,05).', 'Sen slope and two-sided Mann–Kendall with lag-1 trend-free prewhitening (p < 0.05).')}</p>
    </div>}
    <details className="viewer-filter-panel" open={standalone || undefined}>
      <summary>{t('Filtros del gráfico', 'Chart filters')}</summary>
      <div className="viewer-filters">
        {!standalone && <><div><label htmlFor="viewer-from">{t('Desde', 'From')}</label><select id="viewer-from" value={from} onChange={event => {
          const year = Number(event.target.value)
          changePeriod(year, Math.max(year, to))
        }}>
          {years.map(year => <option key={year}>{year}</option>)}
        </select></div>
        <div><label htmlFor="viewer-to">{t('Hasta', 'To')}</label><select id="viewer-to" value={to} onChange={event => {
          const year = Number(event.target.value)
          changePeriod(Math.min(year, from), year)
        }}>
          {years.map(year => <option key={year}>{year}</option>)}
        </select></div></>}
        <div><label htmlFor="viewer-chart-type">{t('Tipo de gráfico', 'Chart type')}</label><select id="viewer-chart-type" value={chart} onChange={event => setChart(event.target.value as ChartType)}>
          <option value="line">{t('Líneas', 'Line')}</option>
          <option value="bars">{t('Barras', 'Bars')}</option>
          <option value="points">{t('Puntos', 'Points')}</option>
        </select></div>
        {comparable && <div><label htmlFor="viewer-series">{t('Mostrar', 'Show')}</label><select id="viewer-series" value={series} onChange={event => { setSeries(event.target.value); setShowTrend(false) }}>
          <option value="both">{t('Ambas series', 'Both series')}</option>
          <option value="value">{site}</option>
          <option value="reference">Bramble Cay</option>
        </select></div>}
      </div>
    </details>
    {exercise && last && <section className="viewer-exercise" aria-labelledby="chart-exercise-title">
      <h4 id="chart-exercise-title" ref={questionsHeading} tabIndex={-1}>{t('Interpreta el gráfico', 'Read the chart')}</h4>
      {onReview && <p>{t('Responde bien las dos preguntas para registrar este análisis.', 'Answer both questions correctly to record this analysis.')}</p>}
      <fieldset>
        <legend>{t(`En ${site}, ¿el dato observado de ${exerciseMeasure} en ${last.year} fue mayor, menor o igual al de ${first.year}?`,
          `In ${site}, was the observed ${exerciseMeasure} value in ${last.year} higher than, lower than, or equal to the value in ${first.year}?`)}</legend>
        <div className="viewer-choices">{readingChoices.map(({ answer, label }) => <button key={answer} aria-pressed={readingAnswer === answer}
          onClick={() => chooseAnswer('reading', answer)}>{label}</button>)}</div>
        {readingAnswer !== undefined && <p role="status" className={readingCorrect ? 'answer-correct' : 'answer-incorrect'}>
          <strong>{readingCorrect ? t('Correcto.', 'Correct.') : t('Incorrecto.', 'Incorrect.')}</strong>{' '}
          {first.year}: {observationFormat.format(first.value)} {displayUnit} · {last.year}: {observationFormat.format(last.value)} {displayUnit}
        </p>}
      </fieldset>
      <fieldset>
        <legend>{t(`Si se mantuviera el cambio anual promedio, ¿qué valor de ${exerciseMeasure} estimarías para ${site} en ${nextYear}?`,
          `If the average annual change continued, what ${exerciseMeasure} value would you estimate for ${site} in ${nextYear}?`)}</legend>
        {nextYear <= archiveEndYear && <p>{t('Para estimar, usa solo los años seleccionados.', 'Use only the selected years to estimate.')}</p>}
        <p>{t('Calcula la diferencia entre el último y el primer valor, divídela por los años transcurridos y súmala al último valor.', 'Subtract the first value from the last, divide by the years between them, and add the result to the last value.')}
          {unit === '0–1' && t(' Mantén el resultado entre 0 y 1.', ' Keep the result between 0 and 1.')}
          {unit === 'mm/year' && t(' Usa cero si el resultado es negativo.', ' Use zero if the result is negative.')}</p>
        <div className="viewer-choices">{estimates.map(estimate => <button key={estimate} aria-pressed={predictionAnswer === estimate}
          onClick={() => chooseAnswer('prediction', estimate)}>{format.format(estimate)} {displayUnit}</button>)}</div>
        {predictionAnswer !== undefined && <p role="status" className={predictionCorrect ? 'answer-correct' : 'answer-incorrect'}>
          <strong>{predictionCorrect ? t('Correcto.', 'Correct.') : t('Incorrecto.', 'Incorrect.')}</strong>{' '}
          {predictionCorrect ? t('La línea punteada muestra la estimación bajo ese supuesto.', 'The dashed line shows the estimate under that assumption.')
            : t(`Divide el cambio entre ${first.year} y ${last.year} por ${last.year - first.year} y suma el resultado al dato de ${last.year}.`,
              `Divide the change from ${first.year} to ${last.year} by ${last.year - first.year} and add the result to the ${last.year} observation.`)}
        </p>}
        {calculatorTrigger}
      </fieldset>
      {onReview && comparable && <div className="viewer-actions">
        <button className="viewer-open primary" type="button" disabled={alreadyRecorded || correctCount !== 2}
          aria-describedby="chart-answer-count" onClick={() => onReview({ from, to, trend: destinationTrend ?? (matchesReview ? review?.trend : undefined) })}>
          {alreadyRecorded ? t('Análisis registrado', 'Analysis recorded') : t('Registrar análisis', 'Record analysis')}
        </button>
        <p id="chart-answer-count" role="status" className={correctCount === 2 ? 'answer-correct' : undefined}>
          {correctCount}/2 {t('respuestas correctas', 'correct answers')}
        </p>
      </div>}
    </section>}
    <details className="viewer-table"><summary>{t('Ver tabla del gráfico', 'View chart data table')}</summary>
      <table>
        <thead><tr><th scope="col">{t('Año', 'Year')}</th>{lines.map(line => <th key={line.key} scope="col">{line.name} ({displayUnit})</th>)}</tr></thead>
        <tbody>{filtered.map(point => <tr key={point.year}>
          <th scope="row">{point.year}</th>
          {lines.map(({key}) => <td key={key}>{point[key] === undefined ? '—' : observationFormat.format(point[key])}</td>)}
        </tr>)}</tbody>
      </table>
    </details>
  </section>
}
