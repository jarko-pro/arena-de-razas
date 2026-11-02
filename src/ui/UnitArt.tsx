import type { UnitId } from '../engine/units'
import { spriteUrl } from './sprites'

interface UnitArtProps {
  readonly id: UnitId
  readonly name: string
  /** Mirar a la izquierda (equipo rival). Los sprites miran a la derecha. */
  readonly flip?: boolean
}

/** Dibujo de la unidad dentro de su ficha: el sprite o, si no tiene, su abreviatura. */
export function UnitArt({ id, name, flip = false }: UnitArtProps) {
  const url = spriteUrl(id)
  if (url === undefined) return <span className="mono">{name.slice(0, 2)}</span>
  return (
    <img
      className={flip ? 'sprite volteado' : 'sprite'}
      src={url}
      alt=""
      draggable={false}
    />
  )
}
