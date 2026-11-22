import type { GameState } from './types';

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
