export interface TileDef {
  name: string;
  walkable: boolean;
  /** Skymmer sikten. */
  opaque: boolean;
  /** Mörkt utan ljuskälla (grottor). */
  dark?: boolean;
}

export const TILES: Record<string, TileDef> = {
  '.': { name: 'gräs', walkable: true, opaque: false },
  ',': { name: 'stig', walkable: true, opaque: false },
  _: { name: 'trägolv', walkable: true, opaque: false },
  ':': { name: 'grottgolv', walkable: true, opaque: false, dark: true },
  '+': { name: 'dörr', walkable: true, opaque: true },
  '#': { name: 'vägg', walkable: false, opaque: true },
  '%': { name: 'berg', walkable: false, opaque: true },
  T: { name: 'träd', walkable: false, opaque: true },
  '~': { name: 'vatten', walkable: false, opaque: false },
};

export interface MapDef {
  id: string;
  name: string;
  rows: string[];
  /** Tecken i kartan som placerar ut varelser: tecken -> underlag och varelse-id. */
  spawns: Record<string, { tile: string; creature: string }>;
  /** Tecknet för rollpersonens startruta och dess underlag. */
  start: { char: string; tile: string };
}

export interface GameMap {
  id: string;
  name: string;
  w: number;
  h: number;
  tiles: string[];
  spawns: { creature: string; x: number; y: number }[];
  start: { x: number; y: number };
}

export function parseMap(def: MapDef): GameMap {
  const h = def.rows.length;
  const w = def.rows[0].length;
  const tiles: string[] = [];
  const spawns: GameMap['spawns'] = [];
  let start = { x: 1, y: 1 };
  def.rows.forEach((row, y) => {
    if (row.length !== w) throw new Error(`Karta ${def.id}: rad ${y} har bredd ${row.length}, väntade ${w}`);
    [...row].forEach((ch, x) => {
      if (ch === def.start.char) {
        start = { x, y };
        tiles.push(def.start.tile);
      } else if (def.spawns[ch]) {
        spawns.push({ creature: def.spawns[ch].creature, x, y });
        tiles.push(def.spawns[ch].tile);
      } else if (TILES[ch]) {
        tiles.push(ch);
      } else {
        throw new Error(`Karta ${def.id}: okänt tecken "${ch}" på (${x},${y})`);
      }
    });
  });
  return { id: def.id, name: def.name, w, h, tiles, spawns, start };
}

export const idx = (map: GameMap, x: number, y: number) => y * map.w + x;
export const inBounds = (map: GameMap, x: number, y: number) => x >= 0 && y >= 0 && x < map.w && y < map.h;
export const tileAt = (map: GameMap, x: number, y: number): TileDef => TILES[map.tiles[idx(map, x, y)]];
export const walkable = (map: GameMap, x: number, y: number) => inBounds(map, x, y) && tileAt(map, x, y).walkable;

/** Schackavstånd – angränsande rutor (även diagonalt) har avstånd 1. */
export const distance = (ax: number, ay: number, bx: number, by: number) =>
  Math.max(Math.abs(ax - bx), Math.abs(ay - by));

/** Fri sikt mellan två rutor (ändpunkterna räknas inte som hinder). */
export function lineOfSight(map: GameMap, x0: number, y0: number, x1: number, y1: number): boolean {
  let x = x0;
  let y = y0;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  while (x !== x1 || y !== y1) {
    if ((x !== x0 || y !== y0) && tileAt(map, x, y).opaque) return false;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
  return true;
}

/** Alla rutor som syns från (px, py) inom en radie. */
export function computeFov(map: GameMap, px: number, py: number, radius: number): Set<number> {
  const visible = new Set<number>();
  for (let y = py - radius; y <= py + radius; y++) {
    for (let x = px - radius; x <= px + radius; x++) {
      if (!inBounds(map, x, y)) continue;
      if ((x - px) ** 2 + (y - py) ** 2 > radius * radius + radius) continue;
      if (lineOfSight(map, px, py, x, y)) visible.add(idx(map, x, y));
    }
  }
  return visible;
}

const DIRS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

export type Point = { x: number; y: number };

/**
 * Bredden-först-sökning. Returnerar stegen från start (exklusive) till målet (inklusive),
 * eller null om målet inte kan nås. `blocked` anger rutor som är upptagna.
 * Med `adjacentOk` räcker det att nå en ruta intill målet.
 */
export function findPath(
  map: GameMap,
  from: Point,
  to: Point,
  blocked: (x: number, y: number) => boolean,
  adjacentOk = false,
): Point[] | null {
  const done = (x: number, y: number) =>
    adjacentOk ? distance(x, y, to.x, to.y) <= 1 : x === to.x && y === to.y;
  if (done(from.x, from.y)) return [];
  const prev = new Map<number, number>();
  const start = idx(map, from.x, from.y);
  prev.set(start, -1);
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    const cx = cur % map.w;
    const cy = Math.floor(cur / map.w);
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!walkable(map, nx, ny)) continue;
      const ni = idx(map, nx, ny);
      if (prev.has(ni)) continue;
      if (blocked(nx, ny)) continue;
      const isGoal = done(nx, ny);
      prev.set(ni, cur);
      if (isGoal) {
        const path: Point[] = [];
        for (let i = ni; i !== start; i = prev.get(i)!) path.push({ x: i % map.w, y: Math.floor(i / map.w) });
        return path.reverse();
      }
      queue.push(ni);
    }
  }
  return null;
}

/** Alla rutor som kan nås inom ett visst antal steg. */
export function reachable(
  map: GameMap,
  from: Point,
  steps: number,
  blocked: (x: number, y: number) => boolean,
): Point[] {
  const dist = new Map<number, number>([[idx(map, from.x, from.y), 0]]);
  const queue: Point[] = [from];
  const out: Point[] = [];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    const d = dist.get(idx(map, cur.x, cur.y))!;
    if (d >= steps) continue;
    for (const [dx, dy] of DIRS) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (!walkable(map, nx, ny) || blocked(nx, ny)) continue;
      const ni = idx(map, nx, ny);
      if (dist.has(ni)) continue;
      dist.set(ni, d + 1);
      out.push({ x: nx, y: ny });
      queue.push({ x: nx, y: ny });
    }
  }
  return out;
}
