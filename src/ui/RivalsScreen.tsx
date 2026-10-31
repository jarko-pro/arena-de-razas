import type { Rival } from '../engine/bot'

interface RivalsScreenProps {
  readonly rivals: readonly Rival[]
  readonly onStart: () => void
}

/** Presenta a los rivales de la partida antes de la primera tienda. Su raza no se muestra. */
export function RivalsScreen({ rivals, onStart }: RivalsScreenProps) {
  return (
    <main className="pantalla-rivales">
      <h1 className="titulo">Rivales</h1>
      <p className="subtitulo">
        En cada ronda te enfrentarás a uno de ellos, al azar. Descubre cómo juega cada uno.
      </p>
      <ul className="lista-rivales">
        {rivals.map((rival) => (
          <li key={rival.id} className="tarjeta-rival">
            <span className="inicial-rival" aria-hidden="true">
              {rival.name.charAt(0)}
            </span>
            <b>{rival.name}</b>
          </li>
        ))}
      </ul>
      <button type="button" className="boton-principal" onClick={onStart}>
        Empezar
      </button>
    </main>
  )
}
