import { SKILLS } from '../data/skills';
import { SPELLS, spellRange } from '../data/spells';
import type { SpellDef, SpellDuration } from '../data/types';
import { die, roll } from './dice';
import type { Game } from './game';
import { actorHas, heroic, isCommonAnimal, markPsyWin, passive, provokeAnimal } from './hero';
import { ironProblem } from './inventory';
import { distance, lineOfSight, tileAt, walkable } from './map';
import { neutralize } from './poison';
import {
  armorPiece,
  canAct,
  changeAttribute,
  endSpellEffect,
  finishTurn,
  hasEffect,
  isParty,
  kill,
  limbUsable,
  shieldArm,
  magicArmor,
  skillMod,
  unequip,
  wound,
} from './combat';
import {
  attributeCheck,
  ASTRAL_WEAPON,
  BOOK_CAST,
  DURATION_SECONDS,
  HIT_TABLE,
  lookup,
  memoryCapacity,
  MEMORIZE_MINUTES_PER_SV,
  MISFIRE_TABLE,
  resistance,
  RITUAL_MEMORY_SLOTS,
  RITUAL_MEMORIZE_MINUTES_PER_SV,
  ROUND_SECONDS,
  skillCheck,
  spellCl,
  spellPsyCost,
  spellSkill,
  suicideBudget,
  type Check,
  type HitLocation,
} from './rules';
import type { ActiveEffect, Actor, AttrKey, PendingSpell } from './types';
import { applyWorld, showScenes, worldProblem } from './worldspells';
import { raining, underSky } from './weather';
import { charge, chargeableItems, chargeAvailable, drawCharge, rejuvenate, transformChoices, transformGrade, transformWeapon } from './rituals';
import { WEAPONS } from '../data/weapons';
import { between, breakHiding, FOG_SIGHT, heatColdResist, inVortex, outdoors, unseen, zonesAt } from './spelleffects';
import { advanceTime } from './time';
import { dissolve, spellVersusElemental, summonOrBanish, summonProblem } from './elementals';

/**
 * Magi enligt Bok III s. 3–8 med Vidars husregler (docs/regelbeslut.md under Magi). Alla lägger
 * besvärjelser efter samma regler: gruppen och fienderna (Vidar). Varelser utan rollformulär har
 * sina besvärjelser i `Actor.spells` och har dem alltid i minnet.
 */

/** Formelsamlingen och minnet för en magiker. */
export function spellbook(g: Game, a: Actor): { spells: string[]; memorized: string[] } {
  const ch = g.charOf(a);
  if (ch) return { spells: ch.spells, memorized: ch.memorized };
  const list = a.spells ?? [];
  return { spells: list, memorized: list };
}

// ------------------------------------------------------------------ skolor och skicklighet

/** Färdighetsnyckeln för besvärjelsens skola. Allmänna besvärjelser hör till den skola man är bäst i. */
export function schoolKey(a: Actor, spell: SpellDef): string | null {
  if (spell.school !== 'allmän') return a.skills[`magiskola:${spell.school}`] !== undefined ? `magiskola:${spell.school}` : null;
  let best: string | null = null;
  for (const [k, fv] of Object.entries(a.skills)) if (k.startsWith('magiskola:') && (!best || fv > a.skills[best])) best = k;
  return best;
}

export function schoolFv(a: Actor, spell: SpellDef): number {
  const key = schoolKey(a, spell);
  return key ? (a.skills[key] ?? 0) : 0;
}

/** Skicklighetsvärdet S (husregel): FV i skolan − skolvärdet + baschansen för INT. */
export function spellS(a: Actor, id: string): number {
  const spell = SPELLS[id];
  return spell ? spellSkill(schoolFv(a, spell), spell.sv, a.attrs.INT) : 0;
}

/** Högsta effektgrad: FV i besvärjelsens skola. */
export function maxGrade(a: Actor, id: string): number {
  return schoolFv(a, SPELLS[id]);
}

// ------------------------------------------------------------------ minnet

const slots = (id: string) => (SPELLS[id]?.ritual ? RITUAL_MEMORY_SLOTS : 1);

export function memoryUsed(g: Game): number {
  return g.char.memorized.reduce((n, id) => n + slots(id), 0);
}

export function memoryLimit(g: Game): number {
  const p = g.player;
  return memoryCapacity(p.attrs.INT, p.attrs.PSY);
}

/** Varför besvärjelsen inte kan memoreras nu, eller null. */
export function memorizeProblem(g: Game, id: string): string | null {
  const ch = g.char;
  const p = g.player;
  const spell = SPELLS[id];
  if (!spell || !ch.spells.includes(id)) return 'Besvärjelsen finns inte i din formelsamling.';
  if (ch.memorized.includes(id)) return 'Den finns redan i minnet.';
  if (!g.canRest()) return 'Du behöver lugn och ro för att memorera.';
  if (memoryUsed(g) + slots(id) > memoryLimit(g)) return `Minnet är fullt (${memoryLimit(g)} besvärjelser). Glöm en först.`;
  const key = schoolKey(p, spell);
  const inSchool = ch.memorized.filter((x) => schoolKey(p, SPELLS[x]) === key).length;
  if (key && inSchool + 1 > (p.skills[key] ?? 0)) return `Du kan inte ha fler än ${p.skills[key]} besvärjelser ur skolan i minnet.`;
  return null;
}

/** Memorerar en besvärjelse ur formelsamlingen: 20 minuter per skolvärdespoäng (en timme för ritualer). */
export function memorize(g: Game, id: string): string | null {
  const problem = memorizeProblem(g, id);
  if (problem) return problem;
  const spell = SPELLS[id];
  const minutes = spell.sv * (spell.ritual ? RITUAL_MEMORIZE_MINUTES_PER_SV : MEMORIZE_MINUTES_PER_SV);
  advanceTime(g, minutes * 60, 'vila');
  g.char.memorized.push(id);
  g.log(`${g.player.name} memorerar ${spell.name} ur formelsamlingen (${minutes} minuter).`);
  g.changed();
  return null;
}

export function forget(g: Game, id: string) {
  const ch = g.char;
  ch.memorized = ch.memorized.filter((x) => x !== id);
  g.changed();
}

/** Lär sig en besvärjelse som man har hittat (husregel: utan EP). Kräver FV i skolan minst skolvärdet. */
export function learnSpell(g: Game, id: string): string | null {
  const ch = g.char;
  const spell = SPELLS[id];
  if (!spell) return 'Okänd besvärjelse.';
  if (ch.spells.includes(id)) return 'Den finns redan i formelsamlingen.';
  if (schoolFv(g.player, spell) < spell.sv) return `Det krävs minst FV ${spell.sv} i skolan för att lära sig ${spell.name}.`;
  ch.spells.push(id);
  g.log(`${g.player.name} lär sig ${spell.name} och skriver in den i formelsamlingen.`);
  return null;
}

/** Medvetslös: magikern glömmer allt i minnet om ett Normalt PSY-slag misslyckas (Bok III s. 5). */
export function forgetOnKnockout(g: Game, a: Actor) {
  const ch = g.charOf(a);
  if (!ch) return;
  if (!ch.memorized.length) return;
  const check = attributeCheck(a.attrs.PSY, g.rng, 'Normalt');
  if (check.success) g.log(`${a.name} behåller besvärjelserna i minnet (Normalt PSY-slag, T20: ${check.roll} mot ${check.target}).`);
  else {
    ch.memorized = [];
    g.log(`${a.name} glömmer alla besvärjelser i minnet (Normalt PSY-slag, T20: ${check.roll} mot ${check.target}).`);
  }
}

// ------------------------------------------------------------------ att lägga en besvärjelse

export interface CastOptions {
  /** Effektgrad för själva verkan. */
  grade: number;
  /** Extra effektgrader för räckvidd och varaktighet. */
  extraRange?: number;
  extraDuration?: number;
  /** Målets aktörs-id (utelämnas för besvärjelser på en själv). */
  target?: string;
  /** Självmordsattack: får kosta mer PSY än magikern har kvar, CL blir S, och magikern dör. */
  suicide?: boolean;
  /** Magikern (som standard den som styrs). */
  caster?: Actor;
  /** Grundegenskapen för ÖKA och MINSKA. */
  attr?: AttrKey;
  /** ASTRALVAPEN med en eller två händer. */
  hands?: 1 | 2;
  /** Rutan som besvärjelsen gäller (SPRÅNG, LYFT, TELEPORTERA, SYN, ÖPPNA, FÖRSEGLA). */
  at?: { x: number; y: number };
  /** Vad VARSEBLIVNING letar efter (`SEEK_KINDS`), och örten för VÄXTKUNSKAP. */
  seek?: string;
  herb?: string;
  /** VINDKONTROLL och REGNKONTROLL: mer (1) eller mindre (−1). */
  change?: 1 | -1;
  /** Föremålet: det som LADDNING laddar, eller vapnet som FÖRÄNDRA gör. */
  item?: string;
  /** Dra PSY ur laddade föremål först (LADDNING). */
  useCharge?: boolean;
}

/** En ritual tar lika många timmar som effektgraden (Vidar). */
export const ritualHours = (totalGrade: number) => Math.max(1, totalGrade);

/** Hur långt målet kan flyttas (rutor) med SPRÅNG, LYFT och TELEPORTERA, eller null. */
export function moveReach(g: Game, id: string, grade: number, t: Actor): number | null {
  switch (SPELLS[id]?.effect?.kind) {
    case 'språng':
      // 4 m per E, och en ruta är 1,5 m.
      return Math.floor((grade * 4) / 1.5);
    case 'lyft':
      // Två rutor, plus en för varje E utöver det som krävs för målets STO.
      return 2 + Math.max(0, grade - Math.ceil(t.attrs.STO / 3));
    case 'teleportera':
      // Inom 100 m.
      return Math.floor(100 / 1.5);

    default:
      return null;
  }
}

/** Varför målet inte kan flyttas till rutan, eller null. */
function moveProblem(g: Game, id: string, grade: number, t: Actor, at?: { x: number; y: number }): string | null {
  const kind = SPELLS[id].effect!.kind;
  const max = moveReach(g, id, grade, t)!;
  if (!at) return 'Välj en ruta att flytta till.';
  const d = distance(t.x, t.y, at.x, at.y);
  if (d < 1 || d > max) return `Rutan måste ligga 1–${max} rutor bort.`;
  if (!walkable(g.map, at.x, at.y) || g.actorAt(at.x, at.y)) return 'Rutan är inte ledig.';
  if (kind === 'teleportera') {
    if (!g.state.explored[at.y * g.map.w + at.x]) return 'Man kan bara teleportera till en plats man känner till.';
    if (g.state.mode === 'combat' && !g.isVisible(at.x, at.y)) return 'I strid går det bara till en ruta som du ser.';
    return null;
  }
  // SPRÅNG och LYFT går över fiender och vatten men inte genom väggar, berg och träd.
  for (const p of between(t, at)) {
    const tile = tileAt(g.map, p.x, p.y);
    if (!tile.walkable && tile.name !== 'vatten') return `Vägen är stängd av ${tile.name}.`;
  }
  return null;
}

/** FLYGA: en E extra per 20 STO över de första 20, och flygfarten E × 5 rutor av det som blir över. */
export function flightGrades(t: Actor): number {
  return Math.ceil(Math.max(0, t.attrs.STO - 20) / 20);
}

/** Grundegenskaperna som ÖKA och MINSKA kan ändra. */
export const BODY_ATTRS: AttrKey[] = ['STY', 'FYS', 'STO', 'KAR', 'SMI'];

/** Räckvidd i rutor (null = obegränsad inom synhåll, 0 = bara en själv). */
export function rangeSquares(g: Game, a: Actor, spell: SpellDef, extra = 0): number {
  if (spell.range === 'personlig') return 0;
  if (spell.range === 'beröring') return 1;
  if (spell.range === 'särskild') return Math.floor((a.attrs.STY + a.attrs.SMI) / 2);
  const r = spellRange(spell.range, spellS(a, spell.id), extra);
  if (!r) return 0;
  return r.unit === 'km' ? 9999 : r.value;
}

/** Ser magikern målet? Gruppen ser det som syns på skärmen, andra efter sitt synhåll. */
function sees(g: Game, caster: Actor, t: Actor): boolean {
  if (isParty(caster)) return g.isVisible(t.x, t.y);
  return g.canSee(caster, t) && !unseen(caster, t);
}

/** Hör målet till magikerns fiender? Fienderna går bara på gruppen, som i närstrid. */
export function foeOf(caster: Actor, t: Actor): boolean {
  if (isParty(caster)) return t.hostile || t.kind === 'npc';
  return caster.hostile ? isParty(t) : t.hostile;
}

/** Möjliga mål för en besvärjelse. */
export function spellTargets(g: Game, id: string, extraRange = 0, caster: Actor = g.player): Actor[] {
  const p = caster;
  const spell = SPELLS[id];
  if (!spell) return [];
  const range = rangeSquares(g, p, spell, extraRange);
  const near = g.state.actors.filter(
    (a) => a.alive && !a.fled && a !== p && sees(g, p, a) && distance(p.x, p.y, a.x, a.y) <= range && lineOfSight(g.map, p.x, p.y, a.x, a.y),
  );
  switch (spell.aim) {
    case 'själv':
      return [p];
    case 'fiende':
      return near.filter((a) => foeOf(p, a));
    default:
      return [p, ...near];
  }
}

/** Varför besvärjelsen inte kan läggas nu, eller null. */
export function castProblem(g: Game, id: string, o: CastOptions): string | null {
  const p = o.caster ?? g.player;
  const book = spellbook(g, p);
  const spell = SPELLS[id];
  if (p.elemental) return 'En elementar lägger inga besvärjelser.';
  if (p.shape) return 'I djurhamn kan du inte lägga besvärjelser.';
  if (!spell || !book.spells.includes(id)) return 'Du kan inte den besvärjelsen.';
  if (!spell.effect) return `${spell.name} verkar inte i spelet än.`;
  if (spell.ritual && (g.state.mode !== 'explore' || !g.canRest())) return 'En ritual tar timmar och kräver lugn och ro.';
  if (!canAct(p) || p.down || p.kp <= 1 || hasEffect(p, 'håller')) return 'Du kan inte lägga besvärjelser nu.';
  if (hasEffect(p, 'stum')) return 'Du kan inte använda magi just nu.';
  const iron = ironProblem(g, p);
  if (iron) return `Järnet stör magin: ${iron}`;
  const memorized = book.memorized.includes(id);
  if (g.state.mode === 'combat') {
    const c = g.state.combat!;
    if (c.order[c.turn] !== p.id || c.acted[p.id] || (isParty(p) && !g.isPlayerTurn())) return 'Det är inte din tur.';
    if ((p.movedLast ?? 0) > 0) return 'Att lägga en besvärjelse tar hela rundan; du har redan flyttat dig.';
    if (!memorized && !spell.quick) return 'Bara kvicka besvärjelser hinner läsas ur formelsamlingen i strid.';
  } else if (g.state.mode !== 'explore') return 'Du kan inte lägga besvärjelser nu.';
  const total = o.grade + (o.extraRange ?? 0) + (o.extraDuration ?? 0);
  if (o.grade < 1) return 'Effektgraden måste vara minst 1.';
  if (total > maxGrade(p, id)) return `Högsta effektgrad är E${maxGrade(p, id)} (FV i skolan).`;
  if (o.suicide) {
    if (p.psy <= 0) return 'Du har ingen kraft kvar att offra.';
    if (total > suicideBudget(p.psy, p.attrs.PSY)) return `Du kan offra högst ${suicideBudget(p.psy, p.attrs.PSY)} PSY.`;
  } else if (total >= p.psy + (o.useCharge ? chargeAvailable(g, p) : 0)) return `Du har bara ${p.psy} PSY kvar${o.useCharge ? ` och ${chargeAvailable(g, p)} i laddade föremål` : ''}. Når PSY 0 dör du.`;
  if (spell.effect.kind === 'laddning' && (!o.item || !chargeableItems(g, p).includes(o.item))) return 'Välj ett föremål som aldrig har laddats.';
  if (spell.effect.kind === 'förändra') {
    const t = o.target ? g.actor(o.target) : undefined;
    if (t && !WEAPONS[t.weapon]) return `${t.name} håller inget vapen att förändra.`;
    if (t && (!o.item || !transformChoices(t.weapon).includes(o.item))) return 'Välj ett vapen av samma slag.';
    if (t && o.item && o.grade < transformGrade(t.weapon, o.item)) return `Det krävs E${transformGrade(t.weapon, o.item)} (en E per 3 kg).`;
  }
  if (spell.effect.kind === 'egenskap' && (!o.attr || !BODY_ATTRS.includes(o.attr))) return 'Välj grundegenskap: STY, FYS, STO, KAR eller SMI.';
  if (spell.effect.kind === 'kamouflage' && !outdoors(g, p)) return 'KAMOUFLAGE verkar bara ute i naturen.';
  if (spell.effect.kind === 'astralvapen') {
    const need = ASTRAL_WEAPON[o.hands ?? 1].grade;
    if (o.grade < need) return `Ett ${o.hands === 2 ? 'tvåhandsvapen' : 'enhandsvapen'} kräver E${need}.`;
    if (o.hands === 2 && p.detailed && !limbUsable(p, shieldArm(p))) return 'Det krävs två hela armar.';
  }
  if (spell.aim !== 'själv') {
    const t = o.target ? g.actor(o.target) : undefined;
    if (!t || !spellTargets(g, id, o.extraRange, p).includes(t)) return 'Välj ett mål inom räckhåll som du ser.';
    if (spell.effect.kind === 'elementar') return summonProblem(g, p, spell.effect.element, t);
    if (spell.effect.kind === 'osynlighet' && o.grade * 6 < t.attrs.STO) return `Det krävs E${Math.ceil(t.attrs.STO / 6)} för att göra ${t.name} osynlig (6 STO per E).`;
    if ((spell.effect.kind === 'lyft' || spell.effect.kind === 'teleportera') && o.grade * 3 < t.attrs.STO) return `Det krävs E${Math.ceil(t.attrs.STO / 3)} för ${t.name} (3 STO per E).`;
    if (spell.effect.kind === 'flyga' && o.grade <= flightGrades(t)) return `${t.name} är tung: det krävs mer än E${flightGrades(t)}.`;
    if (spell.effect.kind === 'kontrollera') {
      // KONTROLLERA PERSON gäller personer, KONTROLLERA VARELSE ointelligenta djur men inte magiska
      // varelser (Vidar), 20 STO per E.
      if (spell.effect.who === 'person' && (!t.detailed || t.elemental || isCommonAnimal(g, t))) return 'KONTROLLERA PERSON verkar bara på personer.';
      if (spell.effect.who === 'djur') {
        if (!isCommonAnimal(g, t)) return 'KONTROLLERA VARELSE verkar bara på ointelligenta djur, inte på människor eller magiska varelser.';
        if (o.grade * 20 < t.attrs.STO) return `Det krävs E${Math.ceil(t.attrs.STO / 20)} för ${t.name} (20 STO per E).`;
      }
    }
    if (moveReach(g, id, o.grade, t) !== null) {
      const m = moveProblem(g, id, o.grade, t, o.at);
      if (m) return m;
    }
  }
  const world = worldProblem(g, p, spell, o);
  if (world) return world;
  if (spell.effect.kind === 'skada' && spell.effect.needsRain) {
    const t = o.target ? g.actor(o.target) : undefined;
    if (!raining(g)) return 'Det måste regna.';
    if (!underSky(g, p) || (t && !underSky(g, t))) return 'Både magikern och målet måste stå under bar himmel.';
  }
  if (spell.effect.kind === 'dimma') {
    const t = o.target ? g.actor(o.target) : undefined;
    if (t && !waterWithin(g, t, 10)) return 'DIMMA kräver vatten i närheten.';
  }
  return null;
}

/**
 * Lägger en besvärjelse. Kvicka besvärjelser verkar på en gång; andra verkar i början av nästa
 * runda (i strid) om magikern inte blir skadad innan. Utanför strid går tiden i stället.
 */
export function castSpell(g: Game, id: string, o: CastOptions): string | null {
  const problem = castProblem(g, id, o);
  if (problem) return problem;
  const p = o.caster ?? g.player;
  const spell = SPELLS[id];
  const memorized = spellbook(g, p).memorized.includes(id);
  const target = spell.aim === 'själv' ? p.id : o.target;
  const t = target ? g.actor(target) : undefined;
  const pending: PendingSpell = {
    caster: p.id,
    spell: id,
    grade: o.grade,
    extraRange: o.extraRange ?? 0,
    extraDuration: o.extraDuration ?? 0,
    target,
    x: t?.x ?? p.x,
    y: t?.y ?? p.y,
    rounds: 1,
    suicide: o.suicide,
    attr: o.attr,
    hands: o.hands,
    at: o.at,
    seek: o.seek,
    herb: o.herb,
    change: o.change,
    item: o.item,
    useCharge: o.useCharge,
  };
  // Den som lägger magi syns igen (OSYNLIGHET och KAMOUFLAGE).
  breakHiding(g, p, 'lägger magi');
  if (g.state.mode === 'combat') {
    const c = g.state.combat!;
    c.acted[p.id] = true;
    c.movesLeft = 0;
    if (!memorized) {
      // Ur formelsamlingen tar en kvick besvärjelse 1T6 SR.
      pending.rounds = roll(BOOK_CAST.quickRounds, g.rng);
      (c.pending ??= []).push(pending);
      p.effects.push({ kind: 'ingenHandling', label: `Läser ${spell.name} ur formelsamlingen`, rounds: pending.rounds });
      g.log(`${p.name} slår upp ${spell.name} i formelsamlingen (${pending.rounds} SR).`);
    } else if (spell.quick) {
      g.log(`${p.name} lägger ${spell.name} E${totalGrade(pending)}.`);
      resolve(g, pending);
    } else {
      (c.pending ??= []).push(pending);
      g.log(
        isParty(p)
          ? `${p.name} börjar lägga ${spell.name} E${totalGrade(pending)}. Den verkar i början av nästa runda.`
          : `${p.name} börjar mana ${spell.name} E${totalGrade(pending)}${t && t !== p ? ` mot ${t.name}` : ''}! Den verkar i början av nästa runda, om ingen hinner skada ${p.name} innan.`,
      );
    }
    if (g.state.mode === 'combat') finishTurn(g);
  } else {
    if (!memorized) {
      const secs = spell.quick ? roll(BOOK_CAST.quickRounds, g.rng) * ROUND_SECONDS : roll(BOOK_CAST.normalMinutes, g.rng) * 60;
      advanceTime(g, secs, 'aktiv');
      g.log(`${p.name} läser ${spell.name} ur formelsamlingen.`);
    }
    if (spell.ritual) {
      const hours = ritualHours(totalGrade(pending));
      advanceTime(g, hours * 3600, 'vila');
      g.log(`${p.name} genomför ritualen ${spell.name} (${hours} timmar).`);
    } else if (memorized && !spell.quick) advanceTime(g, ROUND_SECONDS, 'aktiv');
    resolve(g, pending);
  }
  g.changed();
  return null;
}

const totalGrade = (s: PendingSpell) => s.grade + s.extraRange + s.extraDuration;

/** Besvärjelser som läggs i strid verkar i början av rundan efter (magi går före slagväxling). */
export function resolvePending(g: Game) {
  const c = g.state.combat;
  if (!c?.pending?.length) return;
  const keep: PendingSpell[] = [];
  for (const s of c.pending) {
    s.rounds--;
    if (s.rounds > 0) keep.push(s);
    else resolve(g, s);
    if (g.state.mode !== 'combat') return;
  }
  if (g.state.combat) g.state.combat.pending = keep;
}

/** Skadas magikern medan hen lägger en besvärjelse bryts koncentrationen: 1 PSY går åt och inget händer. */
export function breakConcentration(g: Game, a: Actor) {
  const c = g.state.combat;
  if (!c?.pending?.some((s) => s.caster === a.id)) return;
  for (const s of c.pending.filter((x) => x.caster === a.id)) {
    a.psy = Math.max(0, a.psy - 1);
    g.log(`${a.name} blir skadad och tappar koncentrationen: ${SPELLS[s.spell].name} går förlorad (−1 PSY).`);
  }
  c.pending = c.pending.filter((s) => s.caster !== a.id);
  a.effects = a.effects.filter((e) => !e.label.startsWith('Läser '));
}

function resolve(g: Game, s: PendingSpell) {
  const a = g.actor(s.caster);
  if (!a || !a.alive || a.unconscious) return;
  const spell = SPELLS[s.spell];
  const total = totalGrade(s);
  const S = spellS(a, s.spell);
  const cl = s.suicide ? S : spellCl(S, total);
  const check = heroic(g, a, skillCheck(S, g.rng, cl - S + skillMod(g, a, `spell:${s.spell}`)));
  let cost = spellPsyCost(total, check.result);
  const half = a.effects.find((e) => e.kind === 'halvPsy');
  if (half && check.result !== 'misslyckat') {
    cost = Math.max(1, Math.floor(cost / 2));
    a.effects = a.effects.filter((e) => e !== half);
  }
  // LADDNING: PSY ur laddade föremål används först.
  const fromItems = s.useCharge ? drawCharge(g, a, cost) : 0;
  if (fromItems) g.log(`${a.name} drar ${fromItems} PSY ur laddade föremål.`);
  a.psy -= cost - fromItems;
  const head = `${spell.name} E${total} (S${S}, T20: ${check.roll} mot ${check.target}, −${cost} PSY)`;
  if (check.result === 'fummel') {
    g.log(`${head}: snedtändning!`);
    g.emit(a.id, 'Snedtändning!', 'miss');
    misfire(g, a, s);
  } else if (!check.success) {
    g.log(`${head}: misslyckas.`);
    g.emit(a.id, 'Misslyckas', 'miss');
  } else {
    g.log(`${head}: ${check.result === 'perfekt' ? 'perfekt!' : 'lyckas.'}`);
    // Scener i modulen som besvärjelsen visar (SYN, TELEPATI …).
    s.scene = showScenes(g, a, s.spell) > 0;
    apply(g, a, antimagic(g, a, s), s.grade, check);
  }
  if (a.psy <= 0 && a.alive) {
    g.log(s.suicide ? `${a.name} har gett allt och faller död ned.` : `${a.name} har tömt sin själ på kraft och dör.`);
    kill(g, a);
  }
}

// ------------------------------------------------------------------ verkan

/**
 * ANTIMAGI på målet: besvärjelsen måste övervinna dess E med sin egen E på motståndstabellen,
 * annars studsar den tillbaka på magikern. Gäller besvärjelser som riktas mot någon annan, inte
 * EXPLOSION, elementarer eller magikerns egna besvärjelser på sig själv.
 */
function antimagic(g: Game, caster: Actor, s: PendingSpell): PendingSpell {
  const t = s.target ? g.actor(s.target) : undefined;
  const kind = SPELLS[s.spell].effect?.kind;
  if (!t || t === caster || kind === 'explosion' || kind === 'elementar' || kind === 'mörker' || kind === 'dimma') return s;
  // BESKYDDARE fungerar som ANTIMAGI E1 mot magi utifrån.
  const ward = zonesAt(g, 'beskyddare', t).some((z) => distance(z.x, z.y, caster.x, caster.y) > z.r);
  const shield = t.effects.find((e) => e.kind === 'antimagi') ?? (ward ? { grade: 1 } : undefined);
  if (!shield?.grade) return s;
  const total = totalGrade(s);
  const r = resistance(total, shield.grade, g.rng);
  if (r.success) {
    g.log(`${SPELLS[s.spell].name} bryter igenom ANTIMAGI kring ${t.name} (E${total} mot E${shield.grade}, ${r.roll} mot ${r.target}).`);
    return s;
  }
  g.log(`${SPELLS[s.spell].name} studsar mot ANTIMAGI kring ${t.name} och vänder tillbaka mot ${caster.name} (E${total} mot E${shield.grade}, ${r.roll} mot ${r.target})!`);
  return { ...s, target: caster.id, x: caster.x, y: caster.y };
}

function durationRounds(spell: SpellDef, S: number, extra: number, rng: () => number): { rounds?: number; days?: number } {
  const d: SpellDuration = spell.duration;
  if (d === 'omedelbar' || d === 'koncentration') return { rounds: 1 };
  if (d === 'permanent') return { days: 9999 };
  if ('dice' in d) return { rounds: Math.ceil((roll(d.dice, rng) * DURATION_SECONDS[d.unit]) / ROUND_SECONDS) };
  const amount = (d.mult ? S * d.mult : S / (d.div ?? 1)) * (1 + extra);
  const seconds = amount * DURATION_SECONDS[d.unit];
  if (d.unit === 'dygn' || d.unit === 'veckor') return { days: Math.max(1, Math.round(seconds / DURATION_SECONDS.dygn)) };
  return { rounds: Math.max(1, Math.ceil(seconds / ROUND_SECONDS)) };
}

function effectFor(a: Actor, spell: SpellDef, s: PendingSpell, grade: number, g: Game): Pick<ActiveEffect, 'label' | 'spell' | 'grade' | 'persist' | 'rounds' | 'days'> {
  return { label: `${spell.name} E${grade}`, spell: spell.id, grade, persist: true, ...durationRounds(spell, spellS(a, spell.id), s.extraDuration, g.rng) };
}

/** Ovilliga mål gör motstånd: magikerns kvarvarande PSY mot målets PSY på motståndstabellen. */
function resists(g: Game, caster: Actor, t: Actor, spell: SpellDef): boolean {
  if (!spell.resisted || t === caster || t.unconscious) return false;
  // Orubblig vilja: +5 på PSY i kampen.
  const psy = t.attrs.PSY + passive(g.charOf(t), 'psyResist');
  const check = resistance(Math.max(0, caster.psy), psy, g.rng);
  // En vunnen kamp PSY mot PSY mot en fiende kan höja PSY efter äventyret (Bok I).
  const foes = caster.hostile !== t.hostile;
  if (check.success) {
    if (foes) markPsyWin(g, caster, 'magiker');
    return false;
  }
  if (foes) markPsyWin(g, t, 'motstånd');
  g.log(`${t.name} gör motstånd (PSY ${caster.psy} mot ${psy}, T20: ${check.roll} mot ${check.target}).`);
  return true;
}

function apply(g: Game, caster: Actor, s: PendingSpell, grade: number, check: Check) {
  const spell = SPELLS[s.spell];
  const e = spell.effect!;
  const t = s.target ? g.actor(s.target) : caster;
  if (!t || !t.alive) {
    g.log('Målet finns inte längre.');
    return;
  }
  if (resists(g, caster, t, spell)) return;
  const perfect = check.result === 'perfekt';
  switch (e.kind) {
    case 'skada': {
      // VINDPIL är en projektil: VIRVELSKÖLD stöter bort den.
      if (e.projectile && (inVortex(t) || inVortex(caster))) {
        g.log(`Virvelskölden stöter bort ${spell.name}.`);
        g.emit(t.id, 'Miss', 'miss');
        return;
      }
      const detailed = t.detailed && e.detailedDice ? e.detailedDice : e.dice;
      const n = e.fixed ? 1 : grade;
      const dmg = (perfect ? maxDice(detailed, n) : sumDice(detailed, n, g)) + (e.perGrade ?? 0) * grade;
      let loc: HitLocation | null = null;
      let abs = 0;
      if (e.armor !== 'ingen') {
        loc = e.loc && t.detailed ? lookup(HIT_TABLE.avstånd, die(20, g.rng))! : null;
        // Skada på totala KP (ELD, FROST): rustningen på bålen tar emot den (tolkning).
        const piece = t.detailed ? armorPiece(t, loc ?? 'bröstkorg') : undefined;
        abs = (piece?.abs ?? 0) + t.naturalArmor + magicArmor(t);
        if (e.armor === 'halvMetall' && piece?.metal) abs = Math.floor(abs / 2);
      }
      const factor = spellVersusElemental(g, s.spell, t);
      // MOTSTÅNDSKRAFT tar 1 per E av skadan från ELD och FROST.
      const resist = s.spell === 'eld' || s.spell === 'frost' ? Math.min(heatColdResist(t), dmg) : 0;
      if (resist) g.log(`MOTSTÅNDSKRAFT tar ${resist} av skadan.`);
      const dealt = Math.max(0, dmg - abs - resist) * factor;
      g.log(`${t.name} tar ${dealt} i skada${loc ? ` i ${loc}` : ''}${abs ? ` (${dmg} − ${abs} i skydd)` : ''}${factor === 2 ? ' – dubbel skada' : factor === 0 ? ' – elementaren är immun' : ''}.`);
      g.emit(t.id, dealt ? `-${dealt}` : '0', 'damage');
      provoke(g, t, caster);
      wound(g, t, dealt, loc);
      return;
    }
    case 'explosion': {
      // Inom E meter: en ruta är 1,5 meter, så E1 träffar bara mittrutan.
      const radius = Math.floor(grade / 1.5);
      const base = e.perGrade * grade;
      for (const x of g.state.actors.filter((a) => a.alive && !a.fled)) {
        const d = distance(s.x, s.y, x.x, x.y);
        const dmg = d <= radius ? base : base - (d - radius);
        if (dmg > 0) {
          g.log(`Explosionen träffar ${x.name}: ${dmg} i skada.`);
          g.emit(x.id, `-${dmg}`, 'damage');
          if (x !== caster) provoke(g, x, caster);
          wound(g, x, dmg, null);
        }
        // Alla som ser explosionen bländas nästa runda.
        if (x.alive && !x.unconscious && !hasEffect(x, 'magiskSyn') && distance(x.x, x.y, s.x, s.y) <= x.sight && lineOfSight(g.map, x.x, x.y, s.x, s.y)) {
          x.effects.push({ kind: 'blind', label: 'Bländad av explosionen', rounds: 2 });
        }
      }
      return;
    }
    case 'köld': {
      // Härdig mot element och Härdad av havet: +5 på FYS.
      const fys = attributeCheck(t.attrs.FYS + t.naturalArmor + passive(g.charOf(t), 'elementResist'), g.rng, 'Svårt');
      if (fys.success) {
        t.effects.push({ kind: 'cl', label: 'Köldrysningar', mod: -4, scope: 'alla', rounds: 1 });
        g.log(`${t.name} skakar av köld men står emot (Svårt FYS-slag, T20: ${fys.roll} mot ${fys.target}): −4 på CL rundan ut.`);
      } else {
        t.effects.push({ kind: 'ingenHandling', label: 'Skakar av köld', rounds: 1 });
        g.log(`${t.name} skakar av kraftiga köldrysningar och kan inte göra något (Svårt FYS-slag, T20: ${fys.roll} mot ${fys.target}).`);
      }
      provoke(g, t, caster);
      return;
    }
    case 'knäcka': {
      const key = t.shield && t.bv.shield !== undefined ? 'shield' : t.bv.weapon !== undefined ? 'weapon' : null;
      if (!key) {
        g.log(`${t.name} har inget vapen eller sköld som kan knäckas.`);
        return;
      }
      const loss = e.base + e.perGrade * (grade - 1);
      const name = key === 'shield' ? 'sköld' : 'vapen';
      t.bv[key] -= loss;
      if (t.bv[key] > 0) g.log(`${spell.name}: ${t.name}s ${name} tappar ${loss} BV (BV ${t.bv[key]} kvar).`);
      else {
        g.log(`${spell.name}: ${t.name}s ${name} går sönder!`);
        unequip(g, t, key);
      }
      provoke(g, t, caster);
      return;
    }
    case 'luftsköld':
      t.effects.push({ kind: 'luftsköld', label: `SKÖLD E${grade}`, rounds: 2, spell: spell.id, grade });
      g.log(`Luften framför ${t.name} hårdnar till en sköld.`);
      return;
    case 'vapen': {
      const mod = e.sign * grade;
      t.effects.push({ kind: 'vapenMagi', mod, slot: 'weapon', ...effectFor(caster, spell, s, grade, g) });
      g.log(`${t.name}s vapen ${e.sign > 0 ? 'förtrollas' : 'förbannas'}: ${mod > 0 ? '+' : ''}${mod} på CL och skada.`);
      if (e.sign < 0) provoke(g, t, caster);
      return;
    }
    case 'läka': {
      const amount = perfect ? maxDice(e.dice, grade) : sumDice(e.dice, grade, g);
      if (t.detailed) g.heal(amount, t);
      else t.kp = Math.min(t.maxKp, t.kp + amount);
      g.log(`${t.name} läks ${amount} KP.`);
      return;
    }
    case 'motgift': {
      const amount = sumDice(e.dice, grade, g);
      neutralize(g, t, amount);
      return;
    }
    case 'skydd': {
      const mod = e.fixed ?? (e.perGrade ?? 1) * grade;
      t.effects.push({ kind: 'skydd', mod, ...effectFor(caster, spell, s, grade, g) });
      g.log(`${t.name} skyddas av ${spell.name}: +${mod} i absorbering på hela kroppen.`);
      return;
    }
    case 'mörkersyn':
      t.effects.push({ kind: 'mörkersyn', ...effectFor(caster, spell, s, grade, g) });
      g.log(`${t.name} ser värmen i mörkret.`);
      return;
    case 'orädd':
      t.effects.push({ kind: 'orädd', ...effectFor(caster, spell, s, grade, g) });
      g.log(`${t.name} känner ingen fruktan.`);
      return;
    case 'skingra': {
      if (t.elemental) {
        // SKINGRA kan förstöra en elementar: E mot elementarens grad.
        const r = resistance(grade, t.elemental.grade, g.rng);
        if (r.success) dissolve(g, t, `${t.name} skingras (E${grade} mot grad ${t.elemental.grade}).`);
        else g.log(`${t.name} står emot SKINGRA (E${grade} mot grad ${t.elemental.grade}).`);
        return;
      }
      const magic = t.effects.filter((x) => x.spell && x.grade !== undefined);
      if (!magic.length) {
        g.log(`Det finns ingen besvärjelse att skingra på ${t.name}.`);
        return;
      }
      for (const x of magic) {
        const r = resistance(grade, x.grade!, g.rng);
        if (r.success) {
          endSpellEffect(g, t, x);
          g.log(`${x.label} på ${t.name} skingras (E${grade} mot E${x.grade}).`);
        } else g.log(`${x.label} på ${t.name} står emot (E${grade} mot E${x.grade}).`);
      }
      return;
    }
    case 'fiendskap':
      g.log(t.hostile ? `${t.name} vill dig ont.` : `${t.name} är inte fientligt inställd mot dig.`);
      return;
    case 'elementar':
      summonOrBanish(g, caster, t, e.element, grade, spellS(caster, spell.id), s.extraDuration);
      return;
    case 'egenskap': {
      const attr = s.attr ?? 'STY';
      // Samma besvärjelse på samma grundegenskap ersätter den gamla.
      for (const old of t.effects.filter((x) => x.kind === 'egenskap' && x.spell === spell.id && x.attr === attr)) endSpellEffect(g, t, old);
      // MINSKA sänker inte under 1.
      const delta = e.sign > 0 ? grade : -Math.min(grade, t.attrs[attr] - 1);
      if (!delta) {
        g.log(`${t.name}s ${attr} kan inte sänkas mer.`);
        return;
      }
      changeAttribute(g, t, attr, delta);
      t.effects.push({ kind: 'egenskap', attr, mod: delta, ...effectFor(caster, spell, s, grade, g), label: `${spell.name} E${grade}: ${attr} ${delta > 0 ? '+' : ''}${delta}` });
      g.log(`${t.name}s ${attr} ${delta > 0 ? 'stiger' : 'sjunker'} till ${t.attrs[attr]}.`);
      if (e.sign < 0) provoke(g, t, caster);
      return;
    }
    case 'flammandeHand':
      t.effects.push({ kind: 'flammandeHand', ...effectFor(caster, spell, s, grade, g) });
      g.log(`${t.name}s hand flammar upp: +${grade}T3 i skada med händerna och vapen i handen.`);
      return;
    case 'virvelsköld':
      t.effects.push({ kind: 'virvelsköld', ...effectFor(caster, spell, s, grade, g) });
      g.log(`En virvlande vind omger ${t.name}: inga projektiler når fram, och inga kommer ut.`);
      return;
    case 'motståndskraft':
      t.effects.push({ kind: 'motståndskraft', ...effectFor(caster, spell, s, grade, g) });
      g.log(`${t.name} tål eld och köld bättre: −${grade} på skadan per angrepp.`);
      return;
    case 'antimagi':
      t.effects = t.effects.filter((x) => x.kind !== 'antimagi');
      t.effects.push({ kind: 'antimagi', ...effectFor(caster, spell, s, grade, g) });
      g.log(`En sköld mot magi omger ${t.name} (E${grade}).`);
      return;
    case 'ljus': {
      // Tre meter per E: två rutor per E.
      const radius = 2 * grade;
      t.effects = t.effects.filter((x) => x.kind !== 'ljus');
      t.effects.push({ kind: 'ljus', mod: radius, ...effectFor(caster, spell, s, grade, g) });
      g.log(`${t.name} lyser som en fackla, ${radius} rutor runt sig.`);
      return;
    }
    case 'mörker': {
      const d = durationRounds(spell, spellS(caster, spell.id), s.extraDuration, g.rng);
      const seconds = d.days ? d.days * DURATION_SECONDS.dygn : (d.rounds ?? 1) * ROUND_SECONDS;
      // En sfär med sex meters diameter: två rutor åt varje håll.
      (g.state.zones ??= []).push({ kind: 'mörker', map: g.state.mapId, x: t.x, y: t.y, r: 2, until: g.state.time + seconds, spell: spell.id, grade });
      g.log(`Ett kompakt mörker sluter sig kring ${t.name}s ruta. Där lyser ingenting.`);
      return;
    }
    case 'magiskSyn':
      t.effects.push({ kind: 'magiskSyn', ...effectFor(caster, spell, s, grade, g) });
      g.log(`${t.name} ser det osynliga och kan inte bländas.`);
      return;
    case 'osynlighet':
      t.effects.push({ kind: 'osynlig', ...effectFor(caster, spell, s, grade, g) });
      t.hidden = true;
      g.log(`${t.name} blir osynlig.`);
      return;
    case 'kamouflage':
      if (!outdoors(g, t)) {
        g.log('KAMOUFLAGE verkar bara ute i naturen.');
        return;
      }
      t.effects.push({ kind: 'kamouflage', at: { x: t.x, y: t.y }, ...effectFor(caster, spell, s, grade, g) });
      t.hidden = true;
      g.log(`${t.name} smälter in i naturen och syns inte så länge hen står still.`);
      return;
    case 'astralvapen': {
      const w = ASTRAL_WEAPON[s.hands ?? 1];
      t.effects = t.effects.filter((x) => x.kind !== 'astralvapen');
      // FV är magikerns S när besvärjelsen läggs.
      t.effects.push({ kind: 'astralvapen', dice: w.dice, mod: spellS(caster, spell.id), ...effectFor(caster, spell, s, grade, g) });
      g.log(`Ett ${s.hands === 2 ? 'tvåhandsvapen' : 'enhandsvapen'} av glödande magisk energi formas i ${t.name}s ${s.hands === 2 ? 'händer' : 'hand'} (${w.dice}, FV ${spellS(caster, spell.id)}).`);
      return;
    }
    case 'språng': {
      const at = s.at!;
      if (!walkable(g.map, at.x, at.y) || g.actorAt(at.x, at.y)) {
        g.log('Landningsplatsen är inte längre ledig.');
        return;
      }
      t.x = at.x;
      t.y = at.y;
      // Normalt SMI-slag vid landningen; Gott balanssinne ger +5. Misslyckas det hamnar hen på marken (tolkning).
      const smi = attributeCheck(t.attrs.SMI + (actorHas(g, t, 'gott_balanssinne') ? 5 : 0), g.rng, 'Normalt');
      if (smi.success) g.log(`${t.name} gör ett jättesprång och landar på fötterna (Normalt SMI-slag, T20: ${smi.roll} mot ${smi.target}).`);
      else {
        t.effects.push({ kind: 'liggande', label: 'Landade illa', rounds: 1 });
        g.log(`${t.name} gör ett jättesprång men landar illa och faller (Normalt SMI-slag, T20: ${smi.roll} mot ${smi.target}).`);
      }
      return;
    }
    case 'levitation':
      t.effects = t.effects.filter((x) => x.kind !== 'svävar');
      t.effects.push({ kind: 'svävar', mod: 0, ...effectFor(caster, spell, s, grade, g) });
      g.log(`${t.name} stiger upp i luften. Bara långa vapen når hen nu.`);
      return;
    case 'flyga': {
      const speed = (grade - flightGrades(t)) * 5;
      t.effects = t.effects.filter((x) => x.kind !== 'svävar');
      t.effects.push({ kind: 'svävar', mod: speed, ...effectFor(caster, spell, s, grade, g) });
      g.log(`${t.name} lyfter och flyger, ${speed} rutor per runda.`);
      return;
    }
    case 'lyft': {
      const at = s.at!;
      // En ovillig varelse gör motstånd: E × 3 mot målets STY (tolkning).
      if (t !== caster && foeOf(caster, t)) {
        const r = resistance(grade * 3, t.attrs.STY, g.rng);
        if (!r.success) {
          g.log(`${t.name} sliter sig loss ur greppet (E×3 ${grade * 3} mot STY ${t.attrs.STY}, T20: ${r.roll} mot ${r.target}).`);
          provoke(g, t, caster);
          return;
        }
      }
      if (!walkable(g.map, at.x, at.y) || g.actorAt(at.x, at.y)) {
        g.log('Platsen är inte längre ledig.');
        return;
      }
      t.x = at.x;
      t.y = at.y;
      g.log(`${t.name} lyfts genom luften och sätts ned ${distance(s.x, s.y, at.x, at.y)} rutor bort.`);
      if (t !== caster && foeOf(caster, t)) provoke(g, t, caster);
      return;
    }
    case 'teleportera': {
      const at = s.at!;
      if (g.actorAt(at.x, at.y)) {
        g.log('Platsen är inte längre ledig.');
        return;
      }
      t.x = at.x;
      t.y = at.y;
      g.log(`${t.name} försvinner och dyker upp på en annan plats.`);
      g.updateFov();
      return;
    }
    case 'dimma': {
      const d = durationRounds(spell, spellS(caster, spell.id), s.extraDuration, g.rng);
      const seconds = d.days ? d.days * DURATION_SECONDS.dygn : (d.rounds ?? 1) * ROUND_SECONDS;
      (g.state.zones ??= []).push({ kind: 'dimma', map: g.state.mapId, x: t.x, y: t.y, r: FOG_RADIUS, until: g.state.time + seconds, spell: spell.id, grade });
      g.log(`En tjock dimma stiger ur vattnet. Ingen ser längre än ${FOG_SIGHT} rutor i den.`);
      return;
    }
    case 'beskyddare': {
      const inside = g.state.actors.filter((x) => x.alive && distance(x.x, x.y, t.x, t.y) <= 1).map((x) => x.id);
      (g.state.zones ??= []).push({ kind: 'beskyddare', map: g.state.mapId, x: t.x, y: t.y, r: 1, until: Number.MAX_SAFE_INTEGER, spell: spell.id, grade, caster: caster.id, inside });
      g.log(`${caster.name} drar upp ett skyddande fält kring sig (tre gånger tre rutor). Den som går in träffas av en energistråle.`);
      return;
    }
    case 'kontrollera': {
      t.effects = t.effects.filter((x) => x.kind !== 'kontrollerad');
      t.effects.push({ kind: 'kontrollerad', by: caster.id, was: { hostile: t.hostile }, ...effectFor(caster, spell, s, grade, g) });
      t.hostile = false;
      g.log(`${caster.name} tar kontroll över ${t.name}, som nu slåss för gruppen.`);
      return;
    }
    default: {
      const d = durationRounds(spell, spellS(caster, spell.id), s.extraDuration, g.rng);
      const seconds = d.days ? d.days * DURATION_SECONDS.dygn : (d.rounds ?? 1) * ROUND_SECONDS;
      if (!applyWorld(g, caster, t, s, spell, grade, effectFor(caster, spell, s, grade, g), seconds, rangeSquares(g, caster, spell, s.extraRange))) g.log(`${spell.name} verkar inte i spelet än.`);
      return;
    }
    case 'laddning':
      charge(g, caster, s.item!, grade);
      return;
    case 'föryngra':
      rejuvenate(g, t, grade, effectFor(caster, spell, s, grade, g));
      return;
    case 'förändra':
      if (s.item) transformWeapon(g, t, s.item, effectFor(caster, spell, s, grade, g));
      if (t !== caster && foeOf(caster, t)) provoke(g, t, caster);
      return;
    case 'rankor': {
      const need = Math.ceil(t.attrs.STO / 10);
      if (grade < need) {
        g.log(`Rankorna räcker inte till för ${t.name} (det krävs E${need}).`);
        return;
      }
      const value = grade * 10 - t.attrs.STO;
      t.effects.push({ kind: 'rankor', mod: value, ...effectFor(caster, spell, s, grade, g) });
      g.log(`Rankor växer ut och snärjer ${t.name} (motståndsvärde ${value}).`);
      provoke(g, t, caster);
      return;
    }
  }
}

function sumDice(dice: string, n: number, g: Game): number {
  let sum = 0;
  for (let i = 0; i < n; i++) sum += Math.max(0, roll(dice, g.rng));
  return sum;
}

function maxDice(dice: string, n: number): number {
  const m = /^(\d+)T(\d+)([+-]\d+)?$/.exec(dice);
  if (!m) return Number(dice) * n;
  return n * (Number(m[1]) * Number(m[2]) + Number(m[3] ?? 0));
}

/** En fredlig person som utsätts för skadlig magi blir fientlig och striden börjar. */
function provoke(g: Game, t: Actor, caster: Actor) {
  provokeAnimal(g, caster, t);
  if (t.hostile || t.kind === 'player' || !t.alive) return;
  t.hostile = true;
  t.kind = 'monster';
  if (g.state.mode === 'explore') g.provoke(t.id);
}

// ------------------------------------------------------------------ snedtändning

/** Husregel: 1T20 på Snedtändningstabellen utan att lägga till effektgraden. */
function misfire(g: Game, a: Actor, s: PendingSpell) {
  const n = die(20, g.rng);
  const row = lookup(MISFIRE_TABLE, n)!;
  const total = totalGrade(s);
  const spell = SPELLS[s.spell];
  g.log(`Snedtändningstabellen ${n}: ${row.text}`);
  const knockout = (blind: boolean) => {
    wound(g, a, total, null);
    if (!a.alive) return;
    const awake = !a.unconscious;
    a.unconscious = true;
    a.effects.push({ kind: 'medvetslös', label: 'Medvetslös efter snedtändning', rounds: roll('1T8', g.rng) * 12 });
    if (awake) forgetOnKnockout(g, a);
    if (blind) a.effects.push({ kind: 'blind', label: 'Blind efter snedtändning', rounds: roll('1T8', g.rng) * 720, persist: true });
  };
  switch (row.effect.kind) {
    case 'halvE': {
      const grade = Math.ceil(s.grade / 2);
      apply(g, a, s, grade, { roll: 0, rolls: [], target: 0, fv: 0, result: 'lyckat', success: true, diff: 0 });
      return;
    }
    case 'skada':
      knockout(false);
      return;
    case 'bakslag': {
      const harmful = ['skada', 'köld', 'knäcka', 'rankor', 'explosion'].includes(spell.effect!.kind) || (spell.effect!.kind === 'vapen' && spell.effect!.sign < 0);
      if (harmful && s.target !== a.id) apply(g, a, { ...s, target: a.id, x: a.x, y: a.y }, s.grade, { roll: 0, rolls: [], target: 0, fv: 0, result: 'lyckat', success: true, diff: 0 });
      else knockout(true);
      return;
    }
    case 'stum':
      a.effects.push({ kind: 'stum', label: 'Stum efter snedtändning: ingen magi', days: roll(row.effect.days, g.rng), persist: true });
      return;
    case 'förlamad': {
      const days = roll(row.effect.days, g.rng);
      a.effects.push({ kind: 'stum', label: 'Förlamad efter snedtändning: ingen magi', days, persist: true });
      a.effects.push({ kind: 'ingenHandling', label: 'Förlamad efter snedtändning', days, persist: true });
      return;
    }
    case 'hjärnskada': {
      const loss = roll(row.effect.amount, g.rng);
      const ch = g.charOf(a) ?? g.char;
      a.attrs.INT = Math.max(1, a.attrs.INT - loss);
      ch.attrs.INT = a.attrs.INT;
      for (const [k, fv] of Object.entries(a.skills)) {
        if (isIntSkill(k)) {
          a.skills[k] = Math.max(0, fv - loss);
          ch.skills[k] = a.skills[k];
        }
      }
      const lost = ch.memorized.splice(0, loss);
      g.log(`${a.name}s INT sjunker med ${loss}${lost.length ? `, och ${lost.map((x) => SPELLS[x].name).join(', ')} faller ur minnet` : ''}.`);
      return;
    }
    case 'minnesförlust': {
      const days = roll(row.effect.days, g.rng);
      a.effects.push({ kind: 'stum', label: 'Minnesförlust: ingen magi', days, persist: true });
      a.effects.push({ kind: 'misslyckas', label: 'Minnesförlust: inga färdigheter', scope: 'strid', days, persist: true });
      a.effects.push({ kind: 'cl', label: 'Minnesförlust', mod: -20, scope: 'alla', days, persist: true });
      ((g.charOf(a) ?? g.char).phobias ??= []).push({ source: 'magi', level: 'normal' });
      return;
    }
  }
}

function isIntSkill(key: string): boolean {
  return key.startsWith('magiskola:') || SKILLS[key.split(':')[0]]?.attr === 'INT';
}

/** Är aktören upptagen med att lägga en besvärjelse? */
export function isCasting(g: Game, a: Actor): boolean {
  return !!g.state.combat?.pending?.some((s) => s.caster === a.id);
}

// ------------------------------------------------------------------ fiender som lägger besvärjelser

/**
 * Effektgraden som en fiende väljer: högst `want`, inte högre än att CL blir minst 8, och alltid
 * med PSY kvar till en E1 efteråt (förslaget, avsnitt 1.4).
 */
function aiGrade(a: Actor, id: string, want: number): number {
  return Math.min(want, maxGrade(a, id), a.psy - 2, Math.max(1, spellS(a, id) - 7));
}

/**
 * Fiendens val av besvärjelse på sin tur, i den här ordningen:
 * 1. HELA på en svårt skadad vän (hälften av KP eller mindre), också sig själv.
 * 2. Skydda sig själv: SKYDD, LÄDERHUD och FÖRTROLLA VAPEN när de inte redan verkar, och SKÖLD en
 *    gång per strid när någon står intill.
 * 3. En skadebesvärjelse mot den närmaste som syns, när ingen står intill.
 * Returnerar true om en besvärjelse lades (då är turen slut). Annars strider fienden som vanligt.
 */
export function enemyCast(g: Game, a: Actor): boolean {
  if (isParty(a) || !a.spells?.length || g.state.mode !== 'combat') return false;
  const c = g.state.combat!;
  const cast = (c.cast ??= {});
  const done = cast[a.id] ?? [];
  const known = a.spells.filter((id) => SPELLS[id]?.effect && !SPELLS[id].ritual);
  const attempt = (id: string, grade: number, target: Actor): boolean => {
    if (grade < 1) return false;
    const o: CastOptions = { grade, target: target.id, caster: a };
    if (castProblem(g, id, o)) return false;
    cast[a.id] = [...done, id];
    castSpell(g, id, o);
    return true;
  };
  const allies = g.state.actors.filter((x) => x.alive && !x.fled && !isParty(x) && !x.elemental && x.hostile === a.hostile && (x === a || g.canSee(a, x)));
  const foes = g.state.actors
    .filter((x) => x.alive && !x.fled && isParty(x) && !unseen(a, x) && !x.unconscious && g.canSee(a, x))
    .sort((l, r) => distance(a.x, a.y, l.x, l.y) - distance(a.x, a.y, r.x, r.y));
  if (!foes.length) return false;
  const adjacent = distance(a.x, a.y, foes[0].x, foes[0].y) <= 1;

  for (const id of known.filter((x) => SPELLS[x].effect!.kind === 'läka')) {
    const hurt = allies.filter((x) => x.kp <= x.maxKp / 2).sort((l, r) => l.kp / l.maxKp - r.kp / r.maxKp)[0];
    if (hurt && attempt(id, aiGrade(a, id, Math.ceil((hurt.maxKp - hurt.kp) / 3.5)), hurt)) return true;
  }

  for (const id of known) {
    const e = SPELLS[id].effect!;
    if (e.kind === 'skydd' && !hasEffect(a, 'skydd') && attempt(id, e.fixed ? 1 : aiGrade(a, id, 2), a)) return true;
    if (e.kind === 'vapen' && e.sign > 0 && !hasEffect(a, 'vapenMagi') && attempt(id, aiGrade(a, id, 2), a)) return true;
    if (e.kind === 'luftsköld' && adjacent && !hasEffect(a, 'luftsköld') && !done.includes(id) && attempt(id, 1, a)) return true;
  }

  if (!adjacent) {
    const order = ['skada', 'köld', 'rankor'];
    const harmful = known.filter((x) => order.includes(SPELLS[x].effect!.kind)).sort((l, r) => order.indexOf(SPELLS[l].effect!.kind) - order.indexOf(SPELLS[r].effect!.kind));
    for (const id of harmful) {
      const targets = spellTargets(g, id, 0, a);
      const t = foes.find((f) => targets.includes(f));
      const kind = SPELLS[id].effect!.kind;
      const want = kind === 'skada' ? 3 : kind === 'rankor' ? (t ? Math.ceil(t.attrs.STO / 10) : 1) : 1;
      if (t && attempt(id, aiGrade(a, id, want), t)) return true;
    }
  }
  return false;
}

// ------------------------------------------------------------------ DIMMA och BESKYDDARE

/** DIMMA täcker en cirkel med den här radien kring målet (tolkning). */
const FOG_RADIUS = 10;

/** Finns det vatten inom `r` rutor (DIMMA)? */
function waterWithin(g: Game, at: { x: number; y: number }, r: number): boolean {
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      const x = at.x + dx;
      const y = at.y + dy;
      if (x >= 0 && y >= 0 && x < g.map.w && y < g.map.h && tileAt(g.map, x, y).name === 'vatten') return true;
    }
  return false;
}

/**
 * BESKYDDARE: den som går in i fältet träffas av en ENERGISTRÅLE E1 (1T3 i detaljerad strid, annars
 * 1T6, mot en kroppsdel). Magikern själv kan gå in och ut. Anropas när någon har flyttat sig och i
 * början av varje runda.
 */
export function wardCheck(g: Game) {
  for (const z of activeZonesOf(g, 'beskyddare')) {
    const now = g.state.actors.filter((x) => x.alive && !x.fled && distance(x.x, x.y, z.x, z.y) <= z.r).map((x) => x.id);
    const entered = now.filter((id) => !(z.inside ?? []).includes(id) && id !== z.caster);
    z.inside = now;
    for (const id of entered) {
      const a = g.actor(id)!;
      const dice = a.detailed ? '1T3' : '1T6';
      const dmg = Math.max(0, roll(dice, g.rng));
      const loc = a.detailed ? lookup(HIT_TABLE.avstånd, die(20, g.rng))! : null;
      const abs = (loc ? (armorPiece(a, loc)?.abs ?? 0) : 0) + a.naturalArmor + magicArmor(a);
      const dealt = Math.max(0, dmg - abs);
      g.log(`${a.name} går in i det skyddande fältet och träffas av en energistråle: ${dealt} i skada${loc ? ` i ${loc}` : ''}${abs ? ` (${dmg} − ${abs} i skydd)` : ''}.`);
      g.emit(a.id, dealt ? `-${dealt}` : '0', 'damage');
      wound(g, a, dealt, loc);
    }
  }
}

function activeZonesOf(g: Game, kind: 'beskyddare') {
  return (g.state.zones ?? []).filter((z) => z.kind === kind && (!z.map || z.map === g.state.mapId) && z.until > g.state.time);
}
