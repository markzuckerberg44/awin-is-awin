import type { CabinRoom, Labels, Stage } from './config'

const missionCheckpoints: readonly {
  stages: readonly [Stage, ...Stage[]]
  name: Labels
  room?: CabinRoom
}[] = [
  { stages: ['yard', 'hat', 'greeting', 'seat', 'radio', 'leave'], name: ['Llegar a casa', 'Arrive home'] },
  { stages: ['heat', 'adaWater', 'adaReturn'], name: ['Llevar agua a Ada', 'Bring water to Ada'] },
  { stages: ['flood'], name: ['Hablar con Eli', 'Talk to Eli'] },
  { stages: ['pier', 'pierSign', 'pierCoast'], name: ['Investigar la costa', 'Investigate the coast'] },
  { stages: ['afterPier', 'bedtime', 'dreamExit'], name: ['Volver a casa tras el muelle', 'Return home from the pier'] },
  { stages: ['dreamFlood'], name: ['Sacar el agua de la casa', 'Bail out the house'] },
  { stages: ['wake', 'officeGoal', 'complete'], name: ['Investigar en la oficina', 'Investigate in the office'], room: 'bedroom' },
  { stages: ['evacuation', 'packing', 'depart', 'evacPier', 'rowing', 'escaped', 'credits'], name: ['Evacuar Bramble Cay', 'Evacuate Bramble Cay'] },
]

export function availableMissions(stage: Stage, unlockedThrough?: Stage) {
  const missionIndex = (value: Stage | undefined) => missionCheckpoints.findIndex(mission => value && mission.stages.includes(value))
  const current = missionIndex(stage)
  const latest = Math.max(current, missionIndex(unlockedThrough))
  return {
    current: missionCheckpoints[current]?.stages[0],
    missions: missionCheckpoints.slice(0, latest + 1),
  }
}

export const floodSeconds = 20
export const scoopsPerSpot = 2
export const floodSpots = ['dreamCounter', 'dreamDoor', 'dreamStove'] as const
export const floodGoal = floodSpots.length * scoopsPerSpot

export const evacuationStages: readonly Stage[] = ['evacuation', 'packing', 'depart', 'evacPier', 'rowing']
export const packingSeconds = 26
export const packTasks = [
  { key: 'packLuz', name: ['Ayudar a Luz', 'Help Luz'], actor: 'luz', x: 257, y: 190 },
  { key: 'packNico', name: ['Ayudar a Nico', 'Help Nico'], actor: 'nico', x: 204, y: 220 },
  { key: 'packPartner', name: ['Ayudar a tu pareja', 'Help your partner'], actor: 'partner', x: 131, y: 182 },
  { key: 'packSelf', name: ['Preparar tu maleta', 'Pack your bag'], actor: null, x: 164, y: 193 },
] as const
export type PackTask = typeof packTasks[number]['key']
