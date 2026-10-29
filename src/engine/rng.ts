// Generador aleatorio con semilla: toda la aleatoriedad del juego pasa por aquí.
// Misma semilla = misma secuencia, en cualquier máquina y en cualquier momento.

export interface Rng {
  /** Siguiente número en [0, 1). */
  next(): number
  /** Entero en [0, maxExclusive). Devuelve 0 si maxExclusive <= 0. */
  int(maxExclusive: number): number
  /** Elemento al azar, o undefined si la lista está vacía. */
  pick<T>(items: readonly T[]): T | undefined
  /** Copia desordenada de la lista (Fisher-Yates). */
  shuffle<T>(items: readonly T[]): T[]
}

/** Hash de 32 bits para admitir semillas de texto (FNV-1a). */
function hashString(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function createRng(seed: number | string): Rng {
  let state = typeof seed === 'number' ? Math.trunc(seed) >>> 0 : hashString(seed)

  // mulberry32: rápido, suficiente para un juego y trivial de reproducir.
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const int = (maxExclusive: number): number =>
    maxExclusive <= 0 ? 0 : Math.floor(next() * maxExclusive)

  function pick<T>(items: readonly T[]): T | undefined {
    return items.length === 0 ? undefined : items[int(items.length)]
  }

  function shuffle<T>(items: readonly T[]): T[] {
    const out = [...items]
    for (let i = out.length - 1; i > 0; i--) {
      const j = int(i + 1)
      const a = out[i]
      const b = out[j]
      if (a !== undefined && b !== undefined) {
        out[i] = b
        out[j] = a
      }
    }
    return out
  }

  return { next, int, pick, shuffle }
}
