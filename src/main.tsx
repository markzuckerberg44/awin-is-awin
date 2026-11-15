import { useEffect, useRef, useState, type PointerEvent, type RefObject, type SetStateAction } from 'react'
import { createRoot } from 'react-dom/client'
import { areaFor, asset, chapterSaveKey, defaultSettings, GAME_TITLE, isCabinStage, isPierStage, levels, readLocal, savedChapter, settingsKey, translate, writeLocal,
  type ChapterId, type Labels, type Role, type Save, type Settings, type Stage } from './config'
import { GameAudio } from './audio'
import { CoastView } from './CoastView'
import { OfficePanel } from './OfficePanel'
import { emptyInvestigation } from './investigation'
import { bedroomAlarm, broadcast, dinner, evacuationBroadcast, flood, floodAlarm, greeting, heat, objectives, packingBrief, wakingUp, waterDelivery, type Line } from './story'
import { availableMissions, evacuationStages, floodGoal, floodSeconds, floodSpots, packingSeconds, packTasks, scoopsPerSpot, type PackTask } from './missions'
import { listings, rentalReview } from './habitat'
import { rentalReplyDelay } from './DesktopApps'
import { BoatEscape } from './BoatEscape'
import { EvacuationResult } from './EvacuationResult'
import { WaterFill } from './WaterFill'
import type { Action, OfficeTool } from './world'
import './style.css'

type Screen = 'title' | 'levels' | 'role' | 'world'
type World = import('./world').BrambleScene
type Conversation = { lines: Line[]; index: number; next: Stage; intro?: boolean }
type Game = ReturnType<typeof import('./world').createWorld>
const newDream = { scoops: 0, seconds: floodSeconds }
const newPacking = { bags: [] as PackTask[], seconds: packingSeconds }

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
  const [chapterId, setChapterId] = useState<ChapterId>(levels[0].id)
  const [saves, setSaves] = useState<Partial<Record<ChapterId, Save | null>>>(() =>
    Object.fromEntries(levels.map(chapter => [chapter.id, savedChapter(chapter.id)])))
  const [restartSelection, setRestartSelection] = useState<Stage>()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [levelRun, setLevelRun] = useState(0)
  const [filling, setFilling] = useState(false)
  const [transition, setTransition] = useState<'sleep' | 'wake' | null>(null)
  const [dream, setDream] = useState(newDream)
  const [packing, setPacking] = useState(newPacking)
  const lastScoop = useRef(-Infinity)
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
  const dreamRetry = useRef<HTMLButtonElement>(null)
  const world = useRef<World | null>(null)
  const audio = useRef<GameAudio | null>(null)
  const language = settings.language
  const t = (es: string, en: string) => translate(language, [es, en])
  const save = saves[chapterId] ?? null
  const restartChapter = save ? chapterId : levels.find(chapter => saves[chapter.id])?.id
  const restartSave = restartChapter ? saves[restartChapter] : null
  const restartOptions = restartSave ? availableMissions(restartSave.stage, restartSave.unlockedThrough) : undefined
  const restartMissionChoice = restartOptions?.missions.find(mission => mission.stages[0] === restartSelection)
    ?? restartOptions?.missions.find(mission => mission.stages[0] === restartOptions.current)
  const openingRadio = dialogue?.intro === true
  const active = dialogue && !openingRadio ? dialogue.lines[dialogue.index] : null
  const soundOn = settings.sound && settings.volume > 0
  const stage = save?.stage
  const role = save?.role
  const atShore = save?.atShore === true
  const cabinVisit = save?.cabinVisit
  const inOffice = save?.inOffice === true
  const room = save?.room
  const area = stage && areaFor(stage, atShore, cabinVisit, inOffice, room)
  const inside = area === 'inside' || area === 'office' || area === 'cellar' || area === 'bedroom'
  const flooding = stage === 'dreamFlood'
  const storm = stage !== undefined && evacuationStages.includes(stage)
  const ambience = stage === 'credits' ? 'credits' : storm ? 'storm' : undefined
  const packingFailed = stage === 'packing' && packing.seconds === 0
  const playingPacking = screen === 'world' && stage === 'packing' && !dialogue && !settingsOpen && !packingFailed
  const voyage = stage === 'rowing' || stage === 'escaped' || stage === 'credits'
  const review = rentalReview(save?.investigation)
  const dreamFailed = flooding && dream.seconds === 0 && dream.scoops < floodGoal
  const playingDream = screen === 'world' && flooding && !dreamFailed && !dialogue && !settingsOpen && !transition
  const blocked = Boolean(dialogue || settingsOpen || coastView || officeTool || filling || transition || dreamFailed || packingFailed || voyage)
  const blockedRef = useRef(blocked)
  blockedRef.current = blocked

  function setSave(next: SetStateAction<Save | null>) {
    setSaves(previous => ({ ...previous, [chapterId]: typeof next === 'function' ? next(previous[chapterId] ?? null) : next }))
  }

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

  function startFlood() {
    setDream(newDream)
    lastScoop.current = -Infinity
    audio.current?.missionSound('flood')
    setSave(previous => previous && {
      ...previous, stage: 'dreamFlood', atShore: false, room: undefined, cabinVisit: undefined,
    })
    startConversation(floodAlarm, 'dreamFlood')
  }

  function requestRental(id: string) {
    const sentAt = Date.now()
    setSave(previous => previous?.stage === 'evacuation' && !previous.rental
      && listings.some(listing => listing.id === id) && previous.investigation?.habitatChats?.[id]
      ? { ...previous, rental: { id, sentAt } } : previous)
  }

  function startPacking() {
    if (stage !== 'evacuation' || !save?.rental || Date.now() < save.rental.sentAt + rentalReplyDelay) return
    setPacking(newPacking)
    setOfficeTool(undefined)
    sitAtDesk(false)
    setSave(previous => previous && { ...previous, stage: 'packing', cabinVisit: 'inside', inOffice: false, room: undefined })
    startConversation(packingBrief, 'packing')
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
      case 'enterCellar':
      case 'enterBedroom':
      case 'exitCellar':
      case 'exitBedroom':
        audio.current?.missionSound('latch')
        if (current === 'exitBedroom' && stage === 'dreamExit') { startFlood(); break }
        setSave(previous => previous && { ...previous, room: current === 'enterCellar' ? 'cellar' : current === 'enterBedroom' ? 'bedroom' : undefined })
        break
      case 'fillJug': setFilling(true); break
      case 'enterOffice':
      case 'exitOffice':
        setSave(previous => previous && { ...previous, inOffice: current === 'enterOffice' || undefined })
        break
      case 'sitOffice':
        sitAtDesk(true)
        if (stage === 'officeGoal') setSave(previous => previous && { ...previous, stage: 'complete', nightmareSeen: true, atShore: true, cabinVisit: 'inside' })
        break
      case 'standOffice':
        sitAtDesk(false)
        break
      case 'dossier':
        setOfficeTool(current)
        break
      case 'hat': advance('greeting'); break
      case 'greeting': startConversation(greeting, 'seat'); break
      case 'seat': startConversation(dinner, 'radio'); break
      case 'radio': setDialogue({ lines: broadcast, index: 0, next: 'leave', intro: true }); break
      case 'leave': advance('heat'); break
      case 'heat': startConversation(heat, 'adaWater'); break
      case 'adaReturn':
        world.current?.giveJug()
        audio.current?.missionSound('jug')
        startConversation(waterDelivery, 'flood')
        break
      case 'flood': startConversation(flood, 'pier'); break
      case 'pier':
        setSave(previous => previous && {
          ...previous,
          stage: previous.stage === 'pier' ? 'pierSign' : previous.stage,
          atShore: false,
        })
        break
      case 'returnToShore':
        setSave(previous => previous && (previous.stage === 'afterPier'
          ? { ...previous, stage: 'bedtime', atShore: true, cabinVisit: 'outside' }
          : { ...previous, atShore: true }))
        break
      case 'pierSign': setCoastView('sign'); break
      case 'pierCoast':
      case 'complete': setCoastView('coast'); break
      case 'packLuz': case 'packNico': case 'packPartner': case 'packSelf': {
        if (!playingPacking || packing.bags.includes(current) || current === 'packSelf' && packing.bags.length < packTasks.length - 1) break
        const bags = [...packing.bags, current]
        setPacking({ ...packing, bags })
        audio.current?.missionSound('latch')
        if (bags.length === packTasks.length) advance('depart')
        break
      }
      case 'reachEvacPier':
        setSave(previous => previous && { ...previous, stage: 'evacPier', cabinVisit: undefined, room: undefined, atShore: false })
        break
      case 'boardBoat': advance('rowing'); break
      case 'bedtime':
        world.current?.lieDown()
        audio.current?.missionSound('sleep')
        setTransition('sleep')
        break
      case 'dreamFlood': {
        if (!playingDream || performance.now() - lastScoop.current < 420) break
        lastScoop.current = performance.now()
        audio.current?.missionSound('scoop')
        const scoops = dream.scoops + 1
        setDream({ ...dream, scoops })
        if (scoops === floodGoal) setTransition('wake')
        break
      }
      case 'wake': startConversation(wakingUp, 'officeGoal'); break
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
      const scene = new BrambleScene(role, stage, atShore, cabinVisit, current => actRef.current(current), setNearby,
        surface => audio.current?.footstep(surface), inOffice, room)
      scene.paused = blockedRef.current
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

  useEffect(() => { if (stage) world.current?.setStage(stage, atShore, cabinVisit, inOffice, room) }, [stage, atShore, cabinVisit, inOffice, room])
  useEffect(() => {
    if (world.current) world.current.paused = blocked
  }, [blocked])
  useEffect(() => {
    if (!playingDream) return
    const clock = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') setDream(previous => ({ ...previous, seconds: Math.max(0, previous.seconds - 1) }))
    }, 1000)
    return () => window.clearInterval(clock)
  }, [playingDream])
  useEffect(() => { world.current?.setDreamProgress(dream.scoops, dream.seconds) }, [dream])
  useEffect(() => { world.current?.setPacked(packing.bags) }, [packing.bags])
  useEffect(() => {
    if (!playingPacking) return
    const timer = window.setInterval(() => {
      if (!document.hidden) setPacking(current => ({ ...current, seconds: Math.max(0, current.seconds - 1) }))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [playingPacking])
  useEffect(() => {
    if (packingFailed) audio.current?.missionSound('fail')
  }, [packingFailed])
  useEffect(() => {
    if (screen !== 'world' || stage !== 'complete' || settingsOpen || review.done !== review.total) return
    setCoastView(null)
    setOfficeTool(undefined)
    setOfficeSeated(false)
    setSave(previous => previous && { ...previous, stage: 'evacuation', inOffice: false, cabinVisit: 'inside', room: undefined })
    setDialogue({ lines: evacuationBroadcast, index: 0, next: 'evacuation', intro: true })
  }, [screen, stage, settingsOpen, review.done, review.total])
  useEffect(() => {
    if (!dreamFailed) return
    audio.current?.missionSound('fail')
    dreamRetry.current?.focus()
  }, [dreamFailed])
  useEffect(() => {
    if (!transition) return
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const length = transition === 'sleep' ? (reduced ? 1900 : 2700) : (reduced ? 600 : 1600)
    const cut = window.setTimeout(() => {
      setSave(previous => previous && { ...previous, stage: transition === 'sleep' ? 'dreamExit' : 'wake', room: 'bedroom', cabinVisit: undefined })
      if (transition === 'wake') audio.current?.missionSound('wake')
    }, length * .46)
    const finish = window.setTimeout(() => {
      setTransition(null)
      if (transition === 'wake') startConversation(wakingUp, 'officeGoal')
      else {
        audio.current?.childrenCry()
        startConversation(bedroomAlarm, 'dreamExit')
      }
    }, length)
    return () => { window.clearTimeout(cut); window.clearTimeout(finish) }
  }, [transition])
  useEffect(() => {
    for (const chapter of levels) writeLocal(chapterSaveKey(chapter.id), saves[chapter.id] ?? null)
  }, [saves])
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
  useEffect(() => {
    if (playingDream && soundOn) return audio.current?.playFloodMusic()
  }, [playingDream, soundOn])
  useEffect(() => {
    if (screen === 'world' && ambience) return audio.current?.playAmbience(ambience)
  }, [screen, ambience])
  useEffect(() => { heading.current?.focus() }, [screen])
  useEffect(() => {
    if (settingsOpen) options.current?.showModal()
    else options.current?.close()
  }, [settingsOpen])
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
    if (coastView === 'coast' && stage === 'pierCoast') advance('afterPier')
  }

  function chooseRole(value: Role) {
    setSave({ role: value, stage: 'yard' })
    setScreen('world')
  }

  function restartMission() {
    if (!restartChapter || !restartSave || !restartMissionChoice) return
    const stage = restartMissionChoice.stages[0]
    clearScene()
    options.current?.close()
    setSettingsOpen(false)
    setRestartSelection(undefined)
    setSaves(previous => ({ ...previous, [restartChapter]: {
      role: restartSave.role,
      stage,
      room: restartMissionChoice.room,
      unlockedThrough: restartOptions?.missions.at(-1)?.stages[0],
      investigation: stage === 'wake' ? undefined : restartSave.investigation,
      computerGuideComplete: stage === 'wake' ? undefined : restartSave.computerGuideComplete,
    } }))
    if (stage === 'dreamFlood') {
      lastScoop.current = -Infinity
      audio.current?.missionSound('flood')
      startConversation(floodAlarm, 'dreamFlood')
    }
    if (stage === 'wake') startConversation(wakingUp, 'officeGoal')
    if (stage === 'evacuation') setDialogue({ lines: evacuationBroadcast, index: 0, next: 'evacuation', intro: true })
    setChapterId(restartChapter)
    setLevelRun(run => run + 1)
    setScreen('world')
  }

  function restartGame() {
    clearScene()
    options.current?.close()
    setSettingsOpen(false)
    setSaves({})
    setRestartSelection(undefined)
    setChapterId(levels[0].id)
    setScreen('levels')
  }

  function clearScene() {
    setDialogue(null)
    setFilling(false)
    setTransition(null)
    setDream(newDream)
    setPacking(newPacking)
    setCoastView(null)
    setOfficeTool(undefined)
    setOfficeSeated(false)
    setNearby(null)
  }

  function toLevels() {
    clearScene()
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

  const level = levels.find(chapter => chapter.id === chapterId) ?? levels[0]
  const place = area === 'office' ? t('La oficina', 'The office')
    : area === 'bedroom' ? t('El dormitorio', 'The bedroom')
    : area === 'cellar' ? t('El sótano', 'The cellar')
    : area === 'inside' ? t('La cabaña', 'The cabin')
    : area === 'pier' ? t('El muelle', 'The pier') : t('El poblado', 'The village')
  const objective = stage && (stage === 'evacuation' || stage === 'packing' || stage === 'depart' || stage === 'evacPier'
    ? translate(language, objectives[stage]) : area === 'office' && stage !== 'officeGoal'
    ? t('Siéntate para usar el PC o el cuaderno. El expediente está en la estantería.', 'Sit down to use the computer or notebook. The dossier is on the bookshelf.')
    : area === 'bedroom' && stage === 'bedtime'
    ? t('Acércate al pie de la cama y acuéstate junto a tu pareja.', 'Walk to the foot of the bed and get in beside your partner.')
    : area === 'cellar' && stage === 'adaWater'
    ? t('Acércate a la llave del depósito para llenar el bidón.', 'Walk to the cistern tap to fill the jug.')
    : area === 'inside' && ['bedtime', 'wake'].includes(stage)
    ? t('La puerta del dormitorio está al fondo, a la izquierda de la oficina.', 'The bedroom door is at the back, left of the office.')
    : area === 'inside' && cabinVisit === 'inside' && isPierStage(stage)
    ? t('La oficina está al fondo de la cabaña.', 'The office is at the back of the cabin.')
    : area === 'yard' && isPierStage(stage)
    ? translate(language, objectives.pier)
    : translate(language, objectives[stage]))
  return <main className={screen === 'world' ? 'app game' : 'app menu'} onPointerDown={enableAudio} onKeyDown={event => {
    enableAudio()
    if (!officeSeated || officeTool || settingsOpen || event.repeat) return
    if (event.key === '1') openDeskTool('computer')
    if (event.key === '2') openDeskTool('notebook')
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
        {levels.map(chapter => <button key={chapter.id} className="level-card" onClick={() => {
          audio.current?.click()
          setChapterId(chapter.id)
          setScreen(saves[chapter.id] ? 'world' : 'role')
        }}>
          <span className="card-art"><img src={asset('art/father-portrait.png')} alt="" /></span>
          <span className="card-body">
            <strong>{language === 'es' ? 'Melomys de Bramble Cay' : 'Bramble Cay melomys'}</strong>
            <em>{chapter.species}</em>
            <span className="start-label">{saves[chapter.id] ? t('Continuar', 'Continue') : t('Comenzar', 'Begin')} <span aria-hidden="true">↗</span></span>
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
        <span className="location">{level.chapter[language]} <span aria-hidden="true">/</span> {place}</span>
        <button className="back options" onClick={() => setSettingsOpen(true)}>{t('Configuración', 'Settings')}</button>
      </header>
      <div className="viewport" data-area={area} data-voyage={voyage}>
        <div key={levelRun} className="canvas" ref={mount} aria-label={place} />
        {storm && stage !== 'rowing' && <div className="evac-weather" data-outside={area === 'yard' || area === 'pier'} aria-hidden="true" />}
        {loadFailed && <p role="alert" className="loading">{t('No se pudo cargar la escena.', 'Could not load the scene.')}</p>}
        {!blocked && !officeSeated && !flooding && stage !== 'packing' && <p className="objective" aria-live="polite">{objective}</p>}
        {stage === 'packing' && !dialogue && !packingFailed && <section className="flood-hud packing-hud" data-urgent={packing.seconds <= 8}>
          <div><strong>{packing.bags.length === 3 ? t('Ahora prepara tu maleta', 'Now pack your bag') : t('Ayuda a empacar a tu familia', 'Help your family pack')}</strong>
            <span role="status">{t('Maletas listas', 'Bags ready')} {packing.bags.length}/{packTasks.length}</span></div>
          <span role="timer" aria-label={t('Segundos restantes', 'Seconds remaining')}>{packing.seconds}<small> s</small></span>
        </section>}
        {flooding && !dialogue && !dreamFailed && !transition && <section className="flood-hud" data-urgent={dream.seconds <= 8} aria-label={t('Sacar el agua', 'Bail out the water')}>
          <div><strong>{t('Saca el agua de la cocina', 'Bail water out of the kitchen')}</strong>
            <span role="status">{t('Puntos despejados', 'Spots cleared')} {Math.floor(dream.scoops / scoopsPerSpot)}/{floodSpots.length}
              {dream.scoops % scoopsPerSpot === 1 && t(' · Falta una cubetada aquí', ' · One more bucket here')}</span></div>
          <span role="timer" aria-label={t('Segundos restantes', 'Seconds remaining')}>{dream.seconds}<small> s</small></span>
        </section>}
        {nearby && !blocked && !officeSeated && <button className="prompt" onClick={() => world.current?.interact()}><kbd>E</kbd> {translate(language, nearby)}</button>}
        {officeSeated && !officeTool && <nav className="desk-actions" aria-label={t('Escritorio', 'Desk')}>
          <button ref={deskControl} onClick={() => openDeskTool('computer')}><kbd>1</kbd> {t('Ver el PC', 'View computer')}</button>
          <button onClick={() => openDeskTool('notebook')}><kbd>2</kbd> {t('Abrir el cuaderno', 'Open the notebook')}</button>
          <button onClick={() => sitAtDesk(false)}><kbd>E</kbd> {t('Levantarse', 'Stand up')}</button>
        </nav>}
        <span className="dialogue-reader" role="status">{active && translate(language, active.text)}</span>
        {active && dialogue && <DialogueBox key={language + ':' + dialogue.index} name={speaker(active)} portrait={portrait(active)}
          text={translate(language, active.text)} radio={active.speaker === 'radio'} paused={settingsOpen}
          language={language} audio={audio} onNext={nextLine} />}
        {coastView && <CoastView key={coastView} view={coastView} language={language} onClose={closeCoast} />}
        {filling && <WaterFill language={language} paused={settingsOpen} onStroke={inZone => {
          world.current?.pumpWater(inZone)
          audio.current?.missionSound(inZone ? 'pour' : 'pump')
        }}
          onFilled={() => { audio.current?.missionSound('jug'); setFilling(false); advance('adaReturn') }} />}
        {transition && <div className="sleep-cut" data-kind={transition}>
          <span aria-hidden="true" /><span aria-hidden="true" />
          {transition === 'sleep' && <p role="status">{t('Te quedas dormido…', 'You drift off to sleep…')}</p>}
        </div>}
        {officeTool && <OfficePanel tool={officeTool} language={language} role={save.role}
          onComputerClick={() => audio.current?.mouseClick()}
          onHostReply={() => audio.current?.rentalReply()}
          rental={save.rental} onRent={requestRental} onPack={startPacking}
          computerGuideComplete={save.computerGuideComplete === true}
          onComputerGuideComplete={() => setSave(previous => previous && { ...previous, computerGuideComplete: true })}
          progress={save.investigation ?? emptyInvestigation} stage={save.stage}
          onChange={investigation => setSave(previous => previous && { ...previous, investigation })}
          onClose={() => setOfficeTool(undefined)} />}
        {dreamFailed && <article className="end-card dream-failure" role="alertdialog" aria-labelledby="dream-failure-title">
          <h2 id="dream-failure-title">{t('Tu casa se inundó', 'Your home flooded')}</h2>
          <p>{t('No lograste proteger a tu familia.', 'You couldn’t protect your family.')}</p>
          <button className="primary" ref={dreamRetry} onClick={() => { startFlood(); setLevelRun(run => run + 1) }}>{t('Reintentar', 'Try again')}</button>
        </article>}
        {packingFailed && <article className="end-card" role="alertdialog" aria-labelledby="packing-failure-title">
          <h2 id="packing-failure-title">{t('Se acabó el tiempo', 'Time ran out')}</h2>
          <p>{t('Todavía faltan maletas. Intenta de nuevo antes de salir al muelle.', 'Some bags still need packing. Try again before heading to the pier.')}</p>
          <button className="primary" onClick={() => { setPacking(newPacking); setLevelRun(run => run + 1) }}>{t('Reintentar', 'Try again')}</button>
        </article>}
        {stage === 'rowing' && <BoatEscape language={language} role={save.role} paused={settingsOpen}
          onStroke={good => audio.current?.missionSound(good ? 'row' : 'fail')} onSuccess={() => advance('escaped')} />}
        {(stage === 'escaped' || stage === 'credits') && <EvacuationResult language={language} stage={stage} rentalId={save.rental?.id} paused={settingsOpen}
          onPageTurn={() => audio.current?.openDeskTool('notebook')}
          onAnswer={correct => correct ? audio.current?.rentalReply() : audio.current?.click()}
          onContinue={() => stage === 'escaped' ? advance('credits') : toLevels()} />}
      </div>
      <footer className="controls">
        {!officeSeated && !filling && !transition && !dreamFailed && !packingFailed && !voyage && <>
          <span className="key-controls">{t('Moverse', 'Move')} <kbd>W A S D</kbd> <kbd>↑ ↓ ← →</kbd> <span>{t('Interactuar', 'Interact')}</span> <kbd>E</kbd></span>
          <span className="touch-controls">{t('Toca el suelo para caminar.', 'Tap the ground to walk.')}</span>
        </>}
        {!blocked && !officeSeated && <div className="dpad" aria-label={t('Moverse', 'Move')}>
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
      {restartSave && <section className="progress-settings" aria-labelledby="progress-settings-title">
        <h3 id="progress-settings-title">{t('Progreso de la partida', 'Game progress')}</h3>
        <label className="setting-row">
          {t('Misión para reiniciar', 'Mission to restart')}
          <select value={restartMissionChoice?.stages[0]} onChange={event => setRestartSelection(event.target.value as Stage)}>
            {restartOptions?.missions.map(mission => <option key={mission.stages[0]} value={mission.stages[0]}>{translate(language, mission.name)}</option>)}
          </select>
        </label>
        <button className="quiet" onClick={restartMission}>{t('Reiniciar misión', 'Restart mission')}</button>
        <p>{t('Vuelve al comienzo de la misión elegida con tu mismo personaje.', 'Return to the start of the selected mission with your current character.')}</p>
        {restartMissionChoice?.stages[0] === 'wake' && <p>{t('Reiniciar la oficina borra sus consultas, chats y notas guardadas.', 'Restarting the office clears its saved requests, chats and notes.')}</p>}
        <button className="quiet" onClick={restartGame}>{t('Reiniciar todo', 'Reset all progress')}</button>
        <p>{t('Borra el progreso de todas las misiones. Conserva tu idioma y audio.', 'Clear all mission progress while keeping your language and audio settings.')}</p>
      </section>}
      <button className="primary" onClick={() => setSettingsOpen(false)}>{t('Volver', 'Back')} <span aria-hidden="true">↵</span></button>
    </dialog>
  </main>
}

createRoot(document.getElementById('root')!).render(<App />)
