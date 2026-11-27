/**
 * Slängprov: murar, berg och dörrar som block med höjd, ritade i kod.
 * Ett block är en låda i rutkoordinater (x0..x1, y0..y1) och pixelhöjd (z0..z1).
 * Bara sidorna mot betraktaren ritas: översidan, sidan mot +y (snett ned vänster)
 * och sidan mot +x (snett ned höger). Ljuset kommer uppifrån vänster.
 */
import { canvas } from './ground';
import { hash, HH, HW, noise, TH, TW } from './geom';

/** Mönsterrutans bredd per ruta längs en vägg. */
const U = 32;

type Pattern = HTMLCanvasElement;
const patterns = new Map<string, Pattern>();

function stoneBricks(): Pattern {
  const c = canvas(64, 64);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#2b2830';
  ctx.fillRect(0, 0, 64, 64);
  const rowH = 11;
  for (let r = 0; r < 6; r++) {
    const off = r % 2 ? 9 : 0;
    for (let k = -1; k < 4; k++) {
      const x = k * 21 + off;
      const v = hash(k, r, 1);
      const base = 92 + v * 34;
      ctx.fillStyle = `rgb(${base + 6},${base},${base - 6})`;
      ctx.fillRect(x + 1, r * rowH + 1, 19, rowH - 2);
      // Lite struktur i stenen.
      for (let i = 0; i < 18; i++) {
        const px = x + 1 + hash(k * 7 + i, r, 2) * 19;
        const py = r * rowH + 1 + hash(k, r * 9 + i, 3) * (rowH - 2);
        ctx.fillStyle = hash(i, k + r, 4) > 0.5 ? 'rgba(255,245,225,0.10)' : 'rgba(0,0,0,0.14)';
        ctx.fillRect(px, py, 2, 1);
      }
      ctx.fillStyle = 'rgba(255,240,220,0.12)';
      ctx.fillRect(x + 1, r * rowH + 1, 19, 1);
    }
  }
  return c;
}

function rock(): Pattern {
  const c = canvas(64, 64);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(64, 64);
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const n = noise(x, y, 9, 4) * 0.55 + noise(x, y, 3, 5) * 0.3 + noise(x, y, 1.3, 6) * 0.15;
      const crack = Math.abs(noise(x, y * 0.6, 11, 7) - 0.5) < 0.025 ? -40 : 0;
      const v = 70 + n * 70 + crack;
      const i = (y * 64 + x) * 4;
      img.data[i] = v * 1.08;
      img.data[i + 1] = v * 0.98;
      img.data[i + 2] = v * 0.86;
      img.data[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  return c;
}

function planks(): Pattern {
  const c = canvas(64, 64);
  const ctx = c.getContext('2d')!;
  for (let k = 0; k < 8; k++) {
    const v = hash(k, 0, 8);
    ctx.fillStyle = `rgb(${96 + v * 30},${62 + v * 20},${34 + v * 12})`;
    ctx.fillRect(k * 8, 0, 7, 64);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(k * 8 + 7, 0, 1, 64);
  }
  return c;
}

function grassTop(): Pattern {
  const c = canvas(64, 64);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(64, 64);
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const n = noise(x, y, 4, 12) * 0.6 + noise(x, y, 1.5, 13) * 0.4;
      const i = (y * 64 + x) * 4;
      img.data[i] = 70 + n * 40;
      img.data[i + 1] = 100 + n * 50;
      img.data[i + 2] = 42 + n * 20;
      img.data[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  return c;
}

const MAKERS: Record<string, () => Pattern> = { stone: stoneBricks, rock, wood: planks, grass: grassTop };
function pattern(name: string): Pattern {
  let p = patterns.get(name);
  if (!p) patterns.set(name, (p = MAKERS[name]()));
  return p;
}

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  z0: number;
  z1: number;
  side: string;
  top: string;
  /** Vilka sidor som syns: mot +y (vänster) och mot +x (höger). */
  left?: boolean;
  right?: boolean;
  /** Översidans mörkning (0–1), till exempel för bergens mörka toppar. */
  topShade?: number;
}

/** Ritar en låda. (ox, oy) är skärmpunkten för rutkoordinat (0, 0) på marken. */
export function drawBox(ctx: CanvasRenderingContext2D, ox: number, oy: number, b: Box) {
  const sx = (x: number, y: number) => ox + (x - y) * HW;
  const sy = (x: number, y: number, z: number) => oy + (x + y) * HH - z;
  const k = 1 / U;
  const fill = (name: string, shade: number, w: number, h: number) => {
    ctx.fillStyle = ctx.createPattern(pattern(name), 'repeat')!;
    ctx.fillRect(0, 0, w, h);
    if (shade > 0) {
      ctx.fillStyle = `rgba(10,8,20,${shade})`;
      ctx.fillRect(0, 0, w, h);
    } else if (shade < 0) {
      ctx.fillStyle = `rgba(255,240,210,${-shade})`;
      ctx.fillRect(0, 0, w, h);
    }
  };
  const height = b.z1 - b.z0;
  ctx.save();
  if (b.left !== false) {
    // Sidan y = y1, längs x.
    ctx.setTransform(HW * k, HH * k, 0, 1, sx(b.x0, b.y1), sy(b.x0, b.y1, b.z1));
    fill(b.side, 0.12, (b.x1 - b.x0) * U, height);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, height - 3, (b.x1 - b.x0) * U, 3);
  }
  if (b.right !== false) {
    // Sidan x = x1, från det främre hörnet bakåt längs −y.
    ctx.setTransform(HW * k, -HH * k, 0, 1, sx(b.x1, b.y1), sy(b.x1, b.y1, b.z1));
    fill(b.side, 0.42, (b.y1 - b.y0) * U, height);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, height - 3, (b.y1 - b.y0) * U, 3);
  }
  // Översidan.
  ctx.setTransform(HW * k, HH * k, -HW * k, HH * k, sx(b.x0, b.y0), sy(b.x0, b.y0, b.z1));
  fill(b.top, b.topShade ?? -0.06, (b.x1 - b.x0) * U, (b.y1 - b.y0) * U);
  // Ljus kant mot betraktaren på översidan.
  ctx.fillStyle = 'rgba(255,240,210,0.18)';
  ctx.fillRect(0, (b.y1 - b.y0) * U - 1.5, (b.x1 - b.x0) * U, 1.5);
  ctx.restore();
}

/** En bild för en eller flera lådor på en ruta. Ursprunget (ox, oy) i bilden är rutans mittpunkt. */
export function blockImage(boxes: Box[], maxZ: number) {
  const c = canvas(TW + 4, TH + maxZ + 4);
  const ctx = c.getContext('2d')!;
  // Rutans mittpunkt ligger i (HW + 2, maxZ + HH + 2); rutkoordinat (0,0) är rutans mitt.
  const ox = HW + 2;
  const oy = maxZ + HH + 2;
  for (const b of boxes) drawBox(ctx, ox, oy, b);
  return { canvas: c, originX: ox / c.width, originY: oy / c.height };
}

export const WALL_H = 58;
