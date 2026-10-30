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
import { ResultScreen } from './ResultScreen'
import { ShopScreen } from './ShopScreen'
import { StartScreen } from './StartScreen'

/** Inicio → tienda → combate → resultado → tienda… → final. */
type Screen =
  | { readonly kind: 'start' }
  | { readonly kind: 'shop'; readonly game: GameState }
  | { readonly kind: 'battle'; readonly game: GameState; readonly battle: BattleSetup }
  | { readonly kind: 'result'; readonly game: GameState }
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
            onFight={() => setScreen({ kind: 'battle', game, battle: prepareBattle(game) })}
          />
        </div>
      )
    }

    case 'battle': {
      const { game, battle } = screen
      return (
        <div className="partida">
          <GameHud game={game} />
          <BattleScreen
            round={battle.round}
            playerTeam={battle.playerTeam}
            rivalTeam={battle.rivalTeam}
            seed={battle.seed}
            onDone={(outcome) => setScreen({ kind: 'result', game: finishRound(game, outcome) })}
          />
        </div>
      )
    }

    case 'result': {
      const { game } = screen
      return (
        <div className="partida">
          <GameHud game={game} round={game.lastRound?.round} />
          <ResultScreen
            game={game}
            onContinue={() =>
              setScreen(game.status === 'playing' ? { kind: 'shop', game } : { kind: 'end', game })
            }
          />
        </div>
      )
    }

    case 'end':
      return <EndScreen game={screen.game} onPlayAgain={() => setScreen(startGame())} />
  }
}
