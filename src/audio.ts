import { asset, type Settings } from './config'

export class GameAudio {
  private shore = new Audio(asset('audio/shore.m4a'))
  private radioIntro = new Audio(asset('audio/radio-intro.m4a'))
  private paper = new Audio(asset('audio/notebook-open.wav'))
  private powerOn = new Audio(asset('audio/pc-power-on.wav'))
  private context?: AudioContext
  private enabled = false
  private volume = 0
  private indoors = false
  private started = false

  constructor() {
    this.shore.loop = true
    this.shore.preload = 'auto'
  }

  start() {
    if (this.enabled && this.volume) {
      this.context ??= new AudioContext()
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {})
    }
    if (this.started) return
    this.started = true
    if (this.enabled) void this.shore.play().catch(() => { this.started = false })
  }

  configure(settings: Settings, indoors: boolean) {
    const wasEnabled = this.enabled
    this.enabled = settings.sound
    this.volume = settings.volume
    this.indoors = indoors
    this.shore.volume = this.volume * (this.indoors ? .32 : .8)
    this.radioIntro.volume = this.volume
    this.paper.volume = this.volume
    this.powerOn.volume = this.volume
    if (!this.enabled) {
      this.shore.pause()
      this.radioIntro.pause()
      this.paper.pause()
      this.powerOn.pause()
    } else if (this.started && !wasEnabled) void this.shore.play().catch(() => { this.started = false })
  }

  playRadioIntro(onEnd: () => void) {
    const intro = this.radioIntro
    let active = true
    const finish = () => { if (active) onEnd() }
    intro.currentTime = 0
    intro.addEventListener('ended', finish)
    intro.addEventListener('error', finish)
    void intro.play().catch(finish)
    return () => {
      active = false
      intro.pause()
      intro.removeEventListener('ended', finish)
      intro.removeEventListener('error', finish)
    }
  }

  click() {
    this.tone(430, 275, .1, .09, 'sine')
  }

  openDeskTool(tool: 'computer' | 'notebook') {
    if (!this.enabled || !this.volume) return
    const sound = tool === 'computer' ? this.powerOn : this.paper
    sound.currentTime = 0
    void sound.play().catch(() => {})
  }

  squeak(letter: number) {
    const pitch = 1030 + (letter % 5) * 47
    this.tone(pitch, pitch * 1.34, .027, .055, 'triangle')
  }

  private tone(from: number, to: number, duration: number, volume: number, shape: OscillatorType) {
    const ctx = this.context
    if (!this.enabled || !this.volume || ctx?.state !== 'running') return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const time = ctx.currentTime
    osc.type = shape
    osc.frequency.setValueAtTime(from, time)
    osc.frequency.exponentialRampToValueAtTime(to, time + duration * .8)
    gain.gain.setValueAtTime(0, time)
    gain.gain.linearRampToValueAtTime(volume * this.volume, time + .004)
    gain.gain.linearRampToValueAtTime(0, time + duration)
    osc.connect(gain).connect(ctx.destination)
    osc.start(time)
    osc.stop(time + duration)
  }
}
