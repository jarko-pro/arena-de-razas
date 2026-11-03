import { STARTING_LIVES, WINS_TO_WIN, type GameState } from '../engine/game'
import { MuteButton } from './MuteButton'

interface GameHudProps {
  readonly game: GameState
  /** Ronda a mostrar si no es la de la tienda (en el resultado, la del combate). */
  readonly round?: number
}

/** Ronda, vidas y victorias: siempre visibles durante la partida. */
export function GameHud({ game, round }: GameHudProps) {
  return (
    <div className="hud" role="status">
      <span>
        Ronda <b>{round ?? game.shop.round}</b>
      </span>
      <span aria-label={`${game.lives} de ${STARTING_LIVES} vidas`}>
        <span aria-hidden="true">❤</span> <b>{game.lives}</b>/{STARTING_LIVES}
      </span>
      <span aria-label={`${game.wins} de ${WINS_TO_WIN} victorias`}>
        <span aria-hidden="true">🏆</span> <b>{game.wins}</b>/{WINS_TO_WIN}
      </span>
      <MuteButton />
    </div>
  )
}
