import { describe, expect, it } from 'vitest'
import { eventsOf, fight, firstOf, team } from './helpers'

describe('Inicio del combate', () => {
  it('el Arquero dispara antes del primer golpe', () => {
    const { events } = fight(team('archer'), team('zombie'))
    const damageIndex = events.findIndex((event) => event.type === 'damage')
    const attackIndex = events.findIndex((event) => event.type === 'attack')
    expect(damageIndex).toBeGreaterThanOrEqual(0)
    expect(damageIndex).toBeLessThan(attackIndex)
    expect(eventsOf(events, 'damage')[0]?.amount).toBe(2)
    expect(firstOf(events, 'projectile')?.kind).toBe('arrow')
  })

  it('resuelve primero el equipo A y luego el B', () => {
    const { events, teams } = fight(team('squire', 'cleric'), team('squire', 'cleric'))
    const abilities = eventsOf(events, 'ability')
    expect(abilities[0]?.uid).toBe(teams.A[1]?.uid)
    expect(abilities[1]?.uid).toBe(teams.B[1]?.uid)
  })
})

describe('Al golpear', () => {
  it('el Basilisco baja el ATK de su objetivo', () => {
    const { events, teams } = fight(team('basilisk'), team('zombie'))
    const debuff = firstOf(events, 'debuff')
    expect(debuff?.uid).toBe(teams.B[0]?.uid)
    expect(debuff?.atk).toBe(1)
    expect(debuff?.atkNow).toBe(0)
  })
})

describe('Al recibir daño', () => {
  it('el Berserker gana ATK al sobrevivir a un golpe', () => {
    const { events, teams } = fight(team('berserker'), team('zombie'))
    const buff = firstOf(events, 'buff')
    expect(buff?.uid).toBe(teams.A[0]?.uid)
    expect(buff?.atk).toBe(2)
    expect(buff?.atkNow).toBe(4)
  })

  it('no se dispara si la unidad muere con el golpe', () => {
    // Aguanta el primer golpe (4 PV → 1) y crece; en el segundo muere y ya no crece.
    const { events, teams, outcome } = fight(team('berserker'), team('knight'))
    const berserker = teams.A[0]?.uid
    expect(eventsOf(events, 'buff').filter((event) => event.uid === berserker)).toHaveLength(1)
    expect(eventsOf(events, 'damage').filter((event) => event.uid === berserker)).toHaveLength(2)
    expect(outcome).toBe('draw')
  })
})

describe('Al matar', () => {
  it('el Saurio se cura al matar si sigue vivo', () => {
    const { events, teams } = fight(team('saurian'), team('skeleton'))
    const heal = firstOf(events, 'heal')
    expect(heal?.uid).toBe(teams.A[0]?.uid)
    expect(heal?.amount).toBe(1)
    expect(heal?.hp).toBe(4)
  })

  it('no se dispara si el atacante muere en el mismo golpe', () => {
    const { events, outcome } = fight(team('saurian'), team('paladin'))
    expect(outcome).toBe('draw')
    expect(eventsOf(events, 'heal')).toHaveLength(0)
  })
})

describe('Al morir', () => {
  it('el Chamán mejora al aliado de detrás', () => {
    const { events, teams } = fight(team('shaman', 'zombie'), team('knight'))
    const buff = firstOf(events, 'buff')
    expect(buff?.uid).toBe(teams.A[1]?.uid)
    expect([buff?.atk, buff?.hp]).toEqual([2, 2])
    expect([buff?.atkNow, buff?.hpNow]).toEqual([3, 7])
  })

  it('se resuelve después de retirar a la unidad muerta', () => {
    const { events } = fight(team('shaman', 'zombie'), team('knight'))
    const deathIndex = events.findIndex((event) => event.type === 'death')
    const buffIndex = events.findIndex((event) => event.type === 'buff')
    expect(deathIndex).toBeLessThan(buffIndex)
  })
})

describe('Cuando muere un aliado', () => {
  it('el Nigromante crece con la muerte de un aliado', () => {
    const { events, teams } = fight(team('zombie', 'necromancer'), team('knight'))
    const necromancer = teams.A[1]?.uid
    const buffs = eventsOf(events, 'buff').filter((event) => event.uid === necromancer)
    expect(buffs).toHaveLength(1)
    expect([buffs[0]?.atk, buffs[0]?.hp]).toEqual([1, 1])
  })

  it('cuenta también la muerte de una ficha invocada', () => {
    // Muere el Esqueleto, deja unos Huesos, y los Huesos también mueren.
    const { events, teams } = fight(team('skeleton', 'necromancer'), team('grunt'))
    const necromancer = teams.A[1]?.uid
    expect(eventsOf(events, 'buff').filter((event) => event.uid === necromancer)).toHaveLength(2)
  })

  it('no crece con la muerte de un enemigo', () => {
    const { events, teams } = fight(team('necromancer', 'squire'), team('skeleton'))
    const necromancer = teams.A[0]?.uid
    expect(eventsOf(events, 'buff').filter((event) => event.uid === necromancer)).toHaveLength(0)
  })
})

describe('Cuando muere cualquier unidad', () => {
  it('el Necrófago crece con las dos muertes, aliada y enemiga', () => {
    const { events, teams } = fight(team('grunt', 'ghoul'), team('grunt'))
    const ghoul = teams.A[1]?.uid
    const buffs = eventsOf(events, 'buff').filter((event) => event.uid === ghoul)
    expect(buffs).toHaveLength(2)
    expect(buffs.map((event) => event.atkNow)).toEqual([3, 4])
  })
})
