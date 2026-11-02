// Rivales generados por bot: juegan la tienda con las mismas reglas que el jugador.

import { teamUnitStats } from './combat'
import { createRng } from './rng'
import {
  MAX_COPIES,
  REROLL_COST,
  MIN_UNIT_COST,
  unitCost,
  buy,
  buyPlacement,
  createShop,
  merge,
  move,
  reroll,
  sell,
  toggleFreeze,
  type OwnedUnit,
  type ShopResult,
  type ShopState,
} from './shop'
import { UNITS, type Race, type UnitId } from './units'

/** Rivales por partida (diseno.md). */
export const RIVAL_COUNT = 4

/** Nombres neutros: no deben delatar la raza preferida del rival. */
export const RIVAL_NAMES: readonly string[] = [
  'Aldara',
  'Bruno el Tuerto',
  'Cira',
  'Dorgan',
  'Elvira la Gris',
  'Fendrel',
  'Gunnar',
  'Isolda',
  'Morwen',
  'Ragnor',
  'Selene',
  'Tarkus',
]

/** Un rival: un bot con su propia tienda que juega todas las rondas. */
export interface Rival {
  readonly id: number
  readonly name: string
  /** Raza preferida. No se muestra al jugador. */
  readonly race: Race
  readonly shop: ShopState
}

/** Acción del bot en la tienda: cada una es una llamada a una función de `shop.ts`. */
export type BotAction =
  | { readonly type: 'buy'; readonly slot: number }
  | { readonly type: 'merge'; readonly from: number; readonly to: number }
  | { readonly type: 'sell'; readonly index: number }
  | { readonly type: 'reroll' }
  | { readonly type: 'freeze' }
  | { readonly type: 'move'; readonly from: number; readonly to: number }

export interface BotTurn {
  readonly rival: Rival
  /** Acciones hechas en orden, para comprobar que todas son legales. */
  readonly actions: readonly BotAction[]
}

/** Límite de seguridad de acciones por turno. */
const MAX_ACTIONS = 60
/** Mejora mínima para vender una unidad y comprar otra en su lugar. */
const REPLACE_MARGIN = 8

/**
 * Los rivales de una partida: cada uno con un nombre distinto y una raza
 * preferida distinta mientras haya razas suficientes. Su tienda ofrece las
 * mismas razas que la del jugador y todavía no han jugado ningún turno.
 */
export function createRivals(seed: string, races: readonly Race[]): Rival[] {
  const rng = createRng(`${seed}:rivales`)
  const preferred = rng.shuffle(races)
  const names = rng.shuffle(RIVAL_NAMES)
  const rivals: Rival[] = []
  for (let i = 0; i < RIVAL_COUNT; i++) {
    const race = preferred[i % preferred.length]
    const name = names[i % names.length]
    if (race === undefined || name === undefined) break
    rivals.push({ id: i, name, race, shop: createShop(1, [], `${seed}:rival:${i}`, races) })
  }
  return rivals
}

/** Aplica una acción con las funciones de la tienda. */
export function applyBotAction(state: ShopState, action: BotAction): ShopResult {
  switch (action.type) {
    case 'buy':
      return buy(state, action.slot)
    case 'merge':
      return merge(state, action.from, action.to)
    case 'sell':
      return sell(state, action.index)
    case 'reroll':
      return reroll(state)
    case 'freeze':
      return toggleFreeze(state)
    case 'move':
      return move(state, action.from, action.to)
  }
}

/** Lo que vale una unidad para el bot: el tier manda y su raza suma. */
function unitScore(defId: UnitId, race: Race): number {
  const def = UNITS[defId]
  return def.tier * 10 + (def.race === race ? 15 : 0) + (def.atk + def.hp) / 4
}

/** Lo que vale una unidad del equipo: además cuentan su nivel, copias y bonus. */
function ownedScore(unit: OwnedUnit, race: Race): number {
  const bonus = (unit.atkBonus ?? 0) + (unit.hpBonus ?? 0)
  return unitScore(unit.defId, race) + (unit.level - 1) * 12 + unit.copies * 2 + bonus
}

function weakestIndex(team: readonly OwnedUnit[], race: Race): number {
  let weakest = -1
  team.forEach((unit, i) => {
    const current = team[weakest]
    if (!current || ownedScore(unit, race) < ownedScore(current, race)) weakest = i
  })
  return weakest
}

/** Lo que haría el bot con la oferta de un hueco, o null si no le interesa. */
type BuyPlan =
  | { readonly kind: 'buy'; readonly slot: number; readonly score: number }
  | { readonly kind: 'replace'; readonly slot: number; readonly sell: number; readonly score: number }

function planFor(state: ShopState, slot: number, race: Race): BuyPlan | null {
  const offer = state.offers[slot]
  if (!offer) return null
  const placement = buyPlacement(state, slot)
  const score = unitScore(offer.defId, race)

  if (placement.kind === 'stack') {
    const target = state.team[placement.index]
    if (!target || state.gold < unitCost(offer.defId)) return null
    // Apilar siempre interesa: es lo primero que busca el bot.
    return { kind: 'buy', slot, score: ownedScore(target, race) + 100 }
  }
  if (placement.kind === 'insert') {
    return state.gold >= unitCost(offer.defId) ? { kind: 'buy', slot, score } : null
  }
  if (placement.error !== 'teamFull') return null

  // Equipo lleno: solo si mejora claramente a su unidad más débil.
  const index = weakestIndex(state.team, race)
  const weakest = state.team[index]
  if (!weakest || weakest.defId === offer.defId) return null
  if (state.gold + weakest.level < unitCost(offer.defId)) return null
  if (score < ownedScore(weakest, race) + REPLACE_MARGIN) return null
  return { kind: 'replace', slot, sell: index, score }
}

function bestPlan(state: ShopState, race: Race): BuyPlan | null {
  let best: BuyPlan | null = null
  state.offers.forEach((_, slot) => {
    const plan = planFor(state, slot, race)
    if (plan && (!best || plan.score > best.score)) best = plan
  })
  return best
}

/** Dos unidades iguales del mismo nivel que se pueden juntar. */
function findMerge(team: readonly OwnedUnit[]): { from: number; to: number } | null {
  for (let to = 0; to < team.length; to++) {
    for (let from = to + 1; from < team.length; from++) {
      const a = team[to]
      const b = team[from]
      if (!a || !b || a.defId !== b.defId || a.level !== b.level) continue
      if (a.copies + b.copies <= MAX_COPIES) return { from, to }
    }
  }
  return null
}

/** Si queda en la tienda algo que el bot querría y no ha podido pagar. */
function worthFreezing(state: ShopState, race: Race): boolean {
  return state.offers.some(
    (offer, slot) =>
      offer !== null &&
      (buyPlacement(state, slot).kind === 'stack' || UNITS[offer.defId].race === race),
  )
}

/**
 * Las de habilidad al inicio del combate (a distancia o de apoyo) van detrás,
 * salvo las que invocan: sus invocaciones aparecen detrás de ellas y, en la
 * última posición, no llegarían a luchar.
 */
function isBackline(unit: OwnedUnit): boolean {
  const ability = UNITS[unit.defId].ability
  return ability?.trigger === 'battleStart' && ability.effect.kind !== 'summon'
}

/** Orden de combate: las más resistentes delante y las de apoyo detrás. */
function battleOrder(team: readonly OwnedUnit[]): number[] {
  const toughness = (unit: OwnedUnit): number => {
    const { atk, hp } = teamUnitStats(unit)
    return hp * 2 + atk
  }
  return team
    .map((unit, index) => ({ unit, index }))
    .sort((a, b) => {
      const back = Number(isBackline(a.unit)) - Number(isBackline(b.unit))
      return back !== 0 ? back : toughness(b.unit) - toughness(a.unit) || a.index - b.index
    })
    .map(({ unit }) => unit.id)
}

/**
 * Juega un turno de tienda del bot con las mismas funciones que el jugador:
 * apila y compra (su raza primero), junta iguales, sustituye la unidad más
 * débil si aparece algo claramente mejor, hace reroll si no ve nada útil y,
 * al terminar, congela la tienda si deja algo útil sin comprar. Una tienda
 * congelada la descongela después de comprar, si necesita hacer reroll.
 */
export function playBotTurn(rival: Rival): BotTurn {
  const { race } = rival
  let state = rival.shop
  const actions: BotAction[] = []

  // Devuelve false si el motor rechaza la acción (no debería pasar).
  const act = (action: BotAction): boolean => {
    const result = applyBotAction(state, action)
    if (!result.ok) return false
    state = result.state
    actions.push(action)
    return true
  }

  while (actions.length < MAX_ACTIONS) {
    const pair = findMerge(state.team)
    if (pair) {
      if (!act({ type: 'merge', ...pair })) break
      continue
    }

    const plan = bestPlan(state, race)
    if (plan) {
      if (plan.kind === 'replace' && !act({ type: 'sell', index: plan.sell })) break
      if (!act({ type: 'buy', slot: plan.slot })) break
      continue
    }

    // Nada útil: reroll si después aún podría comprar algo.
    if (state.gold < REROLL_COST + MIN_UNIT_COST) break
    if (state.frozen && !act({ type: 'freeze' })) break
    if (!act({ type: 'reroll' })) break
  }

  if (state.frozen !== worthFreezing(state, race)) act({ type: 'freeze' })

  battleOrder(state.team).forEach((id, to) => {
    const from = state.team.findIndex((unit) => unit.id === id)
    if (from !== to) act({ type: 'move', from, to })
  })

  return { rival: { ...rival, shop: state }, actions }
}
