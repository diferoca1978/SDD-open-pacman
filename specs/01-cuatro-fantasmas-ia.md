# SPEC 01 — Cuatro fantasmas con IA clásica

> **Estado:** Aprobado
> **Depende de:** ninguno
> **Fecha:** 2026-08-25
> **Objetivo:** Implementar los cuatro fantasmas clásicos (Blinky, Pinky, Inky, Clyde) con comportamientos de persecución distintos y liberación escalonada desde el corral.

## Scope

**In:**

- Ampliar `GHOST_STARTS` (en `maze.js`) de 2 a 4 fantasmas con personalidades clásicas y posiciones de inicio dentro del corral.
- Refactorizar `decideGhost` (en `game.js`) a un despachador de estrategias por personalidad (una función de celda objetivo distinta para cada fantasma).
- Implementar las cuatro estrategias de objetivo:
  - **Blinky:** celda actual de Pac-Man (persecución directa, agresiva).
  - **Pinky:** 4 celdas por delante de Pac-Man según su dirección (emboscada).
  - **Inky:** reflejo de Blinky respecto al punto 2 celdas por delante de Pac-Man (flanqueo).
  - **Clyde:** perseguir si distancia Manhattan > 8; si no, retirarse a su esquina inferior izquierda.
- Contención en el corral + liberación escalonada cada ~90 frames (1.5s @ 60fps), orden Blinky → Pinky → Inky → Clyde (Blinky sale de inmediato).
- Reordenar `GHOST_COLORS` en `render.js` para que coincida con `GHOST_STARTS` (rojo, rosa, cian, naranja).

**Out of scope (para futuros specs):**

- Modo scatter/chase (alternancia temporal de retirada/persecución).
- Modo frightened (power pellets, fantasmas azules y comestibles).
- Cruise Elroy (aceleración de Blinky cuando quedan pocos dots).
- Velocidades distintas por fantasma: los cuatro a la misma velocidad.
- Persistencia, niveles o high-scores.

## Data model

```js
// maze.js — GHOST_STARTS pasa de 2 a 4 entradas; kind = personalidad.
const GHOST_STARTS = [
  { x: 13, y: 14, kind: "blinky" },
  { x: 14, y: 14, kind: "pinky" },
  { x: 12, y: 14, kind: "inky" },
  { x: 15, y: 14, kind: "clyde" },
];
```

```js
// game.js — estado de liberación por partida.
const RELEASE_ORDER = ["blinky", "pinky", "inky", "clyde"];
const RELEASE_FRAMES = 90; // ~1.5s @ 60fps, separación entre liberaciones.

// En createGame():
//   game.releaseClock = 0;                 // incrementa 1 en cada update()
//   por fantasma:
//     released: false
//     releaseAt: RELEASE_FRAMES * (índice en RELEASE_ORDER)   // 0, 90, 180, 270
```

Convenciones:

- Coordenadas: celda (x,y), origen arriba-izquierda.
- Velocidades en celdas/frame. `GHOST_SPEED` (0.1) sin cambios para los cuatro.
- Distancia: Manhattan, igual que la heurística actual de `hunter`.
- `decideGhost` mantiene el bucle existente de "elegir la dirección válida con menor distancia Manhattan al target"; solo cambia cómo se calcula el target según `g.kind`.

## Implementation plan

1. En `maze.js`, ampliar `GHOST_STARTS` a 4 entradas (Blinky, Pinky, Inky, Clyde) con coords dentro del corral (y=14). Manual: abrir el juego y ver 4 fantasmas renderizados sin errores en consola.
2. En `game.js`, refactorizar `decideGhost`: extraer `targetCell(game, g)` que devuelve la celda objetivo según `g.kind`, y reutilizar el bucle de selección de dirección existente. Dejar las 4 estrategias apuntando por ahora al target de Blinky. Manual: comportamiento idéntico al actual con 4 fantasmas.
3. Implementar estrategia de Blinky: `target = (round(pacman.x), round(pacman.y))`. Manual: Blinky persigue directamente.
4. Implementar estrategia de Pinky: `target = pacman + 4 * DIRS[pacman.dir]`. Manual: Pinky se adelanta a la ruta.
5. Implementar estrategia de Inky: `P = pacman + 2 * DIRS[pacman.dir]`; `b = posición de Blinky` (buscar por `kind === 'blinky'`); `target = 2*P - b`. Manual: Inky flanquea desde el lado opuesto a Blinky.
6. Implementar estrategia de Clyde: si `dist(Manhattan, Clyde→Pac-Man) > 8`, `target = Pac-Man`; si no, `target = esquina inferior izquierda de Clyde`. Manual: Clyde alterna acercarse y alejarse.
7. Añadir contención y liberación en `game.js`: por cada `update()`, incrementar `game.releaseClock`; para cada fantasma, si `releaseClock >= g.releaseAt`, marcar `g.released = true`. Mientras `released === false`, restringir `decideGhost` a movimientos que se queden dentro del corral (rebote vertical en cols 11–16, filas 13–15; sin cruzar la puerta `3`). Al liberarse, sale hacia arriba por la puerta. Manual: los 3 no liberados se quedan dentro; salen uno por uno cada ~1.5s.
8. Reordenar `GHOST_COLORS` en `render.js` para coincidir con `GHOST_STARTS`: Blinky `#ff0000`, Pinky `#ffb8ff`, Inky `#00ffff`, Clyde `#ffb852`. Manual: colores clásicos en pantalla.

## Acceptance criteria

- [ ] Al iniciar la partida se renderizan 4 fantasmas con los colores clásicos (rojo, rosa, cian, naranja).
- [ ] Los 4 fantasmas comienzan dentro del corral.
- [ ] Blinky sale del corral de inmediato; Pinky, Inky y Clyde salen uno por uno con ~1.5s de separación entre cada uno.
- [ ] Mientras un fantasma no está liberado, permanece dentro del corral y no cruza la puerta hacia afuera.
- [ ] Blinky se desplaza siempre hacia la celda actual de Pac-Man.
- [ ] Pinky se desplaza hacia la celda 4 por delante de Pac-Man según su dirección de mirada.
- [ ] Inky se desplaza hacia el reflejo de Blinky respecto al punto 2 celdas por delante de Pac-Man.
- [ ] Clyde persigue a >8 celdas (Manhattan) de Pac-Man y se retira a su esquina a ≤8.
- [ ] Ningún fantasma da marcha atrás a mitad de corredor salvo callejón sin salida (regla ya existente).
- [ ] Los 4 fantasmas se mueven a la misma velocidad (sin aceleración).
- [ ] La consola del navegador no muestra errores durante una partida.

## Decisions

- **Sí:** Conjunto clásico de cuatro personalidades (Blinky/Pinky/Inky/Clyde). Canónico, bien documentado y educativo para un proyecto de aprendizaje.
- **No:** Conjunto "custom" más simple. Menos canónico y sin valor pedagógico claro.
- **Sí:** Blinky perseguidor agresivo con la misma velocidad que los demás (smart targeting only). Pedido explícito del usuario; evita un juego injugable.
- **No:** Cruise Elroy (aceleración de Blinky con pocos dots). Se deja para otro spec; mantiene el balance simple.
- **Sí:** Liberación escalonada cada ~90 frames (1.5s @ 60fps), orden Blinky→Pinky→Inky→Clyde, Blinky inmediato. Decisión del usuario; da aire al jugador al inicio.
- **No:** Modo scatter/chase y modo frightened. Quedan fuera de alcance (futuros specs).
- **Sí:** `kind` pasa a ser la clave de personalidad y `decideGhost` se refactoriza a despachador de estrategias. Escala el patrón existente de ramificar por `kind`.
- **Sí:** Tiempo de liberación en frames (90), no en segundos con delta-time. Consistente con el modelo actual basado en frames (velocidades en celdas/frame, sin deltaTime). Asumir 60fps es una limitación ya existente.
- **No:** No se añaden power pellets ni modo asustado en este spec.

## Risks

| Riesgo                                                                           | Mitigación                                                                                                                        |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Asumir 60fps hace que 1.5s reales varíen en monitores de otra tasa (p.ej. 144Hz) | Limitación ya existente del modelo de velocidad; documentada en Decisiones. La precisión por delta-time iría en un spec separado. |
| 4 fantasmas pueden hacer el juego difícil                                        | Solo Blinky persigue la celda actual; Pinky/Inky/Clyde no, y Clyde huye al acercarse. La liberación escalonada da aire al inicio. |
| Inky necesita referenciar al fantasma Blinky durante su decisión                 | Se busca en `game.ghosts` por `kind === 'blinky'`; su existencia está garantizada por `GHOST_STARTS`.                             |

## What is **not** in this spec

- Modo scatter/chase (alternancia temporal).
- Modo frightened (power pellets, fantasmas comestibles).
- Cruise Elroy (aceleración de Blinky con pocos dots).
- Velocidades distintas por fantasma.
- Niveles, high-scores o cualquier persistencia.

Cada uno de esos puntos, si aterriza, va en su propio spec.
