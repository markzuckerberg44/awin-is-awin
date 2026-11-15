import { useEffect, useRef, useState } from 'react'
import { translate, type Language } from './config'

type Position = { x: number; y: number }

function keepInView(position: Position, panel: HTMLElement): Position {
  const edge = 8
  return {
    x: Math.max(edge, Math.min(position.x, window.innerWidth - panel.offsetWidth - edge)),
    y: Math.max(edge, Math.min(position.y, window.innerHeight - panel.offsetHeight - edge)),
  }
}

function calculate(expression: string): number {
  const normalized = expression.replaceAll(',', '.').replaceAll('×', '*').replaceAll('÷', '/').replaceAll('−', '-')
  const tokens = normalized.match(/(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?|[()+*/-]/gi) ?? []
  if (!tokens.length || tokens.join('') !== normalized.replace(/\s/g, '')) throw new Error()
  let index = 0

  function readValue(): number {
    const token = tokens[index++]
    if (token === '+') return readValue()
    if (token === '-') return -readValue()
    if (token === '(') {
      const value = readSum()
      if (tokens[index++] !== ')') throw new Error()
      return value
    }
    const value = Number(token)
    if (!Number.isFinite(value)) throw new Error()
    return value
  }

  function readProduct(): number {
    let value = readValue()
    while (tokens[index] === '*' || tokens[index] === '/') {
      const operation = tokens[index++]
      const next = readValue()
      if (operation === '/' && next === 0) throw new RangeError()
      value = operation === '*' ? value * next : value / next
    }
    return value
  }

  function readSum(): number {
    let value = readProduct()
    while (tokens[index] === '+' || tokens[index] === '-') {
      const operation = tokens[index++]
      const next = readProduct()
      value = operation === '+' ? value + next : value - next
    }
    return value
  }

  const result = readSum()
  if (index !== tokens.length || !Number.isFinite(result)) throw new Error()
  return result
}

export function QuestionCalculator({ id, language, open, onClose }: { id: string; language: Language; open: boolean; onClose: () => void }) {
  const t = (es: string, en: string) => translate(language, [es, en])
  const [expression, setExpression] = useState('')
  const [resultShown, setResultShown] = useState(false)
  const [error, setError] = useState<'zero' | 'invalid'>()
  const [position, setPosition] = useState<Position>()
  const drag = useRef<{ pointerId: number; offset: Position } | undefined>(undefined)
  const calculator = useRef<HTMLElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const decimal = language === 'es' ? ',' : '.'
  const keys = ['C', '(', ')', '⌫', '7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '0', decimal, '=', '+']

  useEffect(() => {
    const panel = calculator.current
    if (!open || !panel) return
    input.current?.focus()
    function constrain() {
      setPosition(current => {
        if (!current || !panel) return current
        const next = keepInView(current, panel)
        return next.x === current.x && next.y === current.y ? current : next
      })
    }
    const observer = new ResizeObserver(constrain)
    observer.observe(panel)
    window.addEventListener('resize', constrain)
    return () => { observer.disconnect(); window.removeEventListener('resize', constrain) }
  }, [open])

  function move(x: number, y: number) {
    if (calculator.current) setPosition(keepInView({ x, y }, calculator.current))
  }

  function close() {
    drag.current = undefined
    onClose()
  }

  function update(value: string) {
    setExpression(value.slice(0, 120))
    setError(undefined)
    setResultShown(false)
  }

  function press(key: string) {
    if (key === 'C') return update('')
    if (key === '⌫') return update(expression.slice(0, -1))
    if (key !== '=') {
      const startsNumber = /[\d.,(]/.test(key)
      update(resultShown && startsNumber ? key : expression + key)
      return
    }
    try {
      const result = String(Number(calculate(expression).toPrecision(14)))
      update(result.replace('.', decimal))
      setResultShown(true)
    } catch (problem) {
      setError(problem instanceof RangeError ? 'zero' : 'invalid')
    }
  }

  return <section id={id} className="calculator-panel" ref={calculator} role="dialog" hidden={!open}
      aria-label={t('Calculadora', 'Calculator')}
      style={position && { left: position.x, top: position.y, right: 'auto', bottom: 'auto', margin: 0 }}
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          close()
        } else if (event.target instanceof HTMLInputElement && (event.key === 'Enter' || event.key === '=')) {
          event.preventDefault()
          press('=')
        }
      }}>
      <div className="calculator-top">
        <button type="button" className="calculator-grip" title={t('Arrastra para mover', 'Drag to move')}
          aria-label={t('Mover calculadora con las flechas', 'Move calculator with the arrow keys')}
          onPointerDown={event => {
            const rect = calculator.current?.getBoundingClientRect()
            if (!rect || event.button !== 0 || !event.isPrimary) return
            drag.current = { pointerId: event.pointerId, offset: { x: event.clientX - rect.left, y: event.clientY - rect.top } }
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          onPointerMove={event => {
            const active = drag.current
            if (active?.pointerId === event.pointerId) move(event.clientX - active.offset.x, event.clientY - active.offset.y)
          }}
          onLostPointerCapture={() => { drag.current = undefined }}
          onKeyDown={event => {
            const rect = calculator.current?.getBoundingClientRect()
            if (!rect || !event.key.startsWith('Arrow')) return
            event.preventDefault()
            const dx = Number(event.key === 'ArrowRight') - Number(event.key === 'ArrowLeft')
            const dy = Number(event.key === 'ArrowDown') - Number(event.key === 'ArrowUp')
            move(rect.left + dx * 20, rect.top + dy * 20)
          }} />
        <button type="button" className="calculator-off" onClick={close} aria-label={t('Cerrar calculadora', 'Close calculator')}>OFF</button>
      </div>
      <input ref={input} type="text" inputMode="none" autoComplete="off" spellCheck={false} maxLength={120}
        aria-label={t('Operación o resultado', 'Expression or result')} placeholder="0" value={expression}
        onChange={event => update(event.target.value)} />
      {error && <p role="status">{error === 'zero' ? t('No se puede dividir por cero.', 'Cannot divide by zero.') : t('Revisa la operación.', 'Check the expression.')}</p>}
      <output className="dialogue-reader" aria-live="polite">{resultShown ? expression : ''}</output>
      <div className="calculator-keys">
        {keys.map(key => <button key={key} type="button" className={key === '=' ? 'calculator-green' : undefined}
          aria-label={key === 'C' ? t('Limpiar', 'Clear') : key === '⌫' ? t('Borrar último carácter', 'Backspace') : undefined}
          onClick={() => press(key)}>{key}</button>)}
      </div>
    </section>
}
