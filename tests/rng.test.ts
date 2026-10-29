import { describe, expect, it } from 'vitest'
import { createRng } from '../src/engine/rng'

const take = (seed: number | string, count: number): number[] => {
  const rng = createRng(seed)
  return Array.from({ length: count }, () => rng.next())
}

describe('createRng', () => {
  it('con la misma semilla da la misma secuencia', () => {
    expect(take(42, 5)).toEqual(take(42, 5))
  })

  it('con semillas distintas da secuencias distintas', () => {
    expect(take(1, 5)).not.toEqual(take(2, 5))
  })

  it('admite semillas de texto y son estables', () => {
    expect(take('arena', 5)).toEqual(take('arena', 5))
    expect(take('arena', 5)).not.toEqual(take('razas', 5))
  })

  it('devuelve números en [0, 1)', () => {
    for (const value of take(7, 500)) {
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('int devuelve enteros dentro del rango', () => {
    const rng = createRng(3)
    for (let i = 0; i < 200; i++) {
      const value = rng.int(6)
      expect(Number.isInteger(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(6)
    }
  })

  it('int con rango vacío devuelve 0', () => {
    expect(createRng(1).int(0)).toBe(0)
    expect(createRng(1).int(-5)).toBe(0)
  })

  it('pick elige de la lista y devuelve undefined si está vacía', () => {
    const rng = createRng(9)
    const items = ['a', 'b', 'c']
    for (let i = 0; i < 50; i++) {
      expect(items).toContain(rng.pick(items))
    }
    expect(rng.pick([])).toBeUndefined()
  })

  it('shuffle es una permutación y es determinista', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8]
    const first = createRng('mezcla').shuffle(items)
    const second = createRng('mezcla').shuffle(items)
    expect(first).toEqual(second)
    expect([...first].sort((x, y) => x - y)).toEqual(items)
    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })
})
