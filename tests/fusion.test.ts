import { describe, expect, it } from 'vitest'
import { teamUnitStats } from '../src/engine/combat'
import {
  GOLD_PER_ROUND,
  buy,
  copiesOf,
  createShop,
  fuseTeam,
  sell,
  wouldFuse,
  type OwnedUnit,
  type ShopResult,
  type ShopState,
} from '../src/engine/shop'
import { RACES, type Level, type UnitId } from '../src/engine/units'
import { eventsOf, fight, team } from './helpers'

function expectOk(result: ShopResult): ShopState {
  if (!result.ok) throw new Error(`Acción fallida: ${result.error}`)
  return result.state
}

/** Equipo con ids 1, 2, 3...: `owned('grunt', ['zombie', 2])`. */
function owned(...entries: readonly (UnitId | readonly [UnitId, Level])[]): OwnedUnit[] {
  return team(...entries).map((unit, i) => ({ ...unit, level: unit.level ?? 1, id: i + 1 }))
}

function shopWith(offers: readonly UnitId[], members: readonly OwnedUnit[]): ShopState {
  return {
    ...createShop(1, [], 'fusion', RACES),
    team: members,
    offers: offers.map((defId, i) => ({ id: 100 + i, defId })),
    nextId: 200,
  }
}

const summary = (state: ShopState): string[] =>
  state.team.map((unit) => `${unit.defId}:${unit.level ?? 1}`)

describe('Fusión', () => {
  it('3 copias de nivel 1 se fusionan en 1 de nivel 2 con +2/+2', () => {
    const state = expectOk(buy(shopWith(['grunt'], owned('grunt', 'grunt')), 0))
    expect(summary(state)).toEqual(['grunt:2'])
    const fused = state.team[0]
    expect(fused && teamUnitStats(fused)).toEqual({ atk: 5, hp: 4 })
  })

  it('con 2 copias no hay fusión', () => {
    const state = expectOk(buy(shopWith(['grunt'], owned('grunt')), 0))
    expect(summary(state)).toEqual(['grunt:1', 'grunt:1'])
  })

  it('emite un evento con la unidad resultante y las copias consumidas', () => {
    const result = buy(shopWith(['grunt'], owned('grunt', 'grunt')), 0)
    if (!result.ok) throw new Error(result.error)
    const fusion = result.events.find((event) => event.type === 'fusion')
    expect(fusion).toEqual({ type: 'fusion', unitId: 1, consumedIds: [2, 100], level: 2 })
  })

  it('se puede comprar con el equipo lleno si forma una fusión', () => {
    const full = owned('zombie', 'grunt', 'archer', 'grunt', 'spitter')
    const state = shopWith(['grunt'], full)
    expect(wouldFuse(state, 0)).toBe(true)
    const after = expectOk(buy(state, 0))
    expect(summary(after)).toEqual(['zombie:1', 'grunt:2', 'archer:1', 'spitter:1'])
    expect(after.gold).toBe(GOLD_PER_ROUND - 3)
  })

  it('con el equipo lleno y sin fusión no se puede comprar', () => {
    const full = owned('zombie', 'grunt', 'archer', 'skeleton', 'spitter')
    const state = shopWith(['grunt'], full)
    expect(wouldFuse(state, 0)).toBe(false)
    expect(buy(state, 0)).toEqual({ ok: false, error: 'teamFull' })
  })

  it('la fusionada ocupa la posición de la copia más adelantada', () => {
    const state = expectOk(buy(shopWith(['grunt'], owned('zombie', 'grunt', 'archer', 'grunt')), 0))
    expect(summary(state)).toEqual(['zombie:1', 'grunt:2', 'archer:1'])
    expect(state.team[1]?.id).toBe(2)
  })

  it('si la copia comprada se coloca delante, la fusionada queda en su sitio', () => {
    const state = expectOk(
      buy(shopWith(['grunt'], owned('zombie', 'archer', 'grunt', 'grunt')), 0, 0),
    )
    expect(summary(state)).toEqual(['grunt:2', 'zombie:1', 'archer:1'])
    expect(state.team[0]?.id).toBe(100)
  })

  it('las fusiones se encadenan hasta el nivel 3', () => {
    const members = owned(['grunt', 2], ['grunt', 2], 'grunt', 'grunt')
    const result = buy(shopWith(['grunt'], members), 0)
    const state = expectOk(result)
    expect(summary(state)).toEqual(['grunt:3'])
    const fused = state.team[0]
    expect(fused && teamUnitStats(fused)).toEqual({ atk: 7, hp: 6 })
    if (result.ok) expect(result.events.filter((e) => e.type === 'fusion')).toHaveLength(2)
  })

  it('el nivel 3 es el máximo', () => {
    const members = owned(['grunt', 3], ['grunt', 3], ['grunt', 3])
    const { team: after, fusions } = fuseTeam(members)
    expect(fusions).toHaveLength(0)
    expect(after).toHaveLength(3)
  })

  it('la fusionada suma las mejoras permanentes de las 3 copias', () => {
    const members: OwnedUnit[] = [
      { id: 1, defId: 'grunt', level: 1, hpBonus: 1 },
      { id: 2, defId: 'grunt', level: 1, atkBonus: 2, hpBonus: 1 },
    ]
    const state = expectOk(buy(shopWith(['grunt'], members), 0))
    expect(state.team[0]).toMatchObject({ level: 2, atkBonus: 2, hpBonus: 2 })
    const fused = state.team[0]
    expect(fused && teamUnitStats(fused)).toEqual({ atk: 7, hp: 6 })
  })

  it('cuenta las copias por unidad y nivel', () => {
    const members = owned('grunt', ['grunt', 2], 'grunt', 'zombie')
    expect(copiesOf(members, 'grunt', 1)).toBe(2)
    expect(copiesOf(members, 'grunt', 2)).toBe(1)
    expect(copiesOf(members, 'zombie', 1)).toBe(1)
  })

  it('vender una unidad de nivel 2 devuelve 2 de oro', () => {
    const fused = expectOk(buy(shopWith(['grunt'], owned('grunt', 'grunt')), 0))
    expect(expectOk(sell(fused, 0)).gold).toBe(fused.gold + 2)
  })
})

describe('Al comprar con fusión', () => {
  it('el Recluta fusionado dispara su habilidad con el valor de nivel 2', () => {
    const members = owned('zombie', 'recruit', 'recruit')
    const result = buy(shopWith(['recruit'], members), 0)
    const state = expectOk(result)
    expect(summary(state)).toEqual(['zombie:1', 'recruit:2'])
    expect(state.team[0]?.hpBonus).toBe(2)
    expect(state.team[1]?.hpBonus).toBeUndefined()
    if (result.ok) {
      const types = result.events.map((event) => event.type)
      expect(types.indexOf('fusion')).toBeLessThan(types.indexOf('ability'))
    }
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
