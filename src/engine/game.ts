// Estado de la partida: rondas, vidas, victorias, rachas y rivales.

import { createRivals, playBotTurn, type Rival } from './bot'
import type { Outcome, TeamUnit } from './combat'
import { createRng } from './rng'
import { battleTeam, createShop, nextShop, type ShopState } from './shop'
import type { Race } from './units'

/** Parámetros de la partida (diseno.md). */
export const STARTING_LIVES = 5
export const LIVES_LOST_PER_DEFEAT = 1
export const WINS_TO_WIN = 10

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

export type GameStatus = 'playing' | 'won' | 'lost'

/** Qué pasó en el último combate, para la pantalla de resultado. */
export interface RoundResult {
  readonly round: number
  readonly outcome: Outcome
  readonly winsGained: number
  readonly livesLost: number
}

/** Estado completo de una partida. La ronda actual es la de la tienda. */
export interface GameState {
  readonly seed: string
  readonly races: readonly Race[]
  readonly lives: number
  readonly wins: number
  readonly streak: Streak
  readonly shop: ShopState
  /** Los 4 rivales, cada uno con su tienda ya jugada en la ronda actual. */
  readonly rivals: readonly Rival[]
  readonly status: GameStatus
  readonly lastRound: RoundResult | null
}

/** Lo que necesita la pantalla de combate. */
export interface BattleSetup {
  readonly round: number
  readonly playerTeam: readonly TeamUnit[]
  readonly rivalTeam: readonly TeamUnit[]
  readonly rivalName: string
  readonly seed: string
}

/** Cada rival juega su turno de tienda. */
function playRivals(rivals: readonly Rival[]): Rival[] {
  return rivals.map((rival) => playBotTurn(rival).rival)
}

/**
 * Partida nueva: vidas completas, sin victorias ni racha, la tienda de la
 * ronda 1 y los 4 rivales con su primera tienda ya jugada.
 */
export function newGame(seed: string, races: readonly Race[]): GameState {
  return {
    seed,
    races: [...races],
    lives: STARTING_LIVES,
    wins: 0,
    streak: NO_STREAK,
    shop: createShop(1, [], seed, races),
    rivals: playRivals(createRivals(seed, races)),
    status: 'playing',
    lastRound: null,
  }
}

/** Rival de la ronda actual: al azar entre los 4 con la semilla, se puede repetir. */
export function rivalForRound(game: GameState): Rival | undefined {
  return createRng(`${game.seed}:rivalDeRonda:${game.shop.round}`).pick(game.rivals)
}

/** Equipos y semilla del combate de la ronda actual. Misma partida = mismo combate. */
export function prepareBattle(game: GameState): BattleSetup {
  const { round } = game.shop
  const rival = rivalForRound(game)
  return {
    round,
    playerTeam: battleTeam(game.shop),
    rivalTeam: rival ? battleTeam(rival.shop) : [],
    rivalName: rival?.name ?? 'Rival',
    seed: `${game.seed}:combate:${round}`,
  }
}

/**
 * Aplica el resultado del combate de la ronda actual: victoria suma una
 * victoria, derrota quita una vida y empate no cambia nada. Si la partida
 * sigue, prepara la tienda de la ronda siguiente con el oro de la racha, y
 * los rivales juegan la suya con ese mismo oro. Una partida terminada no cambia.
 */
export function finishRound(game: GameState, outcome: Outcome): GameState {
  if (game.status !== 'playing') return game
  const winsGained = outcome === 'victoryA' ? 1 : 0
  const livesLost = outcome === 'victoryB' ? LIVES_LOST_PER_DEFEAT : 0
  const wins = game.wins + winsGained
  const lives = Math.max(0, game.lives - livesLost)
  const streak = updateStreak(game.streak, outcome)
  const status: GameStatus = wins >= WINS_TO_WIN ? 'won' : lives <= 0 ? 'lost' : 'playing'
  const playing = status === 'playing'
  const extraGold = streakGold(streak.count)
  return {
    ...game,
    wins,
    lives,
    streak,
    status,
    shop: playing ? nextShop(game.shop, extraGold) : game.shop,
    rivals: playing
      ? playRivals(game.rivals.map((rival) => ({ ...rival, shop: nextShop(rival.shop, extraGold) })))
      : game.rivals,
    lastRound: { round: game.shop.round, outcome, winsGained, livesLost },
  }
}
