import { SKILLS } from '../data/skills';
import { SPELLS, spellRange } from '../data/spells';
import type { SpellDef, SpellDuration } from '../data/types';
import { die, roll } from './dice';
import type { Game } from './game';
import { ironProblem } from './inventory';
import { distance, lineOfSight } from './map';
import { neutralize } from './poison';
import {
  armorPiece,
  canAct,
  finishTurn,
  hasEffect,
  kill,
  magicArmor,
  skillMod,
  unequip,
  wound,
} from './combat';
import {
  attributeCheck,
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
import type { ActiveEffect, Actor, PendingSpell } from './types';
import { advanceTime } from './time';
import { dissolve, spellVersusElemental, summonOrBanish, summonProblem } from './elementals';

/**
 * Magi enligt Bok III s. 3–8 med Vidars husregler (docs/regelbeslut.md under Magi). Bara
 * rollpersonen lägger besvärjelser än så länge.
 */

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
}

/** Räckvidd i rutor (null = obegränsad inom synhåll, 0 = bara en själv). */
export function rangeSquares(g: Game, a: Actor, spell: SpellDef, extra = 0): number {
  if (spell.range === 'personlig') return 0;
  if (spell.range === 'beröring') return 1;
  if (spell.range === 'särskild') return Math.floor((a.attrs.STY + a.attrs.SMI) / 2);
  const r = spellRange(spell.range, spellS(a, spell.id), extra);
  if (!r) return 0;
  return r.unit === 'km' ? 9999 : r.value;
}

/** Möjliga mål för en besvärjelse. */
export function spellTargets(g: Game, id: string, extraRange = 0): Actor[] {
  const p = g.player;
  const spell = SPELLS[id];
  if (!spell) return [];
  const range = rangeSquares(g, p, spell, extraRange);
  const near = g.state.actors.filter(
    (a) => a.alive && !a.fled && a !== p && g.isVisible(a.x, a.y) && distance(p.x, p.y, a.x, a.y) <= range && lineOfSight(g.map, p.x, p.y, a.x, a.y),
  );
  switch (spell.aim) {
    case 'själv':
      return [p];
    case 'fiende':
      return near.filter((a) => a.hostile || a.kind === 'npc');
    case 'närmast': {
      const d = Math.min(...near.map((a) => distance(p.x, p.y, a.x, a.y)));
      return near.filter((a) => distance(p.x, p.y, a.x, a.y) === d);
    }
    default:
      return [p, ...near];
  }
}

/** Varför besvärjelsen inte kan läggas nu, eller null. */
export function castProblem(g: Game, id: string, o: CastOptions): string | null {
  const p = g.player;
  const ch = g.char;
  const spell = SPELLS[id];
  if (p.elemental) return 'En elementar lägger inga besvärjelser.';
  if (!spell || !ch.spells.includes(id)) return 'Du kan inte den besvärjelsen.';
  if (!spell.effect) return `${spell.name} verkar inte i spelet än.`;
  if (spell.ritual) return 'Ritualer tar timmar och kan inte läggas här.';
  if (!canAct(p) || p.down || p.kp <= 1 || hasEffect(p, 'håller')) return 'Du kan inte lägga besvärjelser nu.';
  if (hasEffect(p, 'stum')) return 'Du kan inte använda magi just nu.';
  const iron = ironProblem(g);
  if (iron) return `Järnet stör magin: ${iron}`;
  const memorized = ch.memorized.includes(id);
  if (g.state.mode === 'combat') {
    const c = g.state.combat!;
    if (!g.isPlayerTurn() || c.acted[p.id]) return 'Det är inte din tur.';
    if ((p.movedLast ?? 0) > 0) return 'Att lägga en besvärjelse tar hela rundan; du har redan flyttat dig.';
    if (!memorized && !spell.quick) return 'Bara kvicka besvärjelser hinner läsas ur formelsamlingen i strid.';
  } else if (g.state.mode !== 'explore') return 'Du kan inte lägga besvärjelser nu.';
  const total = o.grade + (o.extraRange ?? 0) + (o.extraDuration ?? 0);
  if (o.grade < 1) return 'Effektgraden måste vara minst 1.';
  if (total > maxGrade(p, id)) return `Högsta effektgrad är E${maxGrade(p, id)} (FV i skolan).`;
  if (o.suicide) {
    if (p.psy <= 0) return 'Du har ingen kraft kvar att offra.';
    if (total > suicideBudget(p.psy, p.attrs.PSY)) return `Du kan offra högst ${suicideBudget(p.psy, p.attrs.PSY)} PSY.`;
  } else if (total >= p.psy) return `Du har bara ${p.psy} PSY kvar. Når PSY 0 dör du.`;
  if (spell.aim !== 'själv') {
    const t = o.target ? g.actor(o.target) : undefined;
    if (!t || !spellTargets(g, id, o.extraRange).includes(t)) return 'Välj ett mål inom räckhåll som du ser.';
    if (spell.effect.kind === 'elementar') return summonProblem(g, p, spell.effect.element, t);
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
  const p = g.player;
  const spell = SPELLS[id];
  const ch = g.char;
  const memorized = ch.memorized.includes(id);
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
  };
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
      g.log(`${p.name} börjar lägga ${spell.name} E${totalGrade(pending)}. Den verkar i början av nästa runda.`);
    }
    if (g.state.mode === 'combat') finishTurn(g);
  } else {
    if (!memorized) {
      const secs = spell.quick ? roll(BOOK_CAST.quickRounds, g.rng) * ROUND_SECONDS : roll(BOOK_CAST.normalMinutes, g.rng) * 60;
      advanceTime(g, secs, 'aktiv');
      g.log(`${p.name} läser ${spell.name} ur formelsamlingen.`);
    } else if (!spell.quick) advanceTime(g, ROUND_SECONDS, 'aktiv');
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
  const check = skillCheck(S, g.rng, cl - S + skillMod(g, a, `spell:${s.spell}`));
  let cost = spellPsyCost(total, check.result);
  const half = a.effects.find((e) => e.kind === 'halvPsy');
  if (half && check.result !== 'misslyckat') {
    cost = Math.max(1, Math.floor(cost / 2));
    a.effects = a.effects.filter((e) => e !== half);
  }
  a.psy -= cost;
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
    apply(g, a, s, s.grade, check);
  }
  if (a.psy <= 0 && a.alive) {
    g.log(s.suicide ? `${a.name} har gett allt och faller död ned.` : `${a.name} har tömt sin själ på kraft och dör.`);
    kill(g, a);
  }
}

// ------------------------------------------------------------------ verkan

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
  const check = resistance(Math.max(0, caster.psy), t.attrs.PSY, g.rng);
  if (check.success) return false;
  g.log(`${t.name} gör motstånd (PSY ${caster.psy} mot ${t.attrs.PSY}, T20: ${check.roll} mot ${check.target}).`);
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
      const detailed = t.detailed && e.detailedDice ? e.detailedDice : e.dice;
      const dmg = perfect ? maxDice(detailed, grade) : sumDice(detailed, grade, g);
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
      const dealt = Math.max(0, dmg - abs) * factor;
      g.log(`${t.name} tar ${dealt} i skada${loc ? ` i ${loc}` : ''}${abs ? ` (${dmg} − ${abs} i skydd)` : ''}${factor === 2 ? ' – dubbel skada' : factor === 0 ? ' – elementaren är immun' : ''}.`);
      g.emit(t.id, dealt ? `-${dealt}` : '0', 'damage');
      provoke(g, t);
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
          if (x !== caster) provoke(g, x);
          wound(g, x, dmg, null);
        }
        // Alla som ser explosionen bländas nästa runda.
        if (x.alive && !x.unconscious && distance(x.x, x.y, s.x, s.y) <= x.sight && lineOfSight(g.map, x.x, x.y, s.x, s.y)) {
          x.effects.push({ kind: 'blind', label: 'Bländad av explosionen', rounds: 2 });
        }
      }
      return;
    }
    case 'köld': {
      const fys = attributeCheck(t.attrs.FYS + t.naturalArmor, g.rng, 'Svårt');
      if (fys.success) {
        t.effects.push({ kind: 'cl', label: 'Köldrysningar', mod: -4, scope: 'alla', rounds: 1 });
        g.log(`${t.name} skakar av köld men står emot (Svårt FYS-slag, T20: ${fys.roll} mot ${fys.target}): −4 på CL rundan ut.`);
      } else {
        t.effects.push({ kind: 'ingenHandling', label: 'Skakar av köld', rounds: 1 });
        g.log(`${t.name} skakar av kraftiga köldrysningar och kan inte göra något (Svårt FYS-slag, T20: ${fys.roll} mot ${fys.target}).`);
      }
      provoke(g, t);
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
      provoke(g, t);
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
      if (e.sign < 0) provoke(g, t);
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
          t.effects = t.effects.filter((y) => y !== x);
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
    case 'rankor': {
      const need = Math.ceil(t.attrs.STO / 10);
      if (grade < need) {
        g.log(`Rankorna räcker inte till för ${t.name} (det krävs E${need}).`);
        return;
      }
      const value = grade * 10 - t.attrs.STO;
      t.effects.push({ kind: 'rankor', mod: value, ...effectFor(caster, spell, s, grade, g) });
      g.log(`Rankor växer ut och snärjer ${t.name} (motståndsvärde ${value}).`);
      provoke(g, t);
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
function provoke(g: Game, t: Actor) {
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
