# SPEC 02 — Salida efectiva del corral

> **Estado:** Aprobado
> **Depende de:** SPEC 01
> **Fecha:** 2026-08-31
> **Objetivo:** Garantizar que Blinky salga del corral de inmediato al iniciar la partida (y tras cada muerte) y que Pinky, Inky y Clyde salgan uno por uno con ~1.5s de separación, dirigiéndolos a la puerta mientras estén dentro, sin depender de la posición ni del movimiento de Pac-Man.

## Por qué existe esta spec

SPEC 01 definió la liberación escalonada y su criterio "Blinky sale del corral de inmediato; Pinky, Inky y Clyde salen uno por uno cada ~1.5s", pero la implementación fusionada no lo cumple en la práctica. Una simulación de 600 frames (10s) muestra que el timing de `released` funciona (0/90/180/270), pero **ningún fantasma sale jamás del corral**: el targeting voraz de persecución, con Pac-Man siempre debajo, nunca elige subir por la puerta y los cuatro orbitan dentro del corral indefinidamente. La partida real confirma el síntoma: solo salen si Pac-Man se mueve y pasa cerca del corral, porque su posición decide si subir por la puerta minimiza la distancia; con Pac-Man quieto o lejos debajo, no salen nunca.

## Scope

**In:**

- En `game.js`, dirigir a todo fantasma liberado que esté dentro del corral (o en la celda puerta) hacia la celda de salida sobre la puerta, ignorando su objetivo de personalidad hasta quedar fuera.
- La salida del corral y el rebote previo son totalmente independientes de la posición y el movimiento de Pac-Man: mientras un fantasma esté dentro del corral, no consulta su objetivo de personalidad.
- En `game.js`, hacer que cada fantasma no liberado rebote en torno a su celda de inicio (`home`) en vez de deambular por el corral siguiendo su objetivo de personalidad.
- En `game.js`, hacer la puerta unidireccional: ningún fantasma puede entrar a una celda puerta (valor `3`) moviéndose hacia abajo.
- En `game.js`, reiniciar la secuencia de liberación al perder una vida: tras `resetPositions`, `releaseClock`, `released` y `releaseAt` vuelven a su estado inicial.
- Timing sin cambios: `RELEASE_ORDER` y `RELEASE_FRAMES = 90` se mantienen (0/90/180/270 frames).

**Out of scope (para futuros specs):**

- Blinky arrancando ya fuera del corral (decisión del usuario: arranca dentro).
- Delta-time o tiempos en segundos reales (el motor sigue basado en frames).
- Pausa "READY!" al iniciar partida o reaparecer.
- Modo scatter/chase, modo frightened, Cruise Elroy (igual que en SPEC 01).
- Cambios en `maze.js`, `render.js` o `main.js`.

## Data model

```js
// game.js — constantes y helpers nuevos (sin archivos nuevos)
const GHOST_EXIT = { x: 13, y: 11 }; // celda sobre la puerta, meta de salida

// createGame() — cada fantasma conserva su celda de inicio para rebotar
home: { x: g.x, y: g.y }

// inPen(g): true si el fantasma sigue en la zona de salida.
// Coordenadas redondeadas: x en [11,16] y y en [12,15]
// (corral filas 13-15 + celdas puerta fila 12; el resto de la fila 12 es muro,
//  y la fila 14 fuera de cols 11-16 es el tunel, por eso vale una caja simple).
```

- `decideGhost`: selecciona el target en tres ramas: fantasma no liberado → `g.home`; fantasma liberado dentro de `inPen( g )` → `GHOST_EXIT`; fantasma liberado fuera → `targetCell( game, g )`.
- `canGhostMove`: denegar si el destino es una celda puerta (`grid === 3`) y la dirección es `down`.
- `resetPositions`: `game.releaseClock = 0`; por fantasma, `released = false` y `releaseAt = RELEASE_FRAMES * RELEASE_ORDER.indexOf( g.kind )` (igual que en `createGame`).
- `RELEASE_ORDER`, `RELEASE_FRAMES`, `GHOST_STARTS` y `GHOST_SPEED` sin cambios.

## Implementation plan

1. En `game.js`, añadir `GHOST_EXIT`, `inPen( g )` y el campo `home` por fantasma en `createGame`; refactorizar `decideGhost` a tres ramas: no liberado → `home`; liberado dentro del corral → `GHOST_EXIT`; fuera → `targetCell`. Verificación: simulación Node con `game.pacman.speed = 0` (Pac-Man quieto) — primeros frames fuera ≈ blinky 16, pinky 106, inky 206, clyde 276; la misma simulación con Pac-Man en movimiento produce exactamente los mismos frames.
2. En `canGhostMove` (`game.js`), denegar entrar a una celda puerta con dirección `down`. Verificación: simulación extendida (~1200 frames tras la salida) — ningún fantasma vuelve a la caja del corral; en navegador, ningún fantasma se re-mete al corral en una partida.
3. En `resetPositions` (`game.js`), reiniciar `releaseClock`, `released` y `releaseAt` como en `createGame`. Verificación: simulación forzando una colisión — tras el reset, los frames de salida se repiten igual que al inicio; en navegador, morir y ver repetirse la secuencia.

## Acceptance criteria

- [ ] Al iniciar la partida, Blinky queda fuera del corral en ≤ 60 frames (~1s).
- [ ] Pinky, Inky y Clyde quedan fuera del corral, en ese orden, cada uno ~90 frames (1.5s ± 0.4s) después del anterior.
- [ ] Con Pac-Man quieto desde el arranque y sin input, los cuatro fantasmas salen del corral con el mismo orden y timing que con Pac-Man en movimiento.
- [ ] Cada fantasma queda fuera del corral en ≤ 60 frames tras su `releaseAt`.
- [ ] Mientras un fantasma no está liberado, permanece dentro del corral sin cruzar la puerta (regla actual intacta).
- [ ] Ningún fantasma liberado vuelve a entrar al corral por la puerta.
- [ ] Tras perder una vida (quedando vidas), los cuatro vuelven al corral y repiten la secuencia: Blinky inmediato, resto escalonado ~1.5s.
- [ ] Una vez fuera, cada fantasma persigue su objetivo de personalidad de SPEC 01 sin cambios.
- [ ] La simulación Node registra primer frame fuera del corral para los 4, en orden blinky < pinky < inky < clyde.
- [ ] La consola del navegador no muestra errores durante una partida completa.

## Decisions

- **Sí:** Salida dirigida a la celda sobre la puerta (`GHOST_EXIT`) mientras el fantasma liberado esté en el corral, independiente de la posición de Pac-Man. Canónico (comportamiento "leaving house" del arcade) y resuelve la órbita; el greedy existente converge a la puerta desde cualquier celda del corral.
- **Sí:** Rebotar en torno a `home` mientras el fantasma no está liberado. Hace que todo el comportamiento dentro del corral sea independiente de Pac-Man, reduce la varianza del timing y coincide con el "rebote vertical" descrito en SPEC 01.
- **No:** Dejar que el fantasma no liberado deambule por el corral persiguiendo su objetivo de personalidad. Depende de la posición de Pac-Man y puede aumentar el primer hueco de salida hasta 130 frames.
- **No:** Script forzado de salida (centrarse y subir con movimientos fijos). Más código y casos especiales para el mismo resultado.
- **No:** Blinky arrancando fuera del corral como el arcade original. Decisión del usuario: arranca dentro y sale por la puerta (~0.5s).
- **Sí:** Puerta unidireccional (solo se cruza hacia arriba). Sin esto, un fantasma cruzando (13,11)/(14,11) con objetivo abajo reentra y da una vuelta al corral antes de volver a salir.
- **Sí:** Repetir la secuencia de liberación tras cada muerte. Decisión del usuario; canónico y da aire al jugador tras reaparecer.
- **Sí:** Mantener el timing en frames (`RELEASE_FRAMES = 90` ≈ 1.5s @ 60fps). Consistente con SPEC 01 y con todo el motor basado en frames.

## Risks

| Riesgo                                                                                 | Mitigación                                                                                                                          |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| La salida tarda frames distintos según la fase del rebote al liberarse                 | Medido: cada fantasma sale en ≤ 60 frames tras su `releaseAt`; los huecos entre salidas son de 70-100 frames (~1.2-1.7s). Aceptado. |
| Monitores de alta tasa (p. ej. 144Hz) hacen que 90 frames ≠ 1.5s reales                | Limitación ya documentada en SPEC 01; delta-time queda fuera de alcance.                                                            |
| La fase del rebote puede hacer que un fantasma salga antes que otro tras su liberación | El rebote alrededor de `home` limita la variación; el orden de liberación por `releaseAt` se conserva.                              |

## What is **not** in this spec

- Blinky arrancando fuera del corral.
- Delta-time o tiempos en segundos reales.
- Pausa "READY!" al iniciar o reaparecer.
- Modo scatter/chase, modo frightened, Cruise Elroy.
- Niveles, high-scores o persistencia.

Cada uno de esos puntos, si aterriza, va en su propio spec.
