import { useEffect, useId, useRef, useState } from 'react'
import { archiveEndYear, isPierStage, translate, type Language, type RentalApplication, type Role, type Stage } from './config'
import { DesktopHome, HabitatApp, type DesktopApp } from './DesktopApps'
import { DataViewer } from './DataViewer'
import { QuestionCalculator } from './QuestionCalculator'
import { TerrainEvidence } from './ErubTerrain'
import { RelocationDossier } from './RelocationDossier'
import { catalogue, listings, rentalReview, rentalReviewSaved, requirements, seriesLabels, seriesSite } from './habitat'
import { queryBudget, queryId, type Investigation, type Query } from './investigation'
import type { OfficeTool } from './world'
import { evacuationStages } from './missions'

const bootDuration = 1050

export function OfficePanel({ tool, language, role, progress, stage, onChange, onClose, onComputerClick, onHostReply, computerGuideComplete, onComputerGuideComplete, rental, onRent, onPack, initialApp, seated, onOpenTool, onStamp }: {
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
  initialApp?: DesktopApp
  seated: boolean
  onOpenTool: (tool: OfficeTool, app?: DesktopApp) => void
  onStamp: () => void
}) {
  const t = (es: string, en: string) => language === 'es' ? es : en
  const sawCoast = ['afterPier', 'bedtime', 'dreamExit', 'dreamFlood', 'wake', 'officeGoal', 'complete', ...evacuationStages, 'escaped', 'credits'].includes(stage)
  const heardEli = stage === 'pier' || isPierStage(stage) || sawCoast
  const heardAda = stage === 'adaWater' || stage === 'adaReturn' || stage === 'flood' || heardEli
  const dialog = useRef<HTMLDialogElement>(null)
  const glass = useRef<HTMLDivElement>(null)
  const calculatorId = useId()
  const calculatorButton = useRef<HTMLButtonElement>(null)
  const requestControl = useRef<HTMLButtonElement>(null)
  const returnToRequest = useRef(false)
  const [calculatorOpen, setCalculatorOpen] = useState(false)
  const [desktopApp, setDesktopApp] = useState<DesktopApp | undefined>(initialApp)
  const [guideStep, setGuideStep] = useState(0)
  const [terminalViewer, setTerminalViewer] = useState(false)
  const [seriesId, setSeriesId] = useState(catalogue[0].id)
  const dataset = catalogue.find(item => item.id === seriesId)!
  const marine = dataset.variable === 'seaLevel'
  const regions = [...new Set(catalogue.map(item => item.site))]
  const [from, setFrom] = useState(catalogue[0].observations[0].year)
  const [to, setTo] = useState(archiveEndYear)
  const points = dataset.observations.filter(point => point.year >= from && point.year <= to && point.year <= archiveEndYear)
  const available = progress.evidence.find(item => item.series === dataset.id && item.from === from && item.to === to)
  const review = rentalReview(progress)
  const attached = available && progress.relocation?.origin === queryId(available)
  const canAttach = !progress.relocation?.signed && !rental
  const reviewRentalsNext = attached && canAttach && review.done < review.total
  const nextApp = progress.relocation?.origin ? review.done < review.total || stage === 'evacuation' ? 'rentals' : undefined : 'terminal'
  const toolTitle = tool === 'computer' ? t('Terminal de datos', 'Data terminal')
    : tool === 'notebook' ? t('Cuaderno de campo', 'Field notebook') : t('Expediente de traslado', 'Relocation dossier')
  const computer = tool === 'computer'
  const [booting, setBooting] = useState(computer)

  useEffect(() => {
    dialog.current?.showModal()
    dialog.current?.querySelector<HTMLElement>(computer ? '.computer-exit' : '#office-panel-title')?.focus()
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

  useEffect(() => {
    if (terminalViewer || !returnToRequest.current) return
    requestControl.current?.focus()
    returnToRequest.current = false
  }, [terminalViewer])

  function request() {
    if (available || !points.length || progress.evidence.length >= queryBudget) return
    const evidence = { series: dataset.id, from, to, count: points.length }
    onChange({ ...progress, evidence: [...progress.evidence, evidence] })
    setTerminalViewer(true)
  }

  function chooseSeries(id: string) {
    const item = catalogue.find(candidate => candidate.id === id)
    if (!item) return
    setSeriesId(id)
    setFrom(item.observations[0]?.year ?? archiveEndYear)
    setTo(Math.min(archiveEndYear, item.observations.at(-1)?.year ?? archiveEndYear))
  }

  function evidenceCard(evidence: Query) {
    const source = catalogue.find(item => item.id === evidence.series)
    if (!source) return null
    const unit = language === 'es' && source.unit === 'mm/year' ? 'mm/año' : source.unit
    const { trend } = evidence
    return <article className="office-sheet">
      <h3>{translate(language, seriesLabels(source.variable))}</h3>
      <p>{seriesSite(source, language)} · {evidence.from}–{evidence.to} · {evidence.count}/{evidence.to - evidence.from + 1} {t('años válidos', 'valid years')}</p>
      {trend && <p>{t('Pendiente de Sen', 'Sen slope')} · {trend.slope?.toLocaleString(language, { maximumFractionDigits: 3 }) ?? '—'} {unit}/{t('década', 'decade')} · {trend.p === null
        ? t('Cobertura insuficiente para la prueba', 'Insufficient coverage for the test') : `p ${trend.p < .001 ? '< 0.001' : trend.p.toLocaleString(language, { maximumFractionDigits: 4 })}`}</p>}
      <p><a href={source.source} target="_blank" rel="noreferrer">{source.product}</a>
        {source.archiveSource && <> · <a href={source.archiveSource} target="_blank" rel="noreferrer">{t('Datos reprocesados', 'Reprocessed data')}</a></>}</p>
    </article>
  }

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
      <h2 id="office-panel-title" tabIndex={-1}>{toolTitle}</h2>
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
      {computer && !booting && !desktopApp && <DesktopHome language={language} open={app => {
        setDesktopApp(app)
        if (!computerGuideComplete) onComputerGuideComplete()
      }}
        guideStep={computerGuideComplete ? undefined : guideStep} nextGuideStep={() => setGuideStep(step => step + 1)}
        finishGuide={onComputerGuideComplete} nextApp={nextApp} />}
      {computer && !booting && desktopApp && <header className="computer-toolbar" data-app={desktopApp}>
        <h2 id="office-panel-title" tabIndex={-1}>{desktopApp === 'terminal' ? toolTitle
          : desktopApp === 'passport' ? t('Mi pasaporte', 'My Passport') : 'DirtBNB'}</h2>
        {desktopApp === 'terminal' && <p className="office-budget">{t('Consultas disponibles', 'Requests left')} <strong>{Math.max(0, queryBudget - progress.evidence.length)}/{queryBudget}</strong></p>}
        <button className="back" onClick={() => { setTerminalViewer(false); setDesktopApp(undefined) }}>← {t('Escritorio', 'Desktop')}</button>
      </header>}
      {computer && !booting && (desktopApp === 'passport' || desktopApp === 'rentals') &&
        <HabitatApp key={desktopApp} app={desktopApp} language={language} role={role} progress={progress}
          onChange={onChange} onHostReply={onHostReply} calculatorTrigger={calculatorTrigger}
          canRent={stage === 'evacuation'} rental={rental} onRent={onRent} onPack={onPack} onDossier={() => onOpenTool('dossier')} />}
      {computer && !booting && desktopApp === 'terminal' && <>
        {!terminalViewer && <div className="terminal-dossier">
          <button type="button" onClick={() => onOpenTool('dossier')}>{t('Abrir expediente de traslado', 'Open relocation dossier')}</button>
        </div>}
        {terminalViewer && available ? <DataViewer key={queryId(available)} language={language} label={translate(language, seriesLabels(dataset.variable))}
          unit={dataset.unit} site={seriesSite(dataset, language)} points={points} source={{ provider: dataset.product, url: dataset.source }}
          requestAction={<>
            {attached ? <div className="terminal-attachment">
              <p className="answer-correct" role="status"><strong>{t('Consulta guardada en el expediente.', 'Request saved to the dossier.')}</strong></p>
              {reviewRentalsNext && <button type="button" className="primary" onClick={() => {
                setTerminalViewer(false)
                setDesktopApp('rentals')
              }}>{t('Revisar arriendos en DirtBNB', 'Review rentals in DirtBNB')}</button>}
              <button type="button" className={reviewRentalsNext ? undefined : 'primary'} onClick={() => onOpenTool('dossier')}>
                {t('Ver expediente', 'View dossier')}
              </button>
            </div> : canAttach ? <div className="terminal-attachment">
              <p role="status">{t('Consulta guardada en la terminal. Falta adjuntarla al expediente.', 'Request saved in the terminal. Attach it to add it to the dossier.')}</p>
              <button type="button" className="primary" onClick={() => {
                onChange({ ...progress, relocation: { ...progress.relocation, origin: queryId(available) } })
                onOpenTool('dossier')
              }}>{t('Adjuntar consulta al expediente', 'Attach request to dossier')}</button>
            </div> : <div className="terminal-attachment">
              <p>{t('El destino ya está confirmado. El expediente se puede consultar.', 'The destination has been confirmed. You can still view the dossier.')}</p>
              <button type="button" onClick={() => onOpenTool('dossier')}>{t('Ver expediente', 'View dossier')}</button>
            </div>}
            {marine && <p>{t('Cada punto es un promedio anual de la zona marina cercana a Bramble Cay. Cero representa el nivel de referencia del producto. La serie describe el nivel medio del mar y no la altura de una marejada.', 'Each point is an annual average for the ocean area near Bramble Cay. Zero marks the product’s reference sea level. The series describes mean sea level rather than the height of a storm surge.')}
              {dataset.archiveSource && <> · <a href={dataset.archiveSource} target="_blank" rel="noreferrer">{t('Datos a 1° reprocesados por Camargo (Zenodo)', 'Data regridded to 1° by Camargo (Zenodo)')}</a></>}</p>}
          </>}
          onTrend={trend => onChange({ ...progress, evidence: progress.evidence.map(item => item === available ? { ...item, trend: { ...trend, series: item.series } } : item) })}
          onBack={() => { returnToRequest.current = true; setTerminalViewer(false) }} /> :
          <div className="computer-workspace">
            <section className="office-terminal" aria-label={t('Consultar el archivo', 'Search the archive')}>
              {!progress.relocation?.origin && <p>{t('Para investigar el mar, elige «Nivel medio del mar (anomalía)» y pulsa «Pedir datos».', 'To investigate the sea, choose “Mean sea level (anomaly)” and then “Request data”.')}</p>}
              <div className="office-filters">
                <label><span id="terminal-region">{t('Región', 'Region')}</span><select value={dataset.site} aria-labelledby="terminal-region"
                  onChange={event => chooseSeries(catalogue.find(item => item.site === event.target.value)!.id)}>
                  {regions.map(site => <option key={site} value={site}>{seriesSite(catalogue.find(item => item.site === site)!, language)}</option>)}
                </select></label>
                <label><span id="terminal-variable">{t('Variable', 'Variable')}</span><select value={seriesId} aria-labelledby="terminal-variable" onChange={event => chooseSeries(event.target.value)}>
                  {regions.map(site => {
                    const series = catalogue.filter(item => item.site === site)
                    return <optgroup key={site} label={seriesSite(series[0], language)}>
                      {series.map(item => <option key={item.id} value={item.id}>{translate(language, seriesLabels(item.variable))}</option>)}
                    </optgroup>
                  })}
                </select></label>
                <label>{t('Desde', 'From')}<input type="number" min={dataset.observations[0]?.year} max={archiveEndYear} value={from || ''} onChange={event => setFrom(Number(event.target.value))} /></label>
                <label>{t('Hasta', 'To')}<input type="number" min={dataset.observations[0]?.year} max={archiveEndYear} value={to || ''} onChange={event => setTo(Number(event.target.value))} /></label>
              </div>
              <p>{t('Cada consulta nueva cuesta un crédito. Puedes reabrir las consultas guardadas sin gastar otro.', 'Each new request costs one credit. Reopen saved requests without spending another.')}</p>
              {(!Number.isInteger(from) || !Number.isInteger(to) || from < dataset.observations[0]?.year || from > to || to > archiveEndYear) && <p role="status">{t('Elige años dentro del archivo. El año inicial debe ser anterior o igual al final.', 'Choose years within the archive. The start year must be at or before the end year.')}</p>}
              {progress.evidence.length >= queryBudget && !available && <p role="status">{t('Se agotaron las consultas. Puedes usar cualquiera de las series guardadas en el expediente.', 'No requests left. You can attach any saved series to the dossier.')}</p>}
              <button ref={requestControl} disabled={!available && (!points.length || !Number.isInteger(from) || !Number.isInteger(to) || from < dataset.observations[0]?.year || to > archiveEndYear || progress.evidence.length >= queryBudget)}
                onClick={available ? () => setTerminalViewer(true) : request}>{available ? t('Abrir consulta guardada', 'Open saved request') : t('Pedir datos', 'Request data')}</button>
            </section>
            <section className="computer-results" aria-label={t('Consultas guardadas', 'Saved requests')}>
              <h3>{t('Consultas guardadas', 'Saved requests')}</h3>
              {progress.evidence.length === 0 && <p>{t('Cuando abras el gráfico de una consulta, puedes adjuntarla al expediente.', 'When you open a request’s chart, you can attach it to the dossier.')}</p>}
              {progress.evidence.map(item => {
                const series = catalogue.find(candidate => candidate.id === item.series)
                return series && <button type="button" key={queryId(item)} onClick={() => {
                  setSeriesId(series.id); setFrom(item.from); setTo(item.to); setTerminalViewer(true)
                }}>{seriesSite(series, language)} · {translate(language, seriesLabels(series.variable))} · {item.from}–{item.to}
                  {progress.relocation?.origin === queryId(item) && <> · {t('En el expediente', 'In the dossier')}</>}</button>
              })}
            </section>
          </div>}
      </>}
      {tool === 'notebook' && <>
        <article className="office-sheet">
          <h3>{t('Observaciones del cayo', 'Observations from the cay')}</h3>
          {heardAda && <p>{t('Ada contó que el depósito de agua se vació durante el calor.', 'Ada said the water tank ran dry during the heat.')}</p>}
          {heardEli && <p>{t('Eli contó que una inundación alcanzó la casa de su hermana.', 'Eli said a flood reached his sister’s house.')}</p>}
          <p>{sawCoast ? t('Desde el muelle viste agua donde la foto mostraba arena. En la terminal puedes pedir la serie de nivel medio del mar del estrecho de Torres.', 'From the pier you saw water where the photo showed sand. The terminal has a mean sea-level series for the Torres Strait.')
            : t('Ve al muelle para comparar el cartel antiguo con la costa actual.', 'Visit the pier to compare the old sign with the coast today.')}</p>
        </article>
        <label>{t('Mis notas', 'My notes')}<textarea rows={5} value={progress.notes} onChange={event => onChange({ ...progress, notes: event.target.value })} /></label>
        <h3>{t('Series guardadas', 'Saved series')}</h3>
        {progress.evidence.length ? progress.evidence.map(item => <div key={`${item.series}-${item.from}-${item.to}`}>{evidenceCard(item)}</div>) :
          <p>{t('Aquí se guardan las consultas del PC con sus filtros.', 'Computer requests are saved here with their filters.')}</p>}
        <h3>{t('Revisiones de DirtBNB', 'DirtBNB reviews')}</h3>
        {listings.filter(place => progress.rentalAnalyses?.[place.id]?.length).map(place => <article className="office-sheet" key={place.id}>
          <h4>{translate(language, place.listing)} · {place.name}</h4>
          {requirements.map(({ indicator_id }) => {
            const record = progress.rentalEvidence?.[place.id]?.[indicator_id]
            return record && <p key={indicator_id}>{translate(language, seriesLabels(indicator_id))} · {record.from}–{record.to} · {rentalReviewSaved(progress, place.id, indicator_id)
              ? record.trend ? t('Prueba guardada', 'Test saved') : t('Sin prueba estadística', 'No statistical test')
              : t('Preguntas pendientes', 'Questions pending')}</p>
          })}
          {progress.rentalAnalyses?.[place.id]?.includes('terrain') && <TerrainEvidence language={language} id={place.id} compact />}
        </article>)}
        <button type="button" onClick={() => onOpenTool('dossier')}>{t('Abrir expediente de traslado', 'Open relocation dossier')}</button>
      </>}
      {tool === 'dossier' && <RelocationDossier language={language} stage={stage} progress={progress} rental={rental}
        onChange={onChange} onStamp={onStamp} onClose={onClose} onComputer={seated ? app => onOpenTool('computer', app) : undefined} />}
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
