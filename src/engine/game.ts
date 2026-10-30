// Estado de la partida: rondas, vidas y victorias (hito 5) y rachas.

import type { Outcome } from './combat'

/** Racha actual del jugador: victorias o derrotas seguidas. */
export interface Streak {
  readonly kind: 'win' | 'loss' | 'none'
  readonly count: number
}

/** La primera ronda no tiene racha. */
export const NO_STREAK: Streak = { kind: 'none', count: 0 }

/**
 * Actualiza la racha con el resultado de un combate del jugador (equipo A).
 * Un empate la rompe; una victoria rompe la racha de derrotas y viceversa.
 */
export function updateStreak(streak: Streak, outcome: Outcome): Streak {
  if (outcome === 'draw') return NO_STREAK
  const kind = outcome === 'victoryA' ? 'win' : 'loss'
  return streak.kind === kind ? { kind, count: streak.count + 1 } : { kind, count: 1 }
}

/** Oro extra por racha (diseno.md): 0‑1 → 0, 2 → +1, 3‑4 → +2, 5 o más → +3. */
export function streakGold(count: number): number {
  if (count >= 5) return 3
  if (count >= 3) return 2
  if (count >= 2) return 1
  return 0
}
