/**
 * Äventyrsmoduler (steg 8): uppdragsloggen, epilogen, att lämna en modul och att börja nästa.
 * Gruppen, rollformulären, packningen, pengarna, tiden och skadorna följer med mellan modulerna.
 * Besluten står i docs/regelbeslut.md under Äventyrsmoduler.
 */
import { MAPS, MODULES, MODULE_LIST, type ModuleDef, type QuestDef } from '../content';
import type { Rng } from './dice';
import { spawnActors, type Game } from './game';
import { parseMap, walkable, type GameMap } from './map';
import type { Actor, GameState } from './types';

/** Flaggan som visar att epilogen redan har visats. */
const EPILOGUE_SEEN = 'epilog_visad';

export const moduleOf = (g: Game): ModuleDef => MODULES[g.state.moduleId];

export type QuestStatus = 'aktivt' | 'klart' | 'misslyckat';

export interface QuestEntry {
  quest: QuestDef;
  status: QuestStatus;
  /** Delmål som är uppnådda. */
  steps: string[];
}

function questStatus(flags: Record<string, boolean>, q: QuestDef): QuestStatus | null {
  if (flags[q.done]) return 'klart';
  if (q.failed && flags[q.failed]) return 'misslyckat';
  if (!q.start || flags[q.start]) return 'aktivt';
  return null;
}

/** Uppdragsloggen: de uppdrag i modulen som gruppen känner till, huvuduppdraget först. */
export function questLog(g: Game): QuestEntry[] {
  const flags = g.state.flags;
  const out: QuestEntry[] = [];
  for (const q of [...moduleOf(g).quests].sort((a, b) => Number(!!b.main) - Number(!!a.main))) {
    const status = questStatus(flags, q);
    if (!status) continue;
    out.push({ quest: q, status, steps: (q.steps ?? []).filter((s) => flags[s.flag]).map((s) => s.text) });
  }
  return out;
}

export function mainQuestDone(g: Game): boolean {
  const main = moduleOf(g).quests.find((q) => q.main);
  return !!main && !!g.state.flags[main.done];
}

/** Epilogen ska visas: huvuduppdraget är klart och den har inte visats förut. */
export function pendingEpilogue(g: Game): string[] | null {
  const ep = moduleOf(g).epilogue;
  if (!ep?.length || g.state.mode !== 'explore' || g.state.flags[EPILOGUE_SEEN] || !mainQuestDone(g)) return null;
  return ep;
}

/** Efter epilogen: gruppen stannar kvar och kan göra klart sidouppdrag. */
export function stayAfterEpilogue(g: Game) {
  g.state.flags[EPILOGUE_SEEN] = true;
  g.log('Ni stannar kvar en tid. Utgången finns där när ni vill gå vidare.');
  g.changed();
}

/** Gruppen lämnar modulen, med eller utan huvuduppdraget klart. */
export function leaveModule(g: Game) {
  if (g.state.mode !== 'explore') return;
  const mod = moduleOf(g);
  const done = mainQuestDone(g);
  if (done) g.state.flags[EPILOGUE_SEEN] = true;
  if (done && !g.state.completed.includes(mod.id)) g.state.completed.push(mod.id);
  g.state.mode = 'ended';
  g.log(done ? `Äventyret i ${mod.name} är slut.` : `${g.leader.name} lämnar ${mod.name} utan att ha fullbordat uppdraget.`);
  g.changed();
}

/** Moduler som gruppen kan ge sig ut på härnäst. */
export function nextModules(state: GameState): { module: ModuleDef; done: boolean }[] {
  return MODULE_LIST.map((m) => ({ module: m, done: state.completed.includes(m.id) }));
}

/**
 * Börjar en modul med gruppen från den förra. Kartan som gruppen lämnar sparas med det som finns
 * kvar där, och modulens flaggor sparas för sig. Kommer gruppen tillbaka till en karta den har
 * varit på ligger allt kvar som det var. Returnerar ett nytt speltillstånd.
 */
export function startModule(prev: GameState, moduleId: string, rng: Rng): GameState {
  const s: GameState = JSON.parse(JSON.stringify(prev));
  const mod = MODULES[moduleId];
  const party = s.party.map((id) => s.actors.find((a) => a.id === id)).filter((a): a is Actor => !!a && a.alive && !a.elemental);
  s.party = party.map((a) => a.id);
  const inParty = new Set(s.party);
  s.places[s.mapId] = { actors: s.actors.filter((a) => !inParty.has(a.id) && !a.elemental), explored: s.explored, dropped: s.dropped };
  s.moduleFlags[s.moduleId] = s.flags;

  s.moduleId = mod.id;
  s.flags = s.moduleFlags[mod.id] ?? {};
  delete s.moduleFlags[mod.id];
  const map = parseMap(MAPS[mod.start]);
  s.mapId = map.id;
  s.actors = [...party];
  const place = s.places[map.id];
  if (place) {
    s.actors.push(...place.actors);
    s.explored = place.explored;
    s.dropped = place.dropped;
    delete s.places[map.id];
  } else {
    s.explored = new Array(map.w * map.h).fill(0);
    s.dropped = [];
    spawnActors(s, map, rng);
  }
  placeParty(s, map, party);
  for (const m of party) {
    m.sneaking = false;
    m.hidden = false;
    m.reload = 0;
  }
  s.mode = 'explore';
  s.combat = null;
  s.focus = s.playerId;
  s.log.push(`${party.length > 1 ? 'Gruppen' : party[0].name} anländer till ${map.name}.`);
  return s;
}

/** Ställer ledaren på kartans startruta och de andra på lediga rutor nära. */
function placeParty(s: GameState, map: GameMap, party: Actor[]) {
  const taken = (x: number, y: number) => s.actors.some((a) => a.alive && a.x === x && a.y === y && !party.includes(a));
  const used = new Set<string>();
  for (const m of party) {
    let spot: { x: number; y: number } | null = null;
    for (let r = 0; r < 8 && !spot; r++) {
      for (let dy = -r; dy <= r && !spot; dy++) {
        for (let dx = -r; dx <= r && !spot; dx++) {
          const x = map.start.x + dx;
          const y = map.start.y + dy;
          if (walkable(map, x, y) && !map.exits.some((e) => e.x === x && e.y === y) && !taken(x, y) && !used.has(`${x},${y}`)) spot = { x, y };
        }
      }
    }
    spot ??= map.start;
    used.add(`${spot.x},${spot.y}`);
    m.x = spot.x;
    m.y = spot.y;
  }
}

/** Anteckningarna till språkmodellen om modulens flaggor. */
export function flagNotes(g: Game): string[] {
  const notes = moduleOf(g).flagNotes;
  return Object.keys(g.state.flags).filter((f) => g.state.flags[f] && notes[f]).map((f) => notes[f]);
}
