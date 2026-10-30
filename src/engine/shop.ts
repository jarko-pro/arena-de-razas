// Tienda: oro, compra, venta, reroll, reordenar el equipo y fusiones.

import { fireShopTrigger, type ShopBuff } from './abilities'
import { MAX_TEAM_SIZE, type TeamUnit } from './combat'
import { createRng, type Rng } from './rng'
import { PLAYABLE_UNITS, type Level, type Race, type Tier, type UnitId } from './units'

/** Parámetros de la tienda (diseno.md). */
export const GOLD_PER_ROUND = 10
export const UNIT_COST = 3
export const REROLL_COST = 1
/** Copias iguales que se fusionan en una de nivel superior. */
export const COPIES_TO_FUSE = 3
export const MAX_LEVEL: Level = 3

/** Unidad del equipo con un id estable para la interfaz. */
export interface OwnedUnit extends TeamUnit {
  readonly id: number
}

/** Unidad a la venta en un hueco de la tienda. */
export interface ShopOffer {
  readonly id: number
  readonly defId: UnitId
}

export interface ShopState {
  readonly round: number
  readonly gold: number
  /** Huecos de la tienda; null si ya se ha comprado lo que había. */
  readonly offers: readonly (ShopOffer | null)[]
  /** Equipo de delante a atrás. */
  readonly team: readonly OwnedUnit[]
  readonly seed: string
  /** Razas cuyas unidades pueden salir en la tienda. */
  readonly races: readonly Race[]
  /** Tiradas de aleatoriedad hechas en esta ronda; cada una usa su propia semilla. */
  readonly rolls: number
  readonly nextId: number
}

export type ShopError = 'noOffer' | 'notEnoughGold' | 'teamFull' | 'noUnit'

/** Lo que ha pasado en una acción, para que la interfaz lo muestre. */
export type ShopEvent =
  | { readonly type: 'ability'; readonly unitId: number; readonly label: string }
  | { readonly type: 'buff'; readonly unitId: number; readonly atk: number; readonly hp: number }
  | { readonly type: 'gold'; readonly amount: number }
  | {
      readonly type: 'fusion'
      /** Unidad resultante: conserva el id de la copia más adelantada. */
      readonly unitId: number
      /** Copias que desaparecen al fusionarse. */
      readonly consumedIds: readonly number[]
      readonly level: Level
    }

export type ShopResult =
  | { readonly ok: true; readonly state: ShopState; readonly events: readonly ShopEvent[] }
  | { readonly ok: false; readonly error: ShopError }

export const SHOP_ERROR_TEXT: Record<ShopError, string> = {
  noOffer: 'No hay ninguna unidad en ese hueco.',
  notEnoughGold: 'No tienes oro suficiente.',
  teamFull: 'Tu equipo está lleno.',
  noUnit: 'No hay ninguna unidad en esa posición.',
}

/** Huecos de la tienda: 3 (rondas 1‑2), 4 (rondas 3‑4), 5 (ronda 5 en adelante). */
export function slotsForRound(round: number): number {
  if (round >= 5) return 5
  if (round >= 3) return 4
  return 3
}

/** Tier desbloqueado: 1 desde la ronda 1, 2 desde la 3, 3 desde la 5. */
export function tierForRound(round: number): Tier {
  if (round >= 5) return 3
  if (round >= 3) return 2
  return 1
}

/** Unidades de esas razas que pueden salir en la tienda en esa ronda (sin fichas). */
export function shopPool(round: number, races: readonly Race[]): readonly UnitId[] {
  const tier = tierForRound(round)
  return PLAYABLE_UNITS.filter((unit) => unit.tier <= tier && races.includes(unit.race)).map(
    (unit) => unit.id,
  )
}

/** Siguiente generador de la ronda: misma semilla y mismas acciones = mismos resultados. */
function nextRng(state: ShopState): { rng: Rng; state: ShopState } {
  const rng = createRng(`${state.seed}:${state.round}:${state.rolls}`)
  return { rng, state: { ...state, rolls: state.rolls + 1 } }
}

function rollOffers(state: ShopState): ShopState {
  const { rng, state: next } = nextRng(state)
  const pool = shopPool(next.round, next.races)
  let nextId = next.nextId
  const offers: ShopOffer[] = []
  for (let i = 0; i < slotsForRound(next.round); i++) {
    const defId = rng.pick(pool)
    if (defId !== undefined) offers.push({ id: nextId++, defId })
  }
  return { ...next, offers, nextId }
}

/**
 * Tienda al empezar una ronda: oro completo (no se acumula) y unidades nuevas
 * de las razas indicadas.
 */
export function createShop(
  round: number,
  team: readonly TeamUnit[],
  seed: string,
  races: readonly Race[],
): ShopState {
  const owned = team.map((unit, i) => ({ ...unit, id: i + 1 }))
  return rollOffers({
    round,
    gold: GOLD_PER_ROUND,
    offers: [],
    team: owned,
    seed,
    races: [...races],
    rolls: 0,
    nextId: owned.length + 1,
  })
}

function clampIndex(index: number, max: number): number {
  return Math.max(0, Math.min(Math.trunc(index), max))
}

function shopTriggerEvents(
  team: readonly OwnedUnit[],
  source: OwnedUnit,
  label: string | undefined,
  buffs: readonly ShopBuff[],
): ShopEvent[] {
  if (label === undefined) return []
  const events: ShopEvent[] = [{ type: 'ability', unitId: source.id, label }]
  for (const buff of buffs) {
    const target = team[buff.index]
    if (target) events.push({ type: 'buff', unitId: target.id, atk: buff.atk, hp: buff.hp })
  }
  return events
}

export interface Fusion {
  readonly unitId: number
  readonly consumedIds: readonly number[]
  readonly level: Level
}

/** Copias de esa unidad y ese nivel que hay en el equipo. */
export function copiesOf(team: readonly TeamUnit[], defId: UnitId, level: Level): number {
  return team.filter((unit) => unit.defId === defId && (unit.level ?? 1) === level).length
}

/**
 * Fusiona cada grupo de 3 copias iguales del mismo nivel en una de nivel
 * superior, en la posición de la más adelantada y con la suma de sus mejoras.
 * Repite hasta que no quede ningún grupo, así que las fusiones se encadenan.
 */
export function fuseTeam<T extends OwnedUnit>(
  team: readonly T[],
): { team: T[]; fusions: Fusion[] } {
  let current = [...team]
  const fusions: Fusion[] = []

  for (;;) {
    const group = current.find(
      (unit) =>
        (unit.level ?? 1) < MAX_LEVEL &&
        copiesOf(current, unit.defId, unit.level ?? 1) >= COPIES_TO_FUSE,
    )
    if (!group) return { team: current, fusions }

    const level = group.level ?? 1
    const copies = current
      .filter((unit) => unit.defId === group.defId && (unit.level ?? 1) === level)
      .slice(0, COPIES_TO_FUSE)
    const [first, ...consumed] = copies
    if (!first) return { team: current, fusions }

    const nextLevel = (level + 1) as Level
    const sum = (key: 'atkBonus' | 'hpBonus'): number | undefined => {
      const total = copies.reduce((acc, unit) => acc + (unit[key] ?? 0), 0)
      return total === 0 ? undefined : total
    }
    const fused: T = { ...first, level: nextLevel, atkBonus: sum('atkBonus'), hpBonus: sum('hpBonus') }
    current = current
      .filter((unit) => !consumed.includes(unit))
      .map((unit) => (unit === first ? fused : unit))
    fusions.push({ unitId: first.id, consumedIds: consumed.map((unit) => unit.id), level: nextLevel })
  }
}

/** Si comprar la oferta de ese hueco completaría una fusión. */
export function wouldFuse(state: ShopState, slot: number): boolean {
  const offer = state.offers[slot]
  return offer !== null && offer !== undefined && copiesOf(state.team, offer.defId, 1) >= COPIES_TO_FUSE - 1
}

/**
 * Compra la unidad del hueco `slot` y la coloca en `position` (al final si no
 * se indica). Si completa una fusión se puede comprar con el equipo lleno.
 * Después de fusionar, la unidad resultante dispara "Al comprar".
 */
export function buy(state: ShopState, slot: number, position?: number): ShopResult {
  const offer = state.offers[slot]
  if (!offer) return { ok: false, error: 'noOffer' }
  if (state.gold < UNIT_COST) return { ok: false, error: 'notEnoughGold' }
  if (state.team.length >= MAX_TEAM_SIZE && !wouldFuse(state, slot)) {
    return { ok: false, error: 'teamFull' }
  }

  const unit: OwnedUnit = { id: offer.id, defId: offer.defId, level: 1 }
  const inserted = [...state.team]
  inserted.splice(clampIndex(position ?? inserted.length, inserted.length), 0, unit)
  const { team, fusions } = fuseTeam(inserted)
  // La última fusión es la que contiene la copia comprada (las demás son su cadena).
  const resultId = fusions.at(-1)?.unitId ?? unit.id
  const index = team.findIndex((u) => u.id === resultId)

  const { rng, state: rolled } = nextRng(state)
  const fired = fireShopTrigger(team, index, 'onBuy', rng)
  const result = team[index] ?? unit
  return {
    ok: true,
    state: {
      ...rolled,
      gold: state.gold - UNIT_COST,
      offers: state.offers.map((o, i) => (i === slot ? null : o)),
      team: fired.team,
    },
    events: [
      { type: 'gold', amount: -UNIT_COST },
      ...fusions.map((fusion): ShopEvent => ({ type: 'fusion', ...fusion })),
      ...shopTriggerEvents(fired.team, result, fired.label, fired.buffs),
    ],
  }
}

/** Vende la unidad en `index`: devuelve 1 de oro por nivel y dispara "Al vender". */
export function sell(state: ShopState, index: number): ShopResult {
  const unit = state.team[index]
  if (!unit) return { ok: false, error: 'noUnit' }

  // La habilidad se resuelve con la unidad aún en el equipo para saber dónde estaba.
  const { rng, state: rolled } = nextRng(state)
  const fired = fireShopTrigger(state.team, index, 'onSell', rng)
  const events = shopTriggerEvents(fired.team, unit, fired.label, fired.buffs)
  const team = fired.team.filter((_, i) => i !== index)
  const refund = unit.level ?? 1

  return {
    ok: true,
    state: { ...rolled, gold: state.gold + refund, team },
    events: [{ type: 'gold', amount: refund }, ...events],
  }
}

/** Sustituye todas las unidades de la tienda, también los huecos vacíos. */
export function reroll(state: ShopState): ShopResult {
  if (state.gold < REROLL_COST) return { ok: false, error: 'notEnoughGold' }
  return {
    ok: true,
    state: rollOffers({ ...state, gold: state.gold - REROLL_COST }),
    events: [{ type: 'gold', amount: -REROLL_COST }],
  }
}

/** Mueve la unidad de `from` a `to` dentro del equipo. */
export function move(state: ShopState, from: number, to: number): ShopResult {
  const unit = state.team[from]
  if (!unit) return { ok: false, error: 'noUnit' }
  const team = state.team.filter((_, i) => i !== from)
  team.splice(clampIndex(to, team.length), 0, unit)
  return { ok: true, state: { ...state, team }, events: [] }
}

/** El equipo tal y como entra en combate. */
export function battleTeam(state: ShopState): TeamUnit[] {
  return state.team.map(({ defId, level, atkBonus, hpBonus }) => ({
    defId,
    level,
    atkBonus,
    hpBonus,
  }))
}
