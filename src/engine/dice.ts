/** Slumpkälla: returnerar ett tal i [0, 1). Kan bytas ut mot en seedad variant i tester. */
export type Rng = () => number;

export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Slår en tärning med `sides` sidor. T2 och T3 slås i boken med en T6 (1–3 = 1 osv.),
 * vilket ger samma fördelning som en riktig tvåsidig eller tresidig tärning.
 */
export function die(sides: number, rng: Rng): number {
  return 1 + Math.floor(rng() * sides);
}

interface Term {
  sign: 1 | -1;
  count: number;
  /** 0 betyder en fast siffra. */
  sides: number;
}

function parse(expr: string): Term[] {
  const clean = expr.replace(/\s+/g, '').toUpperCase();
  if (!clean) return [];
  const terms = clean.match(/[+-]?[^+-]+/g);
  if (!terms) throw new Error(`Ogiltigt tärningsuttryck: ${expr}`);
  return terms.map((term) => {
    const sign = term.startsWith('-') ? -1 : 1;
    const body = term.replace(/^[+-]/, '');
    const m = body.match(/^(\d*)[TD](\d+)$/);
    if (m) return { sign, count: m[1] ? parseInt(m[1], 10) : 1, sides: parseInt(m[2], 10) };
    if (/^\d+$/.test(body)) return { sign, count: parseInt(body, 10), sides: 0 };
    throw new Error(`Ogiltigt tärningsuttryck: ${expr}`);
  });
}

/**
 * Slår ett tärningsuttryck på svenskt vis, t.ex. "3T6", "T8+1", "1T6-1", "-1T4", "1T100" eller "5".
 * Flera termer kan kombineras: "1T8+1T4". Ett avslutande "*N" gångrar hela summan
 * (skattetabellernas "1T100x10" skrivs "1T100*10").
 */
export function roll(expr: string, rng: Rng): number {
  const [body, mult] = splitMultiplier(expr);
  if (mult !== 1) return roll(body, rng) * mult;
  let total = 0;
  for (const t of parse(expr)) {
    if (t.sides === 0) total += t.sign * t.count;
    else for (let i = 0; i < t.count; i++) total += t.sign * die(t.sides, rng);
  }
  return total;
}

/** Högsta möjliga resultat, t.ex. för ett perfekt anfall som gör maximal skada. */
export function maxRoll(expr: string): number {
  const [body, mult] = splitMultiplier(expr);
  return mult * parse(body).reduce((s, t) => s + extreme(t, true), 0);
}

/** Lägsta möjliga resultat. */
export function minRoll(expr: string): number {
  const [body, mult] = splitMultiplier(expr);
  return mult * parse(body).reduce((s, t) => s + extreme(t, false), 0);
}

function splitMultiplier(expr: string): [string, number] {
  const m = expr.match(/^(.*)\*\s*(\d+)\s*$/);
  return m ? [m[1], parseInt(m[2], 10)] : [expr, 1];
}

function extreme(t: Term, high: boolean): number {
  if (t.sides === 0) return t.sign * t.count;
  // En adderad tärning ger mest när den slår högt, en subtraherad när den slår lågt.
  const face = high === (t.sign > 0) ? t.sides : 1;
  return t.sign * t.count * face;
}
