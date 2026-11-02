// Simulación de partidas entre bots para medir el equilibrio de razas y unidades.
//
// Una sala tiene un bot por raza preferida. Todos juegan la tienda cada ronda
// con su propio oro por racha y, mientras sigan en juego, combaten contra uno
// de los demás al azar. Cada combate cuenta solo para la partida del bot que
// lo juega, como el jugador contra sus rivales: gana con 10 victorias y pierde
// al quedarse sin vidas.

import { createRivals, playBotTurn, type Rival } from './bot'
import { simulateBattle, type Outcome } from './combat'
import {
  LIVES_LOST_PER_DEFEAT,
  NO_STREAK,
  STARTING_LIVES,
  WINS_TO_WIN,
  streakGold,
  updateStreak,
  type GameStatus,
  type Streak,
} from './game'
import { createRng } from './rng'
import { battleTeam, nextShop } from './shop'
import type { Level, Race, UnitId } from './units'

/** Límite de seguridad: una partida que no acaba en estas rondas no cuenta como ganada. */
export const MAX_SIMULATED_ROUNDS = 60

/** Unidad tal como llegó a un combate, para las estadísticas. */
export interface UnitAppearance {
  readonly defId: UnitId
  readonly level: Level
}

/** Un combate de la sala, visto desde el bot que lo juega (equipo A). */
export interface SimulatedBattle {
  readonly round: number
  readonly races: readonly [Race, Race]
  readonly teams: readonly [readonly UnitAppearance[], readonly UnitAppearance[]]
  readonly outcome: Outcome
}

/** Cómo terminó la partida de cada bot de la sala. */
export interface BotGame {
  readonly race: Race
  readonly status: GameStatus
  /** Ronda en la que terminó (o el límite si no terminó). */
  readonly rounds: number
}

export interface LobbyResult {
  readonly games: readonly BotGame[]
  readonly battles: readonly SimulatedBattle[]
}

interface Player {
  readonly rival: Rival
  readonly lives: number
  readonly wins: number
  readonly streak: Streak
  readonly status: GameStatus
  readonly rounds: number
}

function record(player: Player, outcome: Outcome, round: number): Player {
  const wins = player.wins + (outcome === 'victoryA' ? 1 : 0)
  const lives = player.lives - (outcome === 'victoryB' ? LIVES_LOST_PER_DEFEAT : 0)
  const status: GameStatus = wins >= WINS_TO_WIN ? 'won' : lives <= 0 ? 'lost' : 'playing'
  return { ...player, wins, lives, status, streak: updateStreak(player.streak, outcome), rounds: round }
}

/** Juega una sala completa. Misma semilla y mismas razas = mismo resultado. */
export function playLobby(seed: string, races: readonly Race[]): LobbyResult {
  let players: Player[] = createRivals(seed, races).map((rival) => ({
    rival,
    lives: STARTING_LIVES,
    wins: 0,
    streak: NO_STREAK,
    status: 'playing',
    rounds: 0,
  }))
  const battles: SimulatedBattle[] = []

  for (let round = 1; round <= MAX_SIMULATED_ROUNDS; round++) {
    if (players.every((p) => p.status !== 'playing')) break

    // Todos juegan la tienda, también los que ya terminaron: siguen siendo rivales.
    players = players.map((p) => {
      const shop = round === 1 ? p.rival.shop : nextShop(p.rival.shop, streakGold(p.streak.count))
      return { ...p, rival: playBotTurn({ ...p.rival, shop }).rival }
    })

    const rng = createRng(`${seed}:sala:${round}`)
    players = players.map((p, i) => {
      if (p.status !== 'playing') return p
      const opponent = rng.pick(players.filter((_, j) => j !== i))
      if (!opponent) return p
      const a = battleTeam(p.rival.shop)
      const b = battleTeam(opponent.rival.shop)
      const { outcome } = simulateBattle(a, b, `${seed}:combate:${round}:${i}`)
      const appearances = (team: typeof a): UnitAppearance[] =>
        team.map(({ defId, level }) => ({ defId, level: level ?? 1 }))
      battles.push({
        round,
        races: [p.rival.race, opponent.rival.race],
        teams: [appearances(a), appearances(b)],
        outcome,
      })
      return record(p, outcome, round)
    })
  }

  return {
    games: players.map((p) => ({
      race: p.rival.race,
      status: p.status,
      rounds: p.status === 'playing' ? MAX_SIMULATED_ROUNDS : p.rounds,
    })),
    battles,
  }
}

export interface RaceStats {
  readonly games: number
  readonly won: number
  /** Ronda media en la que terminan sus partidas. */
  readonly averageRounds: number
}

export interface MatchupStats {
  readonly battles: number
  readonly won: number
  readonly lost: number
}

export interface UnitStats {
  /** Combates en los que estaba en el equipo. */
  readonly battles: number
  /** De esos, los que ganó su equipo. */
  readonly won: number
  readonly maxLevel: Level | 0
}

export interface SimulationSummary {
  readonly lobbies: number
  readonly races: Readonly<Record<string, RaceStats>>
  /** `matchups[a][b]`: combates de un bot de raza `a` contra uno de raza `b`. */
  readonly matchups: Readonly<Record<string, Readonly<Record<string, MatchupStats>>>>
  readonly units: Readonly<Record<string, UnitStats>>
}

/** Juega `count` salas con semillas derivadas de `seed` y resume los resultados. */
export function simulate(seed: string, races: readonly Race[], count: number): SimulationSummary {
  const lobbies = Array.from({ length: count }, (_, i) => playLobby(`${seed}:${i}`, races))
  return summarize(lobbies)
}

export function summarize(lobbies: readonly LobbyResult[]): SimulationSummary {
  const races: Record<string, { games: number; won: number; rounds: number }> = {}
  const matchups: Record<string, Record<string, { battles: number; won: number; lost: number }>> = {}
  const units: Record<string, { battles: number; won: number; maxLevel: Level | 0 }> = {}

  for (const lobby of lobbies) {
    for (const game of lobby.games) {
      const stats = (races[game.race] ??= { games: 0, won: 0, rounds: 0 })
      stats.games++
      stats.rounds += game.rounds
      if (game.status === 'won') stats.won++
    }
    for (const battle of lobby.battles) {
      const [a, b] = battle.races
      const matchup = ((matchups[a] ??= {})[b] ??= { battles: 0, won: 0, lost: 0 })
      matchup.battles++
      if (battle.outcome === 'victoryA') matchup.won++
      if (battle.outcome === 'victoryB') matchup.lost++

      battle.teams.forEach((team, side) => {
        const teamWon = battle.outcome === (side === 0 ? 'victoryA' : 'victoryB')
        // Cada unidad cuenta una vez por combate aunque haya dos iguales.
        const seen = new Map<UnitId, Level>()
        for (const unit of team) seen.set(unit.defId, Math.max(seen.get(unit.defId) ?? 1, unit.level) as Level)
        for (const [defId, level] of seen) {
          const stats = (units[defId] ??= { battles: 0, won: 0, maxLevel: 0 })
          stats.battles++
          if (teamWon) stats.won++
          if (level > stats.maxLevel) stats.maxLevel = level
        }
      })
    }
  }

  return {
    lobbies: lobbies.length,
    races: Object.fromEntries(
      Object.entries(races).map(([race, s]) => [
        race,
        { games: s.games, won: s.won, averageRounds: s.games === 0 ? 0 : s.rounds / s.games },
      ]),
    ),
    matchups,
    units,
  }
}
