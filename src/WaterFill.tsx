import { useCallback, useEffect, useRef, useState } from 'react'
import { asset, translate, type Language } from './config'

export function WaterFill({ language, paused, onStroke, onFilled }: {
  language: Language
  paused: boolean
  onStroke: (inZone: boolean) => void
  onFilled: () => void
}) {
  const t = (es: string, en: string) => translate(language, [es, en])
  const [amount, setAmount] = useState(0)
  const [feedback, setFeedback] = useState<'strong' | 'steady'>()
  const elapsed = useRef(0)
  const charge = useRef(0)
  const filled = useRef(0)
  const lastPress = useRef(-Infinity)
  const meter = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)

  useEffect(() => { if (!paused) button.current?.focus() }, [paused])
  useEffect(() => {
    if (paused) return
    const start = performance.now() - elapsed.current
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const halfCycle = reduced ? 1400 : 1050
    let frame: number
    function tick(now: number) {
      elapsed.current = now - start
      charge.current = 1 - Math.abs((elapsed.current / halfCycle) % 2 - 1)
      if (meter.current) {
        meter.current.style.setProperty('--charge', String(reduced ? Math.round(charge.current * 20) / 20 : charge.current))
        meter.current.dataset.ready = String(charge.current >= .57 && charge.current <= .8)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [paused])

  const pump = useCallback(() => {
    const now = performance.now()
    if (paused || filled.current === 100 || now - lastPress.current < 200) return
    lastPress.current = now
    const inZone = charge.current >= .57 && charge.current <= .8
    filled.current = Math.min(100, filled.current + (inZone ? 34 : 12))
    onStroke(inZone)
    setAmount(filled.current)
    setFeedback(inZone ? 'strong' : 'steady')
    if (filled.current === 100) onFilled()
  }, [onFilled, onStroke, paused])

  useEffect(() => {
    if (paused) return
    function handleKeydown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== 'e' || event.repeat) return
      event.preventDefault()
      pump()
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [paused, pump])

  return <section className="water-console" role="group" aria-labelledby="fill-heading">
    <div className="water-meter" ref={meter} aria-hidden="true">
      <span className="water-charge" />
      <span className="water-zone" />
    </div>
    <div className="water-console-copy">
      <h2 id="fill-heading">{t('Llena el bidón de Ada', 'Fill Ada’s water jug')}</h2>
      <p>{t('Pulsa E o Bombea cuando la barra esté en la franja verde para llenar más rápido.', 'Press E or Pump when the bar reaches the green band to fill faster.')}</p>
      <div className="jug-progress">
        <img src={asset('art/water-jug.png')} width="19" height="23" alt="" />
        <progress aria-label={t('Agua en el bidón', 'Water in the jug')} max={100} value={amount} />
        <output>{amount}%</output>
      </div>
      <p className="water-feedback" role="status">{feedback === 'strong' ? t('¡Buen pulso! +34%', 'Great timing! +34%') : feedback === 'steady' ? t('Chorro lento. +12%', 'Slow flow. +12%') : '\u00a0'}</p>
      <button ref={button} onClick={pump}><kbd>E</kbd> {t('Bombea', 'Pump')}</button>
    </div>
  </section>
}
