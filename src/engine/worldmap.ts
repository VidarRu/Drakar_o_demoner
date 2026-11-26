/**
 * Världskartan (Vidar, efter steg 8). Besluten står i docs/regelbeslut.md under Världskartan.
 *
 * - En ruta är en kvart i vanlig terräng. Tät skog och kullar tar dubbelt så lång tid, berg fyra
 *   gånger, och en flod korsas på en kvart över en bro och på två vid ett vadställe.
 * - Gruppen går som en figur. Fienderna är grupper med en ikon (BandState) som vandrar runt.
 * - Smyga är passivt: när en fiendegrupp får syn på gruppen slås gruppens lägsta Smyga mot
 *   gruppens högsta Finna dolda ting på motståndstabellen, en gång. Lyckas det går fienderna åt ett
 *   annat håll; misslyckas det jagar de. En grupp som jagar följer spåret när den tappar gruppen ur
 *   sikte (Spåra), utom när alla i gruppen är SPÅRLÖSA.
 * - Hinner fienderna ifatt, eller anfaller gruppen dem, blir det ett stridsmöte på stridskartan för
 *   terrängen. Efter striden går gruppen ut genom kanten och kommer tillbaka där mötet började.
 * - Mötesplatser (byar, grottor) går man in i genom att kliva på ikonen.
 * - Slumpmöten: ett slag per timme färd på en generisk tabell per terräng (platshållare).
 */
import { BANDS, BATTLE_MAPS, CREATURES, ENCOUNTER_TABLES, MAPS } from '../content';
import * as combat from './combat';
import { die } from './dice';
import { makeBand, spawnCreature, type Game } from './game';
import { cheapestPath, distance, lineOfSight, TILES, walkable, type Point } from './map';
import { ARMOR } from '../data/armor';
import {
  BATTLE_TERRAIN,
  HOUR,
  isDaylight,
  resistance,
  skillCheck,
  TERRAIN_COST,
  TRAVEL,
  type Check,
  type Terrain,
} from './rules';
import * as time from './time';
import type { Actor, BandState } from './types';

// ------------------------------------------------------------------ terräng och sikt

export const isWorld = (g: Game) => g.map.kind === 'värld';

export function terrainAt(g: Game, x: number, y: number): Terrain {
  return TILES[g.map.tiles[y * g.map.w + x]]?.terrain ?? 'slätt';
}

/** Hur många kvartar det tar att gå in på rutan. */
export function stepCost(g: Game, x: number, y: number): number {
  return TERRAIN_COST[terrainAt(g, x, y)];
}

/** Minuterna som ett steg in på rutan tar. */
export function stepMinutes(g: Game, x: number, y: number): number {
  return stepCost(g, x, y) * g.map.stepMinutes;
}

/** Gruppens synhåll på världskartan: kortare på natten, utom för den som har mörkersyn. */
export function partySight(g: Game): number {
  const dark = g.partyMembers().some((a) => a.darkvision);
  return isDaylight(g.state.time) || dark ? TRAVEL.sight.dag : TRAVEL.sight.natt;
}

function bandSight(g: Game, b: BandState): number {
  const dark = b.members.some((c) => CREATURES[c]?.darkvision);
  return isDaylight(g.state.time) || dark ? TRAVEL.sight.dag : TRAVEL.sight.natt;
}

/** Inom synhållet: samma cirkel som gruppens synfält (computeFov), så att båda ser lika långt. */
export const withinSight = (dx: number, dy: number, r: number) => dx * dx + dy * dy <= r * r + r;

/** Ser fiendegruppen gruppen? */
export function bandSees(g: Game, b: BandState): boolean {
  const p = g.leader;
  return withinSight(b.x - p.x, b.y - p.y, bandSight(g, b)) && lineOfSight(g.map, b.x, b.y, p.x, p.y);
}

/** Gruppens högsta Finna dolda ting (Vidar: 6–12 efter hur vaksamma varelserna är). */
export function bandSpot(b: BandState): number {
  return Math.max(...b.members.map((c) => CREATURES[c]?.skills.finna_dolda_ting ?? TRAVEL.defaultSpot));
}

/** Gruppens högsta Spåra, eller 0 om ingen kan spåra. */
export function bandTrack(b: BandState): number {
  return Math.max(0, ...b.members.map((c) => CREATURES[c]?.skills.spara ?? 0));
}

/** Smyga för en i gruppen på världskartan: bördan räknas, och rustning som klirrar halverar. */
export function travelSneak(g: Game, a: Actor): number {
  const fv = g.skillFv(a, 'smyga');
  const noisy = a.armor.some((id) => ARMOR[id]?.noisy && (a.bv[id] ?? 1) > 0);
  return fv + combat.skillMod(g, a, 'smyga') - (noisy ? Math.ceil(fv / 2) : 0);
}

/** Den i gruppen som smyger sämst (Vidar: gruppens lägsta Smyga). */
export function worstSneaker(g: Game): { who: Actor; fv: number } {
  const all = g.partyMembers().map((a) => ({ who: a, fv: travelSneak(g, a) }));
  return all.reduce((a, b) => (b.fv < a.fv ? b : a));
}

// ------------------------------------------------------------------ gruppen går

const placeAt = (g: Game, x: number, y: number) => g.map.places.find((p) => p.x === x && p.y === y);
const exitAt = (g: Game, x: number, y: number) => g.map.exits.find((e) => e.x === x && e.y === y);

/** Den billigaste vägen dit på världskartan. */
export function travelPath(g: Game, to: Point, adjacentOk = false): Point[] | null {
  const p = g.leader;
  return cheapestPath(g.map, p, to, (x, y) => stepCost(g, x, y), (x, y) => !!g.bandAt(x, y), adjacentOk);
}

/**
 * Ett steg på världskartan: hela gruppen går till rutan, och tiden går efter terrängen. Sedan rör
 * sig fiendegrupperna, och ett slumpmöte kan dyka upp. En mötesplats tar gruppen in på sin karta.
 */
export function travelStep(g: Game, to: Point): boolean {
  const p = g.leader;
  if (!combat.canAct(p) || distance(p.x, p.y, to.x, to.y) !== 1 || !walkable(g.map, to.x, to.y) || g.bandAt(to.x, to.y)) return false;
  const quarters = stepCost(g, to.x, to.y);
  const minutes = quarters * g.map.stepMinutes;
  for (const m of g.partyMembers()) {
    combat.face(m, to.x, to.y);
    m.x = to.x;
    m.y = to.y;
  }
  time.advanceTime(g, minutes * 60, 'aktiv');
  g.updateFov();
  if (g.state.mode === 'explore') bandsAct(g, quarters * (g.map.stepMinutes / 15));
  if (g.state.mode === 'explore') randomEncounters(g, minutes);
  if (g.state.mode === 'explore') {
    const place = placeAt(g, to.x, to.y);
    if (place) {
      g.log(`Ni går in i ${place.name}.`);
      g.enterMap(place.map);
    } else if (exitAt(g, to.x, to.y)) g.openUi('exit');
  }
  g.changed();
  return true;
}

/** Tar en utgång till en annan karta i modulen: från en mötesplats ut på världskartan, eller från en stridskarta tillbaka. */
export function takeExit(g: Game, exit: { to?: string; name: string }) {
  if (!exit.to) return;
  if (exit.to === 'tillbaka') {
    leaveBattle(g);
    return;
  }
  const from = g.state.mapId;
  const target = MAPS[exit.to];
  // Ut på världskartan står gruppen på mötesplatsens ikon.
  let at: Point | undefined;
  const r = target.rows.findIndex((row) => [...row].some((ch) => target.places?.[ch]?.map === from));
  if (r >= 0) at = { x: [...target.rows[r]].findIndex((ch) => target.places?.[ch]?.map === from), y: r };
  g.log(`Ni går ut ur ${g.map.name}.`);
  g.enterMap(exit.to, at);
  g.changed();
}

// ------------------------------------------------------------------ fiendegrupperna

const bandCanPass = (g: Game, x: number, y: number) => walkable(g.map, x, y) && !placeAt(g, x, y) && !exitAt(g, x, y);

function moveBandTo(g: Game, b: BandState, x: number, y: number) {
  b.x = x;
  b.y = y;
}

/** Fiendegrupperna rör sig och ser efter gruppen. Hinner en grupp som jagar ifatt blir det ett stridsmöte. */
export function bandsAct(g: Game, quarters: number) {
  const bands = g.state.bands ?? [];
  for (const b of [...bands]) {
    moveBand(g, b, quarters);
    look(g, b);
    if (b.mode === 'jagar' && distance(b.x, b.y, g.leader.x, g.leader.y) <= 1) {
      startEncounter(g, b, false);
      return;
    }
  }
  // Slumpmöten som inte jagar försvinner efter en tid, när gruppen inte ser dem.
  g.state.bands = bands.filter((b) => !(b.expires && b.expires <= g.state.time && b.mode !== 'jagar' && !g.isVisible(b.x, b.y)));
}

/** Fiendegruppen ser efter gruppen. Första gången den ser den slår gruppen Smyga. */
export function look(g: Game, b: BandState) {
  const p = g.leader;
  if (!bandSees(g, b)) {
    // Ur sikte: nästa gång gruppen syns slås ett nytt slag.
    b.evaded = false;
    if (b.mode === 'jagar') loseSight(g, b);
    return;
  }
  if (b.mode === 'jagar') {
    b.goal = { x: p.x, y: p.y };
    return;
  }
  if (b.evaded) return;
  const { who, fv } = worstSneaker(g);
  const spot = bandSpot(b);
  const check = resistance(fv, spot, g.rng);
  const roll = `${who.name}s Smyga ${fv} mot Finna dolda ting ${spot}, ${describe(check)}`;
  const seen = g.isVisible(b.x, b.y);
  if (check.success) {
    b.mode = 'undviker';
    b.away = TRAVEL.evadeQuarters;
    b.evaded = true;
    b.goal = undefined;
    g.gainExperience(who, 'smyga', check);
    g.log(seen ? `Ni smyger förbi: ${b.name.toLowerCase()} går åt ett annat håll (${roll}).` : `Något rör sig i närheten, men ni tar er förbi oupptäckta (${roll}).`);
  } else {
    b.mode = 'jagar';
    b.goal = { x: p.x, y: p.y };
    g.log(`${seen ? b.name : 'Något'} får syn på er och jagar er (${roll})!`);
  }
}

const describe = (c: Check) => `T20: ${c.roll} mot ${c.target}`;

/** En grupp som jagar har tappat gruppen ur sikte: den följer spåret med Spåra, om inte alla är SPÅRLÖSA. */
function loseSight(g: Game, b: BandState) {
  const members = g.partyMembers();
  if (members.every((a) => combat.hasEffect(a, 'spårlös'))) {
    giveUp(b);
    g.log('Era förföljare hittar inga spår efter er (SPÅRLÖS) och ger upp.');
    return;
  }
  const track = bandTrack(b);
  if (track > 0) {
    const check = skillCheck(track, g.rng);
    if (check.success) {
      b.goal = { x: g.leader.x, y: g.leader.y };
      return;
    }
    giveUp(b);
    g.log(`Era förföljare tappar spåret (Spåra, ${describe(check)}).`);
    return;
  }
  // Utan Spåra går gruppen till platsen där den såg er sist och ger upp där.
  if (!b.goal || (b.x === b.goal.x && b.y === b.goal.y)) {
    giveUp(b);
    g.log('Era förföljare har tappat bort er.');
  }
}

function giveUp(b: BandState) {
  b.mode = 'vandrar';
  b.goal = undefined;
  b.home = { x: b.x, y: b.y };
  b.budget = 0;
}

/** Fiendegruppen rör sig efter sitt läge. En grupp som jagar skyndar sig (dubbel takt). */
function moveBand(g: Game, b: BandState, quarters: number) {
  const p = g.leader;
  const others = (x: number, y: number) => (g.state.bands ?? []).some((o) => o !== b && o.x === x && o.y === y) || (x === p.x && y === p.y);
  b.budget += quarters * (b.mode === 'jagar' ? TRAVEL.huntPace : 1);
  if (b.mode === 'jagar' || b.mode === 'närmar') {
    const goal = b.goal ?? { x: p.x, y: p.y };
    const path = cheapestPath(g.map, b, goal, (x, y) => stepCost(g, x, y), others, true, (x, y) => bandCanPass(g, x, y)) ?? [];
    while (path.length && b.budget >= stepCost(g, path[0].x, path[0].y)) {
      const next = path.shift()!;
      b.budget -= stepCost(g, next.x, next.y);
      moveBandTo(g, b, next.x, next.y);
      if (b.mode === 'jagar' && distance(b.x, b.y, p.x, p.y) <= 1) break;
    }
    if (!path.length && b.mode === 'närmar') giveUp(b);
    b.budget = Math.min(b.budget, 4);
    return;
  }
  if (b.mode === 'undviker') {
    // Går undan: det steg som ökar avståndet till gruppen mest.
    while (b.budget > 0) {
      const steps = neighbours(g, b).filter((n) => !others(n.x, n.y));
      const best = steps.sort((a, c) => distance(c.x, c.y, p.x, p.y) - distance(a.x, a.y, p.x, p.y))[0];
      if (!best || distance(best.x, best.y, p.x, p.y) < distance(b.x, b.y, p.x, p.y)) break;
      const cost = stepCost(g, best.x, best.y);
      if (b.budget < cost) break;
      b.budget -= cost;
      moveBandTo(g, b, best.x, best.y);
    }
    b.away = (b.away ?? 0) - quarters;
    if (b.away <= 0) giveUp(b);
    b.budget = Math.min(b.budget, 4);
    return;
  }
  // Vandrar: ungefär varannan kvart ett steg åt något håll, inom sitt område.
  const radius = BANDS[b.defId]?.wander ?? TRAVEL.wanderRadius;
  for (let q = 0; q < quarters; q++) {
    if (g.rng() >= TRAVEL.wanderChance) continue;
    const steps = neighbours(g, b).filter((n) => !others(n.x, n.y) && distance(n.x, n.y, b.home.x, b.home.y) <= radius);
    if (!steps.length) continue;
    const next = steps[Math.floor(g.rng() * steps.length)];
    if (b.budget < stepCost(g, next.x, next.y)) continue;
    b.budget -= stepCost(g, next.x, next.y);
    moveBandTo(g, b, next.x, next.y);
  }
  b.budget = Math.min(b.budget, 4);
}

function neighbours(g: Game, b: Point): Point[] {
  return [
    { x: b.x + 1, y: b.y },
    { x: b.x - 1, y: b.y },
    { x: b.x, y: b.y + 1 },
    { x: b.x, y: b.y - 1 },
  ].filter((n) => bandCanPass(g, n.x, n.y));
}

// ------------------------------------------------------------------ slumpmöten

/** Ett slag per timme färd (platshållare: 1 på 1T6). Ett möte är en grupp ur tabellen för terrängen, på väg mot gruppen. */
export function randomEncounters(g: Game, minutes: number) {
  const table = g.map.encounters ? ENCOUNTER_TABLES[g.map.encounters] : undefined;
  if (!table) return;
  g.state.travel = (g.state.travel ?? 0) + minutes;
  while (g.state.travel >= TRAVEL.encounterEvery) {
    g.state.travel -= TRAVEL.encounterEvery;
    if (die(TRAVEL.encounterDie, g.rng) !== TRAVEL.encounterOn) continue;
    const p = g.leader;
    const rows = table[BATTLE_TERRAIN[terrainAt(g, p.x, p.y)]];
    const r = die(6, g.rng);
    const row = rows.find((x) => r >= x.from && r <= x.to);
    const spot = row && randomSpot(g);
    if (!row || !spot) continue;
    const b = makeBand(g.state, row.band, spot.x, spot.y, g.rng);
    b.mode = 'närmar';
    b.goal = { x: p.x, y: p.y };
    b.expires = g.state.time + TRAVEL.randomBandHours * HOUR;
    (g.state.bands ??= []).push(b);
  }
}

/** En ruta strax utanför gruppens synhåll där ett slumpmöte kan börja. */
function randomSpot(g: Game): Point | null {
  const p = g.leader;
  const near = partySight(g) + 1;
  for (let tries = 0; tries < 60; tries++) {
    const d = near + Math.floor(g.rng() * 3);
    const x = p.x + Math.round((g.rng() * 2 - 1) * d);
    const y = p.y + Math.round((g.rng() * 2 - 1) * d);
    if (withinSight(x - p.x, y - p.y, near - 1)) continue;
    if (bandCanPass(g, x, y) && !g.bandAt(x, y)) return { x, y };
  }
  return null;
}

// ------------------------------------------------------------------ stridsmöten

/** Gruppen anfaller en fiendegrupp som står intill. */
export function attackBand(g: Game, id: string): boolean {
  const b = g.state.bands?.find((x) => x.id === id);
  const p = g.leader;
  if (!b || g.state.mode !== 'explore' || !isWorld(g) || distance(b.x, b.y, p.x, p.y) > 1 || !g.isVisible(b.x, b.y)) return false;
  startEncounter(g, b, true);
  g.changed();
  return true;
}

/**
 * Ett stridsmöte: gruppen och fienderna ställs upp på stridskartan för terrängen där gruppen står,
 * och striden börjar. Världskartan sparas med fiendegruppen kvar tills striden är avgjord.
 */
export function startEncounter(g: Game, b: BandState, byParty: boolean) {
  const p = g.leader;
  const terrain = BATTLE_TERRAIN[terrainAt(g, p.x, p.y)];
  const encounter = { band: b.id, map: g.state.mapId, x: p.x, y: p.y };
  g.log(byParty ? `Ni anfaller: ${b.name.toLowerCase()}.` : `${b.name} hinner ifatt er!`);
  g.enterMap(BATTLE_MAPS[terrain]);
  g.state.encounter = encounter;
  const slots = g.map.foes.length ? g.map.foes : [{ x: g.map.w - 3, y: Math.floor(g.map.h / 2) }];
  const foes: Actor[] = [];
  b.members.forEach((c, i) => {
    const at = slots[i % slots.length];
    const spot = freeNear(g, at);
    const a = spawnCreature(g.state, CREATURES[c], spot.x, spot.y, g.rng);
    g.state.actors.push(a);
    foes.push(a);
  });
  g.updateFov();
  combat.startCombat(g, foes);
}

function freeNear(g: Game, at: Point): Point {
  for (let r = 0; r < 6; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const x = at.x + dx;
        const y = at.y + dy;
        if (walkable(g.map, x, y) && !g.actorAt(x, y) && !exitAt(g, x, y)) return { x, y };
      }
  return at;
}

/** När striden är slut får gruppen veta hur den kommer tillbaka till färden. */
export function battleOverHint(g: Game) {
  const e = g.state.encounter;
  if (!e || e.over || g.state.mode !== 'explore') return;
  e.over = true;
  g.log('Striden är över. Gå ut genom kanten i väster för att fortsätta färden.');
}

/**
 * Gruppen lämnar stridskartan och kommer tillbaka till världskartan där mötet började. Är alla
 * fiender besegrade eller på flykt är fiendegruppen borta; annars finns de som är kvar på kartan.
 * Det som ligger kvar på stridsplatsen blir kvar där.
 */
export function leaveBattle(g: Game) {
  const e = g.state.encounter;
  if (!e || g.state.mode !== 'explore') return;
  const party = new Set(g.state.party);
  const left = g.state.actors.filter((a) => a.alive && a.hostile && !a.fled && !party.has(a.id));
  const place = g.state.places[e.map];
  const b = place?.bands?.find((x) => x.id === e.band);
  if (place?.bands && b) {
    if (left.length) {
      b.members = left.map((a) => a.defId);
      b.mode = 'vandrar';
      b.evaded = true;
      b.budget = 0;
      b.goal = undefined;
    } else {
      place.bands = place.bands.filter((x) => x !== b);
      if (b.deathFlag) g.state.flags[b.deathFlag] = true;
    }
  }
  delete g.state.encounter;
  g.enterMap(e.map, { x: e.x, y: e.y });
  g.log('Ni fortsätter färden.');
  g.changed();
}
