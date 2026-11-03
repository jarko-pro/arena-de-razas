// Animaciones de la tienda. Solo reproducen lo que el motor ya ha decidido.

import gsap from 'gsap'

/** Foto de una carta justo antes de desaparecer: su aspecto y dónde estaba. */
export interface CardShot {
  readonly clone: HTMLElement
  readonly rect: DOMRect
}

const unitSelector = (id: number): string => `[data-unit-id="${id}"]`

/** Fotografía las cartas que van a desaparecer, antes de que React las quite. */
export function captureCards(root: ParentNode, ids: readonly number[]): CardShot[] {
  const shots: CardShot[] = []
  for (const id of ids) {
    const element = root.querySelector<HTMLElement>(unitSelector(id))
    if (!element) continue
    shots.push({ clone: element.cloneNode(true) as HTMLElement, rect: element.getBoundingClientRect() })
  }
  return shots
}

/**
 * La copia apilada vuela hasta su unidad. Si sube de nivel, la unidad da un
 * salto con un destello dorado; si no, un pequeño rebote. Devuelve una
 * función que corta la animación y quita las copias (al salir de la tienda).
 */
export function playStack(
  root: ParentNode,
  shots: readonly CardShot[],
  targetId: number,
  levelUp: boolean,
): () => void {
  const target = root.querySelector<HTMLElement>(unitSelector(targetId))
  if (!target) return () => {}
  const to = target.getBoundingClientRect()
  const timeline = gsap.timeline()

  for (const { clone, rect } of shots) {
    clone.classList.add('copia-fusion')
    Object.assign(clone.style, {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
    })
    document.body.appendChild(clone)
    timeline.to(
      clone,
      {
        x: to.left + to.width / 2 - (rect.left + rect.width / 2),
        y: to.top + to.height / 2 - (rect.top + rect.height / 2),
        scale: 0.55,
        opacity: 0.2,
        duration: 0.45,
        ease: 'power2.in',
        onComplete: () => clone.remove(),
      },
      0,
    )
  }

  const start = shots.length > 0 ? 0.4 : 0
  const glow = levelUp ? 'drop-shadow(0 0 16px rgb(255 205 90 / 95%))' : 'drop-shadow(0 0 6px rgb(255 255 255 / 60%))'
  timeline
    .fromTo(
      target,
      { scale: 1, filter: 'drop-shadow(0 0 0 rgb(255 205 90 / 0%))' },
      { scale: levelUp ? 1.3 : 1.1, filter: glow, duration: 0.18, ease: 'power2.out' },
      start,
    )
    .to(target, {
      scale: 1,
      filter: 'drop-shadow(0 0 0 rgb(255 205 90 / 0%))',
      duration: levelUp ? 0.55 : 0.3,
      ease: levelUp ? 'elastic.out(1, 0.5)' : 'power2.out',
      clearProps: 'filter,transform',
    })

  return () => {
    timeline.kill()
    for (const { clone } of shots) clone.remove()
  }
}

/** Coloca la copia de una carta encima de la página, donde estaba la original. */
function floatClone({ clone, rect }: CardShot): HTMLElement {
  clone.classList.add('copia-fusion')
  clone.classList.remove('arrastrando', 'sel')
  Object.assign(clone.style, {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
  })
  document.body.appendChild(clone)
  return clone
}

/**
 * La unidad comprada llega a su hueco del equipo. Con `from` vuela desde la
 * oferta; sin él (se soltó arrastrando, ya está donde toca) solo rebota.
 */
export function playArrive(root: ParentNode, targetId: number, from?: DOMRect): () => void {
  const target = root.querySelector<HTMLElement>(unitSelector(targetId))
  if (!target) return () => {}
  const to = target.getBoundingClientRect()
  const tween = from
    ? gsap.from(target, {
        x: from.left - to.left,
        y: from.top - to.top,
        scale: from.width / to.width,
        duration: 0.42,
        ease: 'power3.out',
        clearProps: 'transform',
      })
    : gsap.fromTo(
        target,
        { scale: 0.7 },
        { scale: 1, duration: 0.4, ease: 'back.out(3)', clearProps: 'transform' },
      )
  return () => {
    tween.kill()
    gsap.set(target, { clearProps: 'transform' })
  }
}

/** La unidad vendida se desvanece y sus monedas vuelan hasta el contador de oro. */
export function playSell(shots: readonly CardShot[], goldEl: HTMLElement | null, coins: number): () => void {
  const timeline = gsap.timeline()
  const created: HTMLElement[] = []
  const goal = goldEl?.getBoundingClientRect()

  for (const shot of shots) {
    const clone = floatClone(shot)
    created.push(clone)
    timeline.to(
      clone,
      { y: -30, scale: 0.6, opacity: 0, rotate: -8, duration: 0.4, ease: 'power2.in', onComplete: () => clone.remove() },
      0,
    )
    if (!goal) continue
    const startX = shot.rect.left + shot.rect.width / 2
    const startY = shot.rect.top + shot.rect.height / 2
    for (let i = 0; i < coins; i++) {
      const coin = document.createElement('div')
      coin.className = 'moneda-volando'
      Object.assign(coin.style, { left: `${startX}px`, top: `${startY}px` })
      document.body.appendChild(coin)
      created.push(coin)
      timeline.to(
        coin,
        {
          keyframes: [
            { x: (i - (coins - 1) / 2) * 18, y: -40, duration: 0.2, ease: 'power2.out' },
            {
              x: goal.left + goal.width / 2 - startX,
              y: goal.top + goal.height / 2 - startY,
              scale: 0.6,
              duration: 0.45,
              ease: 'power2.in',
            },
          ],
          onComplete: () => coin.remove(),
        },
        0.1 + i * 0.08,
      )
    }
  }

  return () => {
    timeline.kill()
    for (const node of created) node.remove()
  }
}

/** Las ofertas nuevas del reroll entran girando, una detrás de otra. */
export function playReroll(root: ParentNode, ids: readonly number[]): () => void {
  const cards = ids
    .map((id) => root.querySelector<HTMLElement>(unitSelector(id)))
    .filter((card): card is HTMLElement => card !== null)
  const tween = gsap.fromTo(
    cards,
    { rotateY: 90, y: -12, opacity: 0, transformPerspective: 400 },
    {
      rotateY: 0,
      y: 0,
      opacity: 1,
      duration: 0.32,
      ease: 'back.out(1.6)',
      stagger: 0.06,
      clearProps: 'transform,opacity',
    },
  )
  return () => {
    tween.kill()
    gsap.set(cards, { clearProps: 'transform,opacity' })
  }
}

/** El contador de oro cuenta hasta el valor nuevo y da un pulso: verde si sube, rojo si baja. */
export function playGold(el: HTMLElement, value: HTMLElement, from: number, to: number): () => void {
  const counter = { n: from }
  const color = to > from ? '#7fd36b' : '#ff8f7a'
  const timeline = gsap
    .timeline()
    .to(counter, {
      n: to,
      duration: Math.min(0.6, 0.12 * Math.abs(to - from) + 0.15),
      ease: 'power1.out',
      onUpdate: () => {
        value.textContent = String(Math.round(counter.n))
      },
    })
    .fromTo(
      el,
      { scale: 1, color },
      { scale: 1.25, duration: 0.12, yoyo: true, repeat: 1, ease: 'power2.out', clearProps: 'transform,color' },
      0,
    )
  return () => {
    timeline.kill()
    value.textContent = String(to)
    gsap.set(el, { clearProps: 'transform,color' })
  }
}
