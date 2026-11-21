import { NATURAL_WEAPONS } from '../content';
import { ARMOR, SHIELDS } from '../data/armor';
import { SKILLS } from '../data/skills';
import type { ArmorDef, MeleeWeaponDef, RangedWeaponDef } from '../data/types';
import { WEAPONS, weaponSkill } from '../data/weapons';
import { loadMod, loadPenalty, smiBlocked } from './inventory';
import { breakConcentration, forgetOnKnockout, resolvePending } from './magic';
import { poisonOnHit, updatePoisons } from './poison';
import { die, maxRoll, roll } from './dice';
import type { Game } from './game';
import { advanceTime, amputate, rollInfections, woundKind } from './time';
import { distance, findPath, lineOfSight, projectilePath, tileAt, walkable } from './map';
import {
  AMMUNITION,
  ARMOR_BV_FACTOR,
  attributeCheck,
  BLIND_CL,
  RANGED,
  RANGED_MODS,
  resistance,
  BLEED_INTERVAL,
  CRITICAL_LIMB,
  damageBonus,
  ENTANGLING_MISS,
  FUMBLE_TABLES,
  fearRoll,
  fearRow,
  grip,
  HIT_TABLE,
  INITIATIVE_DIE,
  LIMB_PSY_CHECK,
  LOCATION_WOUND_PENALTY,
  lookup,
  MELEE_MODS,
  MORALE_MODS,
  DAY,
  HOUR,
  PARRY_PENALTY,
  ROUND_SECONDS,
  skillCheck,
  TWO_HAND_BONUS,
  WEAR_CHANCE,
  type Check,
  type FumbleTable,
  type HitLocation,
  type Outcome,
  type Scope,
  type TableRow,
} from './rules';
import { ATTR_KEYS, type ActiveEffect, type Actor, type CombatState, type WeaponSlot } from './types';

/**
 * Detaljerad strid enligt Bok II (s. 15–22) och husreglerna i docs/regelbeslut.md.
 * Funktionerna arbetar på spelmotorn och anropas via Game.
 */

/** Rollpersonens fackla lyser upp så här många rutor i mörker. */
export const TORCH_RANGE = 4;
/** Längsta strid innan den avbryts (skydd mot oändliga strider). */
const MAX_ROUNDS = 500;

const LEGS: HitLocation[] = ['vänster ben', 'höger ben'];
const DIRS = [
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
];

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
const short = (c: Check) => `T20: ${c.roll} mot ${c.target}`;

// ------------------------------------------------------------------ effekter

export function hasEffect(a: Actor, kind: ActiveEffect['kind']): boolean {
  return a.effects.some((e) => e.kind === kind);
}

function addEffect(a: Actor, e: ActiveEffect) {
  a.effects.push(e);
}

/** Förbrukar ett slag av en effekt som gäller ett visst antal slag. */
function consume(a: Actor, e: ActiveEffect) {
  if (e.uses === undefined) return;
  e.uses--;
  if (e.uses <= 0) a.effects = a.effects.filter((x) => x !== e);
}

const RANGED_GROUPS = new Set(['bagar', 'armborst', 'slunga', 'kastvapen', 'blasror']);

function scopeMatches(scope: Scope | undefined, kind: 'anfall' | 'parering' | 'annan', skill: string, slot?: string, effectSlot?: string): boolean {
  const spell = skill.startsWith('spell:');
  const attr = spell ? 'PSY' : SKILLS[skill.split(':')[0]]?.attr;
  const combat = kind !== 'annan';
  switch (scope) {
    case 'alla':
      return true;
    case 'strid':
      return combat;
    case 'anfall':
      return kind === 'anfall';
    case 'parering':
      return kind === 'parering';
    case 'vapen':
      return !!slot && slot === effectSlot;
    case 'smi':
      return attr === 'SMI';
    case 'smiSty':
      return attr === 'SMI' || attr === 'STY';
    case 'avstånd':
      return RANGED_GROUPS.has(skill);
    case 'int':
      return attr === 'INT';
    case 'psy':
      return attr === 'PSY';
    case 'sty':
      return attr === 'STY';
    case 'magi':
      return spell;
    case 'ejMagi':
      return !spell;
    default:
      return false;
  }
}

/** Effekter som ger avdrag på färdighetsslag: febern räknas inte medan Malmros verkar. */
function clEffects(a: Actor): ActiveEffect[] {
  const noFever = hasEffect(a, 'febernedsatt');
  return a.effects.filter((e) => e.kind === 'cl' && !(noFever && e.label.startsWith('Infektion i')));
}

/**
 * Modifikationen på ett färdighetsslag utanför anfall och parering: skador, börda, feber,
 * gifter och andra effekter. Används för Första hjälpen, Dra vapen, Köpslå och liknande.
 */
export function skillMod(g: Game, a: Actor, skill: string): number {
  let mod = woundPenalty(a) + loadPenalty(g, a, skill);
  for (const e of clEffects(a)) if (!e.half && scopeMatches(e.scope, 'annan', skill)) mod += e.mod ?? 0;
  if (hasEffect(a, 'blind')) mod += BLIND_CL;
  return mod;
}

/** Kan aktören göra någonting alls den här rundan? */
export function canAct(a: Actor): boolean {
  return a.alive && !a.fled && !a.unconscious && !hasEffect(a, 'ingenHandling') && !hasEffect(a, 'liggande') && !hasEffect(a, 'rankor');
}

/** Ute ur striden: död, medvetslös, utslagen eller flydd. */
export function isOut(a: Actor): boolean {
  return !a.alive || a.fled || a.unconscious || a.down;
}

/** Kan använda färdigheter (anfalla, parera, lägga förband). */
function canUseSkills(a: Actor): boolean {
  return canAct(a) && !a.down && a.kp > 1;
}

// ------------------------------------------------------------------ kroppen

export const otherArm = (arm: HitLocation): HitLocation => (arm === 'höger arm' ? 'vänster arm' : 'höger arm');
export const shieldArm = (a: Actor) => otherArm(a.swordArm);

export function limbUsable(a: Actor, loc: HitLocation): boolean {
  if (!a.detailed) return true;
  if (a.disabled.includes(loc) || a.locKp[loc] <= 0) return false;
  if (loc === shieldArm(a) && hasEffect(a, 'armUr')) return false;
  if (a.effects.some((e) => e.kind === 'lem' && e.loc === loc)) return false;
  return true;
}

/**
 * Husregel: −2 på alla färdighetsslag för varje kroppsdel (utom huvudet) som står på 0 KP eller
 * lägre. Bestående skador ger sitt avdrag på det som kräver den kroppsdelen.
 */
export function woundPenalty(a: Actor, locs: HitLocation[] = []): number {
  if (!a.detailed) return 0;
  let mod = 0;
  for (const loc of Object.keys(a.locKp) as HitLocation[]) {
    if (loc !== 'huvud' && a.locKp[loc] <= 0) mod += LOCATION_WOUND_PENALTY;
  }
  for (const inj of a.injuries) if (locs.includes(inj.loc)) mod += inj.cl;
  return mod;
}

/** Förflyttning den här rundan, med skador och effekter. */
export function effectiveMove(a: Actor, g?: Game): number {
  if (!canAct(a)) return 0;
  let m = a.move;
  // Bördan minskar förflyttningen, men aldrig under 1. Över STY × 6 orkar man inte röra sig.
  if (g) {
    const load = loadMod(g, a);
    if (load === null) return 0;
    if (load) m = Math.max(1, m + load);
  }
  if (a.detailed) {
    if (LEGS.some((l) => !limbUsable(a, l))) m = 0;
    else if (LEGS.some((l) => a.locKp[l] <= a.locMax[l] / 2)) m = Math.floor(m / 2);
    for (const inj of a.injuries) if (inj.legMove !== undefined) m = Math.min(m, inj.legMove);
  }
  for (const e of a.effects) {
    if (e.kind !== 'förflyttning') continue;
    m = e.half ? Math.floor(m / 2) : m + (e.mod ?? 0);
  }
  if (a.down || a.kp <= 1) m = Math.min(m, 1);
  return Math.max(0, m);
}

// ------------------------------------------------------------------ vapen

export interface WeaponInfo {
  slot: WeaponSlot;
  id: string;
  name: string;
  damage: string;
  skill: string;
  /** Skadebonus läggs till. */
  sb: boolean;
  /** Naturligt vapen eller obeväpnat anfall. */
  natural: boolean;
  /** Slagsmål med nävarna. */
  unarmed: boolean;
  /** Förs med två händer (för tungt för en hand, eller alltid tvåhands). */
  twoHanded: boolean;
  /** Ett enhandsvapen som förs med två händer gör +1T2 i skada. */
  twoHandBonus: boolean;
  /** Räckvidd i rutor. */
  reach: number;
  entangling: boolean;
  noParryWear: boolean;
  /** Nyckeln för vapnets BV, eller null om det inte kan gå sönder. */
  bvKey: string | null;
}

export function weaponInfo(a: Actor, slot: WeaponSlot = 'weapon'): WeaponInfo {
  const id = (slot === 'weapon' ? a.weapon : a.offhand) ?? 'nave';
  const nat = NATURAL_WEAPONS[id];
  const w = WEAPONS[id];
  if (nat || !w || w.kind !== 'närstrid') {
    const n = nat ?? NATURAL_WEAPONS.nave;
    return {
      slot,
      id: n.id,
      name: n.name,
      damage: n.damage,
      skill: n.skill,
      sb: n.useDamageBonus,
      natural: true,
      unarmed: n.skill === 'slagsmal',
      twoHanded: false,
      twoHandBonus: false,
      reach: 1,
      entangling: false,
      noParryWear: true,
      bvKey: null,
    };
  }
  const m = w as MeleeWeaponDef;
  const twoHanded = grip(m.styReq, a.attrs.STY, m.twoHandedOnly) !== 'en hand';
  // Rollpersonen håller ett enhandsvapen med båda händerna när den andra handen är fri (+1T2).
  // Varelserna gör det inte: det är ett val som spelledaren inte gör åt dem.
  const freeHand = a.kind === 'player' && !a.shield && !a.offhand && limbUsable(a, shieldArm(a));
  return {
    slot,
    id,
    name: m.name,
    damage: m.damage,
    skill: weaponSkill(m, a.attrs.STY),
    sb: true,
    natural: false,
    unarmed: false,
    twoHanded,
    twoHandBonus: slot === 'weapon' && !twoHanded && freeHand && a.detailed,
    reach: 1 + m.length,
    entangling: !!m.entangling,
    noParryWear: !!m.noParryWear,
    bvKey: m.bv === null ? null : slot,
  };
}

/** Kroppsdelarna som ett vapen eller en sköld kräver. */
function armsFor(a: Actor, item: WeaponSlot | 'shield', w?: WeaponInfo): HitLocation[] {
  if (!a.detailed) return [];
  if (item === 'shield' || item === 'offhand') return [shieldArm(a)];
  return w?.twoHanded || w?.twoHandBonus ? [a.swordArm, shieldArm(a)] : [a.swordArm];
}

export function damageExpr(a: Actor, w: WeaponInfo): string {
  const parts = [w.damage];
  const sb = w.sb ? damageBonus(a.attrs) : '';
  if (sb) parts.push(sb);
  if (w.twoHandBonus) parts.push(TWO_HAND_BONUS);
  return parts.join('+');
}

/** FÖRTROLLA och FÖRBANNA VAPEN: summan av effekterna på vapnet i en hand. */
export function weaponMagic(a: Actor, slot: string): number {
  return a.effects.filter((e) => e.kind === 'vapenMagi' && e.slot === slot).reduce((n, e) => n + (e.mod ?? 0), 0);
}

function rollDamage(g: Game, a: Actor, w: WeaponInfo, perfect: boolean): number {
  const expr = damageExpr(a, w);
  const magic = weaponMagic(a, w.slot);
  return Math.max(0, (perfect ? maxRoll(expr) : roll(expr, g.rng)) + magic);
}

/** Extra absorbering på hela kroppen från SKYDD och LÄDERHUD. */
export function magicArmor(a: Actor): number {
  return a.effects.filter((e) => e.kind === 'skydd').reduce((n, e) => n + (e.mod ?? 0), 0);
}

/** Rustningsdelen som skyddar en kroppsdel (den med högst abs som inte är sönder). */
export function armorPiece(a: Actor, loc: HitLocation): ArmorDef | undefined {
  let best: ArmorDef | undefined;
  for (const id of a.armor) {
    const p = ARMOR[id];
    if (!p || !p.covers.includes(loc) || (a.bv[id] ?? 1) <= 0) continue;
    if (!best || p.abs > best.abs) best = p;
  }
  return best;
}

export function armorBv(id: string): number {
  return ARMOR[id].abs * ARMOR_BV_FACTOR;
}

/** Startvärden för BV när ett föremål tas på. */
export function initialBv(a: Actor): Record<string, number> {
  const bv: Record<string, number> = {};
  for (const slot of ['weapon', 'offhand'] as const) {
    const id = slot === 'weapon' ? a.weapon : a.offhand;
    const w = id ? WEAPONS[id] : undefined;
    if (w?.kind === 'närstrid' && w.bv !== null) bv[slot] = w.bv;
  }
  if (a.shield && SHIELDS[a.shield]) bv.shield = SHIELDS[a.shield].bv;
  for (const id of a.armor) if (ARMOR[id]) bv[id] = armorBv(id);
  return bv;
}

function itemName(a: Actor, key: string): string {
  if (key === 'weapon' || key === 'offhand') return weaponInfo(a, key).name;
  if (key === 'shield') return a.shield ? SHIELDS[a.shield].name : 'skölden';
  return ARMOR[key]?.name ?? key;
}

/** Tar bort ett föremål ur rollpersonens utrustning (sönder eller tappat). */
export function unequip(g: Game, a: Actor, key: string) {
  const ch = g.state.character;
  const isPlayer = a.id === g.state.playerId;
  const remove = (id: string | undefined) => {
    if (!isPlayer || !id) return;
    const i = ch.inventory.indexOf(id);
    if (i >= 0) ch.inventory.splice(i, 1);
  };
  if (key === 'weapon') {
    remove(a.weapon);
    a.weapon = 'nave';
    if (isPlayer) ch.equipped.weapon = undefined;
  } else if (key === 'offhand') {
    remove(a.offhand);
    a.offhand = undefined;
    if (isPlayer) ch.equipped.offhand = undefined;
  } else if (key === 'shield') {
    remove(a.shield);
    a.shield = undefined;
    if (isPlayer) ch.equipped.shield = undefined;
  } else {
    remove(key);
    a.armor = a.armor.filter((x) => x !== key);
    if (isPlayer) ch.equipped.armor = [...a.armor];
  }
  delete a.bv[key];
}

/** Sänker ett föremåls BV. Vapen och sköldar går sönder vid 0, rustningsdelar slutar skydda. */
function wearItem(g: Game, a: Actor, key: string, why: string) {
  const bv = a.bv[key];
  if (bv === undefined || bv <= 0) return;
  const name = itemName(a, key);
  a.bv[key] = bv - 1;
  if (a.bv[key] > 0) {
    g.log(`${a.name}s ${name.toLowerCase()} ${why} (BV ${a.bv[key]}).`);
    return;
  }
  if (key === 'weapon' || key === 'offhand' || key === 'shield') {
    g.log(`${a.name}s ${name.toLowerCase()} går sönder!`);
    unequip(g, a, key);
  } else {
    g.log(`${a.name}s ${name.toLowerCase()} är sönder och skyddar inte längre.`);
  }
}

/** Husregel: 2 % chans att ett vapen tappar 1 BV varje gång det används. */
function wear(g: Game, a: Actor, key: string | null) {
  if (key && (key === 'weapon' || key === 'offhand') && a.bv[key] !== undefined && g.rng() < WEAR_CHANCE) {
    wearItem(g, a, key, 'slits');
  }
}

/** Lägger ett föremål på marken, 0 eller fler rutor bort åt slumpmässigt håll. */
function drop(g: Game, a: Actor, key: string, dist: string) {
  const slot = key === 'weapon' || key === 'offhand' || key === 'shield' ? key : 'armor';
  const item = key === 'weapon' ? a.weapon : key === 'offhand' ? a.offhand : key === 'shield' ? a.shield : key;
  if (!item || NATURAL_WEAPONS[item]) return;
  let x = a.x;
  let y = a.y;
  const n = roll(dist, g.rng);
  const [dx, dy] = DIRS[die(8, g.rng) - 1];
  for (let i = 0; i < n && walkable(g.map, x + dx, y + dy); i++) {
    x += dx;
    y += dy;
  }
  g.state.dropped.push({ item, slot, owner: a.id, x, y, bv: a.bv[key] });
  unequip(g, a, key);
}

// ------------------------------------------------------------------ läge, ljus och riktning

function dirIndex(dx: number, dy: number): number {
  return DIRS.findIndex(([x, y]) => x === Math.sign(dx) && y === Math.sign(dy));
}

/** Anfall från sidan +3, bakifrån +7, utifrån hur försvararen står vänd. */
export function flankMod(att: Actor, def: Actor): number {
  const i = dirIndex(att.x - def.x, att.y - def.y);
  const j = dirIndex(def.facing.dx, def.facing.dy);
  if (i < 0 || j < 0) return 0;
  const d = Math.min(Math.abs(i - j), 8 - Math.abs(i - j));
  if (d >= 3) return MELEE_MODS['Anfall bakifrån'];
  if (d === 2) return MELEE_MODS['Anfall från sidan'];
  return 0;
}

export function face(a: Actor, x: number, y: number) {
  const dx = Math.sign(x - a.x);
  const dy = Math.sign(y - a.y);
  if (dx || dy) a.facing = { dx, dy };
}

function isDark(g: Game, x: number, y: number): boolean {
  return !!tileAt(g.map, x, y)?.dark;
}

/**
 * Mörker −15 och fackelsken −5. Rollpersonen bär en fackla som lyser upp närmaste rutorna.
 * Varelser med mörkersyn får inga avdrag.
 */
export function lightMod(g: Game, viewer: Actor, target: Actor): number {
  if (hasEffect(viewer, 'blind')) return MELEE_MODS.Mörker;
  if (viewer.darkvision || hasEffect(viewer, 'mörkersyn')) return 0;
  if (!isDark(g, target.x, target.y) && !isDark(g, viewer.x, viewer.y)) return 0;
  const p = g.player;
  const lit = p.alive && distance(p.x, p.y, target.x, target.y) <= TORCH_RANGE;
  return lit ? MELEE_MODS['Skymning, fackelsken'] : MELEE_MODS.Mörker;
}

// ------------------------------------------------------------------ chans att lyckas

interface Cl {
  fv: number;
  cl: number;
  notes: string[];
  /** Effekter som förbrukas om slaget görs. */
  used: ActiveEffect[];
}

/**
 * CL för ett anfall eller en parering: FV, lägesmodifikationer, skador och effekter.
 * Med 2 KP kvar halveras CL. I mörker är CL alltid minst 1. Null betyder att det inte går.
 */
function computeCl(
  g: Game,
  a: Actor,
  kind: 'anfall' | 'parering',
  skill: string,
  arms: HitLocation[],
  situational: [string, number][],
  slot?: string,
  halve?: string,
  preHalve?: string,
): Cl | null {
  if (arms.some((loc) => !limbUsable(a, loc))) return null;
  const attr = SKILLS[skill.split(':')[0]]?.attr;
  if (attr === 'SMI' && smiBlocked(g, a)) return null;
  const fv = g.skillFv(a, skill);
  const notes: string[] = [];
  const used: ActiveEffect[] = [];
  let mod = 0;
  let dark = false;
  // Rörligt mål: CL halveras (uppåt) innan andra modifikationer läggs på.
  if (preHalve) {
    mod -= Math.floor(fv / 2);
    notes.push(preHalve);
  }
  const load = loadPenalty(g, a, skill);
  if (load) {
    mod += load;
    notes.push(`${signed(load)} börda`);
  }
  const magic = slot ? weaponMagic(a, slot) : 0;
  if (magic && (slot === 'shield' ? kind === 'parering' : kind === 'anfall')) {
    mod += magic;
    notes.push(`${signed(magic)} ${magic > 0 ? 'förtrollat' : 'förbannat'}`);
  }
  for (const [label, v] of situational) {
    if (!v) continue;
    mod += v;
    notes.push(`${signed(v)} ${label}`);
    if (label === 'mörker' || label === 'fackelsken') dark = true;
  }
  const wound = woundPenalty(a, arms);
  if (wound) {
    mod += wound;
    notes.push(`${signed(wound)} skador`);
  }
  let halfSmi = false;
  for (const e of clEffects(a)) {
    if (!scopeMatches(e.scope, kind, skill, slot, e.slot)) continue;
    if (e.half) halfSmi = true;
    else {
      mod += e.mod ?? 0;
      notes.push(`${signed(e.mod ?? 0)} ${e.label.toLowerCase().replace(/[.:].*$/, '')}`);
    }
    used.push(e);
  }
  let cl = fv + mod;
  if (halfSmi) {
    cl = Math.floor(cl / 2);
    notes.push('halverad');
  }
  if (halve) {
    cl = Math.floor(cl / 2);
    notes.push(halve);
  }
  if (a.kp <= 2) {
    cl = Math.floor(cl / 2);
    notes.push('halverad vid 2 KP');
  }
  if (dark) cl = Math.max(1, cl);
  return { fv, cl, notes, used };
}

function rollCl(g: Game, x: Cl): Check {
  return skillCheck(x.fv, g.rng, x.cl - x.fv);
}

/** Effekter som gör att alla anfall (eller pareringar) misslyckas. Förbrukar ett slag. */
function autoFail(a: Actor, kind: 'anfall' | 'parering'): boolean {
  const e = a.effects.find((x) => x.kind === 'misslyckas' && (x.scope === 'strid' || x.scope === kind));
  if (!e) return false;
  consume(a, e);
  return true;
}

function forceFail(c: Check): Check {
  return c.success ? { ...c, result: 'misslyckat', success: false } : c;
}

// ------------------------------------------------------------------ anfall

/** Kan aktören anfalla den här rundan med sitt vapen? */
export function canAttackNow(a: Actor): boolean {
  return canUseSkills(a) && !hasEffect(a, 'endastParera') && limbUsable(a, a.swordArm);
}

/** Kan `att` nå `def` med sitt vapen härifrån? */
export function inReach(g: Game, att: Actor, def: Actor): boolean {
  const d = distance(att.x, att.y, def.x, def.y);
  const reach = weaponInfo(att).reach;
  return d >= 1 && d <= reach && (d === 1 || lineOfSight(g.map, att.x, att.y, def.x, def.y));
}

/** Rollpersonens anfall, med Två vapen om hen har ett vapen i varje hand. */
export function playerAttack(g: Game, target: Actor) {
  const p = g.player;
  let both = false;
  if (p.offhand && limbUsable(p, shieldArm(p)) && p.skills.tva_vapen !== undefined) {
    const tv = skillCheck(g.skillFv(p, 'tva_vapen'), g.rng);
    both = tv.success;
    g.gainExperience(p, 'tva_vapen', tv);
    g.log(`Två vapen (${short(tv)}): ${both ? 'anfaller med båda vapnen' : 'bara med svärdshanden'}.`);
  }
  attackOnce(g, p, target, 'weapon');
  if (both && target.alive && !isOut(target) && p.offhand && canAttackNow(p)) attackOnce(g, p, target, 'offhand');
}

/** Ett anfall och försvararens parering, enligt resultattabellen (Bok II s. 17). */
export function attackOnce(g: Game, att: Actor, def: Actor, slot: WeaponSlot) {
  const c = g.state.combat;
  const w = weaponInfo(att, slot);
  face(att, def.x, def.y);

  const situational: [string, number][] = [];
  const orörlig = def.unconscious || hasEffect(def, 'ingenHandling') || hasEffect(def, 'rankor');
  if (orörlig) situational.push(['orörligt mål', MELEE_MODS['Målet orörligt']]);
  else if (hasEffect(def, 'liggande')) situational.push(['liggande mål', MELEE_MODS['Målet ligger ned']]);
  const flank = flankMod(att, def);
  if (flank) situational.push([flank === 7 ? 'bakifrån' : 'från sidan', flank]);
  const aim = att.id === g.state.playerId && def.detailed ? (c?.aim ?? null) : null;
  if (aim) situational.push([`siktar på ${aim}`, MELEE_MODS['Sikte på viss kroppsdel']]);
  const light = lightMod(g, att, def);
  if (light) situational.push([light === -15 ? 'mörker' : 'fackelsken', light]);
  const bonuses = def.effects.filter((e) => e.kind === 'motståndarBonus');
  for (const b of bonuses) situational.push(['motståndarens miss', b.mod ?? 0]);

  const x = computeCl(g, att, 'anfall', w.skill, armsFor(att, slot, w), situational, slot);
  if (!x) {
    g.log(`${att.name} kan inte använda ${w.name.toLowerCase()}.`);
    return;
  }
  for (const b of bonuses) consume(def, b);
  for (const e of x.used) consume(att, e);

  const exposed = def.effects.find((e) => e.kind === 'utsatt');
  let check: Check;
  if (exposed) {
    def.effects = def.effects.filter((e) => e !== exposed);
    check = { roll: 0, rolls: [], target: x.cl, fv: x.fv, result: 'lyckat', success: true, diff: 0, automatic: true };
  } else {
    check = rollCl(g, x);
    if (autoFail(att, 'anfall')) check = forceFail(check);
    // Kättingvapen och piskor: 18–20 är en miss, och 1T20 över FV är fummel.
    if (w.entangling && check.roll >= ENTANGLING_MISS && check.result !== 'fummel') {
      const again = die(20, g.rng);
      check = { ...check, rolls: [...check.rolls, again], result: again > x.fv || again === 20 ? 'fummel' : 'misslyckat', success: false };
    }
  }
  wear(g, att, w.bvKey);

  const mods = x.notes.length ? `, ${x.notes.join(', ')}` : '';
  const head = `${att.name} anfaller ${def.name} med ${w.name.toLowerCase()} (${check.automatic ? 'lyckas automatiskt' : `T20: ${check.roll} mot ${x.cl}`}${mods})`;

  if (check.result === 'fummel') {
    g.log(`${head}: fummel!`);
    g.emit(att.id, 'Fummel!', 'miss');
    fumble(g, att, w.natural ? 'obeväpnad' : 'närstrid', slot);
    return;
  }
  if (check.result === 'perfekt') {
    att.effects = att.effects.filter((e) => !(e.untilPerfect && e.kind === 'cl'));
    g.log(`${head}: perfekt! Maximal skada, går inte att parera och rustningen hjälper inte.`);
    hit(g, att, def, w, { perfect: true, aim });
    return;
  }

  g.gainExperience(att, w.skill, check);
  // Husregel: ett misslyckat anfall behöver inte pareras.
  if (!check.success) {
    g.log(`${head}: miss.`);
    g.emit(def.id, 'Miss', 'miss');
    return;
  }

  if (airShield(g, def, `${head}: träff`)) return;
  const parry = exposed?.noParry ? null : tryParry(g, def, att, w);
  if (parry) {
    if (parry.check.result === 'fummel') {
      g.log(`${head}: träff! ${def.name} fumlar med pareringen (${parry.text}).`);
      fumble(g, def, parry.table, parry.slot);
    } else if (parry.check.success) {
      // Husregel: en lyckad parering stoppar all skada. Föremålet kan ändå tappa BV.
      g.log(`${head}: träff, men ${def.name} parerar${parry.check.result === 'perfekt' ? ' perfekt' : ''} med ${parry.name} (${parry.text}).`);
      g.emit(def.id, 'Parerat', 'miss');
      if (parry.check.result !== 'perfekt' && parry.bvKey && !w.noParryWear && def.bv[parry.bvKey] !== undefined) {
        const dmg = rollDamage(g, att, w, false);
        if (dmg > def.bv[parry.bvKey]) wearItem(g, def, parry.bvKey, 'tar skada av hugget');
      }
      return;
    } else {
      g.log(`${head}: träff! ${def.name} misslyckas med pareringen (${parry.text}).`);
    }
  } else {
    g.log(`${head}: träff!`);
  }
  hit(g, att, def, w, { aim });
}

interface Parry {
  check: Check;
  name: string;
  text: string;
  slot: WeaponSlot | 'shield';
  bvKey: string | null;
  table: FumbleTable;
  unarmed: boolean;
}

/**
 * Försvararen parerar om hen kan. Husregel: efter den första pareringen i rundan blir det −5,
 * −10 och så vidare; skölden ger en extra parering utan avdrag. Det alternativ som ger högst CL
 * används.
 */
function tryParry(g: Game, def: Actor, att: Actor, aw: WeaponInfo, onlyShield = false): Parry | null {
  const c = g.state.combat;
  if (!def.detailed || !canUseSkills(def) || hasEffect(def, 'ingenParering')) return null;
  const prone = hasEffect(def, 'liggande');
  const used = c ? (c.parries[def.id] ??= { count: 0, shieldFree: false }) : { count: 0, shieldFree: false };
  const light = lightMod(g, def, att);
  const halve = aw.entangling ? 'halverad mot kätting' : undefined;

  type Option = { x: Cl; skill: string; slot: WeaponSlot | 'shield'; name: string; bvKey: string | null; table: FumbleTable; unarmed: boolean; free: boolean };
  const options: Option[] = [];
  const penalty = PARRY_PENALTY * used.count;
  const sit = (p: number): [string, number][] => [
    ['mörker', light === -15 ? light : 0],
    ['fackelsken', light === -5 ? light : 0],
    ['fler pareringar', p],
  ];
  for (const slot of ['weapon', 'offhand'] as const) {
    if (onlyShield) break;
    if (slot === 'offhand' && !def.offhand) continue;
    const w = weaponInfo(def, slot);
    // Obeväpnad kan bara parera obeväpnade anfall. Liggande kan bara strida med korta vapen.
    if (w.natural && !(aw.natural && w.unarmed)) continue;
    if (prone && !w.natural && !['dolk', 'parerdolk', 'kortsvard'].includes(w.id)) continue;
    const x = computeCl(g, def, 'parering', w.skill, armsFor(def, slot, w), sit(penalty), slot, halve);
    if (x) options.push({ x, skill: w.skill, slot, name: w.name.toLowerCase(), bvKey: w.bvKey, table: w.natural ? 'obeväpnad' : 'närstrid', unarmed: w.natural, free: false });
  }
  const shield = def.shield ? SHIELDS[def.shield] : undefined;
  const main = weaponInfo(def, 'weapon');
  if (shield && !prone && shield.styReq <= def.attrs.STY && !main.twoHanded) {
    const free = !used.shieldFree;
    const x = computeCl(g, def, 'parering', 'skoldar', armsFor(def, 'shield'), sit(free ? 0 : penalty), 'shield', halve);
    if (x) options.push({ x, skill: 'skoldar', slot: 'shield', name: shield.name.toLowerCase(), bvKey: 'shield', table: 'sköld', unarmed: false, free });
  }
  if (!options.length) return null;
  const best = options.reduce((a, b) => (b.x.cl > a.x.cl ? b : a));
  for (const e of best.x.used) consume(def, e);
  if (best.free) used.shieldFree = true;
  else used.count++;

  let check = rollCl(g, best.x);
  if (autoFail(def, 'parering')) check = forceFail(check);
  g.gainExperience(def, best.skill, check);
  if (best.slot !== 'shield') wear(g, def, best.bvKey);
  if (check.result === 'perfekt') def.effects = def.effects.filter((e) => !(e.untilPerfect && e.kind === 'cl'));
  const mods = best.x.notes.length ? `, ${best.x.notes.join(', ')}` : '';
  return {
    check,
    name: best.name,
    text: `T20: ${check.roll} mot ${best.x.cl}${mods}`,
    slot: best.slot,
    bvKey: best.bvKey,
    table: best.table,
    unarmed: best.unarmed,
  };
}

/** Träff: träffområde, skada, rustning och sårverkan. */
function hit(
  g: Game,
  att: Actor,
  def: Actor,
  w: WeaponInfo,
  opts: { perfect?: boolean; damage?: number; aim?: HitLocation | null; table?: 'närstrid' | 'avstånd'; shieldFrom?: Actor },
) {
  const perfect = !!opts.perfect;
  const dmg = opts.damage ?? rollDamage(g, att, w, perfect);
  if (!def.detailed) {
    const abs = perfect ? 0 : def.naturalArmor + magicArmor(def);
    const dealt = Math.max(0, dmg - abs);
    g.log(dealt > 0 ? `${def.name} tar ${dealt} i skada${abs ? ` (${dmg} − ${abs} i skydd)` : ''}.` : `Skyddet tar hela skadan.`);
    g.emit(def.id, dealt > 0 ? `-${dealt}` : '0', 'damage');
    if (dealt > 0) poisonOnHit(g, att, def, null);
    wound(g, def, dealt, null);
    return;
  }
  const loc = opts.aim ?? lookup(HIT_TABLE[opts.table ?? 'närstrid'], die(20, g.rng))!;
  // Sköldar och projektiler (Bok III s. 38): skölden tar träffen om den täcker kroppsdelen och vetter mot skytten.
  if (opts.shieldFrom && shieldCovers(def, loc) && flankMod(opts.shieldFrom, def) < MELEE_MODS['Anfall bakifrån']) {
    g.log(`Projektilen fastnar i ${def.name}s ${SHIELDS[def.shield!].name.toLowerCase()} (${loc}).`);
    g.emit(def.id, 'Skölden', 'miss');
    if (def.bv.shield !== undefined && dmg > def.bv.shield) wearItem(g, def, 'shield', 'tar skada');
    return;
  }
  const piece = armorPiece(def, loc);
  const abs = perfect ? 0 : def.naturalArmor + (piece?.abs ?? 0) + magicArmor(def);
  const dealt = Math.max(0, dmg - abs);
  const absText = abs ? ` (${dmg} − ${abs} för ${piece ? piece.name.toLowerCase() : 'skyddet'})` : '';
  g.log(dealt > 0 ? `Träff i ${loc}: ${dealt} i skada${absText}.` : `Träff i ${loc}, men ${piece?.name.toLowerCase() ?? 'skyddet'} tar hela skadan.`);
  g.emit(def.id, dealt > 0 ? `-${dealt}` : '0', 'damage');
  // Husregel: rustningsdelen tappar 1 BV när skadan överstiger dess abs.
  if (!perfect && piece && dmg > piece.abs) wearItem(g, def, piece.id, 'tar skada');
  const kind = woundKind(w.id, w.natural, w.unarmed);
  if (dealt > 0 && kind && def.kind === 'player') def.combatWounds.push({ loc, dmg: dealt, kind });
  if (dealt > 0) poisonOnHit(g, att, def, loc);
  wound(g, def, dealt, loc);
}

/** Kroppsdelar som skölden täcker: 'sköldarm' och 'sköldben' är på sköldsidan. */
export function shieldCovers(a: Actor, loc: HitLocation): boolean {
  const s = a.shield ? SHIELDS[a.shield] : undefined;
  if (!s || !limbUsable(a, shieldArm(a)) || (a.bv.shield ?? 1) <= 0) return false;
  const arm = shieldArm(a);
  const leg: HitLocation = arm === 'vänster arm' ? 'vänster ben' : 'höger ben';
  return s.covers.some((c) => (c === 'sköldarm' ? arm : c === 'sköldben' ? leg : c) === loc);
}

// ------------------------------------------------------------------ skador

/** Drar skada från en kroppsdel (om någon) och från totala KP, och avgör följderna. */
export function wound(g: Game, a: Actor, dmg: number, loc: HitLocation | null) {
  if (dmg <= 0 || !a.alive) return;
  const awake = !a.unconscious;
  a.kp -= dmg;
  breakConcentration(g, a);
  if (loc && a.detailed) {
    a.locKp[loc] -= dmg;
    checkLocation(g, a, loc);
  }
  if (a.alive) checkTotal(g, a);
  if (awake && a.unconscious && a.alive) forgetOnKnockout(g, a);
}

function checkLocation(g: Game, a: Actor, loc: HitLocation) {
  if (a.locKp[loc] <= 0 && !a.bleeding.includes(loc)) {
    a.bleeding.push(loc);
    g.log(`${a.name}s ${loc} blöder.`);
  }
  if (a.locKp[loc] <= 0 && !a.disabled.includes(loc)) {
    a.disabled.push(loc);
    if (loc === 'huvud') {
      a.unconscious = true;
      g.log(`${a.name} faller medvetslös av huvudträffen.`);
    } else if (loc === 'bröstkorg' || loc === 'mage') {
      a.down = true;
      g.log(`${a.name} segnar ihop och kan bara krypa.`);
    } else {
      const psy = attributeCheck(a.attrs.PSY, g.rng, LIMB_PSY_CHECK);
      if (psy.success) g.log(`${a.name}s ${loc} går inte att använda, men hen biter ihop och strider vidare (Svårt PSY-slag, ${short(psy)}).`);
      else {
        a.down = true;
        g.log(`${a.name}s ${loc} går inte att använda och smärtan tar över (Svårt PSY-slag, ${short(psy)}).`);
      }
    }
  }
  if (a.locKp[loc] <= -a.locMax[loc] && !a.critical.includes(loc)) {
    a.critical.push(loc);
    if (loc === 'huvud') {
      g.log(`Kritisk skada: ${a.name}s huvud krossas.`);
      kill(g, a);
    } else if (loc === 'bröstkorg' || loc === 'mage') {
      a.unconscious = true;
      addEffect(a, { kind: 'dödsfara', label: `Kritisk skada i ${loc}: förblöder`, rounds: a.attrs.FYS });
      g.log(`Kritisk skada i ${a.name}s ${loc}! Hen faller medvetslös och förblöder inom ${a.attrs.FYS} rundor.`);
    } else {
      const crit = lookup(CRITICAL_LIMB, die(10, g.rng))!;
      a.injuries.push({ loc, id: crit.id, text: crit.text, cl: crit.cl, lost: crit.lost, legMove: LEGS.includes(loc) ? crit.legMove : undefined });
      g.log(`Kritisk skada i ${a.name}s ${loc}: ${crit.text}`);
    }
  }
}

function checkTotal(g: Game, a: Actor) {
  if (a.kp <= -a.attrs.FYS) {
    kill(g, a);
    return;
  }
  if (a.kp <= 0 && !a.unconscious) {
    a.unconscious = true;
    g.log(`${a.name} faller medvetslös.`);
  } else if (a.kp === 1 && !a.down) {
    g.log(`${a.name} har bara 1 KP kvar och kan inte strida.`);
  }
}

export function kill(g: Game, a: Actor) {
  if (!a.alive) return;
  a.alive = false;
  a.unconscious = false;
  if (a.id === g.state.playerId) {
    g.state.mode = 'dead';
    g.state.combat = null;
    g.log(`☠ ${a.name} dör. Äventyret är slut.`);
    return;
  }
  g.log(`${a.name} dör.`);
  if (a.deathFlag) g.state.flags[a.deathFlag] = true;
  const p = g.player;
  if (a.silver > 0 && p.alive) {
    p.silver += a.silver;
    g.log(`Du hittar ${a.silver} silvermynt hos ${a.name}.`);
    a.silver = 0;
  }
  if (a.weapon && WEAPONS[a.weapon]) g.state.dropped.push({ item: a.weapon, slot: 'weapon', owner: a.id, x: a.x, y: a.y, bv: a.bv.weapon });
  if (a.ranged && WEAPONS[a.ranged]) {
    g.state.dropped.push({ item: a.ranged, slot: 'weapon', owner: a.id, x: a.x, y: a.y });
    const ammo = AMMUNITION[a.ranged];
    if (ammo && (a.rangedAmmo ?? 0) > 0 && p.alive) {
      const ch = g.state.character;
      ch.ammo[ammo.item] = (ch.ammo[ammo.item] ?? 0) + a.rangedAmmo!;
      g.log(`Du tar ${a.rangedAmmo} ${ammo.item} från ${a.name}.`);
      a.rangedAmmo = 0;
    }
  }
  if (a.shield) g.state.dropped.push({ item: a.shield, slot: 'shield', owner: a.id, x: a.x, y: a.y, bv: a.bv.shield });
}

// ------------------------------------------------------------------ tabeller och följder

/** Slår på en fummeltabell. 'Närmsta vän' slås om när det inte finns följeslagare (husregel). */
export function fumble(g: Game, a: Actor, table: FumbleTable, slot: WeaponSlot | 'shield') {
  const rows = FUMBLE_TABLES[table];
  const pick = (allowDouble: boolean): number => {
    for (;;) {
      const n = die(20, g.rng);
      if (n === 20 && !allowDouble) continue;
      if (rows[n - 1].effects.some((e) => e.kind === 'vän')) continue;
      return n;
    }
  };
  const first = pick(true);
  const results = first === 20 ? [pick(false), pick(false)] : [first];
  if (first === 20) g.log(`Fummeltabell (${table}) 20: ${rows[19].text} Två slag till.`);
  for (const n of results) {
    const row = rows[n - 1];
    g.log(`Fummeltabell (${table}) ${n}: ${row.text}`);
    applyRow(g, a, row, { slot });
  }
}

interface OutcomeContext {
  slot?: WeaponSlot | 'shield';
  source?: Actor;
}

function resolve(v: number | string | undefined, g: Game): number | undefined {
  if (v === undefined) return undefined;
  return typeof v === 'number' ? v : roll(v, g.rng);
}

export function applyRow(g: Game, a: Actor, row: TableRow, ctx: OutcomeContext) {
  for (const o of row.effects) applyOutcome(g, a, o, row.text, ctx);
}

function applyOutcome(g: Game, a: Actor, o: Outcome, label: string, ctx: OutcomeContext) {
  const dur = (x: { rounds?: number | string; days?: number | string; uses?: number; untilPerfect?: boolean; untilFixed?: boolean; untilRest?: boolean; whileSource?: boolean }) => ({
    rounds: resolve(x.rounds, g),
    days: resolve(x.days, g),
    uses: x.uses,
    untilPerfect: x.untilPerfect,
    untilFixed: x.untilFixed,
    untilRest: x.untilRest,
    sourceId: x.whileSource ? ctx.source?.id : undefined,
  });
  const weaponSlot = ctx.slot === 'shield' ? undefined : ctx.slot;
  switch (o.kind) {
    case 'ingenting':
    case 'tvåGånger':
    case 'vän':
      return;
    case 'cl': {
      const half = o.mod === 'halv';
      const mod = half ? undefined : typeof o.mod === 'number' ? o.mod : -roll(o.mod, g.rng);
      addEffect(a, { kind: 'cl', label, mod, half, scope: o.scope, slot: o.scope === 'vapen' ? weaponSlot : undefined, ...dur(o) });
      return;
    }
    case 'misslyckas':
      addEffect(a, { kind: 'misslyckas', label, scope: o.scope, ...dur(o) });
      return;
    case 'endastParera':
    case 'ingenHandling':
    case 'ingenParering':
    case 'liggande':
    case 'bärsärk':
      addEffect(a, { kind: o.kind, label, ...dur(o) });
      return;
    case 'flyr':
      addEffect(a, { kind: 'flyr', label, random: o.random, ...dur(o), sourceId: ctx.source?.id });
      return;
    case 'medvetslös': {
      const awake = !a.unconscious;
      a.unconscious = true;
      addEffect(a, { kind: 'medvetslös', label, ...dur(o) });
      if (awake) forgetOnKnockout(g, a);
      return;
    }
    case 'motståndarBonus':
      addEffect(a, { kind: 'motståndarBonus', label, mod: o.mod, ...dur(o) });
      return;
    case 'utsatt':
      addEffect(a, { kind: 'utsatt', label, noParry: o.noParry, uses: 1 });
      return;
    case 'förflyttning':
      addEffect(a, { kind: 'förflyttning', label, mod: o.mod === 'halv' ? undefined : o.mod, half: o.mod === 'halv', ...dur(o) });
      return;
    case 'skräckMod':
      addEffect(a, { kind: 'skräckMod', label, mod: o.mod, ...dur(o) });
      return;
    case 'vapenSönder':
      if (a.bv[weaponSlot ?? 'weapon'] !== undefined || WEAPONS[a.weapon]) {
        g.log(`${a.name}s ${weaponInfo(a, weaponSlot).name.toLowerCase()} är förstört.`);
        unequip(g, a, weaponSlot ?? 'weapon');
      }
      return;
    case 'sköldSönder':
      if (a.shield) {
        g.log(`${a.name}s ${SHIELDS[a.shield].name.toLowerCase()} är förstörd.`);
        unequip(g, a, 'shield');
      }
      return;
    case 'tappaVapen':
      drop(g, a, weaponSlot ?? 'weapon', o.distance);
      return;
    case 'tappaSköld':
      drop(g, a, 'shield', o.distance);
      return;
    case 'tappaRustning': {
      const loc = lookup(HIT_TABLE.närstrid, die(20, g.rng))!;
      const piece = a.armor.find((id) => ARMOR[id]?.covers.includes(loc));
      if (piece) {
        g.log(`${a.name} tappar ${ARMOR[piece].name.toLowerCase()} (${loc}).`);
        drop(g, a, piece, '0');
      } else g.log(`${a.name} har ingen rustning på ${loc}, så inget faller av.`);
      return;
    }
    case 'sköldarmUr':
      addEffect(a, { kind: 'armUr', label, rounds: MAX_ROUNDS });
      return;
    case 'skada': {
      const loc = o.loc === 'ben' ? LEGS[die(2, g.rng) - 1] : o.loc === 'svärdsarm' ? a.swordArm : o.loc;
      wound(g, a, o.kp, a.detailed ? loc : null);
      return;
    }
    case 'kvävs':
      addEffect(a, { kind: 'dödsfara', label: 'Kvävs', rounds: o.rounds });
      return;
    case 'fobi': {
      const ch = g.state.character;
      if (a.id === g.state.playerId) (ch.phobias ??= []).push({ source: ctx.source?.name ?? 'okänt', level: o.level });
      return;
    }
    case 'grundegenskaper': {
      for (const k of ATTR_KEYS) {
        if (k === 'STO' || die(20, g.rng) < 19) continue;
        const loss = die(2, g.rng);
        a.attrs[k] = Math.max(1, a.attrs[k] - loss);
        if (a.id === g.state.playerId) g.state.character.attrs[k] = a.attrs[k];
        g.log(`${a.name}s ${k} sjunker med ${loss} för alltid.`);
      }
      return;
    }
    case 'hjärtattack': {
      const fys = attributeCheck(a.attrs.FYS, g.rng, o.difficulty);
      g.log(`${o.difficulty} FYS-slag (${short(fys)}): ${fys.success ? 'överlever' : 'hjärtat stannar'}.`);
      if (!fys.success) kill(g, a);
      else {
        a.unconscious = true;
        addEffect(a, { kind: 'medvetslös', label: 'Medvetslös efter hjärtattack', rounds: roll('1T8', g.rng) * 720 });
      }
      return;
    }
    case 'sänkInt': {
      const loss = roll(o.amount, g.rng);
      a.attrs.INT = Math.max(1, a.attrs.INT - loss);
      if (a.id === g.state.playerId) g.state.character.attrs.INT = a.attrs.INT;
      g.log(`${a.name}s INT sjunker med ${loss}.`);
      return;
    }
    case 'koma':
      if (a.id === g.state.playerId) {
        g.log(`${a.name} faller i djup koma i ${roll('1T8', g.rng)} månader.`);
        g.state.mode = 'dead';
        g.state.combat = null;
      } else a.unconscious = true;
      return;
  }
}

// ------------------------------------------------------------------ skräck och moral

/** Rollpersonen slår på Skräcktabellen för en varelse (automatiskt eller aktivt skräckslag). */
export function scare(g: Game, victim: Actor, source: Actor, value: number) {
  if (hasEffect(victim, 'orädd')) {
    g.log(`${source.name} försöker injaga skräck, men ${victim.name} är orädd.`);
    return;
  }
  const mods: number[] = [];
  if (g.state.fearMet.includes(source.defId)) mods.push(-2);
  for (const e of victim.effects) if (e.kind === 'skräckMod') mods.push(e.mod ?? 0);
  const r = fearRoll(victim.attrs.PSY, value, mods, g.rng);
  const row = fearRow(r.result);
  g.log(`${source.name} injagar skräck! Skräcktabellen: T20 ${r.die} − PSY ${victim.attrs.PSY} + ${value} = ${r.result}. ${row.text}`);
  if (!g.state.fearMet.includes(source.defId)) g.state.fearMet.push(source.defId);
  applyRow(g, victim, row, { source });
}

/** Moralslag: 1T20 mot PSY + modifikationer. Lyckas det står varelsen kvar (husregel). */
export function moraleCheck(g: Game, a: Actor, reason: string): boolean {
  const c = g.state.combat!;
  const group = c.order.map((id) => g.actor(id)!).filter((x) => x.hostile && x.id !== a.id);
  const comrades = group.filter((x) => !isOut(x)).length;
  const fled = group.filter((x) => x.fled).length;
  const leader = group.find((x) => x.leader);
  let mod = comrades * MORALE_MODS.kamrat + fled * MORALE_MODS.flydd;
  if (!isOut(g.player)) mod += MORALE_MODS.motståndare;
  if (leader && isOut(leader)) mod += MORALE_MODS.ledareBorta;
  else if (leader && leader.kp < leader.maxKp) mod += MORALE_MODS.ledareSårad;
  if (a.kp < a.maxKp / 2) mod += MORALE_MODS.halvaKp;
  const d = die(20, g.rng);
  const target = a.attrs.PSY + mod;
  const stays = d === 1 || (d !== 20 && d <= target);
  g.log(`${a.name} slår moral (${reason}, T20: ${d} mot ${target}): ${stays ? 'står kvar' : 'flyr!'}`);
  if (!stays) addEffect(a, { kind: 'flyr', label: 'Flyr', rounds: MAX_ROUNDS });
  return stays;
}

function checkMorale(g: Game) {
  const c = g.state.combat!;
  const hostiles = c.order.map((id) => g.actor(id)!).filter((x) => x.hostile && x.kind !== 'player');
  const out = hostiles.filter(isOut).length;
  for (const a of hostiles) {
    if (isOut(a) || a.noMorale || a.attrs.INT === 0 || hasEffect(a, 'flyr')) continue;
    const reasons: string[] = [];
    if (hostiles.some((x) => x.leader && x !== a && isOut(x))) reasons.push('ledaren har fallit');
    if (hostiles.length > 1 && out * 2 >= hostiles.length) reasons.push('hälften av gruppen är borta');
    if (a.kp < a.maxKp / 2) reasons.push('har förlorat mer än halva KP');
    for (const r of reasons) {
      if (a.morale.includes(r)) continue;
      a.morale.push(r);
      if (!moraleCheck(g, a, r)) break;
    }
  }
}

function checkFear(g: Game) {
  const c = g.state.combat!;
  const p = g.player;
  if (!canAct(p)) return;
  for (const id of c.order) {
    const a = g.actor(id)!;
    const auto = a.fear?.[0];
    if (auto === null || auto === undefined || !a.alive || a.fled || c.scared.includes(a.id)) continue;
    if (!g.isVisible(a.x, a.y)) continue;
    c.scared.push(a.id);
    scare(g, p, a, auto);
  }
}

// ------------------------------------------------------------------ rundor och turordning

export function participants(g: Game): Actor[] {
  return (g.state.combat?.order ?? []).map((id) => g.actor(id)!).filter(Boolean);
}

/** Fiender som fortfarande kan strida. */
export function activeHostiles(g: Game): Actor[] {
  return participants(g).filter((a) => a.hostile && a.kind !== 'player' && !isOut(a));
}

/** Initiativ: 1T10 + SMI + modifikationer. Snabbslående agerar alltid först. Lika slås om. */
function rollInitiative(g: Game, c: CombatState) {
  const rolls = c.order
    .map((id) => g.actor(id)!)
    .map((a) => ({ a, value: roll(INITIATIVE_DIE, g.rng) + Math.max(1, a.attrs.SMI + (loadMod(g, a) ?? 0)) + a.initiative, tie: g.rng() }));
  rolls.sort((l, r) => Number(!!r.a.firstAlways) - Number(!!l.a.firstAlways) || r.value - l.value || r.tie - l.tie);
  c.order = rolls.map((r) => r.a.id);
  c.initiative = Object.fromEntries(rolls.map((r) => [r.a.id, r.value]));
}

export function startCombat(g: Game, enemies: Actor[]) {
  const p = g.player;
  const bystanders = g.state.actors.filter(
    (a) => a.alive && !a.hostile && a.kind !== 'player' && !enemies.includes(a) && g.isVisible(a.x, a.y),
  );
  const c: CombatState = {
    round: 1,
    order: [p, ...enemies, ...bystanders].map((a) => a.id),
    initiative: {},
    turn: -1,
    movesLeft: 0,
    acted: {},
    parries: {},
    aim: null,
    scared: [],
  };
  g.state.mode = 'combat';
  g.state.combat = c;
  for (const e of enemies) face(e, p.x, p.y);
  face(p, enemies[0].x, enemies[0].y);
  const names = [...new Set(enemies.map((e) => e.name))].join(', ');
  g.log(`⚔ Strid! ${names}.`);
  // Husregel: rollpersonerna slår Dra vapen. De som lyckas får en gratis tur före första rundan.
  const drawn = party(g).filter((a) => {
    if (!canUseSkills(a)) return false;
    const check = skillCheck(g.skillFv(a, 'dra_vapen'), g.rng, skillMod(g, a, 'dra_vapen'));
    g.log(`${a.name} slår Dra vapen (${short(check)}): ${check.success ? 'gratis handling före första rundan!' : 'misslyckas'}.`);
    if (check.success) g.gainExperience(a, 'dra_vapen', check);
    return check.success;
  });
  if (drawn.length) {
    c.round = 0;
    c.freeRound = drawn.map((a) => a.id);
  }
  rollInitiative(g, c);
  logRound(g, c);
  checkFear(g);
  nextTurn(g);
}

/** Rollpersonerna: i dag bara huvudpersonen, senare också följeslagare. */
export function party(g: Game): Actor[] {
  return g.state.actors.filter((a) => a.kind === 'player' && a.alive);
}

function logRound(g: Game, c: CombatState) {
  const order = c.order
    .map((id) => g.actor(id)!)
    .filter((a) => a.hostile || a.kind === 'player')
    .map((a) => `${a.name} ${c.initiative[a.id]}`)
    .join(', ');
  if (c.freeRound && c.round === 0) {
    const free = c.order.filter((id) => c.freeRound!.includes(id)).map((id) => `${g.actor(id)!.name} ${c.initiative[id]}`);
    g.log(`— Gratisrunda (Dra vapen) — ${free.join(', ')}`);
  } else g.log(`— Runda ${c.round} — Initiativ: ${order}`);
}

/** Startar nästa runda. Returnerar false om striden tog slut. */
function newRound(g: Game): boolean {
  const c = g.state.combat!;
  const p = g.player;
  const enemies = g.state.actors.filter(
    (a) => a.alive && a.hostile && !a.fled && a.kind !== 'player' && (g.canSee(a, p) || (c.order.includes(a.id) && distance(a.x, a.y, p.x, p.y) <= 10)),
  );
  if (!enemies.some((e) => !isOut(e)) || c.round >= MAX_ROUNDS) {
    endCombat(g, 'Striden är över.');
    return false;
  }
  for (const e of enemies) {
    if (!c.order.includes(e.id)) {
      c.order.push(e.id);
      g.log(`${e.name} ansluter till striden!`);
    }
  }
  c.order = c.order.filter((id) => {
    const a = g.actor(id)!;
    return id === p.id || (a.alive && !a.fled && (!a.hostile || enemies.includes(a)));
  });
  c.round++;
  c.turn = -1;
  g.state.time += ROUND_SECONDS;
  c.acted = {};
  c.parries = {};
  for (const a of participants(g)) tick(g, a);
  if (g.state.mode !== 'combat') return false;
  // Magi går före slagväxling: besvärjelser från förra rundan verkar nu.
  resolvePending(g);
  if (g.state.mode !== 'combat') return false;
  if (!activeHostiles(g).length) {
    endCombat(g, 'Striden är över.');
    return false;
  }
  rollInitiative(g, c);
  logRound(g, c);
  checkMorale(g);
  checkFear(g);
  return g.state.mode === 'combat';
}

/** En runda går: effekter räknas ned och blödningar tar KP. Används också för varje steg utanför strid. */
export function tick(g: Game, a: Actor) {
  if (!a.alive) return;
  const visible = (id?: string) => {
    if (!id) return true;
    const s = g.actor(id);
    return !!s && s.alive && !s.fled && g.isVisible(s.x, s.y);
  };
  const keep: ActiveEffect[] = [];
  for (const e of a.effects) {
    if (e.sourceId && !visible(e.sourceId)) continue;
    if (e.rounds !== undefined) {
      e.rounds--;
      if (e.rounds <= 0) {
        if (e.kind === 'dödsfara') {
          g.log(`${e.label}: ingen kommer till ${a.name}s undsättning.`);
          kill(g, a);
          return;
        }
        if (e.kind === 'liggande' && a.id === g.state.playerId) g.log(`${a.name} reser sig.`);
        onExpire(g, a, e);
        continue;
      }
    }
    keep.push(e);
  }
  a.effects = keep;
  breakFree(g, a);
  updatePoisons(g, a);
  if (!a.alive) return;
  if (a.unconscious && !hasEffect(a, 'medvetslös') && a.kp > 0 && (!a.detailed || a.locKp.huvud > 0) && !hasEffect(a, 'dödsfara')) {
    a.unconscious = false;
    g.log(`${a.name} vaknar.`);
  }
  if (a.bleeding.length) {
    a.bleedTimer++;
    if (a.bleedTimer % BLEED_INTERVAL === 0) {
      g.log(`${a.name} blöder (−${a.bleeding.length} KP).`);
      wound(g, a, a.bleeding.length, null);
    }
  }
}

export function nextTurn(g: Game) {
  for (let guard = 0; guard < 10000; guard++) {
    const c = g.state.combat;
    if (!c || g.state.mode !== 'combat') return;
    c.turn++;
    if (c.turn >= c.order.length) {
      if (!newRound(g)) return;
      continue;
    }
    const a = g.actor(c.order[c.turn])!;
    if (!a.alive || a.fled) continue;
    if (c.round === 0 && !c.freeRound?.includes(a.id)) continue;
    c.movesLeft = effectiveMove(a, g);
    a.movedLast = 0;
    // Neutrala deltar i turordningen men står still.
    if (!a.hostile && a.kind !== 'player') {
      c.acted[a.id] = true;
      continue;
    }
    if (!canAct(a)) {
      c.acted[a.id] = true;
      if (a.id === g.state.playerId) {
        const why = a.unconscious ? 'är medvetslös' : hasEffect(a, 'liggande') ? 'ligger ner' : 'kan inte göra något';
        g.log(`${a.name} ${why}.`);
      }
      continue;
    }
    return;
  }
}

/** Avslutar turen för den som agerar och går vidare. */
export function finishTurn(g: Game) {
  const c = g.state.combat;
  if (g.state.mode !== 'combat' || !c) return;
  const a = g.actor(c.order[c.turn]);
  if (a) {
    c.acted[a.id] = true;
    faceNearest(g, a);
  }
  if (!activeHostiles(g).length) {
    endCombat(g, 'Striden är vunnen!');
    return;
  }
  if (!g.player.alive) return;
  nextTurn(g);
}

function faceNearest(g: Game, a: Actor) {
  const foes = a.kind === 'player' ? activeHostiles(g) : a.hostile ? [g.player] : [];
  const near = foes.filter((f) => f.alive).sort((l, r) => distance(a.x, a.y, l.x, l.y) - distance(a.x, a.y, r.x, r.y))[0];
  if (near) face(a, near.x, near.y);
}

/**
 * Striden är slut. Besegrade fiender förblöder, effekter som bara gäller striden försvinner och
 * en medvetslös rollperson vaknar (eller förblöder om ingen förbinder hen).
 */
export function endCombat(g: Game, message: string) {
  const c = g.state.combat;
  const p = g.player;
  if (c) {
    for (const a of participants(g)) {
      if (a.hostile && a.alive && !a.fled && a.kind !== 'player' && (a.unconscious || a.down)) {
        g.log(`${a.name} ligger besegrad och dör av sina sår.`);
        kill(g, a);
      }
    }
  }
  for (const a of g.state.actors) {
    a.effects = a.effects.filter(
      (e) =>
        e.persist ||
        e.days !== undefined ||
        e.untilRest ||
        e.untilPerfect ||
        e.kind === 'skräckMod' ||
        (e.rounds !== undefined && e.rounds > 100 && e.kind === 'cl'),
    );
  }
  g.state.combat = null;
  if (g.state.mode === 'combat') g.state.mode = 'explore';
  g.log(message);
  if (!p.alive) return;
  p.reload = 0;
  // Tolkning: hälften av pilarna och loden som sköts går att leta upp efteråt.
  for (const [item, n] of Object.entries(c?.fired ?? {})) {
    const found = Math.floor(n * RANGED.recoverShare);
    if (!found) continue;
    const ch = g.state.character;
    ch.ammo[item] = (ch.ammo[item] ?? 0) + found;
    g.log(`${p.name} letar upp ${found} av ${n} ${item === 'pilar' ? 'pilar' : 'lod och kulor'} efter striden.`);
  }
  if (p.unconscious || hasEffect(p, 'dödsfara')) {
    if (p.bleeding.length || hasEffect(p, 'dödsfara') || p.critical.some((l) => l === 'bröstkorg' || l === 'mage')) {
      g.log(`${p.name} ligger medvetslös och ingen kommer till hjälp.`);
      kill(g, p);
      return;
    }
    // Medvetslös i 1T4 timmar, och sedan oförmögen tills KP (och huvudets KP) är positiva igen.
    const hours = roll('1T4', g.rng);
    p.effects = p.effects.filter((e) => e.kind !== 'medvetslös');
    advanceTime(g, hours * HOUR, 'vila');
    let days = 0;
    while ((p.kp <= 0 || p.locKp.huvud <= 0) && days < 60) {
      advanceTime(g, DAY, 'vila');
      days++;
    }
    p.unconscious = false;
    g.log(days ? `${p.name} vaknar efter ${hours} timmar och ligger sedan ${days} dygn innan hen kan resa sig.` : `${p.name} vaknar efter ${hours} timmar.`);
  }
  rollInfections(g, p);
  // Ett krossat ben i en arm eller ett ben måste amputeras.
  for (const inj of p.injuries.filter((i) => i.id === 'krossat')) if (p.alive) amputate(g, p, inj.loc);
}

// ------------------------------------------------------------------ handlingar utan spelarens styrning

function stepTowards(g: Game, a: Actor, target: Actor, stop: () => boolean) {
  const c = g.state.combat!;
  const path = findPath(g.map, a, target, (x, y) => !!g.actorAt(x, y), true);
  if (!path) return;
  for (const step of path) {
    if (c.movesLeft <= 0 || stop()) break;
    face(a, step.x, step.y);
    a.x = step.x;
    a.y = step.y;
    c.movesLeft--;
    a.movedLast = (a.movedLast ?? 0) + 1;
  }
}

/** Flyr bort från en källa. Returnerar false om det inte gick att komma längre bort. */
function flee(g: Game, a: Actor, from: Actor, random: boolean): boolean {
  const c = g.state.combat!;
  let moved = false;
  while (c.movesLeft > 0) {
    const options = DIRS.map(([dx, dy]) => ({ x: a.x + dx, y: a.y + dy }))
      .filter((s) => walkable(g.map, s.x, s.y) && !g.actorAt(s.x, s.y))
      .map((s) => ({ s, d: distance(s.x, s.y, from.x, from.y) + (random ? g.rng() * 3 : 0) }))
      .filter((o) => random || o.d > distance(a.x, a.y, from.x, from.y));
    if (!options.length) break;
    const best = options.reduce((l, r) => (r.d > l.d ? r : l)).s;
    face(a, best.x, best.y);
    a.x = best.x;
    a.y = best.y;
    c.movesLeft--;
    a.movedLast = (a.movedLast ?? 0) + 1;
    moved = true;
  }
  return moved;
}

/** Turen för en varelse, eller för rollpersonen när skräck tar över (flykt, bärsärkagång). */
export function autoTurn(g: Game) {
  const c = g.state.combat!;
  const a = g.actor(c.order[c.turn])!;
  const p = g.player;
  const isPlayer = a.id === p.id;

  const fleeing = a.effects.find((e) => e.kind === 'flyr');
  if (fleeing) {
    const from = (fleeing.sourceId && g.actor(fleeing.sourceId)) || (isPlayer ? activeHostiles(g)[0] : p);
    if (from) {
      const moved = flee(g, a, from, !!fleeing.random);
      if (!isPlayer && (!moved || distance(a.x, a.y, p.x, p.y) > a.sight + 2 || !lineOfSight(g.map, a.x, a.y, p.x, p.y))) {
        if (moved) {
          a.fled = true;
          a.alive = false;
          g.log(`${a.name} flyr och försvinner ur sikte.`);
        } else if (a.detailed) {
          a.hostile = false;
          a.effects = a.effects.filter((e) => e !== fleeing);
          if (WEAPONS[a.weapon]) drop(g, a, 'weapon', '0');
          g.log(`${a.name} är trängd, kastar vapnet och ger upp.`);
        } else {
          // Ett trängt djur slåss för livet.
          a.effects = a.effects.filter((e) => e !== fleeing);
          g.log(`${a.name} är trängd och vänder sig till motanfall!`);
        }
      } else if (moved) g.log(`${a.name} flyr.`);
    }
    // Bara ett trängt djur som vänt sig till motanfall går vidare till ett anfall.
    const turned = !a.effects.includes(fleeing) && a.hostile && a.alive;
    if (!turned) {
      finishTurn(g);
      return;
    }
  }

  const target = isPlayer ? (a.effects.find((e) => e.kind === 'bärsärk')?.sourceId ?? activeHostiles(g)[0]?.id) : p.id;
  const t = target ? g.actor(target) : undefined;
  if (!t || !t.alive) {
    finishTurn(g);
    return;
  }

  // Aktivt skräckslag tar hela rundan.
  const active = a.fear?.[1];
  if (!isPlayer && active !== null && active !== undefined && !c.scared.includes(`${a.id}:aktiv`) && g.canSee(a, p) && canAct(p)) {
    c.scared.push(`${a.id}:aktiv`);
    scare(g, p, a, active);
    finishTurn(g);
    return;
  }

  // Varelser med avståndsvapen skjuter på håll så länge de har ammunition, och laddar om emellan.
  if (!isPlayer && a.ranged && (a.rangedAmmo ?? 0) > 0 && !inReach(g, a, t)) {
    if ((a.reload ?? 0) > 0) {
      reloadStep(g, a);
      finishTurn(g);
      return;
    }
    if (!shootProblem(g, a, t)) {
      shoot(g, a, t);
      if (g.state.mode === 'combat') finishTurn(g);
      return;
    }
  }
  if (!inReach(g, a, t)) stepTowards(g, a, t, () => inReach(g, a, t));
  if (inReach(g, a, t) && canAttackNow(a) && !c.acted[a.id]) attackOnce(g, a, t, 'weapon');
  if (g.state.mode === 'combat') finishTurn(g);
}

/** Lyfter upp föremål som ligger där rollpersonen står. Returnerar true om något plockades upp. */
export function pickUp(g: Game): boolean {
  const p = g.player;
  const ch = g.state.character;
  const here = g.state.dropped.filter((d) => d.x === p.x && d.y === p.y);
  if (!here.length) return false;
  for (const d of here) {
    ch.inventory.push(d.item);
    const own = d.owner === p.id;
    if (d.slot === 'weapon' && (p.weapon === 'nave' || !WEAPONS[p.weapon]) && WEAPONS[d.item] && !(WEAPONS[d.item].kind === 'projektil' && (p.shield || p.offhand))) {
      p.weapon = d.item;
      ch.equipped.weapon = d.item;
      const w = WEAPONS[d.item];
      if (w.kind === 'närstrid' && w.bv !== null) p.bv.weapon = d.bv ?? w.bv;
      else delete p.bv.weapon;
    } else if (d.slot === 'offhand' && own && !p.offhand) {
      p.offhand = d.item;
      ch.equipped.offhand = d.item;
      if (d.bv !== undefined) p.bv.offhand = d.bv;
    } else if (d.slot === 'shield' && !p.shield && !p.offhand) {
      p.shield = d.item;
      ch.equipped.shield = d.item;
      p.bv.shield = d.bv ?? SHIELDS[d.item].bv;
    } else if (d.slot === 'armor' && own && !p.armor.includes(d.item)) {
      p.armor.push(d.item);
      ch.equipped.armor = [...p.armor];
      p.bv[d.item] = d.bv ?? armorBv(d.item);
    }
    const name = WEAPONS[d.item]?.name ?? SHIELDS[d.item]?.name ?? ARMOR[d.item]?.name ?? d.item;
    g.log(`${p.name} plockar upp ${name.toLowerCase()}.`);
  }
  g.state.dropped = g.state.dropped.filter((d) => !here.includes(d));
  return true;
}

// ------------------------------------------------------------------ magiska skydd

/** SKÖLD: luften parerar nästa fysiska anfall automatiskt. Returnerar true om anfallet stoppades. */
function airShield(g: Game, def: Actor, head: string): boolean {
  const e = def.effects.find((x) => x.kind === 'luftsköld');
  if (!e) return false;
  def.effects = def.effects.filter((x) => x !== e);
  g.log(`${head}, men luften framför ${def.name} hårdnar och parerar (SKÖLD).`);
  g.emit(def.id, 'Parerat', 'miss');
  return true;
}

/** ÖRTRANKOR: den insnärjde försöker varje runda bryta sig loss med STY mot rankornas motståndsvärde. */
function breakFree(g: Game, a: Actor) {
  const e = a.effects.find((x) => x.kind === 'rankor');
  if (!e || a.unconscious) return;
  const knife = ['dolk', 'parerdolk', 'kniv'].includes(a.weapon) ? 5 : 0;
  const check = resistance(a.attrs.STY + knife, e.mod ?? 0, g.rng);
  if (check.success) {
    a.effects = a.effects.filter((x) => x !== e);
    g.log(`${a.name} sliter sig loss ur rankorna (STY ${a.attrs.STY + knife} mot ${e.mod}, T20: ${check.roll} mot ${check.target}).`);
  } else g.log(`${a.name} sitter fast i rankorna (T20: ${check.roll} mot ${check.target}).`);
}

// ------------------------------------------------------------------ avståndsstrid (Bok II s. 16–17, Bok III s. 33)

export interface RangedInfo {
  id: string;
  name: string;
  kind: 'projektil' | 'kast';
  damage: string;
  skill: string;
  /** Räckvidd i rutor. */
  range: number;
  reload: number;
  /** Ammunitionen som förbrukas, och om vapnet går att använda utan den. */
  ammo?: { item: string; optional?: boolean; cl?: number };
}

/** Avståndsvapnet som aktören använder: rollpersonens vapen i handen, eller varelsens avståndsvapen. */
export function rangedInfo(a: Actor): RangedInfo | null {
  const id = a.kind === 'player' ? a.weapon : a.ranged;
  const w = id ? WEAPONS[id] : undefined;
  if (!w || w.kind === 'närstrid') return null;
  const r = w as RangedWeaponDef;
  const range = r.range === 'STY' ? a.attrs.STY : Math.floor(r.range / RANGED.metersPerSquare);
  return { id: r.id, name: r.name, kind: r.kind, damage: r.damage, skill: r.group, range, reload: r.reload, ammo: AMMUNITION[r.id] };
}

/** Pilar och lod som rollpersonen har kvar till vapnet. */
export function ammoLeft(g: Game, a: Actor, r: RangedInfo): number {
  if (a.kind !== 'player') return a.rangedAmmo ?? 0;
  if (r.kind === 'kast') return 1;
  if (!r.ammo) return 1;
  return g.state.character.ammo[r.ammo.item] ?? 0;
}

/** Varför aktören inte kan skjuta eller kasta på målet just nu, eller null om det går. */
export function shootProblem(g: Game, a: Actor, t: Actor): string | null {
  const r = rangedInfo(a);
  if (!r) return 'Du har inget avståndsvapen i handen.';
  if (!canUseSkills(a) || hasEffect(a, 'endastParera')) return 'Du kan inte anfalla nu.';
  const arms = r.kind === 'projektil' ? [a.swordArm, shieldArm(a)] : [a.swordArm];
  if (a.detailed && arms.some((l) => !limbUsable(a, l))) return r.kind === 'projektil' ? 'Det krävs två hela armar.' : 'Svärdsarmen går inte att använda.';
  if ((a.reload ?? 0) > 0) return `${r.name} måste laddas om (${a.reload} SR kvar).`;
  if (r.kind === 'projektil' && r.ammo && !r.ammo.optional && ammoLeft(g, a, r) <= 0) return 'Ammunitionen är slut.';
  if (a.kind !== 'player' && ammoLeft(g, a, r) <= 0) return 'Ammunitionen är slut.';
  const d = distance(a.x, a.y, t.x, t.y);
  if (d < RANGED.minDistance) return 'Det måste finnas minst en ruta mellan dig och målet.';
  if (d > r.range) return `Målet är utom räckhåll (${r.range} rutor).`;
  if (!lineOfSight(g.map, a.x, a.y, t.x, t.y)) return 'Du har inte fri sikt.';
  if ((a.movedLast ?? 0) > 0) return 'Man måste stå stilla för att sikta.';
  return null;
}

/** Modifikation för avståndet: −5 mellan halva och tre fjärdedels räckvidd, −10 längre. */
function rangeMod(d: number, range: number): number {
  if (d > (range * 3) / 4) return RANGED_MODS['Mellan tre fjärdedels och hel räckvidd'];
  if (d > range / 2) return RANGED_MODS['Mellan halva och tre fjärdedels räckvidd'];
  return 0;
}

/** Ett mål som springer: det förflyttade sig mer än halva sin förflyttning under sin senaste tur. */
function isRunning(t: Actor): boolean {
  return (t.movedLast ?? 0) > Math.floor(t.move / 2);
}

/** Avfyrar ett projektilvapen eller kastar ett kastvapen. Står still och gör inget annat i rundan. */
export function shoot(g: Game, a: Actor, target: Actor) {
  const r = rangedInfo(a)!;
  const c = g.state.combat;
  const ch = g.state.character;
  const isPlayer = a.id === g.state.playerId;
  face(a, target.x, target.y);

  // Ammunition: pilar och lod förbrukas; slungan tar slungkulor (+2) om det finns, annars stenar.
  let ammoBonus = 0;
  if (!isPlayer) a.rangedAmmo = (a.rangedAmmo ?? 0) - 1;
  else if (r.kind === 'projektil' && r.ammo && (ch.ammo[r.ammo.item] ?? 0) > 0) {
    ch.ammo[r.ammo.item]--;
    ammoBonus = r.ammo.cl ?? 0;
    if (c) (c.fired ??= {})[r.ammo.item] = (c.fired[r.ammo.item] ?? 0) + 1;
  }

  const d = distance(a.x, a.y, target.x, target.y);
  const situational: [string, number][] = [];
  if (target.unconscious || hasEffect(target, 'ingenHandling')) situational.push(['orörligt mål', RANGED_MODS['Målet orörligt']]);
  const band = rangeMod(d, r.range);
  if (band) situational.push(['avstånd', band]);
  const aim = isPlayer && target.detailed ? (c?.aim ?? null) : null;
  if (aim) situational.push([`siktar på ${aim}`, RANGED_MODS['Sikte på viss kroppsdel']]);
  const light = lightMod(g, a, target);
  if (light) situational.push([light === -15 ? 'mörker' : 'fackelsken', light]);
  if (ammoBonus) situational.push(['slungkulor', ammoBonus]);
  const cover = target.effects.find((e) => e.kind === 'täckning');
  if (cover) situational.push(['skydd', cover.half ? RANGED.dropPerSquare * (d - 1) : (cover.mod ?? 0)]);
  const running = isRunning(target) && !target.unconscious ? 'halverad mot rörligt mål' : undefined;

  const arms = r.kind === 'projektil' ? [a.swordArm, shieldArm(a)] : [a.swordArm];
  const x = computeCl(g, a, 'anfall', r.skill, a.detailed ? arms : [], situational, 'weapon', undefined, running);
  a.reload = r.reload;
  if (!x) {
    g.log(`${a.name} kan inte använda ${r.name.toLowerCase()}.`);
    return;
  }
  for (const e of x.used) consume(a, e);
  let check = rollCl(g, x);
  if (autoFail(a, 'anfall')) check = forceFail(check);
  const verb = r.kind === 'kast' ? 'kastar' : 'skjuter';
  const head = `${a.name} ${verb} mot ${target.name} med ${r.name.toLowerCase()} (T20: ${check.roll} mot ${x.cl}${x.notes.length ? `, ${x.notes.join(', ')}` : ''})`;
  const w = rangedWeapon(a, r);
  let landing = { x: target.x, y: target.y };

  if (check.result === 'fummel') {
    g.log(`${head}: fummel!`);
    g.emit(a.id, 'Fummel!', 'miss');
    fumble(g, a, 'avstånd', 'weapon');
    return;
  }
  g.gainExperience(a, r.skill, check);
  const path = projectilePath(g.map, a.x, a.y, target.x, target.y, Math.min(r.range, Math.ceil(d * RANGED.missOvershoot)));

  if (check.success) {
    // Står någon i vägen är det ungefär hälften så stor chans att den träffas i stället.
    let victim = target;
    for (const pt of path) {
      if (pt.x === target.x && pt.y === target.y) break;
      const other = g.actorAt(pt.x, pt.y);
      if (other && other !== a && g.rng() < RANGED.blockChance) {
        victim = other;
        g.log(`${head}: ${other.name} står i vägen och träffas i stället!`);
        break;
      }
    }
    landing = { x: victim.x, y: victim.y };
    if (victim === target) g.log(`${head}: träff!`);
    if (airShield(g, victim, head)) return finishThrow(g, a, r, landing);
    // Kastvapen kan pareras med sköld av den som ser kastet. Projektiler kan inte pareras.
    if (r.kind === 'kast' && victim.shield && flankMod(a, victim) < MELEE_MODS['Anfall bakifrån'] && check.result !== 'perfekt') {
      const parry = tryParry(g, victim, a, w, true);
      if (parry?.check.success) {
        g.log(`${victim.name} parerar med ${parry.name} (${parry.text}).`);
        g.emit(victim.id, 'Parerat', 'miss');
        return finishThrow(g, a, r, landing);
      }
      if (parry?.check.result === 'fummel') fumble(g, victim, parry.table, parry.slot);
    }
    if (r.id === 'blasror') blowpipe(g, a, victim);
    else hit(g, a, victim, w, { perfect: check.result === 'perfekt', aim: victim === target ? aim : null, table: 'avstånd', shieldFrom: r.kind === 'projektil' ? a : undefined });
    return finishThrow(g, a, r, landing);
  }

  // En miss fortsätter i en rät linje och kan träffa någon annan i banan: 1 % per STO-poäng.
  g.log(`${head}: miss.`);
  g.emit(target.id, 'Miss', 'miss');
  for (const pt of path) {
    landing = pt;
    const other = g.actorAt(pt.x, pt.y);
    if (!other || other === a || other === target) continue;
    if (g.rng() < other.attrs.STO * RANGED.strayPerSto) {
      g.log(`Den vilsna projektilen träffar ${other.name}!`);
      if (r.id !== 'blasror') hit(g, a, other, w, { table: 'avstånd' });
      break;
    }
  }
  finishThrow(g, a, r, landing);
}

/** Ett WeaponInfo för skadan från ett avståndsvapen. Kastvapen får skadebonus, projektiler inte. */
function rangedWeapon(a: Actor, r: RangedInfo): WeaponInfo {
  return {
    slot: 'weapon',
    id: r.id,
    name: r.name,
    damage: r.damage,
    skill: r.skill,
    sb: r.kind === 'kast',
    natural: false,
    unarmed: false,
    twoHanded: r.kind === 'projektil',
    twoHandBonus: false,
    reach: 0,
    entangling: false,
    noParryWear: true,
    bvKey: null,
  };
}

/** Blåsröret skadar inte självt: pilen tränger in om 1T8 är högre än rustningen, och då verkar giftet. */
function blowpipe(g: Game, a: Actor, t: Actor) {
  const loc = t.detailed ? lookup(HIT_TABLE.avstånd, die(20, g.rng))! : null;
  const abs = (loc ? (armorPiece(t, loc)?.abs ?? 0) : 0) + t.naturalArmor + magicArmor(t);
  const n = die(8, g.rng);
  if (n > abs) {
    g.log(`Pilen tränger in${loc ? ` i ${loc}` : ''} (1T8: ${n} mot abs ${abs}).`);
    poisonOnHit(g, a, t, loc);
  } else g.log(`Pilen fastnar i skyddet (1T8: ${n} mot abs ${abs}).`);
}

/** Ett kastvapen lämnar handen och hamnar där det landade. */
function finishThrow(g: Game, a: Actor, r: RangedInfo, at: { x: number; y: number }) {
  if (r.kind !== 'kast' || a.id !== g.state.playerId || WEAPONS[a.weapon]?.kind !== 'kast') return;
  throwAway(g, a, at);
}

function throwAway(g: Game, a: Actor, at: { x: number; y: number }) {
  const ch = g.state.character;
  const item = a.weapon;
  g.state.dropped.push({ item, slot: 'weapon', owner: a.id, x: at.x, y: at.y });
  const i = ch.inventory.indexOf(item);
  if (i >= 0) ch.inventory.splice(i, 1);
  // Har rollpersonen fler likadana tar hen nästa direkt; annars blir handen tom.
  if (ch.inventory.includes(item)) return;
  a.weapon = 'nave';
  ch.equipped.weapon = undefined;
}

/** Laddar om ett armborst eller en stavslunga en runda. */
export function reloadStep(g: Game, a: Actor) {
  if (!a.reload) return;
  a.reload--;
  const r = rangedInfo(a);
  g.log(a.reload > 0 ? `${a.name} laddar om ${r?.name.toLowerCase() ?? ''} (${a.reload} SR kvar).` : `${a.name} har laddat ${r?.name.toLowerCase() ?? ''}.`);
}

/**
 * Söka skydd (Bok II s. 16): ett Normalt SMI-slag. Bakom skydd dras differensvärdet från
 * skyttens CL; finns inget skydd intill kastar man sig ned och får −1 per ruta till skytten.
 */
export function takeCover(g: Game, a: Actor) {
  const nearCover = DIRS.some(([dx, dy]) => {
    const t = tileAt(g.map, a.x + dx, a.y + dy);
    return !!t && t.opaque;
  });
  const check = attributeCheck(Math.max(1, a.attrs.SMI + (loadMod(g, a) ?? 0)), g.rng, 'Normalt');
  if (!check.success) {
    g.log(`${a.name} försöker söka skydd men hinner inte (Normalt SMI-slag, ${short(check)}).`);
    return;
  }
  if (nearCover) {
    addEffect(a, { kind: 'täckning', label: 'Bakom skydd', mod: -Math.max(1, check.diff), rounds: 1 });
    g.log(`${a.name} söker skydd (Normalt SMI-slag, ${short(check)}): −${Math.max(1, check.diff)} för skyttar den här rundan.`);
  } else {
    addEffect(a, { kind: 'täckning', label: 'Ligger ned i skydd', half: true, rounds: 1 });
    addEffect(a, { kind: 'liggande', label: 'Har kastat sig ned', rounds: 1 });
    g.log(`${a.name} kastar sig ned (Normalt SMI-slag, ${short(check)}): −1 för varje ruta till skytten den här rundan.`);
  }
}

/** När en effekt tar slut: örter som läker efter en stund verkar nu. */
export function onExpire(g: Game, a: Actor, e: ActiveEffect) {
  if (e.kind === 'läkning' && a.alive && e.mod) {
    if (a.id === g.state.playerId) g.heal(e.mod);
    g.log(`${e.label}: ${a.name} läker ${e.mod} KP.`);
  } else if (e.spell && a.id === g.state.playerId) g.log(`${e.label} upphör.`);
}
