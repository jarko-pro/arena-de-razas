// Simula partidas entre bots y muestra el equilibrio de razas y unidades.
//
//   pnpm simulate [salas] [semilla]
//
// Cada sala son 4 partidas (un bot por raza), así que 1000 salas = 4000 partidas.

import { simulate, type MatchupStats } from '../src/engine/simulation'
import { PLAYABLE_UNITS, RACES, RACE_NAMES, type Race } from '../src/engine/units'

const lobbies = Number(process.argv[2] ?? 1000)
const seed = process.argv[3] ?? 'equilibrio'
if (!(lobbies > 0)) {
  console.error('Uso: pnpm simulate [salas] [semilla]')
  process.exit(1)
}

const pct = (part: number, total: number): string =>
  total === 0 ? '   -  ' : `${((part / total) * 100).toFixed(1).padStart(5)}%`
const winRate = (m: MatchupStats | undefined): string => (m ? pct(m.won, m.won + m.lost) : '   -  ')

const started = performance.now()
const summary = simulate(seed, RACES, lobbies)
const seconds = ((performance.now() - started) / 1000).toFixed(1)

console.log(`\n${summary.lobbies} salas (${summary.lobbies * RACES.length} partidas), semilla "${seed}", ${seconds} s\n`)

console.log('Partidas ganadas por raza (objetivo: ninguna por encima del 60 %)')
for (const race of RACES) {
  const s = summary.races[race]
  if (!s) continue
  const flag = s.won / s.games > 0.6 ? '  ⚠' : ''
  console.log(
    `  ${RACE_NAMES[race].padEnd(18)} ${pct(s.won, s.games)}   ronda media de fin ${s.averageRounds.toFixed(1)}${flag}`,
  )
}

console.log('\nCombates ganados, fila contra columna (sin contar empates)')
const short = (race: Race): string => RACE_NAMES[race].slice(0, 9).padStart(9)
console.log(`  ${''.padEnd(18)}${RACES.map(short).join(' ')}`)
for (const a of RACES) {
  const row = RACES.map((b) => (a === b ? '      -  ' : `  ${winRate(summary.matchups[a]?.[b])}`))
  console.log(`  ${RACE_NAMES[a].padEnd(18)}${row.join('')}`)
}

console.log('\nUnidades: combates en los que aparece y % ganados con ella en el equipo')
const rows = PLAYABLE_UNITS.map((def) => ({ def, stats: summary.units[def.id] })).sort(
  (x, y) => (y.stats ? y.stats.won / y.stats.battles : -1) - (x.stats ? x.stats.won / x.stats.battles : -1),
)
for (const { def, stats } of rows) {
  const name = `${def.name} (${RACE_NAMES[def.race].slice(0, 6)}, T${def.tier})`.padEnd(34)
  if (!stats || stats.won === 0) {
    console.log(`  ${name} ⚠ nunca en un equipo ganador`)
    continue
  }
  console.log(
    `  ${name} ${String(stats.battles).padStart(7)} combates  ${pct(stats.won, stats.battles)} ganados  nivel máx ${stats.maxLevel}`,
  )
}
