import { caseYear, translate, type Language, type RentalApplication, type Stage } from './config'
import { ErubStormMap, TerrainEvidence, erubPlots } from './ErubTerrain'
import { catalogue, compareHabitat, listings, rentalReview, requirements, seriesLabels, seriesSite } from './habitat'
import { queryId, type ChartReview, type Investigation, type Relocation, type SiteReading, type Stamp } from './investigation'

const stamps: Stamp[] = ['up', 'down', 'unproven']
const siteReadings: SiteReading[] = ['high', 'outside', 'unknown']

export function RelocationDossier({ language, progress, stage, rental, onChange, onStamp, onClose, onComputer }: {
  language: Language
  progress: Investigation
  stage: Stage
  rental?: RentalApplication
  onChange: (value: Investigation) => void
  onStamp: () => void
  onClose: () => void
  onComputer?: (app: 'terminal' | 'rentals') => void
}) {
  const t = (es: string, en: string) => translate(language, [es, en])
  const draft = progress.relocation ?? {}
  const listing = listings.find(item => item.id === draft.listing)
  const origin = progress.evidence.find(item => queryId(item) === draft.origin)
  const format = new Intl.NumberFormat(language, { maximumFractionDigits: 3 })
  const pValue = new Intl.NumberFormat(language, { maximumFractionDigits: 4 })
  const originSeries = catalogue.find(series => series.id === origin?.series)
  const savedQueries = progress.evidence.flatMap(query => {
    const series = catalogue.find(item => item.id === query.series)
    return series ? [{ query, series }] : []
  })
  const signal = requirements.find(item => item.indicator_id === draft.indicator)?.indicator_id
  const variable = signal ? translate(language, seriesLabels(signal)).toLocaleLowerCase(language) : ''
  const registered = listing && signal ? progress.rentalEvidence?.[listing.id]?.[signal] : undefined
  const hasRecordedAnalyses = listing && requirements.some(({ indicator_id }) => progress.rentalEvidence?.[listing.id]?.[indicator_id])
  const record = draft.signed ?? registered
  const trend = record?.trend
  const comparison = listing && signal && record ? compareHabitat(listing.climateId, signal) : null
  const shared = record && comparison ? comparison.shared.filter(point => point.year >= record.from && point.year <= record.to) : []
  const unit = language === 'es' && comparison?.unit === 'mm/year' ? 'mm/año' : comparison?.unit
  const plot = listing && erubPlots[listing.id]
  const siteAnswer = plot ? plot.highHazard ? 'high' : 'outside' : 'unknown'
  const stampAnswer = trend?.stamp ?? 'unproven'
  const review = rentalReview(progress)
  const allReviewed = review.done === review.total
  const step = !originSeries ? 1 : !allReviewed ? 2 : 3
  const canChoose = Boolean(draft.signed || step === 3)
  const officeActive = stage === 'complete' || stage === 'evacuation'
  const canEditDraft = !rental && !draft.signed
  const signingPrompt = !officeActive ? t('Podrás firmar cuando comience la investigación en la oficina.', 'You can sign once the office investigation begins.')
    : !originSeries ? t('Adjunta una consulta de la terminal.', 'Attach a terminal request.')
    : !allReviewed ? t('Termina de registrar las revisiones en DirtBNB.', 'Finish recording the DirtBNB reviews.')
    : !listing || !record || shared.length < 2 ? t('Elige un destino y adjunta uno de sus análisis.', 'Choose a destination and attach one of its analyses.')
    : draft.stamp !== stampAnswer ? t('Marca el sello que corresponde al análisis adjunto.', 'Choose the stamp that fits the attached analysis.')
    : draft.siteReading !== siteAnswer ? t('Coteja la exposición a marejadas del destino.', 'Check the destination’s storm-tide exposure.')
    : !draft.rationale?.trim() ? t('Escribe qué dato influyó en tu elección.', 'Describe which data informed your choice.')
    : !draft.habitatPending ? t('Marca qué dato sigue pendiente de comprobar.', 'Mark what still needs to be verified.')
    : undefined
  const canSign = canEditDraft && signingPrompt === undefined
  const recordLabel = (review: ChartReview) => `${review.from}–${review.to}`
  const stampLabel = (stamp: Stamp) => stamp === 'up' ? 'REAL ↑' : stamp === 'down' ? 'REAL ↓' : t('NO PROBADO', 'NOT PROVEN')
  const siteLabel = (reading: SiteReading) => ({
    high: t('Dentro de amenaza alta', 'Inside mapped high hazard'),
    outside: t('Fuera de amenaza alta y media', 'Outside mapped high and medium hazard'),
    unknown: t('Exposición sin comprobar', 'Exposure unverified'),
  })[reading]

  function save(changes: Partial<Relocation>) {
    onChange({ ...progress, relocation: { ...draft, ...changes } })
  }

  return <div className="dossier">
    <header className="dossier-summary">
      <p><strong>{t('Caso Bramble Cay', 'Bramble Cay case')}</strong> · {t('Comienzos de', 'Early')} {caseYear}</p>
      <p className="dossier-state" data-signed={Boolean(draft.signed)}>{draft.signed ? t('Expediente firmado', 'Dossier signed') : t('Borrador', 'Draft')}</p>
    </header>
    {canEditDraft && (officeActive || savedQueries.length > 0) && <section className="dossier-guide" aria-labelledby="dossier-guide-heading">
      <h3 id="dossier-guide-heading">{t(`Paso ${step} de 3`, `Step ${step} of 3`)} · {step === 1
        ? t('Investiga el nivel del mar', 'Investigate sea level')
        : step === 2 ? t('Investiga los arriendos', 'Investigate the rentals')
        : t('Elige un destino y firma', 'Choose a destination and sign')}</h3>
      {step === 1 && <>
        <p>{savedQueries.length
          ? t('Tu consulta ya está guardada. Elígela abajo en «Evidencia del lugar de origen» para adjuntarla.', 'Your request is saved. To attach it, select it below under “Evidence from the home region”.')
          : t('En la terminal, elige «Nivel medio del mar (anomalía)». Pulsa «Pedir datos» y después «Adjuntar consulta al expediente».', 'In the terminal, choose “Mean sea level (anomaly)”. Select “Request data”, then “Attach request to dossier”.')}</p>
        {!savedQueries.length && (onComputer ? <button type="button" className="primary" onClick={() => onComputer('terminal')}>{t('Ir a la terminal de datos', 'Go to the data terminal')}</button>
          : <><p>{t('Cierra el expediente, acércate a la silla marcada y pulsa «Sentarse en la silla». Luego abre el PC.', 'Close the dossier, walk to the marked chair and choose “Sit in the chair”. Then open the computer.')}</p>
            <button type="button" className="primary" onClick={onClose}>{t('Volver a la oficina', 'Return to the office')}</button></>)}
      </>}
      {step === 2 && <>
        <p>{t(`Faltan ${review.total - review.done} registros. En DirtBNB, responde bien las dos preguntas de cada gráfico pendiente y regístralo. Guarda también las fichas de terreno pendientes.`,
          `${review.total - review.done} records left. In DirtBNB, answer both questions on each pending chart correctly and record it. Save any pending site reports as well.`)}</p>
        {onComputer ? <button type="button" className="primary" onClick={() => onComputer('rentals')}>{t('Ir a DirtBNB', 'Go to DirtBNB')}</button>
          : <button type="button" className="primary" onClick={onClose}>{t('Volver a la silla para abrir el PC', 'Return to the chair to open the computer')}</button>}
      </>}
      {step === 3 && <p>{officeActive
        ? t('Ya tienes los registros. Elige un arriendo, adjunta uno de sus gráficos y responde las dos preguntas usando las fichas. Después escribe tu motivo y firma.', 'You have the records. Pick a rental, attach one of its charts, and use the reports to answer two questions. Then explain your choice and sign.')
        : t('Ya puedes elegir un arriendo y dejar listo el expediente. Podrás firmarlo cuando comience la investigación en la oficina.', 'You can choose a rental and prepare the dossier now. You can sign it once the office investigation begins.')}</p>}
    </section>}
    <ol className="dossier-steps">
      <li>
        <h3>{t('Documenta el problema', 'Document the problem')}</h3>
        {originSeries && <p className="answer-correct" role="status"><strong>{t('Paso 1 completado · Evidencia adjuntada', 'Step 1 complete · Evidence attached')}</strong></p>}
        <p>{t('En el muelle viste agua donde el cartel mostraba arena. Usa la serie histórica del estrecho de Torres para investigar cómo cambió el nivel medio del mar cerca de Bramble Cay. Para evaluar el riesgo de cada arriendo, consulta su ficha de elevación y marejadas.', 'At the pier you saw water where the sign showed sand. Use the Torres Strait record to investigate how mean sea level changed near Bramble Cay. To assess a rental’s flood risk, check its elevation and storm-tide report.')}</p>
        <label><span id="dossier-origin">{t('Evidencia del lugar de origen', 'Evidence from the home region')}</span>
          <select value={draft.origin ?? ''} aria-labelledby="dossier-origin" disabled={!canEditDraft || !savedQueries.length}
            onChange={event => save({ origin: event.target.value || undefined })}>
            <option value="" disabled>{t('Adjunta una consulta de la terminal', 'Attach a terminal request')}</option>
            {savedQueries.map(({ query, series }) =>
              <option key={queryId(query)} value={queryId(query)}>{translate(language, seriesLabels(series.variable))} · {recordLabel(query)}</option>)}
          </select>
        </label>
        {origin && originSeries && <>
          <p>{seriesSite(originSeries, language)} · {recordLabel(origin)} · {origin.count}/{origin.to - origin.from + 1} {t('años válidos', 'valid years')}</p>
          {origin.trend && originSeries.variable === 'seaLevel' && <p>{t('Pendiente de Sen', 'Sen slope')} · {origin.trend.slope === null ? '—' : format.format(origin.trend.slope)} {originSeries.unit}/{t('década', 'decade')}
            {origin.trend.p !== null && <> · p {origin.trend.p < .001 ? '< 0.001' : pValue.format(origin.trend.p)}</>}</p>}
          <p><a href={originSeries.source} target="_blank" rel="noreferrer">{originSeries.product}</a>
            {originSeries.archiveSource && <> · <a href={originSeries.archiveSource} target="_blank" rel="noreferrer">{t('Datos reprocesados por Camargo (Zenodo)', 'Data reprocessed by Camargo (Zenodo)')}</a></>}</p>
        </>}
      </li>
      <li>
        <h3>{t('Coteja el destino', 'Check the destination')}</h3>
        <p>{review.done}/{review.total} {t('revisiones de DirtBNB registradas', 'DirtBNB reviews recorded')}</p>
        {!canChoose && <p>{t('Podrás elegir un destino cuando hayas adjuntado la consulta y guardado estos registros.', 'You can choose a destination after attaching the request and saving these records.')}</p>}
        {canChoose && <fieldset className="dossier-destinations" disabled={!canEditDraft}>
          <legend>{t('Destino evaluado', 'Destination assessed')}</legend>
          {listings.map(item => <label className="office-check" key={item.id}>
            <input type="radio" name="dossier-destination" value={item.id} checked={draft.listing === item.id}
              onChange={() => save({ listing: item.id, indicator: undefined, stamp: undefined, siteReading: undefined, rationale: undefined })} />
            <span>{translate(language, item.listing)} · {item.name}</span>
          </label>)}
        </fieldset>}
        {canChoose && listing && <>
          <label><span id="dossier-analysis">{t('Análisis climático adjunto', 'Attached climate analysis')}</span>
            <select value={draft.indicator ?? ''} aria-labelledby="dossier-analysis" disabled={!canEditDraft} onChange={event => save({ indicator: event.target.value || undefined, stamp: undefined })}>
              <option value="">{t('Selecciona un análisis registrado', 'Select a recorded analysis')}</option>
              {requirements.map(({ indicator_id }) => {
                const report = progress.rentalEvidence?.[listing.id]?.[indicator_id]
                return report && <option key={indicator_id} value={indicator_id}>{translate(language, seriesLabels(indicator_id))} · {recordLabel(draft.signed && draft.indicator === indicator_id ? draft.signed : report)}</option>
              })}
            </select>
          </label>
          {canEditDraft && !record && hasRecordedAnalyses && <p>
            {t('Puedes adjuntar cualquiera de los análisis que registraste para este arriendo.', 'You can attach any of the analyses you recorded for this rental.')}
          </p>}
          {!hasRecordedAnalyses && canEditDraft && <>
            <p>{t('Registra un gráfico del arriendo en DirtBNB. Si lo revisaste antes, regístralo otra vez para adjuntar su periodo.', 'Record a rental chart in DirtBNB. If you reviewed it before, record it again to attach its period.')}</p>
            {allReviewed && onComputer && <button type="button" onClick={() => onComputer('rentals')}>{t('Ir a DirtBNB', 'Go to DirtBNB')}</button>}
          </>}
          {record && comparison && shared.length > 1 && <div className="dossier-evidence">
            <p><strong>{listing.name} · {recordLabel(record)}</strong> · {shared.length}/{record.to - record.from + 1} {t('años comparables', 'comparable years')}</p>
            <p><strong>{t('Promedio de cada lugar', 'Average for each place')}</strong> · {listing.name} {format.format(shared.reduce((sum, point) => sum + point.value, 0) / shared.length)} {unit} · Bramble Cay {format.format(shared.reduce((sum, point) => sum + point.origin, 0) / shared.length)} {unit}</p>
            {trend && <p>{t('Pendiente de Sen', 'Sen slope')} · {trend.slope === null ? '—' : format.format(trend.slope)} {unit}/{t('década', 'decade')}
              {trend.p !== null && <> · {trend.p < .001 ? `p < ${pValue.format(.001)}` : `p = ${pValue.format(trend.p)}`}</>}</p>}
            {comparison.source && <a href={comparison.source.url} target="_blank" rel="noreferrer">{comparison.source.provider}</a>}
            <fieldset>
              <legend>{t(`¿Hay evidencia de que la ${variable} subió o bajó en ${listing.name} entre ${record.from} y ${record.to}?`,
                `Is there evidence that ${variable} rose or fell in ${listing.name} between ${record.from} and ${record.to}?`)}</legend>
              <div className="dossier-stamp-instructions">
                {!trend || trend.p === null ? <>
                  <p><strong>{t('Pulsa «NO PROBADO» para continuar.', 'Choose “NOT PROVEN” to continue.')}</strong></p>
                  <p>{t('Este sello significa que falta evidencia para confirmar una subida o una bajada. Puedes firmar con este sello cuando completes el expediente.', 'This stamp means there is too little evidence to confirm an increase or decrease. You can sign with this stamp once the dossier is complete.')}</p>
                  <p>{trend ? t('Mann–Kendall necesita 10 años válidos consecutivos para dar un resultado.', 'Mann–Kendall needs 10 consecutive years of valid data to give a result.')
                    : t(`Arriba ves el promedio de cada lugar. Para este periodo falta el resultado de Mann–Kendall en ${listing.name}. Si quieres hacer la prueba, pulsa «Trazar tendencia» en DirtBNB y vuelve a registrar el análisis.`,
                      `Above is the average for each place. The Mann–Kendall result for ${listing.name} is missing for this period. If you want to run the test, choose “Plot trend” in DirtBNB and record the analysis again.`)}</p>
                </> : <>
                  <p>{t('Usa el valor p para decidir si hay evidencia de una tendencia. El signo de la pendiente indica si la variable subió o bajó.', 'Use the p-value to decide whether the data support a trend. The sign of the slope tells you whether the variable rose or fell.')}</p>
                  <ul>
                    <li><strong>REAL ↑</strong> {t('si p es menor que 0,05 y la pendiente es positiva.', 'if p is below 0.05 and the slope is positive.')}</li>
                    <li><strong>REAL ↓</strong> {t('si p es menor que 0,05 y la pendiente es negativa.', 'if p is below 0.05 and the slope is negative.')}</li>
                    <li><strong>{stampLabel('unproven')}</strong> {t('si p es 0,05 o mayor, o la pendiente es cero. La evidencia es insuficiente para afirmar una subida o una bajada.', 'if p is 0.05 or higher, or the slope is zero. The evidence is insufficient to claim an increase or decrease.')}</li>
                  </ul>
                </>}
              </div>
              <div className="office-stamps">{stamps.map(stamp => <button type="button" key={stamp} disabled={!canEditDraft} aria-pressed={stamp === draft.stamp}
                onClick={() => { save({ stamp }); if (stamp === stampAnswer) onStamp() }}>{stampLabel(stamp)}</button>)}</div>
              {draft.stamp && <p role="status" className={draft.stamp === stampAnswer ? 'answer-correct' : 'answer-incorrect'}>{draft.stamp === stampAnswer
                ? t('Sello guardado. Sigue con la pregunta sobre marejadas.', 'Stamp saved. Continue to the storm-tide question.')
                : !trend || trend.p === null ? t('Cambia el sello a «NO PROBADO» para continuar con este análisis.', 'Change the stamp to “NOT PROVEN” to continue with this analysis.')
                  : t('Revisa el valor p y el signo de la pendiente antes de cambiar el sello.', 'Check the p-value and the sign of the slope before changing the stamp.')}</p>}
            </fieldset>
          </div>}
          <div className="dossier-evidence">
            {plot ? (progress.rentalAnalyses?.[listing.id]?.includes('terrain') && <TerrainEvidence language={language} id={listing.id} compact />)
              : <p>{t('DirtBNB no incluye una ficha de marejadas para este punto.', 'DirtBNB has no storm-tide report for this site.')}</p>}
            {plot && (progress.rentalAnalyses?.[listing.id]?.includes('terrain')
              ? <>
                <p>{t('Mapa de Queensland. El escenario incluye proyecciones a 2100.', 'Queensland map. The scenario includes projections to 2100.')}</p>
                <details>
                  <summary>{t('Comparar los terrenos de Erub', 'Compare the Erub sites')}</summary>
                  {listings.filter(item => erubPlots[item.id] && progress.rentalAnalyses?.[item.id]?.includes('terrain') && item.id !== listing.id)
                    .map(item => <TerrainEvidence key={item.id} language={language} id={item.id} compact />)}
                  <ErubStormMap language={language} id={listing.id} />
                </details>
              </>
              : <p>{t('Registra la ficha del terreno en DirtBNB para cotejarla.', 'Record the site report in DirtBNB to review it here.')}</p>)}
            <fieldset>
              <legend>{t('¿Qué dice la ficha sobre el riesgo de inundación por el mar?', 'What does the report say about flooding from the sea?')}</legend>
              <div className="dossier-site-choices">
                {siteReadings.map(reading => <button type="button" key={reading} aria-pressed={draft.siteReading === reading}
                  disabled={!canEditDraft || Boolean(plot && !progress.rentalAnalyses?.[listing.id]?.includes('terrain'))}
                  onClick={() => save({ siteReading: reading })}>{siteLabel(reading)}</button>)}
              </div>
              {draft.siteReading && <p role="status" className={draft.siteReading === siteAnswer ? 'answer-correct' : 'answer-incorrect'}>{draft.siteReading === siteAnswer
                ? t('Conclusión respaldada por los datos disponibles.', 'The available data support this conclusion.')
                : t('Vuelve a leer la ficha del punto elegido y fíjate si hay una zona de amenaza cartografiada.', 'Read the report for the selected site again and check for a mapped hazard zone.')}</p>}
            </fieldset>
          </div>
        </>}
      </li>
      {canChoose && <li>
        <h3>{t('Justifica y firma', 'Explain and sign')}</h3>
        <label>{t('¿Por qué elegiste este destino?', 'Why did you choose this destination?')}
          <textarea rows={2} disabled={!canEditDraft} value={draft.rationale ?? ''} onChange={event => save({ rationale: event.target.value })}
            placeholder={t('Cita un dato que influyó en tu decisión.', 'Cite a data point that informed your decision.')} />
        </label>
        <label className="office-check"><input type="checkbox" disabled={!canEditDraft} checked={draft.habitatPending ?? false} onChange={event => save({ habitatPending: event.target.checked })} />
          {t('Dejo pendiente comprobar alimento y refugio entre plantas de poca altura.', 'Food and shelter among low-growing plants still need field verification.')}
        </label>
        {draft.signed ? <>
          {!rental && officeActive && <button type="button" onClick={() => save({ signed: undefined })}>{t('Reabrir expediente', 'Reopen dossier')}</button>}
          {onComputer && <button type="button" className="primary" onClick={() => onComputer('rentals')}>{t('Ir a DirtBNB', 'Go to DirtBNB')}</button>}
        </> : <>
          <p id="dossier-signing-status" role="status">{signingPrompt ?? t('Expediente listo para firmar.', 'Dossier ready to sign.')}</p>
          <button type="button" className="primary" disabled={!canSign} aria-describedby="dossier-signing-status"
            onClick={() => { if (canSign && record) { save({ signed: record }); onStamp() } }}>{t('Firmar expediente', 'Sign dossier')}</button>
        </>}
      </li>}
    </ol>
  </div>
}
