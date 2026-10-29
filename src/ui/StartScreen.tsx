interface StartScreenProps {
  readonly onPlay: () => void
}

export function StartScreen({ onPlay }: StartScreenProps) {
  return (
    <main className="pantalla-inicio">
      <h1 className="titulo">Arena de Razas</h1>
      <p className="subtitulo">Orcos, humanos, hombres lagarto y no muertos.</p>
      <button type="button" className="boton-principal" onClick={onPlay}>
        Jugar
      </button>
    </main>
  )
}
