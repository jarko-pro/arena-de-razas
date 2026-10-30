import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { captureCards, playStack, type CardShot } from '../anim/shopFx'
import { MAX_TEAM_SIZE, teamUnitStats, type TeamUnit } from '../engine/combat'
import type { Streak } from '../engine/game'
import {
  MAX_COPIES,
  REROLL_COST,
  SHOP_ERROR_TEXT,
  UNIT_COST,
  buy,
  buyPlacement,
  levelProgress,
  merge,
  move,
  reroll,
  sell,
  tierForRound,
  toggleFreeze,
  type OwnedUnit,
  type ShopEvent,
  type ShopResult,
  type ShopState,
} from '../engine/shop'
import { RACE_NAMES, UNITS, abilityText } from '../engine/units'
import './arena.css'
import './shop.css'

interface ShopScreenProps {
  readonly state: ShopState
  readonly streak: Streak
  readonly onChange: (state: ShopState) => void
  readonly onFight: () => void
}

/** Unidad señalada en la pantalla: una oferta de la tienda o una del equipo. */
type Pick = { readonly kind: 'offer' | 'team'; readonly id: number }

type DropTarget = { readonly kind: 'team'; readonly index: number } | { readonly kind: 'sell' }

interface Drag {
  readonly pick: Pick
  readonly pointerId: number
  readonly startX: number
  readonly startY: number
  active: boolean
}

interface Ghost {
  readonly pick: Pick
  readonly unit: TeamUnit
  readonly x: number
  readonly y: number
  readonly over: DropTarget | null
}

/** Distancia que hay que mover el puntero para que una pulsación pase a ser arrastre. */
const DRAG_THRESHOLD = 6
/** Tiempo máximo entre dos pulsaciones para contar como doble clic. */
const DOUBLE_TAP_MS = 350

function short(name: string): string {
  return name.slice(0, 2)
}

function samePick(a: Pick | null, b: Pick | null): boolean {
  return a !== null && b !== null && a.kind === b.kind && a.id === b.id
}

function dropTargetAt(x: number, y: number): DropTarget | null {
  const element = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop]')
  if (!element) return null
  if (element.dataset.drop === 'sell') return { kind: 'sell' }
  const index = Number(element.dataset.index)
  return Number.isInteger(index) ? { kind: 'team', index } : null
}

function streakText(streak: Streak, gold: number): string {
  if (streak.kind === 'none' || streak.count === 0) return 'Sin racha'
  const what = streak.kind === 'win' ? 'victoria' : 'derrota'
  const label = `Racha de ${streak.count} ${what}${streak.count === 1 ? '' : 's'}`
  return gold > 0 ? `${label} · +${gold} de oro` : label
}

function eventText(state: ShopState, event: ShopEvent): string | null {
  const name = (id: number): string => {
    const unit = state.team.find((u) => u.id === id)
    return unit ? UNITS[unit.defId].name : 'Unidad vendida'
  }
  switch (event.type) {
    case 'ability':
      return `${name(event.unitId)}: ${event.label}`
    case 'buff': {
      const parts = [
        event.atk !== 0 ? `+${event.atk} ATK` : '',
        event.hp !== 0 ? `+${event.hp} PV` : '',
      ].filter((part) => part !== '')
      return `${parts.join(' ')} a ${name(event.unitId)}`
    }
    case 'stack':
      return `${name(event.unitId)}: ${event.copies} de ${MAX_COPIES} copias`
    case 'levelUp':
      return `¡${name(event.unitId)} sube a nivel ${event.level}!`
    case 'gold':
      return null
  }
}

interface CardProps {
  readonly unit: TeamUnit
  /** Id de la unidad, para encontrar su carta al animar. */
  readonly unitId?: number
  /** Unidad del equipo: muestra los puntos de experiencia. */
  readonly owned?: OwnedUnit
  readonly frozen?: boolean
  readonly selected?: boolean
  readonly dragging?: boolean
  readonly onPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void
  readonly onPointerMove?: (event: ReactPointerEvent<HTMLDivElement>) => void
  readonly onPointerUp?: (event: ReactPointerEvent<HTMLDivElement>) => void
  readonly onPointerCancel?: () => void
  readonly onPointerEnter?: (event: ReactPointerEvent<HTMLDivElement>) => void
  readonly onPointerLeave?: () => void
}

function XpPips({ unit }: { readonly unit: OwnedUnit }) {
  const progress = levelProgress(unit)
  if (!progress) {
    return (
      <span className="copias" aria-label="Nivel máximo">
        máx
      </span>
    )
  }
  return (
    <span
      className="copias"
      aria-label={`${progress.have} de ${progress.need} copias para el nivel ${unit.level + 1}`}
    >
      {Array.from({ length: progress.need }, (_, i) => (
        <i key={i} className={i < progress.have ? 'lleno' : ''} />
      ))}
    </span>
  )
}

function ShopCard({ unit, unitId, owned, frozen, selected, dragging, ...handlers }: CardProps) {
  const def = UNITS[unit.defId]
  const level = unit.level ?? 1
  const stats = teamUnitStats(unit)
  const classes = [
    'carta',
    selected === true ? 'sel' : '',
    dragging === true ? 'arrastrando' : '',
    frozen === true ? 'congelada' : '',
  ]
  return (
    <div
      className={classes.filter((c) => c !== '').join(' ')}
      title={abilityText(def, level) || def.name}
      data-unit-id={unitId}
      {...handlers}
    >
      <div className={`body r-${def.race}`}>
        <span className="mono">{short(def.name)}</span>
        <span className={`nivel nivel-${level}`}>Nv {level}</span>
        <span className="st atk">{stats.atk}</span>
        <span className="st hp">{stats.hp}</span>
      </div>
      <span className="nm">{def.name}</span>
      {owned && <XpPips unit={owned} />}
    </div>
  )
}

export function ShopScreen({ state, streak, onChange, onFight }: ShopScreenProps) {
  const [selected, setSelected] = useState<Pick | null>(null)
  const [hovered, setHovered] = useState<Pick | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [ghost, setGhost] = useState<Ghost | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const lastTapRef = useRef<{ pick: Pick; time: number } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const stackRef = useRef<{ shots: CardShot[]; targetId: number; levelUp: boolean } | null>(
    null,
  )

  // Tras pintar el equipo, la copia apilada vuela hasta su unidad.
  useLayoutEffect(() => {
    const pending = stackRef.current
    const root = rootRef.current
    if (!pending || !root) return
    stackRef.current = null
    playStack(root, pending.shots, pending.targetId, pending.levelUp)
  }, [state])

  const offerIndex = (id: number): number => state.offers.findIndex((o) => o?.id === id)
  const teamIndex = (id: number): number => state.team.findIndex((u) => u.id === id)

  const unitOf = (pick: Pick): TeamUnit | undefined =>
    pick.kind === 'team'
      ? state.team.find((u) => u.id === pick.id)
      : (state.offers.find((o) => o?.id === pick.id) ?? undefined)

  const apply = (result: ShopResult): void => {
    if (!result.ok) {
      setMessage(SHOP_ERROR_TEXT[result.error])
      return
    }
    const stack = result.events.find((event) => event.type === 'stack')
    if (stack && rootRef.current) {
      // La copia que desaparece se fotografía ahora, antes del nuevo render.
      stackRef.current = {
        shots: captureCards(rootRef.current, [stack.sourceId]),
        targetId: stack.unitId,
        levelUp: result.events.some((event) => event.type === 'levelUp'),
      }
    }
    const texts = result.events
      .map((event) => eventText(result.state, event))
      .filter((text): text is string => text !== null)
    setMessage(texts.length > 0 ? texts.join(' · ') : null)
    onChange(result.state)
  }

  const buyOffer = (id: number, position?: number): void => {
    apply(buy(state, offerIndex(id), position))
    setSelected(null)
  }

  const sellUnit = (id: number): void => {
    apply(sell(state, teamIndex(id)))
    setSelected(null)
  }

  const drop = (pick: Pick, target: DropTarget): void => {
    if (pick.kind === 'offer') {
      if (target.kind === 'team') buyOffer(pick.id, target.index)
      return
    }
    if (target.kind === 'sell') {
      sellUnit(pick.id)
      return
    }
    const from = teamIndex(pick.id)
    const source = state.team[from]
    const other = state.team[target.index]
    // Sobre una unidad igual se juntan; si no, se reordena.
    if (source && other && other.id !== source.id && other.defId === source.defId) {
      apply(merge(state, from, target.index))
    } else {
      apply(move(state, from, target.index))
    }
  }

  /** Huecos del equipo donde se puede apilar lo que se arrastra o está seleccionado. */
  const stackTargets = (pick: Pick | null): Set<number> => {
    const targets = new Set<number>()
    if (!pick) return targets
    const unit = unitOf(pick)
    if (!unit) return targets
    const copies = pick.kind === 'team' ? (state.team[teamIndex(pick.id)]?.copies ?? 1) : 1
    state.team.forEach((member, index) => {
      if (pick.kind === 'team' && member.id === pick.id) return
      if (member.defId === unit.defId && member.copies + copies <= MAX_COPIES) targets.add(index)
    })
    return targets
  }

  const tap = (pick: Pick, now: number): void => {
    const last = lastTapRef.current
    if (last && samePick(last.pick, pick) && now - last.time < DOUBLE_TAP_MS) {
      lastTapRef.current = null
      if (pick.kind === 'offer') buyOffer(pick.id)
      return
    }
    lastTapRef.current = { pick, time: now }
    setSelected(samePick(selected, pick) ? null : pick)
  }

  const handlersFor = (pick: Pick, unit: TeamUnit): Omit<CardProps, 'unit'> => ({
    unitId: pick.id,
    selected: samePick(selected, pick),
    dragging: samePick(ghost?.pick ?? null, pick),
    onPointerDown: (event) => {
      if (event.button !== 0) return
      event.currentTarget.setPointerCapture(event.pointerId)
      dragRef.current = {
        pick,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        active: false,
      }
    },
    onPointerMove: (event) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY)
      if (!drag.active && distance < DRAG_THRESHOLD) return
      drag.active = true
      setGhost({
        pick,
        unit,
        x: event.clientX,
        y: event.clientY,
        over: dropTargetAt(event.clientX, event.clientY),
      })
    },
    onPointerUp: (event) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return
      dragRef.current = null
      setGhost(null)
      if (!drag.active) {
        tap(pick, event.timeStamp)
        return
      }
      const target = dropTargetAt(event.clientX, event.clientY)
      if (target) drop(pick, target)
    },
    onPointerCancel: () => {
      dragRef.current = null
      setGhost(null)
    },
    onPointerEnter: (event) => {
      if (event.pointerType === 'mouse') setHovered(pick)
    },
    onPointerLeave: () => setHovered(null),
  })

  const shown = (ghost === null ? hovered : null) ?? selected
  const shownUnit = shown ? unitOf(shown) : undefined
  const highlighted = stackTargets(ghost?.pick ?? selected)
  const draggingTeamUnit = ghost?.pick.kind === 'team'

  return (
    <div className="pantalla-tienda" ref={rootRef}>
      <header className="cabecera-tienda">
        <h1>Tienda</h1>
        <div className="indicadores">
          <span>Ronda {state.round}</span>
          <span>Tier {tierForRound(state.round)}</span>
          <span className="oro" aria-label={`${state.gold} de oro`}>
            {state.gold} <small>oro</small>
          </span>
        </div>
      </header>

      <div className="racha">
        <span className={`racha-estado racha-${streak.kind}`}>
          {streakText(streak, state.startGold.streak)}
        </span>
        <span className="desglose">
          Oro de la ronda: {state.startGold.base} base
          {state.startGold.streak > 0 && ` + ${state.startGold.streak} de racha`}
        </span>
      </div>

      <section className="zona">
        <h2>A la venta</h2>
        <div className="fila">
          {state.offers.map((offer, slot) => (
            <div className="hueco" key={offer?.id ?? `vacio-${slot}`}>
              {offer && (
                <>
                  <ShopCard
                    unit={offer}
                    frozen={offer.frozen === true}
                    {...handlersFor({ kind: 'offer', id: offer.id }, offer)}
                  />
                  <button
                    type="button"
                    className={offer.frozen === true ? 'candado activo' : 'candado'}
                    aria-pressed={offer.frozen === true}
                    aria-label={offer.frozen === true ? 'Descongelar' : 'Congelar'}
                    title={offer.frozen === true ? 'Descongelar' : 'Congelar'}
                    onClick={() => apply(toggleFreeze(state, slot))}
                  >
                    {offer.frozen === true ? '🔒' : '🔓'}
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="controles">
        <button
          type="button"
          className="btn"
          onClick={() => apply(reroll(state))}
          disabled={state.gold < REROLL_COST}
        >
          Reroll ({REROLL_COST} oro)
        </button>
        <button
          type="button"
          className="btn primary"
          onClick={onFight}
          disabled={state.team.length === 0}
        >
          Combatir
        </button>
      </div>

      <section className="zona">
        <div className="cabecera-equipo">
          <h2>Tu equipo</h2>
          <span>← atrás · delante →</span>
        </div>
        {/* Igual que en la arena: el equipo mira a la derecha y la posición 1 es la de más a la derecha. */}
        <div className="fila equipo">
          {Array.from({ length: MAX_TEAM_SIZE }, (_, column) => {
            const index = MAX_TEAM_SIZE - 1 - column
            const unit = state.team[index]
            const over = ghost?.over?.kind === 'team' && ghost.over.index === index
            const classes = ['hueco', over ? 'destino' : '', highlighted.has(index) ? 'apilable' : '']
            return (
              <div
                className={classes.filter((c) => c !== '').join(' ')}
                key={unit?.id ?? `vacio-${index}`}
                data-drop="team"
                data-index={index}
              >
                {unit && (
                  <ShopCard
                    unit={unit}
                    owned={unit}
                    {...handlersFor({ kind: 'team', id: unit.id }, unit)}
                  />
                )}
              </div>
            )
          })}
        </div>
        <div
          className={[
            'zona-venta',
            draggingTeamUnit ? 'activa' : '',
            ghost?.over?.kind === 'sell' ? 'destino' : '',
          ].join(' ')}
          data-drop="sell"
        >
          Arrastra aquí para vender
        </div>
      </section>

      <p className="mensaje" aria-live="polite">
        {message ?? ' '}
      </p>

      <section className="detalle">
        {shown && shownUnit ? (
          <Detail
            unit={shownUnit}
            owned={shown.kind === 'team' ? state.team.find((u) => u.id === shown.id) : undefined}
            gold={state.gold}
            placement={
              shown.kind === 'offer' ? buyPlacement(state, offerIndex(shown.id)).kind : null
            }
            onBuy={() => buyOffer(shown.id)}
            onSell={() => sellUnit(shown.id)}
          />
        ) : (
          <p className="ayuda">
            Pulsa una unidad para ver su habilidad. Doble clic o doble toque para comprar, o
            arrástrala a tu equipo; suéltala sobre una igual para apilarla. Arrastra tus unidades
            para reordenarlas, juntarlas o venderlas. El candado congela una oferta.
          </p>
        )}
      </section>

      {ghost && (
        <div className="fantasma" style={{ left: ghost.x, top: ghost.y }}>
          <ShopCard unit={ghost.unit} />
        </div>
      )}
    </div>
  )
}

interface DetailProps {
  readonly unit: TeamUnit
  /** Presente si la unidad es del equipo. */
  readonly owned?: OwnedUnit
  readonly gold: number
  /** Para ofertas: dónde acabaría al comprarla con doble clic. */
  readonly placement: 'stack' | 'insert' | 'blocked' | null
  readonly onBuy: () => void
  readonly onSell: () => void
}

function xpHint(owned: OwnedUnit): string {
  const progress = levelProgress(owned)
  if (!progress) return `Nivel máximo · ${owned.copies} copias.`
  const missing = progress.need - progress.have
  return `${owned.copies} ${owned.copies === 1 ? 'copia' : 'copias'} · ${
    missing === 1 ? 'falta 1' : `faltan ${missing}`
  } para el nivel ${owned.level + 1}.`
}

function Detail({ unit, owned, gold, placement, onBuy, onSell }: DetailProps) {
  const def = UNITS[unit.defId]
  const level = unit.level ?? 1
  const stats = teamUnitStats(unit)
  const text = abilityText(def, level)
  const bonus = (unit.atkBonus ?? 0) !== 0 || (unit.hpBonus ?? 0) !== 0
  const buyLabel =
    placement === 'blocked'
      ? 'Equipo lleno'
      : gold < UNIT_COST
        ? 'Sin oro'
        : placement === 'stack'
          ? `Apilar (${UNIT_COST} oro)`
          : `Comprar (${UNIT_COST} oro)`

  return (
    <div className="detalle-unidad">
      <div className="detalle-cabecera">
        <b>{def.name}</b>
        <span>
          {RACE_NAMES[def.race]} · Tier {def.tier} · Nivel {level}
        </span>
      </div>
      <p className="detalle-stats">
        {stats.atk} ATK / {stats.hp} PV
        {bonus && <span> (incluye mejoras permanentes)</span>}
      </p>
      <p className="detalle-habilidad">{text === '' ? 'Sin habilidad.' : text}</p>
      {owned && <p className="detalle-fusion">{xpHint(owned)}</p>}
      {placement === 'stack' && (
        <p className="detalle-fusion">Se apilará sobre la unidad igual de tu equipo.</p>
      )}
      {owned ? (
        <button type="button" className="btn" onClick={onSell}>
          Vender (+{level} oro)
        </button>
      ) : (
        <button
          type="button"
          className="btn primary"
          onClick={onBuy}
          disabled={gold < UNIT_COST || placement === 'blocked'}
        >
          {buyLabel}
        </button>
      )}
    </div>
  )
}
