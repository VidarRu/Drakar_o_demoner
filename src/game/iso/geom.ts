/**
 * Slängprov: den snedställda vyn. Rutnätet är detsamma som i motorn, men varje ruta
 * ritas som en romb. Motorns x växer snett nedåt höger och y snett nedåt vänster.
 */
import type { GameMap } from '../../engine/map';

export const TW = 96;
export const TH = 48;
export const HW = TW / 2;
export const HH = TH / 2;
/** Utrymme ovanför kartan för träd och murar på de översta raderna. */
export const TOP = 220;
export const PAD = 64;

export function worldSize(map: GameMap) {
  return { w: (map.w + map.h) * HW + 2 * PAD, h: (map.w + map.h) * HH + TOP + PAD };
}

/** Rutans mittpunkt i världspixlar. */
export function toScreen(map: GameMap, x: number, y: number) {
  return { x: (x - y) * HW + map.h * HW + PAD, y: (x + y) * HH + TOP };
}

/** Rutan under en punkt i världspixlar. */
export function toTile(map: GameMap, wx: number, wy: number) {
  const rx = (wx - map.h * HW - PAD) / HW;
  const ry = (wy - TOP) / HH;
  return { x: Math.round((ry + rx) / 2), y: Math.round((ry - rx) / 2) };
}

/** Djup: allt på samma diagonal (x + y) ritas tillsammans, figurer framför föremål. */
export const isoDepth = (x: number, y: number, layer = 0) => 100 + (x + y) * 10 + layer;

/** Riktning i Flares ordning (0 = sydväst på skärmen, 7 = söder) för ett steg i rutnätet. */
export function facing(dx: number, dy: number): number {
  const sx = dx - dy;
  const sy = dx + dy;
  if (sx === 0 && sy === 0) return 7;
  const ang = Math.atan2(sy, sx); // 0 = öster, π/2 = söder
  const sector = Math.round(ang / (Math.PI / 4));
  // sektor: 0 Ö, 1 SÖ, 2 S, 3 SV, ±4 V, -1 NÖ, -2 N, -3 NV
  const map: Record<number, number> = { 0: 5, 1: 6, 2: 7, 3: 0, 4: 1, [-4]: 1, [-3]: 2, [-2]: 3, [-1]: 4 };
  return map[sector];
}

/** Ett enkelt, deterministiskt brus (0–1) per heltalspunkt. */
export function hash(x: number, y: number, seed = 0) {
  let h = (x * 374761393 + y * 668265263 + seed * 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Mjukt värdebrus (0–1). */
export function noise(x: number, y: number, scale: number, seed = 0) {
  const fx = x / scale;
  const fy = y / scale;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const tx = fx - ix;
  const ty = fy - iy;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const a = hash(ix, iy, seed);
  const b = hash(ix + 1, iy, seed);
  const c = hash(ix, iy + 1, seed);
  const d = hash(ix + 1, iy + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
