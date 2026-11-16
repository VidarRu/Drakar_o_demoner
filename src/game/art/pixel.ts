/**
 * Grundverktyg för den kodritade pixelgrafiken: en pixelyta att rita i,
 * deterministiskt brus och färgskalor ("ramper") med ordnad dithering.
 */

export type RGB = readonly [number, number, number];
export type Ramp = readonly RGB[];

export function rgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const ramp = (...hex: string[]): Ramp => hex.map(rgb);

export const clamp = (v: number, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);

/** Ett rutnät av RGBA-pixlar som kan bli en canvas. */
export class Raster {
  readonly data: Uint8ClampedArray<ArrayBuffer>;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.data = new Uint8ClampedArray(w * h * 4);
  }

  inside(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  set(x: number, y: number, c: RGB, a = 255) {
    if (!this.inside(x, y)) return;
    const i = (y * this.w + x) * 4;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
    this.data[i + 3] = a;
  }

  /** Lägger en halvgenomskinlig färg ovanpå det som redan finns. */
  blend(x: number, y: number, c: RGB, alpha: number) {
    if (!this.inside(x, y)) return;
    const i = (y * this.w + x) * 4;
    const d = this.data;
    if (d[i + 3] === 0) {
      this.set(x, y, c, Math.round(alpha * 255));
      return;
    }
    d[i] += (c[0] - d[i]) * alpha;
    d[i + 1] += (c[1] - d[i + 1]) * alpha;
    d[i + 2] += (c[2] - d[i + 2]) * alpha;
    d[i + 3] = Math.max(d[i + 3], Math.round(alpha * 255));
  }

  alpha(x: number, y: number) {
    return this.inside(x, y) ? this.data[(y * this.w + x) * 4 + 3] : 0;
  }

  toCanvas(): HTMLCanvasElement {
    const el = document.createElement('canvas');
    el.width = this.w;
    el.height = this.h;
    el.getContext('2d')!.putImageData(new ImageData(this.data, this.w, this.h), 0, 0);
    return el;
  }
}

/** Heltalshash till [0, 1). Samma indata ger alltid samma värde. */
export function hash(x: number, y: number, seed = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Mjukt värdebrus i [0, 1]. */
export function noise(x: number, y: number, seed = 0): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, seed);
  const b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed);
  const d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Brus i flera skalor ("fraktalt"), i [0, 1]. */
export function fbm(x: number, y: number, seed = 0, octaves = 3): number {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += noise(x, y, seed + o * 101) * amp;
    norm += amp;
    amp *= 0.5;
    x *= 2.03;
    y *= 2.03;
  }
  return sum / norm;
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** Ordnad dithering, i [-0.5, 0.5). */
export const bayer = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5;

/** Väljer en färg ur en ramp utifrån ett värde i [0, 1], med dithering för retrokänsla. */
export function shade(r: Ramp, v: number, x: number, y: number, dither = 0.6): RGB {
  const n = r.length;
  const i = Math.floor(v * n + bayer(x, y) * dither);
  return r[i < 0 ? 0 : i >= n ? n - 1 : i];
}

/**
 * Avståndsfält (i pixlar) från varje punkt till närmaste punkt där `mask` är satt.
 * Tvåpassmetod med diagonalvikt; tillräckligt noggrant för skuggor och strandkanter.
 */
export function distanceField(mask: Uint8Array, w: number, h: number): Float32Array {
  const INF = 1e6;
  const d = new Float32Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = mask[i] ? 0 : INF;
  const D = Math.SQRT2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + 1);
      if (y > 0) {
        v = Math.min(v, d[i - w] + 1);
        if (x > 0) v = Math.min(v, d[i - w - 1] + D);
        if (x < w - 1) v = Math.min(v, d[i - w + 1] + D);
      }
      d[i] = v;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      let v = d[i];
      if (x < w - 1) v = Math.min(v, d[i + 1] + 1);
      if (y < h - 1) {
        v = Math.min(v, d[i + w] + 1);
        if (x < w - 1) v = Math.min(v, d[i + w + 1] + D);
        if (x > 0) v = Math.min(v, d[i + w - 1] + D);
      }
      d[i] = v;
    }
  }
  return d;
}
