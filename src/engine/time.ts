import { RACES } from '../data/races';
import { SKILLS } from '../data/skills';
import { WEAPONS } from '../data/weapons';
import { ARMOR } from '../data/armor';
import { die, roll } from './dice';
import type { Game } from './game';
import { onExpire, stabilize } from './combat';
import { advancePoisons } from './poison';
import { payWages } from './party';
import {
  AMPUTATION_WEEKS,
  attributeCheck,
  DAY,
  EXPERIENCE,
  fvCost,
  HEALING,
  HIT_LOCATIONS,
  HOUR,
  INFECTION,
  locationKp,
  maxKp,
  PSY_RECOVERY,
  SKILL_BASE_COST,
  skillCheck,
  type Check,
  type HitLocation,
} from './rules';
import type { Actor } from './types';

/**
 * Tid, läkning, infektioner och erfarenhet (steg 5). Husreglerna står i docs/regelbeslut.md.
 */

/** Spelet börjar dag 1 klockan 08:00. */
export const START_TIME = 8 * HOUR;

export const dayOf = (t: number) => Math.floor(t / DAY) + 1;

export function clockText(t: number): string {
  const h = Math.floor((t % DAY) / HOUR);
  const m = Math.floor((t % HOUR) / 60);
  return `Dag ${dayOf(t)}, ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export type Activity = 'aktiv' | 'vila' | 'sömn';

/** Läker en KP i en kroppsdel (om den inte är infekterad eller förlorad) och i totala KP. */
function healLocation(a: Actor, loc: HitLocation) {
  if (a.locKp[loc] >= a.locMax[loc]) return;
  if (a.infections.some((i) => i.loc === loc) || a.injuries.some((i) => i.loc === loc && i.lost)) return;
  a.locKp[loc]++;
  if (a.locKp[loc] > 0 && !a.injuries.some((i) => i.loc === loc && i.lost)) a.disabled = a.disabled.filter((l) => l !== loc);
}

/** Uppdaterar tillstånd som beror på KP efter läkning. */
export function settle(a: Actor) {
  const healable = HIT_LOCATIONS.filter((l) => !a.injuries.some((i) => i.loc === l && i.lost));
  // När alla kroppsdelar har läkt återställs totala KP helt (Bok II s. 20).
  if (healable.every((l) => a.locKp[l] >= a.locMax[l])) a.kp = a.maxKp;
  a.kp = Math.min(a.kp, a.maxKp);
  if (a.kp > 1 && !(['bröstkorg', 'mage'] as HitLocation[]).some((l) => a.locKp[l] <= 0)) a.down = false;
  if (a.unconscious && a.kp > 0 && a.locKp.huvud > 0 && !a.effects.some((e) => e.kind === 'medvetslös' || e.kind === 'dödsfara')) a.unconscious = false;
}

/** En dags naturlig läkning: 1 KP i varje skadad kroppsdel och i totala KP. */
function healDay(a: Actor) {
  for (const loc of HIT_LOCATIONS) healLocation(a, loc);
  a.kp = Math.min(a.maxKp, a.kp + HEALING.kpPerDay);
  settle(a);
}

/**
 * Låter tiden gå för rollpersonen. Läkning och PSY-poäng samlas i timmar: vila räknas fullt och
 * aktivitet halvt (läkning) eller en tredjedel (PSY). Effekter som räknas i dagar går ned vid
 * varje ny dag, och sömn på minst sex timmar (två för alver) gör att färdigheter kan ge EP igen.
 */
export function advanceTime(g: Game, seconds: number, activity: Activity) {
  if (seconds <= 0) return;
  const before = g.state.time;
  g.state.time += seconds;
  for (const a of g.partyMembers()) passTime(g, a, seconds, activity, before);
  payWages(g);
}

/** Tiden går för en rollperson eller följeslagare. */
function passTime(g: Game, a: Actor, seconds: number, activity: Activity, before: number) {
  const hours = seconds / HOUR;
  const resting = activity !== 'aktiv';

  a.restSeconds = resting ? a.restSeconds + seconds : 0;
  if (a.alive) {
    a.psyHours += resting ? hours / PSY_RECOVERY.restHours : hours / PSY_RECOVERY.activeHours;
    const psy = Math.floor(a.psyHours);
    if (psy > 0) {
      a.psy = Math.min(a.attrs.PSY, a.psy + psy);
      a.psyHours -= psy;
    }
    if (a.psy >= a.attrs.PSY) a.psyHours = 0;

    a.healHours += hours * (resting ? 1 : HEALING.withoutRestFactor);
    while (a.healHours >= 24) {
      a.healHours -= 24;
      healDay(a);
    }
  }

  const days = dayOf(g.state.time) - dayOf(before);
  if (days > 0) {
    a.effects = a.effects.filter((e) => {
      if (e.days === undefined) return true;
      e.days -= days;
      return e.days > 0;
    });
  }
  // Effekter som räknas i rundor går ned när mer än en runda har gått.
  if (seconds > 5) {
    const rounds = Math.floor(seconds / 5);
    a.effects = a.effects.filter((e) => {
      if (e.rounds === undefined || (e.rounds -= rounds) > 0) return true;
      onExpire(g, a, e);
      return false;
    });
  }
  if (seconds > 5) advancePoisons(g, a);
  const race = RACES[(g.charOf(a) ?? g.state.character).race];
  if (activity === 'sömn' && seconds >= race.sleepHours * HOUR) {
    a.epBlocked = [];
    a.effects = a.effects.filter((e) => !e.untilRest);
  }
  checkInfections(g, a);
  settle(a);
}

// ------------------------------------------------------------------ infektioner och amputation

/** Efter en strid: slå för infektion i varje kroppsdel som fått sår av eggvapen eller naturliga vapen. */
export function rollInfections(g: Game, a: Actor) {
  const byLoc = new Map<HitLocation, number>();
  // Örter och gifter kan ändra risken (Saltsopp halverar, Allvarsrönn tredubblar).
  const factor = a.effects.filter((e) => e.kind === 'infektionsrisk').reduce((f, e) => f * (e.mod ?? 1), 1);
  a.effects = a.effects.filter((e) => e.kind !== 'infektionsrisk');
  for (const w of a.combatWounds) byLoc.set(w.loc, (byLoc.get(w.loc) ?? 0) + w.dmg * INFECTION[w.kind] * factor);
  a.combatWounds = [];
  const ch = g.charOf(a);
  if (!a.alive || !ch || ch.race === 'alv') return;
  for (const [loc, chance] of byLoc) {
    if (a.infections.some((i) => i.loc === loc)) continue;
    // Sår under ringbrynja blir inte infekterade.
    if (a.armor.some((id) => ARMOR[id]?.covers.includes(loc) && ARMOR[id].noInfection)) continue;
    if (die(100, g.rng) > chance) continue;
    const weeks = roll(INFECTION.weeks, g.rng);
    const gangrene = die(100, g.rng) <= INFECTION.gangrene;
    a.infections.push({ loc, until: g.state.time + weeks * 7 * DAY, gangrene });
    a.effects.push({ kind: 'cl', label: `Infektion i ${loc}: matt och febrig`, mod: INFECTION.feverCl, scope: 'alla', rounds: (weeks * 7 * DAY) / 5 });
    g.log(`Såret i ${a.name}s ${loc} blir infekterat. Det läker inte på ${weeks} veckor.`);
  }
}

function checkInfections(g: Game, a: Actor) {
  for (const inf of [...a.infections]) {
    if (g.state.time < inf.until) continue;
    a.infections = a.infections.filter((i) => i !== inf);
    a.effects = a.effects.filter((e) => !e.label.startsWith(`Infektion i ${inf.loc}`));
    if (!inf.gangrene) {
      g.log(`Infektionen i ${a.name}s ${inf.loc} har gått över.`);
      continue;
    }
    if (inf.loc === 'huvud' || inf.loc === 'bröstkorg' || inf.loc === 'mage') {
      g.log(`Infektionen i ${a.name}s ${inf.loc} blev kallbrand.`);
      g.die(a);
      return;
    }
    g.log(`Infektionen i ${a.name}s ${inf.loc} blev kallbrand.`);
    amputate(g, a, inf.loc);
  }
}

/** Amputation: FYS sjunker för alltid med kroppsdelens KP, och det tar fyra veckor att hämta sig. */
export function amputate(g: Game, a: Actor, loc: HitLocation) {
  const loss = a.locMax[loc];
  a.attrs.FYS = Math.max(1, a.attrs.FYS - loss);
  const ch = g.charOf(a);
  if (ch) ch.attrs.FYS = a.attrs.FYS;
  const kp = maxKp(a.attrs);
  const locs = locationKp(kp);
  for (const l of HIT_LOCATIONS) {
    a.locMax[l] = locs[l];
    a.locKp[l] = Math.min(a.locKp[l], locs[l]);
  }
  a.maxKp = kp;
  a.kp = Math.min(a.kp, kp);
  a.locKp[loc] = 0;
  a.bleeding = a.bleeding.filter((l) => l !== loc);
  a.infections = a.infections.filter((i) => i.loc !== loc);
  const inj = a.injuries.find((i) => i.loc === loc);
  if (inj) Object.assign(inj, { id: 'amputerad', text: 'Amputerad.', lost: true });
  else a.injuries.push({ loc, id: 'amputerad', text: 'Amputerad.', cl: 0, lost: true });
  if (!a.disabled.includes(loc)) a.disabled.push(loc);
  g.log(`${a.name}s ${loc} amputeras. FYS sjunker med ${loss} till ${a.attrs.FYS}, och det tar ${AMPUTATION_WEEKS} veckor att hämta sig.`);
  if (a.id === g.state.playerId) advanceTime(g, AMPUTATION_WEEKS * 7 * DAY, 'vila');
}

// ------------------------------------------------------------------ Läkekonst

/** Läkekonst på en patient, en gång per dag: 1 KP extra och en infektion stoppas. */
export function canMedicine(g: Game, patient: Actor): boolean {
  const damaged = patient.kp < patient.maxKp || patient.infections.length > 0;
  return damaged && patient.medicineDay !== dayOf(g.state.time);
}

export function medicine(g: Game, healer: Actor, patient: Actor, fv = g.skillFv(healer, 'lakekonst')): Check | null {
  if (!canMedicine(g, patient)) return null;
  patient.medicineDay = dayOf(g.state.time);
  const check = skillCheck(fv, g.rng, g.woundPenaltyOf(healer));
  if (check.success) {
    if (patient.dying) stabilize(g, patient, 'med Läkekonst');
    const worst = HIT_LOCATIONS.filter((l) => patient.locKp[l] < patient.locMax[l] && !patient.infections.some((i) => i.loc === l)).sort(
      (x, y) => patient.locKp[x] - patient.locMax[x] - (patient.locKp[y] - patient.locMax[y]),
    )[0];
    if (worst) healLocation(patient, worst);
    patient.kp = Math.min(patient.maxKp, patient.kp + 1);
    const inf = patient.infections.shift();
    if (inf) patient.effects = patient.effects.filter((e) => !e.label.startsWith(`Infektion i ${inf.loc}`));
    settle(patient);
    g.log(`Läkekonst (T20: ${check.roll} mot ${check.target}): ${patient.name} läker 1 KP${inf ? ` och infektionen i ${inf.loc} hävs` : ''}.`);
    if (g.charOf(healer)) g.gainExperience(healer, 'lakekonst', check);
  } else g.log(`Läkekonst (T20: ${check.roll} mot ${check.target}): misslyckas.`);
  return check;
}

// ------------------------------------------------------------------ erfarenhet

/**
 * Första lyckade användningen av en färdighet efter sömnen ger 1 EP, ett perfekt slag 1T3+1.
 * Färdigheter i kategori B förbättras bara genom träning.
 */
export function gainExperience(g: Game, a: Actor, skill: string, check: Check) {
  if (!g.charOf(a) || !check.success) return;
  const def = SKILLS[skill.split(':')[0]];
  if (!def || def.category === 'B' || a.epBlocked.includes(skill)) return;
  const n = check.result === 'perfekt' ? roll(EXPERIENCE.perfect, g.rng) : EXPERIENCE.success;
  a.ep[skill] = (a.ep[skill] ?? 0) + n;
  a.epBlocked.push(skill);
}

/** Grundkostnaden i EP för att höja en färdighet: primär 2, yrkesfärdighet 3, sekundär 5. */
export function baseCost(g: Game, skill: string, a: Actor = g.player): number {
  if ((g.charOf(a) ?? g.char).profSkills.includes(skill)) return SKILL_BASE_COST.yrke;
  return SKILLS[skill.split(':')[0]]?.type === 'primär' ? SKILL_BASE_COST.primär : SKILL_BASE_COST.sekundär;
}

/** Högsta FV färdigheten får nå: sekundära och B-färdigheter högst grundegenskapen. */
export function skillCap(g: Game, a: Actor, skill: string): number {
  const def = SKILLS[skill.split(':')[0]];
  if (!def) return 0;
  const attr = def.cappedByAttr ?? (def.attr !== 'spec' ? def.attr : undefined);
  if (def.cappedBy) return Math.min(a.skills[def.cappedBy] ?? 0, attr ? a.attrs[attr] : 99);
  if (attr && (def.type === 'sekundär' || def.category === 'B') && !(g.charOf(a) ?? g.char).profSkills.includes(skill)) return a.attrs[attr];
  return 99;
}

/** Kan EP växlas in? Det kräver sju dagars sammanhängande vila. */
export function canConvert(a: Actor): boolean {
  return a.restSeconds >= EXPERIENCE.restDays * DAY;
}

export function raiseCost(g: Game, a: Actor, skill: string): number {
  const fv = a.skills[skill] ?? 0;
  return fvCost(baseCost(g, skill, a), fv, fv + 1);
}

/** Höjer en färdighet ett steg med dess egna EP, och bonus-EP om de inte räcker. */
export function raiseSkill(g: Game, skill: string): boolean {
  const a = g.player;
  const ch = g.char;
  const fv = a.skills[skill] ?? 0;
  const cost = raiseCost(g, a, skill);
  const own = a.ep[skill] ?? 0;
  const bonus = ch.bonusEp ?? 0;
  if (!canConvert(a) || fv + 1 > skillCap(g, a, skill) || own + bonus < cost || needsTeacher(skill)) return false;
  const fromOwn = Math.min(own, cost);
  a.ep[skill] = own - fromOwn;
  if (!a.ep[skill]) delete a.ep[skill];
  ch.bonusEp = bonus - (cost - fromOwn);
  a.skills[skill] = fv + 1;
  ch.skills[skill] = fv + 1;
  g.log(`${a.name} höjer ${SKILLS[skill.split(':')[0]]?.name ?? skill} till FV ${fv + 1}.`);
  return true;
}

/**
 * Magiskolor höjs bara med lärare eller genom studier i ett magibibliotek (Bok III och husregel).
 * Inget av det finns i Gråvad.
 */
export function needsTeacher(skill: string): boolean {
  return skill.startsWith('magiskola:');
}

/** Ensamträning en vecka: ett Normalt grundegenskapsslag ger 1 EP. */
export function selfTrain(g: Game, skill: string): boolean {
  if (needsTeacher(skill)) return false;
  const a = g.player;
  const def = SKILLS[skill.split(':')[0]];
  const attr = def?.attr && def.attr !== 'spec' ? def.attr : 'INT';
  advanceTime(g, 7 * DAY, 'vila');
  const check = attributeCheck(a.attrs[attr], g.rng, 'Normalt');
  if (check.success) a.ep[skill] = (a.ep[skill] ?? 0) + 1;
  g.log(`En veckas ensamträning i ${def?.name ?? skill} (${attr}-slag, T20: ${check.roll} mot ${check.target}): ${check.success ? '1 EP' : 'bortkastad vecka'}.`);
  return check.success;
}

/** Mellan äventyren: lyckas ett Normalt PSY-slag blir en fobi ett steg lindrigare. */
export function easePhobias(g: Game) {
  const steps = ['mild', 'normal', 'svår'] as const;
  for (const a of g.partyMembers()) {
    const ch = g.charOf(a)!;
    ch.phobias = (ch.phobias ?? []).flatMap((ph) => {
      const check = attributeCheck(a.attrs.PSY, g.rng, 'Normalt');
      if (!check.success) return [ph];
      const i = steps.indexOf(ph.level);
      g.log(`${a.name}s fobi mot ${ph.source} ${i === 0 ? 'försvinner' : `mildras till ${steps[i - 1]}`}.`);
      return i === 0 ? [] : [{ ...ph, level: steps[i - 1] }];
    });
  }
}

/** Vilken sorts sår ett vapen ger, för infektioner. Trubbiga vapen och nävar infekterar inte. */
export function woundKind(weaponId: string, natural: boolean, unarmed: boolean): 'egg' | 'smutsig' | null {
  if (unarmed) return null;
  if (natural) return 'smutsig';
  const w = WEAPONS[weaponId];
  if (!w || w.kind !== 'närstrid') return 'egg';
  return ['kross', 'trastav', 'slagsmal'].includes(w.group) ? null : 'egg';
}
