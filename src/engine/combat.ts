import { NATURAL_WEAPONS } from '../content';
import { ARMOR, SHIELDS } from '../data/armor';
import { SKILLS } from '../data/skills';
import type { ArmorDef, MeleeWeaponDef, RangedWeaponDef } from '../data/types';
import { WEAPONS, weaponSkill } from '../data/weapons';
import { itemInfo, loadMod, loadPenalty, smiBlocked } from './inventory';
import { breakConcentration, enemyCast, forgetOnKnockout, resolvePending, wardCheck } from './magic';
import { torchBurns, updateWeather, weatherRanged } from './weather';
import { airborne, attrShift, breakHiding, checkCamouflage, controller, flamingHand, flightSpeed, fogBlocks, heatColdResist, inDarkness, inVortex, magicallyHidden, unseen } from './spelleffects';
import { poisonOnHit, updatePoisons } from './poison';
import { die, maxRoll, roll } from './dice';
import type { Game } from './game';
import { actorHas, banemanCl, heroic, markPsyWin, passive, passiveCl, provokeAnimal, spares, weaponCl } from './hero';
import { backstabMultiplier, backstabs, godsFavor } from './talents';
import { advanceTime, amputate, rollInfections, woundKind } from './time';
import { dissolve, elementalAttacks, elementalRound, elementalTakes, elementalWeapon } from './elementals';
import { aidAfterCombat, fallenCompanion, leaveParty, shareLoot } from './party';
import { breakHold, holdRound, keepHold } from './maneuvers';
import { sneakRound } from './stealth';
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
  DYING,
  HIT_LOCATIONS,
  CRITICAL_LIMB,
  damageBonus,
  ENTANGLING_MISS,
  FUMBLE_TABLES,
  fearRoll,
  fearRow,
  FEAR_TABLE,
  grip,
  HIT_TABLE,
  INITIATIVE_DIE,
  ABILITY_RULES,
  LIMB_PSY_CHECK,
  LOCATION_WOUND_PENALTY,
  locationKp,
  lookup,
  maxKp,
  MELEE_MODS,
  movement,
  MORALE_MODS,
  DAY,
  DISARM,
  HOUR,
  PARRY_PENALTY,
  SNEAK_MODS,
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
import { ATTR_KEYS, type ActiveEffect, type Actor, type AttrKey, type CombatState, type WeaponSlot } from './types';
import { RACES } from '../data/races';

/**
 * Detaljerad strid enligt Bok II (s. 15–22) och husreglerna i docs/regelbeslut.md.
 * Funktionerna arbetar på spelmotorn och anropas via Game.
 */

/** Rollpersonens fackla lyser upp så här många rutor i mörker. */
export const TORCH_RANGE = 4;
/** Längsta strid innan den avbryts (skydd mot oändliga strider). */
const MAX_ROUNDS = 500;

const LEGS: HitLocation[] = ['vänster ben', 'höger ben'];
export const DIRS = [
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
export const short = (c: Check) => `T20: ${c.roll} mot ${c.target}`;

// ------------------------------------------------------------------ effekter

export function hasEffect(a: Actor, kind: ActiveEffect['kind']): boolean {
  return a.effects.some((e) => e.kind === kind);
}

export function addEffect(a: Actor, e: ActiveEffect) {
  a.effects.push(e);
}

/** Förbrukar ett slag av en effekt som gäller ett visst antal slag. */
function consume(a: Actor, e: ActiveEffect) {
  if (e.uses === undefined) return;
  e.uses--;
  if (e.uses <= 0) a.effects = a.effects.filter((x) => x !== e);
}

const RANGED_GROUPS = new Set(['bagar', 'armborst', 'slunga', 'kastvapen', 'blasror']);

function scopeMatches(scope: Scope | undefined, kind: 'anfall' | 'parering' | 'annan', skill: string, slot?: string, effectSlot?: string, effectSkill?: string): boolean {
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
    case 'kar':
      return attr === 'KAR';
    case 'psy':
      return attr === 'PSY';
    case 'sty':
      return attr === 'STY';
    case 'magi':
      return spell;
    case 'ejMagi':
      return !spell;
    case 'färdighet':
      return !!effectSkill && effectSkill === skill;
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
  let mod = woundPenalty(a) + loadPenalty(g, a, skill) + passiveCl(g.charOf(a), skill) + attrShift(a, skill);
  for (const e of clEffects(a)) if (!e.half && scopeMatches(e.scope, 'annan', skill, undefined, undefined, e.skill)) mod += e.mod ?? 0;
  if (hasEffect(a, 'blind')) mod += BLIND_CL;
  return mod;
}

/** Förbrukar effekter som gäller ett antal slag efter ett färdighetsslag utanför strid (Meditation). */
export function consumeSkillEffects(a: Actor, skill: string) {
  for (const e of clEffects(a)) if (e.uses !== undefined && scopeMatches(e.scope, 'annan', skill, undefined, undefined, e.skill)) consume(a, e);
}

/** Kan aktören göra någonting alls den här rundan? */
export function canAct(a: Actor): boolean {
  return a.alive && !a.fled && !a.unconscious && !hasEffect(a, 'ingenHandling') && !hasEffect(a, 'liggande') && !hasEffect(a, 'rankor') && !hasEffect(a, 'fasthållen') && !hasEffect(a, 'flämtar');
}

/** Hör till gruppen: rollpersonen, följeslagarna och elementarerna. */
export const isParty = (a: Actor) => a.kind === 'player';

/** Vänner till aktören: andra i gruppen, eller andra fiender för en fiende. */
export function friendsOf(g: Game, a: Actor): Actor[] {
  return g.state.actors.filter(
    (x) => x !== a && x.alive && !x.fled && (isParty(a) ? isParty(x) : a.hostile && x.hostile && !isParty(x)),
  );
}

/** Ute ur striden: död, medvetslös, utslagen eller flydd. */
export function isOut(a: Actor): boolean {
  return !a.alive || a.fled || a.unconscious || a.down;
}

/** Kan använda färdigheter (anfalla, parera, lägga förband). */
export function canUseSkills(a: Actor): boolean {
  return canAct(a) && !a.down && a.kp > 1 && !hasEffect(a, 'håller');
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
  // LEVITATION håller figuren still i luften; FLYGA ger sin egen fart (skador i benen spelar ingen roll).
  const flight = flightSpeed(a);
  if (flight !== null) return flight;
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
  // Med 1 KP kvar går man i halv fart (Vidar, steg 8); den som bara kan krypa tar en ruta.
  if (a.kp <= 1 && !a.down) m = Math.floor(m / 2);
  if (a.down) m = Math.min(m, 1);
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
  /** Magiskt vapen (ASTRALVAPEN): biter på elementarer som bara skadas av magi. */
  magical?: boolean;
}

export function weaponInfo(a: Actor, slot: WeaponSlot = 'weapon'): WeaponInfo {
  if (a.elemental) return elementalWeapon(a);
  // ASTRALVAPEN tar platsen av det som magikern håller i handen så länge det varar.
  const astral = slot === 'weapon' ? a.effects.find((e) => e.kind === 'astralvapen') : undefined;
  if (astral?.dice) {
    return {
      slot,
      id: 'astralvapen',
      name: 'Astralvapen',
      damage: astral.dice,
      skill: 'astralvapen',
      sb: true,
      natural: false,
      unarmed: false,
      twoHanded: astral.dice.startsWith('2'),
      twoHandBonus: false,
      reach: 1,
      entangling: false,
      noParryWear: true,
      bvKey: null,
      magical: true,
    };
  }
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
  const twoHanded = grip(m.styReq, strength(a), m.twoHandedOnly) !== 'en hand';
  // Rollpersonen håller ett enhandsvapen med båda händerna när den andra handen är fri (+1T2).
  // Varelserna gör det inte: det är ett val som spelledaren inte gör åt dem.
  const freeHand = isParty(a) && !a.shield && !a.offhand && limbUsable(a, shieldArm(a));
  return {
    slot,
    id,
    name: m.name,
    damage: m.damage,
    skill: weaponSkill(m, strength(a)),
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
export function armsFor(a: Actor, item: WeaponSlot | 'shield', w?: WeaponInfo): HitLocation[] {
  if (!a.detailed) return [];
  if (item === 'shield' || item === 'offhand') return [shieldArm(a)];
  return w?.twoHanded || w?.twoHandBonus ? [a.swordArm, shieldArm(a)] : [a.swordArm];
}

/** STY med God kroppskontroll och liknande. */
export function strength(a: Actor): number {
  return a.attrs.STY + a.effects.filter((e) => e.kind === 'styrka').reduce((n, e) => n + (e.mod ?? 0), 0);
}

export function damageExpr(a: Actor, w: WeaponInfo): string {
  const parts = [w.damage];
  const sb = w.sb ? damageBonus({ ...a.attrs, STY: strength(a) }) : '';
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
  // Järnnäve: obeväpnad gör man alltid maximal skada.
  const iron = w.unarmed && actorHas(g, a, 'jarnnave');
  // FLAMMANDE HAND: 1T3 per E med händerna och med vapen i handen, inte med skott och naturliga vapen.
  const flame = flamingHand(a);
  let fire = 0;
  if (flame && (w.unarmed || (!w.natural && !RANGED_GROUPS.has(w.skill)))) {
    fire = roll(`${flame}T3`, g.rng);
    g.log(`Den flammande handen bränner: +${fire} i skada.`);
  }
  return Math.max(0, (perfect || iron ? maxRoll(expr) : roll(expr, g.rng)) + magic + fire);
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
  const ch = g.charOf(a)!;
  const isPlayer = !!g.charOf(a);
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
export function wearItem(g: Game, a: Actor, key: string, why: string) {
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
export function drop(g: Game, a: Actor, key: string, dist: string) {
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
  let d = Math.min(Math.abs(i - j), 8 - Math.abs(i - j));
  // Vidvinkelsyn (stridskonst): ser 270°, så varje riktning räknas ett steg längre fram.
  if (def.techniques?.includes('vidvinkelsyn')) d--;
  if (d >= 4 || (d === 3 && !def.techniques?.includes('vidvinkelsyn'))) return MELEE_MODS['Anfall bakifrån'];
  if (d >= 2) return MELEE_MODS['Anfall från sidan'];
  return 0;
}

export function face(a: Actor, x: number, y: number) {
  const dx = Math.sign(x - a.x);
  const dy = Math.sign(y - a.y);
  if (dx || dy) a.facing = { dx, dy };
}

function isDark(g: Game, x: number, y: number): boolean {
  return !!tileAt(g.map, x, y)?.dark || inDarkness(g, { x, y });
}

/**
 * Mörker −15 och fackelsken −5. Rollpersonen bär en fackla som lyser upp närmaste rutorna.
 * Varelser med mörkersyn får inga avdrag.
 */
export function lightMod(g: Game, viewer: Actor, target: Actor): number {
  // Blind strid (stridskonst): känner av motståndarna även i beckmörker.
  if (viewer.techniques?.includes('blind_strid')) return 0;
  if (hasEffect(viewer, 'blind')) return MELEE_MODS.Mörker;
  // I umbrans mörkerglob slutar allt ljus att lysa och mörkersyn fungerar inte.
  if (inGlobe(g, 'mörker', target) || inGlobe(g, 'mörker', viewer)) return MELEE_MODS.Mörker;
  if (viewer.darkvision || hasEffect(viewer, 'mörkersyn')) return 0;
  if (!isDark(g, target.x, target.y) && !isDark(g, viewer.x, viewer.y)) return 0;
  if (inGlobe(g, 'ljus', target)) return 0;
  return torchLit(g, target) ? MELEE_MODS['Skymning, fackelsken'] : MELEE_MODS.Mörker;
}

/** Lyser någon i gruppens facklor på rutan? */
export function torchLit(g: Game, at: { x: number; y: number }): boolean {
  // I en sfär av MÖRKER lyser ingenting, och en fackla där inne lyser inte heller utåt.
  if (inDarkness(g, at)) return false;
  return g.state.actors.some((a) => {
    if (!a.alive || inDarkness(g, a)) return false;
    const d = distance(a.x, a.y, at.x, at.y);
    // LJUS: figuren lyser som en fackla, tre meter per E.
    const glow = a.effects.filter((e) => e.kind === 'ljus').reduce((n, e) => Math.max(n, e.mod ?? 0), 0);
    if (glow && d <= glow) return true;
    return isParty(a) && !a.elemental && torchBurns(g, a) && d <= TORCH_RANGE;
  });
}

/** Är rutan inom en luminals ljus eller en umbras mörker (fem rutor per grad)? */
export function inGlobe(g: Game, kind: 'ljus' | 'mörker', at: { x: number; y: number }): boolean {
  return g.state.actors.some((e) => e.alive && e.elemental?.kind === kind && distance(e.x, e.y, at.x, at.y) <= 5 * e.elemental.grade);
}

/** Mörkt på rutan för den som smyger: grotta, natt eller en umbras glob, och ingen luminal. */
export function darkAt(g: Game, at: { x: number; y: number }): boolean {
  if (inGlobe(g, 'mörker', at)) return true;
  if (inGlobe(g, 'ljus', at)) return false;
  return isDark(g, at.x, at.y);
}

// ------------------------------------------------------------------ chans att lyckas

export interface Cl {
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
export function computeCl(
  g: Game,
  a: Actor,
  kind: 'anfall' | 'parering',
  skill: string,
  arms: HitLocation[],
  situational: [string, number][],
  slot?: string,
  halve?: string,
  preHalve?: string,
  fvOverride?: number,
): Cl | null {
  if (arms.some((loc) => !limbUsable(a, loc))) return null;
  const attr = SKILLS[skill.split(':')[0]]?.attr;
  if (attr === 'SMI' && smiBlocked(g, a)) return null;
  const fv = fvOverride ?? g.skillFv(a, skill);
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
  // ÖKA och MINSKA ändrar baschansen så länge de varar.
  const shift = attrShift(a, skill);
  if (shift) {
    mod += shift;
    notes.push(`${signed(shift)} ${shift > 0 ? 'ÖKA' : 'MINSKA'}`);
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
    if (!scopeMatches(e.scope, kind, skill, slot, e.slot, e.skill)) continue;
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

/** Förmågornas tillägg på ett anfall: Precisionssinne med vapen och Baneman mot det valda folkslaget. */
function abilityMods(g: Game, att: Actor, def: Actor, natural?: boolean): [string, number][] {
  const out: [string, number][] = [];
  const ch = g.charOf(att);
  const precision = natural ? 0 : weaponCl(ch);
  if (precision) out.push(['precisionssinne', precision]);
  const bane = banemanCl(g, att, def);
  if (bane) out.push(['baneman', bane]);
  return out;
}

export function rollCl(g: Game, x: Cl): Check {
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
  if (a.elemental && !elementalAttacks(a)) return false;
  return canUseSkills(a) && !hasEffect(a, 'endastParera') && limbUsable(a, a.swordArm);
}

/** Kan `att` nå `def` med sitt vapen härifrån? */
export function inReach(g: Game, att: Actor, def: Actor): boolean {
  const d = distance(att.x, att.y, def.x, def.y);
  const reach = weaponInfo(att).reach;
  // Den som svävar når och nås bara med långa vapen, om inte båda svävar.
  if (airborne(att) !== airborne(def) && reach < 2) return false;
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

export interface AttackOptions {
  /** Ett annat vapen än det i handen (stridskonsternas slag och sparkar). */
  weapon?: WeaponInfo;
  /** Kroppsdel som anfallet alltid träffar (eller väljs bland), t.ex. hoppsparken. */
  locs?: HitLocation[];
  /** Vad som händer i stället för skada när anfallet går igenom (kast, låsning, bedövning). */
  onHit?: (g: Game, att: Actor, def: Actor, check: Check) => 'skada' | 'klart';
  /** Kan inte pareras (Avväpna). */
  noParry?: boolean;
  /** FV i stället för färdighetens (Fasthållning: (STO + SMI + STY) / 3). */
  fv?: number;
  /** Anfallaren vänder sig inte mot målet (bakåtspark). */
  keepFacing?: boolean;
  /** Riddarslag: sikte på en kroppsdel utan avdrag, eller högsta skada med högsta SB. */
  knight?: boolean;
}

/** Resultatet av ett anfall, för handlingar som bygger på det (Avväpna, Fasthållning, kast). */
export type AttackResult = 'träff' | 'parerat' | 'miss' | 'fummel' | 'ingen';

/** Ett anfall och försvararens parering, enligt resultattabellen (Bok II s. 17). */
export function attackOnce(g: Game, att: Actor, def: Actor, slot: WeaponSlot, opt: AttackOptions = {}): AttackResult {
  const c = g.state.combat;
  const w = opt.weapon ?? weaponInfo(att, slot);
  if (!opt.keepFacing) face(att, def.x, def.y);
  provokeAnimal(g, att, def);

  // Fallteknik: den som rullar kan inte huggas med närstridsvapen.
  if (hasEffect(def, 'rullar') && !w.natural) {
    g.log(`${att.name} hugger efter ${def.name}, men hen rullar undan.`);
    return 'ingen';
  }
  // Den som smyger fram: Smyga mot Upptäcka fara (Bok II s. 21). En omedveten försvarare får inte parera.
  // Den som är osynlig behöver inte smyga, men försvararen slår ändå Upptäcka fara (tolkning).
  const invisible = att.effects.some((e) => e.kind === 'osynlig') && unseen(def, att);
  const unaware = att.hidden ? ambush(g, att, def, invisible) : false;
  breakHiding(g, att, 'anfaller');

  const situational: [string, number][] = [];
  const orörlig = def.unconscious || hasEffect(def, 'ingenHandling') || hasEffect(def, 'rankor') || hasEffect(def, 'fasthållen');
  if (orörlig) situational.push(['orörligt mål', MELEE_MODS['Målet orörligt']]);
  else if (hasEffect(def, 'liggande') && !def.techniques?.includes('liggande_strid')) situational.push(['liggande mål', MELEE_MODS['Målet ligger ned']]);
  const flank = flankMod(att, def);
  if (flank) situational.push([flank === 7 ? 'bakifrån' : 'från sidan', flank]);
  const aim = isParty(att) && att.id === g.player.id && def.detailed && !opt.locs ? (c?.aim ?? null) : null;
  if (aim) situational.push([`siktar på ${aim}`, opt.knight ? 0 : MELEE_MODS['Sikte på viss kroppsdel']]);
  const light = lightMod(g, att, def);
  if (light) situational.push([light === -15 ? 'mörker' : 'fackelsken', light]);
  const bonuses = def.effects.filter((e) => e.kind === 'motståndarBonus');
  for (const b of bonuses) situational.push(['motståndarens miss', b.mod ?? 0]);
  situational.push(...abilityMods(g, att, def, w.natural));

  const x = computeCl(g, att, 'anfall', w.skill, w.natural && opt.weapon ? [] : armsFor(att, slot, w), situational, slot, undefined, undefined, opt.fv);
  if (!x) {
    g.log(`${att.name} kan inte använda ${w.name.toLowerCase()}.`);
    return 'ingen';
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
    check = heroic(g, att, check);
  }
  wear(g, att, w.bvKey);

  const mods = x.notes.length ? `, ${x.notes.join(', ')}` : '';
  const head = `${att.name} anfaller ${def.name} med ${w.name.toLowerCase()} (${check.automatic ? 'lyckas automatiskt' : `T20: ${check.roll} mot ${x.cl}`}${mods})`;

  const loc = opt.locs ? opt.locs[die(opt.locs.length, g.rng) - 1] : aim;
  // Riddarslag utan sikte: högsta skada med högsta SB (rustning och parering gäller som vanligt).
  const knightDamage = opt.knight && !aim ? maxRoll(damageExpr(att, w)) + weaponMagic(att, w.slot) : undefined;
  const landed = (perfect: boolean) => {
    if (opt.onHit && opt.onHit(g, att, def, check) === 'klart') return;
    hit(g, att, def, w, { perfect, aim: loc, damage: perfect ? undefined : knightDamage });
  };
  if (check.result === 'fummel') {
    g.log(`${head}: fummel!`);
    g.emit(att.id, 'Fummel!', 'miss');
    fumble(g, att, w.natural ? 'obeväpnad' : 'närstrid', slot);
    return 'fummel';
  }
  // Lönnmördarens Anfall bakifrån: även ett misslyckat anfall träffar, och skadan utan SB
  // gångras med 1, 2 eller 4.
  if (unaware && backstabs(g, att, def, w, !!opt.onHit || !!opt.weapon)) {
    const times = backstabMultiplier(check.result);
    const base = Math.max(0, roll(w.damage, g.rng) + weaponMagic(att, w.slot));
    if (check.success) g.gainExperience(att, w.skill, check);
    g.log(`${head}: ${check.result}! Anfall bakifrån: ${def.name} anar ingenting${times > 1 ? `, och skadan gångras med ${times}` : ''}.`);
    hit(g, att, def, w, { perfect: check.result === 'perfekt', aim: loc, damage: base * times });
    return 'träff';
  }
  if (check.result === 'perfekt') {
    att.effects = att.effects.filter((e) => !(e.untilPerfect && e.kind === 'cl'));
    g.log(`${head}: perfekt!${opt.onHit ? '' : ' Maximal skada, går inte att parera och rustningen hjälper inte.'}`);
    landed(true);
    return 'träff';
  }

  g.gainExperience(att, w.skill, check);
  // Husregel: ett misslyckat anfall behöver inte pareras.
  if (!check.success) {
    g.log(`${head}: miss.`);
    g.emit(def.id, 'Miss', 'miss');
    return 'miss';
  }

  if (airShield(g, def, `${head}: träff`)) return 'parerat';
  // Fint (stridskonst): lyckas finten halveras motståndarens parering.
  const feint = !opt.noParry && !unaware && c?.feint && isParty(att) && att.techniques?.includes('fint') ? feintCheck(g, att) : false;
  const parry = exposed?.noParry || opt.noParry || unaware ? null : tryParry(g, def, att, w, false, feint ? 'halverad av finten' : undefined);
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
      if (parry.disarm) disarmParry(g, def, att, parry.check, check);
      return 'parerat';
    } else {
      g.log(`${head}: träff! ${def.name} misslyckas med pareringen (${parry.text}).`);
    }
  } else {
    g.log(`${head}: träff!${unaware ? ` ${def.name} anar ingenting och kan inte parera.` : ''}`);
  }
  landed(false);
  return 'träff';
}

/** Fint: ett slag i stridskonsten samtidigt med anfallet. */
function feintCheck(g: Game, a: Actor): boolean {
  const check = skillCheck(g.skillFv(a, 'stridskonster'), g.rng, skillMod(g, a, 'stridskonster'));
  g.log(`${a.name} fintar (Stridskonster, ${short(check)}): ${check.success ? 'motståndarens parering halveras' : 'finten går inte hem'}.`);
  if (check.success) g.gainExperience(a, 'stridskonster', check);
  return check.success;
}

/**
 * Anfall från smygarläge (Bok II s. 21): anfallaren slår Smyga, och lyckas det slår försvararen
 * Upptäcka fara med anfallarens differensvärde som avdrag. Den som inte upptäcker anfallaren får
 * inte parera. Anfallet avslöjar den som smög.
 */
export function ambush(g: Game, att: Actor, def: Actor, invisible = false): boolean {
  att.hidden = false;
  att.sneaking = false;
  if (invisible) {
    const fv = def.skills.upptacka_fara ?? Math.max(1, Math.floor(def.attrs.PSY / 2));
    const spot = skillCheck(fv, g.rng, passiveCl(g.charOf(def), 'upptacka_fara'));
    g.log(`${att.name} anfaller osynlig. ${def.name} slår Upptäcka fara (${short(spot)}): ${spot.success ? 'anar anfallet' : 'märker ingenting'}.`);
    return !spot.success;
  }
  const sneak = skillCheck(g.skillFv(att, 'smyga'), g.rng, sneakMod(g, att));
  if (!sneak.success) {
    g.log(`${att.name} smyger fram mot ${def.name} men hörs (Smyga, ${short(sneak)}).`);
    return false;
  }
  g.gainExperience(att, 'smyga', sneak);
  const fv = def.skills.upptacka_fara ?? Math.max(1, Math.floor(def.attrs.PSY / 2));
  const spot = skillCheck(fv, g.rng, -Math.max(0, sneak.diff) + passiveCl(g.charOf(def), 'upptacka_fara'));
  const unaware = !spot.success;
  g.log(
    `${att.name} smyger fram mot ${def.name} (Smyga, ${short(sneak)}). ${def.name} slår Upptäcka fara (${short(spot)}): ${unaware ? 'märker ingenting' : 'upptäcker anfallaren'}.`,
  );
  return unaware;
}

/**
 * Modifikationer på Smyga: tänd fackla i mörker −10, dagsljus nära en fiende −5, och rustning som
 * klirrar halverar FV (husregler i docs/regelbeslut.md).
 */
export function sneakMod(g: Game, a: Actor): number {
  let mod = skillMod(g, a, 'smyga');
  if (darkAt(g, a) && torchBurns(g, a) && !a.elemental) mod += SNEAK_MODS.torch;
  else if (!darkAt(g, a)) {
    const near = g.state.actors.some((e) => e.alive && e.hostile && !e.fled && distance(e.x, e.y, a.x, a.y) <= Math.floor(e.sight / 2) && lineOfSight(g.map, e.x, e.y, a.x, a.y));
    if (near) mod += SNEAK_MODS.daylight;
  }
  if (a.armor.some((id) => ARMOR[id]?.noisy && (a.bv[id] ?? 1) > 0)) mod -= Math.ceil(g.skillFv(a, 'smyga') / 2);
  return mod;
}

/** Stridskonsttekniken Avväpning: efter en lyckad parering måste anfallaren parera avväpningen. */
function disarmParry(g: Game, def: Actor, att: Actor, parry: Check, attack: Check) {
  if (!WEAPONS[att.weapon]) return;
  const w = weaponInfo(att);
  const x = computeCl(g, att, 'parering', w.skill, armsFor(att, 'weapon', w), []);
  const keep = x ? rollCl(g, x) : null;
  if (keep?.success) {
    g.log(`${att.name} håller kvar vapnet (parerar avväpningen, T20: ${keep.roll} mot ${x!.cl}).`);
    return;
  }
  const item = att.weapon;
  if (parry.result === 'perfekt' && attack.result !== 'perfekt') {
    g.log(`${def.name} vrider ${w.name.toLowerCase()} ur händerna på ${att.name} och tar det själv!`);
    const bv = att.bv.weapon;
    unequip(g, att, 'weapon');
    takeWeapon(g, def, item, bv);
    return;
  }
  g.log(`${def.name} slår ${w.name.toLowerCase()} ur handen på ${att.name}!`);
  drop(g, att, 'weapon', DISARM.technique);
}

/** Lägger ett vapen i handen på någon (ett avväpnat vapen som man tagit). */
export function takeWeapon(g: Game, a: Actor, item: string, bv?: number) {
  const ch = g.charOf(a);
  if (ch) {
    ch.inventory.push(item);
    ch.equipped.weapon = item;
  }
  a.weapon = item;
  const w = WEAPONS[item];
  if (w?.kind === 'närstrid' && w.bv !== null) a.bv.weapon = bv ?? w.bv;
}

interface Parry {
  check: Check;
  name: string;
  text: string;
  slot: WeaponSlot | 'shield';
  bvKey: string | null;
  table: FumbleTable;
  unarmed: boolean;
  /** Stridskonsttekniken Avväpning: kan slå vapnet ur handen på anfallaren. */
  disarm?: boolean;
}

/**
 * Försvararen parerar om hen kan. Husregel: efter den första pareringen i rundan blir det −5,
 * −10 och så vidare; skölden ger en extra parering utan avdrag. Det alternativ som ger högst CL
 * används.
 */
/**
 * Försvararens bästa parering. `ranged` är en parering mot ett skott eller kast, och `weaponOnly`
 * att bara vapnen kan användas (Snabb uppfattning mot projektiler).
 */
function tryParry(g: Game, def: Actor, att: Actor, aw: WeaponInfo, onlyShield = false, feint?: string, how: { ranged?: boolean; weaponOnly?: boolean } = {}): Parry | null {
  const c = g.state.combat;
  if (!def.detailed || !canUseSkills(def) || hasEffect(def, 'ingenParering')) return null;
  const prone = hasEffect(def, 'liggande');
  const used = c ? (c.parries[def.id] ??= { count: 0, shieldFree: false }) : { count: 0, shieldFree: false };
  const light = lightMod(g, def, att);
  const halve = aw.entangling ? 'halverad mot kätting' : feint;
  const martial = martialOk(g, def);

  type Option = { x: Cl; skill: string; slot: WeaponSlot | 'shield'; name: string; bvKey: string | null; table: FumbleTable; unarmed: boolean; free: boolean; disarm?: boolean };
  const options: Option[] = [];
  const penalty = PARRY_PENALTY * used.count;
  // Snabb uppfattning: +5 vid parering i närstrid.
  const quick = !how.ranged && actorHas(g, def, 'snabb_uppfattning') ? ABILITY_RULES.quickParry : 0;
  const sit = (p: number): [string, number][] => [
    ['mörker', light === -15 ? light : 0],
    ['fackelsken', light === -5 ? light : 0],
    ['fler pareringar', p],
    ['snabb uppfattning', quick],
  ];
  for (const slot of ['weapon', 'offhand'] as const) {
    if (onlyShield) break;
    if (slot === 'offhand' && !def.offhand) continue;
    const w = weaponInfo(def, slot);
    // Obeväpnad kan bara parera obeväpnade anfall, utom med stridskonsternas obeväpnade parering
    // eller avväpning. Liggande kan bara strida med korta vapen.
    const tech = w.unarmed && martial && !aw.natural ? (def.techniques!.includes('avvapning') ? 'avvapning' : def.techniques!.includes('obevapnad_parering') ? 'obevapnad_parering' : null) : null;
    if (w.natural && !(aw.natural && w.unarmed) && !tech) continue;
    if (prone && !w.natural && !['dolk', 'parerdolk', 'kortsvard'].includes(w.id)) continue;
    const skill = tech ? 'stridskonster' : w.skill;
    const x = computeCl(g, def, 'parering', skill, armsFor(def, slot, w), sit(penalty), slot, halve);
    if (x) options.push({ x, skill, slot, name: tech === 'avvapning' ? 'en avväpning' : w.name.toLowerCase(), bvKey: w.bvKey, table: w.natural ? 'obeväpnad' : 'närstrid', unarmed: w.natural, free: false, disarm: tech === 'avvapning' && !!WEAPONS[att.weapon] });
    if (slot === 'weapon' && w.unarmed && martial && aw.natural) {
      const y = computeCl(g, def, 'parering', 'stridskonster', armsFor(def, slot, w), sit(penalty), slot, halve);
      if (y) options.push({ x: y, skill: 'stridskonster', slot, name: 'stridskonsten', bvKey: null, table: 'obeväpnad', unarmed: true, free: false });
    }
  }
  const shield = def.shield ? SHIELDS[def.shield] : undefined;
  const main = weaponInfo(def, 'weapon');
  if (shield && !prone && !how.weaponOnly && shield.styReq <= strength(def) && !main.twoHanded) {
    const free = !used.shieldFree;
    const x = computeCl(g, def, 'parering', 'skoldar', armsFor(def, 'shield'), sit(free ? 0 : penalty), 'shield', halve);
    if (x) options.push({ x, skill: 'skoldar', slot: 'shield', name: shield.name.toLowerCase(), bvKey: 'shield', table: 'sköld', unarmed: false, free });
  }
  if (!options.length) return null;
  const best = options.reduce((a, b) => (b.x.cl > a.x.cl ? b : a));
  for (const e of best.x.used) consume(def, e);
  if (best.free) used.shieldFree = true;
  else used.count++;

  let check = heroic(g, def, rollCl(g, best.x));
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
    disarm: best.disarm,
  };
}

/**
 * Kan aktören använda sin stridskonst? Det kräver att man kan någon teknik, är obeväpnad och inte
 * bär tyngre rustning än läder (Bok I s. 57).
 */
export function martialOk(g: Game, a: Actor): boolean {
  if (!a.techniques?.length || a.skills.stridskonster === undefined) return false;
  if (WEAPONS[a.weapon] || a.offhand || a.shield) return false;
  return a.armor.every((id) => ARMOR[id]?.light !== false);
}

/** Träff: träffområde, skada, rustning och sårverkan. */
export function hit(
  g: Game,
  att: Actor,
  def: Actor,
  w: WeaponInfo,
  opts: { perfect?: boolean; damage?: number; extra?: number; aim?: HitLocation | null; table?: 'närstrid' | 'avstånd'; shieldFrom?: Actor },
) {
  const perfect = !!opts.perfect;
  let dmg = (opts.damage ?? rollDamage(g, att, w, perfect)) + (opts.extra ?? 0);
  const heat = elementBonus(g, att, w);
  dmg += heat;
  // MOTSTÅNDSKRAFT: 1 mindre per E mot eld och köld (salamandern, glacialen, thermen och vapen
  // som de har hettat upp eller kylt ned).
  const resist = heatColdResist(def);
  if (resist && (heat || ['eld', 'köld', 'värme'].includes(att.elemental?.kind ?? ''))) {
    const less = Math.min(resist, att.elemental ? dmg : heat);
    dmg -= less;
    if (less) g.log(`MOTSTÅNDSKRAFT tar ${less} av skadan.`);
  }
  if (def.elemental) {
    const after = elementalTakes(g, att, def, w, dmg);
    if (after === null) return;
    dmg = after;
  }
  if (!def.detailed) {
    const abs = perfect ? 0 : def.naturalArmor + magicArmor(def);
    const dealt = steel(g, def, Math.max(0, dmg - abs), null);
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
  const dealt = steel(g, def, Math.max(0, dmg - abs), loc);
  const absText = abs ? ` (${dmg} − ${abs} för ${piece ? piece.name.toLowerCase() : 'skyddet'})` : '';
  g.log(dealt > 0 ? `Träff i ${loc}: ${dealt} i skada${absText}.` : `Träff i ${loc}, men ${piece?.name.toLowerCase() ?? 'skyddet'} tar hela skadan.`);
  g.emit(def.id, dealt > 0 ? `-${dealt}` : '0', 'damage');
  // Husregel: rustningsdelen tappar 1 BV när skadan överstiger dess abs.
  if (!perfect && piece && dmg > piece.abs) wearItem(g, def, piece.id, 'tar skada');
  const kind = woundKind(w.id, w.natural, w.unarmed);
  if (dealt > 0 && kind && g.charOf(def)) def.combatWounds.push({ loc, dmg: dealt, kind });
  if (dealt > 0) poisonOnHit(g, att, def, loc);
  wound(g, def, dealt, loc);
}

/** Stålsättning (stridskonst): ett lyckat slag halverar skadan, utom mot huvudet. */
function steel(g: Game, def: Actor, dealt: number, loc: HitLocation | null): number {
  if (dealt <= 1 || loc === 'huvud' || !def.techniques?.includes('stalsattning') || !canUseSkills(def) || def.skills.stridskonster === undefined) return dealt;
  const check = skillCheck(g.skillFv(def, 'stridskonster'), g.rng, skillMod(g, def, 'stridskonster'));
  if (!check.success) return dealt;
  g.gainExperience(def, 'stridskonster', check);
  const half = Math.floor(dealt / 2);
  g.log(`${def.name} stålsätter sig och tar bara halv skada (Stridskonster, ${short(check)}).`);
  return half;
}

/** Extra skada från ett vapen som en elementar har hettat upp eller kylt ned. */
function elementBonus(g: Game, att: Actor, w: WeaponInfo): number {
  const e = att.effects.find((x) => x.kind === 'vapenElement' && x.slot === w.slot);
  if (!e?.dice || w.natural) return 0;
  const extra = roll(e.dice, g.rng);
  g.log(`${e.label}: +${extra} i skada.`);
  // Glacialens och thermens vapen: 5 % per grad att det splittras eller smälter vid första träffen.
  if (e.mod) {
    const chance = e.mod;
    e.mod = 0;
    if (die(100, g.rng) <= chance) {
      g.log(`${w.name} tål inte ${e.label.startsWith('Iskallt') ? 'kölden och splittras' : 'hettan och smälter'}!`);
      att.effects = att.effects.filter((x) => x !== e);
      unequip(g, att, w.slot);
    }
  }
  return extra;
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

/**
 * Drar skada från en kroppsdel (om någon) och från totala KP, och avgör följderna. Skada utan
 * kroppsdel (BLIXT, ELD, fall, gift) fördelas jämnt över alla kroppsdelar (Vidar), utom
 * blödningen, som redan kommer från en kroppsdel (`spread` = false).
 */
export function wound(g: Game, a: Actor, dmg: number, loc: HitLocation | null, spread = true) {
  if (dmg <= 0 || !a.alive) return;
  const awake = !a.unconscious;
  a.kp -= dmg;
  breakConcentration(g, a);
  breakHiding(g, a, 'skadas');
  if (loc && a.detailed) {
    a.locKp[loc] -= dmg;
    checkLocation(g, a, loc);
  } else if (a.detailed && spread) {
    const shares = spreadDamage(a, dmg);
    for (const [l, d] of shares) a.locKp[l] -= d;
    // Skada på totala KP ger ingen blödning (Vidar).
    for (const [l] of shares) if (a.alive) checkLocation(g, a, l, false);
  }
  if (a.alive) checkTotal(g, a);
  if (awake && a.unconscious && a.alive) forgetOnKnockout(g, a);
}

/**
 * Skada på totala KP fördelad jämnt över kroppsdelarna (Vidar). Det som inte går jämnt ut går till
 * de kroppsdelar som har flest KP kvar (tolkning). Förlorade kroppsdelar räknas inte.
 */
export function spreadDamage(a: Actor, dmg: number): [HitLocation, number][] {
  const locs = HIT_LOCATIONS.filter((l) => !a.injuries.some((i) => i.loc === l && i.lost));
  if (!locs.length) return [];
  const base = Math.floor(dmg / locs.length);
  const extra = [...locs].sort((x, y) => a.locKp[y] - a.locKp[x]).slice(0, dmg % locs.length);
  return locs.map((l) => [l, base + (extra.includes(l) ? 1 : 0)] as [HitLocation, number]).filter(([, d]) => d > 0);
}

function checkLocation(g: Game, a: Actor, loc: HitLocation, bleed = true) {
  if (bleed && a.locKp[loc] <= 0 && !a.bleeding.includes(loc)) {
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
  // Gudarnas gunstling: när KP når 0 kan guden återställa dem.
  if (a.kp <= 0 && a.alive && !a.dying && isPartyMember(g, a) && godsFavor(g, a)) return;
  if (a.kp <= -a.attrs.FYS) {
    kill(g, a);
    return;
  }
  if (a.kp <= 0 && isPartyMember(g, a) && !a.dying) {
    // Döden (husregel, steg 8): rollpersonen och följeslagarna faller medvetslösa och är döende.
    const awake = !a.unconscious;
    a.unconscious = true;
    a.dying = true;
    a.dyingRounds = 0;
    g.log(`${a.name} ${awake ? 'faller medvetslös och ' : ''}är döende (${a.kp} KP, dör vid −${a.attrs.FYS}).`);
    if (!someoneStanding(g, a)) dieAlone(g, a);
  } else if (a.kp <= 0 && !a.unconscious) {
    a.unconscious = true;
    g.log(`${a.name} faller medvetslös.`);
  } else if (a.kp === 1 && !a.down) {
    g.log(`${a.name} har bara 1 KP kvar och kan inte strida.`);
  }
}

/** Rollpersonen eller en följeslagare (inte elementarer); bara de omfattas av dödsregeln. */
export function isPartyMember(g: Game, a: Actor): boolean {
  return g.state.party.includes(a.id) && !a.elemental;
}

/** Står någon annan i gruppen upp, så att den döende inte är ensam? */
export function someoneStanding(g: Game, a: Actor): boolean {
  return g.partyMembers().some((m) => m !== a && !m.elemental && !isOut(m));
}

/** Ensam och döende: ingen hinner fram (Vidar, steg 8). */
function dieAlone(g: Game, a: Actor) {
  g.log(`Ingen i gruppen står upp och kan hjälpa ${a.name}.`);
  kill(g, a);
}

/**
 * Stabiliserar en döende (Första hjälpen, HELA, läkeört, Läkekonst eller ett eget FYS-slag):
 * minusskadan försvinner, totala KP blir 1, blödningen stannar och hen vaknar (husregel, steg 8).
 */
export function stabilize(g: Game, a: Actor, how: string) {
  if (!a.alive || !a.dying) return;
  a.dying = false;
  a.dyingRounds = 0;
  a.kp = Math.max(a.kp, 1);
  for (const l of HIT_LOCATIONS) if (a.locKp[l] < 0) a.locKp[l] = 0;
  if (a.locKp.huvud <= 0) {
    a.locKp.huvud = 1;
    a.disabled = a.disabled.filter((l) => l !== 'huvud');
  }
  a.bleeding = [];
  a.bleedTimer = 0;
  if (!hasEffect(a, 'dödsfara') && !hasEffect(a, 'medvetslös')) a.unconscious = false;
  g.log(`${a.name} stabiliseras ${how}${a.unconscious ? '' : ' och vaknar'} med 1 KP.`);
  g.changed();
}

export function kill(g: Game, a: Actor) {
  if (!a.alive) return;
  a.alive = false;
  a.unconscious = false;
  a.dying = false;
  if (a.id === g.state.playerId) {
    g.state.mode = 'dead';
    g.state.combat = null;
    g.log(`☠ ${a.name} dör. Äventyret är slut.`);
    return;
  }
  if (a.elemental) {
    dissolve(g, a, `${a.name} upplöses.`);
    return;
  }
  g.log(`${a.name} dör.`);
  if (a.deathFlag) g.state.flags[a.deathFlag] = true;
  if (g.state.party.includes(a.id)) {
    fallenCompanion(g, a);
    return;
  }
  const p = g.leader;
  if (a.silver > 0 && p.alive) {
    shareLoot(g, a.silver, a.name);
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
  for (const item of a.loot ?? []) g.state.dropped.push({ item, slot: 'item', owner: a.id, x: a.x, y: a.y });
  a.loot = [];
}

// ------------------------------------------------------------------ tabeller och följder

/**
 * Slår på en fummeltabell. 'Närmsta vän' träffar en följeslagare (eller en annan fiende för en
 * fiende) som står inom räckhåll, eller i skottlinjen för avståndsvapen. Finns ingen slås det om (husregel).
 */
export function fumble(g: Game, a: Actor, table: FumbleTable, slot: WeaponSlot | 'shield', target?: Actor) {
  const rows = FUMBLE_TABLES[table];
  const friend = nearestFriend(g, a, table, slot, target);
  const pick = (allowDouble: boolean): number => {
    for (;;) {
      const n = die(20, g.rng);
      if (n === 20 && !allowDouble) continue;
      if (!friend && rows[n - 1].effects.some((e) => e.kind === 'vän')) continue;
      return n;
    }
  };
  const first = pick(true);
  const results = first === 20 ? [pick(false), pick(false)] : [first];
  if (first === 20) g.log(`Fummeltabell (${table}) 20: ${rows[19].text} Två slag till.`);
  for (const n of results) {
    const row = rows[n - 1];
    g.log(`Fummeltabell (${table}) ${n}: ${row.text}`);
    applyRow(g, a, row, { slot, friend: friend ?? undefined, table });
  }
}

/** Närmsta vän som en fummel kan träffa: inom vapnets räckvidd, intill för en sköld, i skottlinjen för skott. */
function nearestFriend(g: Game, a: Actor, table: FumbleTable, slot: WeaponSlot | 'shield', target?: Actor): Actor | null {
  const friends = friendsOf(g, a);
  if (table === 'avstånd') {
    if (!target) return null;
    const path = projectilePath(g.map, a.x, a.y, target.x, target.y, distance(a.x, a.y, target.x, target.y));
    for (const pt of path) {
      const f = friends.find((x) => x.x === pt.x && x.y === pt.y);
      if (f) return f;
    }
    return null;
  }
  const reach = table === 'sköld' || slot === 'shield' || table === 'obeväpnad' ? 1 : weaponInfo(a, slot).reach;
  const near = friends
    .filter((f) => distance(a.x, a.y, f.x, f.y) <= reach)
    .sort((l, r) => distance(a.x, a.y, l.x, l.y) - distance(a.x, a.y, r.x, r.y));
  return near[0] ?? null;
}

interface OutcomeContext {
  slot?: WeaponSlot | 'shield';
  source?: Actor;
  /** Närmsta vän som en fummel träffar. */
  friend?: Actor;
  table?: FumbleTable;
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
      return;
    case 'vän': {
      const f = ctx.friend;
      if (!f) return;
      if (ctx.table === 'sköld') {
        addEffect(f, { kind: 'liggande', label: 'Omkullknuffad', rounds: 1 });
        g.log(`${f.name} knuffas omkull.`);
        return;
      }
      const w = ctx.table === 'avstånd' ? rangedWeapon(a, rangedInfo(a, g)!) : weaponInfo(a, weaponSlot ?? 'weapon');
      g.log(`${a.name} träffar ${f.name}!`);
      hit(g, a, f, w, { perfect: !!o.perfect, table: ctx.table === 'avstånd' ? 'avstånd' : 'närstrid' });
      return;
    }
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
      const ch = g.charOf(a);
      if (ch) (ch.phobias ??= []).push({ source: ctx.source?.name ?? 'okänt', level: o.level });
      return;
    }
    case 'grundegenskaper': {
      for (const k of ATTR_KEYS) {
        if (k === 'STO' || die(20, g.rng) < 19) continue;
        const loss = die(2, g.rng);
        a.attrs[k] = Math.max(1, a.attrs[k] - loss);
        const ch = g.charOf(a);
        if (ch) ch.attrs[k] = a.attrs[k];
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
      const ch = g.charOf(a);
      if (ch) ch.attrs.INT = a.attrs.INT;
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
  // Extremt orädd och lärd mans Snusförnuft hör till personen och räknas utöver den högsta
  // modifikationen (tolkning).
  const calm = passive(g.charOf(victim), 'fear');
  r.result += calm;
  const row = fearRow(r.result);
  g.log(`${source.name} injagar skräck! Skräcktabellen: T20 ${r.die} − PSY ${victim.attrs.PSY} + ${value}${calm ? ` ${calm < 0 ? '−' : '+'} ${Math.abs(calm)} orädd` : ''} = ${r.result}. ${row.text}`);
  // Oberörd eller helt oberörd: en vunnen kamp PSY mot PSY (Vidar, steg 8).
  if (FEAR_TABLE.indexOf(row) <= 1) markPsyWin(g, victim, 'motstånd');
  if (!g.state.fearMet.includes(source.defId)) g.state.fearMet.push(source.defId);
  applyRow(g, victim, row, { source });
}

/** Moralslag: 1T20 mot PSY + modifikationer. Lyckas det står varelsen kvar (husregel). */
export function moraleCheck(g: Game, a: Actor, reason: string): boolean {
  const c = g.state.combat!;
  const side = (x: Actor) => (isParty(a) ? isParty(x) && !x.elemental : x.hostile && !isParty(x));
  const all = c.order.map((id) => g.actor(id)!).filter(Boolean);
  const group = all.filter((x) => side(x) && x.id !== a.id);
  const comrades = group.filter((x) => !isOut(x)).length;
  const fled = group.filter((x) => x.fled || hasEffect(x, 'flyr')).length;
  const foes = isParty(a) ? activeHostiles(g).length : all.filter((x) => isParty(x) && !isOut(x)).length;
  const leader = isParty(a) ? g.leader : group.find((x) => x.leader);
  let mod = comrades * MORALE_MODS.kamrat + fled * MORALE_MODS.flydd + foes * MORALE_MODS.motståndare;
  if (leader && leader !== a && isOut(leader)) mod += MORALE_MODS.ledareBorta;
  else if (leader && leader !== a && leader.kp < leader.maxKp) mod += MORALE_MODS.ledareSårad;
  if (a.kp < a.maxKp / 2) mod += MORALE_MODS.halvaKp;
  const d = die(20, g.rng);
  const target = a.attrs.PSY + mod;
  const stays = d === 1 || (d !== 20 && d <= target);
  g.log(`${a.name} slår moral (${reason}, T20: ${d} mot ${target}): ${stays ? 'står kvar' : 'flyr!'}`);
  if (!stays) {
    addEffect(a, { kind: 'flyr', label: 'Flyr', rounds: MAX_ROUNDS });
    if (isParty(a)) a.refused = true;
  }
  return stays;
}

function checkMorale(g: Game) {
  const c = g.state.combat!;
  const hostiles = c.order.map((id) => g.actor(id)!).filter((x) => x.hostile && !isParty(x));
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
  // Följeslagarna (husregel): de som går med för saken eller bytet slår moral som fiender gör,
  // den betalda krigaren bara när rollpersonen faller.
  const members = g.partyMembers();
  const down = members.filter(isOut).length;
  for (const a of members) {
    if (!a.companion || isOut(a) || hasEffect(a, 'flyr')) continue;
    const reasons: string[] = [];
    if (isOut(g.leader)) reasons.push(`${g.leader.name} har fallit`);
    if (a.companion.morale === 'alltid') {
      if (members.length > 1 && down * 2 >= members.length) reasons.push('hälften av gruppen är borta');
      if (a.kp < a.maxKp / 2) reasons.push('har förlorat mer än halva KP');
    }
    for (const r of reasons) {
      if (a.morale.includes(r)) continue;
      a.morale.push(r);
      if (!moraleCheck(g, a, r)) break;
    }
  }
}

/** Varje rollperson och följeslagare slår på Skräcktabellen när hen först ser en skräckinjagande varelse. */
function checkFear(g: Game) {
  const c = g.state.combat!;
  for (const p of g.partyMembers()) {
    if (!canAct(p)) continue;
    for (const id of c.order) {
      const a = g.actor(id)!;
      const auto = a.fear?.[0];
      const key = `${a.id}>${p.id}`;
      if (auto === null || auto === undefined || !a.alive || a.fled || c.scared.includes(key)) continue;
      if (!g.canSee(p, a)) continue;
      c.scared.push(key);
      scare(g, p, a, auto);
    }
  }
}

// ------------------------------------------------------------------ rundor och turordning

export function participants(g: Game): Actor[] {
  return (g.state.combat?.order ?? []).map((id) => g.actor(id)!).filter(Boolean);
}

/** Fiender som fortfarande kan strida. */
export function activeHostiles(g: Game): Actor[] {
  return participants(g).filter((a) => a.hostile && !isParty(a) && !isOut(a));
}

/** Initiativ: 1T10 + SMI + modifikationer. Snabbslående agerar alltid först. Lika slås om. */
function rollInitiative(g: Game, c: CombatState) {
  const rolls = c.order
    .map((id) => g.actor(id)!)
    .map((a) => {
      // Hoppspark och rundspark: −2 på nästa initiativslag.
      const slow = a.effects.filter((e) => e.kind === 'initiativ').reduce((n, e) => n + (e.mod ?? 0), 0);
      a.effects = a.effects.filter((e) => e.kind !== 'initiativ');
      return { a, value: roll(INITIATIVE_DIE, g.rng) + Math.max(1, a.attrs.SMI + (loadMod(g, a) ?? 0)) + a.initiative + slow, tie: g.rng() };
    });
  rolls.sort((l, r) => Number(!!r.a.firstAlways) - Number(!!l.a.firstAlways) || r.value - l.value || r.tie - l.tie);
  c.order = rolls.map((r) => r.a.id);
  c.initiative = Object.fromEntries(rolls.map((r) => [r.a.id, r.value]));
}

export function startCombat(g: Game, enemies: Actor[]) {
  const p = g.leader;
  const ours = g.state.actors.filter((a) => a.alive && isParty(a));
  const bystanders = g.state.actors.filter(
    (a) => a.alive && !a.hostile && !isParty(a) && !enemies.includes(a) && g.isVisible(a.x, a.y),
  );
  const c: CombatState = {
    round: 1,
    order: [...ours, ...enemies, ...bystanders].map((a) => a.id),
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
  for (const m of ours) face(m, enemies[0].x, enemies[0].y);
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

/** Rollpersonerna: huvudpersonen och följeslagarna (inte elementarer). */
export function party(g: Game): Actor[] {
  return g.partyMembers();
}

function logRound(g: Game, c: CombatState) {
  const order = c.order
    .map((id) => g.actor(id)!)
    .filter((a) => a.hostile || isParty(a))
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
  const ours = g.state.actors.filter((a) => a.alive && isParty(a));
  const enemies = g.state.actors.filter(
    (a) =>
      a.alive &&
      a.hostile &&
      !a.fled &&
      !isParty(a) &&
      ours.some((p) => (g.canSee(a, p) && !unseen(a, p)) || (c.order.includes(a.id) && distance(a.x, a.y, p.x, p.y) <= 10)),
  );
  if (!enemies.some((e) => !isOut(e)) || c.round >= MAX_ROUNDS) {
    endCombat(g, 'Striden är över.');
    return false;
  }
  for (const e of [...enemies, ...ours]) {
    if (!c.order.includes(e.id)) {
      c.order.push(e.id);
      if (e.hostile) g.log(`${e.name} ansluter till striden!`);
    }
  }
  c.order = c.order.filter((id) => {
    const a = g.actor(id)!;
    return id === g.state.playerId || (a.alive && !a.fled && (!a.hostile || enemies.includes(a)));
  });
  c.round++;
  c.turn = -1;
  g.state.time += ROUND_SECONDS;
  updateWeather(g, g.state.time - ROUND_SECONDS);
  c.acted = {};
  c.parries = {};
  for (const a of participants(g)) tick(g, a);
  if (g.state.mode !== 'combat') return false;
  wardCheck(g);
  if (g.state.mode !== 'combat') return false;
  elementalRound(g);
  holdRound(g);
  // De som smyger måste lyckas med Smyga varje runda för att förbli oupptäckta.
  sneakRound(g);
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
        if (e.kind === 'liggande' && isParty(a)) g.log(`${a.name} reser sig.`);
        if (e.kind === 'rullar') continue;
        onExpire(g, a, e);
        continue;
      }
    }
    keep.push(e);
  }
  a.effects = keep;
  checkCamouflage(g, a);
  // KONTROLLERA PERSON bryts när magikern dör eller faller medvetslös.
  const ctl = a.effects.find((e) => e.kind === 'kontrollerad');
  if (ctl) {
    const by = ctl.by ? g.actor(ctl.by) : undefined;
    if (!by || !by.alive || by.unconscious) endSpellEffect(g, a, ctl);
  }
  breakFree(g, a);
  updatePoisons(g, a);
  if (!a.alive) return;
  if (a.unconscious && !hasEffect(a, 'medvetslös') && a.kp > 0 && (!a.detailed || a.locKp.huvud > 0) && !hasEffect(a, 'dödsfara')) {
    a.unconscious = false;
    g.log(`${a.name} vaknar.`);
  }
  if (a.dying) {
    dyingRound(g, a);
    return;
  }
  if (a.bleeding.length) {
    a.bleedTimer++;
    if (a.bleedTimer % BLEED_INTERVAL === 0) {
      g.log(`${a.name} blöder (−${a.bleeding.length} KP).`);
      wound(g, a, a.bleeding.length, null, false);
    }
  }
}

/**
 * En runda för den som är döende: 1 KP går förlorad (blödningen räknas inte under tiden). Var
 * tionde runda i strid, medan kamraterna är upptagna, slår hen ett Normalt FYS-slag för att
 * stabilisera sig. Den som är ensam dör.
 */
function dyingRound(g: Game, a: Actor) {
  if (!someoneStanding(g, a)) {
    dieAlone(g, a);
    return;
  }
  a.dyingRounds = (a.dyingRounds ?? 0) + 1;
  a.kp -= DYING.lossPerRound;
  if (a.kp <= -a.attrs.FYS) {
    g.log(`${a.name} förblöder.`);
    kill(g, a);
    return;
  }
  if (g.state.mode === 'combat' && a.dyingRounds % DYING.selfCheckEvery === 0) {
    const check = attributeCheck(a.attrs.FYS, g.rng, DYING.selfCheck);
    if (check.success) stabilize(g, a, `av egen kraft (Normalt FYS-slag, ${short(check)})`);
    else g.log(`${a.name} kämpar för livet men glider längre bort (Normalt FYS-slag, ${short(check)}; ${a.kp} KP).`);
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
    // Smyga: man rör sig ljudlöst i halv fart.
    if (a.sneaking) c.movesLeft = Math.ceil(c.movesLeft / 2);
    a.movedLast = 0;
    a.effects = a.effects.filter((e) => e.kind !== 'rullar');
    // Neutrala deltar i turordningen men står still. Den som är kontrollerad slåss för magikern.
    if (!a.hostile && !isParty(a) && !controller(a)) {
      c.acted[a.id] = true;
      continue;
    }
    if (hasEffect(a, 'håller')) {
      // Fasthållning: varje runda slås ett nytt motståndsslag, och ingen av dem gör något annat.
      // Spelaren får turen för att kunna släppa taget.
      keepHold(g, a);
      if (hasEffect(a, 'håller')) {
        c.movesLeft = 0;
        if (!isParty(a)) {
          c.acted[a.id] = true;
          continue;
        }
        g.state.focus = a.id;
        return;
      }
    }
    if (!canAct(a)) {
      c.acted[a.id] = true;
      if (isParty(a)) {
        const why = a.unconscious
          ? 'är medvetslös'
          : hasEffect(a, 'liggande')
            ? 'ligger ner'
            : hasEffect(a, 'fasthållen')
              ? 'hålls fast'
              : hasEffect(a, 'flämtar')
                ? 'står och flämtar'
                : 'kan inte göra något';
        g.log(`${a.name} ${why}.`);
      }
      if (hasEffect(a, 'fasthållen')) breakHold(g, a);
      continue;
    }
    if (isParty(a)) {
      g.state.focus = a.id;
      // Anfallssättet väljs på nytt för var och en.
      c.attackMode = undefined;
      c.feint = false;
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
    // OSYNLIGHET bryts av att springa, KAMOUFLAGE av att flytta sig.
    if ((a.movedLast ?? 0) > Math.floor(a.move / 2)) breakHiding(g, a, 'springer');
    checkCamouflage(g, a);
  }
  if (!activeHostiles(g).length) {
    endCombat(g, 'Striden är vunnen!');
    return;
  }
  if (!g.leader.alive) return;
  nextTurn(g);
}

function faceNearest(g: Game, a: Actor) {
  const foes = isParty(a) ? activeHostiles(g) : a.hostile ? g.state.actors.filter((x) => x.alive && isParty(x) && !x.hidden) : [];
  const near = foes.filter((f) => f.alive).sort((l, r) => distance(a.x, a.y, l.x, l.y) - distance(a.x, a.y, r.x, r.y))[0];
  if (near) face(a, near.x, near.y);
}

/**
 * Striden är slut. Besegrade fiender förblöder, effekter som bara gäller striden försvinner och
 * en medvetslös rollperson vaknar (eller förblöder om ingen förbinder hen).
 */
export function endCombat(g: Game, message: string) {
  const c = g.state.combat;
  if (c) {
    for (const a of participants(g)) {
      if (a.hostile && a.alive && !a.fled && !isParty(a) && (a.unconscious || a.down)) {
        g.log(`${a.name} ligger besegrad och dör av sina sår.`);
        kill(g, a);
      }
    }
  }
  // Tillkallade djur går sin väg när striden är slut (tolkning).
  for (const a of g.state.actors) {
    const e = a.effects.find((x) => x.kind === 'kontrollerad' && x.summoned);
    if (e && a.alive) {
      endSpellEffect(g, a, e);
      a.fled = true;
    }
  }
  // Elementarerna försvinner när striden är slut (tolkning).
  for (const e of g.state.actors.filter((a) => a.alive && a.elemental)) dissolve(g, e, `${e.name} återvänder till sitt element.`);
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
    a.hidden = a.sneaking || magicallyHidden(a) ? a.hidden : false;
  }
  g.state.combat = null;
  if (g.state.mode === 'combat') g.state.mode = 'explore';
  g.state.focus = g.state.playerId;
  g.log(message);
  const p = g.leader;
  if (!p.alive) return;
  for (const m of g.partyMembers()) m.reload = 0;
  // Tolkning: hälften av pilarna och loden som sköts går att leta upp efteråt.
  for (const [key, n] of Object.entries(c?.fired ?? {})) {
    const [who, item] = key.includes('|') ? key.split('|') : [g.state.playerId, key];
    const found = Math.floor(n * RANGED.recoverShare);
    const shooter = g.actor(who);
    const ch = g.charOf(shooter) ?? g.state.character;
    if (!found) continue;
    ch.ammo[item] = (ch.ammo[item] ?? 0) + found;
    g.log(`${shooter?.alive ? shooter.name : p.name} letar upp ${found} av ${n} ${item === 'pilar' ? 'pilar' : 'lod och kulor'} efter striden.`);
  }
  // Följeslagare som flydde vägrar fortsätta och går hem (husregel).
  for (const m of g.partyMembers()) if (m.refused || m.fled) leaveParty(g, m, 'vägrar');
  // Kamraterna tar hand om dem som ligger medvetslösa och blöder.
  aidAfterCombat(g);
  if (!p.alive) return;
  const knocked = g.partyMembers().filter((m) => m.unconscious || m.dying || hasEffect(m, 'dödsfara'));
  for (const m of knocked) {
    if (m.dying || m.bleeding.length || hasEffect(m, 'dödsfara') || m.critical.some((l) => l === 'bröstkorg' || l === 'mage')) {
      g.log(`${m.name} ligger medvetslös och ingen kan hjälpa.`);
      kill(g, m);
      if (!p.alive) return;
    }
  }
  if (p.unconscious) {
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
  for (const m of g.partyMembers()) {
    if (!m.unconscious) continue;
    // En medvetslös följeslagare vaknar när gruppen har vilat (tiden går för alla).
    m.effects = m.effects.filter((e) => e.kind !== 'medvetslös');
    if (m.kp > 0 && m.locKp.huvud > 0) {
      m.unconscious = false;
      g.log(`${m.name} vaknar.`);
    }
  }
  for (const m of g.partyMembers()) {
    rollInfections(g, m);
    // Ett krossat ben i en arm eller ett ben måste amputeras.
    for (const inj of m.injuries.filter((i) => i.id === 'krossat')) if (m.alive) amputate(g, m, inj.loc);
  }
}

// ------------------------------------------------------------------ handlingar utan spelarens styrning

function stepTowards(g: Game, a: Actor, target: Actor, stop: () => boolean) {
  const c = g.state.combat!;
  const path = findPath(g.map, a, target, (x, y) => g.blocked(x, y), true);
  if (!path) return;
  for (const step of path) {
    if (c.movesLeft <= 0 || stop()) break;
    face(a, step.x, step.y);
    a.x = step.x;
    a.y = step.y;
    c.movesLeft--;
    a.movedLast = (a.movedLast ?? 0) + 1;
  }
  wardCheck(g);
}

/** Flyr bort från en källa. Returnerar false om det inte gick att komma längre bort. */
function flee(g: Game, a: Actor, from: Actor, random: boolean): boolean {
  const c = g.state.combat!;
  let moved = false;
  while (c.movesLeft > 0) {
    const options = DIRS.map(([dx, dy]) => ({ x: a.x + dx, y: a.y + dy }))
      .filter((s) => walkable(g.map, s.x, s.y) && !g.blocked(s.x, s.y))
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
  const isPlayer = isParty(a);
  // KONTROLLERA PERSON: magikern låter den kontrollerade anfalla den närmaste fienden (tolkning).
  if (controller(a)) {
    const foes = activeHostiles(g).filter((x) => x !== a && !controller(x));
    const t = [...foes].sort((l, r) => distance(a.x, a.y, l.x, l.y) - distance(a.x, a.y, r.x, r.y))[0];
    if (t) {
      if (!inReach(g, a, t)) stepTowards(g, a, t, () => inReach(g, a, t));
      if (inReach(g, a, t) && canAttackNow(a) && !c.acted[a.id]) attackOnce(g, a, t, 'weapon');
    }
    if (g.state.mode === 'combat') finishTurn(g);
    return;
  }
  // Fienderna går på den närmaste i gruppen som de ser (inte den som smyger oupptäckt). Djur går
  // inte på den som har Djurvän och inte har anfallit dem.
  const targets = g.state.actors.filter((x) => x.alive && isParty(x) && !unseen(a, x) && !x.fled && !spares(g, a, x));
  const nearest = (list: Actor[]) => [...list].sort((l, r) => distance(a.x, a.y, l.x, l.y) - distance(a.x, a.y, r.x, r.y))[0];
  const p = nearest(targets.filter((x) => !isOut(x))) ?? nearest(targets) ?? g.leader;

  const fleeing = a.effects.find((e) => e.kind === 'flyr');
  if (fleeing) {
    const from = (fleeing.sourceId && g.actor(fleeing.sourceId)) || (isPlayer ? nearest(activeHostiles(g)) : p);
    if (from) {
      const moved = flee(g, a, from, !!fleeing.random);
      if (isPlayer && a.companion && (!moved || !activeHostiles(g).some((h) => g.canSee(h, a)))) {
        // En följeslagare som flyr ur sikte lämnar striden och går hem (husregel).
        if (moved) {
          a.fled = true;
          g.log(`${a.name} flyr från striden.`);
          leaveParty(g, a, 'flydde');
        }
      } else if (!isPlayer && (!moved || distance(a.x, a.y, p.x, p.y) > a.sight + 2 || !lineOfSight(g.map, a.x, a.y, p.x, p.y))) {
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

  const target = isPlayer ? (a.effects.find((e) => e.kind === 'bärsärk')?.sourceId ?? nearest(activeHostiles(g))?.id) : targets.length ? p.id : undefined;
  const t = target ? g.actor(target) : undefined;
  if (!t || !t.alive) {
    finishTurn(g);
    return;
  }

  // Aktivt skräckslag tar hela rundan.
  const active = a.fear?.[1];
  if (!isPlayer && active !== null && active !== undefined && !c.scared.includes(`${a.id}:aktiv`) && g.canSee(a, t) && canAct(t) && g.charOf(t)) {
    c.scared.push(`${a.id}:aktiv`);
    scare(g, t, a, active);
    finishTurn(g);
    return;
  }

  // Fiender som kan magi lägger besvärjelser efter samma regler som gruppen (Vidar).
  if (!isPlayer && a.spells?.length && enemyCast(g, a)) return;

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
export function pickUp(g: Game, p: Actor = g.player): boolean {
  const ch = g.charOf(p);
  if (!ch) return false;
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
    const name = itemInfo(d.item)?.name ?? d.item;
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
export function rangedInfo(a: Actor, g?: Game): RangedInfo | null {
  if (a.elemental) return null;
  const id = isParty(a) ? a.weapon : a.ranged;
  const w = id ? WEAPONS[id] : undefined;
  if (!w || w.kind === 'närstrid') return null;
  const r = w as RangedWeaponDef;
  // God bågskytt: alla räckvidder för projektilvapen ökar med 25 % (avrundas nedåt).
  const archer = g && r.kind === 'projektil' && actorHas(g, a, 'god_bagskytt') ? ABILITY_RULES.archerRange : 1;
  const range = r.range === 'STY' ? a.attrs.STY : Math.floor((r.range * archer) / RANGED.metersPerSquare);
  return { id: r.id, name: r.name, kind: r.kind, damage: r.damage, skill: r.group, range, reload: r.reload, ammo: AMMUNITION[r.id] };
}

/** Pilar och lod som rollpersonen har kvar till vapnet. */
export function ammoLeft(g: Game, a: Actor, r: RangedInfo): number {
  const ch = g.charOf(a);
  if (!ch) return a.rangedAmmo ?? 0;
  if (r.kind === 'kast') return 1;
  if (!r.ammo) return 1;
  return ch.ammo[r.ammo.item] ?? 0;
}

/** Varför aktören inte kan skjuta eller kasta på målet just nu, eller null om det går. */
export function shootProblem(g: Game, a: Actor, t: Actor): string | null {
  const r = rangedInfo(a, g);
  if (!r) return 'Du har inget avståndsvapen i handen.';
  if (!canUseSkills(a) || hasEffect(a, 'endastParera')) return 'Du kan inte anfalla nu.';
  const arms = r.kind === 'projektil' ? [a.swordArm, shieldArm(a)] : [a.swordArm];
  if (a.detailed && arms.some((l) => !limbUsable(a, l))) return r.kind === 'projektil' ? 'Det krävs två hela armar.' : 'Svärdsarmen går inte att använda.';
  if ((a.reload ?? 0) > 0) return `${r.name} måste laddas om (${a.reload} SR kvar).`;
  if (r.kind === 'projektil' && r.ammo && !r.ammo.optional && ammoLeft(g, a, r) <= 0) return 'Ammunitionen är slut.';
  if (!g.charOf(a) && ammoLeft(g, a, r) <= 0) return 'Ammunitionen är slut.';
  const d = distance(a.x, a.y, t.x, t.y);
  if (d < RANGED.minDistance) return 'Det måste finnas minst en ruta mellan dig och målet.';
  if (d > r.range) return `Målet är utom räckhåll (${r.range} rutor).`;
  if (!lineOfSight(g.map, a.x, a.y, t.x, t.y)) return 'Du har inte fri sikt.';
  if (fogBlocks(g, a, t)) return 'Dimman skymmer målet.';
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
  const r = rangedInfo(a, g)!;
  const c = g.state.combat;
  const ch = g.charOf(a)!;
  const isPlayer = !!g.charOf(a);
  face(a, target.x, target.y);
  provokeAnimal(g, a, target);

  // Ammunition: pilar och lod förbrukas; slungan tar slungkulor (+2) om det finns, annars stenar.
  let ammoBonus = 0;
  if (!isPlayer) a.rangedAmmo = (a.rangedAmmo ?? 0) - 1;
  else if (r.kind === 'projektil' && r.ammo && (ch.ammo[r.ammo.item] ?? 0) > 0) {
    ch.ammo[r.ammo.item]--;
    ammoBonus = r.ammo.cl ?? 0;
    const key = `${a.id}|${r.ammo.item}`;
    if (c) (c.fired ??= {})[key] = (c.fired[key] ?? 0) + 1;
  }

  const d = distance(a.x, a.y, target.x, target.y);
  const situational: [string, number][] = [];
  if (target.unconscious || hasEffect(target, 'ingenHandling')) situational.push(['orörligt mål', RANGED_MODS['Målet orörligt']]);
  const band = rangeMod(d, r.range);
  if (band) situational.push(['avstånd', band]);
  const aim = isPlayer && a.id === g.player.id && target.detailed ? (c?.aim ?? null) : null;
  if (aim) situational.push([`siktar på ${aim}`, RANGED_MODS['Sikte på viss kroppsdel']]);
  // En sylf styr projektilen: +1 på CL och 1T3 i skada per grad.
  const sylf = a.effects.find((e) => e.kind === 'sylfstyrd');
  if (sylf) {
    situational.push(['sylfen styr', sylf.mod ?? 0]);
    a.effects = a.effects.filter((e) => e !== sylf);
  }
  const light = lightMod(g, a, target);
  if (light) situational.push([light === -15 ? 'mörker' : 'fackelsken', light]);
  if (ammoBonus) situational.push(['slungkulor', ammoBonus]);
  const cover = target.effects.find((e) => e.kind === 'täckning');
  if (cover) situational.push(['skydd', cover.half ? RANGED.dropPerSquare * (d - 1) : (cover.mod ?? 0)]);
  situational.push(...abilityMods(g, a, target, false));
  // Vädret: regn och hård vind utomhus.
  situational.push(...weatherRanged(g, a, target));
  const running = isRunning(target) && !target.unconscious ? 'halverad mot rörligt mål' : undefined;

  const arms = r.kind === 'projektil' ? [a.swordArm, shieldArm(a)] : [a.swordArm];
  const x = computeCl(g, a, 'anfall', r.skill, a.detailed ? arms : [], situational, 'weapon', undefined, running);
  a.reload = r.reload;
  if (!x) {
    g.log(`${a.name} kan inte använda ${r.name.toLowerCase()}.`);
    return;
  }
  for (const e of x.used) consume(a, e);
  const verb = r.kind === 'kast' ? 'kastar' : 'skjuter';
  breakHiding(g, a, verb === 'kastar' ? 'kastar' : 'skjuter');
  // VIRVELSKÖLD: projektiler till och från den som har den missar.
  if (inVortex(a) || inVortex(target)) {
    g.log(`${a.name} ${verb} mot ${target.name}, men virvelskölden kring ${inVortex(a) ? a.name : target.name} stöter bort ${r.kind === 'kast' ? 'vapnet' : 'projektilen'}.`);
    g.emit(target.id, 'Miss', 'miss');
    return finishThrow(g, a, r, { x: target.x, y: target.y });
  }
  let check = heroic(g, a, rollCl(g, x));
  if (autoFail(a, 'anfall')) check = forceFail(check);
  const head = `${a.name} ${verb} mot ${target.name} med ${r.name.toLowerCase()} (T20: ${check.roll} mot ${x.cl}${x.notes.length ? `, ${x.notes.join(', ')}` : ''})`;
  const w = rangedWeapon(a, r);
  let landing = { x: target.x, y: target.y };

  if (check.result === 'fummel') {
    g.log(`${head}: fummel!`);
    g.emit(a.id, 'Fummel!', 'miss');
    fumble(g, a, 'avstånd', 'weapon', target);
    return;
  }
  g.gainExperience(a, r.skill, check);
  const sylfDamage = sylf?.grade ? roll(`${sylf.grade}T3`, g.rng) : 0;
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
    // Kastvapen kan pareras med sköld av den som ser kastet. Projektiler kan inte pareras, utom med
    // ett närstridsvapen av den som har Snabb uppfattning (som också kan parera kast med vapnet).
    const quick = actorHas(g, victim, 'snabb_uppfattning');
    const sees = flankMod(a, victim) < MELEE_MODS['Anfall bakifrån'];
    if (sees && check.result !== 'perfekt' && ((r.kind === 'kast' && (victim.shield || quick)) || (r.kind === 'projektil' && quick))) {
      const parry = tryParry(g, victim, a, w, r.kind === 'kast' && !quick, undefined, { ranged: true, weaponOnly: r.kind === 'projektil' });
      if (parry?.check.success) {
        g.log(`${victim.name} parerar med ${parry.name} (${parry.text}).`);
        g.emit(victim.id, 'Parerat', 'miss');
        return finishThrow(g, a, r, landing);
      }
      if (parry?.check.result === 'fummel') fumble(g, victim, parry.table, parry.slot);
    }
    if (r.id === 'blasror') blowpipe(g, a, victim);
    else hit(g, a, victim, w, { perfect: check.result === 'perfekt', extra: sylfDamage, aim: victim === target ? aim : null, table: 'avstånd', shieldFrom: r.kind === 'projektil' ? a : undefined });
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
export function rangedWeapon(a: Actor, r: RangedInfo): WeaponInfo {
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
  if (r.kind !== 'kast' || !g.charOf(a) || WEAPONS[a.weapon]?.kind !== 'kast') return;
  throwAway(g, a, at);
}

function throwAway(g: Game, a: Actor, at: { x: number; y: number }) {
  const ch = g.charOf(a)!;
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
  if (e.kind === 'egenskap' && e.attr && e.mod) changeAttribute(g, a, e.attr, -e.mod);
  if (e.kind === 'kontrollerad' || e.kind === 'svävar' || e.kind === 'vattenandning') revertSpell(g, a, e);
  if ((e.kind === 'osynlig' || e.kind === 'kamouflage') && !a.sneaking && !a.effects.some((x) => x !== e && (x.kind === 'osynlig' || x.kind === 'kamouflage'))) a.hidden = false;
  if (e.kind === 'läkning' && a.alive && e.mod) {
    if (a.detailed) g.heal(e.mod, a);
    else a.kp = Math.min(a.maxKp, a.kp + e.mod);
    g.log(`${e.label}: ${a.name} läker ${e.mod} KP.`);
  } else if (e.spell && isParty(a)) g.log(`${e.label} upphör.`);
}

/** Tar bort en besvärjelses effekt i förtid (SKINGRA) och återställer det den ändrade. */
export function endSpellEffect(g: Game, a: Actor, e: ActiveEffect) {
  a.effects = a.effects.filter((x) => x !== e);
  if (e.kind === 'egenskap' && e.attr && e.mod) changeAttribute(g, a, e.attr, -e.mod);
  if (e.kind === 'kontrollerad' || e.kind === 'svävar' || e.kind === 'vattenandning') revertSpell(g, a, e);
  if ((e.kind === 'osynlig' || e.kind === 'kamouflage') && !a.sneaking && !magicallyHidden(a)) a.hidden = false;
}

/**
 * ÖKA och MINSKA: ändrar en grundegenskap med `delta`. STO och FYS ändrar KP (Vidar): KP och KP i
 * kroppsdelarna ändras lika mycket som maxvärdet, så förlorade KP står kvar när besvärjelsen tar
 * slut. Förflyttningen räknas om för den som har ett rollformulär. Skadebonus följer STY av sig själv.
 */
export function changeAttribute(g: Game, a: Actor, attr: AttrKey, delta: number) {
  if (!delta) return;
  const before = { ...a.attrs };
  a.attrs[attr] += delta;
  if (attr === 'STO' || attr === 'FYS') {
    const diff = maxKp(a.attrs) - maxKp(before);
    if (diff) {
      const locs = locationKp(a.maxKp + diff);
      a.maxKp += diff;
      a.kp += diff;
      for (const l of HIT_LOCATIONS) {
        const d = locs[l] - a.locMax[l];
        a.locMax[l] = locs[l];
        a.locKp[l] += d;
      }
      if (diff < 0 && a.alive) {
        if (a.detailed) for (const l of HIT_LOCATIONS) if (a.locKp[l] <= 0) checkLocation(g, a, l);
        if (a.alive) checkTotal(g, a);
      }
    }
  }
  const ch = g.charOf(a);
  if (ch && (attr === 'STO' || attr === 'FYS' || attr === 'SMI')) a.move = movement(a.attrs, RACES[ch.race].move);
}

/**
 * När KONTROLLERA PERSON tar slut blir personen som förut, och när LEVITATION eller FLYGA tar slut
 * landar figuren: över vatten eller ett träd på närmaste lediga ruta (tolkning).
 */
function revertSpell(g: Game, a: Actor, e: ActiveEffect) {
  if (e.kind === 'kontrollerad') {
    // Ett tillkallat djur blir inte fientligt igen när magin tar slut; det går sin väg (tolkning).
    if (e.summoned) {
      a.hostile = false;
      a.fled = true;
      if (a.alive) g.log(`${a.name} lämnar gruppen och försvinner in i terrängen.`);
      return;
    }
    if (e.was) a.hostile = e.was.hostile;
    if (a.alive) g.log(`${a.name} är inte längre kontrollerad${a.hostile ? ' och vänder sig mot gruppen igen' : ''}.`);
    if (a.hostile && a.alive && g.state.mode === 'explore') g.provoke(a.id);
    return;
  }
  if (a.effects.some((x) => x.kind === 'svävar' || x.kind === 'vattenandning')) return;
  if (!walkable(g.map, a.x, a.y)) {
    for (let r = 1; r <= 6; r++) {
      const spot = DIRS.map(([dx, dy]) => ({ x: a.x + dx * r, y: a.y + dy * r })).find((p) => walkable(g.map, p.x, p.y) && !g.actorAt(p.x, p.y));
      if (spot) {
        a.x = spot.x;
        a.y = spot.y;
        break;
      }
    }
  }
  if (a.alive) g.log(e.kind === 'vattenandning' ? `${a.name} måste upp ur vattnet.` : `${a.name} sjunker till marken.`);
}
