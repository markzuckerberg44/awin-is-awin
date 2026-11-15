import { useEffect, useRef, useState } from 'react'
import { translate, type Language } from './config'
import { CreditsEpilogue } from './CreditsEpilogue'
import { erubPlots } from './ErubTerrain'
import { listings } from './habitat'

export function EvacuationResult({ language, stage, rentalId, paused, onContinue, onPageTurn, onAnswer }: {
  language: Language
  stage: 'escaped' | 'credits'
  rentalId?: string
  paused: boolean
  onContinue: () => void
  onPageTurn: () => void
  onAnswer: (correct: boolean) => void
}) {
  const [showEpilogue, setShowEpilogue] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const t = (es: string, en: string) => translate(language, [es, en])
  const listing = listings.find(place => place.id === rentalId)
  const plot = rentalId ? erubPlots[rentalId] : undefined
  const elevation = plot ? new Intl.NumberFormat(language, { minimumFractionDigits: 2 }).format(plot.elevation) : undefined
  const hillside = rentalId === 'erub'
  useEffect(() => { if (!showEpilogue) heading.current?.focus({ preventScroll: true }) }, [stage, showEpilogue])

  if (showEpilogue) return <CreditsEpilogue language={language} rentalId={rentalId} paused={paused} onBack={() => setShowEpilogue(false)}
    onFinish={onContinue} onPageTurn={onPageTurn} onAnswer={onAnswer} />

  return <section className="evac-result" aria-labelledby="evac-result-title">
    <article className="end-card">
      <h2 id="evac-result-title" ref={heading} tabIndex={-1}>{stage === 'escaped' ? t('Lograste escapar de la tormenta', 'You escaped the storm')
        : t('Créditos: tu elección', 'Credits: your choice')}</h2>
      {stage === 'escaped' ? <p>{t('Tu familia está a salvo, a bordo contigo.', 'Your family is safe aboard the boat with you.')}</p> : <>
        <p className="evac-verdict" data-correct={hillside}><strong>{hillside
          ? t('Elegiste el lugar correcto.', 'You chose the right place.')
          : t('Te equivocaste de lugar.', 'You chose the wrong place.')}</strong></p>
        {listing && <p><strong>{t('Tu arriendo', 'Your rental')}</strong> · {translate(language, listing.listing)} · {listing.name}</p>}
        {!hillside && <p>{t('La ladera de Erub era la opción mejor respaldada.', 'The Erub hillside was the best-supported option.')}</p>}
        {hillside ? <p>{t(`A ${elevation} m, la ladera queda fuera de las zonas de amenaza alta y media del mapa de marejadas.`,
          `At ${elevation} m, the hillside lies outside the storm-tide map’s high- and medium-hazard zones.`)}</p>
          : plot?.highHazard ? <p>{t(`A ${elevation} m, la costa queda en una zona de amenaza alta según el mapa de marejadas.`,
            `At ${elevation} m, the coast lies in a high-hazard zone on the storm-tide map.`)}</p>
          : <p>{t('Hay datos climáticos de la región. El riesgo de inundación del terreno sigue sin comprobarse.', 'Regional climate data is available. The site’s flood risk remains unverified.')}</p>}
        <p>{t('Queda por comprobar si hay alimento y refugio.', 'Food and shelter still need to be checked.')}</p>
      </>}
      <button className="primary" type="button" onClick={() => {
        onPageTurn()
        if (stage === 'escaped') onContinue()
        else setShowEpilogue(true)
      }}>{stage === 'escaped' ? t('Ver el resultado del arriendo', 'See your rental result') : t('Ver la historia real', 'See the real story')}</button>
    </article>
  </section>
}
