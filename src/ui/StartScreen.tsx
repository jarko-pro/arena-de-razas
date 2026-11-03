interface StartScreenProps {
  readonly onPlay: () => void
  /** Presente si hay una partida guardada que se puede continuar. */
  readonly onContinue?: () => void
}

export function StartScreen({ onPlay, onContinue }: StartScreenProps) {
  return (
    <main className="pantalla-inicio">
      <h1 className="titulo">Arena de Razas</h1>
      <p className="subtitulo">Orcos, humanos, hombres lagarto y no muertos.</p>
      {onContinue && (
        <button type="button" className="boton-principal" onClick={onContinue}>
          Continuar
        </button>
      )}
      <button
        type="button"
        className={onContinue ? 'boton-principal secundario' : 'boton-principal'}
        onClick={onPlay}
      >
        {onContinue ? 'Partida nueva' : 'Jugar'}
      </button>
    </main>
  )
}
