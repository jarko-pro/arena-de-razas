// Acceso al almacenamiento del navegador. Puede no existir o fallar (modo
// privado, cookies bloqueadas): en ese caso el juego sigue sin guardar nada.

export function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, value)
  } catch {
    // Sin almacenamiento no se guarda; no es un error para el jugador.
  }
}
