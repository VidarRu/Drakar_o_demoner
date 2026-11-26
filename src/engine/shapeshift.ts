/**
 * Hamnbytare (Bok I, särskild förmåga 78): personen förvandlar sig till ett djur (1T6: varg, björn,
 * hök, hjort, svan, katt). Förvandlingen tar 1 SR och varar så länge personen vill. Hen får djurets
 * alla egenskaper utom INT och INT-baserade färdigheter (men inga besvärjelser). För varje timme
 * över sitt PSY-värde slår hen ett Normalt PSY-slag; misslyckas det fastnar hen i hamnen för alltid.
 * Tolkningarna står i docs/regelbeslut.md under Hamnbytare.
 */
import { CREATURES as CREATURE_STATS } from '../data/creatures';
import { SKILLS } from '../data/skills';
import type { NaturalAttack } from '../data/types';
import { canAct, finishTurn, tick, wound } from './combat';
import { die } from './dice';
import type { Game } from './game';
import { abilitiesOf } from './hero';
import { attributeCheck, damageBonus, HAMN, HIT_LOCATIONS, maxKp } from './rules';
import type { Actor } from './types';

/** Djuret i hamnen, eller null för den som inte är hamnbytare. Det slås första gången (1T6). */
export function shapeOf(g: Game, a: Actor): number | null {
  const ch = g.charOf(a);
  if (!ch || a.elemental) return null;
  const ab = abilitiesOf(ch).find((x) => x.def.id === 'hamnbytare');
  if (!ab) return null;
  if (ab.choice?.animal === undefined) {
    const n = die(6, g.rng) - 1;
    const target = ch.ability?.id === 'hamnbytare' ? ch.ability : ch.heroAbilities?.find((h) => h.id === 'hamnbytare');
    if (target) target.choice = { ...((target.choice as object) ?? {}), animal: n };
    g.log(`${a.name}s djurhamn är en ${HAMN[n].name} (1T6: ${n + 1}).`);
    return n;
  }
  return ab.choice.animal;
}

/** Djurets bästa anfall: högst FV gånger skada. */
export function shapeAttack(a: Actor): NaturalAttack | null {
  if (!a.shape) return null;
  const st = CREATURE_STATS[HAMN[a.shape.animal].stats];
  return [...st.attacks].sort((x, y) => y.fv - x.fv)[0] ?? null;
}

/** Hamnens fart i luften (hök och svan), eller null. */
export function shapeFlight(a: Actor): number | null {
  if (!a.shape) return null;
  return CREATURE_STATS[HAMN[a.shape.animal].stats].move.F ?? null;
}

/** Kan hamnen simma (svan)? */
export const shapeSwims = (a: Actor) => !!a.shape && !!CREATURE_STATS[HAMN[a.shape.animal].stats].move.S;

export function shapeProblem(g: Game, a: Actor): string | null {
  // Den som har blivit djur genom HAMNSKIFTARE kan bli människa igen utan förmågan.
  if (!a.shape && shapeOf(g, a) === null) return 'Du är ingen hamnbytare.';
  if (a.shape && g.charOf(a)?.stuckInShape) return 'Du har fastnat i din djurhamn för alltid.';
  if (!canAct(a) || a.down) return 'Du kan inte förvandla dig nu.';
  if (g.state.mode === 'combat') {
    const c = g.state.combat!;
    if (c.order[c.turn] !== a.id || c.acted[a.id] || !g.isPlayerTurn()) return 'Det är inte din tur.';
  } else if (g.state.mode !== 'explore') return 'Inte nu.';
  return null;
}

/** Förvandlar personen till djuret, eller tillbaka. Tar en stridsrunda. */
export function shapeshift(g: Game, a: Actor): string | null {
  const problem = shapeProblem(g, a);
  if (problem) return problem;
  if (a.shape) toHuman(g, a);
  else toAnimal(g, a, shapeOf(g, a)!);
  if (g.state.mode === 'combat') {
    g.state.combat!.acted[a.id] = true;
    finishTurn(g);
  } else tick(g, a);
  g.changed();
  return null;
}

/** HAMNSKIFTARE (Vidar): samma förvandling som Hamnbytare, till det djur magikern väljer. */
export function becomeAnimal(g: Game, a: Actor, n: number) {
  if (a.shape) {
    g.log(`${a.name} är redan ett djur.`);
    return;
  }
  toAnimal(g, a, n);
}

function toAnimal(g: Game, a: Actor, n: number) {
  const hamn = HAMN[n];
  const st = CREATURE_STATS[hamn.stats];
  a.shape = {
    animal: n,
    since: g.state.time,
    checks: 0,
    lost: a.maxKp - a.kp,
    human: {
      attrs: { ...a.attrs },
      skills: { ...a.skills },
      maxKp: a.maxKp,
      kp: a.kp,
      locKp: { ...a.locKp },
      locMax: { ...a.locMax },
      move: a.move,
      detailed: a.detailed,
      weapon: a.weapon,
      offhand: a.offhand,
      armor: [...a.armor],
      shield: a.shield,
      naturalArmor: a.naturalArmor,
      sprite: a.sprite,
      sight: a.sight,
      darkvision: a.darkvision,
      bv: { ...a.bv },
      torchOut: a.torchOut,
    },
  };
  // Djurets kropp, men INT, KAR och INT-baserade färdigheter är kvar.
  a.attrs = { ...a.attrs, STY: st.attrs.STY, STO: st.attrs.STO, FYS: st.attrs.FYS, SMI: st.attrs.SMI };
  const kept = Object.fromEntries(Object.entries(a.skills).filter(([k]) => SKILLS[k.split(':')[0]]?.attr === 'INT' && !k.startsWith('magiskola')));
  const animal = Object.fromEntries(Object.entries(st.skills).filter(([, v]) => typeof v === 'number')) as Record<string, number>;
  a.skills = { ...kept, ...animal };
  a.maxKp = maxKp(a.attrs);
  a.kp = Math.max(1, a.maxKp - a.shape.lost);
  // Djur strider vanligt, med totala KP (tolkning).
  a.detailed = false;
  a.move = st.move.L ?? 1;
  a.weapon = 'hamn';
  a.offhand = undefined;
  a.armor = [];
  a.shield = undefined;
  a.naturalArmor = typeof st.armor === 'number' ? st.armor : 0;
  a.sprite = hamn.sprite;
  a.darkvision = !!st.darkvision || a.darkvision;
  a.bv = {};
  // Facklan följer med magiskt men kan inte bäras.
  a.torchOut = true;
  a.sneaking = false;
  a.hidden = false;
  g.log(`${a.name} förvandlar sig till en ${hamn.name}. Utrustningen följer med magiskt.`);
}

function toHuman(g: Game, a: Actor) {
  const s = a.shape!;
  const lostNow = a.maxKp - a.kp;
  Object.assign(a, s.human, { attrs: { ...s.human.attrs, INT: a.attrs.INT, PSY: a.attrs.PSY, KAR: a.attrs.KAR } });
  a.shape = undefined;
  g.log(`${a.name} blir människa igen.`);
  // Skada som djuret fick följer med och fördelas över kroppsdelarna (tolkning).
  const extra = lostNow - s.lost;
  if (extra > 0) wound(g, a, extra, null);
}

/** Skadebonus för djurets anfall. */
export function shapeDamageBonus(a: Actor): string {
  return damageBonus(a.attrs);
}

/**
 * För varje hel timme över PSY-värdet i djurhamn: ett Normalt PSY-slag. Misslyckas det fastnar
 * personen i hamnen för alltid. Anropas när tiden går.
 */
export function shapeTime(g: Game, a: Actor) {
  const s = a.shape;
  const ch = g.charOf(a);
  if (!s || !ch || ch.stuckInShape) return;
  const hours = Math.floor((g.state.time - s.since) / 3600);
  while (hours - a.attrs.PSY > s.checks) {
    s.checks++;
    const check = attributeCheck(a.attrs.PSY, g.rng, 'Normalt');
    if (check.success) g.log(`${a.name} minns vem hen är (Normalt PSY-slag, T20: ${check.roll} mot ${check.target}).`);
    else {
      ch.stuckInShape = true;
      g.log(`${a.name} har varit djur för länge och glömmer sin mänskliga form. Hen är för alltid fast i hamnen som ${HAMN[s.animal].name} (Normalt PSY-slag, T20: ${check.roll} mot ${check.target}).`);
      return;
    }
  }
}

/** Alla kroppsdelar (för att visa människokroppen i rollformuläret). */
export const BODY_PARTS = HIT_LOCATIONS;
