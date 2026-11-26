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
  /** Bonus-EP till var och en i gruppen när uppdraget är klart (Bok I: 1–4). */
  bonusEp?: number;
  /** Hjältepoäng till var och en i gruppen när uppdraget är klart. */
  heroPoints?: number;
}

/**
 * Något gruppen kan göra i modulen som ger bonus-EP eller hjältepoäng (steg 8): en ovanligt svår
 * gärning (1–2 EP), ett bra val i rollspelet (rollspelsbonus) eller ett dåd. Belöningen delas ut
 * en gång, till var och en i gruppen, när flaggan sätts. Minuspoäng går för ohjältemodiga dåd.
 */
export interface DeedDef {
  id: string;
  flag: string;
  /** Kort text till loggen, t.ex. "Ni dödade Grukk i envig". */
  text: string;
  kind: 'gärning' | 'rollspel' | 'dåd';
  ep?: number;
  heroPoints?: number;
}

/**
 * En bok som går att studera (steg 8). En veckas studier är ensamträning i ämnet, tills läsaren
 * har fått bokens tak i EP. En magisk kodex lär i stället ut en besvärjelse.
 */
export interface BookDef {
  id: string;
  name: string;
  /** Kort egen beskrivning. */
  description: string;
  weight: number;
  price: number;
  /** Ämnet: färdigheten som studierna ger EP i. */
  skill?: string;
  /** Högsta antal EP en läsare kan få ur boken (oftast 5 eller 10). */
  maxEp?: number;
  /** Magisk kodex: besvärjelsen som boken lär ut. */
  spell?: string;
  /**
   * Läsnivån i Läsa/Skriva som krävs (B1–B5). Saknas den räknas den fram ur bokens tak i EP,
   * och magiska skrifter kräver alltid B4 (Vidar).
   */
  readLevel?: number;
  /** Språket boken är skriven på. Saknas det räcker Läsa/Skriva modersmål. */
  language?: string;
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
  /** Gärningar, rollspelsval och dåd som ger bonus-EP och hjältepoäng. */
  deeds?: DeedDef[];
  /** Böcker som går att hitta i modulen. */
  books?: BookDef[];
  /** Scener där en besvärjelse visar något särskilt (SYN, TELEPATI, TANKEÖVERFÖRING …). */
  spellScenes?: SpellSceneDef[];
}

/**
 * En scen i modulen som en besvärjelse kan visa: en syn, en röst genom TELEPATI, ett minne i ett
 * föremål. Den visas när någon i gruppen lägger besvärjelsen och den lyckas, på rätt plats och när
 * flaggorna stämmer. Texten skrivs i loggen, och flaggan berättar det för AI-spelledaren.
 */
export interface SpellSceneDef {
  id: string;
  /** Besvärjelserna som visar scenen (id i src/data/spells.ts). */
  spells: string[];
  /** Kartan, och platsen där magikern måste stå (inom r rutor). Utan den gäller hela modulen. */
  map?: string;
  at?: { x: number; y: number; r: number };
  /** Bara när flaggan är satt, eller bara när den inte är det. */
  ifFlag?: string;
  unlessFlag?: string;
  /** Vad magikern ser, hör eller får veta. */
  text: string;
  /** Flaggan som sätts när scenen visas. */
  setFlag?: string;
  /** Visas bara en gång. */
  once?: boolean;
}
