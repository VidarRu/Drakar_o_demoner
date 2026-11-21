export type AttrKey = 'STY' | 'STO' | 'FYS' | 'SMI' | 'INT' | 'PSY' | 'KAR';
export const ATTR_KEYS: AttrKey[] = ['STY', 'STO', 'FYS', 'SMI', 'INT', 'PSY', 'KAR'];
export type Attrs = Record<AttrKey, number>;

/** Naturligt vapen eller obeväpnat anfall i äventyrsinnehållet (bett, näve). */
export interface NaturalWeaponDef {
  id: string;
  name: string;
  damage: string;
  /** Färdigheten som används (t.ex. "slagsmal"), eller varelsens egen anfallsnyckel. */
  skill: string;
  /** Om skadebonus läggs till skadan. */
  useDamageBonus: boolean;
}

export interface CreatureDef {
  id: string;
  name: string;
  sprite: string;
  attrs: Attrs;
  skills: Record<string, number>;
  /** Vapen ur regeldatan eller ett naturligt vapen ur innehållet. */
  weapon: string;
  /** Rustningsdelar ur regeldatan. */
  armor?: string[];
  /** Naturligt skydd (päls, hud). */
  naturalArmor?: number;
  shield?: string;
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
  armor: string[];
  naturalArmor: number;
  shield?: string;
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
  version: 2;
  /** Rollformuläret för rollpersonen. */
  character: Character;
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

/** En färdig rollperson enligt reglerna (skapas i engine/creation.ts). */
export interface Character {
  name: string;
  gender: 'man' | 'kvinna';
  race: string;
  profession: string;
  age: { group: string; years: number };
  /** Slutliga grundegenskaper efter ras, förmåga och ålder. */
  attrs: Attrs;
  maxKp: number;
  swordHand: string;
  social: string;
  /** Särskild förmåga: tabellrad, summan av slaget och eventuellt val. */
  ability: { id: string; total: number; choice?: unknown } | null;
  /** Yrkesfärdigheter (nycklar), som är billigare att lära sig. */
  profSkills: string[];
  /** Tekniker i rollpersonens stridskonst. */
  techniques: string[];
  /** FV per färdighetsnyckel, t.ex. "smyga" eller "hantverk:smide". */
  skills: Record<string, number>;
  /** Skicklighetsvärde per besvärjelse. */
  spells: Record<string, number>;
  /** Startkapitalet i silvermynt och vad som är kvar efter inköpen. */
  capital: number;
  silver: number;
  /** Ägda föremål (id ur regeldatan, ett per exemplar). */
  inventory: string[];
  equipped: { weapon?: string; shield?: string; armor: string[] };
  appearance: string;
}
