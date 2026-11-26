/**
 * Ikonerna för mötesplatserna på världskartan (Vidar): en by och en grotta. De ritas i rutstorlek
 * och läggs till bland figurerna.
 */
import { TILE } from './grid';
import { PAL } from './palette';
import { Raster, shade } from './pixel';

const S = TILE;

function house(r: Raster, x0: number, y0: number, w: number) {
  const roofH = Math.round(w * 0.55);
  for (let y = 0; y < roofH; y++) {
    const half = Math.round((w / 2 + 1) * (y / roofH));
    for (let x = -half; x <= half; x++) r.set(x0 + w / 2 + x, y0 + y, shade(PAL.wood, x < 0 ? 0.75 : 0.35, x0 + x, y0 + y));
  }
  for (let y = roofH; y < roofH + Math.round(w * 0.6); y++)
    for (let x = 0; x <= w; x++) r.set(x0 + x, y0 + y, shade(PAL.dirt, x < w / 2 ? 0.7 : 0.45, x0 + x, y0 + y));
  const doorX = x0 + Math.round(w / 2) - 1;
  for (let y = roofH + 3; y < roofH + Math.round(w * 0.6); y++) for (let x = 0; x < 3; x++) r.set(doorX + x, y0 + y, PAL.doorWood[0]);
}

function village(): HTMLCanvasElement {
  const r = new Raster(S, S);
  house(r, 2, 6, 13);
  house(r, 16, 2, 12);
  house(r, 14, 15, 11);
  return r.toCanvas();
}

function cave(): HTMLCanvasElement {
  const r = new Raster(S, S);
  for (let y = 4; y < 30; y++) {
    const half = Math.round(14 * Math.sqrt((y - 4) / 26));
    for (let x = 16 - half; x <= 16 + half; x++) r.set(x, y, shade(PAL.wallFace, x < 16 ? 0.7 : 0.35, x, y));
  }
  for (let y = 16; y < 30; y++) {
    const half = Math.round(6 * Math.sqrt((y - 16) / 14));
    for (let x = 16 - half; x <= 16 + half; x++) r.set(x, y, PAL.rockTop[0]);
  }
  return r.toCanvas();
}

export const PLACE_ICONS: Record<string, HTMLCanvasElement> = {
  ikon_by: village(),
  ikon_grotta: cave(),
};
