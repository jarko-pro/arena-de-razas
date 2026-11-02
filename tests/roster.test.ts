import { describe, expect, it } from 'vitest'
import { PLAYABLE_UNITS, UNITS, abilityText, type UnitId } from '../src/engine/units'
import { eventsOf, fight, firstOf, team } from './helpers'

// Habilidad de cada unidad a nivel 1, copiada de la tabla de unidades de docs/diseno.md.
const DESIGN_TEXT: Record<Exclude<UnitId, 'bones' | 'hydraHead'>, string> = {
  grunt: '',
  warWolf: 'Al morir: +1 ATK a todos los orcos aliados.',
  berserker: 'Al recibir daño: +2 ATK.',
  shaman: 'Al morir: +2/+2 al aliado de detrás.',
  raider: 'Al matar: +2/+2.',
  ogre: 'Al golpear: 2 de daño a la unidad rival de detrás de su objetivo.',
  recruit: 'Al comprar: +1 PV permanente a un aliado al azar.',
  archer: 'Inicio del combate: 2 de daño a un enemigo al azar.',
  squire: '',
  cleric: 'Inicio del combate: +2 PV al aliado de delante.',
  knight: 'Inicio del combate: +1 ATK a los demás humanos aliados.',
  paladin: 'Al morir: +1 PV a todos los aliados.',
  spitter: 'Inicio del combate: 1 de daño a todos los enemigos.',
  lizardWhelp: 'Al vender: +1/+1 permanente a un lagarto aliado al azar.',
  basilisk: 'Al golpear: su objetivo pierde 1 ATK.',
  chameleon:
    'Inicio del combate: su ATK pasa a ser el del enemigo de delante si es mayor, +0.',
  saurian: 'Al matar: recupera todos sus PV.',
  hydra: 'Al morir: invoca 2 Cabezas de hidra de 2/2.',
  skeleton: 'Al morir: invoca unos Huesos de 1/1.',
  zombie: '',
  necromancer: 'Cuando muere un aliado: +1/+1.',
  ghoul: 'Cuando muere cualquier unidad: +1 ATK.',
  spectre: 'Al morir por primera vez en el combate: vuelve con 1 PV.',
  lich: 'Inicio del combate: invoca 1 Esqueleto 1/1 detrás de él.',
}

describe('las 24 unidades según diseno.md', () => {
  it('cada unidad comprable tiene la habilidad del diseño a nivel 1', () => {
    for (const def of PLAYABLE_UNITS) {
      expect(abilityText(def, 1), def.id).toBe(DESIGN_TEXT[def.id as keyof typeof DESIGN_TEXT])
    }
  })

  it('el valor n se multiplica por el nivel (×2 y ×3)', () => {
    expect(abilityText(UNITS.warWolf, 2)).toBe('Al morir: +2 ATK a todos los orcos aliados.')
    expect(abilityText(UNITS.berserker, 3)).toBe('Al recibir daño: +6 ATK.')
    expect(abilityText(UNITS.lich, 3)).toBe('Inicio del combate: invoca 3 Esqueletos 1/1 detrás de él.')
  })

  it('el Saqueador gana +2/+2 al matar', () => {
    const { events, teams } = fight(team('raider'), team('bones', 'zombie'))
    const raider = teams.A[0]?.uid
    const buff = firstOf(events, 'buff')
    expect(buff?.uid).toBe(raider)
    expect(buff).toMatchObject({ atk: 2, hp: 2, atkNow: 6, hpNow: 5 })
  })

  it('el Saqueador no gana nada si su golpe no mata', () => {
    const { events } = fight(team('raider'), team('zombie'))
    const firstHit = events.findIndex((event) => event.type === 'attack')
    const secondHit = events.findIndex((event, i) => i > firstHit && event.type === 'attack')
    expect(eventsOf(events.slice(0, secondHit), 'buff')).toHaveLength(0)
  })
})
