import { describe, expect, it } from 'vitest'
import type { Outcome } from '../src/engine/combat'
import { NO_STREAK, streakGold, updateStreak, type Streak } from '../src/engine/game'
import { GOLD_PER_ROUND, createShop, nextShop } from '../src/engine/shop'
import { RACES } from '../src/engine/units'

const play = (outcomes: readonly Outcome[]): Streak =>
  outcomes.reduce((streak, outcome) => updateStreak(streak, outcome), NO_STREAK)

describe('Oro extra por rachas', () => {
  it('aplica la tabla para rachas de 0 a 6', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(streakGold)).toEqual([0, 0, 1, 2, 2, 3, 3])
  })

  it('las victorias y las derrotas seguidas cuentan igual', () => {
    expect(play(['victoryA', 'victoryA', 'victoryA'])).toEqual({ kind: 'win', count: 3 })
    expect(play(['victoryB', 'victoryB', 'victoryB'])).toEqual({ kind: 'loss', count: 3 })
  })

  it('el empate reinicia la racha', () => {
    expect(play(['victoryA', 'victoryA', 'draw'])).toEqual(NO_STREAK)
    expect(play(['victoryA', 'victoryA', 'draw', 'victoryA'])).toEqual({ kind: 'win', count: 1 })
  })

  it('cambiar de victoria a derrota reinicia la racha', () => {
    expect(play(['victoryA', 'victoryA', 'victoryB'])).toEqual({ kind: 'loss', count: 1 })
    expect(play(['victoryB', 'victoryB', 'victoryB', 'victoryA'])).toEqual({ kind: 'win', count: 1 })
  })

  it('la tienda suma el oro de racha y guarda el desglose', () => {
    const first = createShop(1, [], 'racha', RACES)
    expect(first.gold).toBe(GOLD_PER_ROUND)
    expect(first.startGold).toEqual({ base: GOLD_PER_ROUND, streak: 0 })

    const next = nextShop({ ...first, gold: 0 }, streakGold(3))
    expect(next.gold).toBe(GOLD_PER_ROUND + 2)
    expect(next.startGold).toEqual({ base: GOLD_PER_ROUND, streak: 2 })
  })
})
