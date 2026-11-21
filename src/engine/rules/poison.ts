import { resistance, type Check } from './check';
import type { Rng } from '../dice';
import type { Scope } from './outcomes';

/**
 * Gifternas verkan (Bok II s. 50–51). Offret slår FYS mot giftets STY på motståndstabellen och
 * får ett av fyra stadier. Stadierna läggs på varandra och kommer efter hand.
 */

export type PoisonStage = 'lindrig' | 'måttlig' | 'allvarlig' | 'dödlig';
export const POISON_STAGES: PoisonStage[] = ['lindrig', 'måttlig', 'allvarlig', 'dödlig'];

export type PoisonType = 'nerv' | 'muskel' | 'andning' | 'blod' | 'funktion';

/** Stadiet efter motståndsslaget: lyckat ger lindrig, sedan efter hur mycket det misslyckades med. */
export function poisonStage(check: Check): PoisonStage {
  if (check.success) return 'lindrig';
  const by = check.automatic ? Math.max(1, check.rolls[0] - check.target) : check.roll - check.target;
  if (by <= 5) return 'måttlig';
  if (by <= 10) return 'allvarlig';
  return 'dödlig';
}

export function poisonResistance(fys: number, sty: number, rng: Rng): Check {
  return resistance(fys, sty, rng);
}

/**
 * Sekunder efter förgiftningen då varje stadium börjar verka. Upp till STY 20 tar stadierna
 * (20 − STY) SR, minuter, timmar och dygn efter varandra. Över 20 och över 30 gäller fasta tider.
 */
export function poisonOnsets(sty: number): Record<PoisonStage, number> {
  if (sty > 30) return { lindrig: 5, måttlig: 10, allvarlig: 15, dödlig: 60 };
  if (sty > 20) return { lindrig: 5, måttlig: 10, allvarlig: 60, dödlig: 3600 };
  const n = Math.max(0, 20 - sty);
  const lindrig = n * 5;
  const måttlig = lindrig + n * 60;
  const allvarlig = måttlig + n * 3600;
  return { lindrig, måttlig, allvarlig, dödlig: allvarlig + n * 86400 };
}

/** Vad ett stadium gör. Motorn (src/engine/poison.ts) vet hur varje sort verkar. */
export type PoisonEffect =
  | { kind: 'cl'; scope: Scope; mod: number }
  /** Skada på totala KP, eller i en slumpvis kroppsdel och totala KP. */
  | { kind: 'skada'; dice: string; loc?: 'slump' }
  | { kind: 'medvetslös' }
  /** Svårt FYS-slag för varje kroppsdel: misslyckas det är den förlamad för alltid. Huvud och bröstkorg dödar. */
  | { kind: 'förlamning' }
  /** Ett slag om dygnet med risk för bestående skador (andningsvägar och blodomlopp). */
  | { kind: 'dygnsslag'; table: 'andning' | 'blod' }
  /** En kroppsfunktion slås ut (1T10); synen gör offret blint. */
  | { kind: 'funktion' }
  | { kind: 'död'; rounds?: 'FYS' };

export interface PoisonStageDef {
  text: string;
  effects: PoisonEffect[];
}

/** De fem gifttyperna med egna korta beskrivningar. */
export const POISON_TYPES: Record<PoisonType, { name: string; stages: Record<PoisonStage, PoisonStageDef> }> = {
  nerv: {
    name: 'Nervgift',
    stages: {
      lindrig: { text: 'Domningar i händer och fötter.', effects: [{ kind: 'cl', scope: 'smi', mod: -5 }] },
      måttlig: {
        text: 'Kraftiga känslostörningar i armar och ben.',
        effects: [
          { kind: 'cl', scope: 'smi', mod: -15 },
          { kind: 'cl', scope: 'int', mod: -10 },
          { kind: 'cl', scope: 'psy', mod: -10 },
        ],
      },
      allvarlig: { text: 'Medvetslös, med risk för bestående förlamning.', effects: [{ kind: 'medvetslös' }, { kind: 'förlamning' }] },
      dödlig: { text: 'Giftet når hjärnan.', effects: [{ kind: 'död' }] },
    },
  },
  muskel: {
    name: 'Muskelgift',
    stages: {
      lindrig: {
        text: 'Svullnad, yrsel och brännande smärta i huden.',
        effects: [
          { kind: 'skada', dice: '1T4' },
          { kind: 'cl', scope: 'smi', mod: -5 },
          { kind: 'cl', scope: 'psy', mod: -5 },
        ],
      },
      måttlig: {
        text: 'Hela kroppen är svullen, öm och varm.',
        effects: [
          { kind: 'cl', scope: 'smi', mod: -10 },
          { kind: 'cl', scope: 'psy', mod: -10 },
          { kind: 'cl', scope: 'sty', mod: -5 },
        ],
      },
      allvarlig: { text: 'Medvetslös i hög feber, med risk för att musklerna förtvinar.', effects: [{ kind: 'medvetslös' }, { kind: 'förlamning' }] },
      dödlig: { text: 'Hjärtat stannar inom FYS rundor.', effects: [{ kind: 'död', rounds: 'FYS' }] },
    },
  },
  andning: {
    name: 'Gift i andningsvägarna',
    stages: {
      lindrig: {
        text: 'Yrsel och tryck över bröstet.',
        effects: [
          { kind: 'cl', scope: 'smi', mod: -2 },
          { kind: 'cl', scope: 'int', mod: -2 },
          { kind: 'cl', scope: 'psy', mod: -2 },
        ],
      },
      måttlig: {
        text: 'Svår yrsel och värkande hosta.',
        effects: [
          { kind: 'cl', scope: 'smi', mod: -5 },
          { kind: 'cl', scope: 'int', mod: -5 },
          { kind: 'cl', scope: 'psy', mod: -5 },
          { kind: 'skada', dice: '1T4' },
        ],
      },
      allvarlig: { text: 'Medvetslös med svåra hostanfall; syrebristen kan skada hjärnan.', effects: [{ kind: 'medvetslös' }, { kind: 'dygnsslag', table: 'andning' }] },
      dödlig: { text: 'Offret kvävs.', effects: [{ kind: 'död' }] },
    },
  },
  blod: {
    name: 'Blodgift',
    stages: {
      lindrig: { text: 'Het och öm svullnad kring såret, feber.', effects: [{ kind: 'cl', scope: 'smi', mod: -3 }] },
      måttlig: {
        text: 'Svår yrsel och hög feber.',
        effects: [
          { kind: 'skada', dice: '1T4', loc: 'slump' },
          { kind: 'skada', dice: '1T4' },
          { kind: 'cl', scope: 'smi', mod: -7 },
        ],
      },
      allvarlig: { text: 'Blåaktig hud och frossa tills offret faller i koma; risk för kallbrand i händer och fötter.', effects: [{ kind: 'medvetslös' }, { kind: 'dygnsslag', table: 'blod' }] },
      dödlig: { text: 'Blodförgiftning.', effects: [{ kind: 'död' }] },
    },
  },
  funktion: {
    name: 'Funktionsnedsättande gift',
    stages: {
      lindrig: { text: 'Illamående och yrsel.', effects: [{ kind: 'cl', scope: 'smi', mod: -5 }] },
      måttlig: { text: 'En kroppsfunktion slås ut så länge giftet verkar.', effects: [{ kind: 'funktion' }] },
      allvarlig: { text: 'Funktionen är utslagen för alltid.', effects: [] },
      dödlig: { text: 'Lever och njurar ger upp.', effects: [{ kind: 'död' }] },
    },
  },
};

/** Kroppsfunktionerna som ett funktionsnedsättande gift kan slå ut (1T10, 9 och 10 ger flera). */
export const BODY_FUNCTIONS = ['synen', 'hörseln', 'matsmältningen', 'känseln', 'urinvägarna', 'levern', 'luktsinnet', 'smaksinnet'];

/** Blindhet räknas som mörker (Bok II): −15 på allt som kräver synen. */
export const BLIND_CL = -15;
