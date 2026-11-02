// Sprites de las unidades: src/assets/units/<id>.webp, generados con scripts/sprites.ts.

import type { UnitId } from '../engine/units'

const files = import.meta.glob<string>('../assets/units/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
})

const SPRITES: ReadonlyMap<string, string> = new Map(
  Object.entries(files).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -'.webp'.length), url]),
)

/** URL del sprite de la unidad, o `undefined` si todavía no tiene. */
export function spriteUrl(id: UnitId): string | undefined {
  return SPRITES.get(id)
}

/** Clase extra de la ficha cuando lleva sprite (fondo de raza más apagado). */
export function artClass(id: UnitId): string {
  return spriteUrl(id) === undefined ? '' : ' con-sprite'
}
