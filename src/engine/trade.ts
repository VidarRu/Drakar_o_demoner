import { NPCS } from '../content';
import { ARMOR_LIST, SHIELD_LIST } from '../data/armor';
import { ITEM_LIST } from '../data/equipment';
import { HERB_LIST, HERBS, herbPrice, herbSkill } from '../data/herbs';
import { WEAPON_LIST } from '../data/weapons';
import { die } from './dice';
import type { Game } from './game';
import { itemInfo, removeItem } from './inventory';
import { prepareDose } from './poison';
import { AMMUNITION, resistance, TRADE } from './rules';
import { dayOf } from './time';
import type { Actor, ShopGoods } from './types';

/**
 * Handel till Bok III:s priser. Köpslå (Bok I) slås en gång per handlare och dag: FV mot
 * handlarens FV på motståndstabellen, och varje poäng i differensvärde ger 5 % i rabatt.
 */

const AMMO_ITEMS = new Set(Object.values(AMMUNITION).map((a) => a.item));
/** Tolkning: rabatten från Köpslå kan bli högst så här stor. */
const MAX_HAGGLE = 50;

export interface Ware {
  id: string;
  name: string;
  price: number;
  weight: number;
  herb?: boolean;
}

function goodsOf(npc: Actor): ShopGoods[] {
  return (npc.npc && NPCS[npc.npc]?.shop?.goods) || [];
}

function state(g: Game, npc: Actor) {
  const day = dayOf(g.state.time);
  let t = g.state.trade[npc.id];
  if (!t || t.day !== day) {
    t = { day };
    g.state.trade[npc.id] = t;
  }
  return t;
}

/** Droger som handlaren har inne i dag: 1T10 över vanligheten (Bok II). */
function herbStock(g: Game, npc: Actor): string[] {
  const t = state(g, npc);
  if (!t.herbs) {
    const kinds = new Set(goodsOf(npc).flatMap((x) => (x === 'läkedroger' ? ['läkedrog'] : x === 'droger' ? ['drog'] : x === 'gifter' ? ['gift'] : [])));
    t.herbs = HERB_LIST.filter((h) => kinds.has(h.kind) && die(10, g.rng) > h.common).map((h) => h.id);
  }
  return t.herbs;
}

/** Varorna som handlaren säljer, till listpris. */
export function wares(g: Game, npc: Actor): Ware[] {
  const goods = goodsOf(npc);
  const out: Ware[] = [];
  const has = (x: ShopGoods) => goods.includes(x);
  for (const w of WEAPON_LIST) {
    if ((w.kind === 'närstrid' && has('närstridsvapen')) || (w.kind !== 'närstrid' && has('avståndsvapen'))) out.push({ id: w.id, name: w.name, price: w.price, weight: w.weight });
  }
  if (has('rustningar')) for (const a of ARMOR_LIST) out.push({ id: a.id, name: a.name, price: a.price, weight: a.weight });
  if (has('sköldar')) for (const s of SHIELD_LIST) out.push({ id: s.id, name: s.name, price: s.price, weight: s.weight });
  for (const i of ITEM_LIST) {
    if (goods.includes(i.category as ShopGoods) || (AMMO_ITEMS.has(i.id) && has('avståndsvapen'))) out.push({ id: i.id, name: i.name, price: i.price, weight: i.weight });
  }
  for (const id of herbStock(g, npc)) out.push({ id, name: HERBS[id].name, price: herbPrice(HERBS[id]), weight: 0, herb: true });
  return out;
}

/** Rabatten i procent från dagens köpslående (0 om man inte har prutat). */
export function discount(g: Game, npc: Actor): number {
  return state(g, npc).pct ?? 0;
}

export function canHaggle(g: Game, npc: Actor): boolean {
  return state(g, npc).pct === undefined;
}

/** Köpslå: FV mot handlarens FV. Vinner rollpersonen blir rabatten 5 % per poäng i differensvärde. */
export function haggle(g: Game, npc: Actor): number {
  const t = state(g, npc);
  if (t.pct !== undefined) return t.pct;
  const p = g.player;
  const mine = g.skillFv(p, 'kopsla');
  const theirs = npc.skills.kopsla ?? 10;
  const check = resistance(mine, theirs, g.rng);
  const pct = check.success ? Math.min(MAX_HAGGLE, Math.max(0, check.diff) * TRADE.haggleStep) : 0;
  t.pct = pct;
  if (check.success) g.gainExperience(p, 'kopsla', check);
  g.log(
    `${p.name} köpslår med ${npc.name} (Köpslå ${mine} mot ${theirs}, T20: ${check.roll} mot ${check.target}): ${
      pct ? `${pct} % bättre priser i dag.` : 'handlaren ger inte med sig.'
    }`,
  );
  return pct;
}

export function buyPrice(g: Game, npc: Actor, price: number): number {
  return Math.max(1, Math.ceil((price * (100 - discount(g, npc))) / 100));
}

/** Vidar: handlaren köper för en fjärdedel av listpriset, och Köpslå höjer det med samma procent. */
export function sellPrice(g: Game, npc: Actor, price: number): number {
  return Math.floor((price * TRADE.sellShare * (100 + discount(g, npc))) / 100);
}

export function buy(g: Game, npc: Actor, id: string): string | null {
  const ware = wares(g, npc).find((w) => w.id === id);
  if (!ware) return 'Det säljer handlaren inte.';
  const price = buyPrice(g, npc, ware.price);
  const p = g.player;
  const ch = g.char;
  if (p.silver < price) return 'Du har inte råd.';
  p.silver -= price;
  if (ware.herb) ch.herbs.push(prepareDose(g, id, npc.skills[herbSkill(HERBS[id])] ?? 0));
  else if (AMMO_ITEMS.has(id)) ch.ammo[id] = (ch.ammo[id] ?? 0) + 10;
  else ch.inventory.push(id);
  g.log(`${p.name} köper ${ware.name.toLowerCase()} för ${price} silvermynt.`);
  g.cue({ type: 'packning', item: id, how: 'köpt' });
  g.changed();
  return null;
}

/** Föremål i packningen som handlaren vill köpa, med pris. */
export function sellable(g: Game, npc: Actor): Ware[] {
  const sold = new Set(wares(g, npc).filter((w) => !w.herb).map((w) => w.id));
  const out: Ware[] = [];
  for (const id of new Set(g.char.inventory)) {
    const info = itemInfo(id);
    if (info && sold.has(id)) out.push({ id, name: info.name, price: sellPrice(g, npc, info.price), weight: info.weight });
  }
  return out;
}

export function sell(g: Game, npc: Actor, id: string): string | null {
  const ware = sellable(g, npc).find((w) => w.id === id);
  if (!ware) return 'Det vill handlaren inte köpa.';
  if (!removeItem(g, id)) return 'Du har inget sådant.';
  g.player.silver += ware.price;
  g.log(`${g.player.name} säljer ${ware.name.toLowerCase()} för ${ware.price} silvermynt.`);
  g.cue({ type: 'packning', item: id, how: 'sålt' });
  g.changed();
  return null;
}
