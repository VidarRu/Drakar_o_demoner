/**
 * Figurerna, ritade pixel för pixel i full rutstorlek (32×32) och sedda snett
 * framifrån. Varje del får mjuk skuggning med ljus från nordväst, och hela
 * figuren får en mörk kontur så att den syns mot marken. Varje figur har en
 * stillastående ram och två gå-ramar.
 */
import { TILE } from './grid';
import { clamp, Raster, rgb, type RGB } from './pixel';

const S = TILE;

// ------------------------------------------------------------------ färger

const SHADOW_TINT = rgb('#1a1430');
const LIGHT_TINT = rgb('#fff1d0');
const mix = (a: RGB, b: RGB, t: number): RGB => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

/** Fyra toner ur en grundfärg: skuggor drar mot blålila, högdagrar mot varmt ljus. */
function tones(hex: string): RGB[] {
  const c = rgb(hex);
  return [mix(c, SHADOW_TINT, 0.5), mix(c, SHADOW_TINT, 0.25), c, mix(c, LIGHT_TINT, 0.28)];
}

// ------------------------------------------------------------------ ritverktyg

type Mask = (x: number, y: number) => boolean;

class Fig {
  readonly r = new Raster(S, S);

  /** En kroppsdel med kuddskuggning: ljusast uppe till vänster, mörkast nere till höger. */
  part(x0: number, y0: number, x1: number, y1: number, color: string, mask?: Mask, bias = 0) {
    const t = tones(color);
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const hw = Math.max(1, (x1 - x0) / 2);
    const hh = Math.max(1, (y1 - y0) / 2);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (mask && !mask(x, y)) continue;
        const v = 0.6 + bias - ((x - cx) / hw) * 0.3 - ((y - cy) / hh) * 0.18;
        this.r.set(x, y, t[Math.floor(clamp(v, 0, 0.999) * 4)]);
      }
    }
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, color: string, bias = 0) {
    this.part(Math.floor(cx - rx), Math.floor(cy - ry), Math.ceil(cx + rx), Math.ceil(cy + ry), color, (x, y) =>
      ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.05,
    bias);
  }

  px(x: number, y: number, color: string | RGB) {
    this.r.set(x, y, typeof color === 'string' ? rgb(color) : color);
  }

  /** Mörk kontur runt hela figuren, i en mörk variant av färgen innanför. */
  outline() {
    const { r } = this;
    const add: [number, number, RGB][] = [];
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        if (r.alpha(x, y)) continue;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = x + dx;
          const ny = y + dy;
          if (r.alpha(nx, ny) === 255) {
            const i = (ny * S + nx) * 4;
            const c: RGB = [r.data[i], r.data[i + 1], r.data[i + 2]];
            add.push([x, y, mix(c, rgb('#0c0910'), 0.78)]);
            break;
          }
        }
      }
    }
    for (const [x, y, c] of add) r.set(x, y, c);
  }

  /** Skugga på marken, bara där figuren inte redan ritat. */
  shadow(cx: number, cy: number, rx: number, ry: number) {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > 1 || this.r.alpha(x, y)) continue;
        this.r.set(x, y, [0, 0, 0], 70);
      }
    }
  }
}

// ------------------------------------------------------------------ människolika figurer

type Weapon = 'sword' | 'broadsword' | 'spear' | 'dagger' | 'hammer' | 'staff';

interface Look {
  skin: string;
  eyes?: string;
  hair?: string;
  hairStyle?: 'short' | 'long' | 'bun' | 'braid';
  beard?: string;
  mustache?: string;
  helmet?: string;
  horns?: boolean;
  hood?: string;
  /** Halsduk för nedre delen av ansiktet. */
  scarf?: string;
  ears?: boolean;
  tunic: string;
  sleeves?: string;
  legs: string;
  boots: string;
  belt?: string;
  tabard?: string;
  chain?: boolean;
  apron?: string;
  robe?: boolean;
  cape?: string;
  belly?: boolean;
  size?: 'small' | 'big';
  weapon?: Weapon;
  shield?: { color: string; rim: string; emblem?: string };
}

const BRASS = '#d8b84a';
const STEEL = '#c9ced8';
const IRON = '#5a5c66';
const WOOD = '#7a5532';

/** Ritar en människolik figur. `frame` 0 = står still, 1 och 2 = gåsteg. */
function humanoid(f: Fig, k: Look, frame: number) {
  const big = k.size === 'big';
  const small = k.size === 'small';
  const foot = 29;
  const legH = small ? 6 : 8;
  const bob = frame === 0 ? 0 : -1;
  const legTop = foot - legH + 1;
  const torsoH = big ? 10 : small ? 8 : 9;
  const torsoTop = legTop - torsoH + bob;
  const headH = small ? 9 : 8;
  const headTop = torsoTop - headH;
  const bodyL = big ? 10 : 11;
  const bodyR = big ? 21 : 20;
  const legLift = (side: 0 | 1) => (frame === side + 1 ? 2 : 0);

  // Mantel bakom kroppen.
  if (k.cape) f.part(bodyL - 1, torsoTop + 1, bodyR + 1, foot - 2, k.cape, undefined, -0.25);

  // Ben och stövlar.
  if (!k.robe) {
    for (const side of [0, 1] as const) {
      const x0 = side === 0 ? bodyL + 1 : bodyR - 4;
      const bottom = foot - legLift(side);
      f.part(x0, legTop + bob, x0 + 3, bottom - 3, k.legs);
      f.part(x0, bottom - 3, x0 + 3, bottom, k.boots);
      f.px(x0 + (side === 0 ? -1 : 4), bottom, tones(k.boots)[1]);
    }
  }

  // Bål (eller kåpa ända ner).
  const torsoBottom = k.robe ? foot - (frame ? 1 : 0) : legTop + 1 + bob;
  f.part(bodyL, torsoTop, bodyR, torsoBottom, k.tunic, (x, y) => {
    if (y === torsoTop && (x === bodyL || x === bodyR)) return false; // rundade axlar
    if (k.belly && y > torsoTop + 3 && y < torsoBottom - 1) return true;
    if (k.robe && y > legTop) return x >= bodyL - 1 && x <= bodyR + 1;
    return true;
  });
  if (k.belly) {
    f.part(bodyL - 1, torsoTop + 4, bodyL - 1, torsoBottom - 2, k.tunic, undefined, 0.1);
    f.part(bodyR + 1, torsoTop + 4, bodyR + 1, torsoBottom - 2, k.tunic, undefined, -0.3);
  }
  if (k.robe) {
    f.part(bodyL - 1, legTop, bodyR + 1, torsoBottom, k.tunic, (x, y) => y > legTop || (x >= bodyL && x <= bodyR));
    for (let x = bodyL; x <= bodyR; x += 3) f.px(x, torsoBottom, tones(k.tunic)[0]); // veck
  }
  if (k.chain) {
    // Ringbrynja: rutmönster i ljust och mörkt.
    const t = tones(k.tunic);
    for (let y = torsoTop + 1; y <= torsoBottom; y++)
      for (let x = bodyL; x <= bodyR; x++) if ((x + y) % 2 === 0 && f.r.alpha(x, y)) f.px(x, y, t[1]);
  }
  if (k.tabard) f.part(bodyL + 3, torsoTop + 1, bodyR - 3, torsoBottom + 2, k.tabard);
  if (k.apron) f.part(bodyL + 2, torsoTop + 3, bodyR - 2, torsoBottom + 3, k.apron);
  if (k.belt && !k.robe) {
    const by = legTop - 1 + bob;
    for (let x = bodyL; x <= bodyR; x++) f.px(x, by, tones(k.belt)[x < 16 ? 2 : 1]);
    f.px(15, by, BRASS);
    f.px(16, by, tones(BRASS)[1]);
  }

  // Armar och händer.
  const armTop = torsoTop + 1;
  const handY = legTop - 1 + bob;
  const sleeves = k.sleeves ?? k.tunic;
  f.part(bodyL - 2, armTop, bodyL - 1, handY - 1, sleeves, undefined, 0.1);
  f.part(bodyR + 1, armTop, bodyR + 2, handY - 1, sleeves, undefined, -0.15);
  // Mörk söm mellan armar och bål.
  for (let y = armTop + 1; y <= handY - 2; y++) {
    f.px(bodyL, y, tones(sleeves)[0]);
    f.px(bodyR, y, tones(sleeves)[0]);
  }
  if (k.weapon) drawWeapon(f, k.weapon, bodyR + 2, handY, headTop, foot);
  f.part(bodyL - 2, handY, bodyL - 1, handY + 1, k.skin);
  f.part(bodyR + 1, handY, bodyR + 2, handY + 1, k.skin);
  if (k.shield) drawShield(f, k.shield, bodyL - 2, torsoTop + 5);

  // Huvud.
  const hx0 = 12;
  const hx1 = 19;
  const hb = headTop + headH - 1;
  if (k.hood) {
    f.part(hx0 - 1, headTop - 1, hx1 + 1, hb + 1, k.hood, (x, y) => !(y === headTop - 1 && (x < hx0 || x > hx1)));
    f.part(bodyL, torsoTop, bodyR, torsoTop + 2, k.hood, (x, y) => !(y === torsoTop && (x === bodyL || x === bodyR)));
  }
  if (k.hair && k.hairStyle === 'long') f.part(hx0 - 1, headTop + 1, hx1 + 1, torsoTop + 3, k.hair, undefined, -0.2);
  f.part(hx0, headTop, hx1, hb, k.skin, (x, y) => !((y === headTop || y === hb) && (x === hx0 || x === hx1)));
  if (k.ears) {
    for (const [x, y] of [
      [hx0 - 1, headTop + 3],
      [hx0 - 2, headTop + 2],
      [hx0 - 3, headTop + 1],
      [hx0 - 1, headTop + 4],
    ])
      f.px(x, y, tones(k.skin)[2]);
    for (const [x, y] of [
      [hx1 + 1, headTop + 3],
      [hx1 + 2, headTop + 2],
      [hx1 + 3, headTop + 1],
      [hx1 + 1, headTop + 4],
    ])
      f.px(x, y, tones(k.skin)[1]);
  }
  // Ansikte.
  const ey = headTop + 4;
  const eye = k.eyes ?? '#1d1a24';
  f.px(14, ey, eye);
  f.px(17, ey, eye);
  if (k.eyes) {
    f.px(13, ey, tones(eye)[0]);
    f.px(18, ey, tones(eye)[0]);
  }
  f.px(15, ey + 2, tones(k.skin)[1]); // näsa
  f.px(16, ey + 2, tones(k.skin)[1]);
  if (k.beard) {
    f.part(hx0 + 1, ey + 2, hx1 - 1, hb + 2, k.beard, (x, y) => !(y === hb + 2 && (x === hx0 + 1 || x === hx1 - 1)));
    f.px(15, ey + 3, tones(k.skin)[0]);
    f.px(16, ey + 3, tones(k.skin)[0]);
  } else if (k.mustache) {
    for (let x = 14; x <= 17; x++) f.px(x, ey + 3, tones(k.mustache)[x < 16 ? 2 : 1]);
  } else {
    f.px(15, ey + 3, tones(k.skin)[0]);
    f.px(16, ey + 3, tones(k.skin)[0]);
  }
  if (k.scarf) f.part(hx0, ey + 2, hx1, hb + 1, k.scarf, undefined, 0.1);
  // Hår och huvudbonader.
  if (k.hair && !k.helmet && !k.hood) {
    f.part(hx0, headTop - 1, hx1, headTop + 1, k.hair, (x, y) => !(y === headTop - 1 && (x === hx0 || x === hx1)));
    f.part(hx0 - 1, headTop, hx0, headTop + 4, k.hair, undefined, 0.15);
    f.part(hx1, headTop, hx1 + 1, headTop + 4, k.hair, undefined, -0.2);
    if (k.hairStyle === 'bun') f.ellipse(15.5, headTop - 2.5, 2.5, 1.8, k.hair);
    if (k.hairStyle === 'braid')
      for (let y = headTop + 5; y <= torsoTop + 5; y++) f.px(hx1 + 1 - ((y >> 1) & 1), y, tones(k.hair)[(y & 1) + 1]);
  }
  if (k.helmet) {
    f.part(hx0 - 1, headTop - 2, hx1 + 1, headTop + 2, k.helmet, (x, y) => !(y === headTop - 2 && (x < hx0 + 1 || x > hx1 - 1)), 0.1);
    for (let x = hx0 - 1; x <= hx1 + 1; x++) f.px(x, headTop + 2, tones(k.helmet)[0]); // kant
    f.part(15, headTop + 2, 16, headTop + 5, k.helmet, undefined, 0.2); // nässkydd
    f.px(hx0 + 1, headTop - 1, tones(k.helmet)[3]);
    if (k.horns) {
      for (const [x, y] of [
        [hx0 - 2, headTop - 1],
        [hx0 - 3, headTop - 2],
        [hx0 - 3, headTop - 3],
        [hx0 - 2, headTop - 4],
        [hx1 + 2, headTop - 1],
        [hx1 + 3, headTop - 2],
        [hx1 + 3, headTop - 3],
        [hx1 + 2, headTop - 4],
      ])
        f.px(x, y, tones('#d9cfae')[x < 16 ? 3 : 1]);
    }
  }
}

function drawWeapon(f: Fig, w: Weapon, hx: number, hy: number, headTop: number, foot: number) {
  const x = hx;
  switch (w) {
    case 'sword':
    case 'broadsword': {
      const wide = w === 'broadsword';
      const tip = headTop - 2;
      f.part(x, tip, x + (wide ? 2 : 1), hy - 2, STEEL, (px, py) => py > tip || px === x + (wide ? 1 : 0), 0.15);
      for (let px = x - 2; px <= x + (wide ? 4 : 3); px++) f.px(px, hy - 1, tones(BRASS)[px <= x ? 2 : 1]);
      f.px(x + (wide ? 1 : 0), hy + 2, BRASS);
      break;
    }
    case 'dagger':
      f.part(x + 1, hy - 6, x + 1, hy - 1, STEEL, undefined, 0.2);
      f.px(x, hy - 1, BRASS);
      f.px(x + 2, hy - 1, BRASS);
      break;
    case 'spear':
      f.part(x + 1, headTop - 3, x + 1, foot, WOOD);
      f.part(x, headTop - 8, x + 2, headTop - 3, STEEL, (px, py) => px === x + 1 || py > headTop - 7, 0.2);
      break;
    case 'hammer':
      f.part(x + 1, hy - 8, x + 1, hy + 3, WOOD);
      f.part(x - 1, hy - 11, x + 4, hy - 8, IRON, undefined, 0.15);
      break;
    case 'staff':
      f.part(x + 1, headTop - 1, x + 1, foot, WOOD);
      f.ellipse(x + 1, headTop - 2, 1.6, 1.6, '#5e4026');
      break;
  }
}

function drawShield(f: Fig, s: NonNullable<Look['shield']>, ax: number, cy: number) {
  const cx = ax - 1;
  f.ellipse(cx, cy, 4.5, 5.5, s.rim, 0.05);
  f.ellipse(cx, cy, 3.4, 4.4, s.color, 0.05);
  f.ellipse(cx, cy, 1.2, 1.2, s.emblem ?? BRASS, 0.2);
}

// ------------------------------------------------------------------ varg

function wolf(f: Fig, frame: number) {
  const fur = '#7a7680';
  const dark = '#55515c';
  const bob = frame === 0 ? 0 : -1;
  // Svans
  f.part(2, 15 + bob, 6, 18 + bob, dark, (x, y) => y - (15 + bob) >= Math.floor((6 - x) / 2) - 1);
  // Bakre ben (det bortre mörkare)
  const legs: [number, number, string][] = [
    [8, frame === 1 ? 2 : 0, dark],
    [19, frame === 2 ? 2 : 0, dark],
    [11, frame === 2 ? 2 : 0, fur],
    [22, frame === 1 ? 2 : 0, fur],
  ];
  for (const [x, lift, c] of legs.slice(0, 2)) f.part(x, 21 + bob, x + 1, 28 - lift, c);
  // Kropp
  f.ellipse(14.5, 18 + bob, 9, 4.6, fur);
  f.part(9, 19 + bob, 21, 21 + bob, '#9a96a0', (x, y) => y > 19 + bob || (x > 11 && x < 19), -0.1); // ljus buk
  f.ellipse(20, 16 + bob, 4, 4.2, fur, 0.1); // bröst och nacke
  for (const [x, lift, c] of legs.slice(2)) {
    f.part(x, 21 + bob, x + 1, 28 - lift, c);
    f.px(x + 1, 28 - lift, tones(c)[0]);
  }
  // Huvud
  f.ellipse(24, 12 + bob, 3.6, 3.2, fur, 0.15);
  f.part(26, 12 + bob, 30, 14 + bob, '#8d8993', (x, y) => !(x === 30 && y === 12 + bob));
  f.px(30, 12 + bob, '#141016'); // nos
  f.px(25, 11 + bob, '#f0c020'); // öga
  f.px(28, 14 + bob, '#3a2a2a'); // mun
  // Öron
  for (const ex of [21, 24]) {
    f.px(ex, 8 + bob, tones(dark)[2]);
    f.px(ex, 9 + bob, tones(fur)[2]);
    f.px(ex + 1, 9 + bob, tones(fur)[1]);
  }
  // Ragg längs ryggen
  for (let x = 9; x <= 19; x += 2) f.px(x, 13 + bob + (x > 15 ? -1 : 0), tones(fur)[3]);
}

// ------------------------------------------------------------------ rollfigurer

const LOOKS: Record<string, Look> = {
  krigare: {
    skin: '#e0b088',
    helmet: '#8a919e',
    tunic: '#8a8f9a',
    chain: true,
    tabard: '#a33a30',
    sleeves: '#8a8f9a',
    legs: '#5a4636',
    boots: '#3e2c20',
    belt: '#4a3020',
    weapon: 'sword',
    shield: { color: '#35557f', rim: '#6b6e78', emblem: BRASS },
  },
  jagare: {
    skin: '#dcaa82',
    hood: '#3f6b33',
    tunic: '#5e7a3e',
    legs: '#6a5236',
    boots: '#4a3322',
    belt: '#5a3c22',
    cape: '#2f5228',
    weapon: 'spear',
  },
  tjuv: {
    skin: '#d8a882',
    hood: '#34313d',
    scarf: '#25232c',
    tunic: '#4a4556',
    legs: '#2f2c36',
    boots: '#23202a',
    belt: '#3a2a1c',
    cape: '#25232c',
    weapon: 'dagger',
  },
  vard: {
    skin: '#e6b496',
    hair: '#7a4e2a',
    mustache: '#6a4022',
    tunic: '#a8703c',
    legs: '#4a3b30',
    boots: '#3a2a1e',
    apron: '#e6dfcc',
    belt: '#4a3020',
    belly: true,
  },
  smed: {
    skin: '#d4a07a',
    hair: '#c4552c',
    hairStyle: 'braid',
    tunic: '#6c7280',
    legs: '#3e3832',
    boots: '#2c241e',
    apron: '#5c3f25',
    weapon: 'hammer',
    size: 'big',
  },
  gumma: {
    skin: '#e2c0a4',
    hair: '#d6d6dc',
    hairStyle: 'bun',
    tunic: '#5e4478',
    legs: '#5e4478',
    boots: '#2c2420',
    robe: true,
    weapon: 'staff',
  },
  svartalf: {
    skin: '#6f9048',
    ears: true,
    eyes: '#e8402a',
    tunic: '#4a3e34',
    legs: '#2e2822',
    boots: '#1e1a16',
    belt: '#2a2018',
    weapon: 'sword',
    size: 'small',
  },
  hovding: {
    skin: '#5f8240',
    ears: true,
    eyes: '#ffb020',
    helmet: '#5a5560',
    horns: true,
    tunic: '#7a2e28',
    chain: true,
    legs: '#2a2420',
    boots: '#1a1612',
    belt: '#2a2018',
    weapon: 'broadsword',
    shield: { color: '#4a2f1c', rim: '#3a3840', emblem: '#c8c0a8' },
    size: 'big',
  },
  // Följeslagarna i Gråvad.
  knekt: {
    skin: '#d8a67e',
    hair: '#8a8a86',
    beard: '#8a8a86',
    helmet: '#6a6258',
    tunic: '#6a4a32',
    sleeves: '#5a4030',
    legs: '#4a3c30',
    boots: '#2e241c',
    belt: '#3a2818',
    weapon: 'hammer',
    shield: { color: '#7a5a2c', rim: '#5a5c66', emblem: '#c8b060' },
  },
  jagarinna: {
    skin: '#e4b896',
    hair: '#b8742e',
    hairStyle: 'braid',
    tunic: '#4f6a34',
    legs: '#5a4630',
    boots: '#3e2c1e',
    belt: '#4a3420',
    cape: '#3a5a2a',
    weapon: 'staff',
  },
  linnea: {
    skin: '#f0c8a8',
    hair: '#e0c070',
    hairStyle: 'long',
    tunic: '#8a6a9c',
    legs: '#5a4a5a',
    boots: '#3a2c26',
    apron: '#d8d0b8',
    belt: '#6a4a2a',
    weapon: 'staff',
  },
  // Elementarer som har människolik skepnad.
  gnom: { skin: '#8a7050', eyes: '#2a1c10', tunic: '#7a6044', legs: '#6e5840', boots: '#5e4a34', size: 'big' },
  umbra: { skin: '#1e1828', eyes: '#c060ff', hood: '#16121e', tunic: '#1a1522', legs: '#16121e', boots: '#100c16', cape: '#120e18', robe: true },
  glacial: { skin: '#8ab8e8', eyes: '#ffffff', hair: '#f2f6ff', beard: '#f2f6ff', tunic: '#a8cff0', legs: '#86b0dc', boots: '#6a94c4', size: 'big' },
};

/** Elementarer utan människolik skepnad: ritade som klot, pelare och ödlor. */
function spirit(f: Fig, name: string, frame: number) {
  const bob = frame === 0 ? 0 : frame === 1 ? -1 : 1;
  const glow = (cx: number, cy: number, r: number, color: string, alpha: number) => {
    const c = rgb(color);
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const d = Math.hypot(x - cx, y - cy) / r;
        if (d <= 1) f.r.blend(x, y, c, alpha * (1 - d * d));
      }
  };
  switch (name) {
    case 'sylf':
      glow(16, 17 + bob, 11, '#cfe8ff', 0.5);
      f.ellipse(16, 11 + bob, 3.5, 4, '#e4f2ff');
      f.ellipse(16, 19 + bob, 4.5, 6, '#d2e6fa', 0.1);
      for (let i = 0; i < 6; i++) f.px(11 + i * 2, 25 + ((i + frame) % 2), '#b8d8f4');
      break;
    case 'salamander':
      f.ellipse(16, 22, 8, 3.5, '#d8501c');
      f.ellipse(24, 20, 3.5, 2.8, '#e86a20');
      for (let x = 4; x < 10; x++) f.px(x, 23 + Math.round(Math.sin((x + frame) * 0.9)), '#c84418');
      f.px(25, 19, '#fff2a0');
      for (let i = 0; i < 5; i++) glow(9 + i * 3.5, 16 - ((i + frame) % 3), 3, '#ffd040', 0.8);
      break;
    case 'undin':
      f.ellipse(16, 18, 5.5, 11, '#3a7ac8');
      f.ellipse(14, 14, 2, 6, '#7ab8f0', 0.2);
      for (let x = 9; x <= 23; x++) f.px(x, 28 + ((x + frame) % 2), '#5a9ae0');
      f.ellipse(16, 8 + bob, 3, 2.5, '#8ac4f4');
      break;
    case 'luminal':
      glow(16, 16 + bob, 13, '#fff6c0', 0.7);
      f.ellipse(16, 16 + bob, 5, 5, '#fffbe6', 0.2);
      break;
    case 'therm':
      glow(16, 16 + bob, 12, '#ff9a40', 0.55);
      glow(16, 16 + bob, 6, '#ffd080', 0.6);
      break;
  }
}
const SPIRITS = ['sylf', 'salamander', 'undin', 'luminal', 'therm'];

const FRAMES = 3;

function build(name: string, frame: number): HTMLCanvasElement {
  const f = new Fig();
  if (name === 'varg') {
    wolf(f, frame);
    f.outline();
    f.shadow(16, 29, 11, 2.2);
  } else if (SPIRITS.includes(name)) {
    spirit(f, name, frame);
    f.shadow(16, 29.5, 7, 2);
  } else {
    humanoid(f, LOOKS[name], frame);
    f.outline();
    f.shadow(16, 29.5, 8, 2.2);
  }
  return f.r.toCanvas();
}

/**
 * Figurerna i rutstorlek. `namn` är stillastående, `namn_g1` och `namn_g2` är
 * gåsteg med vänster respektive höger fot lyft.
 */
export const SPRITES: Record<string, HTMLCanvasElement> = {};
for (const name of [...Object.keys(LOOKS), 'varg', ...SPIRITS]) {
  SPRITES[name] = build(name, 0);
  for (let i = 1; i < FRAMES; i++) SPRITES[`${name}_g${i}`] = build(name, i);
}

/** Förstorat porträtt (huvud och axlar) som bild-URL för gränssnittet. */
export function portraitUrl(sprite: string): string {
  const el = document.createElement('canvas');
  el.width = 96;
  el.height = 96;
  const c = el.getContext('2d')!;
  const bg = c.createRadialGradient(40, 30, 6, 48, 48, 70);
  bg.addColorStop(0, '#4a4152');
  bg.addColorStop(1, '#17131b');
  c.fillStyle = bg;
  c.fillRect(0, 0, 96, 96);
  c.imageSmoothingEnabled = false;
  const [sx, sy] = sprite === 'varg' ? [14, 3] : SPIRITS.includes(sprite) ? [4, 4] : [4, 1];
  c.drawImage(SPRITES[sprite], sx, sy, 24, 24, 0, 0, 96, 96);
  return el.toDataURL();
}
