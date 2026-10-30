# Diseño – Arena de Razas (versión 1)

Título provisional. Este documento es la fuente de verdad de las reglas. Los valores numéricos son iniciales y se ajustarán con playtesting.

## Resumen

Partida individual contra rivales. Cada ronda tiene dos fases:

1. **Tienda**: el jugador gasta oro en comprar, vender, reordenar y apilar unidades.
2. **Combate**: su equipo lucha automáticamente contra un equipo rival.

Se gana la partida al conseguir **10 victorias**. Se pierde al quedarse **sin vidas**.

## Partida

| Parámetro | Valor |
| --- | --- |
| Vidas iniciales | 5 |
| Vidas perdidas por derrota | 1 |
| Victorias para ganar la partida | 10 |
| Empate | No suma victoria ni quita vida |
| Tamaño máximo del equipo | 5 unidades |

## Tienda

| Parámetro | Valor |
| --- | --- |
| Oro por ronda | 10 base + oro extra por racha (no se acumula entre rondas) |
| Coste de una unidad | 3 |
| Coste de reroll | 1 |
| Venta | Devuelve 1 de oro por nivel de la unidad |
| Huecos de la tienda | 3 (rondas 1‑2), 4 (rondas 3‑4), 5 (ronda 5 en adelante) |

**Niveles de tienda (tiers)**: la tienda solo ofrece unidades del tier desbloqueado o inferior.

| Tier | Disponible desde |
| --- | --- |
| 1 | Ronda 1 |
| 2 | Ronda 3 |
| 3 | Ronda 5 |

**Acciones en la tienda**:
- Comprar una unidad de la tienda: en un hueco libre del equipo, o encima de una unidad igual para apilarla (esto último aunque el equipo esté lleno).
- Vender una unidad del equipo.
- Reroll: sustituir todas las unidades de la tienda. No se puede con la tienda congelada.
- Congelar o descongelar la tienda (gratis).
- Reordenar el equipo arrastrando unidades, o juntar dos unidades iguales.
- Terminar la tienda y pasar al combate.

**Congelar**:
- Un único botón congela o descongela **toda la tienda**, gratis.
- Con la tienda congelada **no se puede hacer reroll**; hay que descongelarla antes.
- Al empezar la ronda siguiente, una tienda congelada **conserva sus unidades** en su hueco y sigue congelada hasta que el jugador la descongele.
- Si en la ronda siguiente la tienda tiene más huecos, o hay huecos vacíos porque se compró su unidad, se rellenan normalmente.
- Comprar con la tienda congelada está permitido; el hueco queda vacío hasta la ronda siguiente.
- Una unidad congelada se conserva aunque su tier sea superior al de la ronda.

**Oro extra por rachas**:
- Se lleva la cuenta de la **racha actual**: victorias seguidas o derrotas seguidas.
- Al empezar cada tienda se suma un oro extra según la racha con la que se llega:

| Racha (victorias o derrotas seguidas) | Oro extra |
| --- | --- |
| 0‑1 | 0 |
| 2 | +1 |
| 3‑4 | +2 |
| 5 o más | +3 |

- Las rachas de victorias y de derrotas dan el mismo oro.
- Un empate rompe la racha (vuelve a 0). Una victoria rompe la racha de derrotas y viceversa.
- La primera ronda no tiene racha.

## Niveles por apilamiento

- Las copias de una misma unidad **se apilan en un único hueco**, sumando experiencia.
- Cada unidad empieza en nivel 1 con 1 copia.
- **Nivel 2** al llegar a **3 copias** en total; **nivel 3** al llegar a **9 copias** en total (lo mismo que 3 unidades de nivel 2). El nivel 3 es el máximo: no se pueden apilar más copias.
- **Comprar encima**: soltar una unidad de la tienda sobre una unidad igual del equipo suma 1 copia. Está permitido aunque el equipo tenga los 5 huecos llenos.
- **Comprar en hueco libre**: la unidad ocupa ese hueco como unidad independiente.
- **Juntar dos del equipo**: arrastrar una unidad del equipo sobre otra igual suma sus copias en el hueco de destino y libera el otro. Solo se pueden juntar unidades **del mismo nivel** (una de nivel 1 no se junta con una de nivel 2; para subir una de nivel 2 se compran copias encima). Si la suma pasa de 9 copias, la acción no se permite.
- Los cambios permanentes se **conservan** al apilar. Si se juntan dos unidades del equipo, se queda el mayor de los dos bonus de ATK y el mayor de los dos bonus de PV.
- Los puntos de experiencia muestran las copias que faltan para el siguiente nivel: 2 en nivel 1 (○○) y 6 en nivel 2 (○○○○○○). Al subir de nivel empiezan vacíos.
- Al comprar apilando, primero se apila; si sube de nivel se dispara "Al subir de nivel" y después "Al comprar", con el valor del nivel resultante.

| Nivel | Estadísticas | Valor de la habilidad (`n`) |
| --- | --- | --- |
| 1 | Base | `n` |
| 2 | Base +2/+2 | `n × 2` |
| 3 | Base +4/+4 | `n × 3` |

Las unidades invocadas (fichas) también escalan: un Esqueleto de nivel 2 invoca Huesos 2/2.

## Combate

- Los equipos se colocan en una fila. La unidad en la posición 1 es la de delante.
- Cada ronda de combate, **las dos unidades de delante se golpean a la vez**: cada una resta su ATK a la vida (PV) del rival.
- Una unidad con PV ≤ 0 muere y se retira. Las de detrás avanzan.
- El combate termina cuando un equipo se queda sin unidades. Si ambos se quedan sin unidades a la vez, es empate.
- Límite de seguridad: 100 golpes; si se alcanza, es empate.
- Los cambios de estadísticas durante el combate **no** se guardan después del combate (salvo que una habilidad diga lo contrario).

**Orden de resolución en cada golpe**:
1. Golpe simultáneo de las dos unidades de delante.
2. Habilidades "Al golpear".
3. Habilidades "Al recibir daño" (solo si la unidad sigue viva).
4. Muertes: se retiran las unidades muertas y se resuelven sus habilidades "Al morir", "Cuando muere un aliado", etc.
5. Repetir los pasos 3‑4 mientras haya nuevos daños o muertes.

**Orden entre habilidades simultáneas**: primero el equipo del jugador, luego el rival; dentro de cada equipo, de delante hacia atrás.

## Disparadores

| Disparador | Cuándo |
| --- | --- |
| Inicio del combate | Antes del primer golpe |
| Al golpear | Tras golpear a una unidad rival |
| Al recibir daño | Tras recibir daño y seguir viva |
| Al matar | Cuando el golpe de esta unidad mata a su rival |
| Al morir | Cuando muere |
| Cuando muere un aliado | Cuando muere otra unidad de su equipo |
| Cuando muere cualquier unidad | Cuando muere cualquier otra unidad |
| Al comprar | Al comprarla en la tienda (también apilando) |
| Al vender | Al venderla en la tienda |
| Al subir de nivel | Cuando sube de nivel al apilar copias (de momento ninguna unidad lo usa) |

## Unidades

`n` es el valor que escala con el nivel. Formato de estadísticas: ATK/PV.

### Orcos – agresivos, crecen al pelear

| Unidad | Tier | ATK/PV | Habilidad |
| --- | --- | --- | --- |
| Grunt | 1 | 3/2 | Sin habilidad |
| Lobo de guerra | 1 | 2/2 | Al morir: +n ATK a todos los orcos aliados (n=1) |
| Berserker | 2 | 2/4 | Al recibir daño: +n ATK (n=2) |
| Chamán | 2 | 2/3 | Al morir: +n/+n al aliado de detrás (n=2) |
| Saqueador | 3 | 3/3 | Al matar: +n/+n (n=2) |
| Ogro aplastador | 3 | 5/5 | Al golpear: n de daño a la unidad rival de detrás de su objetivo (n=2) |

### Humanos – resistentes y de apoyo

| Unidad | Tier | ATK/PV | Habilidad |
| --- | --- | --- | --- |
| Recluta | 1 | 1/3 | Al comprar: +n PV permanente a un aliado al azar (n=1) |
| Arquero | 1 | 1/2 | Inicio del combate: n de daño a un enemigo al azar (n=2) |
| Escudero | 2 | 2/5 | Sin habilidad |
| Clérigo | 2 | 1/3 | Inicio del combate: +n PV al aliado de delante (n=3) |
| Caballero | 3 | 3/6 | Inicio del combate: +n ATK a los demás humanos aliados (n=1) |
| Paladín | 3 | 4/5 | Al morir: +n PV a todos los aliados (n=2) |

### Hombres lagarto – debilitan y golpean primero

| Unidad | Tier | ATK/PV | Habilidad |
| --- | --- | --- | --- |
| Escupidor | 1 | 1/2 | Inicio del combate: n de daño a todos los enemigos (n=1) |
| Cría de lagarto | 1 | 2/2 | Al vender: +n/+n permanente a un lagarto aliado al azar (n=1) |
| Basilisco | 2 | 2/4 | Al golpear: su objetivo pierde n ATK (n=1) |
| Camaleón | 2 | 3/2 | Inicio del combate: su ATK pasa a ser el del enemigo de delante si es mayor, +n (n=0, 1, 2 según nivel) |
| Saurio | 3 | 5/4 | Al matar: recupera todos sus PV |
| Hidra | 3 | 3/5 | Al morir: invoca 2 Cabezas de hidra de n/n (n=2) |

### No muertos – muerte y resurrección

| Unidad | Tier | ATK/PV | Habilidad |
| --- | --- | --- | --- |
| Esqueleto | 1 | 1/1 | Al morir: invoca unos Huesos de n/n (n=1) |
| Zombi | 1 | 1/5 | Sin habilidad |
| Nigromante | 2 | 1/3 | Cuando muere un aliado: +n/+n (n=1) |
| Necrófago | 2 | 2/3 | Cuando muere cualquier unidad: +n ATK (n=1) |
| Espectro | 3 | 3/3 | Al morir por primera vez en el combate: vuelve con n PV (n=1) |
| Liche | 3 | 3/4 | Inicio del combate: invoca n Esqueletos 1/1 detrás de él (n=1) |

**Invocaciones**: aparecen en la posición de la unidad que las invoca (o detrás, si se indica). Si el equipo ya tiene 5 unidades, la invocación no ocurre. Las fichas invocadas no se pueden comprar ni pasan a la tienda.

## Rivales (versión 1)

- Los rivales los genera un **bot** que juega la tienda con las mismas reglas, el mismo oro y las mismas rondas que el jugador.
- Estrategia del bot: elige una raza preferida al azar, prioriza comprar unidades de esa raza y apilar copias, y hace reroll si no encuentra nada útil.
- El bot usa las mismas reglas que el jugador: apilar, congelar y oro por rachas.
- El equipo rival de la ronda N es el que tendría un bot en la ronda N.

## Ideas de recompensa (pendiente de probar, no implementar todavía)

Revisar tras el punto de control del hito 5, si las rondas se sienten vacías.

**Dentro de la partida**
- ~~Racha~~: ya implementada con su propia tabla (ver «Oro extra por rachas»).
- Consuelo: +1 de oro en la tienda siguiente tras perder.
- Elegir premio tras ganar: una opción entre 2‑3 (unidad gratis, +1/+1 permanente a una unidad, 2 de oro).

**Entre partidas (versión 3 en adelante, con online)**
- Rango o liga que sube al ganar partidas.
- Desbloquear razas, unidades o comandantes jugando.
- Resumen de los combates que ganó tu equipo guardado mientras no estabas.
- Reto diario y aspectos cosméticos.

## Selección de razas del jugador (versión 3 o posterior, no implementar todavía)

**Idea**: el juego tendrá 9‑10 razas. Cada jugador configura en su perfil las **5 razas** con las que juega. Su tienda solo ofrece unidades de esas razas.

**Reglas previstas**
- Set inicial de 5 razas gratis, completo y competitivo para jugadores nuevos.
- El resto de razas se desbloquean con **moneda del juego** ganada jugando. El dinero real, como mucho, para acelerar o para cosméticos.
- Las razas son **alternativas, no mejoras**: ninguna raza desbloqueable puede ser más fuerte que las iniciales.
- Los rivales (equipos guardados de otros jugadores) usan sus propias razas, así que puedes enfrentarte a razas que no tienes.

**Riesgos a vigilar**
- Combinaciones de 5 razas demasiado fuertes: validar con el script de simulación del hito 7.
- Partidas repetitivas por usar siempre las mismas razas: valorar una raza rotativa semanal o un modo con razas aleatorias.

**Requisito técnico desde ya (hito 3)**
- La generación de la tienda recibe la **lista de razas disponibles como parámetro** (por ejemplo, `generateShop(round, races, rng)`). En la versión 1 se pasan las 4 razas existentes. No se debe asumir en ningún sitio del motor que todas las razas están siempre disponibles.
- El bot también recibe su lista de razas como parámetro.

## Fuera de la versión 1 (no implementar todavía)

- Terreno de la arena (versión 2).
- Online asíncrono con equipos guardados (versión 3).
- Comandante, dos filas, moral, estados (veneno, escudo, aturdir), objetos, cadáveres.
- Sinergias de raza por número de unidades.
