import { useEffect, useState } from 'react'
import {
  finishRound,
  newGame,
  prepareBattle,
  type BattleSetup,
  type GameState,
} from '../engine/game'
import { RACES } from '../engine/units'
import { BattleScreen } from './BattleScreen'
import { EndScreen } from './EndScreen'
import { GameHud } from './GameHud'
import { RivalsScreen } from './RivalsScreen'
import { RoundSummary } from './RoundSummary'
import { loadSave, storeSave, type SavedGame } from './savedGame'
import { ShopScreen } from './ShopScreen'
import { StartScreen } from './StartScreen'

/** Inicio → rivales → tienda → combate (con su resultado) → tienda… → final. */
type Screen =
  | { readonly kind: 'start'; readonly saved: SavedGame | null }
  | { readonly kind: 'rivals'; readonly game: GameState }
  | { readonly kind: 'shop'; readonly game: GameState }
  | {
      readonly kind: 'battle'
      readonly game: GameState
      readonly battle: BattleSetup
      /** Partida tras aplicar el resultado, en cuanto el combate termina. */
      readonly after: GameState | null
    }
  | { readonly kind: 'end'; readonly game: GameState }

/** Semilla de la partida; a partir de aquí toda la aleatoriedad la decide el motor. */
function newSeed(): string {
  return Date.now().toString(36)
}

function startGame(): Screen {
  return { kind: 'rivals', game: newGame(newSeed(), RACES) }
}

function resume(saved: SavedGame): Screen {
  const { game } = saved
  return saved.screen === 'battle'
    ? { kind: 'battle', game, battle: prepareBattle(game), after: null }
    : { kind: saved.screen, game }
}

/**
 * Qué guardar de cada pantalla. Con el combate ya visto se guarda la partida
 * siguiente; en la pantalla de inicio se deja el guardado como esté.
 */
function toSave(screen: Screen): SavedGame | null | undefined {
  switch (screen.kind) {
    case 'start':
      return undefined
    case 'rivals':
    case 'shop':
      return { screen: screen.kind, game: screen.game }
    case 'battle': {
      const { game, after } = screen
      if (!after) return { screen: 'battle', game }
      return after.status === 'playing' ? { screen: 'shop', game: after } : null
    }
    case 'end':
      return null
  }
}

export function App() {
  const [screen, setScreen] = useState<Screen>(() => ({ kind: 'start', saved: loadSave() }))

  useEffect(() => {
    const save = toSave(screen)
    if (save !== undefined) storeSave(save)
  }, [screen])

  switch (screen.kind) {
    case 'start': {
      const { saved } = screen
      return (
        <StartScreen
          onPlay={() => setScreen(startGame())}
          onContinue={saved ? () => setScreen(resume(saved)) : undefined}
        />
      )
    }

    case 'rivals': {
      const { game } = screen
      return (
        <RivalsScreen rivals={game.rivals} onStart={() => setScreen({ kind: 'shop', game })} />
      )
    }

    case 'shop': {
      const { game } = screen
      return (
        <div className="partida">
          <GameHud game={game} />
          <ShopScreen
            state={game.shop}
            streak={game.streak}
            onChange={(shop) => setScreen({ kind: 'shop', game: { ...game, shop } })}
            onFight={() =>
              setScreen({ kind: 'battle', game, battle: prepareBattle(game), after: null })
            }
          />
        </div>
      )
    }

    case 'battle': {
      const { game, battle, after } = screen
      return (
        <div className="partida">
          <GameHud game={after ?? game} round={battle.round} />
          <BattleScreen
            round={battle.round}
            playerTeam={battle.playerTeam}
            rivalTeam={battle.rivalTeam}
            rivalName={battle.rivalName}
            seed={battle.seed}
            onFinish={(outcome) => setScreen({ ...screen, after: finishRound(game, outcome) })}
          >
            {after && (
              <RoundSummary
                game={after}
                onContinue={() =>
                  setScreen(
                    after.status === 'playing'
                      ? { kind: 'shop', game: after }
                      : { kind: 'end', game: after },
                  )
                }
              />
            )}
          </BattleScreen>
        </div>
      )
    }

    case 'end':
      return <EndScreen game={screen.game} onPlayAgain={() => setScreen(startGame())} />
  }
}
