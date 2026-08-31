// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame
const RELEASE_ORDER = [ 'blinky', 'pinky', 'inky', 'clyde' ];
const RELEASE_FRAMES = 90;
const GHOST_EXIT = { x: 13, y: 11 };

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEED,
      kind: g.kind,
      home: { x: g.x, y: g.y },
      released: false,
      releaseAt: RELEASE_FRAMES * RELEASE_ORDER.indexOf( g.kind ),
    } ) ),
    releaseClock: 0,
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

function inPen( g ) {
  const x = Math.round( g.x );
  const y = Math.round( g.y );
  return x >= 11 && x <= 16 && y >= 12 && y <= 15;
}

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado solo por pared (1)
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && actor === 'pacman' ) return true;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor );
}

function canGhostMove( game, g, dir ) {
  if ( !canMove( game.grid, g.x, g.y, dir, 'ghost' ) ) return false;
  const d = DIRS[ dir ];
  const tx = Math.round( g.x ) + d.x;
  const ty = Math.round( g.y ) + d.y;
  // La puerta solo se cruza hacia arriba; los fantasmas liberados no reingresan.
  if ( game.grid[ ty ] && game.grid[ ty ][ tx ] === 3 && dir === 'down' ) return false;
  if ( g.released ) return true;

  const nextX = g.x + d.x;
  const nextY = g.y + d.y;
  return nextX >= 11 && nextX <= 16 && nextY >= 13 && nextY <= 15;
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot.
    if ( grid[ p.y ][ p.x ] === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

function targetCell( game, g ) {
  const p = game.pacman;

  switch ( g.kind ) {
    case 'blinky':
      return {
        x: Math.round( p.x ),
        y: Math.round( p.y ),
      };
    case 'pinky':
      return {
        x: Math.round( p.x ) + DIRS[ p.dir ].x * 4,
        y: Math.round( p.y ) + DIRS[ p.dir ].y * 4,
      };
    case 'inky':
      {
        const d = DIRS[ p.dir ];
        const blinky = game.ghosts.find( ( ghost ) => ghost.kind === 'blinky' );
        const point = {
          x: Math.round( p.x ) + d.x * 2,
          y: Math.round( p.y ) + d.y * 2,
        };
        return {
          x: point.x * 2 - blinky.x,
          y: point.y * 2 - blinky.y,
        };
      }
    case 'clyde':
      {
        const pacmanCell = {
          x: Math.round( p.x ),
          y: Math.round( p.y ),
        };
        const distance = Math.abs( g.x - pacmanCell.x ) + Math.abs( g.y - pacmanCell.y );
        if ( distance > 8 ) return pacmanCell;
        return { x: 1, y: game.grid.length - 2 };
      }
    default:
      return {
        x: Math.round( p.x ),
        y: Math.round( p.y ),
      };
  }
}

function decideGhost( game, g ) {
  let target;
  if ( !g.released ) target = g.home;
  else if ( inPen( g ) ) target = GHOST_EXIT;
  else target = targetCell( game, g );

  const options = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canGhostMove( game, g, dir )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const reverse = OPPOSITE[ g.dir ];
  const choices = options.length ? options : ( canGhostMove( game, g, reverse ) ? [ reverse ] : [] );
  if ( !choices.length ) return;

  let best = choices[ 0 ];
  let bestDist = Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const nx = g.x + d.x;
    const ny = g.y + d.y;
    const dist = Math.abs( nx - target.x ) + Math.abs( ny - target.y );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  g.dir = best;
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    decideGhost( game, g );
    if ( !canGhostMove( game, g, g.dir ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.releaseClock = 0;
  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up';
    g.released = false;
    g.releaseAt = RELEASE_FRAMES * RELEASE_ORDER.indexOf( g.kind );
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  game.releaseClock++;
  game.ghosts.forEach( ( g ) => {
    if ( game.releaseClock >= g.releaseAt ) g.released = true;
  } );

  movePacman( game );
  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  for ( const g of game.ghosts ) {
    if ( collides( game.pacman, g ) ) {
      game.lives--;
      if ( game.lives <= 0 ) {
        game.state = 'lost';
        return;
      }
      resetPositions( game );
      break;
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
