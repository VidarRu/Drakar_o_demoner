/**
 * Små hjälpfunktioner för besvärjelsernas verkan som striden och magin båda behöver: zoner på
 * kartan (MÖRKER), grundegenskaper som ÖKA och MINSKA har ändrat, FLAMMANDE HAND, VIRVELSKÖLD,
 * MOTSTÅNDSKRAFT, OSYNLIGHET och KAMOUFLAGE. Tolkningarna står i docs/regelbeslut.md.
 */
import { SKILLS } from '../data/skills';
import type { Game } from './game';
import { distance, tileAt } from './map';
import { baseChance } from './rules';
import type { Actor, SpellZone } from './types';

// ------------------------------------------------------------------ zoner

/** Zonerna som fortfarande verkar. De som har gått ut tas bort. */
export function activeZones(g: Game): SpellZone[] {
  const zones = g.state.zones;
  if (!zones?.length) return [];
  const now = g.state.time;
  if (zones.some((z) => z.until <= now)) g.state.zones = zones.filter((z) => z.until > now);
  return g.state.zones ?? [];
}

/** Ligger rutan i en sfär av MÖRKER? Där lyser inga facklor. */
export function inDarkness(g: Game, at: { x: number; y: number }): boolean {
  return activeZones(g).some((z) => z.kind === 'mörker' && distance(z.x, z.y, at.x, at.y) <= z.r);
}

/** Utomhus: gräs och stig (KAMOUFLAGE). */
export function outdoors(g: Game, at: { x: number; y: number }): boolean {
  return !!tileAt(g.map, at.x, at.y)?.outdoor;
}

// ------------------------------------------------------------------ ÖKA och MINSKA

/**
 * Ändringen i baschans för färdigheten när ÖKA eller MINSKA har ändrat grundegenskapen den bygger
 * på (tolkning: gäller alla färdigheter som bygger på grundegenskapen så länge besvärjelsen varar).
 */
export function attrShift(a: Actor, skill: string): number {
  const attr = SKILLS[skill.split(':')[0]]?.attr;
  if (!attr) return 0;
  let shift = 0;
  for (const e of a.effects) {
    if (e.kind !== 'egenskap' || e.attr !== attr || !e.mod) continue;
    const now = a.attrs[attr];
    shift += baseChance(now) - baseChance(now - e.mod);
  }
  return shift;
}

// ------------------------------------------------------------------ eld, köld och projektiler

/** FLAMMANDE HAND: effektgraden, eller 0. */
export function flamingHand(a: Actor): number {
  return a.effects.filter((e) => e.kind === 'flammandeHand').reduce((n, e) => n + (e.grade ?? 0), 0);
}

/** VIRVELSKÖLD: projektiler till och från figuren missar. */
export function inVortex(a: Actor): boolean {
  return a.effects.some((e) => e.kind === 'virvelsköld');
}

/** MOTSTÅNDSKRAFT: så mycket mindre skada per angrepp av eld eller köld. */
export function heatColdResist(a: Actor): number {
  return a.effects.filter((e) => e.kind === 'motståndskraft').reduce((n, e) => n + (e.grade ?? 0), 0);
}

// ------------------------------------------------------------------ OSYNLIGHET och KAMOUFLAGE

/** Är figuren osynlig eller kamouflerad genom magi? */
export function magicallyHidden(a: Actor): boolean {
  return a.effects.some((e) => e.kind === 'osynlig' || e.kind === 'kamouflage');
}

/** Kan `viewer` inte se `x`? MAGISK SYN ser den som är osynlig, men inte den som smyger. */
export function unseen(viewer: Actor, x: Actor): boolean {
  if (!x.hidden) return false;
  if (x.sneaking) return true;
  if (viewer.effects.some((e) => e.kind === 'magiskSyn') && x.effects.some((e) => e.kind === 'osynlig')) return false;
  return true;
}

/**
 * OSYNLIGHET bryts när den osynlige anfaller, springer, lägger magi eller skadas, och KAMOUFLAGE
 * likaså (och när magikern flyttar sig).
 */
export function breakHiding(g: Game, a: Actor, why: string) {
  const gone = a.effects.filter((e) => e.kind === 'osynlig' || e.kind === 'kamouflage');
  if (!gone.length) return;
  a.effects = a.effects.filter((e) => !gone.includes(e));
  if (!a.sneaking) a.hidden = false;
  g.log(`${a.name} ${why} och syns igen.`);
}

/** KAMOUFLAGE bryts när magikern lämnar rutan. */
export function checkCamouflage(g: Game, a: Actor) {
  const e = a.effects.find((x) => x.kind === 'kamouflage');
  if (e?.at && (e.at.x !== a.x || e.at.y !== a.y)) breakHiding(g, a, 'flyttar sig');
}
