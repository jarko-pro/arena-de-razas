import { describe, expect, it } from 'vitest'
import { teamUnitStats } from '../src/engine/combat'
import {
  GOLD_PER_ROUND,
  REROLL_COST,
  UNIT_COST,
  battleTeam,
  buy,
  createShop,
  move,
  reroll,
  sell,
  shopPool,
  slotsForRound,
  tierForRound,
  type ShopResult,
  type ShopState,
} from '../src/engine/shop'
import { RACES, UNITS, type Race, type UnitId } from '../src/engine/units'
import { fight, team } from './helpers'

function expectOk(result: ShopResult): ShopState {
  if (!result.ok) throw new Error(`Acción fallida: ${result.error}`)
  return result.state
}

/** Tienda con unas ofertas concretas, para no depender del azar. */
function shopWith(offers: readonly UnitId[], teamIds: readonly UnitId[] = [], round = 1): ShopState {
  const base = createShop(round, team(...teamIds), 'prueba', RACES)
  return {
    ...base,
    offers: offers.map((defId, i) => ({ id: 100 + i, defId })),
  }
}

describe('Huecos y tiers según la ronda', () => {
  it('3, 4 y 5 huecos', () => {
    expect([1, 2, 3, 4, 5, 9].map(slotsForRound)).toEqual([3, 3, 4, 4, 5, 5])
    for (const round of [1, 3, 5]) {
      expect(createShop(round, [], 'x', RACES).offers).toHaveLength(slotsForRound(round))
    }
  })

  it('tier 1 desde la ronda 1, tier 2 desde la 3, tier 3 desde la 5', () => {
    expect([1, 2, 3, 4, 5, 8].map(tierForRound)).toEqual([1, 1, 2, 2, 3, 3])
  })

  it('solo ofrece unidades del tier desbloqueado o inferior y nunca fichas', () => {
    for (const round of [1, 3, 5]) {
      const tier = tierForRound(round)
      expect(shopPool(round, RACES).every((id) => UNITS[id].tier <= tier && !UNITS[id].token)).toBe(true)
      let state = createShop(round, [], `tiers-${round}`, RACES)
      for (let i = 0; i < 30; i++) {
        for (const offer of state.offers) {
          expect(offer && UNITS[offer.defId].tier).toBeLessThanOrEqual(tier)
        }
        state = expectOk(reroll({ ...state, gold: 10 }))
      }
    }
    expect(shopPool(1, RACES)).toHaveLength(8)
    expect(shopPool(3, RACES)).toHaveLength(16)
    expect(shopPool(5, RACES)).toHaveLength(24)
  })
})

describe('Razas de la tienda', () => {
  it('solo ofrece unidades de las razas indicadas', () => {
    const races: readonly Race[] = ['orc', 'undead']
    expect(shopPool(5, races).every((id) => races.includes(UNITS[id].race))).toBe(true)
    expect(shopPool(5, races)).toHaveLength(12)
    let state = createShop(5, [], 'razas', races)
    for (let i = 0; i < 30; i++) {
      for (const offer of state.offers) {
        expect(offer && races.includes(UNITS[offer.defId].race)).toBe(true)
      }
      state = expectOk(reroll({ ...state, gold: 10 }))
    }
  })

  it('una sola raza en la ronda 1 ofrece sus 2 unidades de tier 1', () => {
    expect(shopPool(1, ['human'])).toEqual(['recruit', 'archer'])
  })

  it('sin razas la tienda sale vacía', () => {
    expect(createShop(1, [], 'x', []).offers).toHaveLength(0)
  })
})

describe('Oro', () => {
  it('cada ronda empieza con 10 de oro', () => {
    expect(createShop(1, [], 'x', RACES).gold).toBe(GOLD_PER_ROUND)
  })

  it('comprar cuesta 3 y deja el hueco vacío', () => {
    const state = expectOk(buy(shopWith(['grunt', 'zombie', 'archer']), 1))
    expect(state.gold).toBe(GOLD_PER_ROUND - UNIT_COST)
    expect(state.offers[1]).toBeNull()
    expect(state.team.map((u) => u.defId)).toEqual(['zombie'])
  })

  it('vender devuelve 1 de oro por nivel', () => {
    const base = shopWith([], ['grunt'])
    expect(expectOk(sell(base, 0)).gold).toBe(GOLD_PER_ROUND + 1)
    const levelTwo = { ...base, team: [{ id: 1, defId: 'grunt' as const, level: 2 as const }] }
    expect(expectOk(sell(levelTwo, 0)).gold).toBe(GOLD_PER_ROUND + 2)
    expect(expectOk(sell(levelTwo, 0)).team).toHaveLength(0)
  })

  it('reroll cuesta 1 y sustituye todos los huecos', () => {
    const bought = expectOk(buy(createShop(1, [], 'r', RACES), 0))
    const state = expectOk(reroll(bought))
    expect(state.gold).toBe(GOLD_PER_ROUND - UNIT_COST - REROLL_COST)
    expect(state.offers).toHaveLength(3)
    expect(state.offers.every((offer) => offer !== null)).toBe(true)
  })

  it('no se puede comprar sin oro', () => {
    const state = { ...shopWith(['grunt']), gold: UNIT_COST - 1 }
    expect(buy(state, 0)).toEqual({ ok: false, error: 'notEnoughGold' })
  })

  it('no se puede hacer reroll sin oro', () => {
    expect(reroll({ ...shopWith(['grunt']), gold: 0 })).toEqual({
      ok: false,
      error: 'notEnoughGold',
    })
  })

  it('con 10 de oro se compran 3 unidades y sobra 1 para un reroll', () => {
    let state = shopWith(['grunt', 'zombie', 'archer'])
    for (let slot = 0; slot < 3; slot++) state = expectOk(buy(state, slot))
    expect(state.gold).toBe(1)
    state = expectOk(reroll(state))
    expect(state.gold).toBe(0)
    expect(buy(state, 0)).toEqual({ ok: false, error: 'notEnoughGold' })
  })
})

describe('Comprar', () => {
  it('no se puede comprar con el equipo lleno', () => {
    const state = shopWith(['grunt'], ['zombie', 'zombie', 'zombie', 'zombie', 'zombie'])
    expect(buy(state, 0)).toEqual({ ok: false, error: 'teamFull' })
  })

  it('no se puede comprar un hueco vacío', () => {
    const state = expectOk(buy(shopWith(['grunt']), 0))
    expect(buy(state, 0)).toEqual({ ok: false, error: 'noOffer' })
  })

  it('coloca la unidad en la posición indicada', () => {
    const state = expectOk(buy(shopWith(['grunt'], ['zombie', 'skeleton']), 0, 1))
    expect(state.team.map((u) => u.defId)).toEqual(['zombie', 'grunt', 'skeleton'])
  })
})

describe('Reordenar', () => {
  it('mueve una unidad a otra posición', () => {
    const base = shopWith([], ['grunt', 'zombie', 'skeleton'])
    expect(expectOk(move(base, 0, 2)).team.map((u) => u.defId)).toEqual([
      'zombie',
      'skeleton',
      'grunt',
    ])
    expect(expectOk(move(base, 2, 0)).team.map((u) => u.defId)).toEqual([
      'skeleton',
      'grunt',
      'zombie',
    ])
    expect(expectOk(move(base, 0, 2)).gold).toBe(base.gold)
  })
})

describe('Al comprar', () => {
  it('el Recluta da +1 PV permanente a otro aliado', () => {
    const result = buy(shopWith(['recruit'], ['grunt']), 0)
    const state = expectOk(result)
    const grunt = state.team[0]
    expect(grunt?.hpBonus).toBe(1)
    expect(state.team[1]?.hpBonus).toBeUndefined()
    if (result.ok) {
      expect(result.events.some((e) => e.type === 'ability' && e.label === 'Instrucción')).toBe(true)
    }
  })

  it('el Recluta sin aliados no hace nada', () => {
    const result = buy(shopWith(['recruit']), 0)
    expect(expectOk(result).team[0]?.hpBonus).toBeUndefined()
    if (result.ok) expect(result.events.some((e) => e.type === 'ability')).toBe(false)
  })

  it('la mejora permanente se mantiene en combate', () => {
    const state = expectOk(buy(shopWith(['recruit'], ['grunt']), 0))
    const [grunt] = battleTeam(state)
    expect(grunt && teamUnitStats(grunt)).toEqual({ atk: 3, hp: 3 })
    const { teams } = fight(battleTeam(state), team('zombie'))
    expect(teams.A[0]?.hp).toBe(3)
  })
})

describe('Al vender', () => {
  it('la Cría de lagarto da +1/+1 permanente a otro lagarto', () => {
    const state = expectOk(sell(shopWith([], ['grunt', 'lizardWhelp', 'spitter']), 1))
    expect(state.team.map((u) => u.defId)).toEqual(['grunt', 'spitter'])
    expect(state.team[0]?.atkBonus).toBeUndefined()
    expect(state.team[1]).toMatchObject({ atkBonus: 1, hpBonus: 1 })
  })

  it('la Cría de lagarto no se mejora a sí misma', () => {
    const result = sell(shopWith([], ['lizardWhelp', 'grunt']), 0)
    const state = expectOk(result)
    expect(state.team[0]?.atkBonus).toBeUndefined()
    if (result.ok) expect(result.events.some((e) => e.type === 'ability')).toBe(false)
  })
})

describe('Determinismo', () => {
  it('misma semilla y mismas acciones = misma tienda', () => {
    const play = (): ShopState => {
      let state = createShop(5, team('grunt'), 'semilla', RACES)
      state = expectOk(reroll(state))
      state = expectOk(buy(state, 2))
      return expectOk(reroll(state))
    }
    expect(play()).toEqual(play())
  })

  it('otra semilla da otras tiendas', () => {
    const offers = (seed: string): string =>
      createShop(5, [], seed, RACES)
        .offers.map((offer) => offer?.defId)
        .join(',')
    const all = new Set(['a', 'b', 'c', 'd', 'e'].map(offers))
    expect(all.size).toBeGreaterThan(1)
  })
})
