// Sonidos sintetizados con Web Audio: sin archivos de audio. La UI los pide
// cuando reproduce algo que el motor ya ha decidido.

import { useSyncExternalStore } from 'react'
import { readStorage, writeStorage } from './storage'

export type SoundName = 'hit' | 'death' | 'buy' | 'sell' | 'reroll' | 'merge' | 'victory'

const MUTED_KEY = 'arena-de-razas:silencio'
const VOLUME = 0.22

let muted = readStorage(MUTED_KEY) === '1'
let context: AudioContext | null = null
const listeners = new Set<() => void>()

export function isMuted(): boolean {
  return muted
}

export function setMuted(value: boolean): void {
  muted = value
  writeStorage(MUTED_KEY, value ? '1' : '0')
  for (const listener of listeners) listener()
}

/** Estado del silencio para React: se actualiza en todos los botones a la vez. */
export function useMuted(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    isMuted,
  )
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null
  context ??= new AudioContext()
  // Los navegadores lo crean suspendido hasta que el jugador pulsa algo.
  if (context.state === 'suspended') void context.resume()
  return context
}

interface Tone {
  readonly freq: number
  /** Frecuencia final, para notas que suben o bajan. */
  readonly to?: number
  readonly at: number
  readonly duration: number
  readonly type?: OscillatorType
  readonly gain?: number
}

function tone(ctx: AudioContext, out: AudioNode, t: Tone): void {
  const start = ctx.currentTime + t.at
  const end = start + t.duration
  const osc = ctx.createOscillator()
  const env = ctx.createGain()
  osc.type = t.type ?? 'triangle'
  osc.frequency.setValueAtTime(t.freq, start)
  if (t.to !== undefined) osc.frequency.exponentialRampToValueAtTime(t.to, end)
  env.gain.setValueAtTime(0.0001, start)
  env.gain.exponentialRampToValueAtTime(t.gain ?? 1, start + 0.01)
  env.gain.exponentialRampToValueAtTime(0.0001, end)
  osc.connect(env).connect(out)
  osc.start(start)
  osc.stop(end + 0.02)
}

/** Ruido corto filtrado: el «chas» de un golpe o un barrido. */
function noise(ctx: AudioContext, out: AudioNode, duration: number, cutoff: number, gain: number): void {
  const length = Math.ceil(ctx.sampleRate * duration)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length)
  const source = ctx.createBufferSource()
  const filter = ctx.createBiquadFilter()
  const env = ctx.createGain()
  source.buffer = buffer
  filter.type = 'lowpass'
  filter.frequency.value = cutoff
  env.gain.value = gain
  source.connect(filter).connect(env).connect(out)
  source.start()
}

const SOUNDS: Record<SoundName, (ctx: AudioContext, out: AudioNode) => void> = {
  hit: (ctx, out) => {
    noise(ctx, out, 0.12, 1800, 0.9)
    tone(ctx, out, { freq: 150, to: 60, at: 0, duration: 0.12, type: 'square', gain: 0.5 })
  },
  death: (ctx, out) => {
    tone(ctx, out, { freq: 330, to: 70, at: 0, duration: 0.45, type: 'sawtooth', gain: 0.45 })
  },
  buy: (ctx, out) => {
    tone(ctx, out, { freq: 880, at: 0, duration: 0.08, type: 'square', gain: 0.35 })
    tone(ctx, out, { freq: 1320, at: 0.07, duration: 0.16, type: 'square', gain: 0.35 })
  },
  sell: (ctx, out) => {
    tone(ctx, out, { freq: 1320, at: 0, duration: 0.07, type: 'square', gain: 0.3 })
    tone(ctx, out, { freq: 990, at: 0.06, duration: 0.07, type: 'square', gain: 0.3 })
    tone(ctx, out, { freq: 1480, at: 0.12, duration: 0.14, type: 'square', gain: 0.3 })
  },
  reroll: (ctx, out) => {
    noise(ctx, out, 0.22, 3500, 0.5)
    tone(ctx, out, { freq: 300, to: 900, at: 0, duration: 0.2, gain: 0.4 })
  },
  merge: (ctx, out) => {
    ;[523, 659, 784, 1047].forEach((freq, i) => {
      tone(ctx, out, { freq, at: i * 0.07, duration: 0.18, gain: 0.6 })
    })
  },
  victory: (ctx, out) => {
    ;[523, 659, 784].forEach((freq, i) => {
      tone(ctx, out, { freq, at: i * 0.13, duration: 0.14, type: 'square', gain: 0.35 })
    })
    tone(ctx, out, { freq: 1047, at: 0.39, duration: 0.6, type: 'square', gain: 0.35 })
    tone(ctx, out, { freq: 523, at: 0.39, duration: 0.6, gain: 0.5 })
  },
}

export function playSound(name: SoundName): void {
  if (muted) return
  const ctx = audio()
  if (!ctx) return
  const master = ctx.createGain()
  master.gain.value = VOLUME
  master.connect(ctx.destination)
  SOUNDS[name](ctx, master)
}
