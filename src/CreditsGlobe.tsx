import { useEffect, useRef, useState } from 'react'
import { asset, translate, type Language } from './config'
import { blueMarble, creditsSpecies } from './data/credits-species'

const globeSize = 216
const center = globeSize / 2
const radius = 98
const radians = Math.PI / 180
const tilt = 10 * radians
const cosTilt = Math.cos(tilt)
const sinTilt = Math.sin(tilt)
const motionPreference = '(prefers-reduced-motion: reduce)'

function makeGlobe(ctx: CanvasRenderingContext2D, texture: ImageData) {
  const image = ctx.createImageData(globeSize, globeSize)
  const samples: { index: number; longitude: number; row: number; light: number }[] = []
  for (let py = 0; py < globeSize; py++) {
    for (let px = 0; px < globeSize; px++) {
      const x = (px + .5 - center) / radius
      const north = (center - py - .5) / radius
      const distance = x * x + north * north
      const index = (py * globeSize + px) * 4
      if (distance >= 1) {
        if (distance < 1.065) image.data.set([91, 169, 182, distance < 1.028 ? 110 : 40], index)
        continue
      }
      const depth = Math.sqrt(1 - distance)
      const latitude = Math.asin(north * cosTilt + depth * sinTilt)
      const longitude = Math.atan2(x, depth * cosTilt - north * sinTilt) / (2 * Math.PI)
      const row = Math.min(texture.height - 1, Math.floor((.5 - latitude / Math.PI) * texture.height))
      samples.push({ index, longitude, row: row * texture.width, light: .61 + .52 * Math.max(0, depth * .8 - x * .48 + north * .29) })
      image.data[index + 3] = 255
    }
  }
  const shade = (v: number) => Math.round(v / 12) * 12
  return (longitude: number) => {
    const turn = .5 + longitude / 360
    for (const sample of samples) {
      const column = (sample.longitude + turn + 2) % 1
      const index = (sample.row + Math.floor(column * texture.width)) * 4
      image.data[sample.index] = shade(texture.data[index] * sample.light * .89 + 6)
      image.data[sample.index + 1] = shade(texture.data[index + 1] * sample.light * 1.04 + 18)
      image.data[sample.index + 2] = shade(texture.data[index + 2] * sample.light + 28)
    }
    ctx.putImageData(image, 0, 0)
  }
}

export function CreditsGlobe({ language, active }: { language: Language; active: boolean }) {
  const t = (es: string, en: string) => translate(language, [es, en])
  const [selected, setSelected] = useState(0)
  const [reduced, setReduced] = useState(() => matchMedia(motionPreference).matches)
  const [playing, setPlaying] = useState(() => !matchMedia(motionPreference).matches)
  const [textureState, setTextureState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const canvas = useRef<HTMLCanvasElement>(null)
  const pins = useRef<(HTMLSpanElement | null)[]>([])
  const angle = useRef(creditsSpecies[0].longitude - (reduced ? 0 : 30))
  const paint = useRef<((longitude: number) => void) | null>(null)
  const species = creditsSpecies[selected]

  useEffect(() => {
    const media = matchMedia(motionPreference)
    const change = () => {
      setReduced(media.matches)
      if (media.matches) setPlaying(false)
    }
    media.addEventListener('change', change)
    return () => media.removeEventListener('change', change)
  }, [])

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d')
    if (!ctx) { setTextureState('failed'); return }
    const map = new Image()
    map.onload = () => {
      const offscreen = document.createElement('canvas')
      offscreen.width = map.naturalWidth
      offscreen.height = map.naturalHeight
      const source = offscreen.getContext('2d')
      if (!source) { setTextureState('failed'); return }
      source.drawImage(map, 0, 0)
      const drawEarth = makeGlobe(ctx, source.getImageData(0, 0, offscreen.width, offscreen.height))
      paint.current = longitude => {
        drawEarth(longitude)
        creditsSpecies.forEach((point, i) => {
          const pin = pins.current[i]
          if (!pin) return
          const latitude = point.latitude * radians
          const offset = (point.longitude - longitude) * radians
          const forward = Math.cos(latitude) * Math.cos(offset)
          const height = Math.sin(latitude)
          const x = Math.cos(latitude) * Math.sin(offset)
          const north = height * cosTilt - forward * sinTilt
          const depth = height * sinTilt + forward * cosTilt
          pin.hidden = depth < .13
          pin.dataset.front = String(depth >= .52)
          pin.style.left = ((center + radius * x) / globeSize * 100) + '%'
          pin.style.top = ((center - radius * north) / globeSize * 100) + '%'
        })
      }
      paint.current(angle.current)
      setTextureState('ready')
    }
    map.onerror = () => setTextureState('failed')
    map.src = asset('art/earth-blue-marble.jpg')
    return () => {
      map.onload = null
      map.onerror = null
      paint.current = null
    }
  }, [])

  useEffect(() => {
    if (!active || !playing || textureState !== 'ready') return
    const next = window.setInterval(() => {
      if (!document.hidden) setSelected(i => (i + 1) % creditsSpecies.length)
    }, 5400)
    return () => window.clearInterval(next)
  }, [active, playing, textureState])

  useEffect(() => {
    if (!active) return
    if (reduced) {
      angle.current = species.longitude
      paint.current?.(angle.current)
      return
    }
    const from = angle.current
    const distance = ((species.longitude - from + 540) % 360) - 180
    if (distance === 0) return
    const start = performance.now()
    let lastPaint = -Infinity
    let frame = 0
    const rotate = (now: number) => {
      const progress = Math.min(1, (now - start) / 1350)
      if (now - lastPaint >= 33 || progress === 1) {
        angle.current = progress === 1 ? species.longitude : from + distance * (1 - Math.pow(1 - progress, 3))
        paint.current?.(angle.current)
        lastPaint = now
      }
      if (progress < 1) frame = requestAnimationFrame(rotate)
    }
    frame = requestAnimationFrame(rotate)
    return () => cancelAnimationFrame(frame)
  }, [active, species.longitude, reduced])

  const status = species.status === 'EN' ? t('En peligro', 'Endangered') : t('En peligro crítico', 'Critically endangered')

  return <div className="credit-globe">
    <figure className="earth-figure">
      <div className="earth-disc" data-state={textureState} role="img"
        aria-label={t('Globo terrestre con marcadores regionales de especies en peligro.', 'Earth globe with regional markers for endangered species.')}>
        <canvas ref={canvas} width={globeSize} height={globeSize} aria-hidden="true" />
        {creditsSpecies.map((point, i) => <span key={point.id} className="earth-pin" data-featured={selected === i} hidden aria-hidden="true"
          ref={element => { pins.current[i] = element }}>
          {selected === i && <span className="earth-pin-name">{translate(language, point.name)}</span>}
        </span>)}
      </div>
      <figcaption>
        {textureState === 'failed' && <p role="status">{t('No se pudo cargar el globo. Puedes explorar las especies abajo.', 'The globe could not load. You can still explore the species below.')}</p>}
        <a href={blueMarble} target="_blank" rel="noreferrer">NASA Earthdata · Blue Marble (MODIS)</a>
      </figcaption>
    </figure>
    <div className="earth-reading">
      <div className="earth-species">
        <p className="earth-region">{translate(language, species.region)}</p>
        <h3>{translate(language, species.name)}</h3>
        <p className="earth-scientific"><i>{species.scientificName}</i></p>
        <p className="earth-status"><span aria-hidden="true" />{status} · {species.authority}</p>
        <p className="earth-links" onFocus={() => setPlaying(false)}>
          <a href={species.record} target="_blank" rel="noreferrer">{t('Ficha y presencia', 'Status and range')}</a>
          <a href={species.context.url} target="_blank" rel="noreferrer">{translate(language, species.context.label)}</a>
        </p>
      </div>
      <div className="earth-controls" aria-label={t('Elegir región del globo', 'Select a globe region')}>
        {creditsSpecies.map((point, index) => <button key={point.id} type="button" aria-pressed={selected === index}
          onClick={() => { setPlaying(false); setSelected(index) }}>{translate(language, point.shortRegion)}</button>)}
      </div>
      <div className="earth-notes">
        <p>{t('Los puntos señalan regiones con presencia documentada.', 'Pins mark regions with documented presence.')}</p>
        {!reduced && textureState === 'ready' && <button type="button" onClick={() => setPlaying(value => !value)}>
          {playing ? t('Pausar recorrido', 'Pause tour') : t('Reanudar recorrido', 'Resume tour')}
        </button>}
      </div>
    </div>
  </div>
}
