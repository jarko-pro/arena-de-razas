import { setMuted, useMuted } from './sound'

export function MuteButton() {
  const muted = useMuted()
  return (
    <button
      type="button"
      className="btn-sonido"
      onClick={() => setMuted(!muted)}
      aria-pressed={muted}
      aria-label={muted ? 'Activar el sonido' : 'Silenciar'}
      title={muted ? 'Activar el sonido' : 'Silenciar'}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  )
}
