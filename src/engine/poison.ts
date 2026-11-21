import { HERBS, herbSkill, type HerbDef } from '../data/herbs';
import { die, roll } from './dice';
import type { Game } from './game';
import { kill, limbUsable, wound } from './combat';
import {
  attributeCheck,
  BODY_FUNCTIONS,
  DAY,
  HIT_LOCATIONS,
  HOUR,
  poisonOnsets,
  poisonResistance,
  poisonStage,
  POISON_STAGES,
  POISON_TYPES,
  ROUND_SECONDS,
  skillCheck,
  type HitLocation,
  type PoisonStage,
} from './rules';
import { amputate, advanceTime, dayOf } from './time';
import type { Actor, HerbDose, Poisoning } from './types';

/**
 * Örter och gifter (Bok II s. 50–56). Läkedroger används ur packningen, gifter genom sår stryks
 * på vapnet, och gifter i kroppen verkar i stadier tills kroppen har brutit ned dem.
 */

const ROUNDS_PER_HOUR = HOUR / ROUND_SECONDS;
const ROUNDS_PER_MINUTE = 60 / ROUND_SECONDS;

/** Vanligheten för rollpersonen: lönnmördare drar bort 10 för extremt okända droger. */
export function commonFor(g: Game, h: HerbDef): number {
  return h.rare && g.state.character.profession === 'lonnmordare' ? Math.max(1, h.common - 10) : h.common;
}

/**
 * Kvaliteten på en drog som någon bereder med sin FV. Är 2 × vanligheten högre än FV slås ett
 * dolt slag: misslyckat ger en verkningslös drog, fummel en skadlig och perfekt en dubbelt så bra.
 */
export function prepareDose(g: Game, herbId: string, fv: number, common = HERBS[herbId].common): HerbDose {
  if (common * 2 <= fv) return { id: herbId, quality: 'normal' };
  const c = skillCheck(fv, g.rng);
  const quality = c.result === 'perfekt' ? 'dubbel' : c.result === 'fummel' ? 'skadlig' : c.success ? 'normal' : 'verkningslös';
  return { id: herbId, quality };
}

// ------------------------------------------------------------------ gifter i kroppen

/** Ett gift kommer in i kroppen: offret slår FYS mot giftets STY, och stadiet avgörs. */
export function poisonActor(g: Game, a: Actor, dose: HerbDose, loc?: HitLocation | null) {
  const h = HERBS[dose.id];
  if (!h?.poison || !a.alive) return;
  if (dose.quality === 'verkningslös' || dose.quality === 'skadlig') {
    g.log(`Giftet på ${a.name} verkar inte; det var illa berett.`);
    return;
  }
  const sty = h.poison.sty * (dose.quality === 'dubbel' ? 2 : 1);
  const special = h.poison.special;
  // Gifter utan styrka (t.ex. de som ökar risken för infektion) verkar utan motståndsslag.
  if (special?.kind === 'infektionsrisk') {
    a.effects.push({ kind: 'infektionsrisk', label: `${h.name}: större risk för infektion`, mod: special.factor, persist: true, untilRest: true });
    g.log(`${h.name} kommer in i såret.`);
    return;
  }
  if (!h.poison.type && !special) {
    g.log(`${a.name} förgiftas av ${h.name.toLowerCase()} (${h.desc}).`);
    return;
  }
  const check = poisonResistance(a.attrs.FYS, sty, g.rng);
  const stage = poisonStage(check);
  g.log(`${a.name} förgiftas av ${h.name.toLowerCase()} (FYS ${a.attrs.FYS} mot STY ${sty}, T20: ${check.roll} mot ${check.target}): ${special ? (check.success ? 'står emot' : 'giftet tar') : stage}.`);
  if (special && check.success) return;
  const p: Poisoning = { herb: h.id, sty, stage, start: g.state.time, applied: [], lastDay: dayOf(g.state.time), ...(loc ? { loc } : {}) };
  (a.poisons ??= []).push(p);
  updatePoisons(g, a);
}

/** Vid en träff som skadar: giftet på vapnet tränger in i såret och förbrukas. */
export function poisonOnHit(g: Game, att: Actor, def: Actor, loc: HitLocation | null) {
  const dose = att.weaponPoison;
  if (!dose) return;
  att.weaponPoison = undefined;
  poisonActor(g, def, dose, loc);
}

/** Stadier vars tid har kommit börjar verka. Körs varje runda i strid och när tiden går. */
export function updatePoisons(g: Game, a: Actor) {
  if (!a.poisons?.length || !a.alive) return;
  for (const p of [...a.poisons]) {
    const h = HERBS[p.herb];
    const onsets = poisonOnsets(p.sty);
    const elapsed = g.state.time - p.start;
    if (h.poison?.special) {
      if (elapsed >= onsets.lindrig) {
        a.poisons = a.poisons.filter((x) => x !== p);
        applySpecial(g, a, h, p);
      }
      continue;
    }
    const last = POISON_STAGES.indexOf(p.stage);
    for (const stage of POISON_STAGES.slice(0, last + 1)) {
      if (p.applied.includes(stage) || elapsed < onsets[stage]) continue;
      p.applied.push(stage);
      applyStage(g, a, h, p, stage);
      if (!a.alive) return;
    }
  }
}

function tag(h: HerbDef) {
  return { persist: true, poison: h.id };
}

function applyStage(g: Game, a: Actor, h: HerbDef, p: Poisoning, stage: PoisonStage) {
  const type = POISON_TYPES[h.poison!.type!];
  const def = type.stages[stage];
  g.log(`${h.name} (${type.name.toLowerCase()}, ${stage}): ${def.text}`);
  for (const e of def.effects) {
    switch (e.kind) {
      case 'cl':
        a.effects.push({ kind: 'cl', label: `${h.name}: ${stage}`, mod: e.mod, scope: e.scope, ...tag(h) });
        break;
      case 'skada':
        if (e.loc === 'slump' && a.detailed) {
          const loc = p.loc ?? HIT_LOCATIONS[die(HIT_LOCATIONS.length, g.rng) - 1];
          wound(g, a, roll(e.dice, g.rng), loc);
        } else wound(g, a, roll(e.dice, g.rng), null);
        break;
      case 'medvetslös':
        a.unconscious = true;
        a.effects.push({ kind: 'medvetslös', label: `${h.name}: medvetslös`, ...tag(h) });
        break;
      case 'förlamning':
        paralysis(g, a, h);
        break;
      case 'dygnsslag':
        break;
      case 'funktion':
        knockOutFunction(g, a, h, false);
        break;
      case 'död':
        if (e.rounds === 'FYS') a.effects.push({ kind: 'dödsfara', label: `${h.name}: hjärtat stannar`, rounds: a.attrs.FYS, ...tag(h) });
        else kill(g, a);
        break;
    }
    if (!a.alive) return;
  }
  if (stage === 'allvarlig' && h.poison!.type === 'funktion') {
    // Den utslagna funktionen blir bestående.
    for (const e of a.effects.filter((x) => x.kind === 'funktion' && x.poison === h.id)) e.poison = undefined;
    for (const e of a.effects.filter((x) => x.kind === 'blind' && x.poison === h.id)) e.poison = undefined;
  }
}

/** Svårt FYS-slag för varje kroppsdel; misslyckas det är den förlamad för alltid. Huvud och bröstkorg dödar. */
function paralysis(g: Game, a: Actor, h: HerbDef) {
  if (!a.detailed) return;
  for (const loc of HIT_LOCATIONS) {
    const c = attributeCheck(a.attrs.FYS, g.rng, 'Svårt');
    if (c.success) continue;
    if (loc === 'huvud' || loc === 'bröstkorg') {
      g.log(`${h.name} förlamar ${a.name}s ${loc}.`);
      kill(g, a);
      return;
    }
    a.injuries.push({ loc, id: 'förlamad', text: `Förlamad av ${h.name.toLowerCase()}.`, cl: 0, lost: true });
    if (!a.disabled.includes(loc)) a.disabled.push(loc);
    g.log(`${a.name}s ${loc} förlamas för alltid (Svårt FYS-slag, T20: ${c.roll} mot ${c.target}).`);
  }
}

function knockOutFunction(g: Game, a: Actor, h: HerbDef, permanent: boolean) {
  const n = die(10, g.rng);
  const picks = n <= 8 ? [BODY_FUNCTIONS[n - 1]] : [BODY_FUNCTIONS[die(8, g.rng) - 1], BODY_FUNCTIONS[die(8, g.rng) - 1]];
  for (const f of new Set(picks)) {
    const extra = permanent ? { persist: true } : tag(h);
    if (f === 'synen') a.effects.push({ kind: 'blind', label: `${h.name}: blind`, ...extra });
    else a.effects.push({ kind: 'funktion', label: `${h.name}: ${f} är utslagen`, ...extra });
    g.log(`${h.name} slår ut ${a.name}s ${f}.`);
  }
}

function applySpecial(g: Game, a: Actor, h: HerbDef, p: Poisoning) {
  const s = h.poison!.special!;
  switch (s.kind) {
    case 'cl':
      a.effects.push({ kind: 'cl', label: `${h.name}: omtöcknad`, mod: s.mod, scope: 'alla', rounds: s.minutes * ROUNDS_PER_MINUTE, persist: true });
      break;
    case 'medvetslös': {
      a.unconscious = true;
      const rounds = s.hours ? roll(s.hours, g.rng) * ROUNDS_PER_HOUR : undefined;
      const days = s.days ? roll(s.days, g.rng) : undefined;
      a.effects.push({ kind: 'medvetslös', label: `${h.name}: medvetslös`, rounds, days, persist: true });
      break;
    }
    case 'död':
      if (s.hours) a.effects.push({ kind: 'dödsfara', label: `${h.name}: dör om ingen bryter giftet`, rounds: roll(s.hours, g.rng) * ROUNDS_PER_HOUR, ...tag(h) });
      else kill(g, a);
      break;
    case 'lem': {
      const loc = p.loc ?? 'höger arm';
      if (!a.detailed) break;
      if (s.hours) a.effects.push({ kind: 'lem', label: `${h.name}: ${loc} förlamad`, loc, rounds: roll(s.hours, g.rng) * ROUNDS_PER_HOUR, persist: true });
      else {
        a.injuries.push({ loc, id: 'förlorad', text: `Förstörd av ${h.name.toLowerCase()}.`, cl: 0, lost: true });
        if (!a.disabled.includes(loc)) a.disabled.push(loc);
      }
      break;
    }
    case 'blind':
      a.effects.push({ kind: 'blind', label: `${h.name}: blind`, days: s.days ? roll(s.days, g.rng) : undefined, persist: true });
      break;
    case 'ingenHandling':
      a.effects.push({ kind: 'ingenHandling', label: `${h.name}: sjuk`, rounds: roll(s.hours, g.rng) * ROUNDS_PER_HOUR, persist: true });
      break;
    case 'bärsärk':
      a.effects.push({ kind: 'bärsärk', label: `${h.name}: bärsärkagång`, rounds: 10 });
      break;
    case 'smiHalv':
      a.effects.push({ kind: 'cl', label: `${h.name}: stela leder`, half: true, scope: 'smi', rounds: roll(s.hours, g.rng) * ROUNDS_PER_HOUR, persist: true });
      break;
    case 'sänk':
      a.attrs[s.attr] = Math.min(a.attrs[s.attr], s.to);
      if (a.id === g.state.playerId) g.state.character.attrs[s.attr] = a.attrs[s.attr];
      break;
    case 'infektionsrisk':
      break;
  }
  g.log(`${h.name} verkar på ${a.name}: ${h.desc}`);
}

/** Effekter från ett gift som är nedbrutet försvinner. */
function endPoison(g: Game, a: Actor, p: Poisoning) {
  a.poisons = (a.poisons ?? []).filter((x) => x !== p);
  a.effects = a.effects.filter((e) => e.poison !== p.herb);
  if (a.unconscious && !a.effects.some((e) => e.kind === 'medvetslös' || e.kind === 'dödsfara') && a.kp > 0 && (!a.detailed || a.locKp.huvud > 0)) {
    a.unconscious = false;
    g.log(`${a.name} vaknar.`);
  }
  g.log(`Giftet ${HERBS[p.herb].name.toLowerCase()} har gått ur ${a.name}s kropp.`);
}

/** Varje dygn: FYS mot giftets STY, och lyckas det sjunker STY med 1. Vid 0 är giftet borta. */
function dailyRolls(g: Game, a: Actor) {
  const today = dayOf(g.state.time);
  for (const p of [...(a.poisons ?? [])]) {
    while (p.lastDay < today && a.alive) {
      p.lastDay++;
      const c = poisonResistance(a.attrs.FYS, p.sty, g.rng);
      if (c.success || c.roll === 1) p.sty--;
      if (p.applied.includes('allvarlig')) dailyHarm(g, a, p);
      if (p.sty <= 0) {
        endPoison(g, a, p);
        break;
      }
    }
  }
}

/** Allvarliga gifter i andningsvägarna och blodet kan ge bestående skador varje dygn. */
function dailyHarm(g: Game, a: Actor, p: Poisoning) {
  const type = HERBS[p.herb].poison?.type;
  const brain = () => {
    a.attrs.INT = Math.max(1, a.attrs.INT - 1);
    a.attrs.PSY = Math.max(1, a.attrs.PSY - 1);
    if (a.id === g.state.playerId) Object.assign(g.state.character.attrs, { INT: a.attrs.INT, PSY: a.attrs.PSY });
    g.log(`Syrebrist: ${a.name}s INT och PSY sjunker med 1 för alltid.`);
  };
  if (type === 'andning') {
    if (!attributeCheck(a.attrs.FYS, g.rng, 'Normalt').success) brain();
  } else if (type === 'blod') {
    const n = die(6, g.rng);
    if (n === 4) brain();
    else if (n >= 5 && a.id === g.state.playerId) {
      const limbs: HitLocation[] = ['vänster arm', 'höger arm', 'vänster ben', 'höger ben'];
      const loc = limbs[die(4, g.rng) - 1];
      if (limbUsable(a, loc)) amputate(g, a, loc);
    }
  }
}

let sleeping = false;

/** När tiden går för rollpersonen: stadier, dygnsslag, och medvetslöshet som måste sovas bort. */
export function advancePoisons(g: Game, a: Actor) {
  updatePoisons(g, a);
  dailyRolls(g, a);
  if (sleeping || !a.alive || g.state.mode !== 'explore') return;
  // Medvetslös av gift: dygnen går tills kroppen har brutit ned giftet.
  sleeping = true;
  try {
    let days = 0;
    while (a.alive && a.unconscious && a.poisons?.length && days < 120) {
      advanceTime(g, DAY, 'vila');
      days++;
    }
    if (days && a.alive) g.log(`${a.name} har legat medvetslös i ${days} dygn.`);
  } finally {
    sleeping = false;
  }
}

/** Motgift och NEUTRALISERA GIFT: sänker giftens STY. Läker inte det som redan har skett. */
export function neutralize(g: Game, a: Actor, amount: number, only?: string) {
  const list = (a.poisons ?? []).filter((p) => !only || p.herb === only);
  if (!list.length && !a.effects.some((e) => e.poison && (!only || e.poison === only))) {
    g.log(`${a.name} har inget gift i kroppen.`);
    return;
  }
  for (const p of list) {
    p.sty = only ? 0 : p.sty - amount;
    if (p.sty <= 0) endPoison(g, a, p);
    else g.log(`Giftet ${HERBS[p.herb].name.toLowerCase()} försvagas till STY ${p.sty}.`);
  }
  // Gifter med fördröjd död (ismossa) stoppas av sitt motgift.
  if (only) a.effects = a.effects.filter((e) => e.poison !== only);
}

// ------------------------------------------------------------------ använda örter

/** Kan dosen användas just nu? I strid kostar det handlingen. */
export function herbProblem(g: Game, dose: HerbDose): string | null {
  const h = HERBS[dose.id];
  const p = g.player;
  if (!h) return 'Okänd drog.';
  if (h.kind === 'gift') return h.poison?.byWound ? null : 'Giftet måste ges i mat eller dryck, och det går inte här.';
  if (!h.effects?.length) return 'Drogen har ingen verkan i spelet än.';
  if (p.unconscious || !p.alive) return 'Du kan inte göra något nu.';
  if (g.state.mode === 'combat' && (!g.isPlayerTurn() || g.state.combat!.acted[p.id])) return 'Det tar handlingen på din tur.';
  if (g.state.mode !== 'combat' && g.state.mode !== 'explore') return 'Inte nu.';
  return null;
}

/** Använder en dos ur packningen. Gifter genom sår stryks på vapnet (tar en timme utanför strid). */
export function useHerb(g: Game, index: number): string | null {
  const ch = g.state.character;
  const dose = ch.herbs[index];
  if (!dose) return 'Dosen finns inte.';
  const problem = herbProblem(g, dose);
  if (problem) return problem;
  const h = HERBS[dose.id];
  const p = g.player;
  ch.herbs.splice(index, 1);
  if (h.kind === 'gift') {
    if (g.state.mode === 'combat') return 'Det tar en timme att låta giftet torka in på vapnet.';
    advanceTime(g, HOUR, 'vila');
    p.weaponPoison = dose;
    g.log(`${p.name} stryker ${h.name.toLowerCase()} på vapnet och låter det torka in. Det verkar vid nästa träff som ger skada.`);
    g.changed();
    return null;
  }
  g.log(`${p.name} använder ${h.name.toLowerCase()}.`);
  if (dose.quality === 'verkningslös') g.log('Drogen verkar inte; den var illa beredd.');
  else if (dose.quality === 'skadlig') {
    const dmg = roll('1T6', g.rng);
    g.log(`Drogen var felberedd och gör ${p.name} sjuk (${dmg} i skada).`);
    wound(g, p, dmg, null);
  } else for (const e of h.effects!) applyHerbEffect(g, p, h, e, dose.quality === 'dubbel' ? 2 : 1);
  if (g.state.mode === 'combat') {
    g.state.combat!.acted[p.id] = true;
  } else advanceTime(g, ROUND_SECONDS * 2, 'aktiv');
  g.changed();
  return null;
}

function applyHerbEffect(g: Game, p: Actor, h: HerbDef, e: NonNullable<HerbDef['effects']>[number], factor: number) {
  switch (e.kind) {
    case 'läka': {
      const amount = roll(e.dice, g.rng) * factor;
      if (!e.minutes) {
        g.heal(amount);
        g.log(`${h.name} läker ${amount} KP.`);
      } else {
        p.effects.push({ kind: 'läkning', label: h.name, mod: amount, rounds: e.minutes * ROUNDS_PER_MINUTE, persist: true });
        g.log(`${h.name} börjar verka och läker inom ${e.minutes} minuter.`);
      }
      return;
    }
    case 'blödning': {
      const stopped = e.all ? p.bleeding.length : Math.min(1, p.bleeding.length);
      p.bleeding = e.all ? [] : p.bleeding.slice(1);
      g.log(stopped ? `Blödningen stannar${e.all ? '' : ' i en kroppsdel'}.` : 'Inget blöder.');
      return;
    }
    case 'motgift':
      neutralize(g, p, typeof e.amount === 'number' ? e.amount * factor : roll(e.amount, g.rng) * factor, e.only);
      return;
    case 'kallbrand': {
      const n = p.infections.filter((i) => i.gangrene).length;
      for (const i of p.infections) i.gangrene = false;
      g.log(n ? 'Kallbranden hejdas.' : 'Det finns ingen kallbrand att hejda.');
      return;
    }
    case 'desinficera':
      p.combatWounds = [];
      g.log('Såren renas och blir inte infekterade.');
      return;
    case 'infektionsrisk':
      p.effects.push({ kind: 'infektionsrisk', label: `${h.name}: mindre risk för infektion`, mod: e.factor, untilRest: true, persist: true });
      return;
    case 'feber':
      p.effects.push({ kind: 'febernedsatt', label: `${h.name}: febern är nedsatt`, rounds: (DAY * factor) / ROUND_SECONDS, persist: true });
      g.log('Febern lägger sig för ett dygn.');
      return;
    case 'cl':
      p.effects.push({ kind: 'cl', label: h.name, mod: e.mod, scope: e.scope, rounds: roll(e.rounds, g.rng) * factor + 1, persist: true });
      return;
    case 'mörkersyn':
      p.effects.push({ kind: 'mörkersyn', label: `${h.name}: mörkersyn`, rounds: roll(e.rounds, g.rng) * factor + 1, persist: true });
      return;
    case 'orädd':
      p.effects.push({ kind: 'orädd', label: `${h.name}: orädd`, rounds: e.minutes * factor * ROUNDS_PER_MINUTE, persist: true });
      return;
    case 'sömn':
      p.epBlocked = [];
      g.log('Kroppen känns utvilad som efter en natts sömn.');
      return;
    case 'halvPsy':
      p.effects.push({ kind: 'halvPsy', label: `${h.name}: nästa besvärjelse kostar halva PSY`, persist: true });
      return;
  }
}

// ------------------------------------------------------------------ leta örter

/** Läkeörter som växer i trakten. Odlade örter finns bara i örtagårdar. */
export function herbsHere(g: Game): HerbDef[] {
  const places = g.map.habitats;
  return Object.values(HERBS).filter((h) => h.kind === 'läkedrog' && !h.cultivated && places.some((p) => h.habitat.toLowerCase().includes(p)));
}

/**
 * En dag på jakt efter en läkeört (Bok I Örtkunskap): CL = FV − vanligheten (minst 1). Lyckat
 * ger 1T4 doser och perfekt 4T4. Allmänna droger och gifter kräver ett laboratorium.
 */
export function searchHerb(g: Game, id: string): string | null {
  const h = HERBS[id];
  const p = g.player;
  if (!h || !herbsHere(g).includes(h)) return 'Den örten växer inte här.';
  if (!g.canRest()) return 'Det går inte att leta örter med fiender i närheten.';
  const skill = herbSkill(h);
  const fv = g.skillFv(p, skill);
  const common = commonFor(g, h);
  const cl = Math.max(1, fv - common);
  const check = skillCheck(fv, g.rng, cl - fv);
  advanceTime(g, 10 * HOUR, 'aktiv');
  const n = check.result === 'perfekt' ? roll('4T4', g.rng) : check.success ? roll('1T4', g.rng) : 0;
  for (let i = 0; i < n; i++) g.state.character.herbs.push(prepareDose(g, id, fv, common));
  if (check.success) g.gainExperience(p, skill, check);
  g.log(`${p.name} letar ${h.name.toLowerCase()} hela dagen (Örtkunskap ${fv} − vanlighet ${common}, T20: ${check.roll} mot ${cl}): ${n ? `${n} doser` : 'hittar inget'}.`);
  g.changed();
  return null;
}
