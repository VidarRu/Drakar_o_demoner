/**
 * Regeltabellerna som data. Varje tabell står med källa i kommentaren; tolkningar och
 * förlängningar av tabeller står i docs/regelbeslut.md.
 */

/** Rad i en intervalltabell: gäller för värden upp till och med `max`. */
export interface Band<T> {
  max: number;
  value: T;
}

/** Slår upp ett värde i en intervalltabell. Värden över sista raden ger `undefined`. */
export function lookup<T>(table: readonly Band<T>[], n: number): T | undefined {
  return table.find((row) => n <= row.max)?.value;
}

// ------------------------------------------------------------------ skapa rollperson

/** Bakgrundspoäng som varje rollperson börjar med. */
export const START_BP = 125;

/** Pris i BP för att köpa ett grundegenskapsvärde, före rasmodifikation. */
export const ATTR_PRICE: Record<number, number> = {
  3: 0, 4: 1, 5: 2, 6: 3, 7: 5, 8: 7, 9: 9, 10: 10, 11: 11,
  12: 12, 13: 14, 14: 17, 15: 20, 16: 25, 17: 30, 18: 40,
};

/** Pris i BP för att bli 1–5 steg större än rasens normal-STO. */
export const STO_PRICE_UP = [0, 2, 4, 6, 8, 10];
/** BP man får tillbaka för att bli 1–5 steg mindre än rasens normal-STO. */
export const STO_REFUND_DOWN = [0, 1, 2, 3, 5, 7];

/** Särskild förmåga: man slår 2T20 + BP, men får högst lägga 40 BP och måste lägga minst 1. */
export const SPECIAL_ABILITY_BP = { min: 1, max: 40 };

export type SwordHand = 'höger' | 'vänster' | 'dubbelhänt' | 'ambidextriös';
/** Svärdshand: 2T6 + BP. */
export const SWORD_HAND: Band<SwordHand>[] = [
  { max: 11, value: 'höger' },
  { max: 14, value: 'vänster' },
  { max: 18, value: 'dubbelhänt' },
  { max: Infinity, value: 'ambidextriös' },
];

export type SocialClass =
  | 'Egendomslös'
  | 'Lägre underklass'
  | 'Högre underklass'
  | 'Lägre medelklass'
  | 'Högre medelklass'
  | 'Lägre överklass'
  | 'Högre överklass'
  | 'Lågadel'
  | 'Högadel';

/** Socialt stånd: 2T6 + BP. */
export const SOCIAL_CLASS: Band<SocialClass>[] = [
  { max: 2, value: 'Egendomslös' },
  { max: 4, value: 'Lägre underklass' },
  { max: 7, value: 'Högre underklass' },
  { max: 11, value: 'Lägre medelklass' },
  { max: 16, value: 'Högre medelklass' },
  { max: 22, value: 'Lägre överklass' },
  { max: 29, value: 'Högre överklass' },
  { max: 37, value: 'Lågadel' },
  { max: Infinity, value: 'Högadel' },
];

/**
 * Startkapital i silvermynt: 2T6 + BP + hälften av BP lagda på socialt stånd (avrundat uppåt).
 * Summan får inte överstiga ståndets slutsumma + 10. Gångras sedan med ålderns multipel.
 */
export const START_CAPITAL: Band<number>[] = [
  { max: 2, value: 200 },
  { max: 4, value: 400 },
  { max: 7, value: 600 },
  { max: 11, value: 1000 },
  { max: 16, value: 2000 },
  { max: 22, value: 3000 },
  { max: 29, value: 5000 },
  { max: 37, value: 10000 },
  { max: 46, value: 20000 },
  { max: 56, value: 30000 },
  { max: Infinity, value: 50000 },
];
export const CAPITAL_ABOVE_CLASS_MAX = 10;

export type AgeGroup = 'ung' | 'mogen' | 'medelålders' | 'gammal';
export const AGE_GROUPS: AgeGroup[] = ['ung', 'mogen', 'medelålders', 'gammal'];

export interface AgeEffect {
  mods: { STY: number; FYS: number; SMI: number; INT: number; PSY: number; KAR: number; STO: number };
  /** Erfarenhetspoäng att köpa startfärdigheter för. */
  ep: number;
  /** Multipel på startkapitalet. */
  capital: number;
  /** Högsta FV som får köpas från start. */
  maxFv: number;
}

/** Ålderstabellen. Åldrarna i år för varje ras står i rasdatan. */
export const AGE: Record<AgeGroup, AgeEffect> = {
  ung: { mods: { STY: -1, FYS: 1, SMI: 1, INT: 0, PSY: -1, KAR: 0, STO: 0 }, ep: 150, capital: 1, maxFv: 13 },
  mogen: { mods: { STY: 0, FYS: 0, SMI: 0, INT: 0, PSY: 0, KAR: 0, STO: 0 }, ep: 200, capital: 1.5, maxFv: 15 },
  medelålders: { mods: { STY: -2, FYS: -1, SMI: -1, INT: 1, PSY: 2, KAR: 1, STO: 0 }, ep: 250, capital: 2, maxFv: 17 },
  gammal: { mods: { STY: -5, FYS: -3, SMI: -3, INT: 1, PSY: 4, KAR: 1, STO: 0 }, ep: 300, capital: 2.5, maxFv: 19 },
};

/** Överblivna BP blir EP till startfärdigheterna. */
export const EP_PER_LEFTOVER_BP = 5;

/** Baschans: gratis FV i primära färdigheter och yrkesfärdigheter, utifrån grundegenskapen. */
export const BASE_CHANCE: Band<number>[] = [
  { max: 3, value: 0 },
  { max: 8, value: 1 },
  { max: 12, value: 2 },
  { max: 16, value: 3 },
  { max: 20, value: 4 },
  { max: Infinity, value: 5 },
];

/** Grundkostnad i EP per färdighetstyp. */
export const SKILL_BASE_COST = { primär: 2, yrke: 3, sekundär: 5 } as const;

/**
 * Kostnadstabellen för FV (Bok I s. 30) uttryckt som kostnaden för varje enskilt steg.
 * Multipeln från FV a till FV b är summan av stegen a+1 … b. Tabellen slutar vid 21;
 * därefter fortsätter mönstret med ett steg dyrare var tredje nivå.
 */
export function fvStepCost(toFv: number): number {
  if (toFv <= 10) return 1;
  if (toFv <= 14) return 2;
  if (toFv <= 17) return 3;
  if (toFv <= 20) return 4;
  return 5 + Math.floor((toFv - 21) / 3);
}

/** Grundkostnad för en besvärjelse utifrån skolvärdet (1–3 → 2, 4–6 → 4 … +2 per 3 SV). */
export function spellBaseCost(schoolValue: number): number {
  return 2 * Math.max(1, Math.ceil(schoolValue / 3));
}

/** Läsa/Skriva modersmål: BC efter socialt stånd och om INT är 15 eller mer. */
export function nativeLiteracyBc(social: SocialClass, int: number): number {
  const high = int >= 15;
  switch (social) {
    case 'Lägre överklass':
    case 'Högre överklass':
    case 'Lågadel':
    case 'Högadel':
      return high ? 20 : 16;
    case 'Högre medelklass':
      return high ? 16 : 11;
    case 'Lägre medelklass':
      return high ? 11 : 5;
    case 'Högre underklass':
      return high ? 5 : 1;
    default:
      return high ? 1 : 0;
  }
}

/** Tala modersmål: FV 20 (B5) för överklass och adel, annars FV 16 (B4). */
export function nativeSpeechBc(social: SocialClass): number {
  return ['Lägre överklass', 'Högre överklass', 'Lågadel', 'Högadel'].includes(social) ? 20 : 16;
}

// ------------------------------------------------------------------ härledda värden

/** Skadebonus utifrån STY+STO. Tom sträng betyder ingen bonus. */
export const DAMAGE_BONUS: Band<string>[] = [
  { max: 26, value: '' },
  { max: 29, value: '1' },
  { max: 32, value: '1T2' },
  { max: 40, value: '1T4' },
  { max: 50, value: '1T6' },
  { max: 60, value: '1T10' },
  { max: 80, value: '2T6' },
  { max: 100, value: '3T6' },
  { max: 140, value: '4T6' },
  { max: 180, value: '5T6' },
];

/** Förflyttning i rutor per stridsrunda utifrån STO+FYS+SMI (före rasmodifikation). */
export const MOVEMENT: Band<number>[] = [
  { max: 11, value: 7 },
  { max: 20, value: 8 },
  { max: 29, value: 9 },
  { max: 38, value: 10 },
  { max: 47, value: 11 },
  { max: 56, value: 12 },
  { max: 65, value: 13 },
  { max: 74, value: 14 },
  { max: 83, value: 15 },
  { max: 92, value: 16 },
];

export type HitLocation = 'huvud' | 'bröstkorg' | 'mage' | 'vänster arm' | 'höger arm' | 'vänster ben' | 'höger ben';
export const HIT_LOCATIONS: HitLocation[] = [
  'huvud',
  'bröstkorg',
  'mage',
  'vänster arm',
  'höger arm',
  'vänster ben',
  'höger ben',
];

/** Kroppspoäng per träffområde: kolumnerna 5–7, 8–11, 12–15, 16–20, 21–25, 26–30, 31–35, 36–40. */
export const LOCATION_KP_COLUMNS = [7, 11, 15, 20, 25, 30, 35, 40];
export const LOCATION_KP: Record<HitLocation, number[]> = {
  bröstkorg: [4, 5, 6, 7, 8, 9, 10, 11],
  'höger ben': [3, 4, 5, 6, 7, 8, 9, 10],
  'vänster ben': [3, 4, 5, 6, 7, 8, 9, 10],
  mage: [3, 4, 5, 6, 7, 8, 9, 10],
  'höger arm': [2, 3, 4, 5, 6, 7, 8, 9],
  'vänster arm': [2, 3, 4, 5, 6, 7, 8, 9],
  huvud: [3, 4, 5, 6, 7, 8, 9, 10],
};

/** Träfftabellen (1T20), en för närstrid och en för avståndsstrid. */
export const HIT_TABLE: Record<'närstrid' | 'avstånd', Band<HitLocation>[]> = {
  närstrid: [
    { max: 2, value: 'vänster ben' },
    { max: 4, value: 'höger ben' },
    { max: 8, value: 'mage' },
    { max: 11, value: 'vänster arm' },
    { max: 14, value: 'höger arm' },
    { max: 16, value: 'bröstkorg' },
    { max: 20, value: 'huvud' },
  ],
  avstånd: [
    { max: 3, value: 'vänster ben' },
    { max: 6, value: 'höger ben' },
    { max: 9, value: 'mage' },
    { max: 11, value: 'vänster arm' },
    { max: 13, value: 'höger arm' },
    { max: 18, value: 'bröstkorg' },
    { max: 20, value: 'huvud' },
  ],
};

/** Kategori B: FV omvandlat till färdighetsnivå B0–B5. */
export const B_LEVEL: Band<number>[] = [
  { max: 0, value: 0 },
  { max: 4, value: 1 },
  { max: 10, value: 2 },
  { max: 15, value: 3 },
  { max: 19, value: 4 },
  { max: Infinity, value: 5 },
];

/** Rustningsvikt: procentuell ändring utifrån STO+STY+FYS (normalbyggd = 39). */
export const ARMOR_WEIGHT_MOD: Band<number>[] = [
  { max: 8, value: -70 },
  { max: 11, value: -60 },
  { max: 14, value: -50 },
  { max: 17, value: -40 },
  { max: 20, value: -30 },
  { max: 26, value: -20 },
  { max: 33, value: -10 },
  { max: 39, value: 0 },
  { max: 45, value: 10 },
  { max: 51, value: 20 },
  { max: 57, value: 30 },
  { max: 63, value: 40 },
  { max: 69, value: 50 },
];

/**
 * Bärförmåga: börda i multipler av STY kg ger avdrag på förflyttning, SMI och SMI-baserade CL.
 * Över STY×1 får man inte simma, springa eller sprinta; över STY×5 inga SMI-färdigheter alls.
 */
export const ENCUMBRANCE: Band<number>[] = [
  { max: 1, value: 0 },
  { max: 2, value: -1 },
  { max: 3, value: -2 },
  { max: 4, value: -4 },
  { max: 5, value: -6 },
  { max: 6, value: -8 },
];

// ------------------------------------------------------------------ strid och skador

/** Modifikationer på CL i närstrid (Bok II s. 17). */
export const MELEE_MODS = {
  'Målet ligger ned': 5,
  'Anfall från sidan': 3,
  'Anfall bakifrån': 7,
  'Målet orörligt': 10,
  'Skymning, fackelsken': -5,
  Mörker: -15,
  'Sikte på viss kroppsdel': -5,
  'Anfall med sköldhand': -10,
} as const;

/** Modifikationer på CL i avståndsstrid (Bok II s. 17, Bok III s. 33). */
export const RANGED_MODS = {
  'Målet orörligt': 10,
  'Skymning, fackelsken': -5,
  Mörker: -15,
  'Sikte på viss kroppsdel': -5,
  'Mellan halva och tre fjärdedels räckvidd': -5,
  'Mellan tre fjärdedels och hel räckvidd': -10,
} as const;

/** −2 på CL per förlorad KP i en kroppsdel som färdigheten kräver. */
export const LOCATION_WOUND_PENALTY = -2;

/** Initiativ: 1T10 + SMI + modifikationer, slås varje runda. */
export const INITIATIVE_DIE = '1T10';

/** Fallskada: 1T6 per meter efter de första tre metrarna. */
export const FALL = { freeMeters: 3, perMeter: '1T6' };

// ------------------------------------------------------------------ tid och läkning (husregler)

export const HEALING = {
  /** Naturlig läkning per dag i varje skadad kroppsdel och i totala KP. */
  kpPerDay: 1,
  /** Utan vila läker man i halv takt. */
  withoutRestFactor: 0.5,
  /** Lyckat slag i Läkekonst (högst ett per dag) läker så här mycket extra. */
  medicineBonus: 1,
};

export const PSY_RECOVERY = {
  /** Timmar per återvunnen PSY-poäng vid full vila. */
  restHours: 1,
  /** Timmar per återvunnen PSY-poäng under kroppslig aktivitet. */
  activeHours: 3,
};

// ------------------------------------------------------------------ detaljerad strid (Bok II s. 15–22)

/** Turordning: krigarens Stridsvana, Blixtrande reflexer och tekniken Initiativbonus. */
export const INITIATIVE_MODS = {
  stridsvana: 5,
  initiativbonus: 5,
  /** Hoppspark och rundspark. */
  spark: -2,
};

/** Husregel: varje parering efter den första i rundan får −5, −10 och så vidare. */
export const PARRY_PENALTY = -5;
/** Husregel: chans att vapnet tappar 1 BV varje gång det används. */
export const WEAR_CHANCE = 0.02;
/** Husregel: rustningsdelar har BV = abs × 2. */
export const ARMOR_BV_FACTOR = 2;
/** Husregel: smeden lagar för 5 % av priset per återställd BV-poäng. */
export const REPAIR_PERCENT = 5;

/** Blödning: −1 KP från totala KP var sjätte runda per kroppsdel som nått 0. */
export const BLEED_INTERVAL = 6;

/** Skadeeffekter på totala KP. */
export const WOUND_LIMITS = {
  /** CL halveras. */
  halfCl: 2,
  /** Inga färdigheter alls. */
  noSkills: 1,
  /** Medvetslös i 1T4 timmar. */
  unconscious: 0,
};

/** Svårt PSY-slag för att strida vidare när en arm eller ett ben nått 0 KP. */
export const LIMB_PSY_CHECK = 'Svårt' as const;

/** Modifikation för att använda ett enhandsvapen med två händer. */
export const TWO_HAND_BONUS = '1T2';
/** Kättingvapen och piskor: 18–20 på anfallet är en miss med risk för fummel. */
export const ENTANGLING_MISS = 18;

/** Kritiska arm- och benskador (1T10), vid dubbla kroppsdelens KP i skada. */
export interface CriticalLimb {
  max: number;
  value: {
    id: 'brutet' | 'led' | 'nerver' | 'senor' | 'krossat';
    text: string;
    /** Bestående modifikation på CL för färdigheter som kräver kroppsdelen. */
    cl: number;
    /** Kroppsdelen kan aldrig användas igen. */
    lost: boolean;
    /** Förflyttning efteråt om det är ett ben. */
    legMove?: number;
  };
}
export const CRITICAL_LIMB: CriticalLimb[] = [
  { max: 3, value: { id: 'brutet', text: 'Benet är brutet och måste spjälkas. Läker med −3 på CL.', cl: -3, lost: false } },
  { max: 5, value: { id: 'led', text: 'Leden är förstörd och går aldrig att böja igen: −4 på CL.', cl: -4, lost: false, legMove: 6 } },
  { max: 7, value: { id: 'nerver', text: 'Nerverna är av. Kroppsdelen är förlamad för alltid.', cl: 0, lost: true } },
  { max: 9, value: { id: 'senor', text: 'Muskler och senor är av. Läker med −5 på CL.', cl: -5, lost: false } },
  { max: 10, value: { id: 'krossat', text: 'Benet är krossat och kroppsdelen måste amputeras.', cl: 0, lost: true } },
];

/** Modifikationer på moralslaget (1T20 mot PSY + modifikationer, husregel för riktningen). */
export const MORALE_MODS = {
  /** Per stridskamrat. */
  kamrat: 1,
  /** Per stridskamrat som har flytt. */
  flydd: -2,
  /** Per motståndare. */
  motståndare: -1,
  flankerad: -2,
  ledareSårad: -5,
  ledareBorta: -10,
  halvaKp: -4,
};
