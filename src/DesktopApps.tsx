import { useEffect, useRef, useState, type ReactNode } from 'react'
import { archiveEndYear, asset, caseYear, playerIdentity, translate, type Language, type Role, type RentalApplication } from './config'
import { DataViewer } from './DataViewer'
import { TerrainEvidence, erubPlots } from './ErubTerrain'
import { compareHabitat, indicatorLabels, listings, rentalQuizPassed, rentalReview, rentalReviewSaved, requirements, reviewableRentals, sourceRevision, species, type Indicator, type RentalReviewItem } from './habitat'
import type { ChartPractice, ChartReview, Investigation } from './investigation'

export type DesktopApp = 'passport' | 'rentals' | 'terminal'

const desktopApps = [
  { id: 'terminal', label: ['Terminal de datos', 'Data terminal'], guide: [
    'Empieza aquí. Pide la serie histórica de nivel del mar del estrecho de Torres y adjúntala al expediente.',
    'Start here. Request the historical sea-level series for the Torres Strait and attach it to the dossier.',
  ] },
  { id: 'passport', label: ['Mi pasaporte', 'My Passport'], guide: [
    'Revisa qué necesita el melomys para vivir y cómo era el clima de Bramble Cay. Usa esa ficha como referencia al comparar un destino.',
    'See what the melomys needs and what Bramble Cay’s climate was like. Use the profile as a reference when comparing a new home.',
  ] },
  { id: 'rentals', label: ['DirtBNB', 'DirtBNB'], guide: [
    'Busca un nuevo hogar para tu familia. Pide datos a los anfitriones y compara el clima y las fichas de terreno disponibles.',
    'Look for a new home for your family. Ask hosts for data and compare the available climate and site reports.',
  ] },
] as const

export function DesktopHome({ language, open, guideStep, nextGuideStep, finishGuide, nextApp }: {
  language: Language
  open: (app: DesktopApp) => void
  guideStep?: number
  nextGuideStep: () => void
  finishGuide: () => void
  nextApp?: DesktopApp
}) {
  const guideTitle = useRef<HTMLHeadingElement>(null)
  const step = guideStep ?? -1
  const highlighted = desktopApps[step]
  const last = step === desktopApps.length - 1

  useEffect(() => { guideTitle.current?.focus() }, [step])

  return <section className="pc-desktop" aria-labelledby="office-panel-title">
    <h2 id="office-panel-title" className="dialogue-reader">{translate(language, ['Escritorio del PC', 'Computer desktop'])}</h2>
    <div className="pc-desktop-main" data-guided={Boolean(highlighted)}>
      <nav className="pc-icons" aria-label={translate(language, ['Aplicaciones', 'Apps'])}>
        {desktopApps.map(app => <button key={app.id} className="pc-icon" type="button" onClick={() => open(app.id)}
          data-guide-target={(highlighted?.id ?? nextApp) === app.id} aria-labelledby={`pc-label-${app.id}`}
          aria-describedby={highlighted?.id === app.id ? 'pc-guide-copy' : !highlighted && nextApp === app.id ? 'pc-next-app' : undefined}>
          <span className={`pc-icon-art pc-icon-${app.id}`} aria-hidden="true">{app.id === 'terminal' ? '>_' : ''}</span>
          <span id={`pc-label-${app.id}`}>{translate(language, app.label)}</span>
          {!highlighted && nextApp === app.id && <small id="pc-next-app">{translate(language, ['Siguiente paso', 'Next step'])}</small>}
        </button>)}
      </nav>
      {highlighted && <section className="pc-guide" aria-labelledby="pc-guide-title">
        <header>
          <h3 id="pc-guide-title" className="pc-guide-title" ref={guideTitle} tabIndex={-1} aria-describedby="pc-guide-copy">
            {translate(language, highlighted.label)}
          </h3>
          <small aria-label={translate(language, [`Paso ${step + 1} de ${desktopApps.length}`, `Step ${step + 1} of ${desktopApps.length}`])}>
            {step + 1}/{desktopApps.length}
          </small>
        </header>
        <p id="pc-guide-copy">{translate(language, highlighted.guide)}</p>
        <div className="pc-guide-actions">
          <button type="button" onClick={last ? finishGuide : nextGuideStep}>
            {translate(language, last ? ['Ir al escritorio', 'Go to desktop'] : ['Siguiente', 'Next'])}
          </button>
          <button type="button" className="pc-guide-skip" onClick={finishGuide}>{translate(language, ['Omitir guía', 'Skip guide'])}</button>
        </div>
      </section>}
    </div>
    <footer className="pc-taskbar">DoorsXP <span>{translate(language, ['Año actual', 'Current year'])} · {caseYear}</span></footer>
  </section>
}

function PassportContent({ language, role }: { language: Language; role: Role }) {
  const t = (es: string, en: string) => translate(language, [es, en])
  const format = new Intl.NumberFormat(language, { maximumFractionDigits: 2, minimumFractionDigits: 2 })
  function units(unit: string) { return language === 'es' && unit === 'mm/year' ? 'mm/año' : unit }
  const profile = playerIdentity[role]
  const source = `https://github.com/markzuckerberg44/awin-is-awin/blob/${sourceRevision}/data/pokedex/export/melomys.json`
  return <div className="passport-content">
    <section className="passport-id">
      <img src={asset(`art/${role}-portrait.png`)} alt="" width="96" height="96" />
      <div><h3>{profile.name}</h3>
        <p>{t('Fecha de nacimiento', 'Date of birth')} · {profile.birthDate}</p>
        <p><i>{species.scientific_name}</i> · Bramble Cay</p>
      </div>
    </section>
    <section className="habitat-description">
      <h3>{t('Hábitat', 'Habitat')}</h3>
      <p>{t('En Bramble Cay, el melomys encontraba alimento y refugio entre plantas de poca altura, como hierbas y plantas rastreras. Busca un terreno con esas plantas, fuera del alcance de las marejadas.', 'On Bramble Cay, the melomys found food and shelter among low-growing plants such as grasses and creeping plants. Look for a site with these plants beyond the reach of storm surges.')}</p>
    </section>
    <h3>{t('Clima de referencia de Bramble Cay', 'Bramble Cay reference climate')}</h3>
    <div className="passport-indicators">
      {requirements.map(entry => <article className="habitat-card" key={entry.indicator_id}>
        <h4>{translate(language, indicatorLabels[entry.indicator_id])}</h4>
        <p className="habitat-value">{format.format(entry.value)} <small>{units(entry.unit)}</small></p>
        <p>{t('Rango observado', 'Observed range')} · {format.format(entry.range.min)}–{format.format(entry.range.max)}</p>
        <p>{entry.period.start_year}–{entry.period.end_year} · {entry.sources[0].provider}</p>
      </article>)}
    </div>
    <p>{t('Estos valores describen el clima histórico regional. La tolerancia biológica de la especie sigue sin determinarse.', 'These values describe historical regional climate. The species’ biological tolerance remains unknown.')}</p>
    <a href={source} target="_blank" rel="noreferrer">{t('Ficha y fuentes de las series', 'Habitat card and series sources')}</a>
  </div>
}

const signalLabels: Record<RentalReviewItem, readonly [string, string]> = {
  t2m_max_mean: ['Temperatura', 'Temperature'],
  precip_annual: ['Lluvia', 'Rainfall'],
  soil_wetness: ['Humedad del suelo', 'Soil wetness'],
  terrain: ['Elevación y marejadas', 'Elevation and storm tides'],
}

const hostReplyDelay = 850
export const rentalReplyDelay = 1050
const hostPrompts = {
  property: ['Hola, ¿me puedes enviar información de la propiedad y sus alrededores?', 'Hi, could you send me some information about the property and its surroundings?'],
  compare: ['Estoy buscando un lugar para mi familia. ¿Qué datos tienes de este arriendo?', 'I’m looking for a place for my family. What data do you have about this rental?'],
  site: ['¿Me compartes los datos del clima y del terreno que tengas disponibles?', 'Could you share any climate and site data you have?'],
} as const
const hostPromptOptions = Object.keys(hostPrompts) as (keyof typeof hostPrompts)[]

export function HabitatApp({ app, language, role, progress, onChange, onHostReply, calculatorTrigger, canRent, rental, onRent, onPack, onDossier }: {
  app: 'passport' | 'rentals'
  language: Language
  role: Role
  progress: Investigation
  onChange: (value: Investigation) => void
  onHostReply: () => void
  calculatorTrigger: ReactNode
  canRent: boolean
  rental?: RentalApplication
  onRent: (id: string) => void
  onPack: () => void
  onDossier: () => void
}) {
  const firstSignal = requirements[0].indicator_id
  const [selected, setSelected] = useState(() => reviewableRentals.find(listing =>
    listing.id === (rental?.id ?? (canRent && progress.relocation?.signed ? progress.relocation.listing : undefined))))
  const [viewing, setViewing] = useState<Indicator>(firstSignal)
  const [openReport, setOpenReport] = useState<'terrain' | 'license'>()
  const [clock, setClock] = useState(Date.now)
  const reportDialog = useRef<HTMLDialogElement>(null)
  const chatHeading = useRef<HTMLHeadingElement>(null)
  const chartHeading = useRef<HTMLHeadingElement>(null)
  const chartControls = useRef<HTMLDivElement>(null)
  const t = (es: string, en: string) => translate(language, [es, en])
  const chat = selected ? progress.habitatChats?.[selected.id] : undefined
  const replyAt = chat ? chat.sentAt + hostReplyDelay : undefined
  const replied = replyAt !== undefined && clock >= replyAt
  const application = rental && selected?.id === rental.id ? rental : undefined
  const acceptedAt = application ? application.sentAt + rentalReplyDelay : undefined
  const accepted = acceptedAt !== undefined && clock >= acceptedAt
  const visualized = selected && replied ? compareHabitat(selected.climateId, viewing) : null
  const review = rentalReview(progress)
  const signedListing = progress.relocation?.signed && progress.relocation.listing
  const reviewing = !signedListing && !rental
  const missing = (listing: typeof reviewableRentals[number]) =>
    listing.items.filter(item => !rentalReviewSaved(progress, listing.id, item))
  const pendingItems = selected ? missing(selected) : []
  const nextRental = reviewableRentals.find(listing => listing.id !== selected?.id && missing(listing).length)
  const pendingOverview = <ul className="rental-pending-overview">
    {reviewableRentals.map(listing => {
      const items = missing(listing)
      return <li key={listing.id}><strong>{translate(language, listing.listing)}</strong> · {items.length
        ? items.map(item => translate(language, signalLabels[item])).join(', ')
        : t('Todos los registros guardados', 'All records saved')}</li>
    })}
  </ul>

  useEffect(() => {
    if (!selected) return
    const narrow = matchMedia('(max-width: 760px)').matches
    chatHeading.current?.focus({ preventScroll: !narrow })
  }, [selected])

  useEffect(() => {
    if (replyAt === undefined || replied) return
    const timer = window.setTimeout(() => {
      setClock(Date.now())
      onHostReply()
    }, Math.max(0, replyAt - Date.now()) + 1)
    return () => window.clearTimeout(timer)
  }, [replyAt, replied, onHostReply])

  useEffect(() => {
    if (acceptedAt === undefined || accepted) return
    const timer = window.setTimeout(() => { setClock(Date.now()); onHostReply() }, Math.max(0, acceptedAt - Date.now()) + 1)
    return () => window.clearTimeout(timer)
  }, [acceptedAt, accepted, onHostReply])

  useEffect(() => {
    if (openReport) reportDialog.current?.showModal()
  }, [openReport])

  function closeReport() {
    reportDialog.current?.close()
    setOpenReport(undefined)
  }

  function request(listing: typeof listings[number], item: Indicator | 'terrain') {
    const previous = progress.habitatRequests?.[listing.id] ?? []
    if (previous.includes(item)) return
    onChange({ ...progress, habitatRequests: { ...progress.habitatRequests, [listing.id]: [...previous, item] } })
  }

  function chooseListing(listing: typeof reviewableRentals[number]) {
    if (listing.id === selected?.id) return
    setSelected(listing)
    setViewing(firstSignal)
    setClock(Date.now())
  }

  function openTerrain(listing: typeof reviewableRentals[number]) {
    request(listing, 'terrain')
    setOpenReport('terrain')
  }

  function sendMessage(prompt: keyof typeof hostPrompts) {
    if (!selected || chat) return
    const sentAt = Date.now()
    chatHeading.current?.focus({ preventScroll: true })
    setClock(sentAt)
    onChange({ ...progress, habitatChats: { ...progress.habitatChats, [selected.id]: { prompt, sentAt } } })
  }

  function recordReview(id: string, item: RentalReviewItem, evidence?: ChartReview) {
    if (item !== 'terrain' && (!evidence || !rentalQuizPassed(progress, id, item, evidence))) return
    const previous = progress.rentalAnalyses?.[id] ?? []
    const rentalAnalyses = { ...progress.rentalAnalyses, [id]: previous.includes(item) ? previous : [...previous, item] }
    const rentalEvidence = evidence
      ? { ...progress.rentalEvidence, [id]: { ...progress.rentalEvidence?.[id], [item]: evidence } }
      : progress.rentalEvidence
    onChange({ ...progress, rentalAnalyses, rentalEvidence })
  }

  function savePractice(id: string, indicator: Indicator, practice: ChartPractice) {
    const previous = progress.rentalPractice?.[id]
    onChange({ ...progress, rentalPractice: { ...progress.rentalPractice, [id]: { ...previous, [indicator]: practice } } })
  }

  if (app === 'passport') return <div className="habitat-app passport-app">
    <PassportContent language={language} role={role} />
  </div>

  return <div className="rental-workspace">
    <div className="rental-catalogue">
      <header className="rental-panel-heading">
        <h3>{t('Arriendos disponibles', 'Available rentals')}</h3>
        <span>{listings.length}</span>
      </header>
      {canRent && signedListing && <p className="evac-rental-status" role="status">
        {t('Evacuación en curso. En el chat del destino firmado, pulsa «Solicitar arriendo urgente».', 'Evacuation underway. In the signed destination’s chat, choose “Request urgent rental”.')}</p>}
      {reviewing && <>
        <p className="rental-review" role="status"><strong>{review.done}/{review.total}</strong> {t('registros guardados.', 'records saved.')}</p>
        <p>{t('Responde bien las dos preguntas de cada gráfico para registrarlo. Guarda también las dos fichas de elevación y marejadas de Erub.', 'Answer both questions on each chart correctly to record it. Save both Erub elevation and storm-tide reports as well.')}</p>
      </>}
      {(canRent || review.done === review.total) && <button type="button" onClick={onDossier}>{t('Abrir expediente de traslado', 'Open relocation dossier')}</button>}
      {reviewing && selected && review.done < review.total && <details className="rental-all-pending">
        <summary>{t('Ver todos los registros pendientes', 'See all pending records')}</summary>
        {pendingOverview}
      </details>}
      <div className="rental-list" data-chat-open={Boolean(selected)}>
        {reviewableRentals.map(listing => <button className="rental-card" key={listing.id} aria-pressed={selected?.id === listing.id} onClick={() => chooseListing(listing)}>
          <img src={asset(`art/rental-${listing.id}.png`)} alt="" width="192" height="108" />
          <span className="rental-card-copy">
            <strong>{translate(language, listing.listing)}</strong>
            <span>{listing.name}</span><small>{t('Anfitrión', 'Host')} · {listing.owner}</small>
            {signedListing === listing.id && <small className="answer-correct">{t('Destino firmado', 'Signed destination')}</small>}
            {reviewing && <small>{listing.items.length - missing(listing).length}/{listing.items.length} {t('registros', 'records')}</small>}
          </span>
        </button>)}
      </div>
      {selected && <section className="rental-contact" aria-labelledby="rental-chat-title">
        <header className="rental-chat-heading">
          <h4 id="rental-chat-title" ref={chatHeading} tabIndex={-1}>{t('Chat con', 'Chat with')} {selected.owner}</h4>
          <span>{translate(language, selected.listing)}</span>
        </header>
        <div className="rental-conversation" role="log" aria-labelledby="rental-chat-title" aria-live="polite">
          {chat && <div className="rental-bubble rental-bubble-player">
            <span>{t('Tú', 'You')}</span><p>{translate(language, hostPrompts[chat.prompt])}</p>
          </div>}
          {chat && !replied && <p className="rental-typing">{selected.owner} {t('está escribiendo…', 'is typing…')}</p>}
          {replied && <div className="rental-bubble rental-bubble-host">
            <span>{selected.owner}</span>
            <p>{t('¡Hola! Te envío los datos disponibles de la propiedad. Puedes revisar las señales en los gráficos.', 'Hi! I’m sending you the available property data. You can review the signals in the charts.')}</p>
            <div className="rental-attachments">
              <button type="button" onClick={() => {
                if (visualized) request(selected, viewing)
                chartHeading.current?.focus()
              }}>{t('Ver gráficos', 'View charts')}</button>
              {erubPlots[selected.id] && <button type="button" aria-haspopup="dialog" onClick={() => openTerrain(selected)}>{t('Ver ficha del terreno', 'View site report')}</button>}
            </div>
          </div>}
          {application && <div className="rental-bubble rental-bubble-player"><span>{t('Tú', 'You')}</span>
            <p>{t('Quiero arrendarte. Es urgente: viene una tormenta y necesito sacar a mi familia de Bramble Cay. ¿Puedes recibirnos?', 'I want to rent your place. It’s urgent: a storm is coming and I need to get my family off Bramble Cay. Can you take us in?')}</p>
          </div>}
          {application && !accepted && <p className="rental-typing">{selected.owner} {t('está escribiendo…', 'is typing…')}</p>}
          {accepted && <div className="rental-bubble rental-bubble-host"><span>{selected.owner}</span>
            <p>{t('Sí, el arriendo es tuyo. Los espero. Salgan en cuanto puedan y cuídense en el camino.', 'Yes, the rental is yours. I’ll be waiting for you. Leave as soon as you can and take care on the way.')}</p>
            <div className="rental-attachments"><button type="button" onClick={onPack}>{t('Ir a preparar maletas', 'Go pack your bags')}</button></div>
          </div>}
        </div>
        {canRent && replied && !rental && (progress.relocation?.signed && progress.relocation.listing === selected.id
          ? <button type="button" onClick={() => onRent(selected.id)}>{t('Solicitar arriendo urgente', 'Request urgent rental')}</button>
          : <p>{t('Para solicitar este arriendo, elige este destino y firma el expediente.', 'To request this rental, choose this destination and sign the dossier.')}</p>)}
        {canRent && rental && !application && <button type="button" onClick={() => {
          const chosen = reviewableRentals.find(listing => listing.id === rental.id)
          if (chosen) chooseListing(chosen)
        }}>{t('Volver al chat del arriendo elegido', 'Return to the chosen rental chat')}</button>}
        {!chat && <div className="rental-replies" role="group" aria-label={t('Mensajes para el anfitrión', 'Messages for the host')}>
          <p>{t('Envía cualquiera de estos mensajes para recibir los datos del arriendo.', 'Send any of these messages to receive the rental data.')}</p>
          {hostPromptOptions.map(prompt => <button key={prompt} type="button" onClick={() => sendMessage(prompt)}>
            {translate(language, hostPrompts[prompt])}
          </button>)}
        </div>}
      </section>}
      <button type="button" className="species-license" aria-haspopup="dialog" onClick={() => setOpenReport('license')}>
        <img src={asset(`art/${role}-portrait.png`)} alt="" width="44" height="44" />
        <span><strong>{t('Licencia de especie', 'Species license')}</strong><i>{species.scientific_name}</i></span>
      </button>
      <p className="habitat-caption">{t('Arriendos y anfitriones ficticios. Datos climáticos regionales.', 'Fictional rentals and hosts. Regional climate data.')}</p>
    </div>
    <section className="rental-analysis" aria-labelledby="rental-analysis-title">
      <header className="rental-panel-heading">
        <h3 id="rental-analysis-title" ref={chartHeading} tabIndex={-1}>{t('Datos del arriendo', 'Rental data')}</h3>
        <span>{t('Archivo hasta', 'Archive through')} {archiveEndYear}</span>
      </header>
      {selected ? <>
        <h4 className="rental-selection">{translate(language, selected.listing)} · {selected.name}</h4>
        {erubPlots[selected.id] && <p className="habitat-caption">{t('Los dos arriendos de Erub usan la misma serie climática regional. Compara sus fichas para distinguir la elevación y la exposición a marejadas.', 'Both Erub rentals use the same regional climate series. Compare their site reports to distinguish elevation and storm-tide exposure.')}</p>}
        {reviewing && <div className="rental-checklist">
          <h4>{t('Qué debes guardar de este arriendo', 'What to save for this rental')}</h4>
          <ul>
            {selected.items.map(item => {
              const pending = pendingItems.includes(item)
              const label = translate(language, signalLabels[item])
              return <li key={item}>
                {replied ? <button className="rental-review-link" type="button" aria-haspopup={item === 'terrain' ? 'dialog' : undefined} onClick={() => {
                  if (item === 'terrain') openTerrain(selected)
                  else {
                    setViewing(item)
                    request(selected, item)
                    chartControls.current?.focus()
                  }
                }}>{label}</button> : <span>{label}</span>}
                <strong data-recorded={!pending}>{pending ? t('Pendiente', 'Pending') : t('Guardado', 'Saved')}</strong>
              </li>
            })}
          </ul>
          {replied && pendingItems.length === 0 && <button type="button" onClick={nextRental ? () => chooseListing(nextRental) : onDossier}>
            {nextRental ? t('Ver siguiente arriendo pendiente', 'Open next rental to review') : t('Volver al expediente', 'Return to dossier')}
          </button>}
        </div>}
        {!replied ? <div className="rental-analysis-empty">
          <p role="status">{chat
            ? t('Mensaje enviado. Los gráficos estarán disponibles cuando responda el anfitrión.', 'Message sent. Charts will be available when the host replies.')
            : t('Aún no has solicitado información de esta propiedad. Envía un mensaje al anfitrión para recibir sus datos y desbloquear los gráficos.', 'You haven’t requested information for this property yet. Message the host to get the data and unlock the charts.')}</p>
          {!chat && <button type="button" onClick={() => chatHeading.current?.focus()}>{t('Ir al chat', 'Go to chat')}</button>}
        </div> : <>
          <div className="rental-signals" role="group" ref={chartControls} tabIndex={-1} aria-label={t('Variables climáticas', 'Climate variables')}>
            {requirements.map(({ indicator_id }) => <button key={indicator_id} aria-pressed={viewing === indicator_id}
              onClick={() => { setViewing(indicator_id); request(selected, indicator_id) }}>
              {translate(language, signalLabels[indicator_id])}
            </button>)}
          </div>
          {visualized ? <DataViewer key={`${selected.id}-${viewing}`} language={language}
            label={translate(language, indicatorLabels[viewing])} unit={visualized.unit} site={selected.name}
            points={visualized.shared.map(({ year, value, origin }) => ({ year, value, reference: origin }))}
            source={visualized.source ?? undefined} calculatorTrigger={calculatorTrigger}
            savedPractice={progress.rentalPractice?.[selected.id]?.[viewing]}
            onPracticeChange={practice => savePractice(selected.id, viewing, practice)}
            onReview={evidence => recordReview(selected.id, viewing, evidence)} review={progress.rentalEvidence?.[selected.id]?.[viewing]}
            reviewSaved={rentalReviewSaved(progress, selected.id, viewing)} /> :
            <p className="rental-analysis-empty" role="status">{t('El anfitrión no tiene una serie comparable para este indicador. Elige otra variable.', 'The host has no comparable series for this indicator. Choose another variable.')}</p>}
        </>}
      </> : <div className="rental-analysis-empty">
        <p>{t('Abre una tarjeta y envía un mensaje al anfitrión. Aquí verás los registros pendientes de ese lugar.', 'Open a card and message its host. The records you still need for that rental will appear here.')}</p>
        {pendingOverview}
      </div>}
    </section>
    {openReport && <dialog ref={reportDialog} className="office-panel rental-report-popup" aria-labelledby="rental-report-title"
      onCancel={event => { event.preventDefault(); event.stopPropagation(); closeReport() }}>
      <header>
        <h2 id="rental-report-title">{openReport === 'license' ? t('Licencia de especie', 'Species license') : t('Ficha del terreno', 'Site report')}</h2>
        <button type="button" className="back" onClick={closeReport}>{t('Cerrar', 'Close')} <kbd>Esc</kbd></button>
      </header>
      <div className="rental-report-body">
        {openReport === 'license'
          ? <PassportContent language={language} role={role} />
          : selected && <TerrainEvidence language={language} id={selected.id} />}
      </div>
      {openReport === 'terrain' && selected && <footer className="rental-report-actions">
        <p>{pendingItems.includes('terrain')
          ? t('Esta ficha cuenta como un registro del expediente.', 'This report counts as one dossier record.')
          : t('Ficha revisada y guardada.', 'Report reviewed and saved.')}</p>
        {pendingItems.includes('terrain') && <button className="primary" type="button" onClick={() => { recordReview(selected.id, 'terrain'); closeReport() }}>
          {t('Marcar ficha como revisada', 'Mark report as reviewed')}
        </button>}
      </footer>}
    </dialog>}
  </div>
}
