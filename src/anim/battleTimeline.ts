// Reproduce los eventos de un combate con animaciones GSAP.
// No decide nada: cada evento ya trae el resultado calculado por el motor.

import gsap from 'gsap'
import type { BattleEvent, BattleResult, Outcome, Side, Uid, UnitSnapshot } from '../engine/combat'
import { slotCenter, slotLeft, type Geometry } from './geometry'

export interface ArenaDom {
  readonly arena: HTMLElement
  readonly fxLayer: HTMLElement
  unitEl(uid: Uid): HTMLElement | undefined
}

export type BattleTimeline = gsap.core.Timeline

/** Duraciones base, tomadas de docs/demo.html. */
const D = {
  lunge: 0.62,
  impact: 0.31,
  shake: 0.32,
  float: 0.9,
  fade: 0.45,
  shot: 0.52,
  pill: 0.75,
  advance: 0.35,
  appear: 0.4,
  beat: 0.12,
}

const COLORS = {
  damage: '#ff5a45',
  buff: '#7fd36b',
  debuff: '#b6e85a',
  heal: '#7fd36b',
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/** Todas las unidades que aparecen en el combate, incluidas las invocadas. */
export function collectBattleUnits(result: BattleResult): UnitSnapshot[] {
  const units = [...result.teams.A, ...result.teams.B]
  for (const event of result.events) {
    if (event.type === 'summon') units.push(event.unit)
  }
  return units
}

/** Uid de las unidades que están en la arena antes de empezar. */
export function initialUids(result: BattleResult): Set<Uid> {
  return new Set([...result.teams.A, ...result.teams.B].map((unit) => unit.uid))
}

interface Spot {
  readonly side: Side
  readonly index: number
}

/** Posición de cada unidad al empezar el combate. */
function startingSpots(result: BattleResult): Map<Uid, Spot> {
  const spots = new Map<Uid, Spot>()
  for (const side of ['A', 'B'] as const) {
    result.teams[side].forEach((unit, index) => {
      spots.set(unit.uid, { side, index })
    })
  }
  return spots
}

function part(el: HTMLElement | undefined, selector: string): HTMLElement | null {
  return el?.querySelector<HTMLElement>(selector) ?? null
}

function setBadge(el: HTMLElement | undefined, which: 'atk' | 'hp', value: number): void {
  const badge = part(el, `.st.${which}`)
  if (badge) badge.textContent = String(Math.max(0, value))
}

/** Devuelve la arena al estado inicial del combate. */
export function resetArena(dom: ArenaDom, result: BattleResult, geo: Geometry): void {
  dom.fxLayer.replaceChildren()
  const spots = startingSpots(result)
  for (const unit of collectBattleUnits(result)) {
    const el = dom.unitEl(unit.uid)
    if (!el) continue
    const spot = spots.get(unit.uid)
    gsap.killTweensOf(el)
    gsap.set(el, {
      width: geo.size,
      x: slotLeft(geo, unit.side, spot?.index ?? 0),
      y: geo.y,
      opacity: spot ? 1 : 0,
      filter: 'none',
    })
    gsap.set(part(el, '.lunge'), { x: 0, scale: 1 })
    gsap.set(part(el, '.body'), { x: 0, rotate: 0 })
    setBadge(el, 'atk', unit.atk)
    setBadge(el, 'hp', unit.hp)
  }
}

export function buildBattleTimeline(
  dom: ArenaDom,
  result: BattleResult,
  geo: Geometry,
  onEnd: (outcome: Outcome) => void,
): gsap.core.Timeline {
  const reduced = prefersReducedMotion()
  const s = (seconds: number): number => (reduced ? 0 : seconds)
  const tl = gsap.timeline({ paused: true })
  const spots = startingSpots(result)
  let time = 0

  const centerOf = (uid: Uid): { x: number; y: number } => {
    const spot = spots.get(uid)
    return {
      x: spot ? slotCenter(geo, spot.side, spot.index) : geo.width / 2,
      y: geo.y,
    }
  }

  const float = (uid: Uid, text: string, color: string, at: number): void => {
    const { x, y } = centerOf(uid)
    tl.call(
      () => {
        const node = document.createElement('div')
        node.className = 'float'
        node.textContent = text
        node.style.color = color
        node.style.left = `${x - 12}px`
        node.style.top = `${y - 8}px`
        dom.fxLayer.appendChild(node)
        gsap
          .timeline({ onComplete: () => node.remove() })
          .fromTo(
            node,
            { y: 0, scale: 0.6, opacity: 0 },
            { y: -14, scale: 1.15, opacity: 1, duration: s(D.float * 0.25) },
          )
          .to(node, { y: -46, scale: 1, opacity: 0, duration: s(D.float * 0.75) })
      },
      undefined,
      at,
    )
  }

  const popBadge = (uid: Uid, which: 'atk' | 'hp', at: number): void => {
    const badge = part(dom.unitEl(uid), `.st.${which}`)
    if (!badge) return
    tl.fromTo(
      badge,
      { scale: 1 },
      { scale: 1.6, duration: s(0.16), yoyo: true, repeat: 1 },
      at,
    )
  }

  const pill = (uid: Uid, label: string, at: number): void => {
    const { x, y } = centerOf(uid)
    const body = part(dom.unitEl(uid), '.body')
    if (body) {
      tl.fromTo(
        body,
        { boxShadow: '0 0 0 0 rgba(240,181,69,.9)' },
        { boxShadow: '0 0 0 14px rgba(240,181,69,0)', duration: s(0.6) },
        at,
      )
    }
    tl.call(
      () => {
        const node = document.createElement('div')
        node.className = 'tag'
        node.textContent = label
        dom.fxLayer.appendChild(node)
        const width = node.offsetWidth
        node.style.left = `${Math.max(4, Math.min(geo.width - width - 4, x - width / 2))}px`
        node.style.top = `${y - 34}px`
        gsap
          .timeline({ onComplete: () => node.remove() })
          .fromTo(
            node,
            { opacity: 0, y: 6 },
            { opacity: 1, y: 0, duration: s(0.18) },
          )
          .to(node, { opacity: 0, duration: s(0.2) }, s(0.6))
      },
      undefined,
      at,
    )
  }

  const lunge = (uid: Uid, at: number): void => {
    const el = part(dom.unitEl(uid), '.lunge')
    const spot = spots.get(uid)
    if (!el || !spot) return
    const dir = spot.side === 'A' ? 1 : -1
    tl.to(
      el,
      {
        keyframes: [
          { x: -dir * geo.slot * 0.18, duration: s(D.lunge * 0.3) },
          { x: dir * geo.slot * 0.42, scale: 1.08, duration: s(D.lunge * 0.2) },
          { x: 0, scale: 1, duration: s(D.lunge * 0.5) },
        ],
        ease: 'power1.inOut',
      },
      at,
    )
  }

  const shake = (uid: Uid, at: number): void => {
    const body = part(dom.unitEl(uid), '.body')
    if (!body) return
    tl.to(
      body,
      {
        keyframes: [
          { x: -6, rotate: -4, duration: s(D.shake * 0.25) },
          { x: 6, rotate: 4, duration: s(D.shake * 0.25) },
          { x: -3, rotate: 0, duration: s(D.shake * 0.25) },
          { x: 0, duration: s(D.shake * 0.25) },
        ],
      },
      at,
    )
  }

  const damage = (uid: Uid, amount: number, hp: number, at: number): void => {
    const el = dom.unitEl(uid)
    tl.call(() => setBadge(el, 'hp', hp), undefined, at)
    shake(uid, at)
    popBadge(uid, 'hp', at)
    float(uid, `-${amount}`, COLORS.damage, at)
  }

  const projectile = (from: Uid, to: Uid, kind: string, at: number): void => {
    const origin = centerOf(from)
    const target = centerOf(to)
    tl.call(
      () => {
        const node = document.createElement('div')
        node.className = `shot shot-${kind}`
        dom.fxLayer.appendChild(node)
        const mid = (origin.x + target.x) / 2
        const baseY = geo.y + geo.size / 2 - 6
        gsap.set(node, { x: origin.x - 6, y: baseY })
        gsap.to(node, {
          keyframes: [
            { x: mid - 6, y: baseY - geo.size * 1.1, duration: s(D.shot / 2), ease: 'none' },
            { x: target.x - 6, y: baseY, duration: s(D.shot / 2), ease: 'none' },
          ],
          onComplete: () => node.remove(),
        })
      },
      undefined,
      at,
    )
  }

  const arenaShake = (at: number): void => {
    if (reduced) return
    tl.to(
      dom.arena,
      {
        keyframes: [
          { x: 2, y: -2, duration: 0.07 },
          { x: -2, y: 1, duration: 0.07 },
          { x: 0, y: 0, duration: 0.06 },
        ],
      },
      at,
    )
  }

  const relayout = (side: Side, uids: readonly Uid[], at: number): void => {
    uids.forEach((uid, index) => {
      spots.set(uid, { side, index })
      const el = dom.unitEl(uid)
      if (!el) return
      tl.to(el, { x: slotLeft(geo, side, index), duration: s(D.advance), ease: 'power2.out' }, at)
    })
  }

  const events = result.events
  let i = 0

  /** Eventos consecutivos de un tipo, para animarlos a la vez. */
  const takeWhile = <T extends BattleEvent['type']>(
    type: T,
  ): Extract<BattleEvent, { type: T }>[] => {
    const taken: Extract<BattleEvent, { type: T }>[] = []
    for (;;) {
      const next = events[i]
      if (!next || next.type !== type) break
      taken.push(next as Extract<BattleEvent, { type: T }>)
      i++
    }
    return taken
  }

  while (i < events.length) {
    const event = events[i]
    if (!event) break

    switch (event.type) {
      case 'attack': {
        i++
        for (const uid of event.uids) lunge(uid, time)
        const impacts = takeWhile('damage')
        const impactAt = time + s(D.impact)
        for (const hit of impacts) damage(hit.uid, hit.amount, hit.hp, impactAt)
        if (impacts.length > 0) arenaShake(impactAt)
        time += s(D.lunge) + s(D.beat)
        break
      }

      case 'projectile': {
        const shots = takeWhile('projectile')
        for (const shot of shots) projectile(shot.from, shot.to, shot.kind, time)
        time += s(D.shot)
        const hits = takeWhile('damage')
        for (const hit of hits) damage(hit.uid, hit.amount, hit.hp, time)
        if (hits.length > 0) time += s(D.shake) + s(D.beat)
        break
      }

      case 'damage': {
        const hits = takeWhile('damage')
        for (const hit of hits) damage(hit.uid, hit.amount, hit.hp, time)
        time += s(D.shake) + s(D.beat)
        break
      }

      case 'ability': {
        i++
        pill(event.uid, event.label, time)
        time += s(D.pill)
        break
      }

      case 'buff': {
        i++
        const el = dom.unitEl(event.uid)
        const { atkNow, hpNow } = event
        tl.call(
          () => {
            setBadge(el, 'atk', atkNow)
            setBadge(el, 'hp', hpNow)
          },
          undefined,
          time,
        )
        if (event.atk !== 0) popBadge(event.uid, 'atk', time)
        if (event.hp !== 0) popBadge(event.uid, 'hp', time)
        const text =
          event.hp === 0
            ? `+${event.atk} ATK`
            : event.atk === 0
              ? `+${event.hp} PV`
              : `+${event.atk}/+${event.hp}`
        float(event.uid, text, COLORS.buff, time)
        time += s(D.advance)
        break
      }

      case 'debuff': {
        i++
        const el = dom.unitEl(event.uid)
        const atkNow = event.atkNow
        tl.call(() => setBadge(el, 'atk', atkNow), undefined, time)
        popBadge(event.uid, 'atk', time)
        float(event.uid, `-${event.atk} ATK`, COLORS.debuff, time)
        time += s(D.advance)
        break
      }

      case 'heal': {
        i++
        const el = dom.unitEl(event.uid)
        const hp = event.hp
        tl.call(() => setBadge(el, 'hp', hp), undefined, time)
        popBadge(event.uid, 'hp', time)
        float(event.uid, `+${event.amount} PV`, COLORS.heal, time)
        time += s(D.advance)
        break
      }

      case 'death': {
        const deaths = takeWhile('death')
        for (const dead of deaths) {
          const el = dom.unitEl(dead.uid)
          if (!el) continue
          tl.to(
            el,
            { opacity: 0, filter: 'grayscale(1) blur(2px)', duration: s(D.fade) },
            time,
          )
        }
        time += s(D.fade)
        break
      }

      case 'line': {
        i++
        relayout(event.side, event.uids, time)
        time += s(D.advance * 0.7)
        break
      }

      case 'summon': {
        i++
        const unit = event.unit
        spots.set(unit.uid, { side: event.side, index: event.index })
        const el = dom.unitEl(unit.uid)
        if (el) {
          tl.call(
            () => {
              gsap.set(el, {
                width: geo.size,
                x: slotLeft(geo, event.side, event.index),
                y: geo.y,
              })
              setBadge(el, 'atk', unit.atk)
              setBadge(el, 'hp', unit.hp)
            },
            undefined,
            time,
          )
          tl.fromTo(
            el,
            { opacity: 0, scale: 0.6 },
            { opacity: 1, scale: 1, duration: s(D.appear), ease: 'back.out(2)' },
            time,
          )
        }
        time += s(D.appear)
        break
      }

      case 'revive': {
        i++
        const el = dom.unitEl(event.uid)
        const hp = event.hp
        if (el) {
          tl.call(
            () => {
              setBadge(el, 'hp', hp)
              gsap.set(el, { filter: 'none' })
            },
            undefined,
            time,
          )
          tl.fromTo(
            el,
            { opacity: 0, scale: 1.4 },
            { opacity: 1, scale: 1, duration: s(D.appear), ease: 'power2.out' },
            time,
          )
        }
        float(event.uid, '¡Vuelve!', COLORS.buff, time)
        time += s(D.appear)
        break
      }

      case 'end': {
        i++
        const outcome = event.outcome
        tl.call(() => onEnd(outcome), undefined, time + s(0.2))
        time += s(0.2)
        break
      }
    }
  }

  // Deja un hueco final para que terminen los números flotantes.
  tl.to({}, { duration: s(0.3) }, time)
  return tl
}
