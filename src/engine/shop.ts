// Tienda: oro, compra, venta, reroll, congelar, reordenar y apilar copias.

import { fireShopTrigger, type ShopBuff } from './abilities'
import { MAX_TEAM_SIZE, type TeamUnit } from './combat'
import { createRng, type Rng } from './rng'
import { PLAYABLE_UNITS, type Level, type Race, type Tier, type UnitId } from './units'

/** Parámetros de la tienda (diseno.md). */
export const GOLD_PER_ROUND = 10
export const UNIT_COST = 3
export const REROLL_COST = 1
export const MAX_LEVEL: Level = 3

/** Copias totales apiladas con las que se alcanza cada nivel. */
export const COPIES_FOR_LEVEL: Record<Level, number> = { 1: 1, 2: 3, 3: 9 }
export const MAX_COPIES = COPIES_FOR_LEVEL[MAX_LEVEL]

/** Unidad del equipo con un id estable para la interfaz y sus copias apiladas. */
export interface OwnedUnit extends TeamUnit {
  readonly id: number
  readonly level: Level
  /** Copias apiladas en este hueco (experiencia): de 1 a 9. */
  readonly copies: number
}

/** Unidad a la venta en un hueco de la tienda. */
export interface ShopOffer {
  readonly id: number
  readonly defId: UnitId
}

export interface ShopState {
  readonly round: number
  readonly gold: number
  /** Desglose del oro con el que empezó la tienda. */
  readonly startGold: { readonly base: number; readonly streak: number }
  /** Huecos de la tienda; null si ya se ha comprado lo que había. */
  readonly offers: readonly (ShopOffer | null)[]
  /** Tienda congelada: sus ofertas pasan a la ronda siguiente y no se puede hacer reroll. */
  readonly frozen: boolean
  /** Equipo de delante a atrás. */
  readonly team: readonly OwnedUnit[]
  readonly seed: string
  /** Razas cuyas unidades pueden salir en la tienda. */
  readonly races: readonly Race[]
  /** Tiradas de aleatoriedad hechas en esta ronda; cada una usa su propia semilla. */
  readonly rolls: number
  readonly nextId: number
}

export type ShopError =
  | 'noOffer'
  | 'notEnoughGold'
  | 'teamFull'
  | 'noUnit'
  | 'maxLevel'
  | 'notSameUnit'
  | 'differentLevel'
  | 'frozen'

/** Lo que ha pasado en una acción, para que la interfaz lo muestre. */
export type ShopEvent =
  | { readonly type: 'ability'; readonly unitId: number; readonly label: string }
  | { readonly type: 'buff'; readonly unitId: number; readonly atk: number; readonly hp: number }
  | { readonly type: 'gold'; readonly amount: number }
  | {
      readonly type: 'stack'
      /** Unidad que recibe las copias. */
      readonly unitId: number
      /** Oferta comprada o unidad del equipo que se suma y desaparece. */
      readonly sourceId: number
      readonly copies: number
    }
  | { readonly type: 'levelUp'; readonly unitId: number; readonly level: Level }

export type ShopResult =
  | { readonly ok: true; readonly state: ShopState; readonly events: readonly ShopEvent[] }
  | { readonly ok: false; readonly error: ShopError }

export const SHOP_ERROR_TEXT: Record<ShopError, string> = {
  noOffer: 'No hay ninguna unidad en ese hueco.',
  notEnoughGold: 'No tienes oro suficiente.',
  teamFull: 'Tu equipo está lleno.',
  noUnit: 'No hay ninguna unidad en esa posición.',
  maxLevel: 'Esa unidad no puede pasar del nivel 3.',
  notSameUnit: 'Solo se pueden juntar unidades iguales.',
  differentLevel: 'Solo se pueden juntar unidades del mismo nivel.',
  frozen: 'La tienda está congelada: descongélala para hacer reroll.',
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

/** Nivel que dan esas copias apiladas: 3 → nivel 2, 9 → nivel 3. */
export function levelForCopies(copies: number): Level {
  if (copies >= COPIES_FOR_LEVEL[3]) return 3
  if (copies >= COPIES_FOR_LEVEL[2]) return 2
  return 1
}

/**
 * Progreso hacia el siguiente nivel, para los puntos de experiencia: copias
 * apiladas desde el nivel actual de las que hacen falta para subir. Nivel 1:
 * 0-1 de 2; nivel 2: 0-5 de 6.
 */
export function levelProgress(unit: OwnedUnit): { have: number; need: number } | null {
  if (unit.level >= MAX_LEVEL) return null
  const from = COPIES_FOR_LEVEL[unit.level]
  const to = COPIES_FOR_LEVEL[(unit.level + 1) as Level]
  return { have: unit.copies - from, need: to - from }
}

/** Siguiente generador de la ronda: misma semilla y mismas acciones = mismos resultados. */
function nextRng(state: ShopState): { rng: Rng; state: ShopState } {
  const rng = createRng(`${state.seed}:${state.round}:${state.rolls}`)
  return { rng, state: { ...state, rolls: state.rolls + 1 } }
}

/** Rellena los huecos de la ronda; si la tienda está congelada, sus ofertas se quedan donde están. */
function rollOffers(state: ShopState): ShopState {
  const { rng, state: next } = nextRng(state)
  const pool = shopPool(next.round, next.races)
  let nextId = next.nextId
  const slots = Math.max(slotsForRound(next.round), next.offers.length)
  const offers: (ShopOffer | null)[] = []
  for (let i = 0; i < slots; i++) {
    const current = next.offers[i]
    if (next.frozen && current) {
      offers.push(current)
      continue
    }
    const defId = rng.pick(pool)
    offers.push(defId === undefined ? null : { id: nextId++, defId })
  }
  return { ...next, offers, nextId }
}

function toOwned(unit: TeamUnit, id: number): OwnedUnit {
  const level = unit.level ?? 1
  return { ...unit, id, level, copies: COPIES_FOR_LEVEL[level] }
}

/**
 * Tienda de la primera ronda: oro completo y unidades de las razas indicadas.
 * `streakGold` es el oro extra por racha (0 si no hay).
 */
export function createShop(
  round: number,
  team: readonly TeamUnit[],
  seed: string,
  races: readonly Race[],
  streakGold = 0,
): ShopState {
  const owned = team.map((unit, i) => toOwned(unit, i + 1))
  return rollOffers({
    round,
    gold: GOLD_PER_ROUND + streakGold,
    startGold: { base: GOLD_PER_ROUND, streak: streakGold },
    offers: [],
    frozen: false,
    team: owned,
    seed,
    races: [...races],
    rolls: 0,
    nextId: owned.length + 1,
  })
}

/**
 * Tienda de la ronda siguiente: mismo equipo y oro nuevo (no se acumula). Si
 * la tienda estaba congelada, conserva sus ofertas y sigue congelada; los
 * huecos vacíos y los nuevos se rellenan.
 */
export function nextShop(previous: ShopState, streakGold = 0): ShopState {
  return rollOffers({
    ...previous,
    round: previous.round + 1,
    gold: GOLD_PER_ROUND + streakGold,
    startGold: { base: GOLD_PER_ROUND, streak: streakGold },
    offers: previous.frozen ? previous.offers : [],
    rolls: 0,
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

/** Suma copias a una unidad del equipo y recalcula su nivel. */
function addCopies(unit: OwnedUnit, copies: number): OwnedUnit {
  const total = unit.copies + copies
  return { ...unit, copies: total, level: levelForCopies(total) }
}

/**
 * Dispara "Al subir de nivel" (si ha subido) y luego `trigger` para la unidad
 * de `index`, cada uno con su propia tirada de aleatoriedad.
 */
function fireAfterStack(
  state: ShopState,
  team: OwnedUnit[],
  index: number,
  leveledUp: boolean,
  trigger: 'onBuy' | null,
): { state: ShopState; team: OwnedUnit[]; events: ShopEvent[] } {
  let current = state
  let currentTeam = team
  const events: ShopEvent[] = []
  const triggers = [...(leveledUp ? (['onLevelUp'] as const) : []), ...(trigger ? [trigger] : [])]
  for (const t of triggers) {
    const { rng, state: rolled } = nextRng(current)
    current = rolled
    const fired = fireShopTrigger(currentTeam, index, t, rng)
    currentTeam = fired.team
    const source = currentTeam[index]
    if (source) events.push(...shopTriggerEvents(currentTeam, source, fired.label, fired.buffs))
  }
  return { state: current, team: currentTeam, events }
}

/** Índice de la unidad igual sobre la que se apilaría una compra sin destino. */
function autoStackIndex(team: readonly OwnedUnit[], defId: UnitId): number {
  return team.findIndex((unit) => unit.defId === defId && unit.copies < MAX_COPIES)
}

/** Dónde acabaría una compra: apilada sobre una unidad, en un hueco nuevo o en ningún sitio. */
export type BuyPlacement =
  | { readonly kind: 'stack'; readonly index: number }
  | { readonly kind: 'insert'; readonly index: number }
  | { readonly kind: 'blocked'; readonly error: ShopError }

/**
 * Resuelve el destino de una compra. Con `position` sobre una unidad igual se
 * apila; sobre una distinta o un hueco vacío se coloca como unidad nueva. Sin
 * `position`, se apila sobre la primera unidad igual que admita copias y si
 * no hay ninguna se añade al final.
 */
export function buyPlacement(state: ShopState, slot: number, position?: number): BuyPlacement {
  const offer = state.offers[slot]
  if (!offer) return { kind: 'blocked', error: 'noOffer' }
  const team = state.team

  if (position !== undefined) {
    const target = team[position]
    if (target && target.defId === offer.defId) {
      return target.copies >= MAX_COPIES
        ? { kind: 'blocked', error: 'maxLevel' }
        : { kind: 'stack', index: position }
    }
  } else {
    const index = autoStackIndex(team, offer.defId)
    if (index >= 0) return { kind: 'stack', index }
  }

  if (team.length >= MAX_TEAM_SIZE) return { kind: 'blocked', error: 'teamFull' }
  return { kind: 'insert', index: clampIndex(position ?? team.length, team.length) }
}

/** Si la oferta se puede apilar sobre alguna unidad del equipo. */
export function canStack(state: ShopState, slot: number): boolean {
  const offer = state.offers[slot]
  return offer !== null && offer !== undefined && autoStackIndex(state.team, offer.defId) >= 0
}

/**
 * Compra la oferta del hueco `slot` (ver `buyPlacement` para el destino).
 * Apilar se permite aunque el equipo esté lleno. Después dispara "Al subir de
 * nivel" si corresponde y "Al comprar", con el nivel resultante.
 */
export function buy(state: ShopState, slot: number, position?: number): ShopResult {
  const offer = state.offers[slot]
  if (!offer) return { ok: false, error: 'noOffer' }
  if (state.gold < UNIT_COST) return { ok: false, error: 'notEnoughGold' }
  const placement = buyPlacement(state, slot, position)
  if (placement.kind === 'blocked') return { ok: false, error: placement.error }

  const team = [...state.team]
  const events: ShopEvent[] = [{ type: 'gold', amount: -UNIT_COST }]
  let leveledUp = false

  if (placement.kind === 'stack') {
    const target = team[placement.index]
    if (!target) return { ok: false, error: 'noUnit' }
    const stacked = addCopies(target, 1)
    team[placement.index] = stacked
    leveledUp = stacked.level > target.level
    events.push({ type: 'stack', unitId: target.id, sourceId: offer.id, copies: stacked.copies })
    if (leveledUp) events.push({ type: 'levelUp', unitId: target.id, level: stacked.level })
  } else {
    team.splice(placement.index, 0, { id: offer.id, defId: offer.defId, level: 1, copies: 1 })
  }

  const bought = {
    ...state,
    gold: state.gold - UNIT_COST,
    offers: state.offers.map((o, i) => (i === slot ? null : o)),
  }
  const fired = fireAfterStack(bought, team, placement.index, leveledUp, 'onBuy')
  return {
    ok: true,
    state: { ...fired.state, team: fired.team },
    events: [...events, ...fired.events],
  }
}

/**
 * Junta la unidad de `from` sobre la de `to`, que debe ser igual y del mismo
 * nivel: suma sus copias en `to` y libera `from`. Se queda el mayor bonus de
 * ATK y de PV.
 */
export function merge(state: ShopState, from: number, to: number): ShopResult {
  const source = state.team[from]
  const target = state.team[to]
  if (!source || !target || from === to) return { ok: false, error: 'noUnit' }
  if (source.defId !== target.defId) return { ok: false, error: 'notSameUnit' }
  if (source.level !== target.level) return { ok: false, error: 'differentLevel' }
  if (source.copies + target.copies > MAX_COPIES) return { ok: false, error: 'maxLevel' }

  const maxBonus = (a?: number, b?: number): number | undefined =>
    a === undefined && b === undefined ? undefined : Math.max(a ?? 0, b ?? 0)
  const merged: OwnedUnit = {
    ...addCopies(target, source.copies),
    atkBonus: maxBonus(source.atkBonus, target.atkBonus),
    hpBonus: maxBonus(source.hpBonus, target.hpBonus),
  }
  const team = state.team.map((unit, i) => (i === to ? merged : unit)).filter((_, i) => i !== from)
  const index = team.indexOf(merged)
  const leveledUp = merged.level > target.level

  const events: ShopEvent[] = [
    { type: 'stack', unitId: target.id, sourceId: source.id, copies: merged.copies },
  ]
  if (leveledUp) events.push({ type: 'levelUp', unitId: target.id, level: merged.level })
  const fired = fireAfterStack(state, team, index, leveledUp, null)
  return {
    ok: true,
    state: { ...fired.state, team: fired.team },
    events: [...events, ...fired.events],
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
  const refund = unit.level

  return {
    ok: true,
    state: { ...rolled, gold: state.gold + refund, team },
    events: [{ type: 'gold', amount: refund }, ...events],
  }
}

/** Sustituye todas las ofertas, también los huecos vacíos. No se puede con la tienda congelada. */
export function reroll(state: ShopState): ShopResult {
  if (state.frozen) return { ok: false, error: 'frozen' }
  if (state.gold < REROLL_COST) return { ok: false, error: 'notEnoughGold' }
  return {
    ok: true,
    state: rollOffers({ ...state, gold: state.gold - REROLL_COST }),
    events: [{ type: 'gold', amount: -REROLL_COST }],
  }
}

/** Congela o descongela toda la tienda. Es gratis. */
export function toggleFreeze(state: ShopState): ShopResult {
  return { ok: true, state: { ...state, frozen: !state.frozen }, events: [] }
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
