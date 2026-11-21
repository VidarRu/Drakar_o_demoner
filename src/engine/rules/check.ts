import { die, type Rng } from '../dice';

/**
 * Färdighetsslag, grundegenskapsslag och motståndsslag (Bok I, Chans att lyckas och
 * Grundegenskapsslag). Tolkningarna står i docs/regelbeslut.md.
 */

export type CheckResult = 'perfekt' | 'lyckat' | 'misslyckat' | 'fummel';

export interface Check {
  /** Första tärningsslaget (1T20). */
  roll: number;
  /** Alla slag som gjordes, inklusive omslag för perfekt eller fummel. */
  rolls: number[];
  /** Chans att lyckas efter modifikationer. */
  target: number;
  /** Färdighetsvärdet som omslaget jämförs med. */
  fv: number;
  result: CheckResult;
  success: boolean;
  /** Differensvärde: CL minus tärningsslaget. Kan vara negativt. */
  diff: number;
  /** Utfallet var givet utan tärning (motståndsslag med 20+ eller 0−). */
  automatic?: boolean;
}

function done(rolls: number[], target: number, fv: number, result: CheckResult, automatic = false): Check {
  return {
    roll: rolls[0],
    rolls,
    target,
    fv,
    result,
    success: result === 'perfekt' || result === 'lyckat',
    diff: target - rolls[0],
    ...(automatic ? { automatic } : {}),
  };
}

/**
 * Färdighetsslag med 1T20 mot CL = FV + modifikation.
 *
 * - FV 0 och CL ≤ 0: två ettor i rad krävs för att lyckas.
 * - CL < 1: inget perfekt slag; 1 lyckas (om FV ≥ 1), 20 är fummel.
 * - CL 1–19: 1 slås om – lika med eller under FV är perfekt, annars lyckat.
 *   20 slås om – över FV är fummel, annars misslyckat.
 * - CL ≥ 20: 1 är perfekt, 2 slås om mot FV för perfekt. 20 är misslyckat,
 *   två tjugor i rad är fummel.
 */
export function skillCheck(fv: number, rng: Rng, modifier = 0): Check {
  const cl = fv + modifier;
  const first = die(20, rng);
  const rolls = [first];
  const again = () => {
    const r = die(20, rng);
    rolls.push(r);
    return r;
  };

  if (fv <= 0 && cl <= 0) {
    if (first === 1) return done(rolls, cl, fv, again() === 1 ? 'lyckat' : 'misslyckat');
    return done(rolls, cl, fv, first === 20 ? 'fummel' : 'misslyckat');
  }
  if (cl < 1) {
    if (first === 1) return done(rolls, cl, fv, fv >= 1 ? 'lyckat' : 'misslyckat');
    return done(rolls, cl, fv, first === 20 ? 'fummel' : 'misslyckat');
  }
  if (cl >= 20) {
    if (first === 1) return done(rolls, cl, fv, 'perfekt');
    if (first === 2) return done(rolls, cl, fv, again() <= fv ? 'perfekt' : 'lyckat');
    if (first === 20) return done(rolls, cl, fv, again() === 20 ? 'fummel' : 'misslyckat');
    return done(rolls, cl, fv, 'lyckat');
  }
  if (first === 1) return done(rolls, cl, fv, again() <= fv ? 'perfekt' : 'lyckat');
  if (first === 20) return done(rolls, cl, fv, again() > fv ? 'fummel' : 'misslyckat');
  return done(rolls, cl, fv, first <= cl ? 'lyckat' : 'misslyckat');
}

/** Svårighetsgrader för grundegenskapsslag. */
export const SG = {
  'Mycket lätt': 1,
  Lätt: 5,
  Normalt: 10,
  Svårt: 15,
  'Mycket svårt': 20,
  'Extremt svårt': 25,
} as const;
export type Difficulty = keyof typeof SG;

/**
 * Värdet i Motståndstabellen: det man måste slå lika med eller under med 1T20.
 * 20 eller mer är automatisk framgång, 0 eller mindre automatiskt misslyckande.
 */
export function resistanceTarget(active: number, passive: number): number {
  return 10 + active - passive;
}

/**
 * Motståndsslag: `active` (t.ex. en grundegenskap, eller KAR+FV i Bluffa) mot `passive`
 * (en svårighetsgrad eller motståndarens värde). Mellan gränserna gäller samma regler för
 * perfekt och fummel som vid färdighetsslag, med tabellvärdet som FV.
 */
export function resistance(active: number, passive: number, rng: Rng): Check {
  const target = resistanceTarget(active, passive);
  if (target >= 20) return done([die(20, rng)], target, target, 'lyckat', true);
  if (target <= 0) return done([die(20, rng)], target, target, 'misslyckat', true);
  return skillCheck(target, rng);
}

/** Grundegenskapsslag mot en svårighetsgrad (Normalt = slå under grundegenskapen). */
export function attributeCheck(value: number, rng: Rng, difficulty: Difficulty | number = 'Normalt'): Check {
  const sg = typeof difficulty === 'number' ? difficulty : SG[difficulty];
  return resistance(value, sg, rng);
}
