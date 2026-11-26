/**
 * Ritualerna LADDNING och FÖRYNGRA, och FÖRÄNDRA för föremål. Tolkningarna står i
 * docs/regelbeslut.md under Ritualer och FÖRÄNDRA.
 */
import { RACES } from '../data/races';
import { WEAPONS } from '../data/weapons';
import { changeAttribute } from './combat';
import { itemInfo } from './inventory';
import { itemCharges } from './magicitems';
import type { Game } from './game';
import { AGE, AGE_GROUPS, type AgeGroup } from './rules';
import type { ActiveEffect, Actor, AttrKey } from './types';

type EffectBase = Pick<ActiveEffect, 'label' | 'spell' | 'grade' | 'persist' | 'rounds' | 'days'>;

// ------------------------------------------------------------------ LADDNING

/** LADDNING: 5 PSY per E. */
export const CHARGE_PER_GRADE = 5;

/** Föremål i packningen som kan laddas: de som magikern bär och som aldrig har laddats. */
export function chargeableItems(g: Game, a: Actor): string[] {
  const ch = g.charOf(a);
  if (!ch) return [];
  const done = new Set((ch.charges ?? []).map((c) => c.item));
  return [...new Set(ch.inventory)].filter((id) => !done.has(id));
}

/** PSY som magikern kan dra ur laddade föremål som hen bär. */
export function chargeAvailable(g: Game, a: Actor): number {
  itemCharges(g, a);
  const ch = g.charOf(a);
  if (!ch) return 0;
  return (ch.charges ?? []).filter((c) => ch.inventory.includes(c.item)).reduce((n, c) => n + c.psy, 0);
}

/** Drar PSY ur laddade föremål. Returnerar hur mycket som togs. */
export function drawCharge(g: Game, a: Actor, want: number): number {
  itemCharges(g, a);
  const ch = g.charOf(a);
  if (!ch) return 0;
  let taken = 0;
  for (const c of ch.charges ?? []) {
    if (taken >= want || !ch.inventory.includes(c.item)) continue;
    const n = Math.min(c.psy, want - taken);
    c.psy -= n;
    taken += n;
  }
  return taken;
}

export function charge(g: Game, caster: Actor, item: string, grade: number) {
  const ch = g.charOf(caster);
  if (!ch) return;
  (ch.charges ??= []).push({ item, psy: grade * CHARGE_PER_GRADE });
  g.log(`${itemName(item)} laddas med ${grade * CHARGE_PER_GRADE} PSY. Det kan aldrig laddas igen.`);
}

const itemName = (id: string) => itemInfo(id)?.name ?? id;

// ------------------------------------------------------------------ FÖRYNGRA

/** Åldersgruppen för ett antal år hos rasen, eller null om rasen saknar åldrar. */
function ageGroupOf(race: string, years: number): AgeGroup | null {
  const ages = RACES[race]?.ages;
  if (!ages) return null;
  for (const gr of AGE_GROUPS) if (years <= ages[gr][1]) return gr;
  return 'gammal';
}

/** De kroppsliga grundegenskaperna som åldern påverkar (Bok III: bara de kroppsliga). */
const BODY: AttrKey[] = ['STY', 'FYS', 'SMI', 'STO'];

/**
 * FÖRYNGRA: kroppen blir E × 5 år yngre en tid. Tolkning: hamnar personen i en yngre åldersgrupp
 * ändras de kroppsliga grundegenskaperna efter ålderstabellen, så länge besvärjelsen varar.
 */
export function rejuvenate(g: Game, t: Actor, grade: number, effect: EffectBase) {
  const ch = g.charOf(t);
  if (!ch) {
    g.log('Det finns ingen ålder att ändra på.');
    return;
  }
  const from = ageGroupOf(ch.race, ch.age.years);
  const to = ageGroupOf(ch.race, Math.max(1, ch.age.years - grade * 5));
  g.log(`${t.name}s kropp blir ${grade * 5} år yngre.`);
  if (!from || !to || from === to) return;
  for (const k of BODY) {
    const d = AGE[to].mods[k] - AGE[from].mods[k];
    if (!d) continue;
    changeAttribute(g, t, k, d);
    t.effects.push({ ...effect, kind: 'egenskap', attr: k, mod: d, label: `FÖRYNGRA: ${k} ${d > 0 ? '+' : ''}${d}` });
  }
  g.log(`Kroppen är som hos en ${to === 'ung' ? 'ung' : to === 'mogen' ? 'mogen' : 'medelålders'} person igen.`);
}

// ------------------------------------------------------------------ FÖRÄNDRA

/** Vapnen som ett vapen kan förvandlas till: samma slag (närstrid eller avstånd). */
export function transformChoices(weapon: string): string[] {
  const w = WEAPONS[weapon];
  if (!w) return [];
  const kind = (x: string) => (WEAPONS[x].kind === 'närstrid' ? 'närstrid' : 'avstånd');
  return Object.keys(WEAPONS).filter((id) => id !== weapon && kind(id) === kind(weapon));
}

/** E som krävs: en per 3 STO, och för föremål en per påbörjade 3 kg (tolkning). */
export function transformGrade(from: string, to: string): number {
  return Math.max(1, Math.ceil(Math.max(WEAPONS[from]?.weight ?? 0, WEAPONS[to]?.weight ?? 0) / 3));
}

/**
 * FÖRÄNDRA ett vapen i handen till ett annat vapen av samma slag så länge besvärjelsen varar,
 * också ett järnvapen till ett trävapen (Vidar). Sedan blir det som förut.
 */
export function transformWeapon(g: Game, t: Actor, to: string, effect: EffectBase) {
  const from = t.weapon;
  if (!WEAPONS[from]) {
    g.log(`${t.name} håller inget vapen.`);
    return;
  }
  swapWeapon(g, t, from, to);
  t.effects.push({ ...effect, kind: 'förändrad', item: from, label: `FÖRÄNDRA: ${WEAPONS[to].name} (var ${WEAPONS[from].name.toLowerCase()})` });
  g.log(`${t.name}s ${WEAPONS[from].name.toLowerCase()} förvandlas till ${WEAPONS[to].name.toLowerCase()}.`);
}

/** När FÖRÄNDRA tar slut blir vapnet som förut. */
export function revertWeapon(g: Game, t: Actor, e: ActiveEffect) {
  if (!e.item) return;
  const now = t.weapon;
  if (WEAPONS[now]) swapWeapon(g, t, now, e.item);
  if (t.alive) g.log(`${t.name}s vapen blir ${WEAPONS[e.item].name.toLowerCase()} igen.`);
}

function swapWeapon(g: Game, t: Actor, from: string, to: string) {
  t.weapon = to;
  const w = WEAPONS[to];
  if (w.kind === 'närstrid' && w.bv !== null) t.bv.weapon = w.bv;
  else delete t.bv.weapon;
  const ch = g.charOf(t);
  if (ch) {
    const i = ch.inventory.indexOf(from);
    if (i >= 0) ch.inventory[i] = to;
    if (ch.equipped.weapon === from) ch.equipped.weapon = to;
  }
}
