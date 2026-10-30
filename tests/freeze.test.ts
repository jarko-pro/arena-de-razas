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
    expect(shop.frozen).toBe(false)
    const frozen = expectOk(toggleFreeze(shop))
    expect(frozen.frozen).toBe(true)
    expect(frozen.gold).toBe(shop.gold)
    expect(frozen.offers).toEqual(shop.offers)
    expect(expectOk(toggleFreeze(frozen)).frozen).toBe(false)
  })

  it('con la tienda congelada no se puede hacer reroll', () => {
    const frozen = expectOk(toggleFreeze(createShop(1, [], 'hielo', RACES)))
    expect(reroll(frozen)).toEqual({ ok: false, error: 'frozen' })
    const thawed = expectOk(toggleFreeze(frozen))
    expect(expectOk(reroll(thawed)).gold).toBe(thawed.gold - 1)
  })

  it('al pasar de ronda conserva las ofertas, rellena los huecos y sigue congelada', () => {
    const round2 = expectOk(toggleFreeze(createShop(2, [], 'hielo', RACES)))
    const round3 = nextShop(round2)
    expect(round3.round).toBe(3)
    expect(round3.frozen).toBe(true)
    expect(round3.offers).toHaveLength(slotsForRound(3))
    expect(round3.offers.slice(0, round2.offers.length)).toEqual(round2.offers)
    expect(round3.offers.every((offer) => offer !== null)).toBe(true)
  })

  it('sin congelar, la ronda siguiente trae ofertas nuevas', () => {
    const round1 = createShop(1, [], 'hielo', RACES)
    const ids = new Set(round1.offers.map((offer) => offer?.id))
    expect(nextShop(round1).offers.some((offer) => ids.has(offer?.id))).toBe(false)
  })

  it('una oferta de tier superior se conserva congelada', () => {
    const shop = createShop(1, [], 'hielo', RACES)
    const withKnight = { ...shop, frozen: true, offers: [{ id: 50, defId: 'knight' as const }] }
    expect(nextShop(withKnight).offers[0]).toEqual({ id: 50, defId: 'knight' })
  })

  it('comprar con la tienda congelada deja el hueco vacío hasta la ronda siguiente', () => {
    const frozen = expectOk(toggleFreeze(createShop(1, [], 'hielo', RACES)))
    const bought = expectOk(buy(frozen, 0))
    expect(bought.offers[0]).toBeNull()
    const next = nextShop(bought)
    expect(next.offers[0]).not.toBeNull()
    expect(next.offers.slice(1, 3)).toEqual(frozen.offers.slice(1, 3))
  })

  it('el equipo y su experiencia pasan a la ronda siguiente', () => {
    const shop = expectOk(buy(createShop(1, [], 'hielo', RACES), 0))
    const next = nextShop(shop)
    expect(next.team).toEqual(shop.team)
  })
})
