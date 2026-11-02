import { describe, expect, it } from 'vitest'
import { PLAYABLE_UNITS } from '../src/engine/units'
import { spriteUrl } from '../src/ui/sprites'

describe('sprites de las unidades', () => {
  it('cada unidad comprable tiene su sprite en src/assets/units', () => {
    const missing = PLAYABLE_UNITS.filter((unit) => spriteUrl(unit.id) === undefined)
    expect(missing.map((unit) => unit.id)).toEqual([])
  })

  it('las fichas invocadas sin sprite se quedan sin él (se ve la abreviatura)', () => {
    expect(spriteUrl('bones')).toBeDefined()
    expect(spriteUrl('hydraHead')).toBeUndefined()
  })
})
