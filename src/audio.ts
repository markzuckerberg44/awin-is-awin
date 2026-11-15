import { asset, type Settings } from './config'

export type FootstepSurface = 'wood' | 'sand' | 'stone' | 'water'
type Ambience = 'storm' | 'credits'

export class GameAudio {
  private shore = new Audio(asset('audio/shore.m4a'))
  private radioIntro = new Audio(asset('audio/radio-intro.m4a'))
  private paper = new Audio(asset('audio/notebook-open.wav'))
  private powerOn = new Audio(asset('audio/pc-power-on.wav'))
  private pcClick = new Audio(asset('audio/pc-mouse-click.wav'))
  private floodMusic = new Audio(asset('audio/flood-rush.wav'))
  private ambienceTracks = {
    storm: new Audio(asset('audio/evacuation-storm.wav')),
    credits: new Audio(asset('audio/credits-theme.m4a')),
  }
  private footsteps = {
    wood: new Audio(asset('audio/step-wood.wav')),
    sand: new Audio(asset('audio/step-sand.wav')),
  }
  private context?: AudioContext
  private noiseBuffer?: AudioBuffer
  private enabled = false
  private volume = 0
  private indoors = false
  private started = false
  private ambience?: Ambience

  constructor() {
    this.shore.loop = true
    this.shore.preload = 'auto'
    this.floodMusic.loop = true
    for (const track of Object.values(this.ambienceTracks)) track.loop = true
    this.ambienceTracks.credits.preload = 'none'
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
    this.mixAmbience()
    this.radioIntro.volume = this.volume
    this.paper.volume = this.volume
    this.powerOn.volume = this.volume
    this.pcClick.volume = this.volume * .65
    this.floodMusic.volume = this.volume * .43
    this.syncAmbience()
    for (const sound of Object.values(this.footsteps)) {
      sound.volume = this.volume * .7
      if (!this.enabled) sound.pause()
    }
    if (!this.enabled) {
      this.shore.pause()
      this.radioIntro.pause()
      this.paper.pause()
      this.powerOn.pause()
      this.pcClick.pause()
      this.floodMusic.pause()
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

  playFloodMusic() {
    return this.playWhileVisible(this.floodMusic)
  }

  playAmbience(kind: Ambience) {
    this.ambience = kind
    if (kind === 'credits') this.ambienceTracks.credits.currentTime = 0
    this.mixAmbience()
    this.syncAmbience()
    document.addEventListener('visibilitychange', this.syncAmbience)
    return () => {
      document.removeEventListener('visibilitychange', this.syncAmbience)
      this.ambience = undefined
      this.mixAmbience()
      this.syncAmbience()
    }
  }

  private mixAmbience() {
    this.shore.volume = this.volume * (this.ambience === 'credits' ? 0 : this.ambience === 'storm' ? .10 : this.indoors ? .32 : .8)
    this.ambienceTracks.storm.volume = this.volume * (this.indoors ? .85 : 1)
    this.ambienceTracks.credits.volume = this.volume * .55
  }

  private syncAmbience = () => {
    for (const [kind, track] of Object.entries(this.ambienceTracks)) {
      if (kind !== this.ambience || !this.enabled || this.volume === 0 || document.hidden) track.pause()
      else if (track.paused) void track.play().catch(() => {})
    }
  }

  private playWhileVisible(track: HTMLAudioElement) {
    const sync = () => {
      if (document.hidden) track.pause()
      else void track.play().catch(() => {})
    }
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => {
      document.removeEventListener('visibilitychange', sync)
      track.pause()
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

  mouseClick() {
    if (!this.enabled || !this.volume) return
    this.pcClick.currentTime = 0
    void this.pcClick.play().catch(() => {})
  }

  rentalReply() {
    this.tone(585, 650, .13, .11, 'sine')
    this.tone(785, 875, .18, .08, 'sine', .1)
  }

  footstep(surface: FootstepSurface) {
    if (!this.enabled || !this.volume) return
    if (surface === 'stone' || surface === 'water') {
      this.noise(surface === 'water' ? 1150 : 490, .13, .19)
      return
    }
    const sound = this.footsteps[surface]
    sound.currentTime = 0
    void sound.play().catch(() => {})
  }

  squeak(letter: number) {
    const pitch = 1030 + (letter % 5) * 47
    this.tone(pitch, pitch * 1.34, .027, .055, 'triangle')
  }

  childrenCry() {
    this.tone(580, 1390, .29, .3, 'triangle')
    this.tone(1400, 755, .3, .23, 'triangle', .19)
    this.tone(440, 1130, .40, .29, 'triangle', .42)
    this.tone(1070, 535, .21, .19, 'triangle', .66)
  }

  missionSound(cue: 'latch' | 'pump' | 'pour' | 'jug' | 'sleep' | 'scoop' | 'row' | 'flood' | 'wake' | 'fail' | 'stamp') {
    switch (cue) {
      case 'latch': this.tone(164, 73, .12, .13, 'triangle'); this.noise(520, .15, .16); break
      case 'stamp': this.tone(146, 68, .095, .22, 'triangle'); this.noise(730, .11, .13); break
      case 'pump': this.noise(1500, .24, .27); break
      case 'pour': this.noise(2350, .42, .36); this.tone(190, 320, .16, .07, 'sine'); break
      case 'jug': this.tone(357, 541, .24, .12, 'triangle'); break
      case 'sleep': this.noise(680, .48, .2); break
      case 'scoop': this.noise(1400, .39, .4); this.tone(173, 85, .14, .08, 'sine'); break
      case 'row':
        this.noise(1750, .22, .37)
        this.tone(659, 690, .085, .21, 'triangle')
        this.tone(988, 1020, .13, .18, 'triangle', .058)
        break
      case 'flood': this.noise(720, 1.4, .48); break
      case 'wake': this.tone(98, 174, .27, .18, 'sine'); break
      case 'fail': this.tone(202, 77, .52, .13, 'triangle'); break
    }
  }

  private noise(frequency: number, duration: number, volume: number) {
    const ctx = this.context
    if (!this.enabled || !this.volume || ctx?.state !== 'running') return
    if (!this.noiseBuffer) {
      this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
      const samples = this.noiseBuffer.getChannelData(0)
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1
    }
    const stream = ctx.createBufferSource()
    stream.buffer = this.noiseBuffer
    const band = ctx.createBiquadFilter()
    const gain = ctx.createGain()
    const time = ctx.currentTime
    band.type = 'bandpass'
    band.Q.value = .64
    band.frequency.setValueAtTime(frequency, time)
    band.frequency.exponentialRampToValueAtTime(frequency * .56, time + duration)
    gain.gain.setValueAtTime(0, time)
    gain.gain.linearRampToValueAtTime(volume * this.volume, time + .04)
    gain.gain.exponentialRampToValueAtTime(.001, time + duration)
    stream.connect(band).connect(gain).connect(ctx.destination)
    stream.start(time)
    stream.stop(time + duration)
  }

  private tone(from: number, to: number, duration: number, volume: number, shape: OscillatorType, delay = 0) {
    const ctx = this.context
    if (!this.enabled || !this.volume || ctx?.state !== 'running') return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const time = ctx.currentTime + delay
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
