/**
 * Särskilda förmågor och yrkesförmågor som används på turen (Bok I s. 25–27 och yrkena):
 * Turgubbe och Tjuvtur, Gudarnas gunstling, lönnmördarens Anfall bakifrån, helarens
 * Handpåläggning, munkens Meditation och God kroppskontroll. Riddarslaget är ett anfallssätt i
 * maneuvers.ts. Tolkningarna står i docs/regelbeslut.md.
 */
import { SKILLS } from '../data/skills';
import { addEffect, canAct, canUseSkills, finishTurn, hasEffect, short, tick, type WeaponInfo } from './combat';
import { die } from './dice';
import type { Game } from './game';
import { actorHas, actorProfession } from './hero';
import { neutralize } from './poison';
import { ABILITY_RULES, attributeCheck, HIT_LOCATIONS, raiseTarget, resistance, ROUND_SECONDS, type Check } from './rules';
import { advanceTime, dayOf } from './time';
import type { Actor } from './types';

// ------------------------------------------------------------------ Turgubbe och Tjuvtur

export type LuckSource = 'turgubbe' | 'tjuvtur';

const LUCK_NAME: Record<LuckSource, string> = { turgubbe: 'Turgubbe', tjuvtur: 'Tjuvtur' };

/** Turen som figuren kan köpa: Turgubbe (särskild förmåga) och tjuvens Tjuvtur. */
export function luckSources(g: Game, a: Actor): LuckSource[] {
  const out: LuckSource[] = [];
  if (actorHas(g, a, 'turgubbe')) out.push('turgubbe');
  if (actorProfession(g, a, 'tjuv')) out.push('tjuvtur');
  return out;
}

/** Hur många gånger till Tjuvtur går att använda före nästa sömn (två, fyra för alver). */
export function thiefLuckLeft(g: Game, a: Actor): number {
  const ch = g.charOf(a);
  const per = ch?.race === 'alv' ? ABILITY_RULES.thiefLuckPerSleepAlv : ABILITY_RULES.thiefLuckPerSleep;
  return Math.max(0, per - (a.thiefLuck ?? 0));
}

/** Varför figuren inte kan köpa `n` på nästa slag, eller null. PSY får inte gå ned till 0 (tolkning). */
export function luckProblem(g: Game, a: Actor, source: LuckSource, n: number): string | null {
  if (!luckSources(g, a).includes(source)) return `Du har inte ${LUCK_NAME[source]}.`;
  if (!a.alive || g.state.mode === 'ended' || g.state.mode === 'dead') return 'Det går inte nu.';
  const max = source === 'turgubbe' ? ABILITY_RULES.luckMax : ABILITY_RULES.thiefLuckMax;
  if (n > max) return `Högst +${max} på ett slag.`;
  if (source === 'tjuvtur' && thiefLuckLeft(g, a) <= 0) return 'Tjuvturen är förbrukad till nästa sömn.';
  if (a.psy - n < 1) return 'För få PSY-poäng.';
  return null;
}

/**
 * Knappen för turen: varje tryck köper +1 till på nästa egna slag, upp till taket eller vad
 * PSY räcker till, och sedan stängs den av igen. PSY dras när slaget slås.
 */
export function cycleLuck(g: Game, a: Actor, source: LuckSource) {
  const now = a.luckArmed?.source === source ? a.luckArmed.n : 0;
  const next = now + 1;
  if (luckProblem(g, a, source, next)) {
    a.luckArmed = undefined;
    if (now) g.log(`${a.name} sparar sin tur.`);
    return;
  }
  a.luckArmed = { source, n: next };
  g.log(`${a.name} litar på turen: +${next} på nästa slag (${LUCK_NAME[source]}, ${next} PSY).`);
}

/** Lägger på turen på slaget som just slogs. Anropas av `heroic`, som alla slag går igenom. */
export function applyLuck(g: Game, a: Actor | undefined, check: Check): Check {
  const luck = a?.luckArmed;
  if (!a || !luck) return check;
  a.luckArmed = undefined;
  if (luckProblem(g, a, luck.source, luck.n)) return check;
  a.psy -= luck.n;
  if (luck.source === 'tjuvtur') a.thiefLuck = (a.thiefLuck ?? 0) + 1;
  const after = raiseTarget(check, luck.n);
  const changed = after.result !== check.result ? `: ${check.result} blir ${after.result}` : '';
  g.log(`${a.name} spenderar ${luck.n} PSY på ${LUCK_NAME[luck.source]} (+${luck.n} på CL, ${check.roll} mot ${after.target})${changed}.`);
  return after;
}

// ------------------------------------------------------------------ Gudarnas gunstling

/**
 * När KP når 0 slås 1T100. På 25 eller lägre återställer guden alla KP; kritiska skador och
 * blödningar står kvar. Guden räddar en gång per äventyr (Vidar); det slås varje gång tills dess.
 * Returnerar true om personen räddades.
 */
export function godsFavor(g: Game, a: Actor): boolean {
  const ch = g.charOf(a);
  if (!ch || a.elemental || ch.favorUsed || !actorHas(g, a, 'gudarnas_gunstling')) return false;
  const d = die(100, g.rng);
  if (d > ABILITY_RULES.favorChance) {
    g.log(`${a.name} ber till gudarna, men de svarar inte (1T100: ${d}).`);
    return false;
  }
  ch.favorUsed = true;
  a.kp = a.maxKp;
  for (const loc of HIT_LOCATIONS) {
    if (a.injuries.some((i) => i.loc === loc && i.lost)) continue;
    a.locKp[loc] = a.locMax[loc];
    a.disabled = a.disabled.filter((l) => l !== loc);
  }
  a.dying = false;
  a.dyingRounds = 0;
  a.down = false;
  if (!hasEffect(a, 'medvetslös') && !hasEffect(a, 'dödsfara')) a.unconscious = false;
  g.log(`Gudarna håller sin hand över ${a.name} (1T100: ${d})! Alla KP kommer tillbaka.`);
  g.emit(a.id, 'Gudarnas gunst!', 'heal');
  return true;
}

// ------------------------------------------------------------------ Anfall bakifrån

/**
 * Lönnmördarens Anfall bakifrån gäller när offret inte märker anfallaren (Smyga lyckades och
 * Upptäcka fara misslyckades). Bara mot humanoider som inte är för stora, och inte med
 * stridskonsternas grepp och kast.
 */
export function backstabs(g: Game, att: Actor, def: Actor, w: WeaponInfo, special: boolean): boolean {
  return !special && !w.natural && def.detailed && actorProfession(g, att, 'lonnmordare') && def.attrs.STO <= att.attrs.STO + ABILITY_RULES.backstabMaxSto;
}

/** Skadan vid Anfall bakifrån: vapnets skada utan SB, gånger 1, 2 eller 4 efter utfallet. */
export function backstabMultiplier(result: Check['result']): number {
  return result === 'fummel' ? 0 : ABILITY_RULES.backstab[result];
}

// ------------------------------------------------------------------ handlingar på turen

/** I strid kostar handlingen turen; utanför strid går en runda. */
function spend(g: Game, a: Actor) {
  if (g.state.mode === 'combat') {
    g.state.combat!.acted[a.id] = true;
    finishTurn(g);
  } else tick(g, a);
}

/** Kan figuren göra en handling nu (i strid: på sin tur, med handlingen kvar)? */
function canDo(g: Game, a: Actor): string | null {
  if (!canUseSkills(a) || a.elemental) return 'Du kan inte göra det nu.';
  if (g.state.mode === 'combat') return g.isPlayerTurn() && g.player === a && !g.state.combat!.acted[a.id] ? null : 'Det är inte din tur.';
  return g.state.mode === 'explore' ? null : 'Det går inte nu.';
}

/** God kroppskontroll: ett Normalt FYS-slag ger +5 STY i tre rundor, två gånger om dagen. */
export function bodyControlProblem(g: Game, a: Actor): string | null {
  if (!actorHas(g, a, 'god_kroppskontroll')) return 'Du har inte God kroppskontroll.';
  const day = dayOf(g.state.time);
  if (a.bodyControl?.day === day && a.bodyControl.n >= ABILITY_RULES.bodyControl.perDay) return 'Två gånger om dagen.';
  if (hasEffect(a, 'styrka')) return 'Kroppskontrollen verkar redan.';
  return canDo(g, a);
}

export function bodyControl(g: Game, a: Actor): string | null {
  const problem = bodyControlProblem(g, a);
  if (problem) return problem;
  const day = dayOf(g.state.time);
  a.bodyControl = { day, n: (a.bodyControl?.day === day ? a.bodyControl.n : 0) + 1 };
  const check = attributeCheck(a.attrs.FYS, g.rng, 'Normalt');
  const r = ABILITY_RULES.bodyControl;
  if (check.success) {
    addEffect(a, { kind: 'styrka', label: `God kroppskontroll: +${r.sty} STY`, mod: r.sty, rounds: r.rounds });
    g.log(`${a.name} samlar kroppens krafter (Normalt FYS-slag, ${short(check)}): +${r.sty} STY i ${r.rounds} rundor.`);
  } else g.log(`${a.name} försöker samla kroppens krafter men lyckas inte (Normalt FYS-slag, ${short(check)}).`);
  spend(g, a);
  return null;
}

/** Färdigheter som munken kan meditera inför: de som hen har FV i. */
export function meditationSkills(a: Actor): string[] {
  return Object.keys(a.skills).filter((k) => (a.skills[k] ?? 0) > 0 && SKILLS[k.split(':')[0]] && !k.startsWith('magiskola'));
}

export function meditationProblem(g: Game, a: Actor, skill: string): string | null {
  if (!actorProfession(g, a, 'munk')) return 'Bara munkar mediterar.';
  if (!meditationSkills(a).includes(skill)) return 'Välj en färdighet som du kan.';
  const now = a.effects.find((e) => e.kind === 'cl' && e.scope === 'färdighet' && e.label.startsWith('Meditation'));
  if (now && now.skill === skill && (now.mod ?? 0) >= g.skillFv(a, skill)) return 'Meditationen kan inte ge mer än dubbla FV.';
  return canDo(g, a);
}

/**
 * Meditation: varje hel runda ger +1 i färdigheten, högst till dubbla FV, och gäller nästa slag
 * inom en minut. I strid tar varje runda turen. Utanför strid mediterar munken tills det inte går
 * att komma högre, och tiden går under tiden. Tolkning: tillägget räknas som CL.
 */
export function meditate(g: Game, a: Actor, skill: string): string | null {
  const problem = meditationProblem(g, a, skill);
  if (problem) return problem;
  const fv = g.skillFv(a, skill);
  const old = a.effects.find((e) => e.kind === 'cl' && e.scope === 'färdighet' && e.label.startsWith('Meditation'));
  const before = old?.skill === skill ? (old.mod ?? 0) : 0;
  if (old) a.effects = a.effects.filter((e) => e !== old);
  const rounds = g.state.mode === 'combat' ? 1 : fv - before;
  const mod = Math.min(fv, before + rounds);
  const name = SKILLS[skill.split(':')[0]]?.name ?? skill;
  addEffect(a, { kind: 'cl', scope: 'färdighet', skill, mod, uses: 1, rounds: ABILITY_RULES.meditationRounds, label: `Meditation: +${mod} på ${name}` });
  g.log(`${a.name} mediterar${rounds > 1 ? ` i ${rounds} rundor` : ''}: +${mod} på nästa slag i ${name} inom en minut.`);
  if (g.state.mode === 'combat') spend(g, a);
  else {
    advanceTime(g, rounds * ROUND_SECONDS, 'vila');
    g.changed();
  }
  return null;
}

// ------------------------------------------------------------------ Handpåläggning

/** Det som helaren kan göra för en patient: läka, bota gift eller bota en infektion. */
export type HealKind = 'handpåläggning' | 'giftbot' | 'sjukbot';

/** Är patienten inom räckhåll (beröring) och behöver hjälpen? Helaren kan också hela sig själv. */
export function healProblem(g: Game, healer: Actor, patient: Actor, kind: HealKind): string | null {
  if (!actorProfession(g, healer, 'helare')) return 'Bara helare kan lägga händerna på.';
  if (!patient.alive || patient.elemental) return 'Det går inte.';
  if (Math.max(Math.abs(healer.x - patient.x), Math.abs(healer.y - patient.y)) > 1) return 'Du måste kunna röra vid patienten.';
  const cost = healCost(patient, kind);
  if (cost === null) return kind === 'handpåläggning' ? 'Patienten har inga skador att läka.' : kind === 'giftbot' ? 'Patienten har inget gift i kroppen.' : 'Patienten har ingen infektion.';
  if (healer.psy - cost < 1) return 'För få PSY-poäng.';
  return canAct(healer) ? canDo(g, healer) : 'Du kan inte göra det nu.';
}

/** PSY som behandlingen kostar, eller null om patienten inte behöver den. */
function healCost(p: Actor, kind: HealKind): number | null {
  if (kind === 'handpåläggning') return p.kp < p.maxKp || p.dying ? 1 : null;
  if (kind === 'giftbot') {
    const worst = strongestPoison(p);
    return worst ? worst.sty : null;
  }
  return p.infections.length ? ABILITY_RULES.diseaseSg : null;
}

const strongestPoison = (p: Actor) => [...(p.poisons ?? [])].sort((a, b) => b.sty - a.sty)[0];

/**
 * Handpåläggning (helare):
 * - Läka: 1 KP per runda för 1 PSY per KP. I strid tar varje KP turen; utanför strid läker helaren
 *   så mycket som PSY räcker till, och lika många rundor går.
 * - Bota gift: PSY/2 mot giftets STY på motståndstabellen, för lika många PSY som STY.
 * - Bota en infektion: PSY/2 mot svårighetsgraden 10 (tolkning), för lika många PSY.
 * PSY dras också när det misslyckas (tolkning).
 */
export function layOnHands(g: Game, healer: Actor, patient: Actor, kind: HealKind): string | null {
  const problem = healProblem(g, healer, patient, kind);
  if (problem) return problem;
  const psy = Math.floor(healer.attrs.PSY / 2);
  if (kind === 'handpåläggning') {
    const want = Math.max(1, patient.maxKp - patient.kp);
    const n = g.state.mode === 'combat' ? 1 : Math.min(want, healer.psy - 1);
    healer.psy -= n;
    g.heal(n, patient);
    g.log(`${healer.name} lägger händerna på ${patient === healer ? 'sig själv' : patient.name} och läker ${n} KP (${n} PSY).`);
    if (g.state.mode === 'combat') spend(g, healer);
    else {
      advanceTime(g, n * ROUND_SECONDS, 'vila');
      g.changed();
    }
    return null;
  }
  if (kind === 'giftbot') {
    const poison = strongestPoison(patient)!;
    healer.psy -= poison.sty;
    const check = resistance(psy, poison.sty, g.rng);
    if (check.success) {
      g.log(`${healer.name} driver ut giftet ur ${patient.name} (PSY/2 ${psy} mot STY ${poison.sty}, ${short(check)}, ${poison.sty} PSY).`);
      neutralize(g, patient, poison.sty, poison.herb);
    } else g.log(`${healer.name} försöker driva ut giftet ur ${patient.name} men lyckas inte (PSY/2 ${psy} mot STY ${poison.sty}, ${short(check)}, ${poison.sty} PSY).`);
  } else {
    const inf = patient.infections[0];
    const sg = ABILITY_RULES.diseaseSg;
    healer.psy -= sg;
    const check = resistance(psy, sg, g.rng);
    if (check.success) {
      patient.infections = patient.infections.filter((i) => i !== inf);
      patient.effects = patient.effects.filter((e) => !e.label.startsWith(`Infektion i ${inf.loc}`));
      g.log(`${healer.name} botar infektionen i ${patient.name}s ${inf.loc} (PSY/2 ${psy} mot ${sg}, ${short(check)}, ${sg} PSY).`);
    } else g.log(`${healer.name} försöker bota infektionen i ${patient.name}s ${inf.loc} men lyckas inte (PSY/2 ${psy} mot ${sg}, ${short(check)}, ${sg} PSY).`);
  }
  spend(g, healer);
  return null;
}

/** Behandlingarna som helaren kan ge just nu, till gränssnittet. */
export function healOptions(g: Game, healer: Actor): { kind: HealKind; target: string; label: string }[] {
  if (!actorProfession(g, healer, 'helare')) return [];
  const out: { kind: HealKind; target: string; label: string }[] = [];
  for (const p of g.partyMembers()) {
    const who = p === healer ? 'dig själv' : p.name;
    if (!healProblem(g, healer, p, 'handpåläggning')) out.push({ kind: 'handpåläggning', target: p.id, label: `Handpåläggning på ${who}` });
    if (!healProblem(g, healer, p, 'giftbot')) out.push({ kind: 'giftbot', target: p.id, label: `Driv ut giftet ur ${who}` });
    if (!healProblem(g, healer, p, 'sjukbot')) out.push({ kind: 'sjukbot', target: p.id, label: `Bota infektionen hos ${who}` });
  }
  return out;
}
