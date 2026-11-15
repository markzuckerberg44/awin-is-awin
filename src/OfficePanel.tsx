import { useEffect, useId, useRef, useState } from 'react'
import { archiveEndYear, isPierStage, translate, type Language, type RentalApplication, type Role, type Stage } from './config'
import { DesktopHome, HabitatApp, type DesktopApp } from './DesktopApps'
import { DataViewer } from './DataViewer'
import { QuestionCalculator } from './QuestionCalculator'
import { TerrainEvidence, erubPlots } from './ErubTerrain'
import { compareHabitat, indicatorLabels, listings, type Indicator } from './habitat'
import { analyze, catalogue, queryBudget, type Evidence, type Investigation, type Stamp } from './investigation'
import type { OfficeTool } from './world'
import { evacuationStages } from './missions'

const stamps = ['up', 'down', 'unproven'] as const
const bootDuration = 1050

export function OfficePanel({ tool, language, role, progress, stage, onChange, onClose, onComputerClick, onHostReply, computerGuideComplete, onComputerGuideComplete, rental, onRent, onPack }: {
  tool: OfficeTool
  language: Language
  role: Role
  progress: Investigation
  stage: Stage
  onChange: (value: Investigation) => void
  onClose: () => void
  onComputerClick: () => void
  onHostReply: () => void
  computerGuideComplete: boolean
  onComputerGuideComplete: () => void
  rental?: RentalApplication
  onRent: (id: string) => void
  onPack: () => void
}) {
  const t = (es: string, en: string) => language === 'es' ? es : en
  const sawCoast = ['afterPier', 'bedtime', 'dreamExit', 'dreamFlood', 'wake', 'officeGoal', 'complete', ...evacuationStages, 'escaped', 'credits'].includes(stage)
  const heardEli = stage === 'pier' || isPierStage(stage) || sawCoast
  const heardAda = stage === 'adaWater' || stage === 'adaReturn' || stage === 'flood' || heardEli
  const dialog = useRef<HTMLDialogElement>(null)
  const glass = useRef<HTMLDivElement>(null)
  const calculatorId = useId()
  const calculatorButton = useRef<HTMLButtonElement>(null)
  const [calculatorOpen, setCalculatorOpen] = useState(false)
  const [desktopApp, setDesktopApp] = useState<DesktopApp>()
  const [guideStep, setGuideStep] = useState(0)
  const [terminalViewer, setTerminalViewer] = useState(false)
  const [site, setSite] = useState(catalogue[0]?.site ?? '')
  const [variable, setVariable] = useState('seaLevel')
  const [from, setFrom] = useState(catalogue[0]?.observations[0]?.year ?? 1993)
  const [to, setTo] = useState(Math.min(archiveEndYear, catalogue[0]?.observations.at(-1)?.year ?? 2008))
  const dataset = catalogue.find(item => item.site === site && item.variable === variable)
  const points = dataset?.observations.filter(point => point.year >= from && point.year <= Math.min(to, archiveEndYear)) ?? []
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

  useEffect(() => {
    if (!computer || booting) return
    if (glass.current) glass.current.scrollTop = 0
    glass.current?.querySelector<HTMLElement>(desktopApp ? '#office-panel-title' : computerGuideComplete ? '.pc-icon' : '.pc-guide-title')?.focus()
  }, [computer, booting, desktopApp, computerGuideComplete])

  function request() {
    if (!dataset || !points.length || from > to || to > archiveEndYear) return
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
  const calculatorTrigger = <div className="question-calculator">
    <button type="button" className="calculator-green" ref={calculatorButton} aria-haspopup="dialog"
      aria-expanded={calculatorOpen} aria-controls={calculatorId} onClick={() => setCalculatorOpen(true)}>
      {t('Usar calculadora', 'Use calculator')}
    </button>
  </div>

  return <dialog ref={dialog} className={`office-panel office-${tool}`} aria-labelledby="office-panel-title"
    onClickCapture={computer ? event => {
      if (!(event.target instanceof Element)) return
      const label = event.target.closest('label')
      if (label?.control && !label.control.contains(event.target) && !label.control.matches(':disabled')) return
      onComputerClick()
    } : undefined}
    onCancel={event => { event.preventDefault(); onClose() }}>
    {!computer && <header>
      <h2 id="office-panel-title">{toolTitle}</h2>
      <button className="back" onClick={onClose}>{t('Cerrar', 'Close')} <kbd>Esc</kbd></button>
    </header>}
    <div ref={glass} className={computer ? 'computer-glass office-content' : 'office-content'}>
      {computer && booting && <section className="computer-boot" aria-labelledby="office-panel-title">
        <h2 id="office-panel-title">{t('Encendiendo el PC', 'Starting the computer')}</h2>
        <p role="status">{t('Cargando escritorio…', 'Loading desktop…')}</p>
        <div className="computer-boot-track" aria-hidden="true">
          <span style={{ animationDuration: `${bootDuration}ms` }} />
        </div>
      </section>}
      {computer && !booting && !desktopApp && <DesktopHome language={language} open={setDesktopApp}
        guideStep={computerGuideComplete ? undefined : guideStep} nextGuideStep={() => setGuideStep(step => step + 1)}
        finishGuide={onComputerGuideComplete} />}
      {computer && !booting && desktopApp && <header className="computer-toolbar" data-app={desktopApp}>
        <h2 id="office-panel-title" tabIndex={-1}>{desktopApp === 'terminal' ? toolTitle
          : desktopApp === 'passport' ? t('Mi pasaporte', 'My Passport') : 'DirtBNB'}</h2>
        {desktopApp === 'terminal' && <p className="office-budget">{t('Consultas disponibles', 'Requests left')} <strong>{Math.max(0, queryBudget - progress.evidence.length)}/{queryBudget}</strong></p>}
        <button className="back" onClick={() => { setTerminalViewer(false); setDesktopApp(undefined) }}>← {t('Escritorio', 'Desktop')}</button>
      </header>}
      {computer && !booting && (desktopApp === 'passport' || desktopApp === 'rentals') &&
        <HabitatApp key={desktopApp} app={desktopApp} language={language} role={role} progress={progress}
          onChange={onChange} onHostReply={onHostReply} calculatorTrigger={calculatorTrigger}
          canRent={stage === 'evacuation'} rental={rental} onRent={onRent} onPack={onPack} />}
      {computer && !booting && desktopApp === 'terminal' && (terminalViewer && dataset && current ?
        <DataViewer language={language} label={t('Nivel del mar', 'Sea level')} unit={dataset.unit} site={dataset.site}
          points={points} onBack={() => setTerminalViewer(false)} /> : <>
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
              <label>{t('Desde', 'From')}<input type="number" min={1900} max={archiveEndYear} value={from} onChange={event => setFrom(Number(event.target.value))} /></label>
              <label>{t('Hasta', 'To')}<input type="number" min={1900} max={archiveEndYear} value={to} onChange={event => setTo(Number(event.target.value))} /></label>
            </div>
            <p>{t('Busca cambios a lo largo de varios años. El nivel del mar de la región y la inundación de una casa se observan a escalas distintas.', 'Look for change across several years. Regional sea level and flooding at one house are observed on different scales.')}</p>
            {!dataset && <p className="office-status" role="status">{t('Serie histórica pendiente de verificar para el estrecho de Torres. Las consultas estarán disponibles cuando se incorpore la serie.', 'The historical Torres Strait series is awaiting verification. Requests will be available once it is added.')}</p>}
            {dataset && from > to && <p role="status">{t('El año inicial debe ser anterior o igual al final.', 'The start year must be at or before the end year.')}</p>}
            {dataset && from <= to && !points.length && <p role="status">{t('Este periodo no contiene observaciones.', 'This period has no observations.')}</p>}
            <button disabled={Boolean(available) || !points.length || from > to || to > archiveEndYear || progress.evidence.length >= queryBudget}
              onClick={request}>{available ? t('Consulta guardada', 'Request saved') : t('Pedir datos y analizar (Mann–Kendall)', 'Request data and analyze (Mann–Kendall)')}</button>
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
              <button onClick={() => setTerminalViewer(true)}>{t('Abrir Visualizador de datos', 'Open Data Viewer')}</button>
              <p>{t('Mann–Kendall bilateral con preblanqueo sin tendencia de rezago 1. Umbral p < 0,05.', 'Two-sided Mann–Kendall with lag-1 trend-free prewhitening. Threshold p < 0.05.')}</p>
            </> : <div className="computer-empty">
              <p>{t('Esperando datos para la selección actual', 'Waiting for data for the current selection')}</p>
            </div>}
          </section>
        </div>
      </>)}
      {tool === 'notebook' && <>
        <article className="office-sheet">
          <h3>{t('Observaciones del cayo', 'Observations from the cay')}</h3>
          {heardAda && <p>{t('Ada contó que el depósito de agua se vació durante el calor.', 'Ada said the water tank ran dry during the heat.')}</p>}
          {heardEli && <p>{t('Eli contó que una inundación alcanzó la casa de su hermana.', 'Eli said a flood reached his sister’s house.')}</p>}
          <p>{sawCoast ? t('Desde el muelle, viste agua donde la foto del cartel mostraba arena. Registra qué serie pedirías para saber si el nivel del mar cambió con los años.', 'From the pier you saw water where the sign’s photograph showed sand. Note which series you would request to find out whether sea level changed over time.')
            : t('Ve al muelle para comparar el cartel antiguo con la costa actual.', 'Visit the pier to compare the old sign with the coast today.')}</p>
        </article>
        <label>{t('Mis notas', 'My notes')}<textarea rows={5} value={progress.notes} onChange={event => onChange({ ...progress, notes: event.target.value })} /></label>
        <h3>{t('Series guardadas', 'Saved series')}</h3>
        {progress.evidence.length ? progress.evidence.map(item => <div key={`${item.series}-${item.from}-${item.to}`}>{evidenceCard(item)}</div>) :
          <p>{t('Aquí se guardan las consultas del PC con sus filtros.', 'Computer requests are saved here with their filters.')}</p>}
        {listings.some(place => progress.habitatRequests?.[place.id]?.length) && <h3>DirtBNB</h3>}
        {listings.filter(place => progress.habitatRequests?.[place.id]?.length).map(place => <article className="office-sheet" key={place.id}>
          <h4>{place.name} · {place.owner}</h4>
          {progress.habitatRequests?.[place.id].filter((id): id is Indicator => Object.hasOwn(indicatorLabels, id)).map(indicator => {
            const result = compareHabitat(place.climateId, indicator)
            return <p key={indicator}>{translate(language, indicatorLabels[indicator])} · {result
              ? `${result.destination.mean.toLocaleString(language, { maximumFractionDigits: 2 })} ${language === 'es' && result.unit === 'mm/year' ? 'mm/año' : result.unit}`
              : t('Sin datos comparables', 'No comparable data')}</p>
          })}
          {progress.habitatRequests?.[place.id].includes('terrain') && <TerrainEvidence language={language} id={place.id} compact />}
        </article>)}
      </>}
      {tool === 'dossier' && <>
        <section className="office-sheet">
          <h3>{t('Comparación de terrenos de Erub', 'Erub site comparison')}</h3>
          {listings.filter(place => erubPlots[place.id] && progress.habitatRequests?.[place.id]?.includes('terrain')).map(place =>
            <TerrainEvidence key={place.id} language={language} id={place.id} compact />)}
          {['erub', 'erub-coast'].every(id => progress.habitatRequests?.[id]?.includes('terrain')) ? <>
            <label>{t('Terreno para investigar', 'Site to investigate')}
              <select value={progress.terrainChoice ?? ''} onChange={event => onChange({ ...progress, terrainChoice: event.target.value || undefined })}>
                <option value="">{t('Selecciona un arriendo', 'Select a rental')}</option>
                {listings.filter(place => erubPlots[place.id]).map(place =>
                  <option key={place.id} value={place.id}>{translate(language, place.listing)}</option>)}
              </select>
            </label>
            <label>{t('Justificación del terreno y evidencia pendiente', 'Site rationale and outstanding evidence')}
              <textarea rows={3} value={progress.terrainRationale ?? ''} onChange={event => onChange({ ...progress, terrainRationale: event.target.value })} />
            </label>
          </> : <p>{t('Pide la ficha de ambos arriendos en DirtBNB para registrar tu elección.', 'Request the site report for both rentals in DirtBNB to record your choice.')}</p>}
        </section>
        <article className="office-sheet">
          <h3>{t('Afirmación por cotejar', 'Claim to review')}</h3>
          <p>{t('El nivel del mar aumentó en la región durante el periodo investigado.', 'Sea level rose in the region during the period under investigation.')}</p>
          <p>{t('Para evaluar un refugio, reúne evidencia sobre la elevación, el riesgo de inundación, el alimento disponible y la presencia de plantas de poca altura, como hierbas y plantas rastreras.', 'To assess a refuge, gather evidence on elevation, flood exposure, available food and the presence of low-growing plants such as grasses and creeping plants.')}</p>
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
    {computer && <QuestionCalculator id={calculatorId} language={language} open={calculatorOpen} onClose={() => {
      setCalculatorOpen(false)
      const target = calculatorButton.current ?? dialog.current?.querySelector<HTMLElement>('.computer-exit')
      target?.focus({ preventScroll: true })
    }} />}
  </dialog>
}
