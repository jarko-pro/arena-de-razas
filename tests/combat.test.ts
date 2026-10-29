import { describe, expect, it } from 'vitest'
import { MAX_ROUNDS, MAX_TEAM_SIZE } from '../src/engine/combat'
import { eventsOf, fight, team } from './helpers'

describe('golpe simultáneo', () => {
  it('las dos unidades de delante se golpean a la vez', () => {
    const { events } = fight(team('zombie'), team('zombie'))
    const firstRound = events.slice(
      events.findIndex((event) => event.type === 'attack'),
      events.findIndex((event) => event.type === 'attack') + 3,
    )
    expect(firstRound.map((event) => event.type)).toEqual(['attack', 'damage', 'damage'])
  })

  it('si las dos se matan a la vez, mueren las dos y es empate', () => {
    const { outcome, rounds, events } = fight(team('grunt'), team('grunt'))
    expect(outcome).toBe('draw')
    expect(rounds).toBe(1)
    expect(eventsOf(events, 'death')).toHaveLength(2)
  })

  it('el daño usa el ATK de antes del intercambio', () => {
    // El Basilisco baja 1 ATK al golpear, pero el golpe de esta ronda ya salió.
    const { events } = fight(team('basilisk'), team('zombie'))
    const [first] = eventsOf(events, 'damage')
    expect(first?.amount).toBe(2)
  })
})

describe('final del combate', () => {
  it('gana quien conserva unidades', () => {
    const { outcome, rounds } = fight(team('knight'), team('grunt'))
    expect(outcome).toBe('victoryA')
    expect(rounds).toBe(1)
  })

  it('gana el equipo B si el A se queda sin unidades', () => {
    expect(fight(team('grunt'), team('knight')).outcome).toBe('victoryB')
  })

  it('un equipo vacío pierde sin luchar', () => {
    const { outcome, rounds } = fight(team(), team('grunt'))
    expect(outcome).toBe('victoryB')
    expect(rounds).toBe(0)
  })

  it('dos equipos vacíos empatan', () => {
    expect(fight(team(), team()).outcome).toBe('draw')
  })

  it('emite un único evento final', () => {
    const { events } = fight(team('knight'), team('grunt'))
    expect(eventsOf(events, 'end')).toHaveLength(1)
    expect(events.at(-1)?.type).toBe('end')
  })
})

describe('fila y avance', () => {
  it('al morir la de delante, las de detrás avanzan', () => {
    const { events, outcome } = fight(team('grunt', 'squire'), team('grunt'))
    expect(outcome).toBe('victoryA')
    const lines = eventsOf(events, 'line').filter((event) => event.side === 'A')
    expect(lines[0]?.uids).toHaveLength(1)
  })

  it('no entran más de 5 unidades por equipo', () => {
    const { teams } = fight(
      team('grunt', 'grunt', 'grunt', 'grunt', 'grunt', 'grunt', 'grunt'),
      team('zombie'),
    )
    expect(teams.A).toHaveLength(MAX_TEAM_SIZE)
  })

  it('los uid son estables: primero el equipo A, de delante a atrás', () => {
    const { teams } = fight(team('grunt', 'squire'), team('zombie'))
    expect(teams.A.map((unit) => unit.uid)).toEqual([1, 2])
    expect(teams.B.map((unit) => unit.uid)).toEqual([3])
  })
})

describe('límite de seguridad', () => {
  it('dos Basiliscos se quedan a 0 ATK y el combate acaba en empate', () => {
    const { outcome, rounds, events } = fight(team('basilisk'), team('basilisk'))
    expect(outcome).toBe('draw')
    expect(rounds).toBe(MAX_ROUNDS)
    expect(eventsOf(events, 'attack')).toHaveLength(MAX_ROUNDS)
    expect(eventsOf(events, 'death')).toHaveLength(0)
  })

  it('el ATK no baja de 0', () => {
    const { events } = fight(team('basilisk'), team('basilisk'))
    for (const event of eventsOf(events, 'debuff')) {
      expect(event.atkNow).toBeGreaterThanOrEqual(0)
    }
  })
})
