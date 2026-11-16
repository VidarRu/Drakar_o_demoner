/**
 * Allt som har höjd – väggar, dörrar, berg och träd – ritas snett uppifrån som i
 * Exile/Avernum: man ser ovansidan och den södervända framsidan, och föremålen
 * sticker upp en bit över rutan norr om sig.
 *
 * Varje kartrad blir en egen bild ("remsa"). Remsorna läggs i radordning med
 * figurerna emellan, så att det som står längre söderut skymmer det bakom.
 */
import type { GameMap } from '../../engine/map';
import { charAt, TILE as T } from './grid';
import { PAL } from './palette';
import { hash, noise, Raster, shade } from './pixel';

/** Hur många pixlar ovanför sin rad en remsa får rita (trädkronor, väggkrön). */
export const OVER = 36;
/** Marginal i sidled, för trädkronor som sticker ut över kartkanten. */
export const PADX = 8;

const WALL_OVERHANG = 12;
const WALL_FACE = 20;

const doorHorizontal = (map: GameMap, x: number, y: number) =>
  charAt(map, x - 1, y) === '#' || charAt(map, x + 1, y) === '#';

/** Hänger rutan ihop med en vägg i den riktningen? En dörr i en vågrät vägg räknas som vägg i sidled. */
function wallLike(map: GameMap, x: number, y: number, dx: number, dy: number): boolean {
  const ch = charAt(map, x + dx, y + dy);
  if (ch === '#') return true;
  return ch === '+' && dy === 0 && doorHorizontal(map, x + dx, y + dy);
}

const rockLike = (map: GameMap, x: number, y: number) => {
  const ch = charAt(map, x, y);
  return ch === '%' || ch === '';
};

export function bakeRows(map: GameMap): (HTMLCanvasElement | null)[] {
  const depth = rockDepth(map);
  const rows: (HTMLCanvasElement | null)[] = [];
  for (let y = 0; y < map.h; y++) {
    const r = new Raster(map.w * T + PADX * 2, T + OVER);
    let any = false;
    for (let x = 0; x < map.w; x++) {
      const ox = PADX + x * T;
      const oy = OVER;
      switch (charAt(map, x, y)) {
        case '#':
          drawWall(r, map, x, y, ox, oy);
          break;
        case '+':
          if (doorHorizontal(map, x, y)) {
            drawWall(r, map, x, y, ox, oy);
            drawDoorFront(r, ox, oy);
          } else drawDoorSide(r, x, y, ox, oy);
          break;
        case '%':
          drawRock(r, map, depth, x, y, ox, oy);
          break;
        case 'T':
          drawTree(r, x, y, ox, oy);
          break;
        default:
          continue;
      }
      any = true;
    }
    rows.push(any ? r.toCanvas() : null);
  }
  return rows;
}

// ------------------------------------------------------------------ väggar

function drawWall(r: Raster, map: GameMap, x: number, y: number, ox: number, oy: number) {
  const N = wallLike(map, x, y, 0, -1);
  const S = wallLike(map, x, y, 0, 1);
  const W = wallLike(map, x, y, -1, 0);
  const E = wallLike(map, x, y, 1, 0);
  const top0 = N ? oy : oy - WALL_OVERHANG;
  const faceTop = S ? oy + T : oy + T - WALL_FACE;

  for (let ly = top0; ly < faceTop; ly++) {
    for (let lx = 0; lx < T; lx++) {
      const wx = x * T + lx;
      const wy = y * T + ly - oy;
      const outline = (!N && ly === top0) || (!W && lx === 0) || (!E && lx === T - 1);
      if (outline) {
        r.set(ox + lx, ly, PAL.mortar);
        continue;
      }
      // Krönet: flata stenar sedda uppifrån.
      const row = Math.floor(wy / 8);
      const off = row & 1 ? 5 : 0;
      const xIn = (wx + off) % 10;
      const yIn = ((wy % 8) + 8) % 8;
      let v = 0.45 + hash(Math.floor((wx + off) / 10), row, 71) * 0.3 + (noise(wx / 3, wy / 3, 72) - 0.5) * 0.2;
      if (xIn === 0 || yIn === 7) v = 0.08;
      if ((!N && ly - top0 <= 2) || (!W && lx <= 2)) v += 0.25;
      if (!E && lx >= T - 3) v -= 0.15;
      if (!S && ly === faceTop - 1) v = 0.95;
      r.set(ox + lx, ly, shade(PAL.wallTop, v, wx, wy, 0.3));
    }
  }
  if (S) return;

  const outside = ['.', ','].includes(charAt(map, x, y + 1));
  const window = outside && W && E && hash(x, y, 77) < 0.5;
  for (let ly = faceTop; ly < oy + T; ly++) {
    const fy = ly - faceTop;
    for (let lx = 0; lx < T; lx++) {
      const wx = x * T + lx;
      if ((!W && lx === 0) || (!E && lx === T - 1)) {
        r.set(ox + lx, ly, PAL.mortar);
        continue;
      }
      // Framsidan: stenskift fem pixlar höga, förskjutna varannan rad.
      const course = Math.floor(fy / 5);
      const within = fy % 5;
      const off = course & 1 ? 5 : 0;
      const xIn = (wx + off) % 10;
      if (within === 4 || xIn === 0) {
        r.set(ox + lx, ly, PAL.mortar);
        continue;
      }
      let v = 0.35 + hash(Math.floor((wx + off) / 10), course + y * 7, 73) * 0.35;
      v += (noise(wx / 2, ly / 2, 74) - 0.5) * 0.15;
      if (within === 0) v += 0.2;
      if (within === 3) v -= 0.12;
      if (fy >= WALL_FACE - 2) v -= 0.3;
      if (!W && lx === 1) v += 0.2;
      if (!E && lx === T - 2) v -= 0.2;
      r.set(ox + lx, ly, shade(PAL.wallFace, v, wx, ly, 0.3));
    }
  }
  if (window) drawWindow(r, ox + 10, faceTop + 3);
}

/** Ett upplyst fönster med spröjs. */
function drawWindow(r: Raster, x0: number, y0: number) {
  const w = 11;
  const h = 11;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const frame = x === 0 || y === 0 || x === w - 1 || y === h - 1 || x === 5 || y === 5;
      if (frame && (x === 0 || x === w - 1) && (y === 0 || y === h - 1)) continue;
      if (frame) r.set(x0 + x, y0 + y, PAL.doorWood[1]);
      else r.set(x0 + x, y0 + y, PAL.window[y < 5 ? 2 : 1 + ((x + y) & 1)]);
    }
  }
  r.set(x0 + 1, y0 + 1, PAL.window[3]);
  r.set(x0 + 6, y0 + 1, PAL.window[3]);
  for (let x = -1; x <= w; x++) r.set(x0 + x, y0 + h, PAL.wallFace[6]);
}

/** Dörr i en vågrät vägg: syns rakt framifrån. */
function drawDoorFront(r: Raster, ox: number, oy: number) {
  const x0 = ox + 8;
  const w = 16;
  const y0 = oy + T - WALL_FACE - 5;
  const h = oy + T - y0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (y < 2 && (x < 2 - y || x > w - 3 + y)) continue; // rundad båge
      const px = x0 + x;
      const py = y0 + y;
      if (x === 0 || x === w - 1 || y === 0) {
        r.set(px, py, PAL.doorWood[0]);
        continue;
      }
      if (y === h - 1) {
        r.set(px, py, PAL.wallFace[5]); // tröskel
        continue;
      }
      if (y === 5 || y === h - 7) {
        r.set(px, py, PAL.iron[1]);
        continue;
      }
      const plankIdx = Math.floor((x - 1) / 4);
      const seam = (x - 1) % 4 === 3;
      let v = seam ? 0.1 : 0.45 + hash(plankIdx, 0, 81) * 0.3 + (noise(x / 1.5, y / 5, 82) - 0.5) * 0.3;
      if (y === 6 || y === h - 6) v -= 0.25;
      r.set(px, py, shade(PAL.doorWood, v, px, py, 0.3));
    }
  }
  r.set(x0 + 12, y0 + Math.floor(h / 2), PAL.brass);
  r.set(x0 + 12, y0 + Math.floor(h / 2) + 1, PAL.doorWood[0]);
}

/** Dörr i en lodrät vägg: dörrbladet syns uppifrån som en smal planka. */
function drawDoorSide(r: Raster, x: number, y: number, ox: number, oy: number) {
  for (let ly = oy - 2; ly < oy + T - 2; ly++) {
    for (let lx = 13; lx <= 18; lx++) {
      const edge = lx === 13 || lx === 18 || ly === oy - 2;
      const band = (ly - oy) % 12 === 4;
      let v = 0.5 + (noise(lx, ly / 4, 83 + x + y) - 0.5) * 0.3;
      if (lx === 14) v += 0.25;
      if (lx === 17) v -= 0.2;
      r.set(ox + lx, ly, edge ? PAL.doorWood[0] : band ? PAL.iron[1] : shade(PAL.doorWood, v, lx, ly, 0.3));
    }
  }
}

// ------------------------------------------------------------------ berg

/** Hur långt in i berget en ruta ligger (0 = ingen bergruta). Används för att mörka bergets inre. */
function rockDepth(map: GameMap): Float32Array {
  const d = new Float32Array(map.w * map.h).fill(99);
  const queue: number[] = [];
  for (let i = 0; i < d.length; i++) {
    if (map.tiles[i] !== '%') {
      d[i] = 0;
      queue.push(i);
    }
  }
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head];
    const x = i % map.w;
    const y = (i / map.w) | 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h) continue;
        const j = ny * map.w + nx;
        if (d[j] > d[i] + 1) {
          d[j] = d[i] + 1;
          queue.push(j);
        }
      }
    }
  }
  return d;
}

function depthAt(map: GameMap, depth: Float32Array, wx: number, wy: number): number {
  const fx = wx / T - 0.5;
  const fy = wy / T - 0.5;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const get = (x: number, y: number) =>
    depth[Math.min(map.h - 1, Math.max(0, y)) * map.w + Math.min(map.w - 1, Math.max(0, x))];
  const tx = fx - x0;
  const ty = fy - y0;
  const a = get(x0, y0) + (get(x0 + 1, y0) - get(x0, y0)) * tx;
  const b = get(x0, y0 + 1) + (get(x0 + 1, y0 + 1) - get(x0, y0 + 1)) * tx;
  return a + (b - a) * ty;
}

/** Stenblock (cellbrus): varje block ljust uppe till vänster, med mörka fogar emellan. */
function boulder(px: number, py: number) {
  const S = 12;
  const wx = px + (noise(px / 9, py / 9, 94) - 0.5) * 7;
  const wy = py + (noise(px / 9, py / 9, 95) - 0.5) * 7;
  const gx = Math.floor(wx / S);
  const gy = Math.floor(wy / S);
  let d1 = 1e9;
  let d2 = 1e9;
  let fx = 0;
  let fy = 0;
  let id = 0;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const cx = (gx + i + hash(gx + i, gy + j, 91)) * S;
      const cy = (gy + j + hash(gx + i, gy + j, 92)) * S;
      const d = Math.hypot(wx - cx, wy - cy);
      if (d < d1) {
        d2 = d1;
        d1 = d;
        fx = cx;
        fy = cy;
        id = hash(gx + i, gy + j, 93);
      } else if (d < d2) d2 = d;
    }
  }
  return {
    crack: d2 - d1 < 1.3,
    lit: Math.max(-1, Math.min(1, -((wx - fx) * 0.6 + (wy - fy) * 0.8) / S)),
    tone: (id - 0.5) * 0.3 + (noise(px / 3, py / 3, 96) - 0.5) * 0.2,
  };
}

function drawRock(r: Raster, map: GameMap, depth: Float32Array, x: number, y: number, ox: number, oy: number) {
  const N = rockLike(map, x, y - 1);
  const S = rockLike(map, x, y + 1);
  const W = rockLike(map, x - 1, y);
  const E = rockLike(map, x + 1, y);
  for (let lx = 0; lx < T; lx++) {
    const wx = x * T + lx;
    const over = N ? 0 : 5 + Math.floor(noise(wx / 7, 1, 51) * 9);
    const face = S ? 0 : 20 + Math.floor(noise(wx / 6, 2, 52) * 8);
    const faceTop = oy + T - face;
    for (let ly = oy - over; ly < oy + T; ly++) {
      const wy = y * T + ly - oy;
      const inL = W ? 0 : 1 + Math.floor(noise(wy / 5, x * 7, 53) * 5);
      const inR = E ? 0 : 1 + Math.floor(noise(wy / 5, x * 7, 54) * 5);
      if (lx < inL || lx > T - 1 - inR) continue;
      const dL = W ? 99 : lx - inL;
      const dR = E ? 99 : T - 1 - inR - lx;
      if (ly < faceTop) {
        const dTop = N ? 99 : ly - (oy - over);
        if (Math.min(dTop, dL, dR) === 0) {
          r.set(ox + lx, ly, PAL.rockTop[0]);
          continue;
        }
        const dep = depthAt(map, depth, wx, wy);
        const b = boulder(wx, wy);
        let v = 0.95 - Math.min(dep, 4) * 0.15 + b.lit * 0.25 + b.tone + (hash(wx, wy, 56) - 0.5) * 0.08;
        if (b.crack) v -= 0.3;
        if (dTop <= 1 || dL <= 1) v += 0.2;
        if (!S && ly === faceTop - 1) v = 1;
        r.set(ox + lx, ly, shade(PAL.rockTop, v, wx, wy, 0.4));
      } else {
        if (dL === 0 || dR === 0) {
          r.set(ox + lx, ly, PAL.rockFace[0]);
          continue;
        }
        const rel = (ly - faceTop) / face;
        let v = 0.78 - rel * 0.45 + (noise(wx / 3, wy / 3, 57) - 0.5) * 0.2;
        const strata = noise(wx / 2.2, wy / 10, 58);
        if (strata < 0.22) v -= 0.3; // sprickor
        else if (strata > 0.8) v += 0.12;
        if ((ly - faceTop) % 7 === 0 && hash(Math.floor(wx / 5), ly, 59) < 0.5) v += 0.15; // avsatser
        if (dL <= 2) v += 0.15;
        if (dR <= 2) v -= 0.2;
        if (ly >= oy + T - 2) v -= 0.3;
        r.set(ox + lx, ly, shade(PAL.rockFace, v, wx, wy, 0.4));
      }
    }
  }
}

// ------------------------------------------------------------------ träd

function drawTree(r: Raster, x: number, y: number, ox: number, oy: number) {
  const kind = hash(x, y, 61);
  const cx = ox + 16 + Math.round((hash(x, y, 63) - 0.5) * 6);
  const base = oy + T - 5;
  if (kind < 0.62) drawSpruce(r, x, y, cx, base);
  else drawLeafTree(r, x, y, cx, base, hash(x, y, 62) < 0.45);
}

/** Gran: fyra våningar grenar som blir bredare nedåt. */
function drawSpruce(r: Raster, x: number, y: number, cx: number, base: number) {
  const h = 46 + Math.floor(hash(x, y, 64) * 12);
  const top = base - h;
  for (let ty = base - 6; ty <= base; ty++) {
    for (let dx = -1; dx <= 1; dx++) r.set(cx + dx, ty, PAL.bark[dx < 0 ? 3 : dx === 0 ? 2 : 1]);
  }
  const ch = h - 5;
  const tiers = 4;
  for (let ry = 0; ry <= ch; ry++) {
    const rel = ry / ch;
    const tp = rel * tiers;
    const frac = tp - Math.floor(tp);
    const hw = (1.2 + rel * 15) * (0.55 + 0.45 * frac) + (noise(ry * 0.8, x * 13 + y, 65) - 0.5) * 2;
    const lim = Math.ceil(hw);
    for (let dx = -lim; dx <= lim; dx++) {
      if (Math.abs(dx) > hw) continue;
      const edge = Math.abs(dx) > hw - 1.1 || ry === 0;
      let v = 0.55 - (dx / Math.max(hw, 1)) * 0.3 + (hash(cx + dx, top + ry, 66) - 0.5) * 0.35;
      if (frac < 0.18 && ry > 3) v -= 0.3;
      r.set(cx + dx, top + ry, edge ? PAL.spruce[0] : shade(PAL.spruce, v, cx + dx, top + ry, 0.5));
    }
  }
}

/** Lövträd eller björk: rund krona med ljus från nordväst. */
function drawLeafTree(r: Raster, x: number, y: number, cx: number, base: number, birch: boolean) {
  const cr = 12 + Math.floor(hash(x, y, 67) * 4);
  const ccy = base - 9 - cr;
  for (let ty = ccy + cr - 5; ty <= base; ty++) {
    for (let dx = -2; dx <= 1; dx++) {
      let c = PAL.bark[dx < 0 ? 3 : dx === 1 ? 1 : 2];
      if (birch) c = hash(cx + dx, ty, 68) < 0.18 ? PAL.bark[0] : PAL.birch[dx < 0 ? 3 : dx === 1 ? 1 : 2];
      r.set(cx + dx, ty, c);
    }
  }
  const lim = cr + 3;
  for (let dy = -lim; dy <= lim; dy++) {
    for (let dx = -lim; dx <= lim; dx++) {
      const px = cx + dx;
      const py = ccy + dy;
      const d = Math.sqrt(dx * dx + dy * dy * 1.15);
      const rEff = cr + (noise(px / 3.5, py / 3.5, 69 + x) - 0.5) * 6;
      if (d > rEff) continue;
      const edge = d > rEff - 1.2;
      const light = -(dx * 0.55 + dy * 0.75) / cr;
      let v = 0.48 + light * 0.35 + (noise(px / 2.2, py / 2.2, 70) - 0.5) * 0.45 + (birch ? 0.1 : 0);
      if (dy > cr * 0.5) v -= 0.12;
      r.set(px, py, edge ? PAL.leaf[0] : shade(PAL.leaf, v, px, py, 0.5));
    }
  }
}
