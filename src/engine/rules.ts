import { die, roll, type Rng } from './dice';
import { ATTR_KEYS, type Attrs } from './types';

/**
 * Regelkärnan. Alla tal här är samlade på ett ställe så att de kan stämmas av
 * mot regelboken och justeras utan att resten av motorn påverkas.
 */
export const RULES = {
  /** Slag för grundegenskaper (människa). */
  attrRoll: '3T6',
  /** Skadebonus utifrån STY + STO. Första raden vars `max` räcker används. */
  damageBonus: [
    { max: 12, bonus: '-1T4' },
    { max: 16, bonus: '' },
    { max: 24, bonus: '1T4' },
    { max: 32, bonus: '1T6' },
    { max: Infinity, bonus: '2T6' },
  ],
  /** Förflyttning i rutor per stridsrunda för en människa. */
  baseMove: 5,
  /** Högsta färdighetsvärde. */
  maxSkill: 20,
};

export type CheckResult = 'perfekt' | 'lyckat' | 'misslyckat' | 'fummel';

export interface Check {
  roll: number;
  target: number;
  result: CheckResult;
  success: boolean;
}

/** Färdighetsslag: T20 lika med eller under färdighetsvärdet. 1 är perfekt, 20 är fummel. */
export function skillCheck(fv: number, rng: Rng, modifier = 0): Check {
  const target = Math.max(1, Math.min(19, fv + modifier));
  const r = die(20, rng);
  let result: CheckResult;
  if (r === 1) result = 'perfekt';
  else if (r === 20) result = 'fummel';
  else result = r <= target ? 'lyckat' : 'misslyckat';
  return { roll: r, target, result, success: result === 'perfekt' || result === 'lyckat' };
}

export function rollAttrs(rng: Rng): Attrs {
  const attrs = {} as Attrs;
  for (const k of ATTR_KEYS) attrs[k] = roll(RULES.attrRoll, rng);
  return attrs;
}

export function maxKp(attrs: Attrs): number {
  return Math.ceil((attrs.STO + attrs.FYS) / 2);
}

export function damageBonus(attrs: Attrs): string {
  const sum = attrs.STY + attrs.STO;
  return RULES.damageBonus.find((row) => sum <= row.max)!.bonus;
}

/** Förbättringsslag för en färdighet med erfarenhetskryss: T20 över nuvarande värde ger +1. */
export function improvementRoll(fv: number, rng: Rng): boolean {
  return fv < RULES.maxSkill && die(20, rng) > fv;
}
