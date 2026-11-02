import { describe, expect, it } from 'vitest'
import { eventsOf, fight, firstOf, team } from './helpers'

describe('orcos', () => {
  it('el Lobo de guerra da ATK a los orcos aliados al morir', () => {
    const { events, teams } = fight(team('warWolf', 'grunt'), team('knight'))
    const buff = firstOf(events, 'buff')
    expect(buff?.uid).toBe(teams.A[1]?.uid)
    expect(buff?.atk).toBe(1)
    expect(buff?.atkNow).toBe(4)
  })

  it('el Lobo de guerra no mejora a aliados de otra raza', () => {
    const { events } = fight(team('warWolf', 'squire'), team('knight'))
    expect(eventsOf(events, 'buff')).toHaveLength(0)
  })

  it('el Ogro golpea también a la unidad de detrás de su objetivo', () => {
    const { events, teams } = fight(team('ogre'), team('zombie', 'zombie'))
    const splash = eventsOf(events, 'damage').find((event) => event.uid === teams.B[1]?.uid)
    expect(splash?.amount).toBe(2)
    expect(splash?.hp).toBe(3)
  })
})

describe('humanos', () => {
  it('el Clérigo da PV al aliado de delante', () => {
    const { events, teams } = fight(team('squire', 'cleric'), team('zombie'))
    const buff = firstOf(events, 'buff')
    expect(buff?.uid).toBe(teams.A[0]?.uid)
    expect(buff?.hp).toBe(2)
    expect(buff?.hpNow).toBe(7)
  })

  it('el Caballero solo mejora a los demás humanos', () => {
    const { events, teams } = fight(team('knight', 'grunt', 'squire'), team('zombie'))
    const buffs = eventsOf(events, 'buff')
    expect(buffs).toHaveLength(1)
    expect(buffs[0]?.uid).toBe(teams.A[2]?.uid)
  })

  it('el Paladín da PV a todos los aliados al morir', () => {
    const { events, teams } = fight(team('paladin', 'zombie'), team(['knight', 3]))
    const buff = firstOf(events, 'buff')
    expect(buff?.uid).toBe(teams.A[1]?.uid)
    expect(buff?.hp).toBe(1)
  })
})

describe('hombres lagarto', () => {
  it('el Escupidor daña a todos los enemigos al empezar', () => {
    const { events } = fight(team('spitter'), team('grunt', 'zombie'))
    const projectiles = eventsOf(events, 'projectile')
    expect(projectiles).toHaveLength(2)
    expect(projectiles.every((event) => event.kind === 'acid')).toBe(true)
    const attackIndex = events.findIndex((event) => event.type === 'attack')
    const early = eventsOf(events.slice(0, attackIndex), 'damage')
    expect(early).toHaveLength(2)
    expect(early.every((event) => event.amount === 1)).toBe(true)
  })

  it('el Camaleón copia el ATK del enemigo de delante si es mayor', () => {
    const { events } = fight(team('chameleon'), team(['knight', 3]))
    const buff = firstOf(events, 'buff')
    expect(buff?.atkNow).toBe(7)
  })

  it('el Camaleón de nivel 2 suma +1 al copiar', () => {
    const { events } = fight(team(['chameleon', 2]), team(['knight', 3]))
    expect(firstOf(events, 'buff')?.atkNow).toBe(8)
  })

  it('el Camaleón no hace nada si su ATK ya es mayor', () => {
    const { events } = fight(team('chameleon'), team('zombie'))
    expect(eventsOf(events, 'ability')).toHaveLength(0)
  })

  it('la Hidra invoca las cabezas que caben', () => {
    const full = fight(
      team('hydra', 'grunt', 'grunt', 'grunt', 'grunt'),
      team(['knight', 3]),
    )
    expect(eventsOf(full.events, 'summon')).toHaveLength(1)

    const roomy = fight(team('hydra', 'grunt', 'grunt'), team(['knight', 3]))
    const summons = eventsOf(roomy.events, 'summon')
    expect(summons).toHaveLength(2)
    expect(summons.map((event) => event.index)).toEqual([0, 1])
    expect(summons.every((event) => event.unit.atk === 2 && event.unit.hp === 2)).toBe(true)
  })
})

describe('no muertos', () => {
  it('el Esqueleto invoca Huesos que escalan con su nivel', () => {
    const level1 = fight(team('skeleton'), team('knight'))
    expect(firstOf(level1.events, 'summon')?.unit.atk).toBe(1)

    const level2 = fight(team(['skeleton', 2]), team('knight'))
    const summon = firstOf(level2.events, 'summon')
    expect(summon?.unit.defId).toBe('bones')
    expect([summon?.unit.atk, summon?.unit.hp]).toEqual([2, 2])
  })

  it('el Liche invoca Esqueletos detrás de él', () => {
    const { events } = fight(team('lich'), team('zombie'))
    const summon = firstOf(events, 'summon')
    expect(summon?.index).toBe(1)
    expect(summon?.unit.defId).toBe('skeleton')
    expect([summon?.unit.atk, summon?.unit.hp]).toEqual([1, 1])
  })

  it('el Liche de nivel 2 invoca dos Esqueletos', () => {
    const { events } = fight(team(['lich', 2]), team('zombie'))
    expect(eventsOf(events, 'summon')).toHaveLength(2)
  })

  it('el Espectro vuelve en su posición y solo una vez', () => {
    const { events } = fight(team('spectre', 'necromancer'), team('knight', 'knight'))
    const revives = eventsOf(events, 'revive')
    expect(revives).toHaveLength(1)
    expect(revives[0]?.index).toBe(0)
    expect(revives[0]?.hp).toBe(1)
  })

  it('la muerte del Espectro cuenta para el Nigromante', () => {
    const { events, teams } = fight(team('spectre', 'necromancer'), team('knight', 'knight'))
    const necromancer = teams.A[1]?.uid
    const buffs = eventsOf(events, 'buff').filter((event) => event.uid === necromancer)
    expect(buffs.length).toBeGreaterThanOrEqual(1)
    expect(buffs[0]?.atk).toBe(1)
  })
})

describe('disparadores de tienda', () => {
  it('"Al comprar" y "Al vender" no se disparan en combate', () => {
    const recruit = fight(team('recruit', 'zombie'), team('zombie'))
    const whelp = fight(team('lizardWhelp', 'zombie'), team('zombie'))
    expect(eventsOf(recruit.events, 'ability')).toHaveLength(0)
    expect(eventsOf(whelp.events, 'ability')).toHaveLength(0)
  })
})
