import { describe, expect, it } from 'vitest'
import {
  RIVAL_COUNT,
  applyBotAction,
  createRivals,
  playBotTurn,
  type BotTurn,
  type Rival,
} from '../src/engine/bot'
import { MAX_TEAM_SIZE } from '../src/engine/combat'
import {
  REROLL_COST,
  UNIT_COST,
  levelForCopies,
  nextShop,
  tierForRound,
  type ShopState,
} from '../src/engine/shop'
import { RACES, UNITS, type Race } from '../src/engine/units'

/** Turnos de un rival desde la ronda 1 hasta `rounds`, con el oro extra de cada ronda. */
function playRounds(rival: Rival, rounds: number, extraGold: (round: number) => number = () => 0) {
  const turns: { before: ShopState; turn: BotTurn }[] = []
  let current = rival
  for (let round = 1; round <= rounds; round++) {
    if (round > 1) current = { ...current, shop: nextShop(current.shop, extraGold(round)) }
    const turn = playBotTurn(current)
    turns.push({ before: current.shop, turn })
    current = turn.rival
  }
  return turns
}

const SEEDS = Array.from({ length: 25 }, (_, i) => `bot-${i}`)

describe('Creación de rivales', () => {
  it('crea 4 rivales con nombres y razas preferidas distintas', () => {
    const rivals = createRivals('partida', RACES)
    expect(rivals).toHaveLength(RIVAL_COUNT)
    expect(new Set(rivals.map((rival) => rival.name)).size).toBe(RIVAL_COUNT)
    expect(new Set(rivals.map((rival) => rival.race)).size).toBe(RIVAL_COUNT)
  })

  it('misma semilla, mismos rivales y mismos turnos', () => {
    const a = createRivals('semilla', RACES).map((rival) => playBotTurn(rival))
    const b = createRivals('semilla', RACES).map((rival) => playBotTurn(rival))
    expect(a).toEqual(b)
  })

  it('con menos razas que rivales, las repite', () => {
    const rivals = createRivals('partida', ['orc', 'human'])
    expect(rivals).toHaveLength(RIVAL_COUNT)
    expect(new Set(rivals.map((rival) => rival.race))).toEqual(new Set<Race>(['orc', 'human']))
  })
})

describe('El bot nunca hace jugadas ilegales', () => {
  it('cada acción la acepta la tienda y el resultado coincide', () => {
    for (const seed of SEEDS) {
      for (const rival of createRivals(seed, RACES)) {
        for (const { before, turn } of playRounds(rival, 15, (round) => round % 4)) {
          let state = before
          for (const action of turn.actions) {
            const result = applyBotAction(state, action)
            expect(result.ok, `${seed} · ${rival.name} · ${action.type}`).toBe(true)
            if (result.ok) state = result.state
          }
          expect(state).toEqual(turn.rival.shop)
        }
      }
    }
  })

  it('su equipo siempre es válido', () => {
    for (const seed of SEEDS) {
      for (const rival of createRivals(seed, RACES)) {
        for (const { turn } of playRounds(rival, 15)) {
          const shop = turn.rival.shop
          expect(shop.gold).toBeGreaterThanOrEqual(0)
          expect(shop.team.length).toBeLessThanOrEqual(MAX_TEAM_SIZE)
          for (const unit of shop.team) {
            expect(unit.level).toBe(levelForCopies(unit.copies))
            expect(UNITS[unit.defId].tier).toBeLessThanOrEqual(tierForRound(shop.round))
            expect(UNITS[unit.defId].token).not.toBe(true)
          }
        }
      }
    }
  })

  it('respeta las razas que recibe', () => {
    for (const rival of createRivals('solo-lagartos', ['lizard'])) {
      for (const { turn } of playRounds(rival, 8)) {
        for (const unit of turn.rival.shop.team) expect(UNITS[unit.defId].race).toBe('lizard')
      }
    }
  })
})

describe('Estrategia del bot', () => {
  it('gasta su oro: termina sin poder comprar ni hacer reroll útil', () => {
    for (const seed of SEEDS) {
      for (const rival of createRivals(seed, RACES)) {
        for (const { turn } of playRounds(rival, 10)) {
          expect(turn.rival.shop.gold).toBeLessThan(UNIT_COST + REROLL_COST)
        }
      }
    }
  })

  it('llena el equipo pronto: casi siempre tiene 5 unidades en la ronda 4', () => {
    const sizes = SEEDS.flatMap((seed) =>
      createRivals(seed, RACES).map(
        (rival) => playRounds(rival, 4).at(-1)?.turn.rival.shop.team.length ?? 0,
      ),
    )
    const full = sizes.filter((size) => size === MAX_TEAM_SIZE).length
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(MAX_TEAM_SIZE - 1)
    expect(full / sizes.length).toBeGreaterThan(0.9)
  })

  it('prefiere su raza: la mayoría de su equipo es de su raza en la ronda 10', () => {
    let preferred = 0
    let total = 0
    for (const seed of SEEDS) {
      for (const rival of createRivals(seed, RACES)) {
        const team = playRounds(rival, 10).at(-1)?.turn.rival.shop.team ?? []
        total += team.length
        preferred += team.filter((unit) => UNITS[unit.defId].race === rival.race).length
      }
    }
    expect(preferred / total).toBeGreaterThan(0.6)
  })

  it('apila copias y sube de nivel', () => {
    let leveled = 0
    let rivals = 0
    for (const seed of SEEDS) {
      for (const rival of createRivals(seed, RACES)) {
        rivals++
        const team = playRounds(rival, 8).at(-1)?.turn.rival.shop.team ?? []
        if (team.some((unit) => unit.level >= 2)) leveled++
        expect(team.some((unit) => unit.copies > 1)).toBe(true)
      }
    }
    expect(leveled / rivals).toBeGreaterThan(0.5)
  })

  it('congela la tienda cuando deja algo útil y la descongela para hacer reroll', () => {
    const actions = SEEDS.flatMap((seed) =>
      createRivals(seed, RACES).flatMap((rival) =>
        playRounds(rival, 10).flatMap(({ before, turn }) =>
          turn.actions.map((action) => ({ action, frozenBefore: before.frozen })),
        ),
      ),
    )
    const freezes = actions.filter(({ action }) => action.type === 'freeze')
    expect(freezes.some(({ frozenBefore }) => !frozenBefore)).toBe(true)
    expect(freezes.some(({ frozenBefore }) => frozenBefore)).toBe(true)
  })

  it('usa el oro extra que recibe', () => {
    const rival = createRivals('oro', RACES)[0]
    if (!rival) throw new Error('sin rival')
    const turns = playRounds(rival, 2, () => 3)
    const second = turns[1]
    expect(second?.before.gold).toBe(13)
    expect(second?.turn.rival.shop.gold).toBeLessThan(UNIT_COST + REROLL_COST)
  })

  it('coloca detrás las unidades de inicio del combate', () => {
    for (const seed of SEEDS) {
      for (const rival of createRivals(seed, RACES)) {
        const team = playRounds(rival, 6).at(-1)?.turn.rival.shop.team ?? []
        const back = team.map((unit) => UNITS[unit.defId].ability?.trigger === 'battleStart')
        const firstBack = back.indexOf(true)
        if (firstBack >= 0) expect(back.slice(firstBack).every(Boolean)).toBe(true)
      }
    }
  })
})
