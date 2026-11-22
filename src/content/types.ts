/**
 * Hur en äventyrsmodul är uppbyggd (steg 8). Varje modul ligger i en egen mapp under
 * src/content/ och innehåller allt om äventyret. Besluten står i docs/regelbeslut.md under
 * Äventyrsmoduler.
 */
import type { Intent } from '../engine/intents';
import type { MapDef } from '../engine/map';
import type { Character, CompanionInfo, CreatureDef, NpcDef } from '../engine/types';

/** Rekommenderad svårighetsgrad. Systemet har inga nivåer, och fienderna anpassas inte. */
export type Difficulty = 'lätt' | 'medel' | 'svår';

/**
 * Ett uppdrag. Läget räknas fram ur modulens flaggor: uppdraget är känt när `start` är satt
 * (eller från början om `start` saknas), klart när `done` är satt och misslyckat när `failed` är satt.
 */
export interface QuestDef {
  id: string;
  name: string;
  /** Huvuduppdraget. En modul har ett. */
  main?: boolean;
  /** Kort beskrivning i uppdragsloggen. */
  description: string;
  start?: string;
  done: string;
  failed?: string;
  /** Delmål som visas i loggen när deras flagga är satt, i tur och ordning. */
  steps?: { flag: string; text: string }[];
}

/**
 * En person som kan följa med rollpersonen (husregel, steg 7). Hen skapas med samma regler som
 * rollpersonen, så att hen har ett fullständigt rollformulär. Varje modul har sina egna.
 */
export interface RecruitDef {
  id: string;
  /** Visningsnamn i samtalet. */
  name: string;
  sprite: string;
  /** Spelledarpersonen med dialog (NPCS). */
  npc: string;
  pay: CompanionInfo['pay'];
  wage?: number;
  morale: CompanionInfo['morale'];
  character: () => Character;
}

export interface ModuleDef {
  id: string;
  name: string;
  /** Kort presentation när man väljer äventyr. */
  description: string;
  difficulty: Difficulty;
  /** Ingår i kampanjen. Speltestmodulen gör det inte. */
  campaign: boolean;
  /** Kartan där gruppen börjar (världskartan, eller den enda mötesplatsen). */
  start: string;
  maps: MapDef[];
  creatures: CreatureDef[];
  npcs: NpcDef[];
  recruits: RecruitDef[];
  quests: QuestDef[];
  /** Samtalsval som bara finns i den här modulen. */
  intents?: Record<string, Intent>;
  /** Anteckningar till språkmodellen beroende på modulens flaggor. */
  flagNotes: Record<string, string>;
  /** Epilogen när huvuduppdraget är klart, ett stycke per rad. */
  epilogue?: string[];
}
