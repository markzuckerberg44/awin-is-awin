import { useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react'
import { createRoot } from 'react-dom/client'
import { areaFor, asset, defaultSettings, GAME_TITLE, isCabinStage, levels, readLocal, saveKey, settingsKey, translate, writeLocal,
  type Labels, type Role, type Save, type Settings, type Stage } from './config'
import { GameAudio } from './audio'
import { CoastView } from './CoastView'
import { OfficePanel } from './OfficePanel'
import { emptyInvestigation } from './investigation'
import { broadcast, dinner, flood, greeting, heat, objectives, type Line } from './story'
import type { Action, OfficeTool } from './world'
import './style.css'

type Screen = 'title' | 'levels' | 'role' | 'world'
type World = import('./world').BrambleScene
type Conversation = { lines: Line[]; index: number; next: Stage; intro?: boolean }
type Game = ReturnType<typeof import('./world').createWorld>

function DialogueBox({ name, portrait, text, radio, paused, language, audio, onNext }: {
  name: string
  portrait: string | undefined
  text: string
  radio: boolean
  paused: boolean
  language: Settings['language']
  audio: RefObject<GameAudio | null>
  onNext: () => void
}) {
  const [revealed, setRevealed] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches ? text.length : 0)
  const nextButton = useRef<HTMLButtonElement>(null)
  const complete = revealed === text.length
  const parent = portrait === 'mother' || portrait === 'father'
  const mouthOpen = parent && !complete && !paused && Math.floor(revealed / 3) % 2 === 1

  useEffect(() => { nextButton.current?.focus() }, [])
  useEffect(() => {
    if (complete || paused) return
    const timer = window.setTimeout(() => {
      if (/[\p{L}\p{N}]/u.test(text[revealed])) audio.current?.squeak(revealed)
      setRevealed(revealed + 1)
    }, 28)
    return () => window.clearTimeout(timer)
  }, [audio, complete, paused, revealed, text])

  return <article className={radio ? 'dialogue on-air' : 'dialogue'} aria-label={name}>
    <div className="dialogue-portrait" data-mouth={mouthOpen ? 'open' : 'closed'}>
      <img src={asset('art/' + portrait + '-portrait.png')} alt="" />
      {parent && <img className="mouth-open" src={asset('art/' + portrait + '-portrait-open.png')} alt="" />}
    </div>
    <div className="dialogue-copy">
      <h2>{name}</h2>
      <p aria-hidden="true">{text.slice(0, revealed)}<span className="dialogue-unrevealed">{text.slice(revealed)}</span></p>
    </div>
    <button ref={nextButton} className="next" onClick={() => complete ? onNext() : setRevealed(text.length)}>
      {translate(language, complete ? ['Continuar', 'Continue'] : ['Mostrar todo', 'Show all'])} <span aria-hidden="true">›</span>
    </button>
  </article>
}

function App() {
  const [screen, setScreen] = useState<Screen>('title')
  const [settings, setSettings] = useState(() => readLocal<Settings>(settingsKey, defaultSettings))
  const [save, setSave] = useState(() => readLocal<Save | null>(saveKey, null))
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [levelRun, setLevelRun] = useState(0)
  const [ending, setEnding] = useState(false)
  const [coastView, setCoastView] = useState<'sign' | 'coast' | null>(null)
  const [officeTool, setOfficeTool] = useState<OfficeTool>()
  const [officeSeated, setOfficeSeated] = useState(false)
  const deskControl = useRef<HTMLButtonElement>(null)
  const [dialogue, setDialogue] = useState<Conversation | null>(null)
  const [nearby, setNearby] = useState<Labels | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const mount = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const options = useRef<HTMLDialogElement>(null)
  const endingButton = useRef<HTMLButtonElement>(null)
  const world = useRef<World | null>(null)
  const audio = useRef<GameAudio | null>(null)
  const language = settings.language
  const t = (es: string, en: string) => translate(language, [es, en])
  const openingRadio = dialogue?.intro === true
  const active = dialogue && !openingRadio ? dialogue.lines[dialogue.index] : null
  const soundOn = settings.sound && settings.volume > 0
  const stage = save?.stage
  const role = save?.role
  const atShore = save?.atShore === true
  const cabinVisit = save?.cabinVisit
  const inOffice = save?.inOffice === true
  const area = stage && areaFor(stage, atShore, cabinVisit, inOffice)
  const inside = area === 'inside' || area === 'office'

  function advance(next: Stage) {
    setSave(previous => previous && { ...previous, stage: next })
  }

  function startConversation(lines: Line[], next: Stage) {
    setDialogue({ lines, index: 0, next })
  }

  function sitAtDesk(seated: boolean) {
    world.current?.setOfficeSeated(seated)
    setOfficeSeated(seated)
  }

  function openDeskTool(tool: 'computer' | 'notebook') {
    audio.current?.openDeskTool(tool)
    setOfficeTool(tool)
  }

  function act(current: Action) {
    switch (current) {
      case 'yard': advance('hat'); break
      case 'enterCabin':
        setSave(previous => previous && { ...previous, cabinVisit: isCabinStage(previous.stage) ? undefined : 'inside' })
        break
      case 'exitCabin':
        setSave(previous => previous && { ...previous, cabinVisit: isCabinStage(previous.stage) ? 'outside' : undefined })
        break
      case 'enterOffice':
      case 'exitOffice':
        setSave(previous => previous && { ...previous, inOffice: current === 'enterOffice' || undefined })
        break
      case 'sitOffice':
        sitAtDesk(true)
        break
      case 'dossier':
        setOfficeTool(current)
        break
      case 'hat': advance('greeting'); break
      case 'greeting': startConversation(greeting, 'seat'); break
      case 'seat': startConversation(dinner, 'radio'); break
      case 'radio': setDialogue({ lines: broadcast, index: 0, next: 'leave', intro: true }); break
      case 'leave': advance('heat'); break
      case 'heat': startConversation(heat, 'flood'); break
      case 'flood': startConversation(flood, 'pier'); break
      case 'pier':
        setSave(previous => previous && {
          ...previous,
          stage: previous.stage === 'pier' ? 'pierSign' : previous.stage,
          atShore: false,
        })
        break
      case 'returnToShore':
        setSave(previous => previous && { ...previous, atShore: true })
        break
      case 'pierSign': setCoastView('sign'); break
      case 'pierCoast':
      case 'complete': setCoastView('coast'); break
    }
  }

  const actRef = useRef(act)
  actRef.current = act

  useEffect(() => {
    if (screen !== 'world' || !role || !stage) return
    let game: Game | undefined
    let closed = false
    setLoadFailed(false)
    setNearby(null)
    void import('./world').then(({ BrambleScene, createWorld }) => {
      if (closed || !mount.current) return
      const scene = new BrambleScene(role, stage, atShore, cabinVisit, current => actRef.current(current), setNearby, inOffice)
      world.current = scene
      game = createWorld(mount.current, scene)
    }).catch(() => { if (!closed) setLoadFailed(true) })
    return () => {
      closed = true
      world.current = null
      game?.destroy(true)
    }
  // Stage changes go through the existing scene, which owns the map transitions.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, role, levelRun])

  useEffect(() => { if (stage) world.current?.setStage(stage, atShore, cabinVisit, inOffice) }, [stage, atShore, cabinVisit, inOffice])
  useEffect(() => {
    if (world.current) world.current.paused = Boolean(dialogue || settingsOpen || ending || coastView || officeTool)
  }, [dialogue, settingsOpen, ending, coastView, officeTool])
  useEffect(() => { if (save) writeLocal(saveKey, save) }, [save])
  useEffect(() => {
    writeLocal(settingsKey, settings)
    document.documentElement.lang = language
    audio.current?.configure(settings, Boolean(screen === 'world' && inside))
  }, [settings, language, screen, inside])
  useEffect(() => {
    document.title = GAME_TITLE
    audio.current = new GameAudio()
    return () => audio.current?.configure({ ...defaultSettings, sound: false }, false)
  }, [])
  useEffect(() => { heading.current?.focus() }, [screen])
  useEffect(() => {
    if (settingsOpen) options.current?.showModal()
    else options.current?.close()
  }, [settingsOpen])
  useEffect(() => { if (ending) endingButton.current?.focus() }, [ending])
  useEffect(() => {
    if (officeSeated && !officeTool && !settingsOpen) deskControl.current?.focus()
  }, [officeSeated, officeTool, settingsOpen])
  useEffect(() => {
    if (!openingRadio) return
    const showAnnouncement = () => setDialogue(current => current?.intro ? { ...current, intro: false } : current)
    if (!audio.current || !soundOn) {
      showAnnouncement()
      return
    }
    return audio.current.playRadioIntro(showAnnouncement)
  }, [openingRadio, soundOn])

  function enableAudio() {
    audio.current?.configure(settings, Boolean(screen === 'world' && inside))
    audio.current?.start()
  }

  function nextLine() {
    if (!dialogue) return
    const next = dialogue.lines[dialogue.index + 1]
    if (next) {
      setDialogue({ ...dialogue, index: dialogue.index + 1 })
    } else {
      advance(dialogue.next)
      setDialogue(null)
    }
  }

  function closeCoast() {
    setCoastView(null)
    if (coastView === 'sign') advance('pierCoast')
    if (coastView === 'coast' && stage === 'pierCoast') {
      advance('complete')
      setEnding(true)
    }
  }

  function chooseRole(value: Role) {
    setSave({ role: value, stage: 'yard' })
    setScreen('world')
  }

  function restartLevel() {
    if (!role) return
    setDialogue(null)
    setEnding(false)
    setCoastView(null)
    setOfficeTool(undefined)
    setOfficeSeated(false)
    setNearby(null)
    setSettingsOpen(false)
    chooseRole(role)
    setLevelRun(run => run + 1)
  }

  function toLevels() {
    setDialogue(null)
    setEnding(false)
    setCoastView(null)
    setOfficeTool(undefined)
    setOfficeSeated(false)
    setScreen('levels')
  }

  function move(event: PointerEvent<HTMLButtonElement>, x: number, y: number) {
    event.currentTarget.setPointerCapture(event.pointerId)
    world.current?.setMove(x, y)
  }

  function portrait(line: Line) {
    if (line.speaker === 'player') return role
    if (line.speaker === 'partner') return role === 'mother' ? 'father' : 'mother'
    return line.speaker
  }

  function speaker(line: Line) {
    switch (line.speaker) {
      case 'player': return role === 'mother' ? t('Mamá', 'Mom') : t('Papá', 'Dad')
      case 'partner': return role === 'mother' ? t('Papá', 'Dad') : t('Mamá', 'Mom')
      case 'radio': return t('Radio de la isla', 'Island Radio')
      default: return line.speaker[0].toUpperCase() + line.speaker.slice(1)
    }
  }

  const level = levels[0]
  return <main className={screen === 'world' ? 'app game' : 'app menu'} onPointerDown={enableAudio} onKeyDown={event => {
    enableAudio()
    if (!officeSeated || officeTool || settingsOpen || event.repeat) return
    if (event.key === '1') openDeskTool('computer')
    if (event.key === '2') openDeskTool('notebook')
    if (event.key === 'Escape') sitAtDesk(false)
  }}>
    {screen !== 'world' && <div className="cover" aria-hidden="true" />}
    {screen === 'title' && <section className="title-screen">
      <h1 ref={heading} tabIndex={-1}>{GAME_TITLE}</h1>
      <div className="title-actions">
        <button className="primary" onClick={() => { audio.current?.click(); setScreen('levels') }}>{t('Jugar', 'Play')} <span aria-hidden="true">→</span></button>
        <button className="quiet" onClick={() => setSettingsOpen(true)}>{t('Configuración', 'Settings')}</button>
      </div>
      <button className="sound" aria-pressed={settings.sound} onClick={() => setSettings({ ...settings, sound: !settings.sound })}>
        <span aria-hidden="true">{settings.sound ? '◖))' : '◖×'}</span> {settings.sound ? t('Sonido activado', 'Sound on') : t('Sonido desactivado', 'Sound off')}
      </button>
    </section>}
    {screen === 'levels' && <section className="selection">
      <button className="back" onClick={() => setScreen('title')}>← {t('Inicio', 'Title screen')}</button>
      <h1 ref={heading} tabIndex={-1}>{t('Elige un capítulo', 'Choose a chapter')}</h1>
      <div className="cards">
        {levels.map(chapter => <button key={chapter.id} className="level-card" onClick={() => { audio.current?.click(); setScreen(save ? 'world' : 'role') }}>
          <span className="card-art"><img src={asset('art/father-portrait.png')} alt="" /></span>
          <span className="card-body">
            <strong>{language === 'es' ? 'Melomys de Bramble Cay' : 'Bramble Cay melomys'}</strong>
            <em>{chapter.species}</em>
            <span className="start-label">{save ? t('Continuar', 'Continue') : t('Comenzar', 'Begin')} <span aria-hidden="true">↗</span></span>
          </span>
        </button>)}
      </div>
      {save && <button className="back replay" onClick={() => setScreen('role')}>{t('Empezar el capítulo de nuevo', 'Start the chapter again')}</button>}
    </section>}
    {screen === 'role' && <section className="selection">
      <button className="back" onClick={() => setScreen('levels')}>← {t('Capítulos', 'Chapters')}</button>
      <h1 ref={heading} tabIndex={-1}>{t('¿Quién llega a casa?', 'Who’s coming home?')}</h1>
      <p className="role-description">{t('Los dos tienen la misma historia y las mismas misiones.', 'Both play the same story and missions.')}</p>
      <div className="cards role-cards">
        {(['mother', 'father'] as const).map(value => <button className="role-card" key={value} onClick={() => { audio.current?.click(); chooseRole(value) }}>
          <img src={asset('art/' + value + '-portrait.png')} alt="" />
          <strong>{value === 'mother' ? t('Mamá', 'Mom') : t('Papá', 'Dad')}</strong>
        </button>)}
      </div>
    </section>}
    {screen === 'world' && save && <section className="play">
      <header className="hud">
        <button className="back" onClick={toLevels}>← <span>{t('Capítulos', 'Chapters')}</span></button>
        <span className="location">{level.chapter[language]} <span aria-hidden="true">/</span> {inOffice ? t('La oficina', 'The office') : inside ? t('La cabaña', 'The cabin') : area === 'pier' ? t('El muelle', 'The pier') : t('El poblado', 'The village')}</span>
        <button className="back options" onClick={() => setSettingsOpen(true)}>{t('Configuración', 'Settings')}</button>
      </header>
      <div className="viewport">
        <div key={levelRun} className="canvas" ref={mount} aria-label={inOffice ? t('Oficina de la cabaña', 'Cabin office') : inside ? t('Interior de la cabaña', 'Cabin interior') : t('Patio y casas vecinas', 'Yard and neighboring houses')} />
        {loadFailed && <p role="alert" className="loading">{t('No se pudo cargar la escena.', 'Could not load the scene.')}</p>}
        {!dialogue && !ending && !officeSeated && <p className="objective" aria-live="polite">{inOffice
          ? t('Siéntate para usar el PC o el cuaderno. El expediente está en la estantería.', 'Sit down to use the computer or notebook. The dossier is on the bookshelf.')
          : cabinVisit === 'inside'
          ? save.stage === 'complete' ? t('La oficina está al fondo de la cabaña.', 'The office is at the back of the cabin.') : t('Sal por la puerta para continuar la investigación.', 'Go outside to continue the investigation.')
          : cabinVisit === 'outside' ? t('Vuelve a entrar para continuar en casa.', 'Go back inside to continue at home.')
          : translate(language, objectives[atShore ? 'pier' : save.stage])}</p>}
        {nearby && !dialogue && !ending && !officeSeated && <button className="prompt" onClick={() => world.current?.interact()}><kbd>E</kbd> {translate(language, nearby)}</button>}
        {officeSeated && !officeTool && <nav className="desk-actions" aria-label={t('Escritorio', 'Desk')}>
          <button ref={deskControl} onClick={() => openDeskTool('computer')}><kbd>1</kbd> {t('Ver el PC', 'View computer')}</button>
          <button onClick={() => openDeskTool('notebook')}><kbd>2</kbd> {t('Abrir el cuaderno', 'Open the notebook')}</button>
          <button onClick={() => sitAtDesk(false)}><kbd>Esc</kbd> {t('Levantarse', 'Stand up')}</button>
        </nav>}
        <span className="dialogue-reader" role="status">{active && translate(language, active.text)}</span>
        {active && dialogue && <DialogueBox key={language + ':' + dialogue.index} name={speaker(active)} portrait={portrait(active)}
          text={translate(language, active.text)} radio={active.speaker === 'radio'} paused={settingsOpen}
          language={language} audio={audio} onNext={nextLine} />}
        {coastView && <CoastView key={coastView} view={coastView} language={language} onClose={closeCoast} />}
        {officeTool && <OfficePanel tool={officeTool} language={language}
          progress={save.investigation ?? emptyInvestigation} stage={save.stage}
          onChange={investigation => setSave(previous => previous && { ...previous, investigation })}
          onClose={() => setOfficeTool(undefined)} />}
        {ending && <article className="end-card">
          <h2>{t('Las primeras pistas', 'The first clues')}</h2>
          <p>{t('Ada habló del calor y la falta de agua. Eli contó lo de la inundación. Desde el muelle viste que el agua llega donde antes había arena seca. ¿Llegó hasta ahí por una marea alta o ha estado subiendo durante años?', 'Ada described the heat and lack of water. Eli told you about the flood. From the pier, you saw water where there used to be dry sand. Was that just a high tide, or has the sea been rising for years?')}</p>
          <p>{t('De vuelta en casa, abre el cuaderno de la oficina para revisar las pistas.', 'Back home, open the notebook in the office to review the clues.')}</p>
          <button className="primary" ref={endingButton} onClick={toLevels}>{t('Volver a capítulos', 'Back to chapters')} →</button>
          <button className="back" onClick={() => setEnding(false)}>{t('Quedarme en el muelle', 'Stay at the pier')}</button>
        </article>}
      </div>
      <footer className="controls">
        {!officeSeated && <>
          <span className="key-controls">{t('Moverse', 'Move')} <kbd>W A S D</kbd> <kbd>↑ ↓ ← →</kbd> <span>{t('Interactuar', 'Interact')}</span> <kbd>E</kbd></span>
          <span className="touch-controls">{t('Toca el suelo para caminar.', 'Tap the ground to walk.')}</span>
        </>}
        {!dialogue && !ending && !officeSeated && <div className="dpad" aria-label={t('Moverse', 'Move')}>
          {([['↑', 0, -1, 'Arriba', 'Up'], ['←', -1, 0, 'Izquierda', 'Left'], ['↓', 0, 1, 'Abajo', 'Down'], ['→', 1, 0, 'Derecha', 'Right']] as const)
            .map(([key, x, y, es, en]) => <button key={key} aria-label={t(es, en)} onPointerDown={event => move(event, x, y)} onLostPointerCapture={() => world.current?.setMove(0, 0)}>{key}</button>)}
        </div>}
      </footer>
    </section>}
    <dialog ref={options} className="settings" aria-labelledby="settings-heading" onCancel={() => setSettingsOpen(false)}>
      <h2 id="settings-heading">{t('Configuración', 'Settings')}</h2>
      <label className="setting-row">{t('Idioma', 'Language')}
        <select value={language} onChange={event => setSettings({ ...settings, language: event.target.value as Settings['language'] })}>
          <option value="es">Español</option><option value="en">English</option>
        </select>
      </label>
      <label className="setting-row">{t('Sonido', 'Sound')}
        <input type="checkbox" checked={settings.sound} onChange={event => setSettings({ ...settings, sound: event.target.checked })} />
      </label>
      <label className="setting-row">{t('Volumen', 'Volume')}
        <input type="range" min={0} max={1} step={.05} value={settings.volume} onChange={event => setSettings({ ...settings, volume: Number(event.target.value) })} />
      </label>
      {screen === 'world' && <button className="quiet" onClick={restartLevel}>{t('Reiniciar nivel', 'Restart level')}</button>}
      <button className="primary" onClick={() => setSettingsOpen(false)}>{t('Volver', 'Back')} <span aria-hidden="true">↵</span></button>
    </dialog>
  </main>
}

createRoot(document.getElementById('root')!).render(<App />)
