import Phaser from 'phaser'
import { areaFor, asset, type Labels, type Role, type Save, type Stage } from './config'

type Point = { x: number; y: number }
type Input = { x: number; y: number }
const directions = ['down', 'left', 'right', 'up'] as const
type Direction = typeof directions[number]
const characters = ['mother', 'father', 'luz', 'nico', 'ada', 'eli']
const scenery = ['home', 'house-red', 'house-green', 'room', 'cabin-back-chairs', 'cabin-table', 'cabin-chairs', 'cabin-play-rug', 'cabin-reading-book', 'hat', 'rack', 'radio', 'tank', 'tiles', 'pier', 'shore-sign', 'boat-green', 'boat-red', 'office-door', 'office-room', 'office-desk', 'office-chair', 'office-shelf', 'office-plant', 'office-cabinet']
const framesPerDirection = (name: string) => name === 'father' ? 8 : 4
const firstFrame = (name: string, direction: Direction) => directions.indexOf(direction) * framesPerDirection(name)
export type OfficeTool = 'computer' | 'notebook' | 'dossier'
export type Action = Stage | 'returnToShore' | 'enterCabin' | 'exitCabin' | 'enterOffice' | 'exitOffice' | 'sitOffice' | 'dossier'
const actions: Record<Action, Labels> = {
  yard: ['Entrar a casa', 'Go inside'],
  hat: ['Colgar sombrero', 'Hang up hat'],
  greeting: ['Saludar', 'Say hello'],
  seat: ['Sentarse', 'Sit down'],
  radio: ['Escuchar la radio', 'Listen to the radio'],
  leave: ['Salir al patio', 'Go outside'],
  heat: ['Hablar con Ada', 'Talk to Ada'],
  flood: ['Hablar con Eli', 'Talk to Eli'],
  pier: ['Ir al muelle', 'Go to the pier'],
  pierSign: ['Ver el cartel', 'View the sign'],
  pierCoast: ['Ver la costa', 'Look at the coast'],
  complete: ['Ver la costa', 'Look at the coast'],
  returnToShore: ['Volver a la orilla', 'Return to shore'],
  enterCabin: ['Entrar a casa', 'Go inside'],
  exitCabin: ['Salir al patio', 'Go outside'],
  enterOffice: ['Entrar a la oficina', 'Enter the office'],
  exitOffice: ['Volver a la cabaña', 'Return to the cabin'],
  sitOffice: ['Sentarse en la silla', 'Sit in the chair'],
  dossier: ['Revisar el expediente', 'Review the dossier'],
}
const otherRole = (role: Role) => role === 'mother' ? 'father' : 'mother'
type FamilyStop = readonly [x: number, y: number, facing: Direction, time: number]
const readingRoute: FamilyStop[] = [
  [188, 124, 'down', 0], [151, 124, 'left', 550], [151, 199, 'down', 1550],
  [122, 199, 'left', 2000], [122, 226, 'down', 2460],
]
const luzToRug: FamilyStop[] = [
  [225, 124, 'down', 0], [257, 124, 'right', 440], [257, 205, 'down', 1550],
  [231, 205, 'left', 1940], [231, 218, 'down', 2180],
]
const nicoToRug: FamilyStop[] = [
  [278, 163, 'up', 0], [277, 201, 'down', 540], [250, 218, 'left', 1050],
]
const luzPlaying: FamilyStop[] = [
  [231, 218, 'down', 0], [231, 218, 'down', 1600], [231, 230, 'down', 1900],
  [239, 230, 'right', 2120], [239, 230, 'up', 3900], [231, 230, 'left', 4140],
  [231, 218, 'up', 4490], [231, 218, 'down', 5200],
]
const nicoPlaying: FamilyStop[] = [
  [250, 218, 'left', 0], [250, 218, 'left', 2550], [256, 230, 'down', 2900],
  [256, 230, 'up', 4450], [250, 218, 'up', 4800], [250, 218, 'left', 5300],
]

export class BrambleScene extends Phaser.Scene {
  private stage: Stage
  private role: Role
  private area!: ReturnType<typeof areaFor>
  private player!: Phaser.GameObjects.Sprite
  private family!: Record<string, Phaser.GameObjects.Sprite>
  private hat!: Phaser.GameObjects.Image
  private readingBook?: Phaser.GameObjects.Image
  private familyTime = 0
  private marker!: Phaser.GameObjects.Graphics
  private direction: Direction = 'up'
  private keys!: Record<string, Phaser.Input.Keyboard.Key>
  private points!: Record<string, Point>
  private walls: Phaser.Geom.Rectangle[] = []
  private reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
  private locked = false
  private nearby: Action | null = null
  private enteringPier = false
  private usingCabinDoor = false
  private returningFromOffice = false
  private running = false
  private destination: Point | null = null
  private officeSeated = false
  private manual: Input = { x: 0, y: 0 }
  paused = false

  constructor(
    role: Role,
    stage: Stage,
    private atShore: boolean,
    private cabinVisit: Save['cabinVisit'],
    private onAction: (action: Action) => void,
    private onProximity: (label: Labels | null) => void,
    private inOffice = false,
  ) {
    super('bramble')
    this.role = role
    this.stage = stage
  }

  preload() {
    for (const name of scenery) this.load.image(name, asset('art/' + name + '.png'))
    for (const name of characters) this.load.spritesheet(name, asset('art/' + name + '.png'), { frameWidth: name === 'ada' || name === 'eli' ? 16 : 32, frameHeight: 32 })
    this.load.tilemapTiledJSON('yard', asset('art/yard.tmj'))
    this.load.tilemapTiledJSON('inside', asset('art/inside.tmj'))
    this.load.tilemapTiledJSON('pier', asset('art/pier.tmj'))
    this.load.tilemapTiledJSON('office', asset('art/office.tmj'))
  }

  create() {
    this.running = false
    this.locked = false
    this.nearby = null
    this.destination = null
    this.officeSeated = false
    this.manual = { x: 0, y: 0 }
    this.onProximity(null)
    this.area = areaFor(this.stage, this.atShore, this.cabinVisit, this.inOffice)
    this.cameras.main.setRoundPixels(true)
    const map = this.make.tilemap({ key: this.area })
    const tiles = map.addTilesetImage('island', 'tiles')
    if (tiles && (this.area === 'yard' || this.area === 'pier')) map.createLayer('Ground', tiles, 0, 0, false)
    this.points = Object.fromEntries((map.getObjectLayer('Interactions')?.objects ?? [])
      .map(obj => [obj.name, { x: obj.x ?? 0, y: obj.y ?? 0 }]))
    this.walls = (map.getObjectLayer('Collision')?.objects ?? [])
      .map(obj => new Phaser.Geom.Rectangle(obj.x ?? 0, obj.y ?? 0, obj.width ?? 0, obj.height ?? 0))
    for (const name of characters) {
      for (const facing of directions) {
        const key = name + '-' + facing
        if (this.anims.exists(key)) continue
        const start = firstFrame(name, facing)
        this.anims.create({ key, frames: this.anims.generateFrameNumbers(name, { start, end: start + framesPerDirection(name) - 1 }), frameRate: name === 'father' ? 12 : 9, repeat: -1 })
      }
    }
    this.family = {}
    this.readingBook = undefined
    this.familyTime = 0
    if (this.area === 'yard') this.buildYard()
    else if (this.area === 'pier') this.buildPier()
    else if (this.area === 'office') this.buildOffice()
    else this.buildInterior()
    const spawn = this.area === 'yard'
      ? this.usingCabinDoor || this.cabinVisit === 'outside' ? { x: 200, y: 150 }
        : this.stage === 'yard' ? { x: 200, y: 216 }
        : this.stage === 'pier' || this.atShore ? { x: 342, y: 188 }
        : { x: 200, y: 146 }
      : this.area === 'pier'
        ? this.stage === 'pierSign' || this.enteringPier ? { x: 200, y: 228 } : { x: 257, y: 106 }
        : this.area === 'office' ? { x: 201, y: 222 }
        : this.returningFromOffice ? { x: 278, y: 76 }
        : this.usingCabinDoor || this.cabinVisit === 'inside' || this.stage === 'hat' ? { x: 200, y: 226 }
        : this.stage === 'greeting' ? { x: 181, y: 218 } : { x: 204, y: 202 }
    this.usingCabinDoor = false
    this.returningFromOffice = false
    this.player = this.person(this.role, spawn.x, spawn.y, 'up')
    this.direction = 'up'
    this.hat = this.add.image(0, 0, 'hat').setVisible(false)
    this.marker = this.add.graphics().setDepth(300)
    this.keys = this.input.keyboard!.addKeys({
      up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT',
      w: 'W', s: 'S', a: 'A', d: 'D', act: 'E',
    }) as typeof this.keys
    this.input.on('pointerdown', this.onPointer, this)
    this.events.once('shutdown', () => {
      this.running = false
      this.input.off('pointerdown', this.onPointer, this)
    })
    this.running = true
    if (!this.reducedMotion) this.cameras.main.fadeIn(360, 21, 26, 28)
  }

  private prop(name: string, x: number, y: number, depth: number) {
    return this.add.image(x, y, name).setOrigin(0, 0).setDepth(depth)
  }

  private person(name: string, x: number, y: number, facing: Direction) {
    return this.add.sprite(x, y, name, firstFrame(name, facing)).setOrigin(.5, 30 / 32).setDepth(y)
  }

  private buildYard() {
    const detail = this.add.graphics()
    detail.fillStyle(0xeed6a0)
    detail.fillRect(36, 32, 328, 1)
    detail.fillRect(39, 224, 321, 1)
    detail.fillStyle(0x73a89b)
    for (let i = 0; i < 42; i++) {
      const x = (i * 79 + 11) % 392
      detail.fillRect(x, i % 2 ? 8 + i % 13 : 236 + i % 15, 3 + i % 6, 1)
    }
    for (const [x, y] of [[26,173],[116,186],[151,167],[234,204],[367,174],[103,206],[280,195],[250,158],[352,203],[55,210],[308,210],[134,221],[276,152]]) {
      detail.fillStyle(0x7e8251)
      detail.fillRect(x, y, 5, 2)
      detail.fillRect(x, y-3, 1, 3)
      detail.fillRect(x+4, y-5, 1, 5)
      detail.fillStyle(0xe3c987)
      detail.fillRect(x+4, y-6, 2, 1)
    }
    for (const [x, y] of [[8,68],[96,132],[333,213],[257,168],[131,156],[270,201]]) {
      detail.fillStyle(0xc7a473)
      detail.fillRect(x, y, 4, 2)
      detail.fillStyle(0xf1d6a5)
      detail.fillRect(x, y, 3, 1)
    }
    this.prop('house-red', 0, 22, 122)
    this.prop('home', 128, 30, 135)
    this.prop('house-green', 255, 24, 123)
    this.prop('tank', 32, 127, 155)
    const pier = this.points.pier
    this.prop('pier', pier.x - 16, pier.y - 3, 2)
    this.family.ada = this.person('ada', 72, 151, 'down')
    this.family.eli = this.person('eli', 326, 152, 'down')
  }

  private buildPier() {
    const detail = this.add.graphics().setDepth(1)
    detail.lineStyle(2, 0x7b4937)
    detail.strokeRect(113, 81, 174, 30)
    detail.strokeRect(177, 65, 46, 159)
    detail.lineStyle(1, 0xe6aa64)
    detail.lineBetween(114, 82, 286, 82)
    detail.lineBetween(178, 66, 222, 66)
    for (const [x, y] of [[141, 134], [240, 143], [91, 43]]) {
      const left = x < 200
      this.prop(left ? 'boat-green' : 'boat-red', x - 24, y - 19, 2)
      const postX = y < 60 ? 115 : left ? 176 : 224
      const postY = y < 60 ? 85 : 109
      detail.lineStyle(1, 0xffdea4)
      detail.lineBetween(postX, postY, x, y - 14)
      detail.fillStyle(0x7b4937).fillRect(postX - 2, postY - 3, 5, 6)
      detail.fillStyle(0xe6aa64).fillRect(postX - 2, postY - 3, 5, 2)
    }
    this.prop('shore-sign', 259, 81, 101)
  }

  private buildInterior() {
    this.prop('room', 72, 0, 1)
    this.prop('office-door', 262, 5, 57)
    this.prop('cabin-back-chairs', 162, 95, 115)
    this.prop('cabin-table', 162, 95, 153)
    this.prop('cabin-chairs', 162, 154, 181)
    this.prop('rack', 137, 185, 226)
    this.prop('radio', 264, 128, 158)
    this.prop('cabin-play-rug', 222, 213, 2)
    this.readingBook = this.add.image(122, 212, 'cabin-reading-book').setDepth(227).setVisible(false)
    if (!this.textures.get('cabin-reading-book').has('page')) {
      const texture = this.textures.get('cabin-reading-book')
      texture.add('open', 0, 0, 0, 14, 9)
      texture.add('page', 0, 14, 0, 14, 9)
    }
    this.family.partner = this.person(otherRole(this.role), 188, 124, 'down')
    const early = this.stage === 'hat' || this.stage === 'greeting'
    this.family.luz = this.person('luz', early ? 280 : 225, early ? 169 : 124, early ? 'left' : 'down')
    this.family.nico = this.stage === 'radio' ? this.person('nico', 278, 163, 'up')
      : this.person('nico', early ? 272 : 226, early ? 192 : 184, early ? 'left' : 'up')
    if (this.stage === 'greeting') this.positionChildren()
    if (this.stage === 'leave' || this.cabinVisit === 'inside') {
      this.familyTime = 2460
      this.updateFamily(0)
    }
  }

  private buildOffice() {
    this.prop('office-room', 72, 24, 1)
    this.prop('office-desk', 168, 93, 146)
    this.prop('office-chair', 187, 148, 169)
    this.prop('office-shelf', 275, 72, 135)
    this.prop('office-plant', 89, 169, 231)
    this.prop('office-cabinet', 288, 177, 231)
  }

  private positionChildren() {
    this.family.luz.setPosition(216, 204).setDepth(204).setFrame(4)
    this.family.nico.setPosition(238, 209).setDepth(209).setFrame(4)
  }

  setStage(stage: Stage, atShore: boolean, cabinVisit: Save['cabinVisit'], inOffice = false) {
    const previous = this.stage
    if (previous === stage && this.atShore === atShore && this.cabinVisit === cabinVisit && this.inOffice === inOffice) return
    this.returningFromOffice = this.inOffice && !inOffice
    this.inOffice = inOffice
    this.usingCabinDoor = this.cabinVisit !== cabinVisit || previous === 'leave' && stage === 'heat'
    this.enteringPier = this.atShore && !atShore
    this.stage = stage
    this.atShore = atShore
    this.cabinVisit = cabinVisit
    this.nearby = null
    this.destination = null
    this.onProximity(null)
    if (!this.running) return
    if (areaFor(stage, atShore, cabinVisit, inOffice) !== this.area) {
      this.scene.restart()
      return
    }
    if (stage === 'greeting') {
      this.walkActors([
        { actor: this.family.luz, x: 216, y: 204, facing: 'left' },
        { actor: this.family.nico, x: 238, y: 209, facing: 'left' },
      ], 520, () => this.positionChildren())
    }
    if (stage === 'seat') {
      this.walkActors([
        { actor: this.family.luz, x: 257, y: 204, facing: 'right' },
        { actor: this.family.nico, x: 226, y: 184, facing: 'up' },
      ], 320, () => this.walkActors([{ actor: this.family.luz, x: 257, y: 124, facing: 'up' }], 520, () =>
        this.walkActors([{ actor: this.family.luz, x: 225, y: 124, facing: 'left' }], 260, () => this.family.luz.setFrame(0))))
    }
    if (stage === 'radio') {
      this.walkActors([{ actor: this.family.nico, x: 278, y: 185, facing: 'right' }], 480, () =>
        this.walkActors([{ actor: this.family.nico, x: 278, y: 163, facing: 'up' }], 300, () => this.onAction('radio')))
    }
  }

  private walkActors(actors: { actor: Phaser.GameObjects.Sprite; x: number; y: number; facing: Direction }[], duration: number, done: () => void) {
    this.locked = true
    let remaining = actors.length
    for (const { actor, x, y, facing } of actors) {
      if (!this.reducedMotion) actor.play(actor.texture.key + '-' + facing)
      this.tweens.add({
        targets: actor, x, y, duration: this.reducedMotion ? 1 : duration,
        onUpdate: () => actor.setDepth(actor.y),
        onComplete: () => {
          actor.stop().setFrame(firstFrame(actor.texture.key, facing)).setDepth(y)
          remaining--
          if (remaining === 0) {
            this.locked = false
            done()
          }
        },
      })
    }
  }

  private placeFamilyMember(actor: Phaser.GameObjects.Sprite, route: FamilyStop[], time: number) {
    const next = route.findIndex(stop => time < stop[3])
    const [x, y, facing, end] = route[next < 0 ? route.length - 1 : next]
    const [fromX, fromY, , start] = route[next < 0 ? route.length - 1 : next - 1]
    const moving = x !== fromX || y !== fromY
    const progress = moving ? (time - start) / (end - start) : 1
    actor.setPosition(Phaser.Math.Linear(fromX, x, progress), Phaser.Math.Linear(fromY, y, progress)).setDepth(actor.y)
    const key = actor.texture.key
    const frame = firstFrame(key, facing)
    actor.stop().setFrame(frame + (moving && !this.reducedMotion ? Math.floor((time - start) / 105) % framesPerDirection(key) : 0))
  }

  private updateFamily(delta: number) {
    if (!this.readingBook || this.locked || (this.stage !== 'leave' && this.cabinVisit !== 'inside')) return
    this.familyTime += this.paused || this.reducedMotion ? 0 : delta
    const time = this.reducedMotion ? 2460 : this.familyTime
    this.placeFamilyMember(this.family.partner, readingRoute, time)
    this.placeFamilyMember(this.family.luz, time < 2180 ? luzToRug : luzPlaying, time < 2180 ? time : (time - 2180) % 5200)
    this.placeFamilyMember(this.family.nico, time < 1050 ? nicoToRug : nicoPlaying, time < 1050 ? time : (time - 1050) % 5300)
    const reading = time >= 2460
    // Tuck the reader's feet behind the book and chair seat.
    if (reading) this.family.partner.setCrop(0, 0, 32, 25)
    const turningPage = reading && !this.reducedMotion && (time - 2460) % 5100 >= 4800
    this.readingBook.setVisible(reading).setFrame(turningPage ? 'page' : 'open')
  }

  private target(action: Action) {
    if (action === 'enterCabin') return this.points.yard
    if (action === 'exitCabin') return this.points.leave
    return this.points[this.area === 'pier' && action !== 'returnToShore' ? 'pierSign' : action]
  }

  private onPointer(pointer: Phaser.Input.Pointer) {
    if (this.paused || this.locked) return
    const pos = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2
    const target = this.nearby && this.target(this.nearby)
    if (this.nearby && target && Phaser.Math.Distance.Between(pos.x, pos.y, target.x, target.y) < 34) {
      this.interact()
      return
    }
    this.destination = { x: pos.x, y: pos.y }
  }

  setMove(x: number, y: number) {
    this.manual = { x, y }
    if (x || y) this.destination = null
  }

  setOfficeSeated(seated: boolean) {
    if (this.area !== 'office') return
    this.officeSeated = seated
    this.destination = null
    this.manual = { x: 0, y: 0 }
    this.nearby = null
    this.onProximity(null)
    this.marker.clear()
    this.direction = 'up'
    const chair = this.points.sitOffice
    const y = seated ? chair.y - 19 : chair.y
    this.player.stop().setFrame(firstFrame(this.role, 'up')).setPosition(chair.x, y).setDepth(seated ? 170 : y)
    if (seated) this.player.setCrop(0, 0, 32, 24)
    else this.player.setCrop()
  }

  interact() {
    if (!this.running || this.paused || this.locked || !this.nearby) return
    this.destination = null
    if (this.nearby === 'seat') {
      this.player.setPosition(188, 183).setDepth(183)
      this.direction = 'up'
    }
    this.onAction(this.nearby)
  }

  private allowed(x: number, y: number) {
    const inside = this.area === 'inside' || this.area === 'office'
    if (this.area === 'pier') {
      return (x >= 180 && x <= 220 && y >= 69 && y <= 246)
        || (x >= 117 && x <= 283 && y >= 85 && y <= 111)
    }
    if (x < (inside ? 93 : 31) || x > (inside ? 307 : 369) || y < (inside ? 58 : 38) || y > (inside ? 241 : 222)) return false
    if (this.area === 'office' && y > 232 && (x < 188 || x > 211)) return false
    return !this.walls.some(wall => x + 4 > wall.left && x - 4 < wall.right && y > wall.top && y - 5 < wall.bottom)
  }

  update(time: number, delta: number) {
    if (!this.running) return
    if (this.officeSeated) {
      Phaser.Input.Keyboard.JustDown(this.keys.act)
      return
    }
    this.updateFamily(delta)
    let x = 0
    let y = 0
    if (!this.paused && !this.locked) {
      x = Number(this.keys.right.isDown || this.keys.d.isDown) - Number(this.keys.left.isDown || this.keys.a.isDown) || this.manual.x
      y = Number(this.keys.down.isDown || this.keys.s.isDown) - Number(this.keys.up.isDown || this.keys.w.isDown) || this.manual.y
      if (x || y) this.destination = null
      if (this.destination) {
        const dx = this.destination.x - this.player.x
        const dy = this.destination.y - this.player.y
        if (Math.hypot(dx,dy) < 3) this.destination = null
        else {
          x = dx
          y = dy
        }
      }
    }
    const distance = Math.hypot(x, y)
    if (distance) {
      const speed = Math.min(delta, 30) * 0.076
      const nextX = this.player.x + x / distance * speed
      const nextY = this.player.y + y / distance * speed
      const canX = x !== 0 && this.allowed(nextX, this.player.y)
      const canY = y !== 0 && this.allowed(canX ? nextX : this.player.x, nextY)
      if (canX) this.player.x = nextX
      if (canY) this.player.y = nextY
      if (canX || canY) {
        this.direction = Math.abs(x) > Math.abs(y) ? x < 0 ? 'left' : 'right' : y < 0 ? 'up' : 'down'
        const animation = this.role + '-' + this.direction
        if (!this.reducedMotion && (this.player.anims.currentAnim?.key !== animation || !this.player.anims.isPlaying)) this.player.play(animation)
        if (this.reducedMotion) this.player.setFrame(firstFrame(this.role, this.direction))
      } else {
        this.player.stop().setFrame(firstFrame(this.role, this.direction))
        this.destination = null
      }
    } else this.player.stop().setFrame(firstFrame(this.role, this.direction))
    this.player.setDepth(this.player.y)
    if (this.stage === 'yard' || this.stage === 'hat') {
      this.hat.setPosition(this.player.x, this.player.y - 25).setDepth(this.player.y + 1).setVisible(true)
    } else if (this.area === 'inside') {
      this.hat.setPosition(154, 192).setDepth(232).setVisible(true)
    } else this.hat.setVisible(false)
    const primary = this.area === 'office' ? 'exitOffice' : this.cabinVisit === 'inside' ? 'exitCabin' : this.cabinVisit === 'outside' ? 'enterCabin' : this.atShore ? 'pier' : this.stage
    const alternate = this.area === 'inside' ? 'exitCabin' : this.area === 'yard' ? 'enterCabin' : 'returnToShore'
    const alternatePoint = this.target(alternate)
    const station = (this.area === 'office' ? ['sitOffice', 'dossier'] as const : this.area === 'inside' ? ['enterOffice'] as const : [])
      .find(key => {
        const point = this.target(key)
        return Phaser.Math.Distance.Between(this.player.x, this.player.y, point.x, point.y) < 22
      })
    const action = station ?? (alternatePoint && primary !== 'yard' && primary !== 'leave' &&
      Phaser.Math.Distance.Between(this.player.x, this.player.y, alternatePoint.x, alternatePoint.y) < 17
      ? alternate : primary)
    const target = this.target(action)
    if (!target) return
    const nearby = !this.locked && Phaser.Math.Distance.Between(this.player.x, this.player.y, target.x, target.y) < 22 ? action : null
    if (nearby !== this.nearby) {
      this.nearby = nearby
      this.onProximity(nearby ? actions[nearby] : null)
    }
    this.marker.clear()
    if (!this.paused && !this.locked) {
      const bob = this.reducedMotion ? 0 : Math.round(Math.sin(time / 230) * 2)
      const y = target.y + bob
      this.marker.fillStyle(0x30242a, .8).fillTriangle(target.x-5,y-11,target.x+5,y-11,target.x,y-4)
      this.marker.fillStyle(0xffe7a9).fillTriangle(target.x-3,y-11,target.x+3,y-11,target.x,y-6)
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.act)) this.interact()
  }
}

export function createWorld(parent: HTMLElement, scene: BrambleScene) {
  return new Phaser.Game({
    type: Phaser.AUTO, parent, width: 400, height: 256, backgroundColor: '#211c24',
    pixelArt: true, antialias: false, roundPixels: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    banner: false, scene,
  })
}
