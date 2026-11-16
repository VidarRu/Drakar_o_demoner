/**
 * Marken ritas som en enda stor bild per karta. Varje pixel räknas fram ur
 * kartan, så underlagen får mjuka, oregelbundna övergångar i stället för raka
 * rutkanter, och väggar och träd kan kasta skugga.
 */
import type { GameMap } from '../../engine/map';
import { charAt, isBlocker, TILE as T } from './grid';
import { PAL } from './palette';
import { clamp, distanceField, fbm, hash, noise, Raster, shade, type RGB } from './pixel';

const enum G {
  Grass,
  Dirt,
  Wood,
  Cave,
  Water,
  Forest,
}

const BASE: Record<string, G> = { '.': G.Grass, ',': G.Dirt, _: G.Wood, ':': G.Cave, '~': G.Water, T: G.Forest };
const UNSET = 255;

/** Underlag per ruta. Väggar och berg får underlaget från närmaste gångbara ruta. */
function groundGrid(map: GameMap): Uint8Array {
  const g = new Uint8Array(map.w * map.h).fill(UNSET);
  const queue: number[] = [];
  for (let y = 0; y < map.h; y++) {
    for (let x = 0; x < map.w; x++) {
      const ch = charAt(map, x, y);
      let v = BASE[ch];
      if (ch === 'T') {
        // Skogsbotten bara där träden står tätt; ensamma träd står på gräs.
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (charAt(map, x + dx, y + dy) === 'T') n++;
        if (n < 4) v = G.Grass;
      }
      if (ch === '+') {
        const nb = [charAt(map, x - 1, y), charAt(map, x + 1, y), charAt(map, x, y - 1), charAt(map, x, y + 1)];
        if (nb.includes('_')) v = G.Wood;
      }
      if (v !== undefined) {
        g[y * map.w + x] = v;
        queue.push(y * map.w + x);
      }
    }
  }
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head];
    const x = i % map.w;
    const y = (i / map.w) | 0;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h) continue;
      const j = ny * map.w + nx;
      if (g[j] === UNSET) {
        g[j] = g[i];
        queue.push(j);
      }
    }
  }
  return g;
}

export function bakeGround(map: GameMap): HTMLCanvasElement {
  const W = map.w * T;
  const H = map.h * T;
  const gg = groundGrid(map);
  const cell = (px: number, py: number) => {
    const cx = Math.min(map.w - 1, Math.max(0, Math.floor(px / T)));
    const cy = Math.min(map.h - 1, Math.max(0, Math.floor(py / T)));
    return gg[cy * map.w + cx];
  };

  // 1. Underlag per pixel, med förskjutna gränser så att kanterna blir naturliga.
  //    Trägolv har raka kanter – det är byggt.
  const terr = new Uint8Array(W * H);
  const water = new Uint8Array(W * H);
  const land = new Uint8Array(W * H);
  const blocker = new Uint8Array(W * H);
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const i = py * W + px;
      let g = cell(px, py);
      if (g !== G.Wood) {
        const ox = (fbm(px / 20, py / 20, 11, 2) - 0.5) * 22;
        const oy = (fbm(px / 20, py / 20, 23, 2) - 0.5) * 22;
        const g2 = cell(px + ox, py + oy);
        if (g2 !== G.Wood) g = g2;
      }
      terr[i] = g;
      water[i] = g === G.Water ? 1 : 0;
      land[i] = 1 - water[i];
      blocker[i] = isBlocker(charAt(map, (px / T) | 0, (py / T) | 0)) ? 1 : 0;
    }
  }
  const toWater = distanceField(water, W, H);
  const toLand = distanceField(land, W, H);
  const toBlocker = distanceField(blocker, W, H);

  // 2. Skuggor: kontaktskugga vid väggar, slagskugga söderut och trädens skuggor.
  const sh = new Float32Array(W * H);
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const i = py * W + px;
      let s = clamp(1 - toBlocker[i] / 7) * 0.22;
      if (isBlocker(charAt(map, (px / T) | 0, ((py / T) | 0) - 1))) s += clamp(1 - (py % T) / 12) * 0.25;
      sh[i] = s;
    }
  }
  for (let cy = 0; cy < map.h; cy++) {
    for (let cx = 0; cx < map.w; cx++) {
      if (charAt(map, cx, cy) !== 'T') continue;
      const ex = cx * T + T / 2 + 5;
      const ey = cy * T + T - 6;
      for (let y = ey - 7; y <= ey + 7; y++) {
        for (let x = ex - 17; x <= ex + 17; x++) {
          if (x < 0 || y < 0 || x >= W || y >= H) continue;
          const q = ((x - ex) / 16) ** 2 + ((y - ey) / 6.5) ** 2;
          if (q < 1) sh[y * W + x] += 0.32 * (1 - q * q);
        }
      }
    }
  }

  // 3. Material.
  const out = new Raster(W, H);
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const i = py * W + px;
      const s = sh[i];
      let c: RGB;
      switch (terr[i]) {
        case G.Forest: {
          // Skogsbotten: mossa och barr.
          const v = 0.32 + (fbm(px / 16, py / 16, 25, 2) - 0.5) * 0.5 + (noise(px / 2.5, py / 2.5, 26) - 0.5) * 0.25 - s;
          c = shade(PAL.grass, v, px, py);
          if (hash(px, py, 27) < 0.06) c = PAL.dirt[2 + Math.floor(hash(px, py, 28) * 2)];
          break;
        }
        case G.Grass: {
          if (toWater[i] < 2.5) {
            c = shade(PAL.mud, 0.55 + (hash(px, py, 3) - 0.5) * 0.5 - s, px, py);
            break;
          }
          const v =
            0.54 +
            (fbm(px / 56, py / 56, 3, 3) - 0.5) * 0.8 +
            (noise(px / 5, py / 5, 4) - 0.5) * 0.2 +
            (hash(px, py, 5) - 0.5) * 0.08 -
            s * 1.4;
          c = shade(PAL.grass, v, px, py, 0.45);
          break;
        }
        case G.Dirt: {
          const v =
            0.56 +
            (fbm(px / 30, py / 30, 7, 2) - 0.5) * 0.5 +
            (noise(px / 3, py / 3, 8) - 0.5) * 0.3 +
            (hash(px, py, 9) - 0.5) * 0.2 -
            s * 1.4;
          c = shade(PAL.dirt, v, px, py);
          break;
        }
        case G.Cave: {
          let v =
            0.6 +
            (fbm(px / 40, py / 40, 12, 2) - 0.5) * 0.5 +
            (noise(px / 5, py / 5, 14) - 0.5) * 0.25 +
            (hash(px, py, 15) - 0.5) * 0.1 -
            s * 1.6;
          if (Math.abs(fbm(px / 22, py / 22, 13, 2) - 0.5) < 0.012) v -= 0.3;
          c = shade(PAL.cave, v, px, py);
          break;
        }
        case G.Wood:
          c = plank(px, py, s);
          break;
        default: {
          const d = toLand[i];
          if (d < 1.5) {
            c = PAL.foam;
            break;
          }
          const v = 0.78 - (Math.min(d, 14) / 14) * 0.6 + (fbm(px / 20, py / 20, 17, 2) - 0.5) * 0.3 - s * 0.6;
          const glint = d > 3 && py % 3 === 0 && noise(px / 7, py / 3, 19) > 0.83;
          c = glint ? PAL.sparkle : shade(PAL.water, v, px, py, 0.4);
        }
      }
      out.set(px, py, c);
    }
  }

  // 4. Småsaker: grästuvor, blommor, vass vid vattnet och stenar på stigar och grottgolv.
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < W && y < H ? terr[y * W + x] : UNSET);
  const quiet = (x: number, y: number) => toBlocker[y * W + x] > 3 && sh[y * W + x] < 0.2;
  for (let gy = 0; gy < H; gy += 6) {
    for (let gx = 0; gx < W; gx += 6) {
      const r = hash(gx, gy, 31);
      const x = gx + Math.floor(hash(gx, gy, 32) * 6);
      const y = gy + Math.floor(hash(gx, gy, 33) * 6);
      if (x < 1 || y < 2 || x >= W - 1 || y >= H) continue;
      const t = at(x, y);
      const i = y * W + x;
      if (t === G.Grass && toWater[i] >= 2.5 && toWater[i] < 6 && r < 0.45) {
        // vass
        const hgt = 3 + Math.floor(hash(x, y, 34) * 3);
        for (let k = 0; k < hgt; k++) out.set(x, y - k, k === hgt - 1 ? PAL.dirt[5] : PAL.grass[3 + (k & 1)]);
      } else if (t === G.Grass && toWater[i] >= 6 && quiet(x, y)) {
        if (r < 0.3) {
          out.set(x - 1, y - 2, PAL.grass[6]);
          out.set(x + 1, y - 2, PAL.grass[5]);
          out.set(x, y - 1, PAL.grass[5]);
          out.set(x - 1, y, PAL.grass[1]);
          out.set(x, y, PAL.grass[1]);
          out.set(x + 1, y, PAL.grass[1]);
        } else if (r < 0.335) {
          const flower = [rgb3(232, 214, 106), rgb3(226, 222, 236), rgb3(170, 120, 200)][Math.floor(hash(x, y, 35) * 3)];
          out.set(x, y - 1, flower);
          out.set(x, y, PAL.grass[1]);
        }
      } else if ((t === G.Dirt || t === G.Cave) && r < 0.22) {
        const p = t === G.Dirt ? PAL.dirt : PAL.cave;
        out.set(x, y - 1, p[5]);
        out.set(x + 1, y - 1, p[4]);
        out.set(x, y, p[1]);
        out.set(x + 1, y, p[1]);
      }
    }
  }
  return out.toCanvas();
}

const rgb3 = (r: number, g: number, b: number): RGB => [r, g, b];

/** Trägolv: plankor 8 px breda, skarvar på olika ställen i varje rad. */
function plank(px: number, py: number, s: number): RGB {
  const row = Math.floor(py / 8);
  const yIn = py % 8;
  const len = 72;
  const off = Math.floor(hash(row, 0, 41) * len);
  const seg = Math.floor((px + off) / len);
  const xIn = (px + off) % len;
  if (yIn === 7 || xIn === 0) return PAL.wood[0];
  let v = 0.25 + hash(row, seg, 42) * 0.4;
  v += (noise(px / 11, py / 1.3, 43) - 0.5) * 0.3;
  if (yIn === 0) v += 0.15;
  if (yIn === 6) v -= 0.1;
  if ((xIn === 3 || xIn === len - 3) && (yIn === 2 || yIn === 5)) v = 0;
  return shade(PAL.wood, v - s * 1.4, px, py, 0.4);
}
