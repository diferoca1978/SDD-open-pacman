# AGENTS.md

Vanilla JS/HTML/CSS Pac-Man clone. No build step, no framework, no `package.json`, no test/lint/typecheck commands — do not look for them. The repo doubles as a learning vehicle for a **spec-driven development** workflow (see "Spec workflow" below). Comments and the README are in Spanish; match that language in new code and specs.

## Running the game

Open `src/index.html` directly in a browser, or serve `src/` with any static server (e.g. `python3 -m http.server -d src`). There is no dev server script. Scripts are plain `<script src>` tags (not ES modules), so `file://` works and there are no module/CORS issues.

## Source architecture — load order is load-bearing

`src/index.html` loads four scripts **in this exact order**; they communicate via `window` globals, NOT ES modules:

1. `src/js/maze.js` → exposes `MAZE`, `TUNNEL_ROW`, `PACMAN_START`, `GHOST_STARTS`
2. `src/js/game.js` → exposes `createGame`, `update`, `DIRS` (depends on maze.js globals)
3. `src/js/render.js` → exposes `draw` (depends on `DIRS` from game.js)
4. `src/js/main.js` → entry point: loop, keyboard, overlay; uses all of the above

Adding a JS file requires a new `<script>` tag in `index.html` in the correct position — there is no bundler to resolve order. The `window` globals are **intentional**, not a smell to "fix" by introducing modules.

## Maze encoding (maze.js / game.js)

`MAZE_STR` rows parse to numbers: `#`=wall(1), `.`=dot(2), ` `=empty traversable(0), `-`=pen door(3). `MAZE` is the **pristine** matrix and must never be mutated; `createGame()` copies it into `game.grid` per game so dots can be eaten. Render from `game.grid`, never `MAZE`.

Wall rules differ by actor (in `isWall`): Pac-Man is blocked by wall(1) **and** pen door(3); ghosts are blocked only by wall(1) and can cross the door. Tunnel wrap happens only on `TUNNEL_ROW` (14).

## Spec workflow

Two skills are locked in `skills-lock.json` and stored under `.agents/skills/`:

- **`/spec "<feature>"`** — guided spec designer. Asks clarifying questions before writing, then saves `specs/NN-slug.md` (next sequential two-digit number) in `Draft` state. Never writes code. A new spec must follow the template at `.agents/skills/spec/template.md` and match the language/conventions of any existing specs.
- **`/spec-impl <NN-slug>`** — implements a spec whose state means **Approved** (e.g. `Approved`, `Aprobado`; it stops on any other state). Creates and switches to a git branch `spec-NN-slug`, then implements the plan step by step, pausing after each step for diff review. **Never auto-commits** — committing is the user's decision.

> ⚠️ `/spec-impl` runs `git checkout -b`, but this repo is **not** a git repo yet. Run `git init` before implementing the first spec.
