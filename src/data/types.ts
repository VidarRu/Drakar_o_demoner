import type { AgeGroup, HitLocation } from '../engine/rules/tables';
import type { AttrKey, Attrs, ElementKind } from '../engine/types';

/**
 * Typer för regeldatan. Datan innehåller regelvärden ur Drakar och Demoner (1991) och
 * egna korta beskrivningar – ingen text ur böckerna.
 */

// ------------------------------------------------------------------ färdigheter

export type SkillType = 'primär' | 'sekundär';

export interface SkillDef {
  id: string;
  name: string;
  type: SkillType;
  /** Kategori A slås med 1T20; kategori B anges ofta som nivå B0–B5. */
  category: 'A' | 'B';
  /** Grundegenskapen färdigheten bygger på. 'spec' = modersmålen, vars BC beror på socialt stånd. */
  attr: AttrKey | 'spec';
  /**
   * Färdigheten består av separata underfärdigheter (ett per språk, hantverk, instrument …).
   * Rollpersonens färdighet heter då t.ex. "hantverk:smide".
   */
  specialized?: { label: string; options?: { id: string; name: string; attr?: AttrKey }[] };
  /** FV får aldrig bli högre än FV i denna färdighet (t.ex. Läsa/Skriva för Historia). */
  cappedBy?: string;
  /** FV får aldrig bli högre än denna grundegenskap, inte ens som yrkesfärdighet. */
  cappedByAttr?: AttrKey;
  /** SL slår dolt; spelaren ska inte veta om slaget lyckades. */
  hidden?: boolean;
  /** Vapengrupp (husregel: varje vapengrupp är en färdighet). */
  weaponGroup?: WeaponFamily;
  /** Kan bara förbättras genom träning, inte genom erfarenhet. */
  trainingOnly?: boolean;
  /** Bara de yrken som anges kan någonsin lära sig färdigheten. */
  onlyFor?: string[];
  /** Egen kort beskrivning av vad färdigheten används till. */
  desc: string;
}

/** Vapengrupper av samma slag ger halva FV till varandra (husregel). */
export type WeaponFamily = 'enhand' | 'tvåhand' | 'avstånd' | 'sköld' | 'piska';

// ------------------------------------------------------------------ raser och yrken

export type AttrMods = Record<Exclude<AttrKey, 'STO'>, number>;

export interface RaceDef {
  id: string;
  name: string;
  bp: number;
  mods: AttrMods;
  sto: { min: number; max: number; normal: number };
  /** Ändring av förflyttningen. */
  move: number;
  /** Tillägg på FV i färdigheter (alv +4 Upptäcka fara m.m.). */
  skillBonus: Record<string, number>;
  /** Färdigheter med ett fast FV från start (anka Simma 20, dvärg Geologi 5). */
  fixedSkills: Record<string, number>;
  /** Sekundära färdigheter som räknas som primära för rasen (dvärg: Geologi). */
  primarySkills?: string[];
  /** Modersmål att tala respektive läsa/skriva. "människospråk" väljs efter spelvärlden. */
  speaks: string[];
  reads: string[] | { oneOf: string[] };
  /** Ålder i år per åldersgrupp. */
  ages: Record<AgeGroup, [number, number]> | null;
  /** Alver: åldersgrupp som gäller för EP/kapital respektive grundegenskaper/max-FV. */
  ageRules?: { epAndCapital: AgeGroup; attrsAndMaxFv: AgeGroup };
  /** Timmar sömn som krävs för nya erfarenhetspoäng (normalt 6). */
  sleepHours: number;
  /** Vikten jämfört med STO-tabellen: 'plus-sty' (dvärg) eller 'minus-20-sty' (alv). */
  weight?: 'plus-sty' | 'minus-20-sty';
  /** Tärningar för att slumpa grundegenskaper för en SLP av rasen (Bok II). */
  dice: Record<AttrKey, string>;
  /** Ser i mörker utan ljuskälla och får inga avdrag för mörker i strid. */
  darkvision?: boolean;
  traits: string[];
}

/** Ett val i yrkeslistan: en färdighet, eller ett antal ur en grupp. */
export type SkillOption =
  | string
  | { group: 'vapen' | 'tala' | 'läsa' | 'hantverk' | 'instrument' | 'magiskola'; max: number; required?: boolean };

export interface ProfessionDef {
  id: string;
  name: string;
  requirements: Partial<Record<AttrKey, number>>;
  /** Antal yrkesfärdigheter som väljs ur listan (12, magiker 9). */
  picks: number;
  options: SkillOption[];
  /** Kan lära sig besvärjelser redan från start. */
  spellsAtStart: boolean;
  /** Sekundära färdigheter som räknas som primära för yrket (magiker: Känna magi). */
  primarySkills?: string[];
  ability: { name: string; desc: string };
  desc: string;
}

// ------------------------------------------------------------------ vapen, rustning, sköldar

export type WeaponGroupId =
  | 'dolkar'
  | 'enhandssvard'
  | 'enhandskross'
  | 'enhandsyxor'
  | 'tvahandsvapen'
  | 'stickvapen'
  | 'kattingvapen'
  | 'stangvapen'
  | 'trastav'
  | 'bagar'
  | 'armborst'
  | 'slunga'
  | 'kastvapen'
  | 'piska'
  | 'skoldar'
  | 'blasror';

export interface MeleeWeaponDef {
  id: string;
  name: string;
  kind: 'närstrid';
  /**
   * Vapengrupp. 'svärd', 'yxa' och 'kross' blir enhands- eller tvåhandsgrupp beroende på om
   * rollpersonen orkar föra vapnet med en hand.
   */
  group: WeaponGroupId | 'svärd' | 'yxa' | 'kross' | 'slagsmal';
  damage: string;
  styReq: number;
  /** Måste alltid föras med två händer. */
  twoHandedOnly: boolean;
  /** Räckvidd i rutor utöver grannrutan. */
  length: number;
  weight: number;
  /** Brytvärde. null = kan inte gå sönder (knogjärn). */
  bv: number | null;
  price: number;
  /** Kan användas som en trästav. */
  asStaff?: boolean;
  /** Skadar aldrig ett vapen som parerar det (spjut, pikar, trästavar). */
  noParryWear?: boolean;
  /** Svårt att parera: pareringens CL halveras, 18–20 på anfallet missar med risk för fummel. */
  entangling?: boolean;
  note?: string;
}

export interface RangedWeaponDef {
  id: string;
  name: string;
  kind: 'projektil' | 'kast';
  group: WeaponGroupId;
  damage: string;
  styReq: number;
  /** Räckvidd i meter, eller 'STY' för kastvapen (STY rutor). */
  range: number | 'STY';
  /** Laddningstid i stridsrundor. */
  reload: number;
  weight: number;
  price: number;
  note?: string;
}

export type WeaponDef = MeleeWeaponDef | RangedWeaponDef;

export interface ArmorDef {
  id: string;
  name: string;
  /** Rustningsdelens typ, t.ex. hjälm eller harnesk. */
  slot: 'hjälm' | 'armskydd' | 'benskydd' | 'harnesk' | 'brynja' | 'brynjehosor' | 'hauberk' | 'helrustning';
  covers: HitLocation[];
  abs: number;
  weight: number;
  price: number;
  /** Metallrustning: halverar Klättra, omöjlig att simma i. */
  metal: boolean;
  /** Klirrar: halverar Smyga (fjällpansar och metall). */
  noisy: boolean;
  /** Inte tyngre än läder: stridskonster går att använda (Bok I s. 57). */
  light: boolean;
  /** Sår under ringbrynja kan inte bli infekterade. */
  noInfection?: boolean;
  /** Avdrag på Finna dolda ting och Upptäcka fara (tunnhjälm). */
  perceptionPenalty?: number;
}

export interface ShieldDef {
  id: string;
  name: string;
  /** 'sköldarm' och 'sköldben' avgörs av rollpersonens svärdshand. */
  covers: ('sköldarm' | 'sköldben' | 'mage' | 'bröstkorg')[];
  styReq: number;
  bv: number;
  weight: number;
  price: number;
}

// ------------------------------------------------------------------ varelser

export interface NaturalAttack {
  name: string;
  /** Antal attacker per runda, t.ex. 2 för klor. '1T4' för demonens klor. */
  count: number | string;
  damage: string;
  fv: number;
  /** Hur skadebonus används. */
  sb: 'full' | 'halv' | 'ingen';
  note?: string;
}

export interface CreatureStats {
  id: string;
  name: string;
  group: 'djur' | 'legendarisk';
  habitat?: string;
  frequency?: string;
  number?: string;
  /** Typvärden. KAR saknas för djur och vissa monster. */
  attrs: Omit<Attrs, 'KAR'> & { KAR?: number };
  /** Särskild KP-regel när boken avsiktligt avviker från formeln. */
  kp?: 'PSY' | 'ingen';
  /** Naturligt skydd, ett tal eller per kroppsdel. */
  armor: number | Record<string, number>;
  /** Förflyttning: L land, F flygande, S simmande, B borrande, A oavsett omgivning. */
  move: Partial<Record<'L' | 'F' | 'S' | 'B' | 'A', number>>;
  attacks: NaturalAttack[];
  /** FV i färdigheter, med färdighetens id eller en beskrivning som "ett närstridsvapen". */
  skills: Record<string, number | string>;
  /** Skräckslå: [automatiskt, aktivt]. null = '—'. */
  fear?: [number | null, number | null];
  /** Mörkersyn: 'perfekt', 'begränsad' (som fackelsken) eller 'nattsyn' (alver). */
  darkvision?: 'perfekt' | 'begränsad' | 'nattsyn';
  /** Lyder inte under moralregler (ointelligenta, odöda, drakar). */
  noMorale?: boolean;
  /** Rasen kan spelas som rollperson (se raser). */
  race?: string;
  traits: string[];
}

// ------------------------------------------------------------------ magi och utrustning

export type School = 'allmän' | 'animism' | 'elementarmagi' | 'mentalism';

export type SpellRange =
  | 'personlig'
  | 'beröring'
  | 'särskild'
  | { per: 'S'; mult?: number; div?: number; unit: 'rutor' | 'km' };

export type SpellDuration =
  | 'omedelbar'
  | 'permanent'
  | 'koncentration'
  | { dice: string; unit: 'SR' | 'minuter' }
  | { per: 'S'; mult?: number; div?: number; unit: 'SR' | 'minuter' | 'timmar' | 'dygn' | 'veckor' };

export interface SpellDef {
  id: string;
  name: string;
  school: School;
  /** Skolvärde: FV i skolan som krävs för att lära sig besvärjelsen. */
  sv: number;
  /** Fysisk manifestation: behöver inte övervinna målets PSY. */
  physical: boolean;
  /** Kvick: verkar samma runda. */
  quick: boolean;
  /** Ritual: tar timmar och används aldrig i strid. */
  ritual: boolean;
  range: SpellRange;
  duration: SpellDuration;
  /** Varelsebesvärjelser lärs separat för varje grupp av varelser. */
  perCreatureGroup?: boolean;
  desc: string;
  /** Vad besvärjelsen gör i spelet. Saknas den kan besvärjelsen läras men inte användas än. */
  effect?: SpellEffect;
  /** Vem besvärjelsen kan riktas mot: magikern själv, en fiende, valfri varelse eller närmaste varelse. */
  aim?: 'själv' | 'fiende' | 'valfri' | 'närmast';
  /** Försöker påverka målets psyke: en ovillig varelse gör motstånd med PSY. */
  resisted?: boolean;
}

/** Besvärjelsernas verkan som spelmotorn (src/engine/magic.ts) känner till. */
export type SpellEffect =
  /** Skada per E. Rustningen skyddar fullt, inte alls eller till hälften om den är av metall. */
  | { kind: 'skada'; dice: string; detailedDice?: string; armor: 'ingen' | 'full' | 'halvMetall'; loc: boolean }
  /** Skada per E på alla inom E meter, sedan 1 mindre per ruta. Alla som ser den bländas. */
  | { kind: 'explosion'; perGrade: number }
  /** Svårt FYS-slag: misslyckas det kan offret inte handla, annars −4 på CL rundan ut. */
  | { kind: 'köld' }
  /** Sänker BV på målets vapen eller sköld. */
  | { kind: 'knäcka'; base: number; perGrade: number }
  /** Parerar nästa fysiska anfall automatiskt. */
  | { kind: 'luftsköld' }
  /** +1 (FÖRTROLLA) eller −1 (FÖRBANNA) på CL och skada per E. */
  | { kind: 'vapen'; sign: 1 | -1 }
  | { kind: 'läka'; dice: string }
  | { kind: 'motgift'; dice: string }
  /** Extra absorbering på hela kroppen: per E, eller ett fast värde. */
  | { kind: 'skydd'; perGrade?: number; fixed?: number }
  | { kind: 'mörkersyn' }
  | { kind: 'orädd' }
  /** Upphäver en besvärjelse på målet om E övervinner dess E. */
  | { kind: 'skingra' }
  /** Avslöjar om målet är fientligt inställt. */
  | { kind: 'fiendskap' }
  /** Snärjer ett mål med en E per 10 STO. */
  | { kind: 'rankor' }
  /** FRAMMANA/SKICKA BORT ELEMENTAR: en besvärjelse per sorts elementar. */
  | { kind: 'elementar'; element: ElementKind };

export interface ItemDef {
  id: string;
  name: string;
  category:
    | 'verktyg'
    | 'behållare'
    | 'kläder'
    | 'äventyr'
    | 'tjuvverktyg'
    | 'diverse'
    | 'instrument'
    | 'mat'
    | 'logi'
    | 'tjänst'
    | 'fordon'
    | 'djur'
    | 'ridutrustning';
  /** Vikt i kg. 0 = försumbar. */
  weight: number;
  /** Pris i silvermynt. */
  price: number;
  /** Prisets enhet, t.ex. "per dygn". */
  per?: string;
  note?: string;
}
