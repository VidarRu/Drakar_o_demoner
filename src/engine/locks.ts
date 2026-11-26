/**
 * Låsta dörrar och kistor (steg 8): Låsdyrkning, att bryta upp, ÖPPNA och FÖRSEGLA. Låsen står i
 * kartan (`MapDef.locks`), och hur det står till med dem i `GameState.locks`. Tolkningarna står i
 * docs/regelbeslut.md under Besvärjelser utanför strid.
 */
import { WEAPONS } from '../data/weapons';
import { short } from './combat';
import { roll } from './dice';
import type { Game } from './game';
import { distance, tileAt, type LockDef } from './map';
import { resistance, type Check } from './rules';
import { advanceTime } from './time';
import type { Actor, LockState } from './types';

/** FÖRSEGLA ger dörren eller kistan 20 KP extra: så mycket svårare blir den att bryta upp (tolkning). */
export const SEAL_EXTRA = 20;

/** Dyrkar för små lås (kistor) och för större lås (dörrar). */
const PICKS: Record<LockDef['kind'], string> = { kista: 'dyrkar_sma', dörr: 'dyrkar_stora' };

export interface LockSpot {
  x: number;
  y: number;
  kind: LockDef['kind'];
  name: string;
  /** Låset i kartan, om rutan har ett (vanliga dörrar har inget lås men kan förseglas). */
  def?: LockDef & { x: number; y: number };
  state: LockState;
}

const key = (g: Game, x: number, y: number) => `${g.state.mapId}:${x},${y}`;

function stateAt(g: Game, x: number, y: number): LockState {
  return ((g.state.locks ??= {})[key(g, x, y)] ??= {});
}

/** Är förseglingen på rutan fortfarande verksam? */
export function sealedAt(g: Game, x: number, y: number): boolean {
  const s = g.state.locks?.[key(g, x, y)]?.sealed;
  return !!s && s.until > g.state.time;
}

/** Låset eller dörren på rutan, eller null. */
export function lockAt(g: Game, x: number, y: number): LockSpot | null {
  const def = g.map.locks.find((l) => l.x === x && l.y === y);
  if (def) return { x, y, kind: def.kind, name: def.name, def, state: stateAt(g, x, y) };
  if (tileAt(g.map, x, y)?.name === 'dörr') return { x, y, kind: 'dörr', name: 'dörren', state: stateAt(g, x, y) };
  return null;
}

/** Stänger rutan vägen? En kista står alltid i vägen, en dörr när den är låst eller förseglad. */
export function lockBlocks(g: Game, x: number, y: number): boolean {
  const def = g.map.locks.find((l) => l.x === x && l.y === y);
  if (def?.kind === 'kista') return true;
  if (sealedAt(g, x, y)) return true;
  return !!def && !g.state.locks?.[key(g, x, y)]?.open;
}

/** Lås och dörrar intill figuren. */
export function locksNear(g: Game, a: Actor): LockSpot[] {
  const out: LockSpot[] = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const l = lockAt(g, a.x + dx, a.y + dy);
      if (l) out.push(l);
    }
  return out;
}

/** Är låset låst (en vanlig dörr är aldrig låst)? */
export const isLocked = (l: LockSpot) => !!l.def && !l.state.open;

function near(g: Game, a: Actor, l: LockSpot): string | null {
  if (g.state.mode !== 'explore') return 'Inte nu.';
  if (distance(a.x, a.y, l.x, l.y) > 1) return 'Du måste stå intill.';
  return null;
}

// ------------------------------------------------------------------ dyrka, bryta upp och öppna

export function pickProblem(g: Game, a: Actor, l: LockSpot): string | null {
  const n = near(g, a, l);
  if (n) return n;
  if (sealedAt(g, l.x, l.y)) return 'Den är förseglad med magi.';
  if (!isLocked(l)) return 'Den är inte låst.';
  if (!(a.skills.lasdyrkning ?? 0)) return 'Du kan inte dyrka lås.';
  const pick = PICKS[l.kind];
  if (!g.charOf(a)?.inventory.includes(pick)) return `Det krävs ${l.kind === 'kista' ? 'dyrkar för små lås' : 'dyrkar för större lås'}.`;
  return null;
}

/**
 * Låsdyrkning (tolkning av "differensvärdet nöter ned låsets svårighetsgrad"): varje försök tar en
 * minut. Ett lyckat slag drar differensvärdet (minst 1) från svårighetsgraden, och låset går upp när
 * den når 0. Ett perfekt slag öppnar på en gång.
 */
export function pickLock(g: Game, a: Actor, l: LockSpot): string | null {
  const problem = pickProblem(g, a, l);
  if (problem) return problem;
  const check = g.playerCheck('lasdyrkning');
  advanceTime(g, 60, 'aktiv');
  const left = l.state.left ?? l.def!.difficulty;
  if (check.result === 'perfekt' || (check.success && left - Math.max(1, check.diff) <= 0)) {
    l.state.open = true;
    delete l.state.left;
    g.log(`${a.name} dyrkar upp låset på ${l.name} (${short(check)}).`);
  } else if (check.success) {
    l.state.left = left - Math.max(1, check.diff);
    g.log(`${a.name} arbetar med låset på ${l.name} (${short(check)}). Det ger efter, men håller fortfarande.`);
  } else g.log(`${a.name} försöker dyrka låset på ${l.name} men kommer ingen vart (${short(check)}).`);
  g.changed();
  return null;
}

export function forceProblem(g: Game, a: Actor, l: LockSpot): string | null {
  const n = near(g, a, l);
  if (n) return n;
  if (!isLocked(l) && !sealedAt(g, l.x, l.y)) return 'Den är varken låst eller förseglad.';
  return null;
}

/**
 * Bryta upp (tolkning): STY mot låsets svårighetsgrad på motståndstabellen, och 20 till om den är
 * förseglad. Ett försök tar en minut och hörs.
 */
export function forceLock(g: Game, a: Actor, l: LockSpot): string | null {
  const problem = forceProblem(g, a, l);
  if (problem) return problem;
  const sealed = sealedAt(g, l.x, l.y);
  const sg = (isLocked(l) ? (l.state.left ?? l.def!.difficulty) : 0) + (sealed ? SEAL_EXTRA : 0);
  const check: Check = resistance(a.attrs.STY, sg, g.rng);
  advanceTime(g, 60, 'aktiv');
  if (check.success) {
    l.state.open = true;
    delete l.state.left;
    delete l.state.sealed;
    g.log(`${a.name} bryter upp ${l.name} med ett brak (STY ${a.attrs.STY} mot ${sg}, ${short(check)}).`);
  } else g.log(`${a.name} sliter i ${l.name}, men den håller (STY ${a.attrs.STY} mot ${sg}, ${short(check)}).`);
  g.changed();
  return null;
}

export function lootProblem(g: Game, a: Actor, l: LockSpot): string | null {
  const n = near(g, a, l);
  if (n) return n;
  if (l.kind !== 'kista' || !l.def) return 'Det finns ingen kista här.';
  if (isLocked(l) || sealedAt(g, l.x, l.y)) return 'Kistan är stängd.';
  if (l.state.looted) return 'Kistan är tom.';
  return null;
}

/** Tömmer en olåst kista: föremålen hamnar i packningen och silvret i börsen. */
export function lootChest(g: Game, a: Actor, l: LockSpot): string | null {
  const problem = lootProblem(g, a, l);
  if (problem) return problem;
  l.state.looted = true;
  const ch = g.charOf(a)!;
  const silver = l.def!.silver ? Math.max(0, roll(l.def!.silver, g.rng)) : 0;
  g.leader.silver += silver;
  const items = l.def!.loot ?? [];
  ch.inventory.push(...items);
  const names = items.map((id) => WEAPONS[id]?.name ?? id);
  g.log(`${a.name} öppnar ${l.name}: ${[silver ? `${silver} silvermynt` : '', ...names].filter(Boolean).join(', ') || 'den är tom'}.`);
  g.changed();
  return null;
}

// ------------------------------------------------------------------ ÖPPNA och FÖRSEGLA

/** ÖPPNA: låset går upp. En försegling bryts om E övervinner förseglingens E. */
export function magicOpen(g: Game, l: LockSpot, grade: number) {
  if (sealedAt(g, l.x, l.y)) {
    const r = resistance(grade, l.state.sealed!.grade, g.rng);
    if (!r.success) {
      g.log(`Förseglingen på ${l.name} står emot (E${grade} mot E${l.state.sealed!.grade}, ${short(r)}).`);
      return;
    }
    g.log(`Förseglingen på ${l.name} bryts (E${grade} mot E${l.state.sealed!.grade}, ${short(r)}).`);
    delete l.state.sealed;
  }
  if (isLocked(l)) {
    l.state.open = true;
    delete l.state.left;
    g.log(`Låset på ${l.name} klickar upp.`);
  } else g.log(`${l.name[0].toUpperCase()}${l.name.slice(1)} är öppen.`);
}

/** FÖRSEGLA: dörren eller kistan sitter ihop så länge besvärjelsen varar. */
export function magicSeal(g: Game, l: LockSpot, grade: number, seconds: number) {
  l.state.sealed = { until: g.state.time + seconds, grade };
  g.log(`${l.name[0].toUpperCase()}${l.name.slice(1)} smälter samman med sin karm och sitter som berget.`);
}

/** Lås som en besvärjelse kan riktas mot: de som magikern kan röra vid. */
export function lockTargets(g: Game, a: Actor): LockSpot[] {
  return locksNear(g, a);
}

/** Varför låset inte kan dyrkas, och om figuren över huvud taget kan pröva (för gränssnittet). */
export function lockSummary(g: Game, l: LockSpot): string {
  const parts = [l.name];
  if (sealedAt(g, l.x, l.y)) parts.push('förseglad');
  else if (isLocked(l)) parts.push('låst');
  else if (l.kind === 'kista') parts.push(l.state.looted ? 'tom' : 'öppen');
  return parts.join(', ');
}
