import { BOOKS } from '../content';
import { ARMOR, SHIELDS } from '../data/armor';
import { IRON_ITEMS, ITEMS, MONEY } from '../data/equipment';
import { HERBS } from '../data/herbs';
import { SKILLS } from '../data/skills';
import type { MeleeWeaponDef } from '../data/types';
import { NON_IRON_WEAPONS, WEAPONS } from '../data/weapons';
import { canAct } from './combat';
import type { Game } from './game';
import { AMMUNITION, armorWeightPercent, encumbrance, grip, IRON_LIMIT_KG } from './rules';
import type { Actor, WeaponSlot } from './types';


/**
 * Packning och bärförmåga (Bok III s. 42): bördan räknas i kg mot STY, rustning på kroppen
 * räknas med halva vikten och kläder inte alls. Här finns också att byta vapen och rustning.
 */

export type ItemKind = 'vapen' | 'sköld' | 'rustning' | 'föremål';

export interface ItemInfo {
  id: string;
  name: string;
  kind: ItemKind;
  weight: number;
  price: number;
  category?: string;
}

export function itemInfo(id: string): ItemInfo | undefined {
  const w = WEAPONS[id];
  if (w) return { id, name: w.name, kind: 'vapen', weight: w.weight, price: w.price, category: w.kind === 'närstrid' ? 'närstrid' : 'avstånd' };
  const s = SHIELDS[id];
  if (s) return { id, name: s.name, kind: 'sköld', weight: s.weight, price: s.price };
  const a = ARMOR[id];
  if (a) return { id, name: a.name, kind: 'rustning', weight: a.weight, price: a.price };
  const i = ITEMS[id];
  if (i) return { id, name: i.name, kind: 'föremål', weight: i.weight, price: i.price, category: i.category };
  const b = BOOKS[id];
  if (b) return { id, name: b.name, kind: 'föremål', weight: b.weight, price: b.price, category: 'bok' };
  return undefined;
}

/** Vikten av ett föremål för rollpersonen (rustningsvikter beror på kroppsbyggnaden). */
function weightOf(g: Game, id: string, a: Actor = g.player): number {
  const info = itemInfo(id);
  if (!info) return 0;
  if (info.kind === 'rustning') return (info.weight * armorWeightPercent((g.charOf(a) ?? g.char).attrs)) / 100;
  if (info.category === 'kläder') return 0;
  return info.weight;
}

/** Bördan i kg: allt i packningen, halva vikten för rustning på kroppen, mynt och ammunition. */
export function carriedWeight(g: Game, p: Actor = g.player): number {
  const ch = g.charOf(p);
  if (!ch) return 0;
  const worn = [...p.armor];
  let kg = 0;
  for (const id of ch.inventory) {
    const w = weightOf(g, id, p);
    const i = worn.indexOf(id);
    if (i >= 0) {
      worn.splice(i, 1);
      kg += w / 2;
    } else kg += w;
  }
  for (const [item, n] of Object.entries(ch.ammo ?? {})) kg += ((ITEMS[item]?.weight ?? 0) * n) / 10;
  kg += p.silver / MONEY.coinsPerKg;
  return Math.round(kg * 10) / 10;
}

/** Bördans modifikation på förflyttning, SMI och SMI-färdigheter. null: för tungt att röra sig med. */
export function loadMod(g: Game, a: Actor): number | null {
  if (!g.charOf(a)) return 0;
  return encumbrance(carriedWeight(g, a), a.attrs.STY);
}

/** Över STY × 5 kan inga SMI-färdigheter användas, och över STY × 6 kan man inte röra sig. */
export function smiBlocked(g: Game, a: Actor): boolean {
  if (!g.charOf(a)) return false;
  const mod = loadMod(g, a);
  return mod === null || carriedWeight(g, a) > a.attrs.STY * 5;
}

/** Avdraget för bördan på en färdighet (bara SMI-baserade). */
export function loadPenalty(g: Game, a: Actor, skill: string): number {
  if (SKILLS[skill.split(':')[0]]?.attr !== 'SMI') return 0;
  return loadMod(g, a) ?? 0;
}

// ------------------------------------------------------------------ järn och magi

/** Föremål av järn som rollpersonen har i handen eller på kroppen, eller för mycket järn i packningen. */
export function ironProblem(g: Game, p: Actor = g.player): string | null {
  for (const id of p.armor) if (ARMOR[id]?.metal && (p.bv[id] ?? 1) > 0) return `${ARMOR[id].name} är av metall och omsluter dig.`;
  for (const slot of ['weapon', 'offhand'] as const) {
    const id = slot === 'weapon' ? p.weapon : p.offhand;
    if (id && WEAPONS[id] && !NON_IRON_WEAPONS.has(id)) return `Du håller ${WEAPONS[id].name.toLowerCase()} av järn i handen.`;
  }
  // Vidar: alla sköldar har metallbeslag och räknas som järn.
  if (p.shield && SHIELDS[p.shield]) return `${SHIELDS[p.shield].name} har metallbeslag.`;
  let iron = 0;
  for (const id of g.charOf(p)?.inventory ?? []) {
    if (id === p.weapon || id === p.offhand || id === p.shield || p.armor.includes(id)) continue;
    if ((WEAPONS[id] && !NON_IRON_WEAPONS.has(id)) || ARMOR[id]?.metal || SHIELDS[id] || IRON_ITEMS.has(id)) iron += weightOf(g, id, p);
  }
  if (iron > IRON_LIMIT_KG) return `Du bär ${Math.round(iron * 10) / 10} kg järn i packningen (högst ${IRON_LIMIT_KG} kg).`;
  return null;
}

// ------------------------------------------------------------------ byta utrustning

export type EquipSlot = WeaponSlot | 'shield';

function ownedFree(g: Game, id: string): boolean {
  const ch = g.char;
  const p = g.player;
  const owned = ch.inventory.filter((x) => x === id).length;
  const used = [p.weapon, p.offhand, p.shield, ...p.armor].filter((x) => x === id).length;
  return owned > used;
}

/** Varför föremålet inte kan tas i handen eller på kroppen, eller null om det går. */
export function equipProblem(g: Game, id: string, slot: EquipSlot | 'armor'): string | null {
  const p = g.player;
  const sty = p.attrs.STY;
  if (p.shape) return 'I djurhamn kan du inte använda utrustning.';
  if (!ownedFree(g, id)) return 'Du har inget ledigt exemplar.';
  if (g.state.mode === 'combat') {
    if (slot === 'armor') return 'Rustning kan inte bytas mitt i en strid.';
    if (!g.isPlayerTurn() || g.state.combat!.acted[p.id]) return 'Att byta vapen tar handlingen på din tur.';
  } else if (g.state.mode !== 'explore' || !canAct(p)) return 'Du kan inte byta utrustning nu.';
  if (slot === 'armor') return ARMOR[id] ? null : 'Det är ingen rustning.';
  if (slot === 'shield') {
    const s = SHIELDS[id];
    if (!s) return 'Det är ingen sköld.';
    const w = WEAPONS[p.weapon];
    if (p.offhand) return 'Du har redan ett vapen i den andra handen.';
    if (w && (w.kind === 'projektil' || (w.kind === 'närstrid' && grip(w.styReq, sty, w.twoHandedOnly) !== 'en hand'))) return `${w.name} kräver båda händerna.`;
    return null;
  }
  const w = WEAPONS[id];
  if (!w) return 'Det är inget vapen.';
  const twoHandedOnly = w.kind === 'närstrid' && w.twoHandedOnly;
  if (grip(w.styReq, sty, twoHandedOnly) === 'för tungt') return `${w.name} är för tungt för STY ${sty}.`;
  if (slot === 'offhand') {
    if (w.kind !== 'närstrid' || grip(w.styReq, sty, w.twoHandedOnly) !== 'en hand') return `${w.name} kan inte föras i den andra handen.`;
    if (p.shield) return 'Du har en sköld i den handen.';
    const main = WEAPONS[p.weapon];
    if (main && (main.kind === 'projektil' || (main.kind === 'närstrid' && grip(main.styReq, sty, main.twoHandedOnly) !== 'en hand'))) return `${main.name} kräver båda händerna.`;
  }
  return null;
}

/** BV för ett föremål i packningen sparas så att slitaget följer med när det tas fram igen. */
function storeBv(g: Game, key: string, id: string | undefined) {
  if (!id || g.player.bv[key] === undefined) return;
  (g.char.itemBv ??= {})[id] = g.player.bv[key];
  delete g.player.bv[key];
}

function restoreBv(g: Game, key: string, id: string, full: number | null) {
  const stored = g.char.itemBv?.[id];
  if (full === null) return;
  g.player.bv[key] = stored ?? full;
  if (stored !== undefined) delete g.char.itemBv![id];
}

/** Lägger undan det som finns i en hand. */
export function stow(g: Game, slot: EquipSlot) {
  const prev = stowSlot(g, slot);
  if (prev && prev !== 'nave') g.cue({ type: 'packning', item: prev, how: 'undanlagt' });
}

/** Lägger undan det som är i handen utan ljudsignal. Returnerar det som lades undan. */
function stowSlot(g: Game, slot: EquipSlot): string | undefined {
  const p = g.player;
  const ch = g.char;
  const prev = slot === 'weapon' ? p.weapon : slot === 'offhand' ? p.offhand : p.shield;
  if (slot === 'weapon') {
    storeBv(g, 'weapon', p.weapon);
    p.weapon = 'nave';
    ch.equipped.weapon = undefined;
  } else if (slot === 'offhand') {
    storeBv(g, 'offhand', p.offhand);
    p.offhand = undefined;
    ch.equipped.offhand = undefined;
  } else {
    storeBv(g, 'shield', p.shield);
    p.shield = undefined;
    ch.equipped.shield = undefined;
  }
  return prev;
}

/** Tar fram ett vapen eller en sköld. I strid kostar det handlingen. Returnerar ett felmeddelande eller null. */
export function equip(g: Game, id: string, slot: EquipSlot): string | null {
  const problem = equipProblem(g, id, slot);
  if (problem) return problem;
  const p = g.player;
  const ch = g.char;
  if (slot === 'shield') {
    stowSlot(g, 'shield');
    p.shield = id;
    ch.equipped.shield = id;
    restoreBv(g, 'shield', id, SHIELDS[id].bv);
  } else {
    stowSlot(g, slot);
    const w = WEAPONS[id];
    // Projektilvapen kräver båda händerna: sköld och andra vapen läggs undan.
    if (slot === 'weapon' && (w.kind === 'projektil' || (w.kind === 'närstrid' && grip(w.styReq, p.attrs.STY, w.twoHandedOnly) !== 'en hand'))) {
      stowSlot(g, 'shield');
      stowSlot(g, 'offhand');
    }
    if (slot === 'weapon') {
      p.weapon = id;
      ch.equipped.weapon = id;
    } else {
      p.offhand = id;
      ch.equipped.offhand = id;
    }
    restoreBv(g, slot, id, w.kind === 'närstrid' ? (w as MeleeWeaponDef).bv : null);
    p.reload = 0;
  }
  const name = (WEAPONS[id] ?? SHIELDS[id]).name.toLowerCase();
  g.log(`${p.name} tar fram ${name}.`);
  g.cue({ type: 'packning', item: id, how: 'utrustat' });
  spendAction(g, `${p.name} lägger handlingen på att byta vapen.`);
  return null;
}

/** Tar av en rustningsdel (utanför strid). */
export function removeArmor(g: Game, id: string) {
  const p = g.player;
  if (g.state.mode !== 'explore' || !p.armor.includes(id)) return;
  storeBv(g, id, id);
  p.armor = p.armor.filter((x) => x !== id);
  g.char.equipped.armor = [...p.armor];
  g.log(`${p.name} tar av ${ARMOR[id].name.toLowerCase()}.`);
  g.cue({ type: 'packning', item: id, how: 'undanlagt' });
}

/** Tar på en rustningsdel (utanför strid) och behåller dess slitage. */
export function wearArmor(g: Game, id: string): string | null {
  const problem = equipProblem(g, id, 'armor');
  if (problem) return problem;
  const stored = g.char.itemBv?.[id];
  g.equipArmor(id);
  if (stored !== undefined) {
    g.player.bv[id] = stored;
    delete g.char.itemBv![id];
  }
  g.log(`${g.player.name} tar på ${ARMOR[id].name.toLowerCase()}.`);
  g.cue({ type: 'packning', item: id, how: 'utrustat' });
  return null;
}

/** I strid kostar det turens handling, men rollpersonen kan fortfarande flytta sig. */
export function spendAction(g: Game, text?: string) {
  const c = g.state.combat;
  if (g.state.mode === 'combat' && c) {
    if (text) g.log(text);
    c.acted[g.player.id] = true;
  }
}

/** Tar bort ett föremål ur packningen (sålt eller förbrukat). Utrustade föremål läggs undan först. */
export function removeItem(g: Game, id: string): boolean {
  const ch = g.char;
  const p = g.player;
  const i = ch.inventory.indexOf(id);
  if (i < 0) return false;
  if (!ownedFree(g, id)) {
    if (p.weapon === id) stow(g, 'weapon');
    else if (p.offhand === id) stow(g, 'offhand');
    else if (p.shield === id) stow(g, 'shield');
    else if (p.armor.includes(id)) {
      p.armor = p.armor.filter((x) => x !== id);
      ch.equipped.armor = [...p.armor];
      delete p.bv[id];
    }
  }
  ch.inventory.splice(i, 1);
  if (!ch.inventory.includes(id) && ch.itemBv) delete ch.itemBv[id];
  return true;
}

/** Ammunitionen som ett projektilvapen behöver, och om den är nödvändig. */
export function ammoFor(weaponId: string) {
  return AMMUNITION[weaponId];
}

export function herbName(id: string): string {
  return HERBS[id]?.name ?? id;
}
