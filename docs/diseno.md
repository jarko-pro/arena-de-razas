# Diseño – Arena de Razas (versión 1)

Título provisional. Este documento es la fuente de verdad de las reglas. Los valores numéricos son iniciales y se ajustarán con playtesting.

## Resumen

Partida individual contra rivales. Cada ronda tiene dos fases:

1. **Tienda**: el jugador gasta oro en comprar, vender, reordenar y fusionar unidades.
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
| Oro por ronda | 10 (no se acumula entre rondas) |
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
- Comprar una unidad de la tienda (si hay hueco en el equipo o si forma una fusión).
- Vender una unidad del equipo.
- Reroll: sustituir todas las unidades de la tienda.
- Reordenar el equipo arrastrando unidades.
- Terminar la tienda y pasar al combate.

## Fusiones y niveles

- **3 copias** de la misma unidad de nivel 1 se fusionan automáticamente en **1 unidad de nivel 2**.
- **3 unidades de nivel 2** iguales se fusionan en **1 de nivel 3** (nivel máximo).
- Al comprar la tercera copia, la fusión ocurre aunque el equipo esté lleno.
- La unidad fusionada ocupa la posición de la copia más adelantada.

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
| Al comprar | Al comprarla en la tienda |
| Al vender | Al venderla en la tienda |

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
- Estrategia del bot: elige una raza preferida al azar, prioriza comprar unidades de esa raza y fusiones, y hace reroll si no encuentra nada útil.
- El equipo rival de la ronda N es el que tendría un bot en la ronda N.

## Fuera de la versión 1 (no implementar todavía)

- Terreno de la arena (versión 2).
- Online asíncrono con equipos guardados (versión 3).
- Comandante, dos filas, moral, estados (veneno, escudo, aturdir), objetos, cadáveres.
- Sinergias de raza por número de unidades.
