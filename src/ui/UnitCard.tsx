import type { UnitSnapshot } from '../engine/combat'

interface UnitCardProps {
  readonly unit: UnitSnapshot
  readonly description: string
  readonly registerEl: (el: HTMLDivElement | null) => void
}

/** Abreviatura de dos letras que se ve dentro de la ficha. */
function short(name: string): string {
  return name.slice(0, 2)
}

export function UnitCard({ unit, description, registerEl }: UnitCardProps) {
  return (
    <div className="u" ref={registerEl} data-uid={unit.uid}>
      <div className="lunge">
        <div className={`body r-${unit.race}`} title={description}>
          <span className="mono">{short(unit.name)}</span>
          <span className="st atk">{unit.atk}</span>
          <span className="st hp">{unit.hp}</span>
        </div>
      </div>
      <span className="nm">{unit.name}</span>
    </div>
  )
}
