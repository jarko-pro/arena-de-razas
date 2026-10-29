# Arena de Razas

Autobattler web de fantasía (estilo Super Auto Pets) con razas: orcos, humanos, hombres lagarto y no muertos. El jugador compra unidades en una tienda entre rondas y su equipo combate automáticamente.

- Diseño del juego (fuente de verdad): `docs/diseno.md`
- Plan de trabajo por hitos: `docs/hitos.md`

Si una regla de `docs/diseno.md` no está clara o choca con otra, **pregunta antes de inventar**. Si se cambia una regla, actualiza primero `docs/diseno.md`.

## Stack

- **TypeScript** estricto (`strict: true`), sin `any`.
- **Vite** como bundler y servidor de desarrollo.
- **React** para la interfaz (tienda, menús, pantallas).
- **GSAP** para animaciones de combate y tienda (tweens sobre elementos DOM).
- **Vitest** para pruebas del motor.
- **pnpm** como gestor de paquetes.
- Futuro (no en la versión 1): Supabase para el online asíncrono y Capacitor para Android/iOS. No añadir dependencias de esto todavía.

## Arquitectura

```
src/
  engine/        Lógica pura del juego. Sin DOM, sin React, sin GSAP.
    rng.ts       Generador aleatorio con semilla
    units.ts     Definiciones de unidades como datos
    abilities.ts Ejecución de habilidades (disparador + efecto)
    combat.ts    Simula un combate completo y devuelve una lista de eventos
    shop.ts      Tienda: oro, compra, venta, reroll, fusiones
    game.ts      Estado de la partida: rondas, vidas, victorias
    bot.ts       Genera equipos rivales usando las mismas reglas de tienda
  ui/            Componentes React
  anim/          Reproduce los eventos de combate con animaciones GSAP
  assets/
tests/           Pruebas Vitest del motor
docs/
```

## Reglas de arquitectura (importantes)

1. **El motor es puro y determinista.** `engine/` no importa nada de `ui/` ni `anim/`. Toda la aleatoriedad pasa por `rng.ts` con semilla: misma semilla y mismos equipos = mismo combate. Esto es imprescindible para el online futuro.
2. **El combate se simula entero de golpe.** `simulateBattle(equipoA, equipoB, seed)` devuelve `{ resultado, eventos: BattleEvent[] }`. La UI solo reproduce esos eventos. La UI nunca calcula daño ni decide nada.
3. **Las unidades y habilidades son datos.** Una unidad nueva se añade en `units.ts` combinando disparadores y efectos existentes. Si hace falta un efecto nuevo, se añade de forma genérica en `abilities.ts`, nunca con un `if (unidad.id === ...)`.
4. **El estado no se muta desde la UI.** La UI llama a funciones del motor (`comprar`, `vender`, `reroll`, `mover`...) que devuelven el nuevo estado.
5. Textos visibles en **español de España**. Código (variables, funciones, tipos) en inglés.

## Convenciones

- Componentes React funcionales con hooks.
- Nombres de archivo en `camelCase.ts` / `PascalCase.tsx` para componentes.
- Funciones del motor pequeñas y con pruebas.
- Sin estado global mágico: un único estado de partida pasado de forma explícita.

## Comandos

```
pnpm dev        # servidor de desarrollo
pnpm test       # pruebas
pnpm build      # build de producción
pnpm lint       # lint y comprobación de tipos
```

## Forma de trabajar

- Trabajamos **un hito cada vez** según `docs/hitos.md`. No adelantes trabajo de hitos posteriores.
- Antes de programar un hito, propón un plan breve y espera confirmación.
- Al terminar: pasan `pnpm test` y `pnpm lint`, se cumplen los criterios de "terminado" del hito y se hace un commit con un mensaje claro.
- Toda la lógica nueva del motor lleva pruebas.
- Si algo del diseño resulta poco divertido o roto al implementarlo, avísalo en vez de cambiarlo por tu cuenta.
