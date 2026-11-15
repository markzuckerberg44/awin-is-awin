import { useEffect, useRef, useState } from 'react'
import { asset, translate, type Language } from './config'
import { CreditsForecast } from './CreditsForecast'
import { CreditsGlobe } from './CreditsGlobe'
import { ErubStormMap, erubPlots } from './ErubTerrain'

const fieldReport = 'https://www.dcceew.gov.au/sites/default/files/documents/statement-of-reasons-register-of-exemption-bramble-cay-melomys.pdf'
const extinctionAssessment = 'https://www.dcceew.gov.au/sites/default/files/env/consultations/d678432e-1ee8-4316-b1ef-af29634401d7/files/consultation-document-bramble-cay-melomys-2018.pdf'
const coastalLayer = 'https://spatial-gis.information.qld.gov.au/arcgis/rest/services/PlanningCadastre/CoastalManagement/MapServer/11'
const seaLevelTool = 'https://sealevel.nasa.gov/data_tools/17/'
const extinctionListing = 'https://www.dcceew.gov.au/sites/default/files/documents/annual-report-2018-19-environment-and-energy.pdf'
const challengeResources = 'https://www.spaceappschallenge.org/2026/challenges/earth-system-trend-detective/?tab=resources'
const vegetation = [{ year: 2004, hectares: 2.2 }, { year: 2014, hectares: .065 }] as const
const reducedMotion = '(prefers-reduced-motion: reduce)'
const pixelsPerMs = .037

export function CreditsEpilogue({ language, rentalId, paused, onBack, onFinish, onMenu, onPageTurn, onAnswer }: {
  language: Language
  rentalId?: string
  paused: boolean
  onBack: () => void
  onFinish: () => void
  onMenu: () => void
  onPageTurn: () => void
  onAnswer: (correct: boolean) => void
}) {
  const t = (es: string, en: string) => translate(language, [es, en])
  const [rolling, setRolling] = useState(() => !matchMedia(reducedMotion).matches)
  const [globeVisible, setGlobeVisible] = useState(false)
  const scroll = useRef<HTMLDivElement>(null)
  const openingTitle = useRef<HTMLHeadingElement>(null)
  const quiz = useRef<HTMLFieldSetElement>(null)
  const globe = useRef<HTMLElement>(null)
  const number = new Intl.NumberFormat(language, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const hectares = new Intl.NumberFormat(language, { maximumFractionDigits: 3 })

  useEffect(() => {
    openingTitle.current?.focus({ preventScroll: true })
    const motion = matchMedia(reducedMotion)
    const stopForReducedMotion = () => { if (motion.matches) setRolling(false) }
    motion.addEventListener('change', stopForReducedMotion)
    return () => motion.removeEventListener('change', stopForReducedMotion)
  }, [])

  useEffect(() => {
    const root = scroll.current
    const question = quiz.current
    const earth = globe.current
    if (!root || !question || !earth) return
    const stopAtQuestion = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.intersectionRatio >= .95)) return
      setRolling(false)
      stopAtQuestion.disconnect()
    }, { root, threshold: .95 })
    const watchGlobe = new IntersectionObserver(([entry]) => setGlobeVisible(entry.intersectionRatio >= .28), { root, threshold: .28 })
    stopAtQuestion.observe(question)
    watchGlobe.observe(earth)
    return () => { stopAtQuestion.disconnect(); watchGlobe.disconnect() }
  }, [])

  useEffect(() => {
    const root = scroll.current
    if (!rolling || paused || !root) return
    let frame: number
    let previous: number | undefined
    let position = root.scrollTop
    function tick(now: number) {
      if (root && !document.hidden) {
        const end = root.scrollHeight - root.clientHeight
        position = Math.min(end, position + Math.min(50, previous === undefined ? 0 : now - previous) * pixelsPerMs)
        root.scrollTop = position
        if (position >= end) { setRolling(false); return }
      }
      previous = document.hidden ? undefined : now
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [rolling, paused])

  return <section className="evac-result credit-roll" aria-label={t('Créditos', 'Credits')}>
    <div className="credit-scroll" ref={scroll} tabIndex={0}
      onWheel={() => setRolling(false)} onPointerDown={() => setRolling(false)}
      onKeyDown={event => {
        if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) setRolling(false)
      }} onFocus={event => {
        if (event.target.matches('a, button, select, summary')) setRolling(false)
      }}>
      <article className="credit-epilogue" data-page="history" aria-labelledby="credit-history-title">
        <h2 id="credit-history-title" ref={openingTitle} tabIndex={-1}>{t('La isla que dejaste atrás', 'The island you left behind')}</h2>
        <div className="credit-history">
          <figure className="credit-photo">
            <img src={asset('art/coast-before.webp')} alt={t('La playa y la cabaña del cartel del muelle.', 'The beach and cabin from the pier sign.')} />
            <figcaption>WELCOME TO BRAMBLE CAY <small>{t('Recreación del juego', 'In-game re-creation')}</small></figcaption>
          </figure>
          <div className="credit-history-copy">
            <p className="credit-lead">{t('Tu familia logró escapar. En la isla real, el último avistamiento del melomys fue en 2009.', 'Your family made it out. On the real island, the last reported sighting of the melomys was in 2009.')}</p>
            <figure className="credit-vegetation">
              <figcaption>{t('Vegetación registrada en el cayo', 'Recorded vegetation on the cay')}</figcaption>
              {vegetation.map(point => <div key={point.year}>
                <p>{point.year}<strong>{hectares.format(point.hectares)} ha</strong></p>
                <div className="credit-vegetation-track" aria-hidden="true"><span style={{ width: (point.hectares / vegetation[0].hectares * 100) + '%' }} /></div>
              </div>)}
            </figure>
            <p className="credit-loss">{t('En 2014 volvieron a buscarlo.', 'In 2014, they went back to look for it.')}
              <strong>{t('No encontraron ninguno.', 'They found none.')}</strong></p>
            <p>{t('Las inundaciones del mar fueron la explicación más probable de la pérdida de hábitat y del declive.', 'Flooding from the sea was the most likely cause of habitat loss and decline.')}</p>
            <details className="credit-details">
              <summary>{t('Cómo se documentó', 'How it was documented')}</summary>
              <p>{t('La búsqueda intensiva de 2014 sumó 900 noches-trampa sin detectar ningún melomys.', 'The intensive 2014 survey logged 900 trap-nights without detecting a single melomys.')}</p>
              <p className="credit-sources"><a href={fieldReport} target="_blank" rel="noreferrer">{t('Informe de campo', 'Field report')}</a>
                <a href={extinctionAssessment} target="_blank" rel="noreferrer">{t('Evaluación australiana', 'Australian assessment')}</a></p>
            </details>
          </div>
        </div>
      </article>
      <article className="credit-epilogue" data-page="forecast" aria-labelledby="credit-forecast-title">
        <h2 id="credit-forecast-title">{t('¿Qué habría acertado el modelo?', 'What would the model have got right?')}</h2>
        <CreditsForecast language={language} quiz={quiz} onAnswer={onAnswer} />
      </article>
      <article className="credit-epilogue" data-page="coast" aria-labelledby="credit-coast-title">
        <h2 id="credit-coast-title">{t('¿Qué riesgo sigue abierto?', 'What risk remains?')}</h2>
        <div className="credit-coast">
          <p className="credit-lead">{t('Si el mar sigue subiendo, las marejadas pueden llegar a terrenos que hoy quedan secos.', 'If the sea keeps rising, storm tides may reach land that stays dry today.')}</p>
          <ErubStormMap language={language} id={rentalId} />
          <div className="credit-coast-copy">
            <p>{t('Las dos casas comparten la misma serie climática regional. Su exposición a marejadas cambia con el terreno.', 'Both houses share the same regional climate series. Their exposure to storm tides depends on the terrain.')}</p>
            <dl className="credit-terrain">
              <div><dt>C · {t('Costa', 'Coast')}</dt><dd>{number.format(erubPlots['erub-coast']!.elevation)} m · {t('Amenaza alta cartografiada', 'Mapped high hazard')}</dd></div>
              <div><dt>L · {t('Ladera', 'Hillside')}</dt><dd>{number.format(erubPlots.erub!.elevation)} m · {t('Fuera de las zonas cartografiadas de amenaza alta y media', 'Outside mapped high- and medium-hazard zones')}</dd></div>
            </dl>
            <p className="credit-source-note">{t('El mapa de Queensland incluye proyecciones a 2100.', 'The Queensland map includes projections to 2100.')}</p>
            <details className="credit-details">
              <summary>{t('Qué medir antes de construir', 'What to measure before building')}</summary>
              <p>{t('El modelo estima temperatura, lluvia y humedad del suelo. Para evaluar inundaciones, mide el nivel del mar local, las mareas, el oleaje y la elevación.', 'The model estimates temperature, rainfall and soil moisture. To assess flooding, measure local sea level, tides, waves and elevation.')}</p>
              <p className="credit-sources"><a href={coastalLayer} target="_blank" rel="noreferrer">{t('Mapa de Queensland', 'Queensland map')}</a>
                <a href={seaLevelTool} target="_blank" rel="noreferrer">{t('Escenarios de nivel del mar · NASA e IPCC', 'Sea level scenarios · NASA and IPCC')}</a></p>
            </details>
          </div>
        </div>
      </article>
      <article className="credit-epilogue" data-page="globe" ref={globe} aria-labelledby="credit-globe-title">
        <h2 id="credit-globe-title">{t('Especies en peligro', 'Species at risk')}</h2>
        <CreditsGlobe language={language} active={globeVisible && !paused} />
      </article>
      <article className="credit-epilogue" data-page="closing" aria-labelledby="credit-closing-title">
        <h2 id="credit-closing-title">
          {t('El melomys de Bramble Cay se extinguió.', 'The Bramble Cay melomys went extinct.')}
        </h2>
        <div className="credit-closing">
          <p className="credit-lead">{t('Quienes difunden falsedades sobre el cambio climático le dan una excusa a quienes prefieren no actuar. Mientras se aplazan las decisiones, hay especies que siguen perdiendo su hogar.',
            'People who spread falsehoods about climate change give those unwilling to act an excuse. While decisions are delayed, species keep losing their homes.')}</p>
          <p>{t('Todavía podemos proteger a muchas de ellas. Elige una especie de tu región, averigua qué la amenaza y comparte lo que aprendas con fuentes que otros puedan comprobar.',
            'We can still protect many of them. Pick a species in your region, find out what threatens it, and share what you learn with sources others can check.')}</p>
          <p className="credit-sources"><a href={extinctionListing} target="_blank" rel="noreferrer">{t('Registro australiano de extinción', 'Australian extinction record')}</a>
            <a href={challengeResources} target="_blank" rel="noreferrer">{t('Recursos del NASA Space Apps Challenge', 'NASA Space Apps Challenge resources')}</a></p>
        </div>
        <nav className="credit-nav">
          <button type="button" className="primary" onClick={() => { onPageTurn(); onFinish() }}>{t('Volver a capítulos', 'Back to chapters')}</button>
        </nav>
      </article>
    </div>
    <nav className="credit-roll-controls" aria-label={t('Controles de los créditos', 'Credits controls')}>
      <button type="button" onClick={() => { onPageTurn(); onBack() }}>{t('Veredicto', 'Verdict')}</button>
      <button type="button" className="primary" onClick={() => setRolling(value => !value)}>
        {rolling ? t('Pausar créditos', 'Pause credits') : t('Reanudar créditos', 'Resume credits')}
      </button>
      <button type="button" onClick={() => { onPageTurn(); onMenu() }}>{t('Volver al menú', 'Back to main menu')}</button>
    </nav>
  </section>
}
