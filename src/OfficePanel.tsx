import { useEffect, useRef, useState } from 'react'
import { isPierStage, type Language, type Stage } from './config'
import { analyze, catalogue, queryBudget, type Evidence, type Investigation, type Stamp } from './investigation'
import type { OfficeTool } from './world'

const stamps = ['up', 'down', 'unproven'] as const
const bootDuration = 1050

export function OfficePanel({ tool, language, progress, stage, onChange, onClose }: {
  tool: OfficeTool
  language: Language
  progress: Investigation
  stage: Stage
  onChange: (value: Investigation) => void
  onClose: () => void
}) {
  const t = (es: string, en: string) => language === 'es' ? es : en
  const heardEli = stage === 'pier' || isPierStage(stage)
  const heardAda = stage === 'flood' || heardEli
  const dialog = useRef<HTMLDialogElement>(null)
  const [site, setSite] = useState(catalogue[0]?.site ?? '')
  const [variable, setVariable] = useState('seaLevel')
  const [from, setFrom] = useState(catalogue[0]?.observations[0]?.year ?? 1993)
  const [to, setTo] = useState(catalogue[0]?.observations.at(-1)?.year ?? 2008)
  const dataset = catalogue.find(item => item.site === site && item.variable === variable)
  const points = dataset?.observations.filter(point => point.year >= from && point.year <= to) ?? []
  const stampLabel = (stamp: Stamp) => stamp === 'up' ? 'REAL ↑' : stamp === 'down' ? 'REAL ↓' : t('NO PROBADO', 'NOT PROVEN')
  const available = progress.evidence.find(item => item.series === dataset?.id && item.from === from && item.to === to)
  const lastEvidence = progress.evidence.at(-1)
  const ready = lastEvidence && progress.stamp === lastEvidence.stamp && progress.rationale?.trim() &&
    (progress.destination === 'hold' || (lastEvidence.stamp !== 'unproven' && progress.destination?.trim()))
  const toolTitle = tool === 'computer' ? t('Terminal de datos', 'Data terminal')
    : tool === 'notebook' ? t('Cuaderno de campo', 'Field notebook') : t('Expediente de traslado', 'Relocation dossier')
  const computer = tool === 'computer'
  const [booting, setBooting] = useState(computer)

  useEffect(() => {
    dialog.current?.showModal()
    dialog.current?.querySelector<HTMLButtonElement>('.computer-exit')?.focus()
  }, [])

  useEffect(() => {
    if (!computer) return
    const timer = window.setTimeout(() => setBooting(false), bootDuration)
    return () => window.clearTimeout(timer)
  }, [computer])

  function request() {
    if (!dataset || !points.length || from > to) return
    if (available) return
    if (progress.evidence.length >= queryBudget) return
    const evidence = analyze(dataset.id, points, from, to)
    onChange({ ...progress, evidence: [...progress.evidence, evidence], signed: false, stamp: undefined })
  }

  function evidenceCard(evidence: Evidence) {
    const source = catalogue.find(item => item.id === evidence.series)
    return <article className="office-sheet">
      <h3>{source?.site} · {evidence.from}–{evidence.to}</h3>
      <p>{source?.product} · {evidence.count}/{evidence.to - evidence.from + 1} {t('años válidos', 'valid years')}</p>
      <p>{t('Pendiente de Sen', 'Sen slope')}: {evidence.slope === null ? '—' : evidence.slope.toFixed(2)} {source?.unit}/{t('década', 'decade')} · p {evidence.p === null ? '—' : evidence.p < 0.001 ? '< 0.001' : evidence.p.toFixed(3)}</p>
      {evidence.p === null && <p>{t('La prueba necesita al menos 10 años consecutivos con datos válidos.', 'The test needs at least 10 consecutive years with valid data.')}</p>}
      <p><strong>{stampLabel(evidence.stamp)}</strong></p>
      {source && <a href={source.source} target="_blank" rel="noreferrer">{t('Fuente de la serie', 'Series source')}</a>}
    </article>
  }

  const current = available
  const min = Math.min(...points.map(point => point.value))
  const max = Math.max(...points.map(point => point.value))
  const y = (value: number) => 94 - 74 * (value - min) / (max - min || 1)
  const x = (year: number) => 32 + 318 * (year - from) / (to - from || 1)

  return <dialog ref={dialog} className={`office-panel office-${tool}`} aria-labelledby="office-panel-title"
    onCancel={event => { event.preventDefault(); onClose() }}>
    {!computer && <header>
      <h2 id="office-panel-title">{toolTitle}</h2>
      <button className="back" onClick={onClose}>{t('Cerrar', 'Close')} <kbd>Esc</kbd></button>
    </header>}
    <div className={computer ? 'computer-glass office-content' : 'office-content'}>
      {computer && booting && <section className="computer-boot" aria-labelledby="office-panel-title">
        <h2 id="office-panel-title">{t('Encendiendo el PC', 'Starting the computer')}</h2>
        <p role="status">{t('Cargando terminal de datos…', 'Loading data terminal…')}</p>
        <div className="computer-boot-track" aria-hidden="true">
          <span style={{ animationDuration: `${bootDuration}ms` }} />
        </div>
      </section>}
      {computer && !booting && <>
        <header className="computer-toolbar">
          <h2 id="office-panel-title">{toolTitle}</h2>
          <p className="office-budget">{t('Consultas disponibles', 'Requests left')} <strong>{Math.max(0, queryBudget - progress.evidence.length)}/{queryBudget}</strong></p>
        </header>
        <div className="computer-workspace">
          <div className="office-terminal">
            <div className="office-filters">
              <label>{t('Región', 'Region')}<select value={site} onChange={event => setSite(event.target.value)}>
                {!catalogue.length && <option value="">{t('Estrecho de Torres', 'Torres Strait')}</option>}
                {[...new Set(catalogue.map(item => item.site))].map(item => <option key={item}>{item}</option>)}
              </select></label>
              <label>{t('Variable', 'Variable')}<select value={variable} onChange={event => setVariable(event.target.value)}>
                <option value="seaLevel">{t('Nivel del mar', 'Sea level')}</option>
              </select></label>
              <label>{t('Desde', 'From')}<input type="number" min={1900} max={2100} value={from} onChange={event => setFrom(Number(event.target.value))} /></label>
              <label>{t('Hasta', 'To')}<input type="number" min={1900} max={2100} value={to} onChange={event => setTo(Number(event.target.value))} /></label>
            </div>
            <p>{t('Busca cambios a lo largo de varios años. El nivel del mar de la región y la inundación de una casa se observan a escalas distintas.', 'Look for change across several years. Regional sea level and flooding at one house are observed on different scales.')}</p>
            {!dataset && <p className="office-status" role="status">{t('Serie histórica pendiente de verificar para el estrecho de Torres. Las consultas estarán disponibles cuando se incorpore la serie.', 'The historical Torres Strait series is awaiting verification. Requests will be available once it is added.')}</p>}
            {dataset && from > to && <p role="status">{t('El año inicial debe ser anterior o igual al final.', 'The start year must be at or before the end year.')}</p>}
            {dataset && from <= to && !points.length && <p role="status">{t('Este periodo no contiene observaciones.', 'This period has no observations.')}</p>}
            <button disabled={Boolean(available) || !points.length || from > to || progress.evidence.length >= queryBudget}
              onClick={request}>{available ? t('Consulta guardada', 'Request saved') : t('Pedir datos y analizar', 'Request data and analyze')}</button>
          </div>
          <section className="computer-results" aria-label={t('Serie temporal', 'Time series')}>
            <h3>{t('Serie temporal', 'Time series')}</h3>
            {current ? <>
              <svg className="office-chart" viewBox="0 0 380 124" role="img" aria-label={`${dataset?.site}, ${from}–${to}, ${dataset?.unit}`}>
                <path d="M32 10V95H350" fill="none" stroke="currentColor" />
                <text x="2" y="16">{dataset?.unit}</text><text x="32" y="114">{from}</text><text x="322" y="114">{to}</text>
                <text x="5" y="32">{max.toFixed(1)}</text><text x="5" y="91">{min.toFixed(1)}</text>
                {points.map((point, i) => <g key={point.year}>
                  {i > 0 && point.year === points[i-1].year + 1 && <line x1={x(points[i-1].year)} y1={y(points[i-1].value)} x2={x(point.year)} y2={y(point.value)} stroke="currentColor" strokeWidth="2" />}
                  <circle cx={x(point.year)} cy={y(point.value)} r="2.5" fill="currentColor"><title>{point.year}: {point.value}</title></circle>
                </g>)}
              </svg>
              {evidenceCard(current)}
              <p>{t('Mann–Kendall bilateral con preblanqueo sin tendencia de rezago 1. Umbral p < 0,05.', 'Two-sided Mann–Kendall with lag-1 trend-free prewhitening. Threshold p < 0.05.')}</p>
            </> : <div className="computer-empty">
              <p>{t('Esperando datos para la selección actual', 'Waiting for data for the current selection')}</p>
            </div>}
          </section>
        </div>
      </>}
      {tool === 'notebook' && <>
        <article className="office-sheet">
          <h3>{t('Observaciones del cayo', 'Observations from the cay')}</h3>
          {heardAda && <p>{t('Ada contó que el depósito de agua se vació durante el calor.', 'Ada said the water tank ran dry during the heat.')}</p>}
          {heardEli && <p>{t('Eli contó que una inundación alcanzó la casa de su familia.', 'Eli said a flood reached her family’s house.')}</p>}
          <p>{stage === 'complete' ? t('Desde el muelle, viste agua donde la foto del cartel mostraba arena. Registra qué serie pedirías para saber si el nivel del mar cambió con los años.', 'From the pier you saw water where the sign’s photograph showed sand. Note which series you would request to find out whether sea level changed over time.')
            : t('Ve al muelle para comparar el cartel antiguo con la costa actual.', 'Visit the pier to compare the old sign with the coast today.')}</p>
        </article>
        <label>{t('Mis notas', 'My notes')}<textarea rows={5} value={progress.notes} onChange={event => onChange({ ...progress, notes: event.target.value })} /></label>
        <h3>{t('Series guardadas', 'Saved series')}</h3>
        {progress.evidence.length ? progress.evidence.map(item => <div key={`${item.series}-${item.from}-${item.to}`}>{evidenceCard(item)}</div>) :
          <p>{t('Aquí se guardan las consultas del PC con sus filtros.', 'Computer requests are saved here with their filters.')}</p>}
      </>}
      {tool === 'dossier' && <>
        <article className="office-sheet">
          <h3>{t('Afirmación por cotejar', 'Claim to review')}</h3>
          <p>{t('El nivel del mar aumentó en la región durante el periodo investigado.', 'Sea level rose in the region during the period under investigation.')}</p>
          <p>{t('Para evaluar un refugio, reúne evidencia de elevación, exposición a inundación, alimento y cobertura vegetal.', 'To assess a refuge, gather evidence on elevation, flood exposure, food and vegetation cover.')}</p>
        </article>
        {lastEvidence && evidenceCard(lastEvidence)}
        <div className="office-stamps" aria-label={t('Sello de tendencia', 'Trend stamp')}>
          {stamps.map(stamp => <button key={stamp} disabled={progress.signed} aria-pressed={progress.stamp === stamp}
            onClick={() => onChange({ ...progress, stamp })}>{stampLabel(stamp)}</button>)}
        </div>
        {lastEvidence && progress.stamp && progress.stamp !== lastEvidence.stamp && <p role="status">{t('Revisa la dirección, la cobertura y el valor p de la serie antes de elegir el sello.', 'Check the direction, coverage and p-value before choosing a stamp.')}</p>}
        <label>{t('Destino evaluado', 'Destination assessed')}
          <input value={progress.destination === 'hold' ? '' : progress.destination ?? ''} disabled={progress.signed}
            onChange={event => onChange({ ...progress, destination: event.target.value })}
            placeholder={t('Nombre del lugar', 'Site name')} />
        </label>
        <label>{t('Justificación y condición pendiente', 'Rationale and outstanding condition')}
          <textarea rows={4} value={progress.rationale ?? ''} disabled={progress.signed}
            onChange={event => onChange({ ...progress, rationale: event.target.value })} />
        </label>
        <label className="office-check"><input type="checkbox" checked={progress.destination === 'hold'} disabled={progress.signed}
          onChange={event => onChange({ ...progress, destination: event.target.checked ? 'hold' : '' })} />
          {t('Aplazar el traslado por evidencia insuficiente', 'Defer the relocation due to insufficient evidence')}
        </label>
        {!lastEvidence && <p role="status">{t('Borrador. Registra una consulta en el PC para poder firmar.', 'Draft. Log a request on the computer before signing.')}</p>}
        {progress.signed ? <p role="status"><strong>{t('Veredicto firmado.', 'Verdict signed.')}</strong></p> :
          <button disabled={!ready} onClick={() => onChange({ ...progress, signed: true })}>{t('Firmar veredicto', 'Sign verdict')}</button>}
      </>}
    </div>
    {computer && <footer className="computer-bezel">
      <span className="computer-vents" aria-hidden="true" />
      <button className="back computer-exit" onClick={onClose}>
        <span className="computer-light" aria-hidden="true" />{t('Dejar de mirar', 'Look away')} <kbd>Esc</kbd>
      </button>
    </footer>}
  </dialog>
}
