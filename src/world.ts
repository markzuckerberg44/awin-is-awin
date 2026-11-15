import Phaser from 'phaser'
import type { FootstepSurface } from './audio'
import { areaFor, asset, isOfficeStage, isPierStage, type CabinRoom, type Labels, type Role, type Save, type Stage } from './config'
import { floodGoal, floodSeconds, floodSpots, packTasks, scoopsPerSpot, type PackTask } from './missions'

type Point = { x: number; y: number }
type Input = { x: number; y: number }
const stepSpacing = 19
const firstStepDistance = 6
const worldSize = { width: 400, height: 256 }
// Match the reference's 43:24 framing while keeping the sprites in world units.
const pierSize = { width: 430, height: 240, zoom: 3 }
const directions = ['down', 'left', 'right', 'up'] as const
type Direction = typeof directions[number]
const characters = ['mother', 'father', 'luz', 'nico', 'ada', 'eli']
const scenery = ['neighborhood', 'room', 'cabin-back-chairs', 'cabin-table', 'cabin-chairs', 'cabin-play-rug', 'cabin-reading-book', 'hat', 'rack', 'radio', 'shore-sign', 'office-door', 'office-room', 'office-desk', 'office-chair', 'office-shelf', 'office-plant', 'office-cabinet']
const bedroomFurniture = [
  ['vanity', 208, 59, 104], ['stool', 213, 97, 116], ['bed', 147, 64, 153],
  ['wardrobe', 19, 44, 168], ['mushrooms', 18, 183, 206], ['lamp', 209, 167, 207],
] as const
const missionArt = ['bedroom-room', 'cellar-room', 'cellar-cistern', 'cellar-crates', 'cellar-barrel', 'cellar-hatch', 'water-jug', 'dream-bucket', 'boat-green']
const strandedFamily = [['luz', 219, 198], ['nico', 241, 211], ['partner', 259, 215]] as const
const framesPerDirection = (name: string) => name === 'father' ? 8 : 4
const firstFrame = (name: string, direction: Direction) => directions.indexOf(direction) * framesPerDirection(name)
export type OfficeTool = 'computer' | 'notebook' | 'dossier'
export type Action = Exclude<Stage, 'adaWater' | 'afterPier' | 'dreamExit' | 'officeGoal' | 'evacuation' | 'packing' | 'depart' | 'evacPier' | 'rowing' | 'escaped' | 'credits'> | 'returnToShore' | 'enterCabin' | 'exitCabin'
  | 'enterOffice' | 'exitOffice' | 'sitOffice' | 'standOffice' | 'dossier' | 'enterCellar' | 'exitCellar' | 'enterBedroom' | 'exitBedroom' | 'fillJug'
  | PackTask | 'reachEvacPier' | 'boardBoat'
type WorldAction = Exclude<Action, 'standOffice'>
const actions: Record<WorldAction, Labels> = {
  yard: ['Entrar a casa', 'Go inside'],
  hat: ['Colgar sombrero', 'Hang up hat'],
  greeting: ['Saludar', 'Say hello'],
  seat: ['Sentarse', 'Sit down'],
  radio: ['Escuchar la radio', 'Listen to the radio'],
  leave: ['Salir al patio', 'Go outside'],
  heat: ['Hablar con Ada', 'Talk to Ada'],
  adaReturn: ['Entregar el bidón a Ada', 'Give Ada the water jug'],
  flood: ['Hablar con Eli', 'Talk to Eli'],
  pier: ['Ir al muelle', 'Go to the pier'],
  pierSign: ['Ver el cartel', 'View the sign'],
  pierCoast: ['Ver la costa', 'Look at the coast'],
  bedtime: ['Acostarse', 'Get into bed'],
  dreamFlood: ['Sacar agua', 'Bail out water'],
  wake: ['Hablar con tu pareja', 'Talk to your partner'],
  complete: ['Ver la costa', 'Look at the coast'],
  returnToShore: ['Volver a la orilla', 'Return to shore'],
  enterCabin: ['Entrar a casa', 'Go inside'],
  exitCabin: ['Salir al patio', 'Go outside'],
  enterOffice: ['Entrar a la oficina', 'Enter the office'],
  exitOffice: ['Volver a la cabaña', 'Return to the cabin'],
  sitOffice: ['Sentarse en la silla', 'Sit in the chair'],
  dossier: ['Abrir el expediente de traslado', 'Open the relocation dossier'],
  enterCellar: ['Bajar al sótano', 'Go down to the cellar'],
  exitCellar: ['Subir a la cabaña', 'Go upstairs'],
  enterBedroom: ['Entrar al dormitorio', 'Enter the bedroom'],
  exitBedroom: ['Volver a la cabaña', 'Return to the cabin'],
  fillJug: ['Llenar el bidón', 'Fill the water jug'],
  packLuz: packTasks[0].name,
  packNico: packTasks[1].name,
  packPartner: packTasks[2].name,
  packSelf: packTasks[3].name,
  reachEvacPier: ['Ir al muelle con tu familia', 'Go to the pier with your family'],
  boardBoat: ['Subir al bote con tu familia', 'Board the boat with your family'],
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
  private followers: Phaser.GameObjects.Sprite[] = []
  private trail: (Point & { facing: Direction })[] = []
  private packed: readonly PackTask[] = []
  private bags?: Phaser.GameObjects.Graphics
  private hat!: Phaser.GameObjects.Image
  private carried!: Phaser.GameObjects.Image
  private cellarJug?: Phaser.GameObjects.Image
  private cellarFlow?: Phaser.GameObjects.Graphics
  private pourUntil = 0
  private jugDelivered = false
  private dreamWater?: Phaser.GameObjects.Graphics
  private floodFrame = ''
  private dreamScoops = 0
  private dreamTime = floodSeconds
  private splash?: Phaser.GameObjects.Graphics
  private splashAt?: Point & { until: number }
  private readingBook?: Phaser.GameObjects.Image
  private familyTime = 0
  private marker!: Phaser.GameObjects.Graphics
  private direction: Direction = 'up'
  private keys!: Record<string, Phaser.Input.Keyboard.Key>
  private points!: Record<string, Point>
  private walls: Phaser.Geom.Rectangle[] = []
  private obstacles: Phaser.Geom.Polygon[] = []
  private shoreline?: Phaser.Geom.Polygon
  private boardwalk: Phaser.Geom.Rectangle[] = []
  private reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
  private locked = false
  private nearby: Exclude<Action, 'standOffice'> | null = null
  private enteringPier = false
  private usingCabinDoor = false
  private returningFromOffice = false
  private returningFromRoom?: CabinRoom
  private returningFromPier = false
  private running = false
  private destination: Point | null = null
  private officeSeated = false
  private distanceToStep = firstStepDistance
  private lastMovement = -Infinity
  private manual: Input = { x: 0, y: 0 }
  paused = false
  markDossier = false

  constructor(
    role: Role,
    stage: Stage,
    private atShore: boolean,
    private cabinVisit: Save['cabinVisit'],
    private onAction: (action: Action) => void,
    private onProximity: (label: Labels | null) => void,
    private onFootstep: (surface: FootstepSurface) => void,
    private inOffice = false,
    private room?: CabinRoom,
  ) {
    super('bramble')
    this.role = role
    this.stage = stage
  }

  preload() {
    for (const name of [...scenery, ...missionArt, ...bedroomFurniture.map(([piece]) => 'bedroom-' + piece)]) this.load.image(name, asset('art/' + name + '.png'))
    this.load.image('pier-scene', asset('art/pier-scene.jpg'))
    for (const name of characters) this.load.spritesheet(name, asset('art/' + name + '.png'), { frameWidth: name === 'ada' || name === 'eli' ? 16 : 32, frameHeight: 32 })
    this.load.tilemapTiledJSON('yard', asset('art/yard.tmj'))
    this.load.tilemapTiledJSON('inside', asset('art/inside.tmj'))
    this.load.tilemapTiledJSON('pier', asset('art/pier.tmj'))
    this.load.tilemapTiledJSON('office', asset('art/office.tmj'))
    this.load.tilemapTiledJSON('cellar', asset('art/cellar.tmj'))
    this.load.tilemapTiledJSON('bedroom', asset('art/bedroom.tmj'))
  }

  create() {
    this.running = false
    this.locked = false
    this.nearby = null
    this.destination = null
    this.officeSeated = false
    this.distanceToStep = firstStepDistance
    this.lastMovement = -Infinity
    this.manual = { x: 0, y: 0 }
    this.onProximity(null)
    this.area = areaFor(this.stage, this.atShore, this.cabinVisit, this.inOffice, this.room)
    const atPier = this.area === 'pier'
    const { width, height } = atPier ? pierSize : worldSize
    const zoom = atPier ? pierSize.zoom : 1
    if (this.scale.width !== width * zoom || this.scale.height !== height * zoom) {
      this.scale.setGameSize(width * zoom, height * zoom)
    }
    const origin = atPier ? 0 : .5
    this.cameras.main.setOrigin(origin, origin).setZoom(zoom).setRoundPixels(true)
    const map = this.make.tilemap({ key: this.area })
    if (this.area === 'yard') {
      const tiles = map.addTilesetImage('neighborhood', 'neighborhood')
      if (tiles) map.createLayer('Ground', tiles, 0, 0, false)
    }
    this.points = Object.fromEntries((map.getObjectLayer('Interactions')?.objects ?? [])
      .map(obj => [obj.name, { x: obj.x ?? 0, y: obj.y ?? 0 }]))
    const rectangle = (obj: Phaser.Types.Tilemaps.TiledObject) =>
      new Phaser.Geom.Rectangle(obj.x ?? 0, obj.y ?? 0, obj.width ?? 0, obj.height ?? 0)
    const polygon = (obj: Phaser.Types.Tilemaps.TiledObject) => new Phaser.Geom.Polygon(
      obj.polygon?.map(point => ({ x: point.x + (obj.x ?? 0), y: point.y + (obj.y ?? 0) })))
    const collisions = map.getObjectLayer('Collision')?.objects ?? []
    this.walls = collisions.filter(obj => !obj.polygon).map(rectangle)
    this.obstacles = collisions.filter(obj => obj.polygon).map(polygon)
    const land = map.getObjectLayer('Walkable')?.objects[0]
    this.shoreline = land?.polygon ? polygon(land) : undefined
    this.boardwalk = (map.getObjectLayer('Wood')?.objects ?? []).map(rectangle)
    for (const name of characters) {
      for (const facing of directions) {
        const key = name + '-' + facing
        if (this.anims.exists(key)) continue
        const start = firstFrame(name, facing)
        this.anims.create({ key, frames: this.anims.generateFrameNumbers(name, { start, end: start + framesPerDirection(name) - 1 }), frameRate: name === 'father' ? 12 : 9, repeat: -1 })
      }
    }
    this.family = {}
    this.followers = []
    this.trail = []
    this.bags = undefined
    this.readingBook = undefined
    this.cellarJug = undefined
    this.cellarFlow = undefined
    this.pourUntil = 0
    this.jugDelivered = false
    this.dreamWater = undefined
    this.floodFrame = ''
    this.splash = undefined
    this.splashAt = undefined
    this.familyTime = 0
    if (this.area === 'yard') this.buildYard()
    else if (this.area === 'pier') this.buildPier()
    else if (this.area === 'office') this.buildOffice()
    else if (this.area === 'cellar') this.buildCellar()
    else if (this.area === 'bedroom') this.buildBedroom()
    else this.buildInterior()
    const spawn = this.spawnPoint()
    this.usingCabinDoor = false
    this.returningFromOffice = false
    this.returningFromRoom = undefined
    this.returningFromPier = false
    this.player = this.person(this.role, spawn.x, spawn.y, 'up')
    if (this.stage === 'depart' || this.stage === 'evacPier') this.createFollowers(spawn)
    this.direction = 'up'
    this.hat = this.add.image(0, 0, 'hat').setVisible(false)
    this.carried = this.add.image(0, 0, 'water-jug').setVisible(false)
    this.marker = this.add.graphics().setDepth(300)
    this.keys = this.input.keyboard!.addKeys({
      up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT',
      w: 'W', s: 'S', a: 'A', d: 'D', act: 'E',
    }, false) as typeof this.keys
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

  private spawnPoint(): Point {
    if (this.area === 'yard') {
      if (this.stage === 'yard') return { x: 203, y: 219 }
      if (this.returningFromPier || !this.usingCabinDoor && (this.stage === 'pier' || this.atShore)) {
        return { x: this.points.pier.x, y: this.points.pier.y - 15 }
      }
      return { x: this.points.yard.x, y: this.points.yard.y + 12 }
    }
    if (this.area === 'pier') {
      const { pierSign, returnToShore } = this.points
      return this.stage === 'pierSign' || this.stage === 'evacPier' || this.enteringPier
        ? { x: returnToShore.x, y: returnToShore.y + 18 }
        : { x: pierSign.x - 5, y: pierSign.y }
    }
    if (this.area === 'office') return { x: 201, y: 222 }
    if (this.area === 'cellar') return { x: 200, y: 212 }
    if (this.area === 'bedroom') return this.stage === 'dreamExit' || this.stage === 'wake' ? { x: 210, y: 154 } : { x: 200, y: 113 }
    if (this.stage === 'dreamFlood') return { x: 221, y: 78 }
    if (this.stage === 'packing' || this.stage === 'depart') return { x: 195, y: 195 }
    if (this.returningFromOffice) return { x: 278, y: 76 }
    if (this.returningFromRoom === 'bedroom') return { x: 221, y: 78 }
    if (this.returningFromRoom === 'cellar') return { x: 137, y: 194 }
    if (this.usingCabinDoor || this.cabinVisit === 'inside' || this.stage === 'hat') return { x: 200, y: 226 }
    return this.stage === 'greeting' ? { x: 181, y: 218 } : { x: 204, y: 202 }
  }

  private buildYard() {
    this.family.ada = this.person('ada', this.points.heat.x, this.points.heat.y, 'down')
    this.family.eli = this.person('eli', this.points.flood.x, this.points.flood.y, 'down')
  }

  private buildPier() {
    this.prop('pier-scene', 0, 0, 0).setDisplaySize(pierSize.width, pierSize.height)
    const { x, y } = this.points.pierSign
    this.prop('shore-sign', x - 10, y - 10, y + 10)
    if (this.stage === 'evacPier') {
      this.add.image(302, 207, 'boat-green').setScale(.62).setDepth(194)
      this.add.graphics().setDepth(193).lineStyle(1, 0xd8b783).lineBetween(300, 188, 302, 200)
    }
  }

  private buildInterior() {
    this.prop('room', 72, 0, 1)
    this.prop('office-door', 262, 5, 57)
    this.prop('office-door', 205, 5, 57).setTint(0xc6a985)
    this.prop('cellar-hatch', 115, 167, 2)
    this.prop('cabin-back-chairs', 162, 95, 115)
    this.prop('cabin-table', 162, 95, 153)
    this.prop('cabin-chairs', 162, 154, 181)
    this.prop('rack', 137, 185, 226)
    this.prop('radio', 264, 128, 158)
    this.prop('cabin-play-rug', 222, 213, 2)
    if (this.stage === 'packing') {
      this.bags = this.add.graphics().setDepth(239)
      for (const task of packTasks) {
        if (task.actor) this.person(task.actor === 'partner' ? otherRole(this.role) : task.actor, task.x + 9, task.y - 2, 'down')
      }
      this.drawBags()
      return
    }
    if (this.stage === 'depart') return
    if (this.stage === 'dreamFlood') {
      for (const [name, x, y] of strandedFamily) {
        this.family[name] = this.person(name === 'partner' ? otherRole(this.role) : name, x, y, 'down').setDepth(258)
      }
      this.add.rectangle(72, 0, 256, 256, 0x14243f, .24).setOrigin(0).setDepth(260)
      this.dreamWater = this.add.graphics().setDepth(240)
      this.splash = this.add.graphics().setDepth(265)
      this.drawFlood(0)
      return
    }
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

  setPacked(tasks: readonly PackTask[]) {
    this.packed = tasks
    this.drawBags()
  }

  private drawBags() {
    if (!this.bags) return
    this.bags.clear()
    for (const task of packTasks) {
      const done = this.packed.includes(task.key)
      const x = task.x - 6
      const y = task.y - 6
      this.bags.fillStyle(0x2c272a).fillRect(x + 3, y - 2, 6, 3).fillRect(x, y, 12, 8)
        .fillStyle(done ? 0x618358 : 0xc38e55).fillRect(x + 1, y + 1, 10, 6)
        .fillStyle(0xf4daa4).fillRect(x + 3, y + 2, 1, 5).fillRect(x + 8, y + 2, 1, 5)
    }
  }

  private createFollowers(spawn: Point) {
    this.followers = [otherRole(this.role), 'luz', 'nico'].map((person, index) =>
      this.person(person, spawn.x + [7, -7, 0][index], spawn.y + (this.area === 'pier' ? -1 : 1) * [7, 11, 19][index], 'up'))
      .map(actor => actor.setTint(0xe9e1cc))
  }

  private followPlayer() {
    if (!this.followers.length) return
    const { x, y } = this.player
    const last = this.trail[0]
    if (!last || Math.hypot(x - last.x, y - last.y) >= 3) {
      this.trail.unshift({ x, y, facing: this.direction })
      this.trail.length = Math.min(this.trail.length, 19)
    }
    this.followers.forEach((actor, index) => {
      const point = this.trail[(index + 1) * 5]
      if (!point) return
      const walking = point.x !== actor.x || point.y !== actor.y
      actor.setPosition(point.x, point.y).setDepth(point.y)
      const animation = `${actor.texture.key}-${point.facing}`
      if (walking && !this.reducedMotion) {
        if (!actor.anims.isPlaying || actor.anims.currentAnim?.key !== animation) actor.play(animation)
      } else actor.stop().setFrame(firstFrame(actor.texture.key, point.facing))
    })
  }

  private buildCellar() {
    this.prop('cellar-room', 72, 0, 1)
    this.prop('cellar-cistern', 164, 52, 122)
    this.prop('cellar-crates', 91, 87, 126)
    this.prop('cellar-barrel', 251, 137, 174)
    this.cellarJug = this.prop('water-jug', 226, 115, 133)
    this.cellarFlow = this.add.graphics().setDepth(134)
  }

  private buildBedroom() {
    this.prop('bedroom-room', 72, 0, 1)
    for (const [piece, x, y, foot] of bedroomFurniture) this.prop('bedroom-' + piece, 72 + x, y, foot)
    if (this.stage !== 'dreamExit') this.family.partner = this.person(otherRole(this.role), 209, 127, 'down')
    if (this.stage === 'bedtime' || this.stage === 'dreamExit') {
      this.add.rectangle(0, 0, 400, 256, 0x272538, .22).setOrigin(0).setDepth(260)
    }
  }

  lieDown() {
    if (this.area !== 'bedroom' || !this.family.partner) return
    this.locked = true
    this.destination = null
    this.marker.clear()
    for (const [actor, x] of [[this.player, 239], [this.family.partner, 253]] as const) {
      actor.stop().setFrame(firstFrame(actor.texture.key, 'down')).setPosition(x, 114)
        .setDepth(159).setCrop(0, 0, 32, 15)
    }
  }

  pumpWater(strong: boolean) {
    this.pourUntil = this.time.now + (strong ? 380 : 190)
  }

  giveJug() {
    const ada = this.points.heat
    if (!ada || this.jugDelivered) return
    this.jugDelivered = true
    this.carried.setVisible(false)
    this.add.image(ada.x + 12, ada.y - 6, 'water-jug').setScale(.65).setDepth(ada.y + 1)
  }

  setDreamProgress(scoops: number, time: number) {
    if (this.stage === 'dreamFlood' && this.dreamWater && scoops > this.dreamScoops) {
      const spot = this.points[floodSpots[Math.floor(this.dreamScoops / scoopsPerSpot)]]
      if (spot) this.splashAt = { ...spot, until: this.time.now + 380 }
    }
    this.dreamScoops = scoops
    this.dreamTime = time
  }

  private drawFlood(time: number) {
    const water = this.dreamWater
    if (!water) return
    const wave = this.reducedMotion ? 0 : Math.floor(time / 125)
    const cleared = this.dreamScoops >= floodGoal
    const edge = cleared ? 247 : 70 + Math.round(this.dreamTime / floodSeconds * 26 + this.dreamScoops * 19)
    const activeSpot = Math.floor(this.dreamScoops / scoopsPerSpot)
    const frame = `${wave}:${edge}:${activeSpot}`
    if (frame !== this.floodFrame) {
      this.floodFrame = frame
      water.clear()
      const floor = 238
      for (let x = 90; x < 309; x += 3) {
        const crest = edge + Math.round(Math.sin(x / 13 + wave / 4) * 3 + Math.sin(x / 28 - wave / 7) * 4)
        if (crest >= floor) continue
        water.fillStyle(0x2a6277, .68).fillRect(x, crest, 3, floor - crest + 1)
        if ((x + wave * 3) % 27 < 15) water.fillStyle(0xa5d9d3, .72).fillRect(x, crest, 3, 1)
        if (x % 18 === 0) {
          for (let y = crest + 10 + x % 23; y < floor - 1; y += 29) {
            water.fillStyle(0x91c4c6, .46).fillRect(x, y, 5 + wave % 4, 1).fillRect(x + 1, y + 1, 3, 1)
          }
        }
      }
      if (!cleared) {
        water.fillStyle(0x2a6277, .68).fillRect(184, floor, 32, 10)
          .fillStyle(0xb4dcd7, .62).fillRect(188 + wave % 5, floor + 4, 7, 1).fillRect(203 - wave % 5, floor, 9, 1)
      }
      for (const [index, name] of floodSpots.entries()) {
        if (index < activeSpot) continue
        const { x, y } = this.points[name]
        const active = index === activeSpot
        water.fillStyle(active ? 0x305869 : 0x396876, .91).fillEllipse(x, y + 2, 26, 10)
        water.fillStyle(active ? 0x9bd1cb : 0x78a8ad).fillRect(x - 7, y + 6, 14, 1).fillRect(x + 4, y, 7, 1)
      }
    }
    this.splash?.clear()
    for (const [index, [name, x, y]] of strandedFamily.entries()) {
      const actor = this.family[name]
      const bob = cleared ? 0 : Math.round(Math.sin((wave + index) / 1.6))
      const visible = cleared ? 32 : (name === 'partner' ? 24 : 20) + this.dreamScoops
      actor.setY(y + bob).setCrop(0, 0, 32, visible)
      if (cleared) continue
      const surface = y - 30 + visible + bob
      this.splash?.lineStyle(1, 0xa3d3ca, .68).strokeEllipse(x, surface, 23 + (wave + index) % 3, 6)
        .fillStyle(0xbfe2d6, .76).fillRect(x + 9, surface - (wave + index) % 5, 2, 2)
    }
    const splash = this.splashAt
    if (splash && time < splash.until) {
      const reach = Math.floor((380 - splash.until + time) / 42)
      this.splash?.fillStyle(0xbbe5df, .93).fillRect(splash.x - 5 - reach, splash.y - 5 - reach, 3, 3)
        .fillRect(splash.x + 3 + reach, splash.y - 9 - reach, 2, 3).fillRect(splash.x, splash.y - 6 - reach, 2, 2)
    }
  }

  private buildOffice() {
    this.prop('office-room', 72, 24, 1)
    this.prop('office-desk', 168, 93, 146)
    this.prop('office-chair', 187, 148, 169)
    this.prop('office-shelf', 275, 72, 135)
    this.add.graphics().setDepth(136)
      .fillStyle(0x382629).fillRect(287, 118, 13, 8)
      .fillStyle(0xeeaf5a).fillRect(288, 119, 11, 6).fillRect(288, 117, 5, 2)
      .fillStyle(0xffedba).fillRect(289, 120, 8, 2)
      .fillStyle(0xaf6140).fillRect(289, 123, 9, 2)
    this.prop('office-plant', 89, 169, 231)
    this.prop('office-cabinet', 288, 177, 231)
  }

  private positionChildren() {
    this.family.luz.setPosition(216, 204).setDepth(204).setFrame(4)
    this.family.nico.setPosition(238, 209).setDepth(209).setFrame(4)
  }

  setStage(stage: Stage, atShore: boolean, cabinVisit: Save['cabinVisit'], inOffice = false, room?: CabinRoom) {
    const previous = this.stage
    if (previous === stage && this.atShore === atShore && this.cabinVisit === cabinVisit && this.inOffice === inOffice && this.room === room) return
    this.returningFromOffice = this.inOffice && !inOffice
    this.returningFromRoom = this.room && !room ? this.room : undefined
    this.returningFromPier = this.area === 'pier' && atShore
    this.room = room
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
    if (areaFor(stage, atShore, cabinVisit, inOffice, room) !== this.area || stage !== previous && (stage === 'dreamExit' || stage === 'packing' || stage === 'depart')) {
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
    if (action === 'adaReturn') return this.points.heat
    if (action === 'dreamFlood') return this.points[floodSpots[Math.floor(this.dreamScoops / scoopsPerSpot)]]
    if (action === 'reachEvacPier') return this.points.pier
    if (action === 'boardBoat') return { x: 298, y: 180 }
    const task = packTasks.find(item => item.key === action)
    if (task) return task
    return this.points[this.area === 'pier' && action !== 'returnToShore' ? 'pierSign' : action]
  }

  private objectiveAction(): WorldAction {
    const { area, stage, cabinVisit } = this
    if (area === 'office') return this.markDossier ? 'dossier' : 'sitOffice'
    if (area === 'cellar') return stage === 'adaWater' ? 'fillJug' : 'exitCellar'
    if (area === 'bedroom') return stage === 'bedtime' || stage === 'wake' ? stage : 'exitBedroom'
    if (area === 'pier') return stage === 'evacPier' ? 'boardBoat' : stage === 'afterPier' ? 'returnToShore' : stage === 'pierCoast' || stage === 'complete' ? stage : 'pierSign'
    if (area === 'inside') {
      if (stage === 'packing') return this.remainingBags()[0] ?? 'packSelf'
      if (stage === 'dreamFlood') return 'dreamFlood'
      if (stage === 'adaWater') return 'enterCellar'
      if (stage === 'bedtime' || stage === 'wake') return 'enterBedroom'
      if (isOfficeStage(stage)) return 'enterOffice'
      return stage === 'hat' || stage === 'greeting' || stage === 'seat' || stage === 'radio' || stage === 'leave' ? stage : 'exitCabin'
    }
    if (stage === 'depart') return 'reachEvacPier'
    if (stage === 'yard' || stage === 'heat' || stage === 'adaReturn' || stage === 'flood') return stage
    if (stage === 'pier' || isPierStage(stage) && cabinVisit !== 'outside') return 'pier'
    return 'enterCabin'
  }

  private localActions(): WorldAction[] {
    switch (this.area) {
      case 'inside':
        if (this.stage === 'packing') return this.remainingBags()
        if (this.stage === 'dreamFlood' || this.stage === 'leave' || this.stage === 'depart' || this.stage === 'evacuation') return []
        return ['exitCabin']
      case 'yard': return this.stage === 'yard' || this.stage === 'depart' ? [] : ['enterCabin']
      case 'cellar': return ['exitCellar']
      case 'bedroom': return ['exitBedroom']
      case 'pier': return this.stage === 'evacPier' ? [] : ['returnToShore']
      case 'office': return ['sitOffice', 'dossier', 'exitOffice']
    }
  }

  private remainingBags(): PackTask[] {
    return packTasks.filter(task => !this.packed.includes(task.key) && (task.actor || this.packed.length >= packTasks.length - 1))
      .map(task => task.key)
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
    if (this.shoreline) {
      if (!this.shoreline.contains(x - 4, y) || !this.shoreline.contains(x + 4, y)) return false
    } else if (x < 93 || x > 307 || y < 58 || y > 241) return false
    if (this.area === 'office' && y > 232 && (x < 188 || x > 211)) return false
    return !this.walls.some(wall => x + 4 > wall.left && x - 4 < wall.right && y > wall.top && y - 5 < wall.bottom)
      && !this.obstacles.some(obstacle => obstacle.contains(x - 4, y - 3) || obstacle.contains(x + 4, y - 3))
  }

  private advanceFootsteps(distance: number, time: number) {
    if (!distance) return
    if (time - this.lastMovement > 110) this.distanceToStep = firstStepDistance
    this.lastMovement = time
    this.distanceToStep -= distance
    if (this.distanceToStep > 0) return
    this.distanceToStep += stepSpacing
    if (this.area === 'cellar' || this.stage === 'dreamFlood') {
      this.onFootstep(this.area === 'cellar' ? 'stone' : 'water')
      return
    }
    const { x, y } = this.player
    const sand = (this.area === 'yard' || this.area === 'pier') && !this.boardwalk.some(planks => planks.contains(x, y))
    this.onFootstep(sand ? 'sand' : 'wood')
  }

  update(time: number, delta: number) {
    if (!this.running || this.locked && this.area === 'bedroom') return
    if (this.officeSeated) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.act) && !this.paused) this.onAction('standOffice')
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
      const moved = Math.hypot(canX ? nextX - this.player.x : 0, canY ? nextY - this.player.y : 0)
      if (canX) this.player.x = nextX
      if (canY) this.player.y = nextY
      if (canX || canY) {
        this.advanceFootsteps(moved, time)
        this.direction = Math.abs(x) > Math.abs(y) ? x < 0 ? 'left' : 'right' : y < 0 ? 'up' : 'down'
        const animation = this.role + '-' + this.direction
        if (!this.reducedMotion && (this.player.anims.currentAnim?.key !== animation || !this.player.anims.isPlaying)) this.player.play(animation)
        if (this.reducedMotion) this.player.setFrame(firstFrame(this.role, this.direction))
      } else {
        this.player.stop().setFrame(firstFrame(this.role, this.direction))
        this.destination = null
      }
    } else this.player.stop().setFrame(firstFrame(this.role, this.direction))
    this.player.setDepth(this.stage === 'dreamFlood' ? 257 : this.player.y)
    this.followPlayer()
    this.drawFlood(time)
    const holdingJug = this.stage === 'adaReturn' && !this.jugDelivered
    const holdingBucket = this.stage === 'dreamFlood'
    if (holdingJug || holdingBucket) {
      const side = this.direction === 'left' ? 8 : this.direction === 'right' ? -8 : 0
      const behind = !holdingBucket && this.direction === 'down'
      const bob = distance && !this.reducedMotion ? Math.floor(time / 120) % 2 : 0
      this.carried.setTexture(holdingJug ? 'water-jug' : 'dream-bucket').setScale(holdingJug ? .65 : 1)
        .setPosition(Math.round(this.player.x + (holdingBucket ? side || 9 : behind ? 7 : side)), Math.round(this.player.y - (holdingJug ? 13 : 7) + bob))
        .setDepth(this.player.depth + (behind ? -1 : 1)).setVisible(true)
    } else this.carried.setVisible(false)
    this.cellarJug?.setVisible(this.stage === 'adaWater')
    if (this.cellarFlow) {
      this.cellarFlow.clear()
      if (time < this.pourUntil) {
        const drop = this.reducedMotion ? 0 : Math.floor(time / 42) % 3
        this.cellarFlow.fillStyle(0x76c6ce).fillRect(232, 113, 2, 8 + drop)
          .fillStyle(0xbce8df).fillRect(233, 116 + drop, 1, 3)
      }
    }
    if (this.stage === 'yard' || this.stage === 'hat') {
      this.hat.setPosition(this.player.x, this.player.y - 25).setDepth(this.player.y + 1).setVisible(true)
    } else if (this.area === 'inside') {
      this.hat.setPosition(154, 192).setDepth(232).setVisible(true)
    } else this.hat.setVisible(false)
    const primary = this.objectiveAction()
    let nearby: WorldAction | null = null
    let distanceToAction = 22
    for (const action of [primary, ...this.localActions()]) {
      const point = this.target(action)
      if (!point) continue
      const fromPlayer = Phaser.Math.Distance.Between(this.player.x, this.player.y, point.x, point.y)
      if (fromPlayer < distanceToAction) {
        nearby = action
        distanceToAction = fromPlayer
      }
    }
    if (this.locked) nearby = null
    if (nearby !== this.nearby) {
      this.nearby = nearby
      this.onProximity(nearby === 'exitBedroom' && this.stage === 'dreamExit' ? ['Ir a la cocina', 'Go to the kitchen'] : nearby ? actions[nearby] : null)
    }
    this.marker.clear()
    const showDossierMarker = this.area === 'office' && this.markDossier
    const officeMission = this.area === 'office' && isOfficeStage(this.stage)
    const target = this.target(officeMission ? primary : nearby ?? primary)
    if (target && !this.paused && !this.locked) {
      const bob = this.reducedMotion ? 0 : Math.round(Math.sin(time / 230) * 2)
      const x = target.x + (showDossierMarker ? 3 : 0)
      const y = target.y + bob - (showDossierMarker ? 22 : 0)
      this.marker.fillStyle(0x30242a, .8).fillTriangle(x-5,y-11,x+5,y-11,x,y-4)
      this.marker.fillStyle(0xffe7a9).fillTriangle(x-3,y-11,x+3,y-11,x,y-6)
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.act)) this.interact()
  }
}

export function createWorld(parent: HTMLElement, scene: BrambleScene) {
  return new Phaser.Game({
    type: Phaser.AUTO, parent, ...worldSize, backgroundColor: '#211c24',
    pixelArt: true, antialias: false, roundPixels: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    banner: false, scene,
  })
}
