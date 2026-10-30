import { describe, expect, it } from 'vitest'
import {
  buy,
  createShop,
  nextShop,
  reroll,
  slotsForRound,
  toggleFreeze,
  type ShopResult,
  type ShopState,
} from '../src/engine/shop'
import { RACES } from '../src/engine/units'

function expectOk(result: ShopResult): ShopState {
  if (!result.ok) throw new Error(`Acción fallida: ${result.error}`)
  return result.state
}

describe('Congelar la tienda', () => {
  it('congelar y descongelar es gratis', () => {
    const shop = createShop(1, [], 'hielo', RACES)
    const frozen = expectOk(toggleFreeze(shop, 1))
    expect(frozen.offers[1]?.frozen).toBe(true)
    expect(frozen.gold).toBe(shop.gold)
    expect(expectOk(toggleFreeze(frozen, 1)).offers[1]?.frozen).toBeUndefined()
  })

  it('el reroll mantiene las congeladas en su hueco', () => {
    let state = expectOk(toggleFreeze(createShop(1, [], 'hielo', RACES), 1))
    const kept = state.offers[1]
    for (let i = 0; i < 10; i++) {
      state = expectOk(reroll({ ...state, gold: 10 }))
      expect(state.offers[1]).toEqual(kept)
      expect(state.offers[0]?.frozen).toBeUndefined()
    }
  })

  it('al pasar de ronda se mantienen las congeladas y se rellena el resto', () => {
    const round2 = expectOk(toggleFreeze(createShop(2, [], 'hielo', RACES), 2))
    const kept = round2.offers[2]
    const round3 = nextShop(round2)
    expect(round3.round).toBe(3)
    expect(round3.offers).toHaveLength(slotsForRound(3))
    expect(round3.offers[2]).toEqual(kept)
    expect(round3.offers.every((offer) => offer !== null)).toBe(true)
    // Las no congeladas son ofertas nuevas.
    expect(round3.offers[0]?.id).not.toBe(round2.offers[0]?.id)
  })

  it('una congelada de tier superior se conserva', () => {
    const shop = createShop(1, [], 'hielo', RACES)
    const withKnight = { ...shop, offers: [{ id: 50, defId: 'knight' as const, frozen: true }] }
    const state = expectOk(reroll(withKnight))
    expect(state.offers[0]).toEqual({ id: 50, defId: 'knight', frozen: true })
    expect(nextShop(state).offers[0]).toEqual({ id: 50, defId: 'knight', frozen: true })
  })

  it('comprar una congelada libera el hueco y deja de estar congelado', () => {
    const frozen = expectOk(toggleFreeze(createShop(1, [], 'hielo', RACES), 0))
    const bought = expectOk(buy(frozen, 0))
    expect(bought.offers[0]).toBeNull()
    expect(bought.team[0]).not.toHaveProperty('frozen')
    // En la ronda siguiente ese hueco se rellena con una oferta nueva.
    expect(nextShop(bought).offers[0]?.frozen).toBeUndefined()
  })

  it('el equipo y su experiencia pasan a la ronda siguiente', () => {
    const shop = expectOk(buy(createShop(1, [], 'hielo', RACES), 0))
    const next = nextShop(shop)
    expect(next.team).toEqual(shop.team)
  })
})
