export const GAME_TITLE = 'Fading Wilds'
export const caseYear = 2015
export const archiveEndYear = caseYear - 1

export const levels = [
  { id: 'bramble-cay', species: 'Melomys rubicola', chapter: { es: 'Bramble Cay', en: 'Bramble Cay' } },
] as const
export type ChapterId = typeof levels[number]['id']

export type Language = 'es' | 'en'
export type Role = 'mother' | 'father'
export const playerIdentity: Record<Role, { name: string; birthDate: string }> = {
  father: { name: 'Bob Lebron Jr', birthDate: '00/00/0000' },
  mother: { name: 'Mrs. Lebron', birthDate: '00/00/0000' },
}
export type Stage = 'yard' | 'hat' | 'greeting' | 'seat' | 'radio' | 'leave' | 'heat' | 'adaWater' | 'adaReturn'
  | 'flood' | 'pier' | 'pierSign' | 'pierCoast' | 'afterPier' | 'bedtime' | 'dreamExit' | 'dreamFlood' | 'wake' | 'officeGoal' | 'complete'
  | 'evacuation' | 'packing' | 'depart' | 'evacPier' | 'rowing' | 'escaped' | 'credits'
export type CabinRoom = 'cellar' | 'bedroom'
export type RentalApplication = { id: string; sentAt: number }
export type Save = { role: Role; stage: Stage; unlockedThrough?: Stage; atShore?: boolean; cabinVisit?: 'inside' | 'outside'; inOffice?: boolean; room?: CabinRoom; nightmareSeen?: boolean; computerGuideComplete?: boolean; investigation?: import('./investigation').Investigation; rental?: RentalApplication }

export const isPierStage = (stage: Stage) => stage === 'pierSign' || stage === 'pierCoast' || stage === 'afterPier' || stage === 'complete'
export const isCabinStage = (stage: Stage) => stage === 'hat' || stage === 'greeting' || stage === 'seat' || stage === 'radio'
  || stage === 'leave' || stage === 'bedtime' || stage === 'dreamExit' || stage === 'dreamFlood' || stage === 'wake' || stage === 'officeGoal'
  || stage === 'evacuation' || stage === 'packing' || stage === 'depart'
export const isOfficeStage = (stage: Stage) => stage === 'officeGoal' || stage === 'complete' || stage === 'evacuation'

export function officeCheckpoint(save: Save): Save {
  return { ...save, stage: 'complete', inOffice: true, room: undefined, nightmareSeen: true, atShore: true, cabinVisit: 'inside' }
}

export function areaFor(stage: Stage, atShore: boolean, cabinVisit: Save['cabinVisit'], inOffice = false, room?: CabinRoom) {
  if (stage === 'evacPier' || stage === 'rowing' || stage === 'escaped' || stage === 'credits') return 'pier'
  if (inOffice) return 'office'
  if (room) return room
  if (cabinVisit === 'inside') return 'inside'
  if (cabinVisit === 'outside') return 'yard'
  if (isPierStage(stage)) return atShore ? 'yard' : 'pier'
  return isCabinStage(stage) ? 'inside' : 'yard'
}
export type Settings = { language: Language; volume: number; sound: boolean }
export type Labels = readonly [string, string]
export const asset = (path: string) => import.meta.env.BASE_URL + path
export const translate = (language: Language, labels: Labels) => labels[language === 'es' ? 0 : 1]

export const defaultSettings: Settings = { language: 'es', volume: 0.75, sound: true }
export const chapterSaveKey = (chapter: ChapterId) => `${chapter}-progress`
export const settingsKey = 'bramble-cay-settings'

export function savedChapter(chapter: ChapterId): Save | null {
  const save = readLocal<Save | null>(chapterSaveKey(chapter), null)
  if (!save) return null
  if (save.inOffice && !isOfficeStage(save.stage)) {
    if (save.investigation?.relocation?.origin || save.stage === 'afterPier' || save.stage === 'bedtime' || save.stage === 'wake') {
      return officeCheckpoint(save)
    }
    return { ...save, inOffice: undefined, room: save.stage === 'dreamExit' ? 'bedroom' : save.room }
  }
  if (save.stage === 'dreamExit' && !save.room) return { ...save, room: 'bedroom', cabinVisit: undefined }
  if (save.stage !== 'complete' || save.nightmareSeen) return save
  if (save.inOffice || save.investigation?.relocation?.origin) return officeCheckpoint(save)
  if (save.cabinVisit === 'inside') return { ...save, stage: 'bedtime', cabinVisit: undefined }
  if (save.atShore) return { ...save, stage: 'bedtime', cabinVisit: 'outside' }
  return { ...save, stage: 'afterPier' }
}
export function readLocal<T>(key: string, fallback: T): T {
  try {
    const json = localStorage.getItem(key)
    return json ? JSON.parse(json) as T : fallback
  } catch {
    return fallback
  }
}

export function writeLocal<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Progress stays available in the current session if storage is unavailable.
  }
}
