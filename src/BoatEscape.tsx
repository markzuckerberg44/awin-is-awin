import { useEffect, useRef, useState } from 'react'
import { asset, translate, type Language, type Role } from './config'

type Side = 'left' | 'right'
type Race = { time: number; distance: number; gap: number; speed: number; strokeAt: number | null; feedback: 'steady' | 'miss' | null }
const beatLength = .82
const timingWindow = { start: .46, end: .66 }
const destination = 96
const startRace = (): Race => ({ time: 0, distance: 0, gap: 90, speed: 0, strokeAt: null, feedback: null })
const beat = (race: Race) => Math.floor(race.time / beatLength)
const phase = (race: Race) => race.time / beatLength % 1
const side = (race: Race): Side => beat(race) % 2 ? 'right' : 'left'
const inWindow = (race: Race) => phase(race) >= timingWindow.start && phase(race) <= timingWindow.end

function drawVoyage(ctx: CanvasRenderingContext2D, race: Race, art: HTMLImageElement[], motion: boolean, now: number) {
  const drift = motion ? race.time * 18 + race.distance : 0
  const box = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color
    ctx.fillRect(Math.floor(x), Math.floor(y), w, h)
  }
  box(0, 0, 320, 180, '#192d42')
  box(0, 61, 320, 119, '#245363')
  box(0, 112, 320, 68, '#2a6070')
  for (let i = 0; i < 44; i++) {
    const y = 66 + (i * 17) % 113
    const x = ((i * 83 - drift * (.3 + y / 180)) % 360 + 360) % 360 - 30
    box(x, y, 7 + i % 22, 1 + Number(y > 125), i % 4 ? '#4b7781' : '#85a4a0')
    if (i % 3 === 0) box(x + 4, y + 2, 6 + i % 11, 1, '#386675')
  }
  const front = Math.round(134 - Math.min(90, race.gap) * 1.3)
  for (let y = 0; y < 180; y += 4) {
    const edge = front + Math.sin(y * .081 + drift / 28) * 13
    box(0, y, edge, 4, '#202c41')
    box(edge - 8, y, 8, 2, '#415168')
  }
  const x = 168
  const y = 105 + (motion ? Math.round(Math.sin(race.time * 6) * 3) : 0)
  for (let i = 0; i < 12; i++) {
    const spread = (i * 29 + drift) % 65
    box(x - 29 - spread, y + (i * 11) % 49 - 21, 3 + i % 10, 1, '#9db7b4')
  }
  if (art[0]?.complete && art[0].naturalWidth) {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(Math.PI / 2)
    ctx.drawImage(art[0], -23, -40, 46, 80)
    ctx.restore()
  } else box(x - 32, y - 18, 64, 36, '#9b744e')
  art.slice(1).forEach((sprite, index) => {
    if (sprite.complete && sprite.naturalWidth) ctx.drawImage(sprite, 0, 0, 32, 30, x - 34 + (index % 2) * 27, y - 28 + Math.floor(index / 2) * 16, 24, 22)
  })
  ctx.strokeStyle = '#f0bc79'
  ctx.lineWidth = 3
  const splashAge = race.strokeAt === null ? 1 : (race.time - race.strokeAt) / .26
  const stroke = motion && splashAge < 1 ? Math.sin(splashAge * Math.PI) * 13 : 0
  ctx.beginPath()
  ctx.moveTo(x - 3, y - 9)
  ctx.lineTo(x + 6 + (side(race) === 'left' ? stroke : 0), y - 33)
  ctx.moveTo(x - 3, y + 10)
  ctx.lineTo(x + 7 + (side(race) === 'right' ? stroke : 0), y + 34)
  ctx.stroke()
  if (splashAge < 1) {
    const splashY = y + (side(race) === 'left' ? -33 : 34)
    const spread = motion ? splashAge * 11 : 3
    box(x + 6 + stroke - spread, splashY, 8 + Math.floor(spread), 2, '#b4e6dd')
    box(x + 14 + stroke + spread, splashY - 3 - spread, 3, 2, '#fff0cd')
    box(x + 3 - spread, splashY - 4, 3, 1, '#92c3bf')
  }
  const wind = motion ? now / 1000 : 0
  for (let i = 0; i < 48; i++) {
    const a = 326 - (i * 57 + wind * 118) % 326
    const b = (i * 31 + wind * 84) % 184
    box(a, b, 3, 1, '#739eac')
    box(a - 2, b + 1, 3, 1, '#5b8194')
    box(a - 4, b + 2, 3, 1, '#577c8e')
  }
}

export function BoatEscape({ language, role, paused, onStroke, onSuccess }: {
  language: Language
  role: Role
  paused: boolean
  onStroke: (good: boolean) => void
  onSuccess: () => void
}) {
  const t = (es: string, en: string) => translate(language, [es, en])
  const race = useRef(startRace())
  const [view, setView] = useState(race.current)
  const [status, setStatus] = useState<'ready' | 'rowing' | 'caught'>('ready')
  const canvas = useRef<HTMLCanvasElement>(null)
  const images = useRef<HTMLImageElement[]>([])
  const success = useRef(onSuccess)
  success.current = onSuccess

  useEffect(() => {
    images.current = ['boat-green', role, role === 'father' ? 'mother' : 'father', 'luz', 'nico'].map(name => {
      const img = new Image()
      img.src = asset('art/' + name + '.png')
      return img
    })
  }, [role])

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d')
    if (!ctx) return
    ctx.imageSmoothingEnabled = false
    const motion = !matchMedia('(prefers-reduced-motion: reduce)').matches
    let stamp = 0
    let frame = 0
    const tick = (now: number) => {
      const run = race.current
      const dt = stamp ? Math.min((now - stamp) / 1000, .05) : 0
      stamp = now
      if (!paused && !document.hidden && status === 'rowing') {
        const previous = beat(run)
        run.time += dt
        if (beat(run) !== previous) {
          if (run.strokeAt === null && run.speed > 0) {
            run.speed = 0
            run.feedback = 'miss'
          }
          run.strokeAt = null
        }
        run.distance += run.speed * dt
        run.gap = Math.min(90, run.gap + (run.speed * .3 - 5.8) * dt)
        setView({ ...run })
        if (run.distance >= destination) { success.current(); return }
        if (run.gap <= 0) {
          drawVoyage(ctx, run, images.current, motion, now)
          setStatus('caught')
          return
        }
      }
      drawVoyage(ctx, run, images.current, motion, now)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [paused, status])

  function stroke(direction: Side) {
    const run = race.current
    if (paused || status !== 'rowing' || run.strokeAt !== null) return
    const good = side(run) === direction && inWindow(run)
    if (good) {
      run.strokeAt = run.time
      run.speed = Math.min(22, run.speed + 4.4)
      run.feedback = 'steady'
    } else {
      run.speed = 0
      run.gap = Math.max(0, run.gap - 5)
      run.feedback = 'miss'
    }
    setView({ ...run })
    onStroke(good)
  }

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (paused || status !== 'rowing' || event.repeat) return
      const key = event.key.toLowerCase()
      if (key === 'a' || key === 'arrowleft') { event.preventDefault(); stroke('left') }
      if (key === 'd' || key === 'arrowright') { event.preventDefault(); stroke('right') }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [paused, status, onStroke])

  function start() {
    race.current = startRace()
    setView(race.current)
    setStatus('rowing')
  }

  const activeSide = side(view)
  const hit = view.strokeAt !== null
  const ready = inWindow(view) && !hit
  return <section className="boat-escape" aria-labelledby="boat-title">
    <canvas ref={canvas} width="320" height="180" aria-hidden="true" />
    {status === 'rowing' ? <>
      <header className="boat-status">
        <h2 id="boat-title">{t('Escapa de la tormenta', 'Outrun the storm')}</h2>
        <label>{t('Ruta de escape', 'Escape route')}<progress max={destination} value={Math.min(destination, view.distance)} /></label>
        <label>{t('Distancia de la tormenta', 'Gap from the storm')}<progress className="storm-gap" max={90} value={Math.max(0, view.gap)} /></label>
      </header>
      <div className="boat-controls">
        <p>{activeSide === 'left' ? t('Rema a la izquierda', 'Row left') : t('Rema a la derecha', 'Row right')}</p>
        <div className="rowing-beat" data-ready={ready} data-hit={hit} data-side={activeSide} aria-hidden="true">
          <span className="rowing-window" style={{ left: `${timingWindow.start * 100}%`, right: `${(1 - timingWindow.end) * 100}%` }} />
          <span className="rowing-needle" style={{ left: (phase(view) * 100) + '%' }} />
        </div>
        <div className="rowing-buttons">
          <button type="button" data-expected={activeSide === 'left'} onClick={() => stroke('left')}><kbd>A</kbd> {t('Izquierda', 'Left')}</button>
          <button type="button" data-expected={activeSide === 'right'} onClick={() => stroke('right')}><kbd>D</kbd> {t('Derecha', 'Right')}</button>
        </div>
        <p role="status" className="boat-feedback" data-feedback={view.feedback}>{view.feedback === 'miss' ? t('Fuera de ritmo. Velocidad 0.', 'Out of rhythm. Speed 0.') : view.feedback === 'steady'
          ? t('¡Remada a tiempo!', 'Stroke on time!') : t('Rema cuando la marca entre en la franja verde.', 'Row when the mark enters the green band.')}</p>
      </div>
    </> : <article className="end-card boat-intro">
      <h2 id="boat-title">{status === 'caught' ? t('La tormenta alcanzó el bote', 'The storm caught the boat') : t('Tu familia ya está a bordo', 'Your family is aboard')}</h2>
      <p>{t('Alterna izquierda y derecha. Rema cuando la marca entre en la franja verde. Si fallas, el bote pierde toda su velocidad.', 'Alternate left and right. Row when the mark enters the green band. A mistimed stroke stops the boat.')}</p>
      <button className="primary" type="button" onClick={start}>{status === 'caught' ? t('Reintentar', 'Try again') : t('Empezar a remar', 'Start rowing')}</button>
    </article>}
  </section>
}
