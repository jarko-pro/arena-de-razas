import { useState } from 'react'
import type { TeamUnit } from '../engine/combat'
import { battleTeam, createShop, type ShopState } from '../engine/shop'
import { BattleScreen } from './BattleScreen'
import { ShopScreen } from './ShopScreen'
import { StartScreen } from './StartScreen'
import { testRival } from './testRivals'

/** Pantallas de la versión actual. El hito 5 sustituye esto por el bucle de partida. */
type Screen =
  | { readonly kind: 'start' }
  | { readonly kind: 'shop'; readonly shop: ShopState }
  | {
      readonly kind: 'battle'
      readonly shop: ShopState
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
          onPlay={() => setScreen({ kind: 'shop', shop: createShop(1, [], newSeed()) })}
        />
      )

    case 'shop':
      return (
        <ShopScreen
          state={screen.shop}
          onChange={(shop) => setScreen({ kind: 'shop', shop })}
          onFight={() =>
            setScreen({
              kind: 'battle',
              shop: screen.shop,
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
          onBack={() =>
            setScreen({
              kind: 'shop',
              shop: createShop(shop.round + 1, battleTeam(shop), shop.seed),
            })
          }
        />
      )
    }
  }
}
