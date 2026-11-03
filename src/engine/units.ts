// Definiciones de las unidades y fichas de docs/diseno.md como datos.
// Una unidad nueva se añade aquí combinando disparadores y efectos existentes.

export type Race = 'orc' | 'human' | 'lizard' | 'undead'
export type Tier = 1 | 2 | 3
export type Level = 1 | 2 | 3

export const RACES: readonly Race[] = ['orc', 'human', 'lizard', 'undead']
export const LEVELS: readonly Level[] = [1, 2, 3]

export const RACE_NAMES: Record<Race, string> = {
  orc: 'Orcos',
  human: 'Humanos',
  lizard: 'Hombres lagarto',
  undead: 'No muertos',
}

export type Trigger =
  | 'battleStart'
  | 'onHit'
  | 'onDamaged'
  | 'onKill'
  | 'onDeath'
  | 'onAllyDeath'
  | 'onAnyDeath'
  | 'onBuy'
  | 'onSell'
  /** Al subir de nivel apilando copias en la tienda. De momento ninguna unidad lo usa. */
  | 'onLevelUp'

/** Disparadores que se resuelven dentro de un combate. */
export const COMBAT_TRIGGERS: readonly Trigger[] = [
  'battleStart',
  'onHit',
  'onDamaged',
  'onKill',
  'onDeath',
  'onAllyDeath',
  'onAnyDeath',
]

/**
 * Valor de habilidad que escala con el nivel (diseno.md).
 * - `perLevel`: n, 2n, 3n — el caso normal.
 * - `fixed`: n siempre.
 * - `levelSteps`: 0, n, 2n — para el Camaleón.
 */
export type AbilityValue =
  | { readonly kind: 'perLevel'; readonly n: number }
  | { readonly kind: 'fixed'; readonly n: number }
  | { readonly kind: 'levelSteps'; readonly n: number }

export const perLevel = (n: number): AbilityValue => ({ kind: 'perLevel', n })
export const fixed = (n: number): AbilityValue => ({ kind: 'fixed', n })
export const levelSteps = (n: number): AbilityValue => ({ kind: 'levelSteps', n })

export function resolveValue(value: AbilityValue, level: Level): number {
  switch (value.kind) {
    case 'perLevel':
      return value.n * level
    case 'fixed':
      return value.n
    case 'levelSteps':
      return value.n * (level - 1)
  }
}

export type Target =
  | { readonly kind: 'self' }
  | { readonly kind: 'allyAhead' }
  | { readonly kind: 'allyBehind' }
  | { readonly kind: 'randomAlly'; readonly race?: Race; readonly excludeSelf?: boolean }
  | { readonly kind: 'allAllies'; readonly race?: Race; readonly excludeSelf?: boolean }
  | { readonly kind: 'frontEnemy' }
  | { readonly kind: 'randomEnemy' }
  | { readonly kind: 'allEnemies' }
  | { readonly kind: 'hitTarget' }
  | { readonly kind: 'enemyBehindTarget' }

export type ProjectileKind = 'arrow' | 'acid'

export type Effect =
  | {
      readonly kind: 'damage'
      readonly target: Target
      readonly amount: AbilityValue
      readonly projectile?: ProjectileKind
    }
  | {
      readonly kind: 'buff'
      readonly target: Target
      readonly atk: AbilityValue
      readonly hp: AbilityValue
    }
  | { readonly kind: 'healFull'; readonly target: Target }
  | { readonly kind: 'debuffAtk'; readonly target: Target; readonly amount: AbilityValue }
  | {
      readonly kind: 'summon'
      readonly unitId: UnitId
      readonly count: AbilityValue
      /** `deadAlly`: en el sitio del aliado que acaba de morir (con "Cuando muere un aliado"). */
      readonly placement: 'self' | 'behind' | 'deadAlly'
      /** Si está, las estadísticas de la ficha son este valor en ATK y PV. */
      readonly stats?: AbilityValue
    }
  | { readonly kind: 'revive'; readonly hp: AbilityValue; readonly once: boolean }
  | { readonly kind: 'copyAtkIfHigher'; readonly target: Target; readonly bonus: AbilityValue }

export interface Ability {
  readonly trigger: Trigger
  /** Nombre decorativo que se muestra al dispararse. */
  readonly label: string
  /** Descripción en español; `{n}` se sustituye por el valor del nivel y `{s}` por "s" si no es 1. */
  readonly text: string
  readonly effect: Effect
  /** Veces que puede dispararse en un combate; sin límite si no está. */
  readonly uses?: AbilityValue
}

export interface UnitDef {
  readonly id: UnitId
  readonly name: string
  readonly race: Race
  readonly tier: Tier
  readonly atk: number
  readonly hp: number
  readonly ability?: Ability
  /** Las fichas invocadas no se compran ni salen en la tienda. */
  readonly token?: boolean
}

export type UnitId =
  // Orcos
  | 'grunt'
  | 'warWolf'
  | 'berserker'
  | 'shaman'
  | 'raider'
  | 'ogre'
  // Humanos
  | 'recruit'
  | 'archer'
  | 'squire'
  | 'cleric'
  | 'knight'
  | 'paladin'
  // Hombres lagarto
  | 'spitter'
  | 'lizardWhelp'
  | 'basilisk'
  | 'chameleon'
  | 'saurian'
  | 'hydra'
  // No muertos
  | 'skeleton'
  | 'zombie'
  | 'necromancer'
  | 'ghoul'
  | 'spectre'
  | 'lich'
  // Fichas
  | 'bones'
  | 'hydraHead'

export const UNITS: Record<UnitId, UnitDef> = {
  // ---------------------------------------------------------------- Orcos ---
  grunt: { id: 'grunt', name: 'Grunt', race: 'orc', tier: 1, atk: 3, hp: 2 },
  warWolf: {
    id: 'warWolf',
    name: 'Lobo de guerra',
    race: 'orc',
    tier: 1,
    atk: 2,
    hp: 2,
    ability: {
      trigger: 'onDeath',
      label: 'Aullido final',
      text: 'Al morir: +{n} ATK a todos los orcos aliados.',
      effect: {
        kind: 'buff',
        target: { kind: 'allAllies', race: 'orc' },
        atk: perLevel(1),
        hp: fixed(0),
      },
    },
  },
  berserker: {
    id: 'berserker',
    name: 'Berserker',
    race: 'orc',
    tier: 2,
    atk: 2,
    hp: 5,
    ability: {
      trigger: 'onDamaged',
      label: '¡Furia!',
      text: 'Al recibir daño: +{n} ATK.',
      effect: { kind: 'buff', target: { kind: 'self' }, atk: perLevel(2), hp: fixed(0) },
    },
  },
  shaman: {
    id: 'shaman',
    name: 'Chamán',
    race: 'orc',
    tier: 2,
    atk: 2,
    hp: 3,
    ability: {
      trigger: 'onDeath',
      label: 'Último aliento',
      text: 'Al morir: +{n}/+{n} al aliado de detrás.',
      effect: {
        kind: 'buff',
        target: { kind: 'allyBehind' },
        atk: perLevel(2),
        hp: perLevel(2),
      },
    },
  },
  raider: {
    id: 'raider',
    name: 'Saqueador',
    race: 'orc',
    tier: 3,
    atk: 4,
    hp: 4,
    ability: {
      trigger: 'onKill',
      label: 'Botín de guerra',
      text: 'Al matar: +{n}/+{n}.',
      effect: { kind: 'buff', target: { kind: 'self' }, atk: perLevel(2), hp: perLevel(2) },
    },
  },
  ogre: {
    id: 'ogre',
    name: 'Ogro aplastador',
    race: 'orc',
    tier: 3,
    atk: 5,
    hp: 6,
    ability: {
      trigger: 'onHit',
      label: 'Mazazo',
      text: 'Al golpear: {n} de daño a la unidad rival de detrás de su objetivo.',
      effect: {
        kind: 'damage',
        target: { kind: 'enemyBehindTarget' },
        amount: perLevel(2),
      },
    },
  },

  // -------------------------------------------------------------- Humanos ---
  recruit: {
    id: 'recruit',
    name: 'Recluta',
    race: 'human',
    tier: 1,
    atk: 1,
    hp: 3,
    ability: {
      trigger: 'onBuy',
      label: 'Instrucción',
      text: 'Al comprar: +{n} PV permanente a un aliado al azar.',
      effect: {
        kind: 'buff',
        target: { kind: 'randomAlly', excludeSelf: true },
        atk: fixed(0),
        hp: perLevel(1),
      },
    },
  },
  archer: {
    id: 'archer',
    name: 'Arquero',
    race: 'human',
    tier: 1,
    atk: 1,
    hp: 2,
    ability: {
      trigger: 'battleStart',
      label: 'Disparo certero',
      text: 'Inicio del combate: {n} de daño a un enemigo al azar.',
      effect: {
        kind: 'damage',
        target: { kind: 'randomEnemy' },
        amount: perLevel(2),
        projectile: 'arrow',
      },
    },
  },
  squire: { id: 'squire', name: 'Escudero', race: 'human', tier: 2, atk: 2, hp: 5 },
  cleric: {
    id: 'cleric',
    name: 'Clérigo',
    race: 'human',
    tier: 2,
    atk: 1,
    hp: 3,
    ability: {
      trigger: 'battleStart',
      label: 'Bendición',
      text: 'Inicio del combate: +{n} PV al aliado de delante.',
      effect: {
        kind: 'buff',
        target: { kind: 'allyAhead' },
        atk: fixed(0),
        hp: perLevel(2),
      },
    },
  },
  knight: {
    id: 'knight',
    name: 'Caballero',
    race: 'human',
    tier: 3,
    atk: 3,
    hp: 5,
    ability: {
      trigger: 'battleStart',
      label: 'Grito de guerra',
      text: 'Inicio del combate: +{n} ATK a los demás humanos aliados.',
      effect: {
        kind: 'buff',
        target: { kind: 'allAllies', race: 'human', excludeSelf: true },
        atk: perLevel(1),
        hp: fixed(0),
      },
    },
  },
  paladin: {
    id: 'paladin',
    name: 'Paladín',
    race: 'human',
    tier: 3,
    atk: 3,
    hp: 5,
    ability: {
      trigger: 'onDeath',
      label: 'Sacrificio',
      text: 'Al morir: +{n} PV a todos los aliados.',
      effect: {
        kind: 'buff',
        target: { kind: 'allAllies' },
        atk: fixed(0),
        hp: perLevel(1),
      },
    },
  },

  // ------------------------------------------------------ Hombres lagarto ---
  spitter: {
    id: 'spitter',
    name: 'Escupidor',
    race: 'lizard',
    tier: 1,
    atk: 1,
    hp: 2,
    ability: {
      trigger: 'battleStart',
      label: 'Escupitajo ácido',
      text: 'Inicio del combate: {n} de daño a todos los enemigos.',
      effect: {
        kind: 'damage',
        target: { kind: 'allEnemies' },
        amount: perLevel(1),
        projectile: 'acid',
      },
    },
  },
  lizardWhelp: {
    id: 'lizardWhelp',
    name: 'Cría de lagarto',
    race: 'lizard',
    tier: 1,
    atk: 2,
    hp: 2,
    ability: {
      trigger: 'onSell',
      label: 'Relevo',
      text: 'Al vender: +{n}/+{n} permanente a un lagarto aliado al azar.',
      effect: {
        kind: 'buff',
        target: { kind: 'randomAlly', race: 'lizard', excludeSelf: true },
        atk: perLevel(1),
        hp: perLevel(1),
      },
    },
  },
  basilisk: {
    id: 'basilisk',
    name: 'Basilisco',
    race: 'lizard',
    tier: 2,
    atk: 2,
    hp: 5,
    ability: {
      trigger: 'onHit',
      label: 'Mirada pétrea',
      text: 'Al golpear: su objetivo pierde {n} ATK.',
      effect: { kind: 'debuffAtk', target: { kind: 'hitTarget' }, amount: perLevel(1) },
    },
  },
  chameleon: {
    id: 'chameleon',
    name: 'Camaleón',
    race: 'lizard',
    tier: 2,
    atk: 3,
    hp: 3,
    ability: {
      trigger: 'battleStart',
      label: 'Mimetismo',
      text: 'Inicio del combate: su ATK pasa a ser el del enemigo de delante si es mayor, +{n}.',
      effect: {
        kind: 'copyAtkIfHigher',
        target: { kind: 'frontEnemy' },
        bonus: levelSteps(1),
      },
    },
  },
  saurian: {
    id: 'saurian',
    name: 'Saurio',
    race: 'lizard',
    tier: 3,
    atk: 5,
    hp: 4,
    ability: {
      trigger: 'onKill',
      label: 'Festín',
      text: 'Al matar: recupera todos sus PV.',
      effect: { kind: 'healFull', target: { kind: 'self' } },
    },
  },
  hydra: {
    id: 'hydra',
    name: 'Hidra',
    race: 'lizard',
    tier: 3,
    atk: 3,
    hp: 5,
    ability: {
      trigger: 'onDeath',
      label: 'Regeneración',
      text: 'Al morir: invoca 2 Cabezas de hidra de {n}/{n}.',
      effect: {
        kind: 'summon',
        unitId: 'hydraHead',
        count: fixed(2),
        placement: 'self',
        stats: perLevel(2),
      },
    },
  },

  // ----------------------------------------------------------- No muertos ---
  skeleton: {
    id: 'skeleton',
    name: 'Esqueleto',
    race: 'undead',
    tier: 1,
    atk: 1,
    hp: 1,
    ability: {
      trigger: 'onDeath',
      label: 'Se alza de nuevo',
      text: 'Al morir: invoca unos Huesos de {n}/{n}.',
      effect: {
        kind: 'summon',
        unitId: 'bones',
        count: fixed(1),
        placement: 'self',
        stats: perLevel(1),
      },
    },
  },
  zombie: { id: 'zombie', name: 'Zombi', race: 'undead', tier: 1, atk: 1, hp: 5 },
  necromancer: {
    id: 'necromancer',
    name: 'Nigromante',
    race: 'undead',
    tier: 2,
    atk: 1,
    hp: 3,
    ability: {
      trigger: 'onAllyDeath',
      label: 'Cosecha de almas',
      text: 'Cuando muere un aliado: +{n}/+{n}.',
      effect: { kind: 'buff', target: { kind: 'self' }, atk: perLevel(1), hp: perLevel(1) },
    },
  },
  ghoul: {
    id: 'ghoul',
    name: 'Necrófago',
    race: 'undead',
    tier: 2,
    atk: 2,
    hp: 4,
    ability: {
      trigger: 'onAnyDeath',
      label: 'Carroña',
      text: 'Cuando muere cualquier unidad: +{n} ATK.',
      effect: { kind: 'buff', target: { kind: 'self' }, atk: perLevel(1), hp: fixed(0) },
    },
  },
  spectre: {
    id: 'spectre',
    name: 'Espectro',
    race: 'undead',
    tier: 3,
    atk: 4,
    hp: 3,
    ability: {
      trigger: 'onDeath',
      label: 'Regreso del más allá',
      text: 'Al morir por primera vez en el combate: vuelve con {n} PV.',
      effect: { kind: 'revive', hp: perLevel(1), once: true },
    },
  },
  lich: {
    id: 'lich',
    name: 'Liche',
    race: 'undead',
    tier: 3,
    atk: 3,
    hp: 5,
    ability: {
      trigger: 'onAllyDeath',
      label: 'Levantar a los muertos',
      text: 'Cuando muere un aliado: invoca unos Huesos 1/1 en su sitio (máximo {n} por combate).',
      effect: {
        kind: 'summon',
        unitId: 'bones',
        count: fixed(1),
        placement: 'deadAlly',
      },
      uses: perLevel(1),
    },
  },

  // --------------------------------------------------------------- Fichas ---
  bones: {
    id: 'bones',
    name: 'Huesos',
    race: 'undead',
    tier: 1,
    atk: 1,
    hp: 1,
    token: true,
  },
  hydraHead: {
    id: 'hydraHead',
    name: 'Cabeza de hidra',
    race: 'lizard',
    tier: 3,
    atk: 2,
    hp: 2,
    token: true,
  },
}

export const ALL_UNITS: readonly UnitDef[] = Object.values(UNITS)

/** Las 24 unidades que se pueden comprar en la tienda. */
export const PLAYABLE_UNITS: readonly UnitDef[] = ALL_UNITS.filter((unit) => unit.token !== true)

export function unitDef(id: UnitId): UnitDef {
  return UNITS[id]
}

/** Estadísticas base de una unidad en un nivel: +2/+2 por nivel (diseno.md). */
export function statsForLevel(def: UnitDef, level: Level): { atk: number; hp: number } {
  const bonus = (level - 1) * 2
  return { atk: def.atk + bonus, hp: def.hp + bonus }
}

/** El valor que se muestra en el texto de la habilidad. */
export function abilityValue(effect: Effect): AbilityValue | undefined {
  switch (effect.kind) {
    case 'damage':
    case 'debuffAtk':
      return effect.amount
    case 'buff':
      return effect.atk.n > 0 ? effect.atk : effect.hp
    case 'summon':
      return effect.stats ?? effect.count
    case 'revive':
      return effect.hp
    case 'copyAtkIfHigher':
      return effect.bonus
    case 'healFull':
      return undefined
  }
}

/** Texto de la habilidad con `{n}` ya resuelto para ese nivel. */
export function abilityText(def: UnitDef, level: Level): string {
  const ability = def.ability
  if (!ability) return ''
  // Con límite de usos, el valor que cambia con el nivel es ese límite.
  const value = ability.uses ?? abilityValue(ability.effect)
  if (!value) return ability.text
  const n = resolveValue(value, level)
  return ability.text.replaceAll('{n}', String(n)).replaceAll('{s}', n === 1 ? '' : 's')
}
