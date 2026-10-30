import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { captureCards, playFusion, type CardShot } from '../anim/shopFx'
import { MAX_TEAM_SIZE, teamUnitStats, type TeamUnit } from '../engine/combat'
import {
  COPIES_TO_FUSE,
  MAX_LEVEL,
  REROLL_COST,
  SHOP_ERROR_TEXT,
  UNIT_COST,
  buy,
  copiesOf,
  move,
  reroll,
  sell,
  tierForRound,
  wouldFuse,
  type ShopEvent,
  type ShopResult,
  type ShopState,
} from '../engine/shop'
import { RACE_NAMES, UNITS, abilityText } from '../engine/units'
import './arena.css'
import './shop.css'

interface ShopScreenProps {
  readonly state: ShopState
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
    case 'fusion':
      return `¡${name(event.unitId)} sube a nivel ${event.level}!`
    case 'gold':
      return null
  }
}

interface CardProps {
  readonly unit: TeamUnit
  /** Id de la unidad, para encontrar su carta al animar. */
  readonly unitId?: number
  /** Copias iguales en el equipo (solo cartas del equipo), para los puntos de fusión. */
  readonly copies?: number
  /** La oferta completaría una fusión. */
  readonly fuses?: boolean
  readonly selected?: boolean
  readonly dragging?: boolean
  readonly onPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void
  readonly onPointerMove?: (event: ReactPointerEvent<HTMLDivElement>) => void
  readonly onPointerUp?: (event: ReactPointerEvent<HTMLDivElement>) => void
  readonly onPointerCancel?: () => void
  readonly onPointerEnter?: (event: ReactPointerEvent<HTMLDivElement>) => void
  readonly onPointerLeave?: () => void
}

function ShopCard({ unit, unitId, copies, fuses, selected, dragging, ...handlers }: CardProps) {
  const def = UNITS[unit.defId]
  const level = unit.level ?? 1
  const stats = teamUnitStats(unit)
  const classes = ['carta', selected === true ? 'sel' : '', dragging === true ? 'arrastrando' : '']
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
        {fuses === true && <span className="etiqueta-fusion">¡Fusión!</span>}
        <span className="st atk">{stats.atk}</span>
        <span className="st hp">{stats.hp}</span>
      </div>
      <span className="nm">{def.name}</span>
      {copies !== undefined && (
        <span
          className="copias"
          aria-label={
            level >= MAX_LEVEL ? 'Nivel máximo' : `${copies} de ${COPIES_TO_FUSE} para subir de nivel`
          }
        >
          {level >= MAX_LEVEL
            ? 'máx'
            : Array.from({ length: COPIES_TO_FUSE }, (_, i) => (
                <i key={i} className={i < copies ? 'lleno' : ''} />
              ))}
        </span>
      )}
    </div>
  )
}

export function ShopScreen({ state, onChange, onFight }: ShopScreenProps) {
  const [selected, setSelected] = useState<Pick | null>(null)
  const [hovered, setHovered] = useState<Pick | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [ghost, setGhost] = useState<Ghost | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const lastTapRef = useRef<{ pick: Pick; time: number } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const fusionRef = useRef<{ shots: CardShot[]; targetId: number } | null>(null)

  // Tras pintar el equipo fusionado, las copias vuelan hasta la unidad resultante.
  useLayoutEffect(() => {
    const pending = fusionRef.current
    const root = rootRef.current
    if (!pending || !root) return
    fusionRef.current = null
    playFusion(root, pending.shots, pending.targetId)
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
    const fusions = result.events.filter((event) => event.type === 'fusion')
    const last = fusions.at(-1)
    if (last && rootRef.current) {
      // Las cartas que desaparecen se fotografían ahora, antes del nuevo render.
      const vanishing = fusions
        .flatMap((fusion) => [...fusion.consumedIds, fusion.unitId])
        .filter((id) => id !== last.unitId)
      fusionRef.current = {
        shots: captureCards(rootRef.current, [...new Set(vanishing)]),
        targetId: last.unitId,
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
    if (target.kind === 'sell') sellUnit(pick.id)
    else apply(move(state, teamIndex(pick.id), target.index))
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
  const teamFull = state.team.length >= MAX_TEAM_SIZE
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

      <section className="zona">
        <h2>A la venta</h2>
        <div className="fila">
          {state.offers.map((offer, slot) => (
            <div className="hueco" key={offer?.id ?? `vacio-${slot}`}>
              {offer && (
                <ShopCard
                  unit={offer}
                  fuses={wouldFuse(state, slot)}
                  {...handlersFor({ kind: 'offer', id: offer.id }, offer)}
                />
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
            return (
              <div
                className={over ? 'hueco destino' : 'hueco'}
                key={unit?.id ?? `vacio-${index}`}
                data-drop="team"
                data-index={index}
              >
                {unit && (
                  <ShopCard
                    unit={unit}
                    copies={copiesOf(state.team, unit.defId, unit.level ?? 1)}
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
            source={shown.kind}
            gold={state.gold}
            copies={copiesOf(state.team, shownUnit.defId, shownUnit.level ?? 1)}
            canPlace={
              !teamFull ||
              (shown.kind === 'offer' &&
                wouldFuse(state, state.offers.findIndex((o) => o?.id === shown.id)))
            }
            onBuy={() => buyOffer(shown.id)}
            onSell={() => sellUnit(shown.id)}
          />
        ) : (
          <p className="ayuda">
            Pulsa una unidad para ver su habilidad. Doble clic o doble toque para comprar, o
            arrástrala a tu equipo. Arrastra tus unidades para reordenarlas o venderlas.
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
  readonly source: Pick['kind']
  readonly gold: number
  /** Copias iguales (misma unidad y nivel) que ya hay en el equipo. */
  readonly copies: number
  /** Hay sitio en el equipo o la compra forma una fusión. */
  readonly canPlace: boolean
  readonly onBuy: () => void
  readonly onSell: () => void
}

function fusionHint(source: Pick['kind'], level: number, copies: number): string {
  if (level >= MAX_LEVEL) return 'Nivel máximo.'
  if (source === 'offer') {
    return copies >= COPIES_TO_FUSE - 1
      ? `Comprarla fusiona tus ${copies} copias en una de nivel ${level + 1}.`
      : `Tienes ${copies} de ${COPIES_TO_FUSE} copias para subir a nivel ${level + 1}.`
  }
  return `Tienes ${copies} de ${COPIES_TO_FUSE} copias de nivel ${level} para subir a nivel ${level + 1}.`
}

function Detail({ unit, source, gold, copies, canPlace, onBuy, onSell }: DetailProps) {
  const def = UNITS[unit.defId]
  const level = unit.level ?? 1
  const stats = teamUnitStats(unit)
  const text = abilityText(def, level)
  const bonus = (unit.atkBonus ?? 0) !== 0 || (unit.hpBonus ?? 0) !== 0

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
      <p className="detalle-fusion">{fusionHint(source, level, copies)}</p>
      {source === 'offer' ? (
        <button
          type="button"
          className="btn primary"
          onClick={onBuy}
          disabled={gold < UNIT_COST || !canPlace}
        >
          {!canPlace ? 'Equipo lleno' : gold < UNIT_COST ? 'Sin oro' : `Comprar (${UNIT_COST} oro)`}
        </button>
      ) : (
        <button type="button" className="btn" onClick={onSell}>
          Vender (+{level} oro)
        </button>
      )}
    </div>
  )
}
