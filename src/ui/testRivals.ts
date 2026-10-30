import type { TeamUnit } from '../engine/combat'
import { tierForRound } from '../engine/shop'
import type { Tier } from '../engine/units'

// Rivales fijos provisionales: el hito 5 los sustituye por equipos aleatorios
// y el hito 6 por bots.
const RIVALS: Record<Tier, readonly TeamUnit[]> = {
  1: [{ defId: 'zombie' }, { defId: 'grunt' }, { defId: 'skeleton' }],
  2: [{ defId: 'squire' }, { defId: 'berserker' }, { defId: 'spitter' }, { defId: 'ghoul' }],
  3: [
    { defId: 'knight' },
    { defId: 'saurian' },
    { defId: 'basilisk' },
    { defId: 'cleric' },
    { defId: 'necromancer' },
  ],
}

export function testRival(round: number): readonly TeamUnit[] {
  return RIVALS[tierForRound(round)]
}
