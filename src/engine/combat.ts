// Simula un combate completo y devuelve el resultado y la lista de eventos.
// La UI solo reproduce estos eventos: cada uno lleva ya el resultado calculado.

import { fireTrigger, MAX_LINE, type AbilityContext, type TriggerContext } from './abilities'
import { createRng } from './rng'
import {
  UNITS,
  statsForLevel,
  type Level,
  type ProjectileKind,
  type Race,
  type UnitId,
} from './units'

export type Side = 'A' | 'B'
export type Uid = number
export type Outcome = 'victoryA' | 'victoryB' | 'draw'

export const SIDES: readonly Side[] = ['A', 'B']
export const MAX_TEAM_SIZE = MAX_LINE
/** Límite de seguridad de diseno.md: 100 rondas de golpe simultáneo. */
export const MAX_ROUNDS = 100

/** Una unidad tal y como la guarda el equipo del jugador. */
export interface TeamUnit {
  readonly defId: UnitId
  readonly level?: Level
  /** Mejoras permanentes ganadas en la tienda ("Al comprar", "Al vender"). */
  readonly atkBonus?: number
  readonly hpBonus?: number
}

/** Estadísticas con las que la unidad empieza el combate. */
export function teamUnitStats(unit: TeamUnit): { atk: number; hp: number } {
  const base = statsForLevel(UNITS[unit.defId], unit.level ?? 1)
  return { atk: base.atk + (unit.atkBonus ?? 0), hp: base.hp + (unit.hpBonus ?? 0) }
}

/** Estado mutable de una unidad dentro de un combate. */
export interface BattleUnit {
  readonly uid: Uid
  readonly defId: UnitId
  readonly level: Level
  readonly side: Side
  atk: number
  hp: number
  maxHp: number
  alive: boolean
  hasRevived: boolean
  tookDamage: boolean
}

/** Foto de una unidad para la interfaz. */
export interface UnitSnapshot {
  readonly uid: Uid
  readonly defId: UnitId
  readonly name: string
  readonly race: Race
  readonly side: Side
  readonly level: Level
  readonly atk: number
  readonly hp: number
  readonly maxHp: number
  readonly token: boolean
}

export type BattleEvent =
  /** Se anuncia una habilidad (la píldora con su nombre). */
  | { readonly type: 'ability'; readonly uid: Uid; readonly label: string }
  /** Embestida simultánea de las dos unidades de delante. */
  | { readonly type: 'attack'; readonly uids: readonly Uid[] }
  | {
      readonly type: 'projectile'
      readonly from: Uid
      readonly to: Uid
      readonly kind: ProjectileKind
    }
  | {
      readonly type: 'damage'
      readonly uid: Uid
      readonly source: Uid
      readonly amount: number
      readonly hp: number
    }
  | { readonly type: 'heal'; readonly uid: Uid; readonly amount: number; readonly hp: number }
  | {
      readonly type: 'buff'
      readonly uid: Uid
      readonly atk: number
      readonly hp: number
      readonly atkNow: number
      readonly hpNow: number
    }
  | { readonly type: 'debuff'; readonly uid: Uid; readonly atk: number; readonly atkNow: number }
  | { readonly type: 'death'; readonly uid: Uid }
  /** Nueva fila del bando, de delante a atrás, tras muertes o invocaciones. */
  | { readonly type: 'line'; readonly side: Side; readonly uids: readonly Uid[] }
  | {
      readonly type: 'summon'
      readonly side: Side
      readonly index: number
      readonly unit: UnitSnapshot
    }
  | { readonly type: 'revive'; readonly uid: Uid; readonly index: number; readonly hp: number }
  | { readonly type: 'end'; readonly outcome: Outcome }

export interface BattleResult {
  readonly outcome: Outcome
  readonly events: readonly BattleEvent[]
  /** Equipos iniciales con los uid que usan los eventos. */
  readonly teams: { readonly A: readonly UnitSnapshot[]; readonly B: readonly UnitSnapshot[] }
  readonly rounds: number
}

export function simulateBattle(
  teamA: readonly TeamUnit[],
  teamB: readonly TeamUnit[],
  seed: number | string,
): BattleResult {
  const rng = createRng(seed)
  const events: BattleEvent[] = []
  const units = new Map<Uid, BattleUnit>()
  const lines: Record<Side, BattleUnit[]> = { A: [], B: [] }
  let nextUid = 1

  const snapshot = (unit: BattleUnit): UnitSnapshot => {
    const def = UNITS[unit.defId]
    return {
      uid: unit.uid,
      defId: unit.defId,
      name: def.name,
      race: def.race,
      side: unit.side,
      level: unit.level,
      atk: unit.atk,
      hp: unit.hp,
      maxHp: unit.maxHp,
      token: def.token === true,
    }
  }

  const createUnit = (
    defId: UnitId,
    level: Level,
    side: Side,
    stats: { atk: number; hp: number } = statsForLevel(UNITS[defId], level),
  ): BattleUnit => {
    const unit: BattleUnit = {
      uid: nextUid++,
      defId,
      level,
      side,
      atk: stats.atk,
      hp: stats.hp,
      maxHp: stats.hp,
      alive: true,
      hasRevived: false,
      tookDamage: false,
    }
    units.set(unit.uid, unit)
    return unit
  }

  /** Todas las unidades vivas: primero el equipo A, de delante a atrás. */
  const orderedUnits = (): BattleUnit[] => [...lines.A, ...lines.B]

  const emitLine = (side: Side): void => {
    events.push({ type: 'line', side, uids: lines[side].map((unit) => unit.uid) })
  }

  const removeFromLine = (unit: BattleUnit): void => {
    const line = lines[unit.side]
    const index = line.indexOf(unit)
    if (index >= 0) line.splice(index, 1)
  }

  const ctx: AbilityContext = {
    rng,
    line: (side) => lines[side],
    enemySide: (side) => (side === 'A' ? 'B' : 'A'),

    projectile: (from, to, kind) => {
      events.push({ type: 'projectile', from: from.uid, to: to.uid, kind })
    },

    damage: (target, amount, source) => {
      if (!target.alive || amount <= 0) return
      target.hp -= amount
      target.tookDamage = true
      events.push({
        type: 'damage',
        uid: target.uid,
        source: source.uid,
        amount,
        hp: target.hp,
      })
    },

    buff: (target, atk, hp) => {
      if (!target.alive) return
      target.atk += atk
      target.hp += hp
      target.maxHp += hp
      events.push({
        type: 'buff',
        uid: target.uid,
        atk,
        hp,
        atkNow: target.atk,
        hpNow: target.hp,
      })
    },

    healFull: (target) => {
      if (!target.alive) return
      const amount = target.maxHp - target.hp
      if (amount <= 0) return
      target.hp = target.maxHp
      events.push({ type: 'heal', uid: target.uid, amount, hp: target.hp })
    },

    debuffAtk: (target, amount) => {
      const before = target.atk
      target.atk = Math.max(0, target.atk - amount)
      if (target.atk === before) return
      events.push({
        type: 'debuff',
        uid: target.uid,
        atk: before - target.atk,
        atkNow: target.atk,
      })
    },

    setAtk: (target, atk) => {
      const delta = atk - target.atk
      if (delta === 0) return
      target.atk = atk
      events.push({
        type: 'buff',
        uid: target.uid,
        atk: delta,
        hp: 0,
        atkNow: target.atk,
        hpNow: target.hp,
      })
    },

    summon: (summoner, unitId, count, index, stats) => {
      const line = lines[summoner.side]
      let inserted = 0
      for (let i = 0; i < count; i++) {
        if (line.length >= MAX_LINE) break
        const unit = createUnit(
          unitId,
          1,
          summoner.side,
          stats === undefined ? undefined : { atk: stats, hp: stats },
        )
        const at = Math.min(index + inserted, line.length)
        line.splice(at, 0, unit)
        events.push({ type: 'summon', side: summoner.side, index: at, unit: snapshot(unit) })
        inserted++
      }
      if (inserted > 0) emitLine(summoner.side)
    },

    revive: (unit, hp, index) => {
      const line = lines[unit.side]
      unit.alive = true
      unit.hasRevived = true
      unit.hp = hp
      unit.tookDamage = false
      const at = Math.min(index, line.length)
      line.splice(at, 0, unit)
      events.push({ type: 'revive', uid: unit.uid, index: at, hp })
      emitLine(unit.side)
    },

    ability: (unit, label) => {
      events.push({ type: 'ability', uid: unit.uid, label })
    },
  }

  /**
   * Pasos 3 a 5 de diseno.md: "Al recibir daño", muertes y sus habilidades,
   * repitiendo mientras haya nuevos daños o muertes.
   */
  const resolveAftermath = (): void => {
    for (let guard = 0; guard < 200; guard++) {
      let acted = false

      // Paso 3: "Al recibir daño", solo si la unidad sigue viva.
      const damaged = orderedUnits().filter((unit) => unit.tookDamage)
      for (const unit of units.values()) unit.tookDamage = false
      for (const unit of damaged) {
        if (unit.alive && unit.hp > 0) {
          fireTrigger(ctx, unit, 'onDamaged')
          acted = true
        }
      }

      // Paso 4: muertes.
      const dying = orderedUnits().filter((unit) => unit.hp <= 0)
      if (dying.length > 0) {
        acted = true
        const fallen = dying.map((unit) => ({
          unit,
          lineAtDeath: [...lines[unit.side]],
          indexAtDeath: lines[unit.side].indexOf(unit),
        }))

        for (const { unit } of fallen) {
          unit.alive = false
          removeFromLine(unit)
          events.push({ type: 'death', uid: unit.uid })
        }
        for (const side of SIDES) {
          if (fallen.some(({ unit }) => unit.side === side)) emitLine(side)
        }

        for (const { unit, lineAtDeath, indexAtDeath } of fallen) {
          const tctx: TriggerContext = { lineAtDeath, indexAtDeath }
          fireTrigger(ctx, unit, 'onDeath', tctx)
          for (const ally of [...lines[unit.side]]) {
            if (ally !== unit && ally.alive && ally.hp > 0) {
              fireTrigger(ctx, ally, 'onAllyDeath')
            }
          }
          for (const other of orderedUnits()) {
            if (other !== unit && other.hp > 0) fireTrigger(ctx, other, 'onAnyDeath')
          }
        }
      }

      if (!acted) return
    }
  }

  for (const side of SIDES) {
    const team = side === 'A' ? teamA : teamB
    for (const entry of team.slice(0, MAX_LINE)) {
      lines[side].push(createUnit(entry.defId, entry.level ?? 1, side, teamUnitStats(entry)))
    }
  }

  const teams = { A: lines.A.map(snapshot), B: lines.B.map(snapshot) }

  // Inicio del combate: equipo A de delante a atrás, luego equipo B.
  for (const unit of orderedUnits()) {
    if (unit.alive && unit.hp > 0) fireTrigger(ctx, unit, 'battleStart')
  }
  resolveAftermath()

  let rounds = 0
  while (lines.A.length > 0 && lines.B.length > 0 && rounds < MAX_ROUNDS) {
    rounds++
    const a = lines.A[0]
    const b = lines.B[0]
    if (!a || !b) break

    // Paso 1: golpe simultáneo, con el ATK de antes del intercambio.
    events.push({ type: 'attack', uids: [a.uid, b.uid] })
    const atkA = a.atk
    const atkB = b.atk
    ctx.damage(b, atkA, a)
    ctx.damage(a, atkB, b)
    const aKilled = b.hp <= 0
    const bKilled = a.hp <= 0

    // Paso 2: "Al golpear" y "Al matar", solo si el atacante sigue vivo.
    if (a.hp > 0) {
      fireTrigger(ctx, a, 'onHit', { hitTarget: b })
      if (aKilled) fireTrigger(ctx, a, 'onKill', { hitTarget: b })
    }
    if (b.hp > 0) {
      fireTrigger(ctx, b, 'onHit', { hitTarget: a })
      if (bKilled) fireTrigger(ctx, b, 'onKill', { hitTarget: a })
    }

    resolveAftermath()
  }

  const aliveA = lines.A.length > 0
  const aliveB = lines.B.length > 0
  const outcome: Outcome = aliveA && !aliveB ? 'victoryA' : aliveB && !aliveA ? 'victoryB' : 'draw'
  events.push({ type: 'end', outcome })

  return { outcome, events, teams, rounds }
}
