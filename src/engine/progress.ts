/**
 * Veckorna mellan äventyren (steg 8): träning med lärare, ensamträning, studier i magiakademins
 * bibliotek, böcker, arbete och vila, en vecka i taget för var och en i gruppen. Reglerna följer
 * Bok I s. 62–63 och Bok III s. 7 med Vidars husregler (docs/regelbeslut.md under Utveckling
 * mellan äventyren).
 */
import { BOOKS, CITY, NPCS, type BookDef } from '../content';
import { PROFESSIONS } from '../data/professions';
import { RACES } from '../data/races';
import { SKILLS } from '../data/skills';
import { SPELLS } from '../data/spells';
import type { Game } from './game';
import { schoolFv, schoolKey } from './magic';
import { attributeCheck, bLevel, DAY, TRAINING, WORK_WAGES, type Check } from './rules';
import { advanceTime, bestFv, easePhobias, needsTeacher, skillCap } from './time';
import type { Actor, AttrKey, Character } from './types';

/** Vad en gruppmedlem gör under veckan. `skill` kan vara "spell:<id>" för en besvärjelse. */
export type WeekActivity =
  | { kind: 'vila' }
  | { kind: 'ensam'; skill: string }
  | { kind: 'lärare'; teacher: string; skill: string }
  | { kind: 'bibliotek'; skill: string }
  | { kind: 'bok'; book: string }
  | { kind: 'arbete'; skill?: string };

export type WeekPlan = Record<string, WeekActivity>;

/** En lärare: en person i modulen, en följeslagare eller en av stadens lärare. */
export interface Teacher {
  id: string;
  name: string;
  race: string;
  int: number;
  /** FV per färdighet, eller samma FV i alla (stadens lärare). */
  skills: Record<string, number> | number;
  /** 'bara' = bara magi, 'ingen' = ingen magi, 'också' = det hen kan. */
  magic: 'bara' | 'ingen' | 'också';
  /** Följeslagare undervisar gratis. */
  free: boolean;
  /** Figuren, för personer och följeslagare. */
  actorId?: string;
}

const LS = 'las_skriv_modersmal';
const isSpell = (skill: string) => skill.startsWith('spell:');
const isMagic = (skill: string) => isSpell(skill) || skill.startsWith('magiskola:');
const spellOf = (skill: string) => SPELLS[skill.slice('spell:'.length)];

/** Grundegenskapen som träningsslaget slås för. */
export function trainingAttr(skill: string): AttrKey {
  if (isMagic(skill)) return 'INT';
  const def = SKILLS[skill.split(':')[0]];
  return def && def.attr !== 'spec' ? def.attr : 'INT';
}

/** Mellan äventyren: gruppen är i staden. */
export const inCity = (g: Game) => g.state.mode === 'ended';

/** Kan gruppen planera en vecka just nu? Mellan äventyren, eller i lugn och ro i en modul. */
export function weekProblem(g: Game): string | null {
  if (inCity(g)) return null;
  if (g.state.mode !== 'explore') return 'Det går inte nu.';
  if (!g.canRest()) return 'Ni behöver lugn och ro, utan fiender i sikte.';
  return null;
}

// ------------------------------------------------------------------ lärare

/** Lärarna som finns: stadens mellan äventyren, annars personerna på kartan. Följeslagarna alltid. */
export function teachers(g: Game): Teacher[] {
  const out: Teacher[] = [];
  if (inCity(g)) {
    for (const t of CITY.teachers) out.push({ id: t.id, name: t.name, race: t.race, int: t.int, skills: t.fv, magic: t.magic ? 'bara' : 'ingen', free: false });
  } else {
    for (const a of g.state.actors) {
      const def = a.npc ? NPCS[a.npc] : undefined;
      if (!def?.teaches?.length || !a.alive || a.hostile || g.state.party.includes(a.id)) continue;
      out.push({
        id: a.id,
        name: a.name,
        race: def.race ?? 'manniska',
        int: a.attrs.INT,
        skills: Object.fromEntries(def.teaches.map((k) => [k, a.skills[k] ?? 0])),
        magic: 'också',
        free: false,
        actorId: a.id,
      });
    }
  }
  for (const m of g.partyMembers()) {
    const ch = g.charOf(m);
    if (ch) out.push({ id: m.id, name: m.name, race: ch.race, int: m.attrs.INT, skills: m.skills, magic: 'också', free: true, actorId: m.id });
  }
  return out;
}

export const teacherById = (g: Game, id: string) => teachers(g).find((t) => t.id === id);

/** Lärarens FV i en färdighet. För en besvärjelse: FV i dess skola. */
export function teacherFv(g: Game, t: Teacher, skill: string): number {
  if (typeof t.skills === 'number') return t.skills;
  if (isSpell(skill)) {
    const actor = t.actorId ? g.actor(t.actorId) : undefined;
    const spell = spellOf(skill);
    if (!actor || !spell) return 0;
    const key = schoolKey(actor, spell);
    return key ? (t.skills[key] ?? 0) : 0;
  }
  return t.skills[skill] ?? 0;
}

/** Varför läraren inte kan lära eleven färdigheten (eller besvärjelsen), eller null. */
export function teachProblem(g: Game, student: Actor, t: Teacher, skill: string): string | null {
  if (t.actorId === student.id) return 'Man kan inte vara sin egen lärare.';
  if (t.magic === 'bara' && !isMagic(skill)) return `${t.name} undervisar bara i magi.`;
  if (t.magic === 'ingen' && isMagic(skill)) return `${t.name} undervisar inte i magi.`;
  const fv = teacherFv(g, t, skill);
  if (fv < TRAINING.teacherFv) return `Läraren behöver FV ${TRAINING.teacherFv} (${t.name} har ${fv}).`;
  if (t.int < TRAINING.teacherInt) return `Läraren behöver INT ${TRAINING.teacherInt} (${t.name} har ${t.int}).`;
  if (isSpell(skill)) {
    const spell = spellOf(skill);
    if (!spell) return 'Okänd besvärjelse.';
    const ch = g.charOf(student)!;
    if (ch.spells.includes(spell.id)) return `${student.name} kan redan ${spell.name}.`;
    if (schoolFv(student, spell) < spell.sv) return `Det krävs FV ${spell.sv} i skolan för att lära sig ${spell.name}.`;
    if (fv < spell.sv) return `${t.name} kan inte ${spell.name}.`;
    const tch = t.actorId ? g.charOf(g.actor(t.actorId)) : undefined;
    if (t.actorId && !tch?.spells.includes(spell.id)) return `${t.name} kan inte ${spell.name}.`;
    return null;
  }
  const own = student.skills[skill] ?? 0;
  if (fv <= own + TRAINING.teacherMargin) return `Läraren måste ha mer än ${TRAINING.teacherMargin} högre FV än eleven (${fv} mot ${own}).`;
  if (own + 1 > skillCap(g, student, skill)) return 'FV kan inte bli högre.';
  if (skill.startsWith('magiskola:') && !student.skills[skill] && !['magiker', 'utbygdsjagare'].includes(g.charOf(student)!.profession)) return 'Bara magiker och utbygdsjägare kan lära sig magi.';
  return null;
}

/** Kostnaden för en elev en vecka (Bok I): 150 sm (300 för magi), ×1,5 för annan ras, ×3 för ensam elev. */
export function teacherCost(t: Teacher, student: Character, skill: string, alone: boolean): number {
  if (t.free) return 0;
  let cost = isMagic(skill) ? TRAINING.magicTeacherCost : TRAINING.teacherCost;
  if (student.race !== t.race) cost *= TRAINING.otherRaceFactor;
  if (alone) cost *= TRAINING.aloneFactor;
  return Math.ceil(cost);
}

/** Tillägget på träningsslaget: +1 per FV över 18 hos läraren och +5 för en ensam elev. */
export function teacherBonus(fv: number, alone: boolean): number {
  return Math.max(0, fv - TRAINING.teacherBonusFrom) + (alone ? TRAINING.aloneBonus : 0);
}

// ------------------------------------------------------------------ böcker och biblioteket

/** Böckerna i gruppens packning. Gruppen delar på böckerna (tolkning). */
export function groupBooks(g: Game): BookDef[] {
  const ids = new Set(g.partyMembers().flatMap((m) => g.charOf(m)?.inventory ?? []));
  return [...ids].filter((id) => BOOKS[id]).map((id) => BOOKS[id]);
}

/** Läsnivån som boken kräver (B1–B5): magiska skrifter B4, annars efter bokens tak i EP (Vidar). */
export function readLevel(book: BookDef): number {
  if (book.readLevel) return book.readLevel;
  if (book.spell) return TRAINING.magicReading;
  return TRAINING.readingLevels.find((r) => (book.maxEp ?? 0) <= r.maxEp)?.level ?? TRAINING.readingTop;
}

/** Läsnivån (B0–B5) i ett språk, eller i modersmålet om inget språk anges. */
export function readingLevelOf(a: Actor, language?: string): number {
  if (!language) return bLevel(bestFv(a, LS));
  const keys = [`${LS}:${language}`, `las_skriv_frammande:${language}`];
  return bLevel(Math.max(0, ...keys.map((k) => a.skills[k] ?? 0)));
}

/** Varför hen inte kan läsa skriften, eller null. */
function readingProblem(a: Actor, level: number, language?: string): string | null {
  if (readingLevelOf(a, language) >= level) return null;
  return `Det krävs B${level} i Läsa/Skriva${language ? ` (${language})` : ''}, och ${a.name} har B${readingLevelOf(a, language)}.`;
}

/** Varför hen inte kan studera boken, eller null. */
export function bookProblem(g: Game, a: Actor, book: BookDef): string | null {
  const ch = g.charOf(a)!;
  if (!groupBooks(g).includes(book)) return 'Boken finns inte i packningen.';
  const reading = readingProblem(a, readLevel(book), book.language);
  if (reading) return reading;
  if (book.spell) return codexProblem(g, a, book.spell);
  if (!book.skill) return 'Boken lär inte ut något.';
  if ((ch.studied?.[book.id] ?? 0) >= (book.maxEp ?? 0)) return `${a.name} har lärt sig allt som står i boken.`;
  const fv = a.skills[book.skill] ?? 0;
  if (fv + 1 > skillCap(g, a, book.skill)) return 'FV kan inte bli högre.';
  return null;
}

/** Varför hen inte kan studera besvärjelsen ur en kodex, eller null. */
export function codexProblem(g: Game, a: Actor, spellId: string): string | null {
  const ch = g.charOf(a)!;
  const spell = SPELLS[spellId];
  if (!spell) return 'Okänd besvärjelse.';
  if (ch.spells.includes(spellId)) return `${a.name} kan redan ${spell.name}.`;
  if (schoolFv(a, spell) < spell.sv) return `Det krävs FV ${spell.sv} i skolan för att lära sig ${spell.name}.`;
  return null;
}

/** Varför hen inte kan studera i magiakademins bibliotek, eller null. */
export function libraryProblem(g: Game, a: Actor, skill: string): string | null {
  const ch = g.charOf(a)!;
  if (!inCity(g)) return 'Det finns inget magibibliotek här.';
  if (!ch.academy) return `${a.name} är inte medlem i ${CITY.academy}.`;
  // Bibliotekets magiska skrifter kräver B4 i Läsa/Skriva (Vidar).
  const reading = readingProblem(a, TRAINING.magicReading);
  if (reading) return reading;
  if (isSpell(skill)) return codexProblem(g, a, skill.slice('spell:'.length));
  if (!skill.startsWith('magiskola:')) return 'Biblioteket har bara magiska skrifter.';
  if (a.skills[skill] === undefined) return `${a.name} kan inte den skolan.`;
  if ((a.skills[skill] ?? 0) + 1 > skillCap(g, a, skill)) return 'FV kan inte bli högre.';
  return null;
}

/** Blir medlem i magiakademin för 1 000 sm (Vidar). Rollpersonen betalar. */
export function joinAcademy(g: Game, a: Actor): string | null {
  const ch = g.charOf(a);
  if (!ch) return 'Bara rollpersoner kan bli medlemmar.';
  if (!inCity(g)) return 'Akademin finns i staden.';
  if (ch.academy) return `${a.name} är redan medlem.`;
  if (g.leader.silver < TRAINING.academyFee) return `Medlemskapet kostar ${TRAINING.academyFee} sm.`;
  g.leader.silver -= TRAINING.academyFee;
  ch.academy = true;
  g.log(`${a.name} blir medlem i ${CITY.academy} för ${TRAINING.academyFee} sm och får använda biblioteket.`);
  return null;
}

// ------------------------------------------------------------------ veckan

/** Varför en sysselsättning inte går, eller null. */
export function activityProblem(g: Game, a: Actor, act: WeekActivity, plan: WeekPlan = {}): string | null {
  const ch = g.charOf(a);
  if (!ch) return 'Bara rollpersoner tränar.';
  switch (act.kind) {
    case 'vila':
      return null;
    case 'ensam':
      if (isSpell(act.skill)) return 'En besvärjelse lär man sig av en lärare eller ur en kodex.';
      if (needsTeacher(act.skill)) return 'Magiskolor tränas med lärare eller i ett magibibliotek.';
      if (SKILLS[act.skill.split(':')[0]] === undefined) return 'Okänd färdighet.';
      return (a.skills[act.skill] ?? 0) + 1 > skillCap(g, a, act.skill) ? 'FV kan inte bli högre.' : null;
    case 'lärare': {
      const t = teacherById(g, act.teacher);
      if (!t) return 'Läraren finns inte här.';
      return teachProblem(g, a, t, act.skill);
    }
    case 'bibliotek':
      return libraryProblem(g, a, act.skill);
    case 'bok':
      return BOOKS[act.book] ? bookProblem(g, a, BOOKS[act.book]) : 'Okänd bok.';
    case 'arbete':
      if (!inCity(g)) return 'Arbete finns mellan äventyren.';
      if (act.skill && !ch.profSkills.includes(act.skill)) return 'Deltidsträningen gäller en yrkesfärdighet.';
      if (act.skill && (a.skills[act.skill] ?? 0) + 1 > skillCap(g, a, act.skill)) return 'FV kan inte bli högre.';
      return null;
  }
}

/** Gruppmedlemmen undervisar någon den här veckan. */
export function isTeaching(g: Game, plan: WeekPlan, id: string): boolean {
  return Object.entries(plan).some(([sid, act]) => sid !== id && act.kind === 'lärare' && teacherById(g, act.teacher)?.actorId === id);
}

/** Elever per lärare och färdighet: den som är ensam får +5 men betalar tre gånger så mycket. */
function classSize(plan: WeekPlan, act: WeekActivity): number {
  if (act.kind !== 'lärare') return 0;
  return Object.values(plan).filter((x) => x.kind === 'lärare' && x.teacher === act.teacher && x.skill === act.skill).length;
}

/** Vad veckan kostar gruppen: kost och logi för alla och lärarnas arvoden. */
export function weekCost(g: Game, plan: WeekPlan): number {
  let cost = 0;
  for (const m of g.partyMembers()) {
    const ch = g.charOf(m);
    if (!ch) continue;
    cost += TRAINING.weekCost;
    const act = plan[m.id];
    if (act?.kind === 'lärare') {
      const t = teacherById(g, act.teacher);
      if (t) cost += teacherCost(t, ch, act.skill, classSize(plan, act) === 1);
    }
  }
  return cost;
}

/** Veckolönen för arbete i yrket: sex dagar. */
export function weekWage(ch: Character): number {
  return (WORK_WAGES[ch.profession] ?? 10) * TRAINING.workDays;
}

/** Varför veckan inte kan börja, eller null. */
export function planProblem(g: Game, plan: WeekPlan): string | null {
  const w = weekProblem(g);
  if (w) return w;
  for (const m of g.partyMembers()) {
    const act = plan[m.id] ?? { kind: 'vila' };
    const p = activityProblem(g, m, act, plan);
    if (p) return `${m.name}: ${p}`;
  }
  const cost = weekCost(g, plan);
  if (g.leader.silver < cost) return `Veckan kostar ${cost} sm, men ni har bara ${g.leader.silver}.`;
  return null;
}

const label = (skill: string) => (isSpell(skill) ? spellOf(skill)?.name ?? skill : SKILLS[skill.split(':')[0]]?.name ?? skill) + (skill.includes(':') && !isSpell(skill) ? ` (${skill.split(':')[1]})` : '');

/** Ett träningsslag: Normalt grundegenskapsslag med tillägg (positivt = lättare). */
function trainingRoll(g: Game, a: Actor, skill: string, bonus = 0): Check {
  return attributeCheck(a.attrs[trainingAttr(skill)], g.rng, 10 - bonus);
}

function addEp(a: Actor, skill: string, n: number) {
  if (n > 0) a.ep[skill] = (a.ep[skill] ?? 0) + n;
}

/** Lär sig en besvärjelse ur en kodex: Normalt INT-slag med −1 per poäng INT under 19 (Bok III). */
function codexRoll(g: Game, a: Actor, spellId: string, source: string): string {
  const pen = Math.max(0, TRAINING.codexInt - a.attrs.INT);
  const check = attributeCheck(a.attrs.INT, g.rng, 10 + pen);
  const spell = SPELLS[spellId];
  if (check.success) g.charOf(a)!.spells.push(spellId);
  return `${a.name} studerar ${spell.name} ${source} (INT-slag, T20: ${check.roll} mot ${check.target}): ${check.success ? 'besvärjelsen skrivs in i formelsamlingen' : 'inte än'}.`;
}

/**
 * En vecka för hela gruppen: kost, logi och lärare betalas, tiden går (som vila), och var och en
 * gör det som planerats. Returnerar raderna till loggen, eller ett fel.
 */
export function runWeek(g: Game, plan: WeekPlan): { lines: string[] } | { problem: string } {
  const problem = planProblem(g, plan);
  if (problem) return { problem };
  const cost = weekCost(g, plan);
  const members = g.partyMembers().filter((m) => g.charOf(m));
  g.leader.silver -= cost;
  advanceTime(g, 7 * DAY, 'sömn');
  const lines: string[] = [`En vecka går. Kost, logi och lärare kostar ${cost} sm.`];
  for (const a of members) {
    const ch = g.charOf(a)!;
    const act = plan[a.id] ?? { kind: 'vila' };
    switch (act.kind) {
      case 'vila':
        lines.push(`${a.name} vilar.`);
        break;
      case 'ensam': {
        const c = trainingRoll(g, a, act.skill);
        if (c.success) addEp(a, act.skill, 1);
        lines.push(`${a.name} tränar ${label(act.skill)} på egen hand (${trainingAttr(act.skill)}-slag, T20: ${c.roll} mot ${c.target}): ${c.success ? '1 EP' : 'bortkastad vecka'}.`);
        break;
      }
      case 'lärare': {
        const t = teacherById(g, act.teacher)!;
        const alone = classSize(plan, act) === 1;
        if (isSpell(act.skill)) {
          ch.spells.push(spellOf(act.skill).id);
          lines.push(`${t.name} lär ${a.name} ${label(act.skill)}. Den skrivs in i formelsamlingen.`);
          break;
        }
        const bonus = teacherBonus(teacherFv(g, t, act.skill), alone);
        const rolls = Array.from({ length: TRAINING.teacherRolls }, () => trainingRoll(g, a, act.skill, bonus));
        const n = rolls.filter((c) => c.success).length;
        addEp(a, act.skill, n);
        lines.push(`${a.name} tränar ${label(act.skill)} för ${t.name}${alone ? ' (ensam elev)' : ''} (T20: ${rolls.map((c) => c.roll).join(' och ')} mot ${rolls[0].target}): ${n} EP.`);
        break;
      }
      case 'bibliotek': {
        if (isSpell(act.skill)) {
          lines.push(codexRoll(g, a, act.skill.slice('spell:'.length), `ur en kodex i ${CITY.academy}s bibliotek`));
          break;
        }
        const c = trainingRoll(g, a, act.skill);
        if (c.success) addEp(a, act.skill, 1);
        lines.push(`${a.name} studerar ${label(act.skill)} i biblioteket (INT-slag, T20: ${c.roll} mot ${c.target}): ${c.success ? '1 EP' : 'bortkastad vecka'}.`);
        break;
      }
      case 'bok': {
        const book = BOOKS[act.book];
        if (book.spell) {
          lines.push(codexRoll(g, a, book.spell, `ur ${book.name}`));
          break;
        }
        const c = trainingRoll(g, a, book.skill!);
        if (c.success) {
          addEp(a, book.skill!, 1);
          (ch.studied ??= {})[book.id] = (ch.studied[book.id] ?? 0) + 1;
        }
        const left = (book.maxEp ?? 0) - (ch.studied?.[book.id] ?? 0);
        lines.push(`${a.name} läser ${book.name} (${trainingAttr(book.skill!)}-slag, T20: ${c.roll} mot ${c.target}): ${c.success ? `1 EP i ${label(book.skill!)}` : 'inget nytt'}${left > 0 ? '' : '. Boken har inget mer att lära ut'}.`);
        break;
      }
      case 'arbete': {
        const wage = weekWage(ch);
        g.leader.silver += wage;
        let extra = '';
        if (act.skill) {
          const weeks = ((ch.partTime ??= {})[act.skill] ?? 0) + 1;
          if (weeks >= TRAINING.partTimeWeeks) {
            delete ch.partTime[act.skill];
            const c = trainingRoll(g, a, act.skill);
            if (c.success) addEp(a, act.skill, 1);
            extra = ` Deltidsträningen i ${label(act.skill)} (T20: ${c.roll} mot ${c.target}): ${c.success ? '1 EP' : 'inget'}.`;
          } else {
            ch.partTime[act.skill] = weeks;
            extra = ` Deltidsträning i ${label(act.skill)}: halvvägs till nästa slag.`;
          }
        }
        lines.push(`${a.name} arbetar som ${PROFESSIONS[ch.profession].name.toLowerCase()} och tjänar ${wage} sm.${extra}`);
        break;
      }
    }
    // Vidar: en följeslagare som undervisar hinner också med sin egen sysselsättning.
    if (isTeaching(g, plan, a.id)) lines.push(`${a.name} undervisar också andra i gruppen.`);
  }
  easePhobias(g);
  for (const l of lines) g.log(l);
  g.changed();
  return { lines };
}

/** Rasens namn, för texter. */
export const raceName = (id: string) => RACES[id]?.name ?? id;
