/**
 * Slängprov: utrustningsdockan i packningen. Figuren läggs ihop av Flares lager
 * (tools/flare_art.py) efter vad rollpersonen faktiskt bär, med en ruta per plats runt om.
 */
import { ARMOR, SHIELDS } from '../data/armor';
import { WEAPONS } from '../data/weapons';
import type { Game } from '../engine/game';
import type { Actor } from '../engine/types';

const BASE = import.meta.env.BASE_URL + 'art/flare/';
let meta: Record<string, [number, number]> | null = null;
const images = new Map<string, Promise<HTMLImageElement>>();

function load(name: string) {
  let p = images.get(name);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = `${BASE}doll/${name}.png`;
    });
    images.set(name, p);
  }
  return p;
}

type Kind = 'cloth' | 'leather' | 'chain' | 'plate';
function material(id: string): Kind {
  if (id.includes('tyg')) return 'cloth';
  if (/lader|hardat/.test(id)) return 'leather';
  if (/ring|brynj|forstarkt/.test(id)) return 'chain';
  return 'plate';
}

const WEAPON_LOOK: [RegExp, string][] = [
  [/dolk|kniv/, 'dagger'],
  [/^klubba|traklubba/, 'club'],
  [/spikklubba|morgonstjarna|gissel/, 'mace'],
  [/kortsvard/, 'shortsword'],
  [/bastard/, 'greatsword'],
  [/tvahandssvard/, 'zweihander'],
  [/svard|sabel/, 'longsword'],
  [/handyxa|kastyxa/, 'hand_axe'],
  [/glav|palyxa|hillebard/, 'infantry_axe'],
  [/yxa/, 'battle_axe'],
  [/hammare|korpnabb|hjalmkross/, 'war_hammer'],
  [/slaga/, 'maul'],
  [/liten_bage|kortbage/, 'shortbow'],
  [/bage/, 'longbow'],
  [/armborst|arbalest/, 'greatbow'],
  [/slunga/, 'slingshot'],
  [/stav|spjut|pik|lans|partisan|spetum|treudd/, 'greatstaff'],
];
const SHIELD_LOOK: Record<string, string> = {
  targ: 'buckler',
  rundskold_liten: 'iron_buckler',
  rundskold_stor: 'shield',
};

/** Flares lager för det figuren bär, i ordningen framifrån. */
function layers(g: Game, a: Actor): string[] {
  const female = g.charOf(a)?.gender === 'kvinna';
  const sex = female ? 'female' : 'male';
  const slot: Record<string, string | undefined> = {
    head: female ? 'head_long' : 'head_short',
    chest: 'cloth_shirt',
    legs: 'cloth_pants',
    feet: 'leather_boots',
    hands: 'default_hands',
  };
  const look: Record<Kind, Record<string, string>> = {
    cloth: { hjälm: 'leather_hood', harnesk: 'cloth_shirt', armskydd: 'cloth_gloves', benskydd: 'cloth_pants' },
    leather: { hjälm: 'leather_hood', harnesk: 'leather_chest', armskydd: 'leather_gloves', benskydd: 'leather_pants' },
    chain: { hjälm: 'chain_coif', harnesk: 'chain_cuirass', armskydd: 'chain_gloves', benskydd: 'chain_greaves' },
    plate: { hjälm: 'plate_helm', harnesk: 'plate_cuirass', armskydd: 'plate_gauntlets', benskydd: 'plate_greaves' },
  };
  const where: Record<string, string> = { hjälm: 'head', harnesk: 'chest', brynja: 'chest', armskydd: 'hands', benskydd: 'legs', brynjehosor: 'legs' };
  for (const id of a.armor) {
    const def = ARMOR[id];
    if (!def) continue;
    const kind = material(id);
    const s = where[def.slot];
    if (!s) continue;
    const key = def.slot === 'brynja' ? 'harnesk' : def.slot === 'brynjehosor' ? 'benskydd' : def.slot;
    slot[s] = look[kind][key];
    if (def.slot === 'brynja') slot.hands = 'chain_gloves';
    if (s === 'legs' && (kind === 'chain' || kind === 'plate')) slot.feet = kind === 'chain' ? 'chain_boots' : 'plate_boots';
  }
  const weapon = WEAPONS[a.weapon] ? WEAPON_LOOK.find(([re]) => re.test(a.weapon))?.[1] : undefined;
  slot.main = weapon;
  slot.off = a.shield ? (SHIELD_LOOK[a.shield] ?? 'kite_shield') : a.offhand ? WEAPON_LOOK.find(([re]) => re.test(a.offhand!))?.[1] : undefined;
  // Framifrån: vapnet längst bak, skölden längst fram.
  return ['main', 'feet', 'legs', 'hands', 'chest', 'head', 'off'].map((s) => slot[s]).filter((v): v is string => !!v).map((item) => `${sex}_${item}`);
}

function cell(label: string, value: string) {
  const d = document.createElement('div');
  d.className = 'doll-slot';
  const b = document.createElement('small');
  b.textContent = label;
  const v = document.createElement('span');
  v.textContent = value;
  d.append(b, v);
  return d;
}

export function renderDoll(g: Game, a: Actor): HTMLElement {
  const box = document.createElement('div');
  box.className = 'doll';
  const canvasEl = document.createElement('canvas');
  canvasEl.width = 230;
  canvasEl.height = 290;
  const armorIn = (slots: string[]) =>
    a.armor
      .filter((id) => slots.includes(ARMOR[id]?.slot))
      .map((id) => ARMOR[id].name)
      .join(', ') || '–';
  const left = document.createElement('div');
  left.className = 'doll-col';
  left.append(cell('Huvud', armorIn(['hjälm'])), cell('Bål', armorIn(['harnesk', 'brynja'])), cell('Armar', armorIn(['armskydd'])), cell('Ben', armorIn(['benskydd', 'brynjehosor'])));
  const right = document.createElement('div');
  right.className = 'doll-col';
  right.append(
    cell('Svärdshand', WEAPONS[a.weapon]?.name ?? 'tom'),
    cell('Andra handen', a.offhand ? WEAPONS[a.offhand].name : 'tom'),
    cell('Sköld', a.shield ? SHIELDS[a.shield].name : 'ingen'),
  );
  box.append(left, canvasEl, right);

  void (async () => {
    meta ??= await (await fetch(`${BASE}doll.json`)).json();
    const names = layers(g, a).filter((n) => meta![n]);
    const imgs = await Promise.all(names.map(load));
    const ctx = canvasEl.getContext('2d')!;
    const ax = 115;
    const ay = 270;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(ax, ay - 2, 46, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    // Figuren ritas förstorad kring fötterna.
    ctx.translate(ax, ay);
    ctx.scale(1.6, 1.6);
    names.forEach((n, i) => ctx.drawImage(imgs[i], -meta![n][0], -meta![n][1]));
    ctx.restore();
  })();
  return box;
}
