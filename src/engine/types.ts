export type AttrKey = 'STY' | 'STO' | 'FYS' | 'SMI' | 'INT' | 'PSY' | 'KAR';
export const ATTR_KEYS: AttrKey[] = ['STY', 'STO', 'FYS', 'SMI', 'INT', 'PSY', 'KAR'];
export type Attrs = Record<AttrKey, number>;

export interface WeaponDef {
  id: string;
  name: string;
  /** Färdigheten som används för att anfalla (och parera) med vapnet. */
  skill: string;
  damage: string;
  /** Om skadebonus läggs till skadan. */
  useDamageBonus: boolean;
}

export interface ArmorDef {
  id: string;
  name: string;
  /** Absorberad skada per träff. */
  abs: number;
}

export interface CreatureDef {
  id: string;
  name: string;
  sprite: string;
  attrs: Attrs;
  /** Sätts KP inte räknas det fram från STO och FYS. */
  kp?: number;
  skills: Record<string, number>;
  weapon: string;
  armor?: string;
  shield?: boolean;
  /** Förflyttning i rutor per stridsrunda. */
  move: number;
  hostile: boolean;
  /** Synhåll i rutor för att upptäcka rollpersonen. */
  sight?: number;
  /** Silver som varelsen bär på (tärningsuttryck). */
  silver?: string;
  /** Flagga som sätts när varelsen dör. */
  deathFlag?: string;
  /** Koppling till en spelledarperson med dialog. */
  npc?: string;
}

export interface NpcDef {
  id: string;
  /** Personlighet och roll – skickas till språkmodellen. */
  persona: string;
  /** Vad personen känner till om världen. */
  knowledge: string;
  /** Reservdialog när ingen språkmodell är tillgänglig. */
  greeting: string;
  topics: { text: string; reply: string }[];
  /** Spelmekaniska handlingar som kan utföras i samtal med personen. */
  intents: string[];
}

export interface ProfessionDef {
  id: string;
  name: string;
  desc: string;
  sprite: string;
  skills: Record<string, number>;
  weapon: string;
  armor?: string;
  shield?: boolean;
  silver: string;
}

export interface Actor {
  id: string;
  defId: string;
  name: string;
  kind: 'player' | 'npc' | 'monster';
  sprite: string;
  x: number;
  y: number;
  attrs: Attrs;
  kp: number;
  maxKp: number;
  skills: Record<string, number>;
  /** Färdigheter som fått erfarenhetskryss. */
  marks: string[];
  weapon: string;
  armor?: string;
  shield: boolean;
  move: number;
  hostile: boolean;
  sight: number;
  alive: boolean;
  silver: number;
  profession?: string;
  npc?: string;
  deathFlag?: string;
  /** Tappad balans efter fummel – förlorar nästa handling. */
  stunned: boolean;
}

export interface CombatState {
  round: number;
  /** Turordning (aktörs-id), högst SMI först. */
  order: string[];
  turn: number;
  movesLeft: number;
  /** Vilka som gjort sin handling denna runda. */
  acted: Record<string, boolean>;
  /** Vilka som valt att parera denna runda. */
  parrying: Record<string, boolean>;
  /** Vilka som redan använt sin sköldparering denna runda. */
  shieldUsed: Record<string, boolean>;
}

export type Mode = 'explore' | 'combat' | 'dialog' | 'dead';

export interface GameState {
  version: 1;
  mapId: string;
  playerId: string;
  actors: Actor[];
  explored: number[];
  mode: Mode;
  combat: CombatState | null;
  flags: Record<string, boolean>;
  log: string[];
  nextId: number;
}

export interface NewCharacter {
  name: string;
  profession: string;
  attrs: Attrs;
}
