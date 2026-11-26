import { baseChance } from './derived';
import type { CheckResult } from './check';
import type { Band } from './tables';

/**
 * Magins regler (Bok III s. 3–8) med Vidars husregler, se docs/regelbeslut.md under Magi.
 */

/** Husregel: CL minskar med 1 (inte 2 som i boken) för varje effektgrad utöver den första. */
export const SPELL_GRADE_PENALTY = -1;

/**
 * ASTRALVAPEN (Vidar): 1T10 som enhandsvapen och 2T10 som tvåhandsvapen. Tolkning av "en E per kg":
 * ett enhandsvapen kräver E2 och ett tvåhandsvapen E4.
 */
export const ASTRAL_WEAPON = { 1: { dice: '1T10', grade: 2 }, 2: { dice: '2T10', grade: 4 } } as const;

/** Memorering: 20 minuter per skolvärdespoäng för en besvärjelse, en timme för en ritual. */
export const MEMORIZE_MINUTES_PER_SV = 20;
export const RITUAL_MEMORIZE_MINUTES_PER_SV = 60;
/** En ritual tar lika mycket minnesplats som tre besvärjelser. */
export const RITUAL_MEMORY_SLOTS = 3;

/** Att läsa en besvärjelse ur formelsamlingen: kvicka tar 1T6 SR, andra 1T6 minuter. */
export const BOOK_CAST = { quickRounds: '1T6', normalMinutes: '1T6' };

/** Så här mycket järn får magikern bära (utan att röra vid det) och ändå lägga besvärjelser. */
export const IRON_LIMIT_KG = 0.5;

/**
 * Husregel: skicklighetsvärdet S = FV i skolan − besvärjelsens skolvärde + baschansen för INT.
 * Exempel: Elementarmagi 15, ELD (skolvärde 6) och INT 15 ger 15 − 6 + 3 = S12.
 */
export function spellSkill(schoolFv: number, schoolValue: number, int: number): number {
  return Math.max(0, schoolFv - schoolValue + baseChance(int));
}

/** CL för en besvärjelse med effektgrad E: S och −1 per E utöver den första. */
export function spellCl(s: number, grade: number): number {
  return s + SPELL_GRADE_PENALTY * Math.max(0, grade - 1);
}

/**
 * PSY-kostnad: 1 per E. Misslyckas besvärjelsen går 1 PSY åt; ett perfekt slag kostar hälften
 * (avrundat till magikerns fördel, minst 1) och ett fummel hela kostnaden.
 */
export function spellPsyCost(grade: number, result: CheckResult): number {
  if (result === 'misslyckat') return 1;
  if (result === 'perfekt') return Math.max(1, Math.floor(grade / 2));
  return grade;
}

/** Hur många besvärjelser som ryms i minnet: (INT + PSY) / 4, avrundat nedåt. */
export function memoryCapacity(int: number, psy: number): number {
  return Math.floor((int + psy) / 4);
}

/** Självmordsattack: magikern kan spendera sina kvarvarande PSY plus halva sin PSY. */
export function suicideBudget(psyLeft: number, psy: number): number {
  return psyLeft + Math.floor(psy / 2);
}

/** Varaktighet i sekunder för en tidsenhet. */
export const DURATION_SECONDS = { SR: 5, minuter: 60, timmar: 3600, dygn: 86400, veckor: 7 * 86400 } as const;

/** Följder på Snedtändningstabellen som motorn vet hur de verkar. */
export type MisfireEffect =
  /** Besvärjelsen verkar ändå, med halva effektgraden (avrundat uppåt). */
  | { kind: 'halvE' }
  /** Skada lika med E på totala KP och medvetslös 1T8 minuter. */
  | { kind: 'skada'; blind?: boolean }
  /** En skadlig besvärjelse träffar magikern själv; annars som 'skada' och blind 1T8 timmar. */
  | { kind: 'bakslag' }
  | { kind: 'stum'; days: string }
  | { kind: 'förlamad'; days: string }
  | { kind: 'hjärnskada'; amount: string }
  | { kind: 'minnesförlust'; days: string };

/**
 * Snedtändningstabellen (Bok III s. 8), med egna ord. Husregel: man slår 1T20 utan att lägga
 * till effektgraden.
 */
export const MISFIRE_TABLE: Band<{ text: string; effect: MisfireEffect }>[] = [
  { max: 5, value: { text: 'Kraften räcker bara halvvägs: besvärjelsen verkar med halva effektgraden.', effect: { kind: 'halvE' } } },
  { max: 11, value: { text: 'Energin flödar fel och slår tillbaka: skada lika med E och medvetslös i 1T8 minuter.', effect: { kind: 'skada' } } },
  {
    max: 15,
    value: {
      text: 'Besvärjelsen vänder sig mot magikern. En skadlig besvärjelse drabbar hen själv; annars skada lika med E, medvetslös i 1T8 minuter och blind i 1T8 timmar.',
      effect: { kind: 'bakslag' },
    },
  },
  { max: 17, value: { text: 'Rösten sviker: stum i 1T8 dygn och ingen magi under tiden.', effect: { kind: 'stum', days: '1T8' } } },
  { max: 18, value: { text: 'Kroppen domnar: förlamad i 1T8 dygn och ingen magi under tiden.', effect: { kind: 'förlamad', days: '1T8' } } },
  { max: 19, value: { text: 'Hjärnskada: INT och alla INT-färdigheter sjunker med 1T4, och lika många besvärjelser faller ur minnet.', effect: { kind: 'hjärnskada', amount: '1T4' } } },
  { max: 20, value: { text: 'Total minnesförlust i 1T8 dygn utan färdigheter eller magi, och en fobi i 1T8 månader.', effect: { kind: 'minnesförlust', days: '1T8' } } },
];
