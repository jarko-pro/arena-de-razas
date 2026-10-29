import { describe, expect, it } from 'vitest'
import { fight, team } from './helpers'

const PLAYER = team('knight', 'berserker', 'archer', 'shaman', 'cleric')
const RIVAL = team('saurian', 'basilisk', 'skeleton', 'spitter', 'necromancer')

const trace = (seed: number | string): string => JSON.stringify(fight(PLAYER, RIVAL, seed).events)

describe('determinismo', () => {
  it('la misma semilla y los mismos equipos dan el mismo combate', () => {
    expect(trace(123)).toBe(trace(123))
  })

  it('el resultado también es el mismo', () => {
    const first = fight(PLAYER, RIVAL, 'arena')
    const second = fight(PLAYER, RIVAL, 'arena')
    expect(second.outcome).toBe(first.outcome)
    expect(second.rounds).toBe(first.rounds)
    expect(second.teams).toEqual(first.teams)
  })

  it('no hay estado compartido entre combates', () => {
    const before = trace(7)
    fight(RIVAL, PLAYER, 999)
    fight(PLAYER, RIVAL, 1)
    expect(trace(7)).toBe(before)
  })

  it('semillas distintas producen combates distintos', () => {
    const variants = new Set(Array.from({ length: 25 }, (_, seed) => trace(seed)))
    expect(variants.size).toBeGreaterThan(1)
  })

  it('el azar solo entra por la semilla: el Arquero elige objetivos distintos', () => {
    const targets = new Set(
      Array.from({ length: 25 }, (_, seed) => {
        const { events } = fight(team('archer'), team('zombie', 'zombie', 'zombie'), seed)
        return events.find((event) => event.type === 'projectile')?.to
      }),
    )
    expect(targets.size).toBeGreaterThan(1)
  })

  it('el nivel cambia el combate', () => {
    const level1 = fight(team('grunt'), team('grunt'), 1)
    const level2 = fight(team(['grunt', 2]), team('grunt'), 1)
    expect(level1.outcome).toBe('draw')
    expect(level2.outcome).toBe('victoryA')
  })
})
