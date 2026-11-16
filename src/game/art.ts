/**
 * All grafik ritas i kod (pixelgrafik, 16×16) så att spelet inte beror på några
 * externa bildfiler. Vill man byta till ett färdigt tileset räcker det att ersätta
 * den här filen – resten av spelet refererar bara till texturnamn.
 */
import { seededRng } from '../engine/dice';

export const TILE = 16;
export const TILE_VARIANTS = 4;

export const TILE_TEXTURE: Record<string, string> = {
  '.': 'grass',
  ',': 'path',
  _: 'floor',
  ':': 'cave',
  '+': 'door',
  '#': 'wall',
  '%': 'rock',
  T: 'tree',
  '~': 'water',
};

type Ctx = CanvasRenderingContext2D;
const px = (c: Ctx, x: number, y: number, w: number, h: number, color: string) => {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
};

function canvas(draw: (c: Ctx) => void): HTMLCanvasElement {
  const el = document.createElement('canvas');
  el.width = TILE;
  el.height = TILE;
  draw(el.getContext('2d')!);
  return el;
}

function speckle(c: Ctx, seed: number, base: string, colors: string[], count: number) {
  const rng = seededRng(seed);
  px(c, 0, 0, TILE, TILE, base);
  for (let i = 0; i < count; i++) {
    px(c, Math.floor(rng() * TILE), Math.floor(rng() * TILE), 1, 1, colors[Math.floor(rng() * colors.length)]);
  }
}

const tileDrawers: Record<string, (c: Ctx, v: number) => void> = {
  grass: (c, v) => {
    speckle(c, 11 + v, '#4c7c3b', ['#5c8f47', '#40692f', '#568843'], 40);
    if (v === 3) {
      px(c, 5, 9, 1, 1, '#e8d96a');
      px(c, 11, 4, 1, 1, '#e9e3f0');
    }
  },
  path: (c, v) => speckle(c, 31 + v, '#a88c5e', ['#b99d6d', '#927a4f', '#b2966a'], 36),
  cave: (c, v) => speckle(c, 51 + v, '#5b5661', ['#6a6570', '#4d4953', '#625d69'], 30),
  floor: (c, v) => {
    px(c, 0, 0, TILE, TILE, '#8c6039');
    for (let y = 0; y < TILE; y += 4) {
      px(c, 0, y + 3, TILE, 1, '#6c4829');
      px(c, (y * 3 + v * 5) % TILE, y, 1, 3, '#6c4829');
      px(c, (y * 3 + v * 5 + 3) % TILE, y + 1, 2, 1, '#9a6c43');
    }
  },
  wall: (c, v) => {
    px(c, 0, 0, TILE, TILE, '#55525b');
    for (let row = 0; row < 4; row++) {
      const off = row % 2 ? 4 : 0;
      for (let x = -8; x < TILE; x += 8) {
        px(c, x + off + 1, row * 4 + 1, 7, 3, (row + x / 8 + v) % 3 === 0 ? '#8a878f' : '#7e7b83');
        px(c, x + off + 1, row * 4 + 1, 7, 1, '#96939b');
      }
    }
  },
  rock: (c, v) => {
    speckle(c, 71 + v, '#3a3740', ['#46424d', '#2f2c34'], 24);
    const rng = seededRng(91 + v);
    for (let i = 0; i < 3; i++) {
      const x = Math.floor(rng() * 11);
      const y = Math.floor(rng() * 11);
      px(c, x, y, 4, 3, '#48444f');
      px(c, x, y, 4, 1, '#56515e');
    }
  },
  tree: (c, v) => {
    tileDrawers.grass(c, v);
    px(c, 7, 10, 2, 5, '#5c3f25');
    px(c, 3, 3, 10, 8, '#2f5c2b');
    px(c, 4, 2, 8, 10, '#2f5c2b');
    px(c, 5, 1, 6, 1, '#2f5c2b');
    px(c, 5, 3, 4, 3, '#3f7636');
    px(c, 4 + v, 6, 2, 2, '#3f7636');
    px(c, 9, 8, 2, 2, '#244a22');
  },
  water: (c, v) => {
    px(c, 0, 0, TILE, TILE, '#2f6ea6');
    px(c, (2 + v * 3) % 12, 3, 4, 1, '#4b8dc6');
    px(c, (9 + v * 5) % 12, 8, 4, 1, '#4b8dc6');
    px(c, (4 + v * 7) % 12, 13, 3, 1, '#255d8f');
  },
  door: (c) => {
    tileDrawers.wall(c, 0);
    px(c, 3, 1, 10, 15, '#3d2a18');
    px(c, 4, 2, 8, 14, '#7c5230');
    px(c, 7, 2, 1, 14, '#62401f');
    px(c, 10, 9, 1, 2, '#d8b84a');
  },
};

interface Look {
  skin: string;
  hair?: string;
  helmet?: string;
  hood?: string;
  body: string;
  legs: string;
  robe?: boolean;
  apron?: string;
  ears?: boolean;
  eyes?: string;
  weapon?: 'sword' | 'spear' | 'dagger' | 'hammer' | 'club';
  shield?: string;
}

function humanoid(c: Ctx, k: Look) {
  px(c, 4, 14, 8, 2, 'rgba(0,0,0,0.28)');
  if (k.robe) {
    px(c, 4, 6, 8, 9, k.body);
    px(c, 3, 12, 10, 3, k.body);
  } else {
    px(c, 5, 11, 2, 4, k.legs);
    px(c, 9, 11, 2, 4, k.legs);
    px(c, 4, 6, 8, 6, k.body);
  }
  px(c, 3, 7, 1, 4, k.body);
  px(c, 12, 7, 1, 4, k.body);
  px(c, 3, 10, 1, 1, k.skin);
  px(c, 12, 10, 1, 1, k.skin);
  if (k.apron) px(c, 5, 7, 6, 6, k.apron);
  px(c, 4, 11, 8, 1, 'rgba(0,0,0,0.25)');
  px(c, 5, 1, 6, 5, k.skin);
  if (k.ears) {
    px(c, 4, 2, 1, 2, k.skin);
    px(c, 11, 2, 1, 2, k.skin);
    px(c, 3, 1, 1, 1, k.skin);
    px(c, 12, 1, 1, 1, k.skin);
  }
  if (k.hair) {
    px(c, 5, 0, 6, 2, k.hair);
    px(c, 4, 1, 1, 3, k.hair);
    px(c, 11, 1, 1, 3, k.hair);
  }
  if (k.hood) {
    px(c, 4, 0, 8, 2, k.hood);
    px(c, 4, 2, 1, 4, k.hood);
    px(c, 11, 2, 1, 4, k.hood);
  }
  if (k.helmet) {
    px(c, 4, 0, 8, 3, k.helmet);
    px(c, 7, 3, 2, 2, k.helmet);
    px(c, 5, 0, 6, 1, '#e4e7ee');
  }
  px(c, 6, 4, 1, 1, k.eyes ?? '#1d1a20');
  px(c, 9, 4, 1, 1, k.eyes ?? '#1d1a20');
  if (k.shield) {
    px(c, 0, 6, 4, 6, k.shield);
    px(c, 1, 12, 2, 1, k.shield);
    px(c, 1, 8, 2, 2, '#d8c68a');
  }
  switch (k.weapon) {
    case 'sword':
      px(c, 13, 2, 1, 8, '#dfe3ea');
      px(c, 12, 10, 3, 1, '#9a7a34');
      px(c, 13, 11, 1, 1, '#5c3f25');
      break;
    case 'dagger':
      px(c, 13, 7, 1, 3, '#dfe3ea');
      px(c, 13, 10, 1, 1, '#5c3f25');
      break;
    case 'spear':
      px(c, 13, 2, 1, 13, '#7c5b33');
      px(c, 13, 0, 1, 3, '#dfe3ea');
      break;
    case 'hammer':
      px(c, 13, 5, 1, 7, '#7c5b33');
      px(c, 12, 4, 3, 2, '#6b6870');
      break;
    case 'club':
      px(c, 13, 5, 1, 6, '#7c5b33');
      px(c, 12, 4, 3, 3, '#6b4a2a');
      break;
  }
}

const sprites: Record<string, (c: Ctx) => void> = {
  krigare: (c) =>
    humanoid(c, { skin: '#e2b48c', helmet: '#aab0bb', body: '#9c3a32', legs: '#4a3b30', weapon: 'sword', shield: '#35557f' }),
  jagare: (c) => humanoid(c, { skin: '#e2b48c', hood: '#3f6b33', body: '#55733a', legs: '#5c4630', weapon: 'spear' }),
  tjuv: (c) => humanoid(c, { skin: '#e2b48c', hood: '#33303b', body: '#4a4556', legs: '#2b2831', weapon: 'dagger' }),
  vard: (c) => humanoid(c, { skin: '#eab99a', hair: '#8a5a2e', body: '#a8703c', legs: '#4a3b30', apron: '#e9e2d0' }),
  smed: (c) =>
    humanoid(c, { skin: '#d9a57e', hair: '#c9552c', body: '#6f7480', legs: '#3b3530', apron: '#5c3f25', weapon: 'hammer' }),
  gumma: (c) => humanoid(c, { skin: '#e6c3a8', hair: '#d8d8de', body: '#6a4a86', legs: '#6a4a86', robe: true }),
  svartalf: (c) =>
    humanoid(c, { skin: '#6f9a4a', ears: true, eyes: '#e0402a', body: '#3b3530', legs: '#2a2622', weapon: 'sword' }),
  hovding: (c) =>
    humanoid(c, {
      skin: '#5f8a3e',
      ears: true,
      eyes: '#ffb020',
      helmet: '#5a5560',
      body: '#6b2a26',
      legs: '#2a2622',
      weapon: 'sword',
      shield: '#4a2f1c',
    }),
  varg: (c) => {
    px(c, 2, 14, 12, 2, 'rgba(0,0,0,0.28)');
    px(c, 2, 7, 10, 5, '#77747c');
    px(c, 2, 7, 10, 2, '#8d8a93');
    px(c, 0, 6, 3, 2, '#77747c');
    px(c, 10, 4, 5, 5, '#8d8a93');
    px(c, 13, 7, 3, 2, '#77747c');
    px(c, 10, 3, 1, 2, '#5d5a62');
    px(c, 13, 3, 1, 2, '#5d5a62');
    px(c, 13, 5, 1, 1, '#f0c020');
    px(c, 15, 7, 1, 1, '#1d1a20');
    for (const x of [3, 5, 9, 11]) px(c, x, 12, 1, 3, '#5d5a62');
  },
};

export const TEXTURES: Record<string, HTMLCanvasElement> = {};

for (const [name, draw] of Object.entries(tileDrawers)) {
  for (let v = 0; v < TILE_VARIANTS; v++) TEXTURES[`${name}_${v}`] = canvas((c) => draw(c, v));
}
for (const [name, draw] of Object.entries(sprites)) TEXTURES[name] = canvas(draw);

/** Texturnamn för en kartruta; varianten väljs utifrån positionen så att marken inte ser upprepad ut. */
export function tileTexture(ch: string, x: number, y: number): string {
  const v = ((x * 73856093) ^ (y * 19349663)) >>> 0;
  return `${TILE_TEXTURE[ch]}_${v % TILE_VARIANTS}`;
}

/** Förstorat porträtt (huvud och axlar) som bild-URL för gränssnittet. */
export function portraitUrl(sprite: string): string {
  const el = document.createElement('canvas');
  el.width = 96;
  el.height = 96;
  const c = el.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  c.fillStyle = '#2a2530';
  c.fillRect(0, 0, 96, 96);
  c.drawImage(TEXTURES[sprite], 2, 0, 12, 12, 0, 0, 96, 96);
  return el.toDataURL();
}
