// Estado de la partida: rondas, vidas, victorias, rachas y rival de cada ronda.

import { MAX_TEAM_SIZE, type Outcome, type TeamUnit } from './combat'
import { createRng, type Rng } from './rng'
import { battleTeam, createShop, nextShop, shopPool, type ShopState } from './shop'
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
  readonly status: GameStatus
  readonly lastRound: RoundResult | null
}

/** Lo que necesita la pantalla de combate. */
export interface BattleSetup {
  readonly round: number
  readonly playerTeam: readonly TeamUnit[]
  readonly rivalTeam: readonly TeamUnit[]
  readonly seed: string
}

/** Partida nueva: vidas completas, sin victorias ni racha y la tienda de la ronda 1. */
export function newGame(seed: string, races: readonly Race[]): GameState {
  return {
    seed,
    races: [...races],
    lives: STARTING_LIVES,
    wins: 0,
    streak: NO_STREAK,
    shop: createShop(1, [], seed, races),
    status: 'playing',
    lastRound: null,
  }
}

/** Unidades del rival provisional: 3 en la ronda 1, 4 en la 2 y 5 desde la 3. */
export function rivalSize(round: number): number {
  return Math.min(MAX_TEAM_SIZE, round + 2)
}

/**
 * Rival provisional hasta que lleguen los bots (hito 6): unidades de nivel 1
 * al azar entre las que puede ofrecer la tienda en esa ronda.
 */
export function randomRival(round: number, rng: Rng, races: readonly Race[]): TeamUnit[] {
  const pool = shopPool(round, races)
  const team: TeamUnit[] = []
  for (let i = 0; i < rivalSize(round); i++) {
    const defId = rng.pick(pool)
    if (defId !== undefined) team.push({ defId })
  }
  return team
}

/** Equipos y semilla del combate de la ronda actual. Misma partida = mismo combate. */
export function prepareBattle(game: GameState): BattleSetup {
  const { round } = game.shop
  return {
    round,
    playerTeam: battleTeam(game.shop),
    rivalTeam: randomRival(round, createRng(`${game.seed}:rival:${round}`), game.races),
    seed: `${game.seed}:combate:${round}`,
  }
}

/**
 * Aplica el resultado del combate de la ronda actual: victoria suma una
 * victoria, derrota quita una vida y empate no cambia nada. Si la partida
 * sigue, prepara la tienda de la ronda siguiente con el oro de la racha.
 * Una partida terminada no cambia.
 */
export function finishRound(game: GameState, outcome: Outcome): GameState {
  if (game.status !== 'playing') return game
  const winsGained = outcome === 'victoryA' ? 1 : 0
  const livesLost = outcome === 'victoryB' ? LIVES_LOST_PER_DEFEAT : 0
  const wins = game.wins + winsGained
  const lives = Math.max(0, game.lives - livesLost)
  const streak = updateStreak(game.streak, outcome)
  const status: GameStatus = wins >= WINS_TO_WIN ? 'won' : lives <= 0 ? 'lost' : 'playing'
  return {
    ...game,
    wins,
    lives,
    streak,
    status,
    shop: status === 'playing' ? nextShop(game.shop, streakGold(streak.count)) : game.shop,
    lastRound: { round: game.shop.round, outcome, winsGained, livesLost },
  }
}
