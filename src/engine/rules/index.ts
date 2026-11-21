/**
 * Regelkärnan. Allt som gäller reglerna i Drakar och Demoner (1991) samlas här:
 * tärningsslag mot färdigheter och grundegenskaper, tabellerna och värden som räknas
 * fram ur dem. Regeldatan (raser, yrken, vapen m.m.) ligger i src/data/.
 */
import { roll, type Rng } from '../dice';
import { ATTR_KEYS, type Attrs } from '../types';

export * from './check';
export * from './derived';
export * from './fear';
export * from './fumble';
export * from './outcomes';
export * from './tables';

/**
 * Tillfälligt: slumpade grundegenskaper (3T6) för startskärmen, tills rollpersoner
 * skapas med bakgrundspoäng (steg 3).
 */
export function rollAttrs(rng: Rng): Attrs {
  const attrs = {} as Attrs;
  for (const k of ATTR_KEYS) attrs[k] = roll('3T6', rng);
  return attrs;
}

/**
 * Tillfälligt: förbättringsslag för färdigheter med erfarenhetskryss, tills
 * erfarenhetspoängen enligt reglerna byggs in (steg 5).
 */
export function improvementRoll(fv: number, rng: Rng): boolean {
  return fv < 20 && roll('1T20', rng) > fv;
}
