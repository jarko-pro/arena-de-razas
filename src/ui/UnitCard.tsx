import type { UnitSnapshot } from '../engine/combat'
import { UnitArt } from './UnitArt'
import { artClass } from './sprites'

interface UnitCardProps {
  readonly unit: UnitSnapshot
  readonly description: string
  readonly registerEl: (el: HTMLDivElement | null) => void
}

export function UnitCard({ unit, description, registerEl }: UnitCardProps) {
  return (
    <div className="u" ref={registerEl} data-uid={unit.uid}>
      <div className="lunge">
        <div className={`body r-${unit.race}${artClass(unit.defId)}`} title={description}>
          <UnitArt id={unit.defId} name={unit.name} flip={unit.side === 'B'} />
          {unit.level > 1 && <span className={`nivel nivel-${unit.level}`}>Nv {unit.level}</span>}
          <span className="st atk">{unit.atk}</span>
          <span className="st hp">{unit.hp}</span>
        </div>
      </div>
      <span className="nm">{unit.name}</span>
    </div>
  )
}
