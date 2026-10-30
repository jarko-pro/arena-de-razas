import { STARTING_LIVES, WINS_TO_WIN, type GameState } from '../engine/game'

interface EndScreenProps {
  readonly game: GameState
  readonly onPlayAgain: () => void
}

/** Final de la partida: victoria con 10 victorias o derrota sin vidas. */
export function EndScreen({ game, onPlayAgain }: EndScreenProps) {
  const won = game.status === 'won'
  const rounds = game.lastRound?.round ?? game.shop.round
  return (
    <main className={`pantalla-final ${won ? 'final-victoria' : 'final-derrota'}`}>
      <h1 className="titulo">{won ? '¡Has ganado!' : 'Has perdido'}</h1>
      <p className="subtitulo">
        {won
          ? `Has llegado a ${WINS_TO_WIN} victorias.`
          : 'Te has quedado sin vidas.'}
      </p>
      <dl className="resumen-final">
        <div>
          <dt>Rondas</dt>
          <dd>{rounds}</dd>
        </div>
        <div>
          <dt>Victorias</dt>
          <dd>
            {game.wins}/{WINS_TO_WIN}
          </dd>
        </div>
        <div>
          <dt>Vidas</dt>
          <dd>
            {game.lives}/{STARTING_LIVES}
          </dd>
        </div>
      </dl>
      <button type="button" className="boton-principal" onClick={onPlayAgain}>
        Jugar otra vez
      </button>
    </main>
  )
}
