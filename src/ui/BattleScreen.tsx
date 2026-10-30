import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  buildBattleTimeline,
  collectBattleUnits,
  resetArena,
  type ArenaDom,
  type BattleTimeline,
} from '../anim/battleTimeline'
import { measureArena, type Geometry } from '../anim/geometry'
import {
  simulateBattle,
  type Outcome,
  type TeamUnit,
  type Uid,
  type UnitSnapshot,
} from '../engine/combat'
import { UNITS, abilityText } from '../engine/units'
import { UnitCard } from './UnitCard'
import './arena.css'

const BANNER: Record<Outcome, string> = {
  victoryA: '¡Victoria!',
  victoryB: 'Derrota',
  draw: 'Empate',
}

function describe(unit: UnitSnapshot): string {
  const def = UNITS[unit.defId]
  const text = abilityText(def, unit.level)
  return text === '' ? def.name : `${def.name} · ${text}`
}

interface BattleScreenProps {
  readonly round: number
  readonly playerTeam: readonly TeamUnit[]
  readonly rivalTeam: readonly TeamUnit[]
  readonly seed: string
  /** Se llama una vez, cuando el combate termina de verse o se salta. */
  readonly onFinish: (outcome: Outcome) => void
  /** Resultado de la ronda: se muestra debajo de la arena al terminar. */
  readonly children?: ReactNode
}

export function BattleScreen({
  round,
  playerTeam,
  rivalTeam,
  seed,
  onFinish,
  children,
}: BattleScreenProps) {
  const result = useMemo(
    () => simulateBattle(playerTeam, rivalTeam, seed),
    [playerTeam, rivalTeam, seed],
  )
  const units = useMemo(() => collectBattleUnits(result), [result])

  const arenaRef = useRef<HTMLDivElement>(null)
  const fxRef = useRef<HTMLDivElement>(null)
  const elsRef = useRef(new Map<Uid, HTMLDivElement>())
  const timelineRef = useRef<BattleTimeline | null>(null)
  const playingRef = useRef(false)

  const [geo, setGeo] = useState<Geometry | null>(null)
  const [playing, setPlaying] = useState(false)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [finished, setFinished] = useState(false)

  const getDom = useCallback((): ArenaDom | null => {
    const arena = arenaRef.current
    const fxLayer = fxRef.current
    if (!arena || !fxLayer) return null
    return { arena, fxLayer, unitEl: (uid) => elsRef.current.get(uid) }
  }, [])

  // Mide la arena al montar y cuando cambia de ancho.
  useEffect(() => {
    const element = arenaRef.current
    if (!element) return
    const update = (): void => {
      const width = element.clientWidth
      setGeo((previous) =>
        previous && previous.width === width ? previous : measureArena(width),
      )
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  // Coloca las fichas en su sitio al medir, salvo si hay un combate en marcha.
  useEffect(() => {
    const dom = getDom()
    if (!geo || !dom || playingRef.current) return
    resetArena(dom, result, geo)
  }, [geo, result, getDom])

  useEffect(
    () => () => {
      timelineRef.current?.kill()
    },
    [],
  )

  const play = useCallback(() => {
    const dom = getDom()
    if (!geo || !dom) return
    timelineRef.current?.kill()
    resetArena(dom, result, geo)
    setOutcome(null)
    setPlaying(true)
    playingRef.current = true
    const timeline = buildBattleTimeline(dom, result, geo, setOutcome)
    timeline.eventCallback('onComplete', () => {
      setPlaying(false)
      playingRef.current = false
      setFinished(true)
    })
    timelineRef.current = timeline
    timeline.play(0)
  }, [geo, result, getDom])

  /** Lleva el combate al final sin esperar a la animación. */
  const skip = useCallback(() => {
    if (!playingRef.current) play()
    timelineRef.current?.progress(1)
  }, [play])

  // Avisa una sola vez del resultado, aunque luego se repita la animación.
  const onFinishRef = useRef(onFinish)
  const notifiedRef = useRef(false)
  useEffect(() => {
    onFinishRef.current = onFinish
  })
  useEffect(() => {
    if (!finished || notifiedRef.current) return
    notifiedRef.current = true
    onFinishRef.current(result.outcome)
  }, [finished, result])

  return (
    <div className="pantalla-combate">
      <div className="cabecera-combate">
        <h1>Ronda {round}</h1>
        <p>Rival provisional al azar hasta que lleguen los bots.</p>
      </div>

      <div className="controles">
        <button type="button" className="btn primary" onClick={play} disabled={playing}>
          {finished ? 'Repetir' : 'Combatir'}
        </button>
        {!finished && (
          <button type="button" className="btn" onClick={skip}>
            Saltar
          </button>
        )}
        <span className="semilla">{result.rounds} golpes</span>
      </div>

      <div className="bandos">
        <span className="izq">Tu equipo</span>
        <span className="der">Rival</span>
      </div>

      <div className="arena" ref={arenaRef} style={{ height: geo?.height }}>
        {units.map((unit) => (
          <UnitCard
            key={unit.uid}
            unit={unit}
            description={describe(unit)}
            registerEl={(el) => {
              if (el) elsRef.current.set(unit.uid, el)
              else elsRef.current.delete(unit.uid)
            }}
          />
        ))}
        <div className="capa-fx" ref={fxRef} />
        {outcome !== null && <div className="banner">{BANNER[outcome]}</div>}
      </div>

      {finished && !playing && children}

      <div className="listas">
        {(['A', 'B'] as const).map((side) => (
          <div className="lista" key={side}>
            <h2>{side === 'A' ? 'Tu equipo (de delante a atrás)' : 'Rival (de delante a atrás)'}</h2>
            <ol>
              {result.teams[side].map((unit) => (
                <li key={unit.uid}>
                  <b>{unit.name}</b> · {unit.atk} ATK / {unit.hp} PV
                  {abilityText(UNITS[unit.defId], unit.level) !== '' && (
                    <span>{abilityText(UNITS[unit.defId], unit.level)}</span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>

    </div>
  )
}
