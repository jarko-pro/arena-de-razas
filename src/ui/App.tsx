import { useState } from 'react'
import type { TeamUnit } from '../engine/combat'
import { NO_STREAK, streakGold, updateStreak, type Streak } from '../engine/game'
import { battleTeam, createShop, nextShop, type ShopState } from '../engine/shop'
import { RACES } from '../engine/units'
import { BattleScreen } from './BattleScreen'
import { ShopScreen } from './ShopScreen'
import { StartScreen } from './StartScreen'
import { testRival } from './testRivals'

/** Pantallas de la versión actual. El hito 5 sustituye esto por el bucle de partida. */
type Screen =
  | { readonly kind: 'start' }
  | { readonly kind: 'shop'; readonly shop: ShopState; readonly streak: Streak }
  | {
      readonly kind: 'battle'
      readonly shop: ShopState
      readonly streak: Streak
      readonly playerTeam: readonly TeamUnit[]
      readonly rivalTeam: readonly TeamUnit[]
    }

/** Semilla de la partida; a partir de aquí toda la aleatoriedad la decide el motor. */
function newSeed(): string {
  return Date.now().toString(36)
}

export function App() {
  const [screen, setScreen] = useState<Screen>({ kind: 'start' })

  switch (screen.kind) {
    case 'start':
      return (
        <StartScreen
          onPlay={() =>
            setScreen({
              kind: 'shop',
              shop: createShop(1, [], newSeed(), RACES),
              streak: NO_STREAK,
            })
          }
        />
      )

    case 'shop':
      return (
        <ShopScreen
          state={screen.shop}
          streak={screen.streak}
          onChange={(shop) => setScreen({ ...screen, shop })}
          onFight={() =>
            setScreen({
              ...screen,
              kind: 'battle',
              playerTeam: battleTeam(screen.shop),
              rivalTeam: testRival(screen.shop.round),
            })
          }
        />
      )

    case 'battle': {
      const { shop } = screen
      return (
        <BattleScreen
          round={shop.round}
          playerTeam={screen.playerTeam}
          rivalTeam={screen.rivalTeam}
          seed={`${shop.seed}:combate:${shop.round}`}
          onBack={(outcome) => {
            const streak = updateStreak(screen.streak, outcome)
            setScreen({ kind: 'shop', shop: nextShop(shop, streakGold(streak.count)), streak })
          }}
        />
      )
    }
  }
}
