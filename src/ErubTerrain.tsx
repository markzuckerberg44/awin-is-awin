import { translate, type Language } from './config'
import terrain from './data/erub-terrain.json'

type Plot = typeof terrain.plots[keyof typeof terrain.plots]
export const erubPlots: Partial<Record<string, Plot>> = terrain.plots
const layers = [
  { id: '13', fill: '#a59b86', label: ['Sin cobertura de la capa costera', 'Outside coastal layer coverage'] },
  { id: '12', fill: '#e5b75c', label: ['Amenaza media cartografiada', 'Mapped medium hazard'] },
  { id: '11', fill: '#a64f46', label: ['Amenaza alta cartografiada', 'Mapped high hazard'] },
] as const

const coastalMap = 'https://spatial-gis.information.qld.gov.au/arcgis/rest/services/PlanningCadastre/CoastalManagement/MapServer'
const currentRentalColor = '#306742'

export function ErubStormMap({ language, id }: { language: Language; id?: string }) {
  const t = (es: string, en: string) => translate(language, [es, en])
  const plot = id ? erubPlots[id] : undefined
  const currentRental = t('Arriendo actual', 'Current rental')
  const name = plot?.highHazard ? t('Casa frente al mar', 'Shorefront house') : t('Cabaña de la ladera', 'Hillside cottage')

  return <figure className="terrain-figure">
    <svg className="terrain-map" viewBox={`0 0 ${terrain.viewBox.join(' ')}`} role="img"
      aria-label={t('Mapa de marejadas de Erub. C: costa. L: ladera.', 'Erub storm-tide map. C: coast. L: hillside.')}>
      {layers.map(layer => <g key={layer.id} fill={layer.fill} fillRule="evenodd">
        {terrain.layers[layer.id].map((path, index) => <path key={index} d={path} />)}
      </g>)}
      {Object.entries(terrain.plots).map(([key, point]) => {
        const current = id === key
        const markerColor = current ? currentRentalColor : '#30242a'
        return <g key={key} transform={`translate(${point.marker.join(' ')})`}>
          <path d="M0 0 L17 -14 H32" fill="none" stroke={markerColor} strokeWidth="2" />
          <circle r={current ? 4.5 : 3.5} fill={markerColor} stroke="#fff0cd" strokeWidth="1.5" />
          <circle cx="32" cy="-14" r={current ? 13 : 10} fill={markerColor} stroke="#fff0cd" strokeWidth="2" />
          <text x="32" y="-14" textAnchor="middle" dominantBaseline="central" fill="#fff0cd">{point.code}</text>
        </g>
      })}
      <text x="435" y="30" textAnchor="end" fill="#30242a">↑ N</text>
    </svg>
    <figcaption>
      {plot && <p className="terrain-current-rental">
        <span style={{ background: currentRentalColor }} aria-hidden="true">{plot.code}</span>
        <strong>{currentRental} · {name}</strong>
      </p>}
      <ul className="viewer-legend">
        {layers.map(layer => <li key={layer.id}><span style={{ background: layer.fill }} aria-hidden="true" />{translate(language, layer.label)}</li>)}
      </ul>
      <p>C · {t('Costa', 'Coast')} / L · {t('Ladera', 'Hillside')}</p>
    </figcaption>
  </figure>
}

export function TerrainEvidence({ language, id, compact = false }: { language: Language; id: string; compact?: boolean }) {
  const plot = erubPlots[id]
  if (!plot) return null
  const t = (es: string, en: string) => translate(language, [es, en])
  const name = plot.highHazard ? t('Casa frente al mar', 'Shorefront house') : t('Cabaña de la ladera', 'Hillside cottage')
  const elevation = new Intl.NumberFormat(language, { minimumFractionDigits: 2 }).format(plot.elevation)
  const status = plot.highHazard ? t('Dentro de la zona cartografiada de amenaza alta.', 'Inside the mapped high-hazard zone.')
    : t('Fuera de las zonas cartografiadas de amenaza alta y media.', 'Outside the mapped high- and medium-hazard zones.')

  return <article className={compact ? 'terrain-summary' : 'habitat-card terrain-report'}>
    <h4>{t('Ficha del terreno', 'Site report')} · {name}</h4>
    <p><strong>{elevation} m</strong> · {t('Elevación del terreno', 'Ground elevation')}</p>
    <p>{status}</p>
    {!compact && <>
      <p>{t('Punto de referencia', 'Reference point')} · {plot.latitude.toFixed(4)}, {plot.longitude.toFixed(4)} (WGS84)</p>
      <p>{t('La capa de Queensland representa un escenario que incluye proyecciones a 2100. La amenaza alta indica una profundidad de inundación modelada superior a 1 m.', 'The Queensland layer represents a scenario that includes projections to 2100. High hazard indicates a modelled flood depth greater than 1 m.')}</p>
      <details>
        <summary>{t('Ver mapa de marejadas', 'View storm-tide map')}</summary>
        <ErubStormMap language={language} id={id} />
      </details>
      <p>{t('Queda por verificar en el terreno la disponibilidad de alimento y refugio. Los arriendos son ficticios y se ubican en puntos reales.', 'Food and shelter still need field verification. The fictional rentals use real reference points.')}</p>
      <ul className="terrain-sources">
        <li><a href={plot.sampleUrl} target="_blank" rel="noreferrer">Queensland QldDem · {t('muestra', 'sample')} {terrain.resolution} m</a></li>
        <li><a href={`${coastalMap}/11`} target="_blank" rel="noreferrer">{t('Capa de amenaza alta', 'High-hazard layer')}</a> · <a href={plot.hazardQueries['11']} target="_blank" rel="noreferrer">{t('Consulta del punto', 'Point query')}</a></li>
        <li><a href={plot.hazardQueries['12']} target="_blank" rel="noreferrer">{t('Consulta de amenaza media', 'Medium-hazard query')}</a> · <a href={plot.hazardQueries['13']} target="_blank" rel="noreferrer">{t('Consulta de cobertura', 'Coverage query')}</a></li>
      </ul>
    </>}
  </article>
}
