import { useState } from 'react'
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
import { RoundSummary } from './RoundSummary'
import { ShopScreen } from './ShopScreen'
import { StartScreen } from './StartScreen'

/** Inicio → tienda → combate (con su resultado) → tienda… → final. */
type Screen =
  | { readonly kind: 'start' }
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
  return { kind: 'shop', game: newGame(newSeed(), RACES) }
}

export function App() {
  const [screen, setScreen] = useState<Screen>({ kind: 'start' })

  switch (screen.kind) {
    case 'start':
      return <StartScreen onPlay={() => setScreen(startGame())} />

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
