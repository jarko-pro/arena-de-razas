# Hitos – versión 1

Trabajar un hito cada vez, en orden. Un hito está terminado cuando se cumplen todos sus criterios, pasan `pnpm test` y `pnpm lint`, y se ha hecho commit.

Estimación con Claude Code: 20‑32 h en total.

---

## Hito 1 – Base del proyecto (≈1 h)

**Tareas**
- Crear proyecto con Vite + React + TypeScript estricto, usando pnpm.
- Añadir Vitest, ESLint y GSAP.
- Crear la estructura de carpetas de `CLAUDE.md` con archivos vacíos o mínimos.
- Pantalla inicial con el título "Arena de Razas" y un botón "Jugar" sin funcionalidad.
- Inicializar git.

**Terminado cuando**
- `pnpm dev` muestra la pantalla inicial.
- `pnpm test` ejecuta una prueba de ejemplo.
- `pnpm build` genera la web sin errores.

---

## Hito 2 – Motor de combate (≈2‑3 h)

**Tareas**
- `rng.ts`: generador aleatorio con semilla.
- `units.ts`: tipos y definición de las 24 unidades y fichas de `docs/diseno.md`.
- `abilities.ts`: disparadores y efectos genéricos.
- `combat.ts`: `simulateBattle(teamA, teamB, seed)` que devuelve resultado y lista de eventos (`attack`, `damage`, `death`, `ability`, `buff`, `summon`, `move`, `end`...).
- Pantalla de prueba: dos equipos fijos y un botón "Combatir" que reproduce los eventos con animaciones GSAP (embestida, temblor, número flotante, desvanecerse, proyectil). Referencia visual: la demo "Arena de Razas" ya hecha.

**Terminado cuando**
- Hay pruebas para: golpe simultáneo, empate, cada disparador y al menos una habilidad de cada raza.
- La misma semilla y los mismos equipos producen siempre el mismo combate (prueba incluida).
- El combate se ve animado en pantalla y coincide con los eventos.

---

## Hito 3 – Tienda (≈3‑5 h)

**Tareas**
- `shop.ts`: generar tienda según ronda y tier, comprar, vender, reroll, reordenar.
- Interfaz de tienda: unidades de la tienda arriba, equipo abajo, oro visible, botones de reroll y "Combatir".
- Comprar arrastrando o pulsando; vender arrastrando a una zona de venta o con un botón.
- Ver la habilidad de cualquier unidad al pulsarla o pasar el ratón.
- Disparadores "Al comprar" y "Al vender".

**Terminado cuando**
- El oro se descuenta y se devuelve correctamente (con pruebas).
- No se puede comprar sin oro ni con el equipo lleno (salvo apilando encima de una unidad igual).
- Los huecos y tiers de la tienda cambian según la ronda.
- Funciona con ratón y con el dedo en móvil.

---

## Hito 4 – Niveles por apilamiento, congelar y rachas (≈2‑3 h)

**Tareas**
- Apilar copias en el mismo hueco: comprar encima de una unidad igual o juntar dos del equipo del mismo nivel. Nivel 2 con 3 copias y nivel 3 con 9 (3 unidades de nivel 2).
- Estadísticas y `n` según nivel.
- Disparador "Al subir de nivel" en el motor.
- Indicador de nivel y de experiencia (copias) en cada unidad; resaltar dónde se puede apilar al arrastrar.
- Animación al subir de nivel (destello y escala).
- Congelar y descongelar toda la tienda con un botón; con la tienda congelada no hay reroll.
- Oro extra por rachas de victorias o derrotas, con indicador de racha y desglose del oro.

**Terminado cuando**
- Pruebas para: comprar encima con el equipo lleno, 3 copias dan nivel 2 y 9 dan nivel 3, no se pasa de nivel 3 (ni comprando ni juntando), juntar dos unidades libera un hueco, se conservan los bonus permanentes, escalado de fichas invocadas.
- Pruebas para congelar: con la tienda congelada no hay reroll; al cambiar de ronda conserva sus ofertas y rellena los huecos vacíos.
- Pruebas para rachas: tabla de oro extra para rachas de 1 a 6; el empate y el cambio de victoria a derrota reinician la racha.
- Apilar, congelar y la racha se ven y se entienden en pantalla.

---

## Hito 5 – Bucle de partida (≈2‑3 h)

**Tareas**
- `game.ts`: estado de partida con ronda, vidas, victorias y equipo.
- Flujo: inicio → tienda → combate → resultado → tienda… → fin.
- Pantalla de resultado de cada combate y pantalla final de victoria o derrota.
- Indicadores de ronda, vidas y victorias siempre visibles.
- Rival provisional: equipo aleatorio del tier de la ronda.

**Terminado cuando**
- Se puede jugar una partida completa de principio a fin.
- Las vidas y victorias se actualizan bien (con pruebas).
- "Jugar otra vez" reinicia la partida limpiamente.

> **Punto de control**: jugar varias partidas completas. Si no es divertido, ajustar `docs/diseno.md` antes de seguir.

---

## Hito 6 – Rivales generados por bot (≈1‑2 h)

**Tareas**
- `bot.ts`: el bot juega la tienda con las mismas reglas según `docs/diseno.md`, incluidos apilar, congelar y oro por rachas.
- El rival de cada ronda es el equipo del bot en esa ronda.
- Mostrar en la pantalla de combate el nombre del rival y su raza preferida.

**Terminado cuando**
- El bot nunca hace jugadas ilegales (con pruebas).
- Los rivales se sienten de un nivel parecido al del jugador en la misma ronda.

---

## Hito 7 – Contenido y equilibrio (≈5‑8 h)

**Tareas**
- Revisar que las 24 unidades funcionan como dice `docs/diseno.md`.
- Script de simulación: miles de combates entre bots para detectar unidades o razas demasiado fuertes o débiles.
- Ajustar valores en `docs/diseno.md` y en `units.ts` a la vez.
- Iconos o arte provisional coherente para cada unidad.

**Terminado cuando**
- Ninguna raza gana más del 60 % de las partidas simuladas entre bots.
- Cada unidad aparece en equipos ganadores en algún momento.

---

## Hito 8 – Pulido (≈5‑8 h)

**Tareas**
- Animaciones de tienda: comprar, vender, reroll, recibir oro.
- Sonidos básicos (golpe, muerte, compra, fusión, victoria) con botón para silenciar.
- Control de velocidad del combate (x1, x2) y botón para saltar.
- Diseño adaptado a móvil en vertical.
- Guardar la partida en curso en el navegador para continuar después.
- Publicar la web (Netlify, Vercel o GitHub Pages).

**Terminado cuando**
- Se juega cómodo en un móvil de 375 px de ancho.
- Se puede cerrar la pestaña y continuar la partida.
- La web está publicada con una URL para compartir.
