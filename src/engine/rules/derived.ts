import type { Attrs } from '../types';
import {
  ARMOR_WEIGHT_MOD,
  ATTR_PRICE,
  B_LEVEL,
  BASE_CHANCE,
  DAMAGE_BONUS,
  ENCUMBRANCE,
  fvStepCost,
  HIT_LOCATIONS,
  LOCATION_KP,
  LOCATION_KP_COLUMNS,
  lookup,
  MOVEMENT,
  STO_PRICE_UP,
  STO_REFUND_DOWN,
  type HitLocation,
} from './tables';

/** Totala kroppspoäng: (FYS+STO)/2, avrundat uppåt. */
export function maxKp(attrs: Pick<Attrs, 'FYS' | 'STO'>): number {
  return Math.ceil((attrs.FYS + attrs.STO) / 2);
}

/** Kroppspoäng i varje träffområde utifrån totala KP. */
export function locationKp(totalKp: number): Record<HitLocation, number> {
  const out = {} as Record<HitLocation, number>;
  const last = LOCATION_KP_COLUMNS.length - 1;
  for (const loc of HIT_LOCATIONS) {
    const col = LOCATION_KP_COLUMNS.findIndex((max) => totalKp <= max);
    const row = LOCATION_KP[loc];
    if (totalKp < 5) out[loc] = Math.max(1, row[0] - 1);
    else if (col >= 0) out[loc] = row[col];
    else out[loc] = row[last] + Math.ceil((totalKp - LOCATION_KP_COLUMNS[last]) / 5);
  }
  return out;
}

/** Skadebonus som tärningsuttryck ('' = ingen). Över 180 tillkommer +1T6 per 40 poäng. */
export function damageBonus(attrs: Pick<Attrs, 'STY' | 'STO'>): string {
  const sum = attrs.STY + attrs.STO;
  const row = lookup(DAMAGE_BONUS, sum);
  if (row !== undefined) return row;
  return `${5 + Math.ceil((sum - 180) / 40)}T6`;
}

/** Förflyttning i rutor per stridsrunda. `raceMod` kommer från rasen (t.ex. alv +1). */
export function movement(attrs: Pick<Attrs, 'STO' | 'FYS' | 'SMI'>, raceMod = 0): number {
  const sum = attrs.STO + attrs.FYS + attrs.SMI;
  const base = lookup(MOVEMENT, sum) ?? 16 + Math.ceil((sum - 92) / 8);
  return Math.max(1, base + raceMod);
}

/** Baschans i en färdighet utifrån grundegenskapens värde. */
export function baseChance(attrValue: number): number {
  return lookup(BASE_CHANCE, attrValue) ?? 5;
}

/** Färdighetsnivå i kategori B (0–5). */
export function bLevel(fv: number): number {
  return lookup(B_LEVEL, fv) ?? 5;
}

/** Multipeln i kostnadstabellen för att höja från `from` till `to`. */
export function fvCostMultiplier(from: number, to: number): number {
  let sum = 0;
  for (let fv = from + 1; fv <= to; fv++) sum += fvStepCost(fv);
  return sum;
}

/** EP-kostnad för att höja ett FV: grundkostnad × multipel. */
export function fvCost(baseCost: number, from: number, to: number): number {
  return baseCost * fvCostMultiplier(from, to);
}

/** Pris i BP för ett köpt grundegenskapsvärde (3–18). */
export function attrPrice(value: number): number {
  const price = ATTR_PRICE[value];
  if (price === undefined) throw new Error(`Grundegenskaper köps mellan 3 och 18, inte ${value}`);
  return price;
}

/** BP-kostnad (positiv) eller återbäring (negativ) för att avvika från rasens normal-STO. */
export function stoPrice(steps: number): number {
  if (Math.abs(steps) > 5) throw new Error('STO kan bara ändras fem steg från normalvärdet');
  return steps >= 0 ? STO_PRICE_UP[steps] : -STO_REFUND_DOWN[-steps];
}

/** Ändring av rustningsvikt i procent utifrån STO+STY+FYS. */
export function armorWeightPercent(attrs: Pick<Attrs, 'STO' | 'STY' | 'FYS'>): number {
  const sum = attrs.STO + attrs.STY + attrs.FYS;
  return lookup(ARMOR_WEIGHT_MOD, sum) ?? 50 + 10 * Math.ceil((sum - 69) / 6);
}

/**
 * Avdrag för börda på förflyttning, SMI och SMI-baserade CL. Rustning som bärs på kroppen
 * räknas med halva vikten. `null` betyder att bördan är för tung för att röra sig med.
 */
export function encumbrance(loadKg: number, sty: number): number | null {
  if (loadKg <= sty) return 0;
  return lookup(ENCUMBRANCE, loadKg / sty) ?? null;
}

export type Grip = 'en hand' | 'två händer' | 'för tungt';

/**
 * Hantering (Bok III): STY ≥ STY-kravet räcker för en hand, annars krävs två händer.
 * Är kravet mer än dubbla STY kan vapnet inte användas i strid.
 */
export function grip(styRequirement: number, sty: number, twoHandedOnly = false): Grip {
  if (styRequirement > sty * 2) return 'för tungt';
  if (twoHandedOnly || styRequirement > sty) return 'två händer';
  return 'en hand';
}
