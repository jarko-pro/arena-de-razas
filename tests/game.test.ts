import { describe, expect, it } from 'vitest'
import type { Outcome } from '../src/engine/combat'
import {
  STARTING_LIVES,
  WINS_TO_WIN,
  finishRound,
  newGame,
  prepareBattle,
  randomRival,
  rivalSize,
  type GameState,
} from '../src/engine/game'
import { createRng } from '../src/engine/rng'
import { GOLD_PER_ROUND, buy, shopPool } from '../src/engine/shop'
import { RACES, UNITS } from '../src/engine/units'

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

describe('Rival provisional', () => {
  it('tiene 3, 4 y luego 5 unidades', () => {
    expect([1, 2, 3, 4, 8].map(rivalSize)).toEqual([3, 4, 5, 5, 5])
    expect(randomRival(1, createRng(1), RACES)).toHaveLength(3)
    expect(randomRival(6, createRng(1), RACES)).toHaveLength(5)
  })

  it('solo usa unidades de nivel 1 que la tienda puede ofrecer en esa ronda', () => {
    for (const round of [1, 3, 5]) {
      const pool = shopPool(round, RACES)
      for (const unit of randomRival(round, createRng(round), RACES)) {
        expect(pool).toContain(unit.defId)
        expect(unit.level ?? 1).toBe(1)
      }
    }
  })

  it('respeta las razas disponibles', () => {
    for (const unit of randomRival(5, createRng('orcos'), ['orc'])) {
      expect(UNITS[unit.defId].race).toBe('orc')
    }
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
