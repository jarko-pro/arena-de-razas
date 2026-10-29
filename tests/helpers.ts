import { simulateBattle, type BattleEvent, type BattleResult, type TeamUnit } from '../src/engine/combat'
import type { Level, UnitId } from '../src/engine/units'

/** `team('grunt', ['skeleton', 2])` → equipo con un Grunt y un Esqueleto de nivel 2. */
export function team(...entries: readonly (UnitId | readonly [UnitId, Level])[]): TeamUnit[] {
  return entries.map((entry) =>
    typeof entry === 'string' ? { defId: entry } : { defId: entry[0], level: entry[1] },
  )
}

export function fight(
  a: readonly TeamUnit[],
  b: readonly TeamUnit[],
  seed: number | string = 1,
): BattleResult {
  return simulateBattle(a, b, seed)
}

/** Eventos de un tipo concreto, ya estrechados. */
export function eventsOf<T extends BattleEvent['type']>(
  events: readonly BattleEvent[],
  type: T,
): Extract<BattleEvent, { type: T }>[] {
  return events.filter((event): event is Extract<BattleEvent, { type: T }> => event.type === type)
}

/** Primer evento de un tipo, o undefined. */
export function firstOf<T extends BattleEvent['type']>(
  events: readonly BattleEvent[],
  type: T,
): Extract<BattleEvent, { type: T }> | undefined {
  return eventsOf(events, type)[0]
}
