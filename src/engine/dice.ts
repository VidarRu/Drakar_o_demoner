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

/** Slår en tärning med `sides` sidor. */
export function die(sides: number, rng: Rng): number {
  return 1 + Math.floor(rng() * sides);
}

/**
 * Slår ett tärningsuttryck på svenskt vis, t.ex. "3T6", "T8+1", "1T6-1", "-1T4" eller "5".
 * Flera termer kan kombineras: "1T8+1T4".
 */
export function roll(expr: string, rng: Rng): number {
  const clean = expr.replace(/\s+/g, '').toUpperCase();
  if (!clean) return 0;
  const terms = clean.match(/[+-]?[^+-]+/g);
  if (!terms) throw new Error(`Ogiltigt tärningsuttryck: ${expr}`);
  let total = 0;
  for (const term of terms) {
    const sign = term.startsWith('-') ? -1 : 1;
    const body = term.replace(/^[+-]/, '');
    const m = body.match(/^(\d*)[TD](\d+)$/);
    if (m) {
      const count = m[1] ? parseInt(m[1], 10) : 1;
      const sides = parseInt(m[2], 10);
      for (let i = 0; i < count; i++) total += sign * die(sides, rng);
    } else if (/^\d+$/.test(body)) {
      total += sign * parseInt(body, 10);
    } else {
      throw new Error(`Ogiltigt tärningsuttryck: ${expr}`);
    }
  }
  return total;
}
