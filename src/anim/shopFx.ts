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
 * salto con un destello dorado; si no, un pequeño rebote.
 */
export function playStack(
  root: ParentNode,
  shots: readonly CardShot[],
  targetId: number,
  levelUp: boolean,
): void {
  const target = root.querySelector<HTMLElement>(unitSelector(targetId))
  if (!target) return
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
}
