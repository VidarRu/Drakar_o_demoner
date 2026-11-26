/**
 * Små hjälpfunktioner för besvärjelsernas verkan som striden och magin båda behöver: zoner på
 * kartan (MÖRKER), grundegenskaper som ÖKA och MINSKA har ändrat, FLAMMANDE HAND, VIRVELSKÖLD,
 * MOTSTÅNDSKRAFT, OSYNLIGHET och KAMOUFLAGE. Tolkningarna står i docs/regelbeslut.md.
 */
import { SKILLS } from '../data/skills';
import type { Game } from './game';
import { distance, inBounds, tileAt, walkable } from './map';
import { baseChance } from './rules';
import type { Actor, SpellZone } from './types';

// ------------------------------------------------------------------ zoner

/** Zonerna på den här kartan som fortfarande verkar. De som har gått ut tas bort. */
export function activeZones(g: Game): SpellZone[] {
  const zones = g.state.zones;
  if (!zones?.length) return [];
  const now = g.state.time;
  if (zones.some((z) => z.until <= now)) g.state.zones = zones.filter((z) => z.until > now);
  return (g.state.zones ?? []).filter((z) => !z.map || z.map === g.state.mapId);
}

/** Zonerna av ett visst slag som rutan ligger i. */
export function zonesAt(g: Game, kind: SpellZone['kind'], at: { x: number; y: number }): SpellZone[] {
  return activeZones(g).filter((z) => z.kind === kind && distance(z.x, z.y, at.x, at.y) <= z.r);
}

/** DIMMA: sikten är högst så här många rutor för den som står i dimman eller tittar in i den. */
export const FOG_SIGHT = 10;

/** Skymmer dimman sikten mellan två rutor på det här avståndet? */
export function fogBlocks(g: Game, a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  return distance(a.x, a.y, b.x, b.y) > FOG_SIGHT && (zonesAt(g, 'dimma', a).length > 0 || zonesAt(g, 'dimma', b).length > 0);
}

/** Ligger rutan i en sfär av MÖRKER? Där lyser inga facklor. */
export function inDarkness(g: Game, at: { x: number; y: number }): boolean {
  return zonesAt(g, 'mörker', at).length > 0;
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

// ------------------------------------------------------------------ i luften

/** Svävar figuren (LEVITATION eller FLYGA)? */
export function airborne(a: Actor): boolean {
  return a.effects.some((e) => e.kind === 'svävar');
}

/** Flygfarten med FLYGA, eller null för den som inte svävar. LEVITATION ger 0. */
export function flightSpeed(a: Actor): number | null {
  const e = a.effects.filter((x) => x.kind === 'svävar');
  return e.length ? Math.max(...e.map((x) => x.mod ?? 0)) : null;
}

/** Kan figuren gå in på rutan? Den som flyger tar sig över vatten och träd. */
export function passable(g: Game, a: Actor, x: number, y: number): boolean {
  if (walkable(g.map, x, y)) return true;
  if (!inBounds(g.map, x, y) || !(flightSpeed(a) ?? 0)) return false;
  const name = tileAt(g.map, x, y)?.name;
  return name === 'vatten' || name === 'träd';
}

/** Rutorna mellan två punkter (utan ändpunkterna). */
export function between(a: { x: number; y: number }, b: { x: number; y: number }): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const n = distance(a.x, a.y, b.x, b.y);
  for (let i = 1; i < n; i++) out.push({ x: Math.round(a.x + ((b.x - a.x) * i) / n), y: Math.round(a.y + ((b.y - a.y) * i) / n) });
  return out;
}

// ------------------------------------------------------------------ KONTROLLERA PERSON

/** Magikern som styr figuren, om någon. */
export function controller(a: Actor): string | undefined {
  return a.effects.find((e) => e.kind === 'kontrollerad')?.by;
}
