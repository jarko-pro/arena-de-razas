import { useState } from 'react'
import { BattleTestScreen } from './BattleTestScreen'
import { StartScreen } from './StartScreen'

/** Pantallas de la versión actual. El hito 5 sustituye esto por el bucle de partida. */
type Screen = 'start' | 'battle'

export function App() {
  const [screen, setScreen] = useState<Screen>('start')

  return screen === 'start' ? (
    <StartScreen onPlay={() => setScreen('battle')} />
  ) : (
    <BattleTestScreen onBack={() => setScreen('start')} />
  )
}
