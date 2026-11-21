import type { HitLocation } from './rules/tables';
import type { Scope } from './rules/outcomes';

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
  /** Humanoid: strider detaljerat med träffområden och parering. Djur och monster strider vanligt. */
  humanoid: boolean;
  /** Synhåll i rutor för att upptäcka rollpersonen. */
  sight?: number;
  /** Ser i mörker (inga avdrag för mörker i strid). */
  darkvision?: boolean;
  /** Ledare för sin grupp: om hen faller slår de andra moralslag. */
  leader?: boolean;
  /** Lyder inte under moralreglerna och slåss till slutet. */
  noMorale?: boolean;
  /** Skräckslå: [automatiskt, aktivt]. null = kan inte. */
  fear?: [number | null, number | null];
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

/** En pågående följd av en fummel, skräck eller skada, med hur länge den varar. */
export interface ActiveEffect {
  kind:
    | 'cl'
    | 'misslyckas'
    | 'endastParera'
    | 'ingenHandling'
    | 'ingenParering'
    | 'liggande'
    | 'medvetslös'
    | 'motståndarBonus'
    | 'utsatt'
    | 'förflyttning'
    | 'flyr'
    | 'bärsärk'
    | 'skräckMod'
    | 'dödsfara'
    | 'armUr';
  /** Kort text till rollformuläret och loggen. */
  label: string;
  mod?: number;
  /** Halverar i stället för att lägga till (SMI-färdigheter, förflyttning). */
  half?: boolean;
  scope?: Scope;
  /** Vapnet som modifikationen gäller (scope 'vapen'). */
  slot?: WeaponSlot;
  noParry?: boolean;
  random?: boolean;
  /** Rundor kvar, inklusive den pågående. */
  rounds?: number;
  days?: number;
  uses?: number;
  untilPerfect?: boolean;
  untilFixed?: boolean;
  untilRest?: boolean;
  /** Varar så länge den här aktören finns kvar (skräckkällan). */
  sourceId?: string;
}

export type WeaponSlot = 'weapon' | 'offhand';

/** Bestående skada efter en kritisk träff i en arm eller ett ben. */
export interface Injury {
  loc: HitLocation;
  id: string;
  text: string;
  cl: number;
  lost: boolean;
  legMove?: number;
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
  /** Detaljerad strid med träffområden (humanoider). Andra har bara totala KP. */
  detailed: boolean;
  locKp: Record<HitLocation, number>;
  locMax: Record<HitLocation, number>;
  /** Kroppsdelar som nått 0 KP och blöder tills någon lägger förband. */
  bleeding: HitLocation[];
  /** Rundor sedan blödningen senast tog en KP. */
  bleedTimer: number;
  /** Kroppsdelar som inte går att använda (0 KP eller kritiskt skadade). */
  disabled: HitLocation[];
  /** Kroppsdelar som redan har slagit på tabellen för kritiska skador. */
  critical: HitLocation[];
  injuries: Injury[];
  skills: Record<string, number>;
  /** Erfarenhetspoäng per färdighet, som växlas in mot FV efter en veckas vila. */
  ep: Record<string, number>;
  /** Färdigheter som redan gett EP sedan senaste sömnen. */
  epBlocked: string[];
  /** Kvarvarande PSY-poäng (högst PSY). */
  psy: number;
  /** Infekterade kroppsdelar: läker inte förrän infektionen gått över (speltid i sekunder). */
  infections: { loc: HitLocation; until: number; gangrene: boolean }[];
  /** Sår från den pågående striden, för infektionsslagen efteråt. */
  combatWounds: { loc: HitLocation; dmg: number; kind: 'egg' | 'smutsig' }[];
  /** Läktimmar och PSY-timmar som samlats men ännu inte gett en poäng. */
  healHours: number;
  psyHours: number;
  /** Sammanhängande vila i sekunder (för att växla in EP krävs sju dagar). */
  restSeconds: number;
  /** Dagen då Läkekonst senast användes på aktören. */
  medicineDay: number;
  weapon: string;
  /** Vapen i den andra handen (Två vapen). */
  offhand?: string;
  armor: string[];
  naturalArmor: number;
  shield?: string;
  /** Kvarvarande BV: 'weapon', 'offhand', 'shield' och rustningsdelarnas id. */
  bv: Record<string, number>;
  swordArm: HitLocation;
  move: number;
  hostile: boolean;
  sight: number;
  darkvision: boolean;
  alive: boolean;
  /** Medvetslös: kan inget göra och kan inte parera. */
  unconscious: boolean;
  /** Utslagen men vid medvetande: kan bara krypa (bål på 0 KP, misslyckat PSY-slag, 1 KP kvar). */
  down: boolean;
  /** Har flytt från platsen. */
  fled: boolean;
  /** Riktningen figuren vänder sig åt, för anfall från sidan och bakifrån. */
  facing: { dx: number; dy: number };
  effects: ActiveEffect[];
  silver: number;
  profession?: string;
  npc?: string;
  deathFlag?: string;
  leader?: boolean;
  noMorale?: boolean;
  fear?: [number | null, number | null];
  /** Orsaker som redan har gett ett moralslag. */
  morale: string[];
  /** Tillägg på initiativslaget. */
  initiative: number;
  /** Snabbslående: agerar alltid först. */
  firstAlways?: boolean;
}

export interface CombatState {
  round: number;
  /** Turordning (aktörs-id), högst initiativ först. */
  order: string[];
  /** Initiativslagen den här rundan. */
  initiative: Record<string, number>;
  turn: number;
  movesLeft: number;
  /** Vilka som gjort sin handling denna runda. */
  acted: Record<string, boolean>;
  /** Pareringar denna runda: antal med avdrag, och om sköldens fria parering är använd. */
  parries: Record<string, { count: number; shieldFree: boolean }>;
  /** Kroppsdel som rollpersonen siktar på (−5), eller null för slumpvis. */
  aim: HitLocation | null;
  /** Varelser som redan har skräckslagit rollpersonen automatiskt eller aktivt. */
  scared: string[];
  /** Runda 0: de som lyckades med Dra vapen och får en gratis tur innan den vanliga turordningen. */
  freeRound?: string[];
}

/** Ett föremål som ligger på marken (tappat i strid). */
export interface DroppedItem {
  item: string;
  slot: WeaponSlot | 'shield' | 'armor';
  owner: string;
  x: number;
  y: number;
  bv?: number;
}

export type Mode = 'explore' | 'combat' | 'dialog' | 'dead';

export interface GameState {
  version: 4;
  /** Speltid i sekunder sedan dag 1 klockan 00:00. */
  time: number;
  /** Rollformuläret för rollpersonen. */
  character: Character;
  mapId: string;
  playerId: string;
  actors: Actor[];
  explored: number[];
  mode: Mode;
  combat: CombatState | null;
  flags: Record<string, boolean>;
  dropped: DroppedItem[];
  /** Skräckkällor (varelsetyper) som rollpersonen har mött förut. */
  fearMet: string[];
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
  equipped: { weapon?: string; offhand?: string; shield?: string; armor: string[] };
  appearance: string;
  /** Bonus-EP från uppdrag, att fördela fritt mellan färdigheterna vid träningen. */
  bonusEp?: number;
  /** Fobier från Skräcktabellen. */
  phobias?: { source: string; level: 'mild' | 'normal' | 'svår' }[];
}
