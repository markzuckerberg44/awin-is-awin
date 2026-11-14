import { useEffect, useRef } from 'react'
import { asset, translate, type Language } from './config'
import { createPanorama } from './coast-panorama'

const leftKeys = ['arrowleft', 'a']
const rightKeys = ['arrowright', 'd']

export function CoastView({ language, view, onClose }: {
  language: Language
  view: 'sign' | 'coast'
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const fallback = useRef<HTMLImageElement>(null)
  const keys = useRef(new Set<string>())
  const lastPointer = useRef<number | null>(null)
  const targetBearing = useRef(.38)
  const t = (es: string, en: string) => translate(language, [es, en])
  const atSign = view === 'sign'

  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])

  useEffect(() => {
    const surface = canvas.current
    const image = fallback.current
    if (!surface || !image) return
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    let renderer: ReturnType<typeof createPanorama>
    let disposed = false
    let frame = 0
    let lastTime = 0
    let animationTime = 0
    let bearing = targetBearing.current
    let width = 0
    let height = 0
    let lens = .8
    const pressed = keys.current

    function resize() {
      if (!surface) return
      const rect = surface.getBoundingClientRect()
      const scale = Math.min(1, 1100 / Math.max(1, rect.width), 680 / Math.max(1, rect.height))
      lens = Math.max(.23, Math.min(.95, rect.width / Math.max(1, rect.height) * .49))
      if (width === 0) {
        const halfView = Math.atan(lens) / 2.5
        const center = .71 - halfView * .48
        targetBearing.current = bearing = (center - .5) / (.49 - halfView)
      }
      width = Math.max(1, Math.round(rect.width * scale))
      height = Math.max(1, Math.round(rect.height * scale))
    }

    function draw(now: number) {
      const dt = lastTime ? Math.min((now - lastTime) / 1000, .05) : 0
      lastTime = now
      const direction = Number(rightKeys.some(key => pressed.has(key))) - Number(leftKeys.some(key => pressed.has(key)))
      if (direction) turn(direction * dt * 1.18)
      bearing += (targetBearing.current - bearing) * (reduced.matches ? 1 : 1 - Math.exp(-dt * 15))
      if (!reduced.matches) animationTime += dt * 1000
      if (renderer) renderer.draw(bearing, lens, width, height, reduced.matches ? 0 : Math.floor(animationTime / 100) % 24)
      else image?.style.setProperty('object-position', (50 + bearing * 49) + '% center')
      frame = requestAnimationFrame(draw)
    }

    function clearKeys() { pressed.clear() }
    function visibility() {
      cancelAnimationFrame(frame)
      lastTime = 0
      if (document.hidden) clearKeys()
      else frame = requestAnimationFrame(draw)
    }

    const size = new ResizeObserver(resize)
    size.observe(surface)
    resize()
    const animation = new Image()
    animation.src = asset('art/coast-animation.webp')
    void animation.decode().then(() => {
      if (disposed) return
      renderer = createPanorama(surface, animation, 4, 6)
      if (renderer) {
        renderer.draw(bearing, lens, width, height)
        surface.classList.add('is-rendering')
      }
    }).catch(() => {})
    window.addEventListener('blur', clearKeys)
    document.addEventListener('visibilitychange', visibility)
    visibility()
    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      size.disconnect()
      renderer?.destroy()
      window.removeEventListener('blur', clearKeys)
      document.removeEventListener('visibilitychange', visibility)
      clearKeys()
    }
  }, [atSign])

  function turn(amount: number) {
    targetBearing.current = Math.max(-1, Math.min(1, targetBearing.current + amount))
  }

  return <dialog ref={dialog} className={atSign ? 'coast-view' : 'coast-panorama'} aria-label={atSign ? 'Welcome to Bramble Cay' : t('La costa desde el muelle', 'The coast from the pier')}
    onCancel={event => { event.preventDefault(); onClose() }}
    onKeyDown={event => {
      const key = event.key.toLowerCase()
      if (atSign || (!leftKeys.includes(key) && !rightKeys.includes(key))) return
      event.preventDefault()
      keys.current.add(key)
    }}
    onKeyUp={event => keys.current.delete(event.key.toLowerCase())}>
    {atSign ? <>
      <figure className="coast-sign">
        <img src={asset('art/coast-before.webp')} alt={t('Foto antigua de una playa ancha. Los postes quedan al descubierto y el agua todavía no llega a la cabaña.', 'Old photo of a broad beach. The posts stand exposed and the water has yet to reach the cabin.')} />
        <figcaption><strong>WELCOME TO BRAMBLE CAY</strong>
          <small>{t('Recreación del juego', 'In-game re-creation')}</small>
        </figcaption>
      </figure>
      <div className="coast-actions"><button className="primary" autoFocus onClick={onClose}>{t('Cerrar cartel', 'Close sign')}</button></div>
    </> : <>
      <div className="coast-look" onPointerDown={event => {
        if (!event.isPrimary || event.button !== 0) return
        event.currentTarget.setPointerCapture(event.pointerId)
        lastPointer.current = event.clientX
      }} onPointerMove={event => {
        if (!event.isPrimary || lastPointer.current === null) return
        turn((lastPointer.current - event.clientX) * 2.5 / Math.max(520, event.currentTarget.clientWidth))
        lastPointer.current = event.clientX
      }} onLostPointerCapture={() => { lastPointer.current = null }}>
        <img ref={fallback} src={asset('art/coast-now.webp')} draggable={false}
          alt={t('Desde el muelle, el mar cubre la antigua playa y llega a los peldaños de la cabaña.', 'From the pier, the sea covers the old beach and reaches the cabin steps.')} />
        <canvas ref={canvas} aria-hidden="true" />
      </div>
      <button className="coast-exit" autoFocus onClick={onClose}>{t('Volver al muelle', 'Back to the pier')} <kbd>Esc</kbd></button>
      <div className="coast-look-controls">
        <button aria-label={t('Mirar a la izquierda', 'Look left')} onClick={() => turn(-.38)}>←</button>
        <span>{t('← → o arrastra', '← → or drag')}</span>
        <button aria-label={t('Mirar a la derecha', 'Look right')} onClick={() => turn(.38)}>→</button>
      </div>
    </>}
  </dialog>
}
