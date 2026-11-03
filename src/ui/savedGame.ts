// Partida guardada en el navegador para continuar después. Solo se guarda el
// estado del motor: el combate se vuelve a simular igual con la misma semilla.

import type { GameState } from '../engine/game'
import { readStorage, writeStorage } from './storage'

const SAVE_KEY = 'arena-de-razas:partida'
/** Sube si cambia la forma del estado: los guardados antiguos se descartan. */
export const SAVE_VERSION = 1

/** Pantalla desde la que se continúa. En `battle`, el combate de la ronda de `game`. */
export interface SavedGame {
  readonly screen: 'rivals' | 'shop' | 'battle'
  readonly game: GameState
}

const SCREENS: readonly string[] = ['rivals', 'shop', 'battle'] satisfies SavedGame['screen'][]

export function serializeSave(save: SavedGame): string {
  return JSON.stringify({ version: SAVE_VERSION, ...save })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Comprobación por encima: lo justo para no arrancar con un guardado roto. */
function looksLikeGame(value: unknown): value is GameState {
  if (!isRecord(value)) return false
  const { seed, races, lives, wins, streak, shop, rivals, status } = value
  return (
    typeof seed === 'string' &&
    Array.isArray(races) &&
    typeof lives === 'number' &&
    typeof wins === 'number' &&
    isRecord(streak) &&
    isRecord(shop) &&
    typeof shop.round === 'number' &&
    typeof shop.gold === 'number' &&
    Array.isArray(shop.team) &&
    Array.isArray(shop.offers) &&
    Array.isArray(rivals) &&
    rivals.every((rival) => isRecord(rival) && isRecord(rival.shop)) &&
    status === 'playing'
  )
}

/** Lee un guardado; devuelve null si no hay, está roto o es de otra versión. */
export function parseSave(text: string | null): SavedGame | null {
  if (text === null) return null
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return null
  }
  if (!isRecord(data) || data.version !== SAVE_VERSION) return null
  const { screen, game } = data
  if (typeof screen !== 'string' || !SCREENS.includes(screen) || !looksLikeGame(game)) return null
  return { screen: screen as SavedGame['screen'], game }
}

export function loadSave(): SavedGame | null {
  return parseSave(readStorage(SAVE_KEY))
}

/** Guarda la partida, o la borra con null. */
export function storeSave(save: SavedGame | null): void {
  writeStorage(SAVE_KEY, save === null ? null : serializeSave(save))
}
