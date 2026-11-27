import type { GameState } from './types';
import { MODULES } from '../content';
import { PROFESSIONS } from '../data/professions';
import { RACES } from '../data/races';
import { clockText } from './time';

/** Version 7: äventyrsmoduler, uppdrag och kartor som sparas när gruppen lämnar dem. Äldre sparningar kan inte läsas. */
const KEY = 'dod-save-v7';

export function saveGame(state: GameState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Lagring kan vara avstängd (privat läge) – spelet fungerar ändå.
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const state = JSON.parse(raw) as GameState;
    return state.version === 7 ? state : null;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Se ovan.
  }
}

/** Kort beskrivning av en sparning, till listan i startmenyn. */
export interface SaveSummary {
  name: string;
  race: string;
  profession: string;
  module: string;
  clock: string;
}

/** Läser rollpersonens uppgifter direkt ur tillståndet, utan att bygga ett spel. */
export function saveSummary(state: GameState): SaveSummary {
  const c = state.character;
  return {
    name: c.name,
    race: RACES[c.race]?.name ?? c.race,
    profession: PROFESSIONS[c.profession]?.name ?? c.profession,
    module: MODULES[state.moduleId]?.name ?? state.moduleId,
    clock: clockText(state.time),
  };
}

/** Sparningarna som finns att ladda. Än så länge en enda plats, men formen rymmer flera. */
export function listSaves(): { key: string; summary: SaveSummary }[] {
  const state = loadGame();
  return state ? [{ key: KEY, summary: saveSummary(state) }] : [];
}
