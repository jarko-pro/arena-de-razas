// Geometría de la arena: 11 huecos (5 por bando y el centro), igual que la demo.

import type { Side } from '../engine/combat'

export interface Geometry {
  readonly width: number
  readonly slot: number
  readonly size: number
  readonly height: number
  /** Coordenada vertical de la esquina superior de una ficha. */
  readonly y: number
}

export const SLOTS = 11

export function measureArena(width: number): Geometry {
  const slot = width / SLOTS
  const size = slot * 0.82
  const height = size * 1.9 + 40
  return { width, slot, size, height, y: height / 2 - size * 0.62 }
}

/** Centro horizontal de la ficha que ocupa la posición `index` de un bando. */
export function slotCenter(geo: Geometry, side: Side, index: number): number {
  const offset = geo.slot * 0.5 + geo.slot * (index + 0.5)
  return side === 'A' ? geo.width / 2 - offset : geo.width / 2 + offset
}

/** Esquina superior izquierda de la ficha, que es lo que se mueve. */
export function slotLeft(geo: Geometry, side: Side, index: number): number {
  return slotCenter(geo, side, index) - geo.size / 2
}
