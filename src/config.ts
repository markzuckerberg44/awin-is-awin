export const GAME_TITLE = 'Fading Wilds'

export const levels = [
  { id: 'bramble-cay', species: 'Melomys rubicola', chapter: { es: 'Bramble Cay', en: 'Bramble Cay' } },
] as const

export type Language = 'es' | 'en'
export type Role = 'mother' | 'father'
export type Stage = 'yard' | 'hat' | 'greeting' | 'seat' | 'radio' | 'leave' | 'heat' | 'flood' | 'pier' | 'pierSign' | 'pierCoast' | 'complete'
export type Save = { role: Role; stage: Stage; atShore?: boolean; cabinVisit?: 'inside' | 'outside'; inOffice?: boolean; investigation?: import('./investigation').Investigation }

export const isPierStage = (stage: Stage) => stage === 'pierSign' || stage === 'pierCoast' || stage === 'complete'
export const isCabinStage = (stage: Stage) => stage === 'hat' || stage === 'greeting' || stage === 'seat' || stage === 'radio' || stage === 'leave'
export function areaFor(stage: Stage, atShore: boolean, cabinVisit: Save['cabinVisit'], inOffice = false) {
  if (inOffice) return 'office'
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
export const saveKey = 'bramble-cay-progress'
export const settingsKey = 'bramble-cay-settings'
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
