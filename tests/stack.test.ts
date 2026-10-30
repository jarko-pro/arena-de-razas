import { describe, expect, it } from 'vitest'
import { teamUnitStats } from '../src/engine/combat'
import {
  GOLD_PER_ROUND,
  UNIT_COST,
  buy,
  canStack,
  createShop,
  levelForCopies,
  levelProgress,
  merge,
  sell,
  type OwnedUnit,
  type ShopEvent,
  type ShopResult,
  type ShopState,
} from '../src/engine/shop'
import { RACES, type UnitId } from '../src/engine/units'
import { eventsOf, fight, team } from './helpers'

function expectOk(result: ShopResult): ShopState {
  if (!result.ok) throw new Error(`Acción fallida: ${result.error}`)
  return result.state
}

function eventsOfResult(result: ShopResult): readonly ShopEvent[] {
  if (!result.ok) throw new Error(`Acción fallida: ${result.error}`)
  return result.events
}

/** Unidad del equipo con ids 1, 2, 3... y `copies` copias apiladas. */
function unit(id: number, defId: UnitId, copies = 1, extra: Partial<OwnedUnit> = {}): OwnedUnit {
  return { id, defId, copies, level: levelForCopies(copies), ...extra }
}

function shopWith(offers: readonly UnitId[], members: readonly OwnedUnit[]): ShopState {
  return {
    ...createShop(1, [], 'apilar', RACES),
    team: members,
    offers: offers.map((defId, i) => ({ id: 100 + i, defId })),
    nextId: 200,
    gold: 30,
  }
}

const summary = (state: ShopState): string[] =>
  state.team.map((u) => `${u.defId}:${u.level}:${u.copies}`)

const fullTeam = (): OwnedUnit[] => [
  unit(1, 'zombie'),
  unit(2, 'grunt'),
  unit(3, 'archer'),
  unit(4, 'skeleton'),
  unit(5, 'spitter'),
]

describe('Niveles por copias', () => {
  it('3 copias dan nivel 2 y 9 copias dan nivel 3', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(levelForCopies)).toEqual([1, 1, 2, 2, 2, 2, 2, 2, 3])
  })

  it('el progreso cuenta hacia el siguiente nivel', () => {
    expect(levelProgress(unit(1, 'grunt', 1))).toEqual({ have: 0, need: 2 })
    expect(levelProgress(unit(1, 'grunt', 2))).toEqual({ have: 1, need: 2 })
    expect(levelProgress(unit(1, 'grunt', 3))).toEqual({ have: 0, need: 6 })
    expect(levelProgress(unit(1, 'grunt', 8))).toEqual({ have: 5, need: 6 })
    expect(levelProgress(unit(1, 'grunt', 9))).toBeNull()
  })
})

describe('Comprar encima', () => {
  it('soltar sobre una unidad igual suma una copia y descuenta el oro', () => {
    const state = expectOk(buy(shopWith(['grunt'], [unit(1, 'zombie'), unit(2, 'grunt')]), 0, 1))
    expect(summary(state)).toEqual(['zombie:1:1', 'grunt:1:2'])
    expect(state.gold).toBe(30 - UNIT_COST)
  })

  it('funciona con el equipo lleno', () => {
    const base = { ...shopWith(['grunt'], fullTeam()), gold: GOLD_PER_ROUND }
    expect(canStack(base, 0)).toBe(true)
    const state = expectOk(buy(base, 0, 1))
    expect(state.team).toHaveLength(5)
    expect(state.team[1]).toMatchObject({ defId: 'grunt', copies: 2 })
    expect(state.gold).toBe(GOLD_PER_ROUND - UNIT_COST)
  })

  it('sin destino se apila sobre la unidad igual (doble clic)', () => {
    const state = expectOk(buy(shopWith(['grunt'], fullTeam()), 0))
    expect(state.team[1]).toMatchObject({ defId: 'grunt', copies: 2 })
  })

  it('con el equipo lleno y sin unidad igual no se puede comprar', () => {
    const state = shopWith(['knight'], fullTeam())
    expect(canStack(state, 0)).toBe(false)
    expect(buy(state, 0)).toEqual({ ok: false, error: 'teamFull' })
  })

  it('soltar en un hueco libre crea una unidad independiente', () => {
    const state = expectOk(buy(shopWith(['grunt'], [unit(1, 'grunt')]), 0, 1))
    expect(summary(state)).toEqual(['grunt:1:1', 'grunt:1:1'])
  })

  it('soltar sobre una unidad distinta la coloca en esa posición', () => {
    const state = expectOk(buy(shopWith(['grunt'], [unit(1, 'zombie'), unit(2, 'archer')]), 0, 0))
    expect(summary(state)).toEqual(['grunt:1:1', 'zombie:1:1', 'archer:1:1'])
  })

  it('3 copias dan nivel 2 con las estadísticas de nivel 2', () => {
    let state = shopWith(['grunt', 'grunt'], [unit(1, 'grunt')])
    state = expectOk(buy(state, 0, 0))
    const result = buy(state, 1, 0)
    state = expectOk(result)
    expect(summary(state)).toEqual(['grunt:2:3'])
    const fused = state.team[0]
    expect(fused && teamUnitStats(fused)).toEqual({ atk: 5, hp: 4 })
    expect(eventsOfResult(result)).toContainEqual({ type: 'levelUp', unitId: 1, level: 2 })
  })

  it('9 copias dan nivel 3 con las estadísticas de nivel 3', () => {
    const state = expectOk(buy(shopWith(['grunt'], [unit(1, 'grunt', 8)]), 0, 0))
    expect(summary(state)).toEqual(['grunt:3:9'])
    const fused = state.team[0]
    expect(fused && teamUnitStats(fused)).toEqual({ atk: 7, hp: 6 })
  })

  it('no se puede pasar de nivel 3 comprando encima', () => {
    const state = shopWith(['grunt'], [unit(1, 'grunt', 9)])
    expect(buy(state, 0, 0)).toEqual({ ok: false, error: 'maxLevel' })
  })

  it('sin destino, una unidad de nivel 3 no admite más copias y se compra aparte', () => {
    const state = expectOk(buy(shopWith(['grunt'], [unit(1, 'grunt', 9)]), 0))
    expect(summary(state)).toEqual(['grunt:3:9', 'grunt:1:1'])
  })

  it('se conservan los bonus permanentes al apilar', () => {
    const members = [unit(1, 'grunt', 2, { hpBonus: 1 })]
    const state = expectOk(buy(shopWith(['grunt'], members), 0, 0))
    expect(state.team[0]).toMatchObject({ level: 2, hpBonus: 1 })
    const stacked = state.team[0]
    expect(stacked && teamUnitStats(stacked)).toEqual({ atk: 5, hp: 5 })
  })

  it('"Al comprar" se activa al apilar, con el nivel resultante', () => {
    const members = [unit(1, 'zombie'), unit(2, 'recruit', 2)]
    const result = buy(shopWith(['recruit'], members), 0, 1)
    const state = expectOk(result)
    expect(state.team[1]).toMatchObject({ defId: 'recruit', level: 2 })
    expect(state.team[0]?.hpBonus).toBe(2)
    const types = eventsOfResult(result).map((event) => event.type)
    expect(types.indexOf('levelUp')).toBeLessThan(types.indexOf('ability'))
  })

  it('vender una unidad de nivel 2 devuelve 2 de oro', () => {
    const state = shopWith([], [unit(1, 'grunt', 4)])
    expect(expectOk(sell(state, 0)).gold).toBe(state.gold + 2)
  })
})

describe('Juntar dos unidades del equipo', () => {
  it('suma las copias en el destino y libera el otro hueco', () => {
    const members = [unit(1, 'grunt'), unit(2, 'zombie'), unit(3, 'grunt', 2)]
    const result = merge(shopWith([], members), 0, 2)
    const state = expectOk(result)
    expect(summary(state)).toEqual(['zombie:1:1', 'grunt:2:3'])
    expect(state.team[1]?.id).toBe(3)
    expect(eventsOfResult(result)).toContainEqual({ type: 'levelUp', unitId: 3, level: 2 })
  })

  it('no gasta oro', () => {
    const base = shopWith([], [unit(1, 'grunt'), unit(2, 'grunt')])
    expect(expectOk(merge(base, 0, 1)).gold).toBe(base.gold)
  })

  it('3 unidades de nivel 2 juntas forman una de nivel 3', () => {
    const members = [unit(1, 'grunt', 3), unit(2, 'grunt', 3), unit(3, 'grunt', 3)]
    const twoMerged = expectOk(merge(shopWith([], members), 0, 1))
    expect(summary(twoMerged)).toEqual(['grunt:2:6', 'grunt:2:3'])
    const result = merge(twoMerged, 1, 0)
    expect(summary(expectOk(result))).toEqual(['grunt:3:9'])
    expect(eventsOfResult(result)).toContainEqual({ type: 'levelUp', unitId: 2, level: 3 })
  })

  it('solo junta unidades del mismo nivel', () => {
    const members = [unit(1, 'grunt', 1), unit(2, 'grunt', 3)]
    expect(merge(shopWith([], members), 0, 1)).toEqual({ ok: false, error: 'differentLevel' })
    expect(merge(shopWith([], members), 1, 0)).toEqual({ ok: false, error: 'differentLevel' })
  })

  it('no se puede pasar de nivel 3 juntando', () => {
    const members = [unit(1, 'grunt', 7), unit(2, 'grunt', 3)]
    expect(merge(shopWith([], members), 0, 1)).toEqual({ ok: false, error: 'maxLevel' })
    const exact = [unit(1, 'grunt', 6), unit(2, 'grunt', 3)]
    expect(summary(expectOk(merge(shopWith([], exact), 0, 1)))).toEqual(['grunt:3:9'])
  })

  it('solo junta unidades iguales', () => {
    const members = [unit(1, 'grunt'), unit(2, 'zombie')]
    expect(merge(shopWith([], members), 0, 1)).toEqual({ ok: false, error: 'notSameUnit' })
  })

  it('se queda el mayor bonus de ATK y el mayor de PV', () => {
    const members = [
      unit(1, 'grunt', 1, { atkBonus: 2, hpBonus: 1 }),
      unit(2, 'grunt', 1, { hpBonus: 3 }),
    ]
    const state = expectOk(merge(shopWith([], members), 0, 1))
    expect(state.team[0]).toMatchObject({ copies: 2, atkBonus: 2, hpBonus: 3 })
  })
})

describe('Fichas según el nivel', () => {
  it('un Esqueleto de nivel 2 invoca Huesos 2/2 y uno de nivel 3, Huesos 3/3', () => {
    for (const level of [2, 3] as const) {
      const summon = eventsOf(fight(team(['skeleton', level]), team('knight')).events, 'summon')[0]
      expect([summon?.unit.atk, summon?.unit.hp]).toEqual([level, level])
    }
  })

  it('la Hidra de nivel 2 invoca Cabezas de hidra 4/4', () => {
    const { events } = fight(team(['hydra', 2]), team(['knight', 3], ['knight', 3]))
    const heads = eventsOf(events, 'summon').filter((event) => event.unit.defId === 'hydraHead')
    expect(heads.length).toBeGreaterThan(0)
    expect([heads[0]?.unit.atk, heads[0]?.unit.hp]).toEqual([4, 4])
  })
})
