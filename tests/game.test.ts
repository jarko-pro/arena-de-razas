import { describe, expect, it } from 'vitest'
import type { Outcome } from '../src/engine/combat'
import {
  STARTING_LIVES,
  WINS_TO_WIN,
  finishRound,
  newGame,
  prepareBattle,
  rivalForRound,
  type GameState,
} from '../src/engine/game'
import { GOLD_PER_ROUND, buy } from '../src/engine/shop'
import { RACES } from '../src/engine/units'

const play = (game: GameState, outcomes: readonly Outcome[]): GameState =>
  outcomes.reduce(finishRound, game)

const repeat = (outcome: Outcome, times: number): Outcome[] =>
  Array.from({ length: times }, () => outcome)

describe('Partida nueva', () => {
  it('empieza en la ronda 1 con 5 vidas, sin victorias ni racha', () => {
    const game = newGame('partida', RACES)
    expect(game).toMatchObject({ lives: STARTING_LIVES, wins: 0, status: 'playing', lastRound: null })
    expect(game.streak.count).toBe(0)
    expect(game.shop.round).toBe(1)
    expect(game.shop.team).toEqual([])
  })
})

describe('Resultado de cada ronda', () => {
  it('una victoria suma una victoria y no quita vidas', () => {
    const game = finishRound(newGame('partida', RACES), 'victoryA')
    expect(game).toMatchObject({ wins: 1, lives: 5 })
    expect(game.lastRound).toEqual({ round: 1, outcome: 'victoryA', winsGained: 1, livesLost: 0 })
  })

  it('una derrota quita una vida', () => {
    const game = finishRound(newGame('partida', RACES), 'victoryB')
    expect(game).toMatchObject({ wins: 0, lives: 4 })
    expect(game.lastRound).toMatchObject({ winsGained: 0, livesLost: 1 })
  })

  it('un empate no suma victoria ni quita vida', () => {
    const game = finishRound(newGame('partida', RACES), 'draw')
    expect(game).toMatchObject({ wins: 0, lives: 5, status: 'playing' })
  })

  it('pasa a la tienda de la ronda siguiente con el equipo', () => {
    const start = newGame('partida', RACES)
    const bought = buy(start.shop, 0)
    if (!bought.ok) throw new Error(bought.error)
    const game = finishRound({ ...start, shop: bought.state }, 'draw')
    expect(game.shop.round).toBe(2)
    expect(game.shop.team).toEqual(bought.state.team)
    expect(game.shop.gold).toBe(GOLD_PER_ROUND)
  })

  it('la racha da oro en la tienda siguiente', () => {
    const game = play(newGame('partida', RACES), ['victoryB', 'victoryB'])
    expect(game.streak).toEqual({ kind: 'loss', count: 2 })
    expect(game.shop.gold).toBe(GOLD_PER_ROUND + 1)
  })
})

describe('Fin de la partida', () => {
  it('se gana con 10 victorias', () => {
    const game = play(newGame('partida', RACES), repeat('victoryA', WINS_TO_WIN))
    expect(game).toMatchObject({ status: 'won', wins: 10 })
  })

  it('se pierde al quedarse sin vidas', () => {
    const game = play(newGame('partida', RACES), repeat('victoryB', STARTING_LIVES))
    expect(game).toMatchObject({ status: 'lost', lives: 0 })
  })

  it('las victorias, derrotas y empates se mezclan bien', () => {
    const outcomes: Outcome[] = ['victoryA', 'victoryB', 'draw', 'victoryA', 'victoryB']
    const game = play(newGame('partida', RACES), outcomes)
    expect(game).toMatchObject({ wins: 2, lives: 3, status: 'playing' })
    expect(game.shop.round).toBe(6)
  })

  it('una partida terminada ya no cambia', () => {
    const lost = play(newGame('partida', RACES), repeat('victoryB', STARTING_LIVES))
    expect(finishRound(lost, 'victoryA')).toBe(lost)
  })
})

describe('Rivales de la partida', () => {
  it('empieza con 4 rivales de razas distintas que ya han jugado la ronda 1', () => {
    const game = newGame('partida', RACES)
    expect(game.rivals).toHaveLength(4)
    expect(new Set(game.rivals.map((rival) => rival.race)).size).toBe(4)
    for (const rival of game.rivals) {
      expect(rival.shop.round).toBe(1)
      expect(rival.shop.team.length).toBeGreaterThan(0)
    }
  })

  it('los rivales pasan de ronda con el mismo oro extra que el jugador', () => {
    const game = play(newGame('partida', RACES), ['victoryA', 'victoryA'])
    for (const rival of game.rivals) {
      expect(rival.shop.round).toBe(3)
      expect(rival.shop.startGold).toEqual(game.shop.startGold)
    }
  })

  it('el rival de la ronda es uno de los 4 y su equipo es el de ese bot', () => {
    const game = newGame('partida', RACES)
    const rival = rivalForRound(game)
    const battle = prepareBattle(game)
    expect(rival).toBeDefined()
    expect(battle.rivalName).toBe(rival?.name)
    expect(battle.rivalTeam.map((unit) => unit.defId)).toEqual(
      rival?.shop.team.map((unit) => unit.defId),
    )
  })

  it('la elección del rival reparte entre los 4 y se puede repetir', () => {
    const game = newGame('reparto', RACES)
    const pickAt = (seed: string, round: number): string | undefined =>
      rivalForRound({ ...game, seed, shop: { ...game.shop, round } })?.name
    const seen = new Set<string | undefined>()
    let repeated = false
    for (let i = 0; i < 40; i++) {
      const seed = `semilla-${i}`
      seen.add(pickAt(seed, 1))
      if (pickAt(seed, 1) === pickAt(seed, 2)) repeated = true
    }
    expect(seen.size).toBe(4)
    expect(repeated).toBe(true)
  })

  it('es determinista: misma partida y ronda, mismo combate', () => {
    const a = prepareBattle(newGame('semilla', RACES))
    const b = prepareBattle(newGame('semilla', RACES))
    expect(a).toEqual(b)
    expect(a.round).toBe(1)
    const next = prepareBattle(finishRound(newGame('semilla', RACES), 'draw'))
    expect(next.round).toBe(2)
    expect(next.seed).not.toBe(a.seed)
  })
})
