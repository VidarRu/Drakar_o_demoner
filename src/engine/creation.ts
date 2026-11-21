import { abilityFor, ABILITY_BY_ID, type AbilityDef, type RaisableAttr } from '../data/abilities';
import { ARMOR, SHIELDS } from '../data/armor';
import { ITEMS } from '../data/equipment';
import { PROFESSIONS, RANGER_MAX_SCHOOL_VALUE } from '../data/professions';
import { RACES } from '../data/races';
import { MARTIAL_TECHNIQUES, SKILLS } from '../data/skills';
import { SPELLS } from '../data/spells';
import type { ProfessionDef, RaceDef, SkillDef, SkillOption } from '../data/types';
import { WEAPONS } from '../data/weapons';
import { roll, type Rng } from './dice';
import {
  AGE,
  attrPrice,
  baseChance,
  CAPITAL_ABOVE_CLASS_MAX,
  EP_PER_LEFTOVER_BP,
  fvCostMultiplier,
  grip,
  lookup,
  maxKp,
  nativeLiteracyBc,
  nativeSpeechBc,
  SKILL_BASE_COST,
  SOCIAL_CLASS,
  SPECIAL_ABILITY_BP,
  spellBaseCost,
  START_BP,
  START_CAPITAL,
  stoPrice,
  SWORD_HAND,
  type AgeGroup,
  type SocialClass,
  type SwordHand,
} from './rules';
import { ATTR_KEYS, type AttrKey, type Attrs, type Character } from './types';

/**
 * Skapa rollperson med bakgrundspoäng (Bok I, Hur du skapar en rollperson).
 * Utkastet byggs upp steg för steg i gränssnittet; alla beräkningar och kontroller finns här.
 *
 * Färdigheter har nycklar som "smyga" eller, för underfärdigheter, "hantverk:smide" och
 * "tala_frammande:alviska". Köp av FV lagras som önskat slutvärde, så att kostnaden alltid
 * räknas från aktuell baschans.
 */

export const RAISABLE: RaisableAttr[] = ['STY', 'FYS', 'SMI', 'INT', 'PSY', 'KAR'];

export interface Draft {
  name: string;
  gender: 'man' | 'kvinna';
  race: string;
  profession: string;
  /** Köpta grundegenskaper (3–18) före rasmodifikation. */
  bought: Record<RaisableAttr, number>;
  /** Steg från rasens normal-STO (−5 … +5). */
  stoSteps: number;
  abilityBp: number;
  /** 2T20 som slogs för särskild förmåga (utan BP). */
  abilityDice?: number;
  /** Val som förmågan kräver: en färdighet, ett språk, ett yrke, ett folk, eller grundegenskaper. */
  abilityChoice?: { skill?: string; language?: string; profession?: string; foe?: string; attrs?: Partial<Record<RaisableAttr, number>> };
  /** Spelledaren lät slå om förmågan en gång. */
  abilityRerolled?: boolean;
  swordBp: number;
  swordDice?: number;
  socialBp: number;
  socialDice?: number;
  capitalBp: number;
  capitalDice?: number;
  age: AgeGroup;
  years?: number;
  /** Namn på människospråket som rollpersonen har som modersmål. */
  humanLanguage: string;
  /** Halvalvens val: läsa människospråket eller alviska. */
  reads?: string;
  /** Valda yrkesfärdigheter (nycklar). */
  profSkills: string[];
  /** Extra yrkesfärdigheter från förmågan Stort kunskapsområde. */
  extraSkills: string[];
  /** Tekniker i rollpersonens stridskonst. */
  techniques: string[];
  /** Önskat FV efter köp, per färdighetsnyckel. */
  targets: Record<string, number>;
  /** Önskat skicklighetsvärde per besvärjelse. */
  spells: Record<string, number>;
  /** Färdighet eller besvärjelse med halverad kostnad (God känsla för yrket). */
  halfCost?: string;
  /** Köpt utrustning: id → antal. */
  bought_items: Record<string, number>;
  equipped: { weapon?: string; offhand?: string; shield?: string; armor: string[] };
  appearance: string;
}

export function newDraft(): Draft {
  return {
    name: '',
    gender: 'man',
    race: 'manniska',
    profession: 'krigare',
    bought: { STY: 10, FYS: 10, SMI: 10, INT: 10, PSY: 10, KAR: 10 },
    stoSteps: 0,
    abilityBp: 0,
    swordBp: 0,
    socialBp: 0,
    capitalBp: 0,
    age: 'mogen',
    humanLanguage: 'Människospråket',
    profSkills: [],
    extraSkills: [],
    techniques: [],
    targets: {},
    spells: {},
    bought_items: {},
    equipped: { armor: [] },
    appearance: '',
  };
}

// ------------------------------------------------------------------ uppslag

export const race = (d: Draft): RaceDef => RACES[d.race];
export const profession = (d: Draft): ProfessionDef => PROFESSIONS[d.profession];

const baseId = (key: string) => key.split(':')[0];
const subId = (key: string) => key.split(':')[1] ?? '';

export function skillDef(key: string): SkillDef {
  const def = SKILLS[baseId(key)];
  if (!def) throw new Error(`Okänd färdighet: ${key}`);
  return def;
}

/** Grundegenskapen för en färdighetsnyckel (hantverk har egna grundegenskaper). */
export function skillAttr(key: string): AttrKey | 'spec' {
  const def = skillDef(key);
  const opt = def.specialized?.options?.find((o) => o.id === subId(key));
  return opt?.attr ?? def.attr;
}

/** Visningsnamn för en färdighetsnyckel, t.ex. "Hantverk: Smide". */
export function skillName(key: string): string {
  const def = skillDef(key);
  const sub = subId(key);
  if (!sub) return def.name;
  const opt = def.specialized?.options?.find((o) => o.id === sub);
  return `${def.name}: ${opt?.name ?? (sub[0].toUpperCase() + sub.slice(1)).replace(/_/g, ' ')}`;
}

/** Gör ett fritt namn (språk, instrument …) till en nyckeldel. Svenska bokstäver behålls. */
export function slug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9åäöéü]+/g, '_')
    .replace(/^_|_$/g, '');
}

const TECHNIQUE_COST: Record<string, number> = Object.fromEntries(MARTIAL_TECHNIQUES.map((t) => [t.id, t.cost]));

// ------------------------------------------------------------------ bakgrundspoäng

export function racialAttrs(d: Draft): Attrs {
  const r = race(d);
  const out = {} as Attrs;
  for (const k of RAISABLE) out[k] = d.bought[k] + r.mods[k];
  out.STO = r.sto.normal + d.stoSteps;
  return out;
}

export function bpSpent(d: Draft): number {
  let sum = race(d).bp + stoPrice(d.stoSteps);
  for (const k of RAISABLE) sum += attrPrice(d.bought[k]);
  return sum + d.abilityBp + d.swordBp + d.socialBp + d.capitalBp;
}

export const bpLeft = (d: Draft) => START_BP - bpSpent(d);

/** Grundegenskapskrav som inte är uppfyllda (räknat efter rasmodifikation). */
export function unmetRequirements(d: Draft): AttrKey[] {
  const attrs = racialAttrs(d);
  const req = profession(d).requirements;
  return (Object.keys(req) as AttrKey[]).filter((k) => attrs[k] < req[k]!);
}

// ------------------------------------------------------------------ slumpslagen

export function rollAbility(d: Draft, rng: Rng) {
  d.abilityDice = d.abilityBp >= SPECIAL_ABILITY_BP.min ? roll('2T20', rng) : undefined;
  d.abilityChoice = undefined;
}

export function rollSwordHand(d: Draft, rng: Rng) {
  d.swordDice = roll('2T6', rng);
}
export function rollSocial(d: Draft, rng: Rng) {
  d.socialDice = roll('2T6', rng);
}
export function rollCapital(d: Draft, rng: Rng) {
  d.capitalDice = roll('2T6', rng);
}

export function ability(d: Draft): AbilityDef | null {
  if (d.abilityDice === undefined || d.abilityBp < SPECIAL_ABILITY_BP.min) return null;
  return abilityFor(d.abilityDice + d.abilityBp, d.profession === 'magiker');
}

export function swordHand(d: Draft): SwordHand | null {
  const a = ability(d);
  if (a?.effect.kind === 'swordHand') return a.effect.value;
  return d.swordDice === undefined ? null : lookup(SWORD_HAND, d.swordDice + d.swordBp)!;
}

export const socialTotal = (d: Draft) => (d.socialDice === undefined ? null : d.socialDice + d.socialBp);

export function socialClass(d: Draft): SocialClass | null {
  const t = socialTotal(d);
  return t === null ? null : lookup(SOCIAL_CLASS, t)!;
}

/** Summan för startkapitalet, före ålderns multipel. Kan inte bli mer än ståndet + 10. */
export function capitalTotal(d: Draft): number | null {
  const s = socialTotal(d);
  if (d.capitalDice === undefined || s === null) return null;
  const sum = d.capitalDice + d.capitalBp + Math.ceil(d.socialBp / 2);
  return Math.min(sum, s + CAPITAL_ABOVE_CLASS_MAX);
}

// ------------------------------------------------------------------ ålder

/** Åldersgruppen som styr grundegenskaper och högsta FV respektive EP och kapital. */
export function ageGroups(d: Draft): { attrs: AgeGroup; ep: AgeGroup } {
  const rules = race(d).ageRules;
  return rules ? { attrs: rules.attrsAndMaxFv, ep: rules.epAndCapital } : { attrs: d.age, ep: d.age };
}

export function startCapital(d: Draft): number | null {
  const t = capitalTotal(d);
  return t === null ? null : lookup(START_CAPITAL, t)! * AGE[ageGroups(d).ep].capital;
}

export function maxStartFv(d: Draft): number {
  return AGE[ageGroups(d).attrs].maxFv;
}

/** Slutliga grundegenskaper: köpta + ras + förmågan Höjd grundegenskap + ålder. */
export function finalAttrs(d: Draft): Attrs {
  const out = racialAttrs(d);
  const a = ability(d);
  if (a?.effect.kind === 'attrs') {
    for (const [k, v] of Object.entries(d.abilityChoice?.attrs ?? {})) out[k as AttrKey] += v ?? 0;
  }
  const mods = AGE[ageGroups(d).attrs].mods;
  for (const k of ATTR_KEYS) out[k] = Math.max(1, out[k] + mods[k]);
  return out;
}

export function epBudget(d: Draft): number {
  return AGE[ageGroups(d).ep].ep + Math.max(0, bpLeft(d)) * EP_PER_LEFTOVER_BP;
}

// ------------------------------------------------------------------ yrkesfärdigheter

/** Vilken grupp i yrkeslistan en nyckel hör till, eller null om den inte finns i listan. */
export function optionFor(prof: ProfessionDef, key: string): SkillOption | null {
  const base = baseId(key);
  // Fasta poster först: "djurhelning" täcker alla djurslag, "magiskola:animism" bara den skolan.
  for (const o of prof.options) if (typeof o === 'string' && (o === key || o === base)) return o;
  const def = SKILLS[base];
  for (const o of prof.options) {
    if (typeof o === 'string') continue;
    if (o.group === 'vapen' && def?.weaponGroup) return o;
    if (o.group === 'tala' && base === 'tala_frammande') return o;
    if (o.group === 'läsa' && base === 'las_skriv_frammande') return o;
    if (o.group === 'hantverk' && base === 'hantverk') return o;
    if (o.group === 'instrument' && base === 'spela_instrument') return o;
    if (o.group === 'magiskola' && base === 'magiskola') return o;
  }
  return null;
}

/** Underfärdigheter som yrket bara får välja utan begränsning från listans fasta poster. */
const NEEDS_SUB = new Set(['tala_frammande', 'las_skriv_frammande', 'hantverk', 'spela_instrument', 'magiskola', 'tva_vapen', 'djurhelning', 'kulturkannedom', 'undre_varlden', 'teckensprak', 'kanna_magi']);

export function profSkillErrors(d: Draft): string[] {
  const prof = profession(d);
  const errors: string[] = [];
  const counts = new Map<SkillOption, number>();
  for (const key of d.profSkills) {
    const opt = optionFor(prof, key);
    if (!opt) {
      errors.push(`${skillName(key)} kan inte väljas av en ${prof.name.toLowerCase()}.`);
      continue;
    }
    if (NEEDS_SUB.has(baseId(key)) && !subId(key)) errors.push(`${skillDef(key).name} måste specificeras.`);
    counts.set(opt, (counts.get(opt) ?? 0) + 1);
  }
  for (const [opt, n] of counts) {
    if (typeof opt !== 'string' && n > opt.max) errors.push(`För många val i gruppen ${GROUP_NAMES[opt.group]} (högst ${opt.max}).`);
  }
  if (new Set(d.profSkills).size !== d.profSkills.length) errors.push('Samma färdighet är vald två gånger.');
  if (d.profSkills.length !== prof.picks) errors.push(`Välj exakt ${prof.picks} yrkesfärdigheter (${d.profSkills.length} valda).`);
  for (const o of prof.options) {
    if (typeof o !== 'string' && o.required && !counts.get(o)) errors.push(`En ${prof.name.toLowerCase()} måste välja en ${GROUP_NAMES[o.group]}.`);
  }
  const extra = ability(d)?.effect;
  const extraCount = extra?.kind === 'extraPicks' ? extra.count : 0;
  if (d.extraSkills.length !== extraCount) errors.push(`Välj ${extraCount} extra yrkesfärdigheter (Stort kunskapsområde).`);
  for (const key of d.extraSkills) {
    const def = skillDef(key);
    if (def.type !== 'sekundär' || isForbidden(d, key)) errors.push(`${skillName(key)} kan inte väljas som extra yrkesfärdighet.`);
    if (d.profSkills.includes(key)) errors.push(`${skillName(key)} är redan vald.`);
  }
  if (d.profSkills.some((k) => baseId(k) === 'stridskonster') && !d.techniques.length) errors.push('Välj tekniker till stridskonsten.');
  return errors;
}

export const GROUP_NAMES: Record<Exclude<SkillOption, string>['group'], string> = {
  vapen: 'vapenfärdigheter',
  tala: 'talade främmande språk',
  läsa: 'skrivna främmande språk',
  hantverk: 'hantverk',
  instrument: 'instrument',
  magiskola: 'magiskola',
};

/** Färdigheter som rollpersonen aldrig får lära sig (magiskolor för de flesta yrken). */
export function isForbidden(d: Draft, key: string): boolean {
  const def = skillDef(key);
  if (!def.onlyFor) return false;
  if (!def.onlyFor.includes(d.profession)) return true;
  // Utbygdsjägaren får bara Animism.
  return d.profession === 'utbygdsjagare' && baseId(key) === 'magiskola' && subId(key) !== 'animism';
}

export const allProfSkills = (d: Draft) => [...d.profSkills, ...d.extraSkills];

// ------------------------------------------------------------------ startfärdigheter

export type SkillStatus = 'primär' | 'yrke' | 'fast' | 'sekundär';

/** Hur en färdighet räknas för rollpersonen vid skapandet. */
export function skillStatus(d: Draft, key: string): SkillStatus {
  const def = skillDef(key);
  if (allProfSkills(d).includes(key)) return 'yrke';
  if (def.type === 'primär' || race(d).primarySkills?.includes(key) || profession(d).primarySkills?.includes(baseId(key))) return 'primär';
  if (fixedFromAbility(d).has(key) || race(d).fixedSkills[key] !== undefined) return 'fast';
  return 'sekundär';
}

/** Färdigheter med ett fast FV från en särskild förmåga, som inte kan höjas från start. */
function fixedFromAbility(d: Draft): Map<string, number> {
  const out = new Map<string, number>();
  const a = ability(d);
  if (!a) return out;
  const e = a.effect;
  const isProfOrPrimary = (k: string) => allProfSkills(d).includes(k) || skillDef(k).type === 'primär';
  const add = (k: string, fv: number) => {
    if (!isProfOrPrimary(k)) out.set(k, (out.get(k) ?? 0) + fv);
  };
  if (e.kind === 'fv') e.skills.forEach((k) => add(k, e.amount));
  if (e.kind === 'fvChoice' && d.abilityChoice?.skill) add(d.abilityChoice.skill, e.amount);
  if (e.kind === 'fixedChoice' && d.abilityChoice?.skill) out.set(d.abilityChoice.skill, e.fv);
  if (e.kind === 'language' && d.abilityChoice?.language) {
    const lang = slug(d.abilityChoice.language);
    out.set(`tala_frammande:${lang}`, e.fv);
    out.set(`las_skriv_frammande:${lang}`, e.fv);
  }
  return out;
}

/** Tillägg från ras och särskild förmåga på en primär färdighet eller yrkesfärdighet. */
function bonusFor(d: Draft, key: string): number {
  let bonus = race(d).skillBonus[key] ?? 0;
  const a = ability(d);
  if (!a) return bonus;
  const e = a.effect;
  if (e.kind === 'fv' && e.skills.includes(key)) bonus += e.amount;
  if (e.kind === 'fvChoice' && d.abilityChoice?.skill === key) bonus += e.amount;
  return bonus;
}

/** Modersmålen som nycklar. */
export function nativeLanguages(d: Draft): { speaks: string[]; reads: string[] } {
  const r = race(d);
  const name = (l: string) => (l === 'människospråk' ? slug(d.humanLanguage) || 'människospråket' : slug(l));
  const reads = Array.isArray(r.reads) ? r.reads : [d.reads ?? r.reads.oneOf[0]];
  return { speaks: r.speaks.map(name), reads: reads.map(name) };
}

/** FV före köp: baschans, modersmål, rasens fasta värden och förmågornas tillägg. */
export function skillBase(d: Draft, key: string): number {
  const attrs = finalAttrs(d);
  const status = skillStatus(d, key);
  const base = baseId(key);
  const fixed = fixedFromAbility(d).get(key);
  if (fixed !== undefined) return fixed;
  const raceFixed = race(d).fixedSkills[key];
  if (raceFixed !== undefined) return raceFixed + bonusFor(d, key);
  if (base === 'tala_modersmal') return nativeSpeechBc(socialClass(d) ?? 'Lägre medelklass');
  if (base === 'las_skriv_modersmal') return nativeLiteracyBc(socialClass(d) ?? 'Lägre medelklass', attrs.INT);
  if (status === 'sekundär') return 0;
  if (base === 'tva_vapen') {
    const [a, b] = subId(key).split('+');
    return Math.floor(Math.min(skillValue(d, a), skillValue(d, b)) / 2) + bonusFor(d, key);
  }
  const attr = skillAttr(key);
  const bc = attr === 'spec' ? 0 : baseChance(attrs[attr]);
  return bc + bonusFor(d, key);
}

/** Aktuellt FV: köpt mål eller grundvärdet. */
export function skillValue(d: Draft, key: string): number {
  const base = skillBase(d, key);
  return Math.max(base, d.targets[key] ?? base);
}

/** Grundkostnad i EP för färdigheten, eller null om den inte får köpas från start. */
export function baseCost(d: Draft, key: string): number | null {
  const status = skillStatus(d, key);
  if (status === 'fast' || status === 'sekundär') return null;
  const e = ability(d)?.effect;
  if (e?.kind === 'baseCost' && Array.isArray(e.skills) && e.skills.includes(baseId(key))) return e.cost;
  if (baseId(key) === 'stridskonster') {
    const sum = d.techniques.reduce((s, t) => s + (TECHNIQUE_COST[t] ?? 0), 0);
    return Math.max(1, Math.ceil(sum));
  }
  return status === 'yrke' ? SKILL_BASE_COST.yrke : SKILL_BASE_COST.primär;
}

/** Högsta FV som får köpas från start. */
export function maxPurchase(d: Draft, key: string): number {
  const def = skillDef(key);
  const attrs = finalAttrs(d);
  let max = maxStartFv(d);
  const a = ability(d);
  if (a?.effect.kind === 'fvChoice' && a.effect.raiseCap && d.abilityChoice?.skill === key) max += 2;
  const attr = skillAttr(key);
  // Färdigheter i kategori B kan aldrig bli högre än sin grundegenskap.
  if (def.category === 'B' && attr !== 'spec') max = Math.min(max, attrs[attr]);
  if (def.cappedByAttr) max = Math.min(max, attrs[def.cappedByAttr]);
  if (def.cappedBy) max = Math.min(max, skillValue(d, def.cappedBy));
  if (baseId(key) === 'tva_vapen') {
    const [x, y] = subId(key).split('+');
    max = Math.min(max, skillValue(d, x), skillValue(d, y));
  }
  return max;
}

function costFor(d: Draft, key: string, from: number, to: number, unit: number): number {
  const cost = unit * fvCostMultiplier(from, to);
  return d.halfCost === key ? Math.ceil(cost / 2) : cost;
}

export function skillCost(d: Draft, key: string): number {
  const target = d.targets[key];
  const unit = baseCost(d, key);
  if (target === undefined || unit === null) return 0;
  const base = skillBase(d, key);
  return target > base ? costFor(d, key, base, target, unit) : 0;
}

/** Besvärjelser som rollpersonen får lära sig från start. */
export function availableSpells(d: Draft): string[] {
  if (!profession(d).spellsAtStart) return [];
  const school = allProfSkills(d).find((k) => baseId(k) === 'magiskola');
  if (!school) return [];
  const fv = skillValue(d, school);
  const name = subId(school);
  const cap = d.profession === 'utbygdsjagare' ? Math.min(fv, RANGER_MAX_SCHOOL_VALUE) : fv;
  return Object.values(SPELLS)
    .filter((s) => (s.school === 'allmän' || s.school === name) && s.sv <= cap)
    .map((s) => s.id);
}

export function spellCost(d: Draft, id: string): number {
  const target = d.spells[id] ?? 0;
  return target > 0 ? costFor(d, `spell:${id}`, 0, target, spellBaseCost(SPELLS[id].sv)) : 0;
}

export function epSpent(d: Draft): number {
  let sum = 0;
  for (const key of Object.keys(d.targets)) sum += skillCost(d, key);
  for (const id of Object.keys(d.spells)) sum += spellCost(d, id);
  return sum;
}

/** Alla färdigheter som rollpersonen har FV i från start. */
export function startingSkills(d: Draft): string[] {
  const keys = new Set<string>();
  for (const s of Object.values(SKILLS)) if (s.type === 'primär' && !s.specialized) keys.add(s.id);
  keys.delete('tala_modersmal');
  keys.delete('las_skriv_modersmal');
  const langs = nativeLanguages(d);
  langs.speaks.forEach((l) => keys.add(`tala_modersmal:${l}`));
  langs.reads.forEach((l) => keys.add(`las_skriv_modersmal:${l}`));
  for (const k of race(d).primarySkills ?? []) keys.add(k);
  for (const k of Object.keys(race(d).fixedSkills)) keys.add(k);
  for (const k of allProfSkills(d)) keys.add(k);
  for (const k of fixedFromAbility(d).keys()) keys.add(k);
  if (d.profession === 'magiker') for (const school of ['animism', 'elementarmagi', 'mentalism']) keys.add(`kanna_magi:${school}`);
  return [...keys];
}

// ------------------------------------------------------------------ utrustning

export function equipmentPrice(id: string): number {
  return (WEAPONS[id] ?? SHIELDS[id] ?? ARMOR[id] ?? ITEMS[id])?.price ?? 0;
}

export function equipmentCost(d: Draft): number {
  return Object.entries(d.bought_items).reduce((s, [id, n]) => s + equipmentPrice(id) * n, 0);
}

// ------------------------------------------------------------------ kontroll och resultat

export type Step = 'grund' | 'egenskaper' | 'bakgrund' | 'yrkesfardigheter' | 'fardigheter' | 'utrustning';

export function stepErrors(d: Draft, step: Step): string[] {
  const errors: string[] = [];
  switch (step) {
    case 'grund':
      if (!d.name.trim()) errors.push('Rollpersonen behöver ett namn.');
      break;
    case 'egenskaper': {
      const unmet = unmetRequirements(d);
      if (unmet.length) errors.push(`Grundegenskapskraven för ${profession(d).name.toLowerCase()} är inte uppfyllda: ${unmet.join(', ')}.`);
      const sto = racialAttrs(d).STO;
      const r = race(d).sto;
      if (sto < r.min || sto > r.max) errors.push(`STO måste vara mellan ${r.min} och ${r.max}.`);
      if (bpLeft(d) < 0) errors.push('För många bakgrundspoäng är spenderade.');
      break;
    }
    case 'bakgrund': {
      if (bpLeft(d) < 0) errors.push('För många bakgrundspoäng är spenderade.');
      if (d.abilityBp > SPECIAL_ABILITY_BP.max) errors.push(`Högst ${SPECIAL_ABILITY_BP.max} BP på särskild förmåga.`);
      if (d.abilityBp >= SPECIAL_ABILITY_BP.min && d.abilityDice === undefined) errors.push('Slå för särskild förmåga.');
      if (swordHand(d) === null) errors.push('Slå för svärdshand.');
      if (d.socialDice === undefined) errors.push('Slå för socialt stånd.');
      if (d.capitalDice === undefined) errors.push('Slå för startkapital.');
      errors.push(...abilityChoiceErrors(d));
      break;
    }
    case 'yrkesfardigheter':
      errors.push(...profSkillErrors(d));
      break;
    case 'fardigheter': {
      const left = epBudget(d) - epSpent(d);
      if (left < 0) errors.push(`${-left} EP för mycket är spenderade.`);
      for (const [key, t] of Object.entries(d.targets)) {
        if (t > skillBase(d, key) && baseCost(d, key) === null) errors.push(`${skillName(key)} kan inte höjas från start.`);
        if (t > skillBase(d, key) && t > maxPurchase(d, key)) errors.push(`${skillName(key)} får högst köpas till ${maxPurchase(d, key)}.`);
      }
      const allowed = new Set(availableSpells(d));
      for (const [id, s] of Object.entries(d.spells)) {
        if (s > 0 && !allowed.has(id)) errors.push(`${SPELLS[id].name} kan inte läras från start.`);
        if (s > maxStartFv(d)) errors.push(`${SPELLS[id].name} får högst köpas till S${maxStartFv(d)}.`);
      }
      break;
    }
    case 'utrustning': {
      const capital = startCapital(d) ?? 0;
      if (equipmentCost(d) > capital) errors.push('Utrustningen kostar mer än startkapitalet.');
      const attrs = finalAttrs(d);
      const w = d.equipped.weapon ? WEAPONS[d.equipped.weapon] : undefined;
      if (w && grip(w.styReq, attrs.STY, w.kind === 'närstrid' && w.twoHandedOnly) === 'för tungt') errors.push(`${w.name} är för tungt för STY ${attrs.STY}.`);
      if (w && d.equipped.shield && (w.kind === 'projektil' || grip(w.styReq, attrs.STY, w.kind === 'närstrid' && w.twoHandedOnly) !== 'en hand'))
        errors.push(`${w.name} kräver två händer och kan inte kombineras med sköld.`);
      const off = d.equipped.offhand ? WEAPONS[d.equipped.offhand] : undefined;
      if (off) {
        if (d.equipped.shield) errors.push('Man kan inte ha både sköld och ett andra vapen.');
        if (off.kind !== 'närstrid' || grip(off.styReq, attrs.STY, off.twoHandedOnly) !== 'en hand') errors.push(`${off.name} kan inte föras med en hand.`);
        if (w && grip(w.styReq, attrs.STY, w.kind === 'närstrid' && w.twoHandedOnly) !== 'en hand') errors.push(`${w.name} kräver två händer, så det finns ingen hand över.`);
        if (off.id === d.equipped.weapon && (d.bought_items[off.id] ?? 0) < 2) errors.push(`Köp två exemplar av ${off.name.toLowerCase()} för att ha ett i varje hand.`);
      }
      const covered = new Set<string>();
      for (const id of d.equipped.armor) {
        for (const loc of ARMOR[id].covers) {
          if (covered.has(loc)) errors.push(`Två rustningsdelar skyddar ${loc}.`);
          covered.add(loc);
        }
      }
      for (const id of [d.equipped.weapon, d.equipped.offhand, d.equipped.shield, ...d.equipped.armor]) {
        if (id && !d.bought_items[id]) errors.push(`${equipmentName(id)} måste köpas först.`);
      }
      break;
    }
  }
  return [...new Set(errors)];
}

export function equipmentName(id: string): string {
  return (WEAPONS[id] ?? SHIELDS[id] ?? ARMOR[id] ?? ITEMS[id])?.name ?? id;
}

function abilityChoiceErrors(d: Draft): string[] {
  const a = ability(d);
  if (!a) return [];
  const c = d.abilityChoice ?? {};
  switch (a.effect.kind) {
    case 'fvChoice':
    case 'fixedChoice':
      if (!c.skill) return [`Välj färdighet till ${a.name}.`];
      if (isForbidden(d, c.skill)) return [`${skillName(c.skill)} är förbjuden för yrket.`];
      return [];
    case 'language':
      return c.language?.trim() ? [] : [`Välj språk till ${a.name}.`];
    case 'extraProfessionAbility':
      return c.profession && c.profession !== d.profession ? [] : ['Välj ett annat yrkes yrkesförmåga.'];
    case 'foe':
      return c.foe?.trim() ? [] : ['Välj folkslag eller ras för Baneman.'];
    case 'attrs': {
      const vals = Object.values(c.attrs ?? {}).filter((v) => v);
      const ok = (vals.length === 3 && vals.every((v) => v === 1)) || (vals.length === 1 && vals[0] === 2);
      return ok ? [] : ['Fördela +1 på tre grundegenskaper eller +2 på en.'];
    }
    default:
      return [];
  }
}

export const STEPS: Step[] = ['grund', 'egenskaper', 'bakgrund', 'yrkesfardigheter', 'fardigheter', 'utrustning'];

export function allErrors(d: Draft): string[] {
  return STEPS.flatMap((s) => stepErrors(d, s));
}

/** Gör färdigt rollpersonen. Kastar fel om utkastet inte är komplett. */
export function finalize(d: Draft): Character {
  const errors = allErrors(d);
  if (errors.length) throw new Error(errors.join(' '));
  const attrs = finalAttrs(d);
  const skills: Record<string, number> = {};
  for (const key of startingSkills(d)) skills[key] = skillValue(d, key);
  if (d.profession === 'magiker') {
    const school = allProfSkills(d).find((k) => baseId(k) === 'magiskola')!;
    const fv = skills[school];
    const own = `kanna_magi:${subId(school)}`;
    skills[own] = Math.max(skills[own] ?? 0, fv);
    skills.kunskap_om_magi = Math.max(skills.kunskap_om_magi ?? 0, fv);
  }
  const spells: Record<string, number> = {};
  for (const [id, s] of Object.entries(d.spells)) if (s > 0) spells[id] = s;
  const a = ability(d);
  const kpFactor = a?.effect.kind === 'kpFactor' ? a.effect.factor : 1;
  const r = race(d);
  const years = d.years ?? (r.ages ? Math.round((r.ages[d.age][0] + r.ages[d.age][1]) / 2) : 100);
  const capital = startCapital(d)!;
  return {
    name: d.name.trim(),
    gender: d.gender,
    race: d.race,
    profession: d.profession,
    age: { group: r.ageRules ? r.ageRules.attrsAndMaxFv : d.age, years },
    attrs,
    maxKp: Math.ceil(maxKp(attrs) * kpFactor),
    swordHand: swordHand(d)!,
    social: socialClass(d)!,
    ability: a ? { id: a.id, total: d.abilityDice! + d.abilityBp, choice: d.abilityChoice } : null,
    profSkills: allProfSkills(d),
    techniques: [...d.techniques],
    skills,
    spells,
    capital,
    silver: capital - equipmentCost(d),
    inventory: Object.entries(d.bought_items).flatMap(([id, n]) => Array.from({ length: n }, () => id)),
    equipped: { weapon: d.equipped.weapon, offhand: d.equipped.offhand, shield: d.equipped.shield, armor: [...d.equipped.armor] },
    appearance: d.appearance.trim(),
  };
}

export { ABILITY_BY_ID };
