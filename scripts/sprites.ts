// Corta una hoja de sprites con fondo blanco en un archivo por personaje.
//
//   node scripts/sprites.ts <hoja.png> <carpeta-salida> <prefijo> [nombre...] [--height=N]
//
// Si se dan nombres (los id de las unidades, de izquierda a derecha), cada
// archivo se llama <nombre>.webp; si no, <prefijo>_01.webp, <prefijo>_02.webp...
//
// Con --height=N el personaje más alto mide N píxeles en el lienzo en vez de
// llenarlo. Sirve para que un sprite suelto encaje con los de su hoja.
//
// 1. Quita el fondo: relleno desde los bordes sobre los píxeles casi blancos
//    (así no se borran los blancos de dentro, como dientes o calaveras) y
//    "desmezcla" el blanco del contorno para que no quede halo.
// 2. Separa a los personajes por manchas conectadas; las manchas pequeñas
//    (llamas, jirones) se unen al personaje más cercano.
// 3. Los escala a todos con el MISMO factor (se conservan las alturas
//    relativas de la hoja) y los coloca en un lienzo cuadrado, pies abajo.
// 4. Genera una hoja de control sobre fondo oscuro para revisarlos.

import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'

const SIZE = 256
const MARGIN = 10
/** Mínimo valor de canal para considerar un píxel "blanco de fondo". */
const WHITE = 236
/** Un hueco blanco cerrado con al menos esta área se trata como fondo. */
const HOLE = 60
/** Saturación media del borde a partir de la cual un hueco blanco es un brillo. */
const GLOW = 25
/** Diferencia máxima entre canales (de media) para que un hueco sea blanco neutro. */
const NEUTRAL = 3
/** Anchura del contorno en el que se quita el halo blanco. */
const EDGE = 2
/** Una mancha con menos área que esta fracción de la mayor no es un personaje. */
const MIN_CHARACTER = 0.05
/** Manchas más pequeñas que esto son ruido y se descartan. */
const NOISE = 12

interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}

interface Blob {
  area: number
  box: Box
  pixels: number[]
}

const args = process.argv.slice(2)
const heightArg = args.find((a) => a.startsWith('--height='))
const targetHeight = heightArg ? Number(heightArg.slice('--height='.length)) : undefined
const [input, outDir, prefix, ...names] = args.filter((a) => !a.startsWith('--'))
if (!input || !outDir || !prefix || (targetHeight !== undefined && !(targetHeight > 0))) {
  console.error(
    'Uso: node scripts/sprites.ts <hoja.png> <carpeta-salida> <prefijo> [nombre...] [--height=N]',
  )
  process.exit(1)
}

const { data: rgb, info } = await sharp(input)
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })
const { width: W, height: H } = info
const N = W * H

const isWhite = (p: number): boolean =>
  rgb[p * 3]! >= WHITE && rgb[p * 3 + 1]! >= WHITE && rgb[p * 3 + 2]! >= WHITE

// 1. Fondo: relleno desde los bordes.
const background = new Uint8Array(N)
const stack: number[] = []
for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x)
for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1)
while (stack.length > 0) {
  const p = stack.pop()!
  if (background[p] || !isWhite(p)) continue
  background[p] = 1
  const x = p % W
  if (x > 0) stack.push(p - 1)
  if (x < W - 1) stack.push(p + 1)
  if (p >= W) stack.push(p - W)
  if (p < N - W) stack.push(p + W)
}

// Huecos cerrados (entre piernas, bastón y túnica...): zonas blancas que el
// relleno no alcanza. Un hueco está rodeado de contorno gris; un brillo (orbe,
// llama) está rodeado de color. Un hueco es blanco neutro como el fondo; la
// tela blanca suele tener un tono (crema, azulado). Las zonas pequeñas se
// respetan: dientes, ojos.
const saturation = (p: number): number =>
  Math.max(rgb[p * 3]!, rgb[p * 3 + 1]!, rgb[p * 3 + 2]!) -
  Math.min(rgb[p * 3]!, rgb[p * 3 + 1]!, rgb[p * 3 + 2]!)
const seen = new Uint8Array(N)
for (let start = 0; start < N; start++) {
  if (background[start] || seen[start] || !isWhite(start)) continue
  const region: number[] = []
  const border = new Set<number>()
  seen[start] = 1
  stack.push(start)
  while (stack.length > 0) {
    const p = stack.pop()!
    region.push(p)
    const x = p % W
    for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W]) {
      if (q < 0 || q >= N || seen[q] || background[q]) continue
      if (!isWhite(q)) {
        border.add(q)
        continue
      }
      seen[q] = 1
      stack.push(q)
    }
  }
  let borderSaturation = 0
  for (const q of border) borderSaturation += saturation(q)
  borderSaturation /= Math.max(1, border.size)
  const mean = [0, 1, 2].map((ch) => region.reduce((sum, p) => sum + rgb[p * 3 + ch]!, 0) / region.length)
  const tint = Math.max(...mean) - Math.min(...mean)
  if (region.length >= HOLE && borderSaturation < GLOW && tint <= NEUTRAL) {
    for (const p of region) background[p] = 1
  }
}

// Distancia (en píxeles, 4-vecinos) al fondo, solo hasta EDGE.
const edgeDist = new Uint8Array(N)
let frontier: number[] = []
for (let p = 0; p < N; p++) if (background[p]) frontier.push(p)
for (let d = 1; d <= EDGE; d++) {
  const next: number[] = []
  for (const p of frontier) {
    const x = p % W
    for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W]) {
      if (q < 0 || q >= N || background[q] || edgeDist[q]) continue
      edgeDist[q] = d
      next.push(q)
    }
  }
  frontier = next
}

const rgba = Buffer.alloc(N * 4)
for (let p = 0; p < N; p++) {
  if (background[p]) continue
  let r = rgb[p * 3]!
  let g = rgb[p * 3 + 1]!
  let b = rgb[p * 3 + 2]!
  let a = 255
  if (edgeDist[p]) {
    // Color-a-alfa respecto al blanco: el píxel es una mezcla de color y fondo.
    const alpha = Math.max(255 - r, 255 - g, 255 - b) / 255
    if (alpha > 0) {
      r = Math.round(255 - (255 - r) / alpha)
      g = Math.round(255 - (255 - g) / alpha)
      b = Math.round(255 - (255 - b) / alpha)
    }
    a = Math.round(alpha * 255)
  }
  rgba[p * 4] = r
  rgba[p * 4 + 1] = g
  rgba[p * 4 + 2] = b
  rgba[p * 4 + 3] = a
}

// 2. Manchas conectadas (8-vecinos) de píxeles que no son fondo.
const label = new Int32Array(N).fill(-1)
const blobs: Blob[] = []
for (let start = 0; start < N; start++) {
  if (background[start] || label[start] !== -1) continue
  const blob: Blob = { area: 0, box: { x0: W, y0: H, x1: 0, y1: 0 }, pixels: [] }
  label[start] = blobs.length
  stack.push(start)
  while (stack.length > 0) {
    const p = stack.pop()!
    const x = p % W
    const y = (p - x) / W
    blob.area++
    blob.pixels.push(p)
    blob.box.x0 = Math.min(blob.box.x0, x)
    blob.box.y0 = Math.min(blob.box.y0, y)
    blob.box.x1 = Math.max(blob.box.x1, x)
    blob.box.y1 = Math.max(blob.box.y1, y)
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
        const q = ny * W + nx
        if (background[q] || label[q] !== -1) continue
        label[q] = blobs.length
        stack.push(q)
      }
    }
  }
  blobs.push(blob)
}

const largest = Math.max(...blobs.map((b) => b.area))
const characters = blobs.filter((b) => b.area >= largest * MIN_CHARACTER)

// Cada píxel de la imagen queda asignado al personaje cuyo píxel tiene más cerca.
const nearest = new Int32Array(N).fill(-1)
let wave: number[] = []
for (const [i, c] of characters.entries()) {
  for (const p of c.pixels) {
    nearest[p] = i
    wave.push(p)
  }
}
while (wave.length > 0) {
  const next: number[] = []
  for (const p of wave) {
    const x = p % W
    for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W]) {
      if (q < 0 || q >= N || nearest[q] !== -1) continue
      nearest[q] = nearest[p]!
      next.push(q)
    }
  }
  wave = next
}

for (const blob of blobs) {
  if (characters.includes(blob)) continue
  if (blob.area < NOISE) {
    for (const p of blob.pixels) rgba[p * 4 + 3] = 0
    continue
  }
  const owner = characters[nearest[blob.pixels[0]!]!]!
  owner.box = {
    x0: Math.min(owner.box.x0, blob.box.x0),
    y0: Math.min(owner.box.y0, blob.box.y0),
    x1: Math.max(owner.box.x1, blob.box.x1),
    y1: Math.max(owner.box.y1, blob.box.y1),
  }
  owner.pixels.push(...blob.pixels)
}
characters.sort((a, b) => a.box.x0 - b.box.x0)
if (names.length > 0 && names.length !== characters.length) {
  console.error(`Se han dado ${names.length} nombres pero hay ${characters.length} personajes.`)
  process.exit(1)
}

// 3. Un único factor de escala para todos, según el más grande.
const inner = SIZE - MARGIN * 2
const fit = Math.min(
  ...characters.map((c) =>
    Math.min(inner / (c.box.x1 - c.box.x0 + 1), inner / (c.box.y1 - c.box.y0 + 1)),
  ),
)
const tallest = Math.max(...characters.map((c) => c.box.y1 - c.box.y0 + 1))
const scale = targetHeight === undefined ? fit : Math.min(fit, targetHeight / tallest)

mkdirSync(outDir, { recursive: true })
const tiles: Buffer[] = []
for (const [i, c] of characters.entries()) {
  const w = c.box.x1 - c.box.x0 + 1
  const h = c.box.y1 - c.box.y0 + 1
  // Solo los píxeles de este personaje: si otro se mete en su caja, no sale.
  const own = Buffer.alloc(w * h * 4)
  for (const p of c.pixels) {
    const x = (p % W) - c.box.x0
    const y = Math.floor(p / W) - c.box.y0
    rgba.copy(own, (y * w + x) * 4, p * 4, p * 4 + 4)
  }
  const sw = Math.max(1, Math.round(w * scale))
  const sh = Math.max(1, Math.round(h * scale))
  const scaled = await sharp(own, { raw: { width: w, height: h, channels: 4 } })
    .resize(sw, sh, { kernel: 'lanczos3' })
    .png()
    .toBuffer()
  const tile = await sharp({
    create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: scaled, left: Math.round((SIZE - sw) / 2), top: SIZE - MARGIN - sh }])
    .png()
    .toBuffer()
  const name = `${names[i] ?? `${prefix}_${String(i + 1).padStart(2, '0')}`}.webp`
  await sharp(tile).webp({ quality: 90, alphaQuality: 100 }).toFile(join(outDir, name))
  tiles.push(tile)
  console.log(`${name}  (original ${w}×${h}, final ${sw}×${sh})`)
}

// 4. Hoja de control.
const sheet = join(outDir, `${prefix}_control.png`)
await sharp({
  create: {
    width: SIZE * tiles.length,
    height: SIZE,
    channels: 4,
    background: { r: 42, g: 30, b: 22, alpha: 1 },
  },
})
  .composite(tiles.map((input, i) => ({ input, left: i * SIZE, top: 0 })))
  .png()
  .toFile(sheet)
console.log(`Hoja de control: ${sheet}`)
