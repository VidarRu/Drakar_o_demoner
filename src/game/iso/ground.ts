/**
 * Slängprov: marken i den snedställda vyn, bakad till en enda bild.
 * Gräs, grottgolv och trägolv är Flares rutor. Vägar, vatten och stränder läggs ovanpå
 * genom masker med mjuka, brusiga kanter, så att de flyter fritt över rutnätet.
 */
import type { GameMap } from '../../engine/map';
import { hash, HH, HW, noise, toScreen, worldSize } from './geom';

export interface AtlasFrame {
  frame: { x: number; y: number; w: number; h: number };
  pivotPx: { x: number; y: number };
}
export type Atlas = Record<string, AtlasFrame>;

/** Maskerna räknas i en fjärdedels upplösning och förstoras mjukt. */
const MS = 4;

const ch = (map: GameMap, x: number, y: number) =>
  x >= 0 && y >= 0 && x < map.w && y < map.h ? map.tiles[y * map.w + x] : '';

export function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w);
  c.height = Math.ceil(h);
  return c;
}

export function drawFrame(ctx: CanvasRenderingContext2D, img: CanvasImageSource, atlas: Atlas, name: string, cx: number, cy: number, scale = 1) {
  const f = atlas[name];
  if (!f) return;
  const { x, y, w, h } = f.frame;
  ctx.drawImage(img, x, y, w, h, cx - f.pivotPx.x * scale, cy - f.pivotPx.y * scale, w * scale, h * scale);
}

function diamond(ctx: CanvasRenderingContext2D, cx: number, cy: number, hw: number, hh: number) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - hh);
  ctx.lineTo(cx + hw, cy);
  ctx.lineTo(cx, cy + hh);
  ctx.lineTo(cx - hw, cy);
  ctx.closePath();
  ctx.fill();
}

/**
 * En mask för rutorna där `pick` är sant: romber, oskärpa, brus och en mjuk tröskel.
 * Ger masken och ett smalt band längs kanten (för skum och strandkant).
 */
function softMask(map: GameMap, pick: (c: string) => boolean, grow: number, threshold: number, roughness: number, seed: number) {
  const { w, h } = worldSize(map);
  const sw = Math.ceil(w / MS);
  const sh = Math.ceil(h / MS);
  const raw = canvas(sw, sh);
  const rc = raw.getContext('2d')!;
  rc.fillStyle = '#fff';
  for (let y = 0; y < map.h; y++)
    for (let x = 0; x < map.w; x++) {
      if (!pick(ch(map, x, y))) continue;
      const p = toScreen(map, x, y);
      diamond(rc, p.x / MS, p.y / MS, (HW / MS) * grow, (HH / MS) * grow);
    }
  const blurred = canvas(sw, sh);
  const bc = blurred.getContext('2d')!;
  bc.filter = `blur(${(HW / MS) * 0.45}px)`;
  bc.drawImage(raw, 0, 0);
  const src = bc.getImageData(0, 0, sw, sh);
  const mask = canvas(sw, sh);
  const edge = canvas(sw, sh);
  const mctx = mask.getContext('2d')!;
  const ectx = edge.getContext('2d')!;
  const md = mctx.createImageData(sw, sh);
  const ed = ectx.createImageData(sw, sh);
  for (let y = 0; y < sh; y++)
    for (let x = 0; x < sw; x++) {
      const i = (y * sw + x) * 4;
      const n = noise(x, y, 7, seed) * 0.65 + noise(x, y, 2.5, seed + 1) * 0.35 - 0.5;
      const v = src.data[i + 3] / 255 + n * roughness;
      const a = Math.min(1, Math.max(0, (v - threshold) / 0.06 + 0.5));
      md.data[i] = md.data[i + 1] = md.data[i + 2] = 255;
      md.data[i + 3] = a * 255;
      const band = Math.max(0, 1 - Math.abs(v - threshold) / 0.05);
      ed.data[i] = ed.data[i + 1] = ed.data[i + 2] = 255;
      ed.data[i + 3] = band * 255;
    }
  mctx.putImageData(md, 0, 0);
  ectx.putImageData(ed, 0, 0);
  return { mask, edge };
}

/** Lägger `layer` på `ctx` genom masken (förstorad mjukt till full storlek). */
function through(ctx: CanvasRenderingContext2D, layer: HTMLCanvasElement, mask: HTMLCanvasElement) {
  const lc = layer.getContext('2d')!;
  lc.globalCompositeOperation = 'destination-in';
  lc.imageSmoothingQuality = 'high';
  lc.drawImage(mask, 0, 0, layer.width, layer.height);
  lc.globalCompositeOperation = 'source-over';
  ctx.drawImage(layer, 0, 0);
}

/** Ett lager fyllt med en av Flares rutsorter över hela kartan. */
function tiledLayer(map: GameMap, img: CanvasImageSource, atlas: Atlas, prefix: string, count: number, filter = 'none') {
  const { w, h } = worldSize(map);
  const c = canvas(w, h);
  const ctx = c.getContext('2d')!;
  for (let y = 0; y < map.h; y++)
    for (let x = 0; x < map.w; x++) {
      const p = toScreen(map, x, y);
      const n = count === 16 ? ((x % 4) + 4) % 4 + (((y % 4) + 4) % 4) * 4 : Math.floor(hash(x, y, 3) * count);
      drawFrame(ctx, img, atlas, `${prefix}${n}`, p.x, p.y, 1.02);
    }
  if (filter === 'none') return c;
  // Färgfiltret en gång för hela lagret.
  const f = canvas(w, h);
  const fc = f.getContext('2d')!;
  fc.filter = filter;
  fc.drawImage(c, 0, 0);
  return f;
}

const GRASSY = new Set(['.', ',', 'T', 'f', 'F', 'h', 'M', '=', 'v', '~']);
const CAVE = new Set([':', '%']);

export function bakeIsoGround(map: GameMap, img: CanvasImageSource, atlas: Atlas): HTMLCanvasElement {
  const { w, h } = worldSize(map);
  const out = canvas(w, h);
  const ctx = out.getContext('2d')!;
  ctx.fillStyle = '#08070a';
  ctx.fillRect(0, 0, w, h);

  // Grunden: Flares gräs, något grönare och ljusare än originalet.
  const grass = tiledLayer(map, img, atlas, 'grass', 16, 'hue-rotate(14deg) saturate(1.25) brightness(1.12)');
  const isWood = (x: number, y: number) => {
    const c = ch(map, x, y);
    if (c === '_') return true;
    if (c !== '+' && c !== '#') return false;
    return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => ch(map, x + dx, y + dy) === '_');
  };
  ctx.drawImage(grass, 0, 0);
  // Grottgolvet och trägolvet: rutor för sig, utan mjuka kanter (de ligger innanför murar och berg).
  for (let y = 0; y < map.h; y++)
    for (let x = 0; x < map.w; x++) {
      const c = ch(map, x, y);
      const p = toScreen(map, x, y);
      if (CAVE.has(c)) drawFrame(ctx, img, atlas, `cave${Math.floor(hash(x, y, 5) * 16)}`, p.x, p.y, 1.02);
      else if (isWood(x, y)) drawFrame(ctx, img, atlas, `wood${4 + Math.floor(hash(x, y, 6) * 4)}`, p.x, p.y, 1.0);
      else if (!GRASSY.has(c) && c !== '+' && c !== '#') drawFrame(ctx, img, atlas, `stone${Math.floor(hash(x, y, 7) * 4)}`, p.x, p.y, 1.02);
    }

  // Stigar: brun jord med brusiga kanter.
  const path = softMask(map, (c) => c === ',', 1.05, 0.5, 0.55, 11);
  const dirt = tiledLayer(map, img, atlas, 'cave', 16, 'sepia(0.35) brightness(1.45) saturate(1.1)');
  through(ctx, dirt, path.mask);

  // Vatten: först en mörk, fuktig strand, sedan vattnet, en skugga längs kanten och lite skum.
  const water = (c: string) => c === '~' || c === 'v' || c === '=';
  const bank = softMask(map, water, 1.35, 0.32, 0.5, 21);
  const mud = tiledLayer(map, img, atlas, 'cave', 16, 'brightness(0.8) saturate(0.8)');
  through(ctx, mud, bank.mask);
  const wet = softMask(map, water, 1.1, 0.5, 0.45, 22);
  const sea = tiledLayer(map, img, atlas, 'water', 16, 'brightness(1.7) saturate(0.9)');
  const sc = sea.getContext('2d')!;
  sc.globalCompositeOperation = 'soft-light';
  sc.fillStyle = '#2f5f86';
  sc.fillRect(0, 0, w, h);
  sc.globalCompositeOperation = 'source-over';
  // Djupare mitt i vattnet: en mörk ton som tonar ut mot stranden.
  const deep = canvas(wet.mask.width, wet.mask.height);
  const dc = deep.getContext('2d')!;
  dc.filter = `blur(${(HW * 0.6) / MS}px)`;
  dc.drawImage(wet.mask, 0, 0);
  dc.filter = 'none';
  dc.globalCompositeOperation = 'source-in';
  dc.fillStyle = 'rgba(8, 30, 52, 0.55)';
  dc.fillRect(0, 0, deep.width, deep.height);
  sc.imageSmoothingQuality = 'high';
  sc.drawImage(deep, 0, 0, w, h);
  through(ctx, sea, wet.mask);
  const foam = canvas(w, h);
  const fc = foam.getContext('2d')!;
  fc.imageSmoothingQuality = 'high';
  fc.drawImage(wet.edge, 0, 0, w, h);
  fc.globalCompositeOperation = 'source-in';
  fc.fillStyle = 'rgba(200, 225, 220, 0.45)';
  fc.fillRect(0, 0, w, h);
  ctx.drawImage(foam, 0, 0);

  // Kullar: ljusare mot nordväst och mörkare mot sydöst, som en mjuk upphöjning.
  const hills = softMask(map, (c) => c === 'h', 1.2, 0.45, 0.6, 31);
  const hillShade = canvas(w, h);
  const hc = hillShade.getContext('2d')!;
  hc.imageSmoothingQuality = 'high';
  hc.drawImage(hills.mask, -HW * 0.35, -HH * 0.35, w, h);
  hc.globalCompositeOperation = 'source-in';
  hc.fillStyle = 'rgba(255, 236, 180, 0.07)';
  hc.fillRect(0, 0, w, h);
  hc.globalCompositeOperation = 'source-over';
  const shadow = canvas(w, h);
  const shc = shadow.getContext('2d')!;
  shc.imageSmoothingQuality = 'high';
  shc.drawImage(hills.mask, HW * 0.3, HH * 0.3, w, h);
  shc.globalCompositeOperation = 'destination-out';
  shc.drawImage(hills.mask, -HW * 0.1, -HH * 0.1, w, h);
  shc.globalCompositeOperation = 'source-in';
  shc.fillStyle = 'rgba(10, 20, 10, 0.3)';
  shc.fillRect(0, 0, w, h);
  ctx.drawImage(shadow, 0, 0);
  ctx.drawImage(hillShade, 0, 0);

  // Småsaker på marken: tuvor, blommor och vass vid vattnet.
  for (let y = 0; y < map.h; y++)
    for (let x = 0; x < map.w; x++) {
      const c = ch(map, x, y);
      const p = toScreen(map, x, y);
      const r = hash(x, y, 9);
      const jx = (hash(x, y, 10) - 0.5) * HW * 0.8;
      const jy = (hash(x, y, 12) - 0.5) * HH * 0.8;
      const nearWater = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => ch(map, x + dx, y + dy) === '~');
      if (c === '.' && nearWater && r < 0.6) drawFrame(ctx, img, atlas, `reed${Math.floor(r * 4) % 2}`, p.x + jx, p.y + jy, 0.8);
      else if (c === '.' && r < 0.09) drawFrame(ctx, img, atlas, `tuft${Math.floor(r * 44)}`, p.x + jx, p.y + jy, 0.7);
      else if (c === '.' && r < 0.12) drawFrame(ctx, img, atlas, `flower${Math.floor(r * 100) % 2}`, p.x + jx, p.y + jy, 0.6);
      else if (c === ':' && r < 0.08) drawFrame(ctx, img, atlas, `bones${Math.floor(r * 25)}`, p.x + jx, p.y + jy, 0.8);
      else if (c === '=') drawFrame(ctx, img, atlas, `plank${Math.floor(r * 4)}`, p.x, p.y, 1);
      else if (c === 'v') drawFrame(ctx, img, atlas, `rock${Math.floor(r * 4)}`, p.x + jx, p.y + jy, 0.45);
    }
  return out;
}

/** Grottmörker per ruta (1 i grottan, 0 i dagsljus). */
export function isoCave(map: GameMap): Float32Array {
  const out = new Float32Array(map.w * map.h);
  for (let i = 0; i < out.length; i++) out[i] = map.tiles[i] === ':' || map.tiles[i] === '%' ? 1 : 0;
  return out;
}

export { MS as MASK_SCALE, diamond };
