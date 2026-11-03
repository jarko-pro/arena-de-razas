import { describe, expect, it } from 'vitest'
import { finishRound, newGame, prepareBattle } from '../src/engine/game'
import { buy } from '../src/engine/shop'
import { RACES } from '../src/engine/units'
import { SAVE_VERSION, parseSave, serializeSave } from '../src/ui/savedGame'

describe('partida guardada', () => {
  it('se recupera igual tras guardarla en texto', () => {
    const start = newGame('guardado', RACES)
    const bought = buy(start.shop, 0)
    if (!bought.ok) throw new Error('No se ha podido comprar')
    const game = finishRound({ ...start, shop: bought.state }, 'victoryA')

    const loaded = parseSave(serializeSave({ screen: 'shop', game }))
    expect(loaded).toEqual({ screen: 'shop', game })
  })

  it('al continuar en el combate se repite el mismo combate', () => {
    const game = newGame('combate-guardado', RACES)
    const loaded = parseSave(serializeSave({ screen: 'battle', game }))
    if (!loaded) throw new Error('No se ha cargado el guardado')
    expect(prepareBattle(loaded.game)).toEqual(prepareBattle(game))
  })

  it('ignora guardados vacíos, rotos o de otra versión', () => {
    const game = newGame('roto', RACES)
    const good = JSON.parse(serializeSave({ screen: 'shop', game })) as Record<string, unknown>

    expect(parseSave(null)).toBeNull()
    expect(parseSave('{no es json')).toBeNull()
    expect(parseSave(JSON.stringify({ ...good, version: SAVE_VERSION + 1 }))).toBeNull()
    expect(parseSave(JSON.stringify({ ...good, screen: 'end' }))).toBeNull()
    expect(parseSave(JSON.stringify({ ...good, game: { ...game, shop: null } }))).toBeNull()
  })

  it('no recupera una partida ya terminada', () => {
    const game = { ...newGame('terminada', RACES), status: 'lost' as const }
    expect(parseSave(serializeSave({ screen: 'shop', game }))).toBeNull()
  })
})
