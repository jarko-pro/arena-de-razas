import { describe, expect, it } from 'vitest'
import { STARTING_LIVES, WINS_TO_WIN } from '../src/engine/game'
import { MAX_SIMULATED_ROUNDS, playLobby, simulate, summarize } from '../src/engine/simulation'
import { RACES } from '../src/engine/units'

describe('Sala de bots', () => {
  it('misma semilla = mismo resultado', () => {
    expect(playLobby('sala', RACES)).toEqual(playLobby('sala', RACES))
  })

  it('otra semilla da otra sala', () => {
    expect(playLobby('sala', RACES)).not.toEqual(playLobby('otra', RACES))
  })

  it('un bot por raza y todas las partidas terminan', () => {
    const { games } = playLobby('fin', RACES)
    expect(games.map((g) => g.race).sort()).toEqual([...RACES].sort())
    for (const game of games) {
      expect(['won', 'lost']).toContain(game.status)
      expect(game.rounds).toBeLessThanOrEqual(MAX_SIMULATED_ROUNDS)
    }
  })

  it('cada bot combate una vez por ronda mientras sigue en juego, nunca contra sí mismo', () => {
    const { games, battles } = playLobby('combates', RACES)
    for (const game of games) {
      const own = battles.filter((b) => b.races[0] === game.race)
      expect(own).toHaveLength(game.rounds)
      expect(own.every((b) => b.races[1] !== game.race)).toBe(true)
    }
  })

  it('una partida ganada tiene 10 victorias y una perdida, 5 derrotas', () => {
    const { games, battles } = playLobby('cuentas', RACES)
    for (const game of games) {
      const own = battles.filter((b) => b.races[0] === game.race)
      const won = own.filter((b) => b.outcome === 'victoryA').length
      const lost = own.filter((b) => b.outcome === 'victoryB').length
      if (game.status === 'won') expect(won).toBe(WINS_TO_WIN)
      if (game.status === 'lost') expect(lost).toBe(STARTING_LIVES)
    }
  })
})

describe('Resumen', () => {
  it('cuenta partidas, combates y unidades de forma coherente', () => {
    const lobbies = [playLobby('a', RACES), playLobby('b', RACES)]
    const summary = summarize(lobbies)
    const totalBattles = lobbies.reduce((sum, l) => sum + l.battles.length, 0)

    expect(summary.lobbies).toBe(2)
    for (const race of RACES) expect(summary.races[race]?.games).toBe(2)

    const matchupBattles = Object.values(summary.matchups)
      .flatMap((row) => Object.values(row))
      .reduce((sum, m) => sum + m.battles, 0)
    expect(matchupBattles).toBe(totalBattles)

    for (const stats of Object.values(summary.units)) {
      expect(stats.won).toBeLessThanOrEqual(stats.battles)
      expect(stats.battles).toBeLessThanOrEqual(totalBattles * 2)
    }
  })

  it('simulate es determinista', () => {
    expect(simulate('det', RACES, 3)).toEqual(simulate('det', RACES, 3))
  })
})
