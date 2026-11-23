/**
 * Hjältepoäng, belöningar, PSY-höjning och att bli igenkänd (steg 8, Bok I s. 63–65 och Vidars
 * husregler). Besluten står i docs/regelbeslut.md under Utveckling mellan äventyren.
 */
import { CREATURES, MODULES, NPCS } from '../content';
import { CREATURES as CREATURE_STATS } from '../data/creatures';
import type { AbilityPassive } from '../data/types';
import { slug } from './creation';
import { applyLuck } from './talents';
import { ABILITIES, ABILITY_BY_ID, abilityFor, type AbilityDef } from '../data/abilities';
import { PROFESSIONS } from '../data/professions';
import { RACES } from '../data/races';
import { SKILLS } from '../data/skills';
import { die, roll } from './dice';
import type { Game } from './game';
import {
  baseChance,
  HERO,
  INITIATIVE_MODS,
  locationKp,
  maxKp,
  movement,
  PSY_RAISE,
  HIT_LOCATIONS,
  type Check,
  type CheckResult,
} from './rules';
import type { AbilityChoice, Actor, AttrKey, Character } from './types';

// ------------------------------------------------------------------ särskilda förmågor

/** Alla särskilda förmågor: den från skapandet och de som köpts för hjältepoäng. */
export function abilitiesOf(ch: Character): { def: AbilityDef; choice?: AbilityChoice }[] {
  const out: { def: AbilityDef; choice?: AbilityChoice }[] = [];
  if (ch.ability && ABILITY_BY_ID[ch.ability.id]) out.push({ def: ABILITY_BY_ID[ch.ability.id], choice: ch.ability.choice as AbilityChoice | undefined });
  for (const h of ch.heroAbilities ?? []) if (ABILITY_BY_ID[h.id]) out.push({ def: ABILITY_BY_ID[h.id], choice: h.choice });
  return out;
}

export const hasAbility = (ch: Character, id: string) => abilitiesOf(ch).some((a) => a.def.id === id);

/** Yrkena vars yrkesförmåga personen har: det egna och det från Kluven personlighet. */
export function professionsOf(ch: Character): string[] {
  const out = [ch.profession];
  for (const { def, choice } of abilitiesOf(ch)) {
    if (def.effect.kind === 'extraProfessionAbility' && choice?.profession && PROFESSIONS[choice.profession]) out.push(choice.profession);
  }
  return [...new Set(out)];
}

/** Alla passiva regelvärden från de särskilda förmågorna och yrkesförmågorna. */
export function passivesOf(ch: Character): AbilityPassive[] {
  const out: AbilityPassive[] = [];
  for (const { def } of abilitiesOf(ch)) if (def.passive) out.push(def.passive);
  for (const id of professionsOf(ch)) {
    const p = PROFESSIONS[id]?.ability.passive;
    if (p) out.push(p);
  }
  return out;
}

type NumericPassive = 'initiative' | 'fear' | 'psyResist' | 'elementResist';

/** Summan av ett passivt värde. Varelser utan rollformulär har inga förmågor. */
export function passive(ch: Character | undefined | null, key: NumericPassive): number {
  return ch ? passivesOf(ch).reduce((n, p) => n + (p[key] ?? 0), 0) : 0;
}

/** Permanenta tillägg på CL i en färdighet (Starka nypor, Övertygande tonfall …). */
export function passiveCl(ch: Character | undefined | null, skill: string): number {
  if (!ch) return 0;
  const id = skill.split(':')[0];
  return passivesOf(ch).reduce((n, p) => n + (p.cl?.[id] ?? 0), 0);
}

/** Tillägg på CL vid anfall med vapen (Precisionssinne). */
export function weaponCl(ch: Character | undefined | null): number {
  return ch ? passivesOf(ch).reduce((n, p) => n + (p.cl?.vapen ?? 0), 0) : 0;
}

/** Varelsens folkslag eller ras, som det står i regeldatan (för Baneman). */
export function folkOf(g: Game, a: Actor): string | null {
  const ch = g.charOf(a);
  if (ch) return ch.race;
  if (a.elemental) return null;
  const def = CREATURES[a.defId];
  if (def) return def.folk ?? (CREATURE_STATS[def.id] ? def.id : null);
  return NPCS[a.defId] ? 'manniska' : null;
}

/** Gäller valet för Baneman det här folkslaget? Äldre val är fritext, t.ex. "orcher". */
export function foeMatches(choice: string | undefined, folk: string | null): boolean {
  if (!choice || !folk) return false;
  const s = slug(choice);
  return s === folk || (folk.length >= 3 && s.startsWith(folk));
}

/** Tillägget på CL när anfallaren har Baneman mot försvararens folkslag. */
export function banemanCl(g: Game, att: Actor, def: Actor): number {
  const ch = g.charOf(att);
  if (!ch) return 0;
  const folk = folkOf(g, def);
  return abilitiesOf(ch).reduce((n, { def: d, choice }) => n + (d.passive?.foeCl && foeMatches(choice?.foe, folk) ? d.passive.foeCl : 0), 0);
}

/** Har figuren en särskild förmåga? Varelser utan rollformulär har inga. */
export function actorHas(g: Game, a: Actor, id: string): boolean {
  const ch = g.charOf(a);
  return !!ch && hasAbility(ch, id);
}

/** Har figuren ett yrkes yrkesförmåga (sitt eget eller via Kluven personlighet)? */
export function actorProfession(g: Game, a: Actor, id: string): boolean {
  const ch = g.charOf(a);
  return !!ch && professionsOf(ch).includes(id);
}

/** Ett vanligt djur ur regeldatan (inte en legendarisk varelse). */
export function isCommonAnimal(g: Game, a: Actor): boolean {
  if (g.charOf(a) || a.elemental) return false;
  const folk = folkOf(g, a);
  return !!folk && CREATURE_STATS[folk]?.group === 'djur';
}

/** Djurvän: djuret väljer inte personen som mål, om personen inte har anfallit det. */
export function spares(g: Game, animal: Actor, target: Actor): boolean {
  return isCommonAnimal(g, animal) && actorHas(g, target, 'djurvan') && !animal.provokedBy?.includes(target.id);
}

/** Den som anfaller ett djur är inte längre fredad av Djurvän mot det. */
export function provokeAnimal(g: Game, att: Actor, animal: Actor) {
  if (!isCommonAnimal(g, animal) || !actorHas(g, att, 'djurvan')) return;
  if (!(animal.provokedBy ??= []).includes(att.id)) animal.provokedBy.push(att.id);
}

/** Tillägget på initiativet från yrket, förmågorna och stridskonsten. */
export function initiativeOf(ch: Character): number {
  return passive(ch, 'initiative') + (ch.techniques.includes('initiativbonus') ? INITIATIVE_MODS.initiativbonus : 0);
}

/** KP-faktorn från Extremt smärttålig. */
const kpFactor = (ch: Character) => abilitiesOf(ch).reduce((f, a) => (a.def.effect.kind === 'kpFactor' ? f * a.def.effect.factor : f), 1);

/**
 * Räknar om det som beror på grundegenskaperna och förmågorna: KP (totalt och per kroppsdel),
 * förflyttning, initiativ och Snabbslående. Skador som redan finns står kvar.
 */
export function recompute(a: Actor, ch: Character) {
  const kp = Math.ceil(maxKp(ch.attrs) * kpFactor(ch));
  const diff = kp - a.maxKp;
  const locs = locationKp(kp);
  for (const l of HIT_LOCATIONS) {
    const d = locs[l] - a.locMax[l];
    a.locMax[l] = locs[l];
    if (!a.injuries.some((i) => i.loc === l && i.lost)) a.locKp[l] = Math.min(locs[l], a.locKp[l] + Math.max(0, d));
    else a.locKp[l] = Math.min(a.locKp[l], locs[l]);
  }
  a.maxKp = kp;
  a.kp = Math.min(kp, a.kp + Math.max(0, diff));
  ch.maxKp = kp;
  a.move = movement(ch.attrs, RACES[ch.race].move);
  a.initiative = initiativeOf(ch);
  a.firstAlways = hasAbility(ch, 'snabbslaende');
}

/** Sätter FV i både figuren och rollformuläret, och ger hjältepoäng vid FV 21, 41, 61 … */
export function setFv(g: Game, a: Actor, skill: string, fv: number) {
  const before = a.skills[skill] ?? 0;
  a.skills[skill] = fv;
  const ch = g.charOf(a);
  if (ch) ch.skills[skill] = fv;
  milestones(g, a, skill, before, fv);
}

/** FV 21, 41, 61 och så vidare ger 1T4 HP (Bok I). */
export function milestones(g: Game, a: Actor, skill: string, from: number, to: number) {
  for (let fv = from + 1; fv <= to; fv++) {
    if (fv > HERO.fvMilestone && fv % HERO.fvMilestone === 1) {
      const n = roll(HERO.fvReward, g.rng);
      awardHero(g, [a], n, `${SKILLS[skill.split(':')[0]]?.name ?? skill} FV ${fv}`);
    }
  }
}

/**
 * Höjer en grundegenskap. Ändras baschansen läggs ändringen på de primära färdigheterna och
 * yrkesfärdigheterna som bygger på grundegenskapen (tolkning).
 */
export function bumpAttr(g: Game, a: Actor, attr: AttrKey, n: number) {
  const ch = g.charOf(a);
  if (!ch || n === 0) return;
  const old = ch.attrs[attr];
  ch.attrs[attr] = old + n;
  a.attrs[attr] = ch.attrs[attr];
  if (attr === 'PSY') a.psy = Math.max(0, a.psy + n);
  const bc = baseChance(ch.attrs[attr]) - baseChance(old);
  if (bc) {
    for (const key of Object.keys(a.skills)) {
      const def = SKILLS[key.split(':')[0]];
      if (!def || def.attr !== attr || (def.type !== 'primär' && !ch.profSkills.includes(key))) continue;
      setFv(g, a, key, Math.max(0, a.skills[key] + bc));
    }
  }
  recompute(a, ch);
}

/** Vilket val förmågan kräver när den köps mellan äventyren. */
export type ChoiceKind = 'färdighet' | 'två färdigheter' | 'språk' | 'grundegenskaper' | 'yrke' | 'folkslag' | null;

export function choiceKind(def: AbilityDef): ChoiceKind {
  switch (def.effect.kind) {
    case 'fvChoice':
    case 'fixedChoice':
    case 'halfCost':
      return 'färdighet';
    case 'extraPicks':
      return 'två färdigheter';
    case 'language':
      return 'språk';
    case 'attrs':
      return 'grundegenskaper';
    case 'extraProfessionAbility':
      return 'yrke';
    case 'foe':
      return 'folkslag';
    default:
      return null;
  }
}

/** Färdigheter som går att välja för förmågan (rollpersonens egna och de primära). */
export function skillOptions(g: Game, a: Actor, def: AbilityDef): string[] {
  const ch = g.charOf(a)!;
  const e = def.effect;
  const own = Object.keys(a.skills).filter((k) => SKILLS[k.split(':')[0]]);
  const all = [...new Set([...own, ...Object.values(SKILLS).filter((s) => !s.specialized && !s.hidden && !s.onlyFor).map((s) => s.id)])];
  const secondary = all.filter((k) => SKILLS[k.split(':')[0]].type === 'sekundär' && !SKILLS[k.split(':')[0]].weaponGroup);
  if (e.kind === 'fvChoice') {
    if (e.filter === 'sekundär') return secondary;
    if (e.filter === 'vapen') return all.filter((k) => SKILLS[k.split(':')[0]].weaponGroup);
    if (e.filter === 'hantverk') return own.filter((k) => k.startsWith('hantverk:'));
    if (e.filter === 'tva_vapen') return own.filter((k) => k.startsWith('tva_vapen'));
    return all;
  }
  if (e.kind === 'fixedChoice') return secondary.filter((k) => (a.skills[k] ?? 0) < e.fv);
  if (e.kind === 'extraPicks') return secondary.filter((k) => !ch.profSkills.includes(k));
  if (e.kind === 'halfCost') return [...ch.profSkills, ...ch.spells.map((s) => `spell:${s}`)];
  return [];
}

/** Varför valet inte duger, eller null. */
export function choiceProblem(g: Game, a: Actor, def: AbilityDef, c: AbilityChoice): string | null {
  switch (choiceKind(def)) {
    case 'färdighet':
      return c.skill && skillOptions(g, a, def).includes(c.skill) ? null : 'Välj en färdighet.';
    case 'två färdigheter':
      return c.skills?.length === 2 && c.skills[0] !== c.skills[1] && c.skills.every((k) => skillOptions(g, a, def).includes(k)) ? null : 'Välj två olika färdigheter.';
    case 'språk':
      return c.language?.trim() ? null : 'Skriv vilket språk.';
    case 'grundegenskaper': {
      const v = Object.entries(c.attrs ?? {}).filter(([, n]) => n);
      const ok = v.every(([k]) => k !== 'STO') && ((v.length === 1 && v[0][1] === 2) || (v.length === 3 && v.every(([, n]) => n === 1)));
      return ok ? null : 'Välj +2 på en grundegenskap eller +1 på tre olika (inte STO).';
    }
    case 'yrke':
      return c.profession && PROFESSIONS[c.profession] && c.profession !== (g.charOf(a)!.profession) ? null : 'Välj ett annat yrke.';
    case 'folkslag':
      return c.foe?.trim() ? null : 'Skriv vilket folkslag eller vilken ras.';
    default:
      return null;
  }
}

/** Lägger på förmågans verkan på en rollperson som redan finns (mellan äventyren). */
function applyAbility(g: Game, a: Actor, def: AbilityDef, c: AbilityChoice) {
  const ch = g.charOf(a)!;
  const e = def.effect;
  const add = (k: string, n: number) => setFv(g, a, k, (a.skills[k] ?? 0) + n);
  switch (e.kind) {
    case 'fv':
      for (const k of e.skills) add(k, e.amount);
      break;
    case 'fvChoice':
      add(c.skill!, e.amount);
      break;
    case 'fixedChoice':
      setFv(g, a, c.skill!, Math.max(a.skills[c.skill!] ?? 0, e.fv));
      break;
    case 'language': {
      const lang = c.language!.trim().toLowerCase().replace(/[^a-zåäö]+/g, '_');
      setFv(g, a, `tala_frammande:${lang}`, Math.max(a.skills[`tala_frammande:${lang}`] ?? 0, e.fv));
      setFv(g, a, `las_skriv_frammande:${lang}`, Math.max(a.skills[`las_skriv_frammande:${lang}`] ?? 0, e.fv));
      break;
    }
    case 'extraPicks':
      ch.profSkills.push(...c.skills!);
      break;
    case 'swordHand':
      ch.swordHand = e.value;
      break;
    case 'attrs':
      for (const [k, n] of Object.entries(c.attrs ?? {})) if (n) bumpAttr(g, a, k as AttrKey, n);
      break;
    default:
      break;
  }
  recompute(a, ch);
}

// ------------------------------------------------------------------ hjältepoäng

/** Ger hjältepoäng till var och en (alla får hela summan). Minuspoäng drar bara från de osparade. */
export function awardHero(g: Game, members: Actor[], n: number, why: string) {
  if (!n) return;
  for (const m of members) {
    const ch = g.charOf(m);
    if (!ch) continue;
    ch.heroPoints = Math.max(0, (ch.heroPoints ?? 0) + n);
    if (n > 0) ch.heroTotal = (ch.heroTotal ?? 0) + n;
  }
  const who = members.length > 1 ? 'Gruppen' : members[0]?.name;
  g.log(n > 0 ? `${who} får ${n} hjältepoäng${members.length > 1 ? ' var' : ''} (${why}).` : `${who} förlorar ${-n} hjältepoäng (${why}).`);
}

/** Ger bonus-EP till var och en i gruppen. */
export function awardEp(g: Game, members: Actor[], n: number, why: string) {
  if (!n) return;
  for (const m of members) {
    const ch = g.charOf(m);
    if (ch) ch.bonusEp = (ch.bonusEp ?? 0) + n;
  }
  g.log(`${members.length > 1 ? 'Gruppen' : members[0]?.name} får ${n} bonus-EP${members.length > 1 ? ' var' : ''} (${why}).`);
}

/**
 * Delar ut modulens belöningar: bonus-EP och hjältepoäng för uppdrag som är klara och för
 * gärningar, rollspelsval och dåd vars flagga är satt. Var och en ges en gång.
 */
export function grantRewards(g: Game) {
  const mod = MODULES[g.state.moduleId];
  if (!mod || g.state.mode === 'dead') return;
  const flags = g.state.flags;
  const done = (g.state.rewarded ??= []);
  const members = g.partyMembers();
  const give = (key: string, ep: number | undefined, hp: number | undefined, why: string) => {
    const id = `${mod.id}:${key}`;
    if (done.includes(id) || (!ep && !hp)) return;
    done.push(id);
    awardEp(g, members, ep ?? 0, why);
    awardHero(g, members, hp ?? 0, why);
  };
  for (const q of mod.quests) if (flags[q.done]) give(`uppdrag:${q.id}`, q.bonusEp, q.heroPoints, `uppdraget ${q.name}`);
  for (const d of mod.deeds ?? []) if (flags[d.flag]) give(`dåd:${d.id}`, d.ep, d.heroPoints, d.text);
}

/** Kan den som styrs ladda hjältepoäng inför nästa slag? */
export function canArmHero(g: Game, a: Actor): boolean {
  const ch = g.charOf(a);
  return !!ch && (ch.heroPoints ?? 0) > 0 && a.alive && g.state.mode !== 'ended' && g.state.mode !== 'dead';
}

/** Laddar eller avbryter hjältepoängen för nästa egna slag. */
export function toggleHero(g: Game, a: Actor) {
  if (!a.heroArmed && !canArmHero(g, a)) return;
  a.heroArmed = !a.heroArmed;
  g.log(a.heroArmed ? `${a.name} kallar på sin hjältekraft inför nästa slag.` : `${a.name} sparar sin hjältepoäng.`);
}

const UPGRADE: Record<CheckResult, CheckResult> = { fummel: 'misslyckat', misslyckat: 'lyckat', lyckat: 'perfekt', perfekt: 'perfekt' };

/**
 * Hjältepoäng på slaget (Bok I): fummel blir misslyckat, misslyckat blir lyckat, lyckat blir
 * perfekt, och ett perfekt slag ger tillbaka poängen. Poängen dras när slaget slås.
 */
export function heroic(g: Game, a: Actor | undefined, check: Check): Check {
  // Turgubbe och Tjuvtur läggs på först: de ändrar CL, hjältepoängen ändrar utfallet.
  check = applyLuck(g, a, check);
  if (!a?.heroArmed) return check;
  a.heroArmed = false;
  const ch = g.charOf(a);
  if (!ch || (ch.heroPoints ?? 0) < 1) return check;
  const result = UPGRADE[check.result];
  if (check.result !== 'perfekt') ch.heroPoints = (ch.heroPoints ?? 0) - 1;
  const success = result === 'perfekt' || result === 'lyckat';
  g.log(
    check.result === 'perfekt'
      ? `${a.name}s slag blev perfekt ändå, och hjältepoängen kommer tillbaka.`
      : `${a.name} spenderar en hjältepoäng: ${check.result} blir ${result}.`,
  );
  g.emit(a.id, 'Hjältedåd!', 'info');
  return { ...check, result, success, diff: success ? Math.max(0, check.diff) : check.diff };
}

/** Hjältepoäng för ett slag på tabellen över särskilda förmågor. */
export const abilityTiers = () => HERO.abilityTiers;

/** Varför man inte kan köpa något för hjältepoäng just nu, eller null. */
export function heroShopProblem(g: Game, a: Actor, cost: number): string | null {
  const ch = g.charOf(a);
  if (!ch) return 'Bara rollpersoner har hjältepoäng.';
  if (g.state.mode !== 'ended') return 'Det går bara mellan äventyren.';
  if (ch.heroPending) return 'Välj först vad förmågan gäller.';
  if ((ch.heroPoints ?? 0) < cost) return `Det kostar ${cost} hjältepoäng.`;
  return null;
}

/**
 * Köper ett slag på tabellen över särskilda förmågor: 2T20 + tillägget (husregel). En förmåga
 * man redan har byts mot närmaste rad uppåt som man inte har; Höjd grundegenskap kan tas igen.
 */
export function rollHeroAbility(g: Game, a: Actor, tier: number): string | null {
  const t = HERO.abilityTiers[tier];
  if (!t) return 'Okänt slag.';
  const problem = heroShopProblem(g, a, t.hp);
  if (problem) return problem;
  const ch = g.charOf(a)!;
  ch.heroPoints! -= t.hp;
  const total = die(20, g.rng) + die(20, g.rng) + t.bonus;
  const magician = ch.profession === 'magiker';
  let def = abilityFor(total, magician);
  const owned = new Set(abilitiesOf(ch).map((x) => x.def.id));
  let i = Math.max(0, ABILITIES.findIndex((x) => total >= x.min && total <= x.max));
  while (owned.has(def.id) && def.effect.kind !== 'attrs' && i < ABILITIES.length - 1) {
    i++;
    def = abilityFor(ABILITIES[i].min, magician);
  }
  g.log(`${a.name} spenderar ${t.hp} hjältepoäng och slår 2T20 + ${t.bonus} = ${total} på tabellen över särskilda förmågor: ${def.name}.`);
  ch.heroPending = { id: def.id, total };
  if (!choiceKind(def)) return chooseHeroAbility(g, a, {});
  return null;
}

/** Gör valet för den framslagna förmågan och lägger på dess verkan. */
export function chooseHeroAbility(g: Game, a: Actor, c: AbilityChoice): string | null {
  const ch = g.charOf(a);
  const pending = ch?.heroPending;
  if (!ch || !pending) return 'Ingen förmåga väntar.';
  const def = ABILITY_BY_ID[pending.id];
  const problem = choiceProblem(g, a, def, c);
  if (problem) return problem;
  delete ch.heroPending;
  (ch.heroAbilities ??= []).push({ id: def.id, total: pending.total, choice: c });
  applyAbility(g, a, def, c);
  g.log(`${a.name} har nu förmågan ${def.name}: ${def.desc}`);
  return null;
}

/** Höjer en grundegenskap med 1 för 5 HP (inte STO), bara mellan äventyren. */
export function raiseAttribute(g: Game, a: Actor, attr: AttrKey): string | null {
  if (attr === 'STO') return 'STO kan inte höjas med hjältepoäng.';
  const problem = heroShopProblem(g, a, HERO.attrCost);
  if (problem) return problem;
  const ch = g.charOf(a)!;
  ch.heroPoints! -= HERO.attrCost;
  bumpAttr(g, a, attr, 1);
  g.log(`${a.name} spenderar ${HERO.attrCost} hjältepoäng och höjer ${attr} till ${ch.attrs[attr]}.`);
  return null;
}

// ------------------------------------------------------------------ PSY-kamp och PSY-höjning

/**
 * En vunnen PSY-kamp: magikern övervann en fiendes motstånd, eller någon stod emot en fientlig
 * magikers besvärjelse eller blev oberörd på Skräcktabellen. Hur kampen vanns avgör inte slaget
 * efteråt (se `psyRaise`).
 */
export function markPsyWin(g: Game, a: Actor, kind: 'magiker' | 'motstånd') {
  const ch = g.charOf(a);
  if (!ch) return;
  if (ch.psyWin !== 'magiker') ch.psyWin = kind;
}

/** Vidar: den som kan magi (har FV i en magiskola) slår efter magikerns regel. */
export function knowsMagic(a: Actor): boolean {
  return Object.entries(a.skills).some(([k, fv]) => k.startsWith('magiskola:') && fv > 0);
}

/**
 * Slaget för att höja PSY efter ett äventyr (Bok I). Den som kan magi slår mot 25 − PSY, andra mot
 * 20 − PSY, hur kampen än vanns. Returnerar höjningen.
 */
export function psyRaise(g: Game, a: Actor): number {
  const ch = g.charOf(a);
  if (!ch?.psyWin) return 0;
  const magician = knowsMagic(a);
  delete ch.psyWin;
  const mod = hasAbility(ch, 'god_psy_potential') ? PSY_RAISE.potential : 0;
  const throwDie = () => {
    const d = die(20, g.rng) + mod;
    return d <= 0 ? 1 : d;
  };
  const psy = ch.attrs.PSY;
  const limit = magician ? PSY_RAISE.magician : PSY_RAISE.other;
  const d = throwDie();
  let gain = 0;
  if (psy < limit) {
    if (d === 1) gain = roll(PSY_RAISE.big, g.rng);
    else if (d <= limit - psy) gain = 1;
  } else if (d === 1) {
    gain = magician && throwDie() === 1 ? roll(PSY_RAISE.big, g.rng) : 1;
  }
  g.log(`${a.name} har vunnit en kamp PSY mot PSY och slår för att höja sin PSY (T20: ${d} mot ${Math.max(1, limit - psy)}): ${gain ? `PSY höjs med ${gain}.` : 'ingen höjning.'}`);
  if (gain) bumpAttr(g, a, 'PSY', gain);
  return gain;
}

/** Efter äventyret slår var och en som har vunnit en PSY-kamp för att höja sin PSY. */
export function psyRaiseAfterAdventure(g: Game) {
  for (const m of g.partyMembers()) psyRaise(g, m);
}

// ------------------------------------------------------------------ igenkänd som hjälte

/**
 * Första gången rollpersonen talar med en person slås 1T100 mot summan av alla HP hen har fått
 * (Bok I). Känner personen igen hjälten sätts modulens flagga `igenkand_<person>`.
 */
export function meet(g: Game, npc: Actor): boolean {
  if (!npc.npc) return false;
  const met = (g.state.met ??= {});
  if (npc.npc in met) return met[npc.npc];
  const ch = g.state.character;
  const total = ch.heroTotal ?? 0;
  const d = die(100, g.rng);
  const known = total > 0 && d <= total;
  met[npc.npc] = known;
  if (known) {
    g.state.flags[`igenkand_${npc.npc}`] = true;
    g.log(`${npc.name} känner igen ${ch.name} (T100: ${d} mot ${total}).`);
  }
  return known;
}

/** Om personen känner igen hjälten. */
export const recognizes = (g: Game, npc: Actor) => !!npc.npc && !!g.state.met?.[npc.npc];
