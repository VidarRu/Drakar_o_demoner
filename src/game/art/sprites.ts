/**
 * Figurerna. De ritas i 16×16 och förstoras till rutstorleken. (Ritas om i
 * högre upplösning i ett senare steg.)
 */
import { TILE } from './grid';

const SRC = 16;
type Ctx = CanvasRenderingContext2D;
const px = (c: Ctx, x: number, y: number, w: number, h: number, color: string) => {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
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

function canvas(size: number, draw: (c: Ctx) => void): HTMLCanvasElement {
  const el = document.createElement('canvas');
  el.width = size;
  el.height = size;
  const c = el.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  draw(c);
  return el;
}

/** Figurerna i originalstorlek (används för porträtt). */
const SOURCE: Record<string, HTMLCanvasElement> = {};
/** Figurerna i rutstorlek. */
export const SPRITES: Record<string, HTMLCanvasElement> = {};

for (const [name, draw] of Object.entries(sprites)) {
  SOURCE[name] = canvas(SRC, draw);
  SPRITES[name] = canvas(TILE, (c) => c.drawImage(SOURCE[name], 0, 0, TILE, TILE));
}

/** Förstorat porträtt (huvud och axlar) som bild-URL för gränssnittet. */
export function portraitUrl(sprite: string): string {
  const el = canvas(96, (c) => {
    c.fillStyle = '#2a2530';
    c.fillRect(0, 0, 96, 96);
    c.drawImage(SOURCE[sprite], 2, 0, 12, 12, 0, 0, 96, 96);
  });
  return el.toDataURL();
}
