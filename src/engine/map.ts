export interface TileDef {
  name: string;
  walkable: boolean;
  /** Skymmer sikten. */
  opaque: boolean;
  /** Mörkt utan ljuskälla (grottor). */
  dark?: boolean;
  /** Utomhus i naturen (KAMOUFLAGE). */
  outdoor?: boolean;
}

export const TILES: Record<string, TileDef> = {
  '.': { name: 'gräs', walkable: true, opaque: false, outdoor: true },
  ',': { name: 'stig', walkable: true, opaque: false, outdoor: true },
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
  /** Figurer på kartan: en varelse ur innehållet eller en person som kan följa med (`recruit`). */
  spawns: Record<string, { tile: string; creature?: string; recruit?: string }>;
  /** Tecknet för rollpersonens startruta och dess underlag. */
  start: { char: string; tile: string };
  /** Växtplatser i trakten (för att leta örter), t.ex. "skog" eller "ängar". */
  habitats?: string[];
  /** Utgångar ur modulen: tecken -> underlag och namn. Går gruppen dit kan den lämna äventyret. */
  exits?: Record<string, { tile: string; name: string }>;
  /** Låsta dörrar och kistor: tecken -> underlag och låset. En dörr ska ha underlaget '+'. */
  locks?: Record<string, LockDef>;
}

/** En låst dörr eller kista (steg 8, besvärjelserna utanför strid). */
export interface LockDef {
  tile: string;
  kind: 'dörr' | 'kista';
  name: string;
  /** Låsets svårighetsgrad: Låsdyrkning nöter ned den med differensvärdet, och STY prövas mot den. */
  difficulty: number;
  /** Föremål i kistan (id ur regeldatan eller innehållet). */
  loot?: string[];
  /** Silver i kistan (tärningsuttryck). */
  silver?: string;
}

export interface GameMap {
  id: string;
  name: string;
  w: number;
  h: number;
  tiles: string[];
  spawns: { creature?: string; recruit?: string; x: number; y: number }[];
  start: { x: number; y: number };
  habitats: string[];
  exits: { x: number; y: number; name: string }[];
  locks: (LockDef & { x: number; y: number })[];
}

export function parseMap(def: MapDef): GameMap {
  const h = def.rows.length;
  const w = def.rows[0].length;
  const tiles: string[] = [];
  const spawns: GameMap['spawns'] = [];
  const exits: GameMap['exits'] = [];
  const locks: GameMap['locks'] = [];
  let start = { x: 1, y: 1 };
  def.rows.forEach((row, y) => {
    if (row.length !== w) throw new Error(`Karta ${def.id}: rad ${y} har bredd ${row.length}, väntade ${w}`);
    [...row].forEach((ch, x) => {
      if (ch === def.start.char) {
        start = { x, y };
        tiles.push(def.start.tile);
      } else if (def.spawns[ch]) {
        spawns.push({ creature: def.spawns[ch].creature, recruit: def.spawns[ch].recruit, x, y });
        tiles.push(def.spawns[ch].tile);
      } else if (def.locks?.[ch]) {
        locks.push({ ...def.locks[ch], x, y });
        tiles.push(def.locks[ch].tile);
      } else if (def.exits?.[ch]) {
        exits.push({ x, y, name: def.exits[ch].name });
        tiles.push(def.exits[ch].tile);
      } else if (TILES[ch]) {
        tiles.push(ch);
      } else {
        throw new Error(`Karta ${def.id}: okänt tecken "${ch}" på (${x},${y})`);
      }
    });
  });
  return { id: def.id, name: def.name, w, h, tiles, spawns, start, habitats: def.habitats ?? [], exits, locks };
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

/**
 * Rutorna som en projektil passerar från (x0, y0) mot (x1, y1), förlängd till `length` rutor.
 * Banan tar slut vid något som skymmer (väggar, träd, berg). Startrutan ingår inte.
 */
export function projectilePath(map: GameMap, x0: number, y0: number, x1: number, y1: number, length: number): Point[] {
  const d = distance(x0, y0, x1, y1);
  if (d === 0) return [];
  const f = length / d;
  const ex = x0 + Math.round((x1 - x0) * f);
  const ey = y0 + Math.round((y1 - y0) * f);
  const out: Point[] = [];
  let x = x0;
  let y = y0;
  const dx = Math.abs(ex - x0);
  const dy = Math.abs(ey - y0);
  const sx = x0 < ex ? 1 : -1;
  const sy = y0 < ey ? 1 : -1;
  let err = dx - dy;
  while ((x !== ex || y !== ey) && out.length < length) {
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
    if (!inBounds(map, x, y) || tileAt(map, x, y).opaque) break;
    out.push({ x, y });
  }
  return out;
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
  /** Vilka rutor man kan gå på (FLYGA tar sig över vatten och träd). */
  canPass: (x: number, y: number) => boolean = (x, y) => walkable(map, x, y),
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
      if (!canPass(nx, ny)) continue;
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
  canPass: (x: number, y: number) => boolean = (x, y) => walkable(map, x, y),
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
      if (!canPass(nx, ny) || blocked(nx, ny)) continue;
      const ni = idx(map, nx, ny);
      if (dist.has(ni)) continue;
      dist.set(ni, d + 1);
      out.push({ x: nx, y: ny });
      queue.push({ x: nx, y: ny });
    }
  }
  return out;
}
