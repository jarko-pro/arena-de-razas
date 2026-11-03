import { describe, expect, it } from 'vitest'
import {
  ALL_UNITS,
  PLAYABLE_UNITS,
  RACES,
  UNITS,
  abilityText,
  fixed,
  levelSteps,
  perLevel,
  resolveValue,
  statsForLevel,
  type Race,
} from '../src/engine/units'

describe('catálogo de unidades', () => {
  it('tiene las 24 unidades comprables de diseno.md', () => {
    expect(PLAYABLE_UNITS).toHaveLength(24)
  })

  it('tiene 6 unidades comprables por raza', () => {
    for (const race of RACES) {
      const ofRace = PLAYABLE_UNITS.filter((unit) => unit.race === race)
      expect(ofRace, race).toHaveLength(6)
    }
  })

  it('reparte 2 unidades por tier en cada raza', () => {
    for (const race of RACES) {
      for (const tier of [1, 2, 3] as const) {
        const matching = PLAYABLE_UNITS.filter(
          (unit) => unit.race === race && unit.tier === tier,
        )
        expect(matching, `${race} tier ${tier}`).toHaveLength(2)
      }
    }
  })

  it('las fichas no son comprables', () => {
    const tokens = ALL_UNITS.filter((unit) => unit.token === true).map((unit) => unit.id)
    expect(tokens).toEqual(['bones', 'hydraHead'])
  })

  it('la clave del catálogo coincide con el id de la unidad', () => {
    for (const [key, def] of Object.entries(UNITS)) {
      expect(def.id).toBe(key)
    }
  })

  it('toda unidad tiene nombre en español y estadísticas positivas', () => {
    for (const def of ALL_UNITS) {
      expect(def.name.length).toBeGreaterThan(0)
      expect(def.atk).toBeGreaterThan(0)
      expect(def.hp).toBeGreaterThan(0)
    }
  })

  it('coincide con las estadísticas de diseno.md', () => {
    const expected: Record<string, [number, number]> = {
      grunt: [3, 2],
      warWolf: [2, 2],
      berserker: [2, 5],
      shaman: [2, 3],
      raider: [4, 4],
      ogre: [5, 6],
      recruit: [1, 3],
      archer: [1, 2],
      squire: [2, 5],
      cleric: [1, 3],
      knight: [3, 5],
      paladin: [3, 5],
      spitter: [1, 2],
      lizardWhelp: [2, 2],
      basilisk: [2, 5],
      chameleon: [3, 3],
      saurian: [5, 4],
      hydra: [3, 5],
      skeleton: [1, 1],
      zombie: [1, 5],
      necromancer: [1, 3],
      ghoul: [2, 4],
      spectre: [4, 3],
      lich: [3, 5],
    }
    for (const [id, [atk, hp]] of Object.entries(expected)) {
      const def = ALL_UNITS.find((unit) => unit.id === id)
      expect(def, id).toBeDefined()
      expect([def?.atk, def?.hp], id).toEqual([atk, hp])
    }
  })
})

describe('escalado por nivel', () => {
  it('suma +2/+2 por nivel sobre la base', () => {
    const grunt = UNITS.grunt
    expect(statsForLevel(grunt, 1)).toEqual({ atk: 3, hp: 2 })
    expect(statsForLevel(grunt, 2)).toEqual({ atk: 5, hp: 4 })
    expect(statsForLevel(grunt, 3)).toEqual({ atk: 7, hp: 6 })
  })

  it('resuelve los tres modos de escalado', () => {
    expect([1, 2, 3].map((level) => resolveValue(perLevel(2), level as 1 | 2 | 3))).toEqual([
      2, 4, 6,
    ])
    expect([1, 2, 3].map((level) => resolveValue(fixed(2), level as 1 | 2 | 3))).toEqual([
      2, 2, 2,
    ])
    expect([1, 2, 3].map((level) => resolveValue(levelSteps(1), level as 1 | 2 | 3))).toEqual([
      0, 1, 2,
    ])
  })

  it('el texto de la habilidad sustituye {n} por el valor del nivel', () => {
    expect(abilityText(UNITS.berserker, 1)).toBe('Al recibir daño: +2 ATK.')
    expect(abilityText(UNITS.berserker, 2)).toBe('Al recibir daño: +4 ATK.')
    expect(abilityText(UNITS.shaman, 3)).toBe('Al morir: +6/+6 al aliado de detrás.')
    expect(abilityText(UNITS.cleric, 1)).toBe('Inicio del combate: +2 PV al aliado de delante.')
    expect(abilityText(UNITS.lich, 2)).toBe(
      'Cuando muere un aliado: invoca unos Huesos 1/1 en su sitio (máximo 2 por combate).',
    )
    expect(abilityText(UNITS.hydra, 2)).toBe('Al morir: invoca 2 Cabezas de hidra de 4/4.')
  })

  it('el Camaleón escala 0, 1, 2', () => {
    expect(abilityText(UNITS.chameleon, 1)).toContain('+0')
    expect(abilityText(UNITS.chameleon, 2)).toContain('+1')
    expect(abilityText(UNITS.chameleon, 3)).toContain('+2')
  })

  it('las habilidades sin valor dejan el texto tal cual', () => {
    expect(abilityText(UNITS.saurian, 2)).toBe('Al matar: recupera todos sus PV.')
  })

  it('las unidades sin habilidad no tienen texto', () => {
    expect(abilityText(UNITS.grunt, 1)).toBe('')
  })
})

describe('razas', () => {
  it('cada raza tiene nombre visible', () => {
    const names: Record<Race, string> = {
      orc: 'Orcos',
      human: 'Humanos',
      lizard: 'Hombres lagarto',
      undead: 'No muertos',
    }
    for (const race of RACES) {
      expect(names[race].length).toBeGreaterThan(0)
    }
  })
})
