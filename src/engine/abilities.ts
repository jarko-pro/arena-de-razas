// Ejecución de habilidades: resolución de objetivos y despacho de efectos.
// Nada de casos especiales por unidad: todo sale de los datos de units.ts.

import type { BattleUnit, Side } from './combat'
import type { Rng } from './rng'
import {
  UNITS,
  resolveValue,
  type Effect,
  type ProjectileKind,
  type Target,
  type Trigger,
  type UnitId,
} from './units'

/** Datos del momento en que se dispara la habilidad. */
export interface TriggerContext {
  /** Objetivo del golpe, para "Al golpear" y "Al matar". */
  readonly hitTarget?: BattleUnit
  /** Fila del equipo justo antes de retirar a la unidad, para "Al morir". */
  readonly lineAtDeath?: readonly BattleUnit[]
  /** Posición que ocupaba la unidad al morir. */
  readonly indexAtDeath?: number
}

/**
 * Lo que una habilidad puede hacer sobre el combate. Lo implementa combat.ts,
 * que es quien aplica los cambios al estado y emite los eventos.
 */
export interface AbilityContext {
  readonly rng: Rng
  /** Fila viva del bando, de delante a atrás. */
  line(side: Side): readonly BattleUnit[]
  enemySide(side: Side): Side
  projectile(from: BattleUnit, to: BattleUnit, kind: ProjectileKind): void
  damage(target: BattleUnit, amount: number, source: BattleUnit): void
  buff(target: BattleUnit, atk: number, hp: number): void
  healFull(target: BattleUnit): void
  debuffAtk(target: BattleUnit, amount: number): void
  setAtk(target: BattleUnit, atk: number): void
  summon(
    summoner: BattleUnit,
    unitId: UnitId,
    count: number,
    index: number,
    stats?: number,
  ): void
  revive(unit: BattleUnit, hp: number, index: number): void
  ability(unit: BattleUnit, label: string): void
}

/** Capacidad máxima de una fila (diseno.md: 5 unidades). */
export const MAX_LINE = 5

function isTargetable(unit: BattleUnit | undefined): unit is BattleUnit {
  return unit !== undefined && unit.alive && unit.hp > 0
}

/** Fila de la unidad: la de antes de morir si viene de "Al morir". */
function allyLine(
  ctx: AbilityContext,
  unit: BattleUnit,
  tctx: TriggerContext,
): readonly BattleUnit[] {
  return tctx.lineAtDeath ?? ctx.line(unit.side)
}

function ownIndex(ctx: AbilityContext, unit: BattleUnit, tctx: TriggerContext): number {
  if (tctx.indexAtDeath !== undefined) return tctx.indexAtDeath
  return ctx.line(unit.side).indexOf(unit)
}

/** Primera unidad viva por detrás de `index` en la fila. */
function firstBehind(line: readonly BattleUnit[], index: number): BattleUnit | undefined {
  for (let i = index + 1; i < line.length; i++) {
    const candidate = line[i]
    if (isTargetable(candidate)) return candidate
  }
  return undefined
}

function matchesFilter(
  unit: BattleUnit,
  self: BattleUnit,
  filter: { race?: string; excludeSelf?: boolean },
): boolean {
  if (filter.excludeSelf === true && unit === self) return false
  if (filter.race !== undefined && UNITS[unit.defId].race !== filter.race) return false
  return true
}

function resolveTargets(
  ctx: AbilityContext,
  unit: BattleUnit,
  target: Target,
  tctx: TriggerContext,
): BattleUnit[] {
  switch (target.kind) {
    case 'self':
      return isTargetable(unit) ? [unit] : []

    case 'allyAhead': {
      const line = allyLine(ctx, unit, tctx)
      const index = ownIndex(ctx, unit, tctx)
      for (let i = index - 1; i >= 0; i--) {
        const candidate = line[i]
        if (isTargetable(candidate)) return [candidate]
      }
      return []
    }

    case 'allyBehind': {
      const behind = firstBehind(allyLine(ctx, unit, tctx), ownIndex(ctx, unit, tctx))
      return behind ? [behind] : []
    }

    case 'randomAlly': {
      const pool = ctx
        .line(unit.side)
        .filter((ally) => isTargetable(ally) && matchesFilter(ally, unit, target))
      const chosen = ctx.rng.pick(pool)
      return chosen ? [chosen] : []
    }

    case 'allAllies':
      return ctx
        .line(unit.side)
        .filter((ally) => isTargetable(ally) && matchesFilter(ally, unit, target))

    case 'frontEnemy': {
      const front = ctx.line(ctx.enemySide(unit.side)).find(isTargetable)
      return front ? [front] : []
    }

    case 'randomEnemy': {
      const pool = ctx.line(ctx.enemySide(unit.side)).filter(isTargetable)
      const chosen = ctx.rng.pick(pool)
      return chosen ? [chosen] : []
    }

    case 'allEnemies':
      return ctx.line(ctx.enemySide(unit.side)).filter(isTargetable)

    case 'hitTarget':
      return isTargetable(tctx.hitTarget) ? [tctx.hitTarget] : []

    case 'enemyBehindTarget': {
      const hit = tctx.hitTarget
      if (!hit) return []
      const line = ctx.line(hit.side)
      const index = line.indexOf(hit)
      if (index < 0) return []
      const behind = firstBehind(line, index)
      return behind ? [behind] : []
    }
  }
}

/**
 * Prepara el efecto. Devuelve null si no haría nada, para no anunciar
 * habilidades que se quedan en el aire.
 */
function planEffect(
  ctx: AbilityContext,
  unit: BattleUnit,
  effect: Effect,
  tctx: TriggerContext,
): (() => void) | null {
  const level = unit.level

  switch (effect.kind) {
    case 'damage': {
      const targets = resolveTargets(ctx, unit, effect.target, tctx)
      const amount = resolveValue(effect.amount, level)
      if (targets.length === 0 || amount <= 0) return null
      const projectile = effect.projectile
      return () => {
        if (projectile !== undefined) {
          for (const target of targets) ctx.projectile(unit, target, projectile)
        }
        for (const target of targets) ctx.damage(target, amount, unit)
      }
    }

    case 'buff': {
      const targets = resolveTargets(ctx, unit, effect.target, tctx)
      const atk = resolveValue(effect.atk, level)
      const hp = resolveValue(effect.hp, level)
      if (targets.length === 0 || (atk === 0 && hp === 0)) return null
      return () => {
        for (const target of targets) ctx.buff(target, atk, hp)
      }
    }

    case 'healFull': {
      const targets = resolveTargets(ctx, unit, effect.target, tctx).filter(
        (target) => target.hp < target.maxHp,
      )
      if (targets.length === 0) return null
      return () => {
        for (const target of targets) ctx.healFull(target)
      }
    }

    case 'debuffAtk': {
      const amount = resolveValue(effect.amount, level)
      const targets = resolveTargets(ctx, unit, effect.target, tctx).filter(
        (target) => target.atk > 0,
      )
      if (targets.length === 0 || amount <= 0) return null
      return () => {
        for (const target of targets) ctx.debuffAtk(target, amount)
      }
    }

    case 'summon': {
      const count = resolveValue(effect.count, level)
      if (count <= 0) return null
      if (ctx.line(unit.side).length >= MAX_LINE) return null
      const stats = effect.stats === undefined ? undefined : resolveValue(effect.stats, level)
      const base = Math.max(0, ownIndex(ctx, unit, tctx))
      const index = effect.placement === 'behind' ? base + 1 : base
      const unitId = effect.unitId
      return () => {
        ctx.summon(unit, unitId, count, index, stats)
      }
    }

    case 'revive': {
      if (effect.once && unit.hasRevived) return null
      const hp = resolveValue(effect.hp, level)
      if (hp <= 0) return null
      if (ctx.line(unit.side).length >= MAX_LINE) return null
      const index = Math.max(0, ownIndex(ctx, unit, tctx))
      return () => {
        ctx.revive(unit, hp, index)
      }
    }

    case 'copyAtkIfHigher': {
      const reference = resolveTargets(ctx, unit, effect.target, tctx)[0]
      if (!reference || reference.atk <= unit.atk) return null
      const atk = reference.atk + resolveValue(effect.bonus, level)
      return () => {
        ctx.setAtk(unit, atk)
      }
    }
  }
}

/**
 * Dispara la habilidad de una unidad si corresponde a ese disparador.
 * Quien llama decide si la unidad puede actuar (una unidad muerta solo
 * resuelve "Al morir").
 */
export function fireTrigger(
  ctx: AbilityContext,
  unit: BattleUnit,
  trigger: Trigger,
  tctx: TriggerContext = {},
): void {
  const ability = UNITS[unit.defId].ability
  if (!ability || ability.trigger !== trigger) return
  const plan = planEffect(ctx, unit, ability.effect, tctx)
  if (!plan) return
  ctx.ability(unit, ability.label)
  plan()
}
