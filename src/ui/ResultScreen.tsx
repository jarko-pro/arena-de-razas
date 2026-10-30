import type { Outcome } from '../engine/combat'
import {
  STARTING_LIVES,
  WINS_TO_WIN,
  streakGold,
  type GameState,
  type RoundResult,
} from '../engine/game'

const TITLE: Record<Outcome, string> = {
  victoryA: '¡Victoria!',
  victoryB: 'Derrota',
  draw: 'Empate',
}

function changeText(game: GameState, result: RoundResult): string {
  if (result.winsGained > 0) return `+1 victoria (${game.wins} de ${WINS_TO_WIN})`
  if (result.livesLost > 0) {
    if (game.lives === 0) return '−1 vida: te has quedado sin vidas.'
    return game.lives === 1
      ? '−1 vida (te queda 1)'
      : `−1 vida (te quedan ${game.lives} de ${STARTING_LIVES})`
  }
  return 'Ni ganas victoria ni pierdes vida.'
}

function streakText(game: GameState): string {
  const { kind, count } = game.streak
  if (kind === 'none' || count === 0) return 'Sin racha.'
  const what = kind === 'win' ? 'victoria' : 'derrota'
  const gold = streakGold(count)
  const label = `Racha de ${count} ${what}${count === 1 ? '' : 's'}`
  return gold > 0 ? `${label}: +${gold} de oro en la tienda.` : `${label}.`
}

interface ResultScreenProps {
  readonly game: GameState
  readonly onContinue: () => void
}

/** Resultado de un combate: qué ha cambiado y adónde se va ahora. */
export function ResultScreen({ game, onContinue }: ResultScreenProps) {
  const result = game.lastRound
  if (!result) return null
  const over = game.status !== 'playing'
  return (
    <main className={`pantalla-resultado resultado-${result.outcome}`}>
      <p className="resultado-ronda">Ronda {result.round}</p>
      <h1>{TITLE[result.outcome]}</h1>
      <p className="resultado-cambio">{changeText(game, result)}</p>
      {!over && <p className="resultado-racha">{streakText(game)}</p>}
      <button type="button" className="boton-principal" onClick={onContinue}>
        {over ? 'Ver el final' : `Ir a la ronda ${game.shop.round}`}
      </button>
    </main>
  )
}
