import { describe, expect, it } from 'vitest';
import { maxRoll, minRoll, roll, seededRng, type Rng } from '../src/engine/dice';
import {
  armorWeightPercent,
  attrPrice,
  attributeCheck,
  baseChance,
  bLevel,
  damageBonus,
  encumbrance,
  fvCost,
  fvCostMultiplier,
  grip,
  HIT_TABLE,
  locationKp,
  lookup,
  maxKp,
  movement,
  nativeLiteracyBc,
  nativeSpeechBc,
  resistance,
  resistanceTarget,
  skillCheck,
  SOCIAL_CLASS,
  spellBaseCost,
  START_BP,
  START_CAPITAL,
  stoPrice,
  SWORD_HAND,
} from '../src/engine/rules';

/** Slumpkälla som ger exakt de angivna T20-slagen i tur och ordning. */
function d20(...rolls: number[]): Rng {
  let i = 0;
  return () => {
    if (i >= rolls.length) throw new Error('Slut på förbestämda slag');
    return (rolls[i++] - 0.5) / 20;
  };
}

describe('tärningar', () => {
  it('räknar ut högsta och lägsta resultat', () => {
    expect(maxRoll('1T8+1')).toBe(9);
    expect(minRoll('1T8+1')).toBe(2);
    expect(maxRoll('3T6-2')).toBe(16);
    expect(minRoll('3T6-2')).toBe(1);
    expect(maxRoll('-1T4')).toBe(-1);
    expect(minRoll('-1T4')).toBe(-4);
    expect(maxRoll('1T100*10')).toBe(1000);
  });
  it('gångrar skattetabellernas uttryck', () => {
    const rng = seededRng(5);
    for (let i = 0; i < 50; i++) {
      const v = roll('1T100*10', rng);
      expect(v % 10).toBe(0);
      expect(v).toBeGreaterThanOrEqual(10);
      expect(v).toBeLessThanOrEqual(1000);
    }
  });
});

describe('färdighetsslag', () => {
  it('CL 1–19: perfekt och fummel kräver omslag mot FV', () => {
    expect(skillCheck(10, d20(1, 5)).result).toBe('perfekt');
    expect(skillCheck(10, d20(1, 15)).result).toBe('lyckat');
    expect(skillCheck(10, d20(20, 15)).result).toBe('fummel');
    expect(skillCheck(10, d20(20, 5)).result).toBe('misslyckat');
    expect(skillCheck(10, d20(10)).result).toBe('lyckat');
    expect(skillCheck(10, d20(11)).result).toBe('misslyckat');
  });
  it('omslaget jämförs med FV, inte med modifierad CL', () => {
    // FV 8 med +6: CL 14. Ettan slås om; 12 är under CL men över FV, alltså bara lyckat.
    expect(skillCheck(8, d20(1, 12), 6).result).toBe('lyckat');
    expect(skillCheck(8, d20(13), 6).result).toBe('lyckat');
  });
  it('differensvärde är CL minus slaget', () => {
    const c = skillCheck(15, d20(8));
    expect(c.diff).toBe(7);
    expect(skillCheck(10, d20(18)).diff).toBe(-8);
  });
  it('CL 20 eller mer', () => {
    expect(skillCheck(18, d20(1), 4).result).toBe('perfekt');
    expect(skillCheck(18, d20(2, 10), 4).result).toBe('perfekt');
    expect(skillCheck(18, d20(2, 19), 4).result).toBe('lyckat');
    expect(skillCheck(18, d20(19), 4).result).toBe('lyckat');
    expect(skillCheck(18, d20(20, 3), 4).result).toBe('misslyckat');
    expect(skillCheck(18, d20(20, 20), 4).result).toBe('fummel');
  });
  it('CL under 1: inget perfekt, 1 lyckas och 20 fumlar', () => {
    expect(skillCheck(3, d20(1), -5).result).toBe('lyckat');
    expect(skillCheck(3, d20(2), -5).result).toBe('misslyckat');
    expect(skillCheck(3, d20(20), -5).result).toBe('fummel');
  });
  it('FV 0 och CL 0: två ettor i rad krävs', () => {
    expect(skillCheck(0, d20(1, 1)).result).toBe('lyckat');
    expect(skillCheck(0, d20(1, 2)).result).toBe('misslyckat');
    expect(skillCheck(0, d20(5)).result).toBe('misslyckat');
  });
});

describe('motståndsslag', () => {
  it('följer Motståndstabellen (bokens exempel)', () => {
    expect(resistanceTarget(11, 15)).toBe(6); // bryta upp kistan: STY 11 mot Svårt
    expect(resistanceTarget(18, 20)).toBe(8); // undvika spikarna: SMI 18 mot Mycket svårt
    expect(resistanceTarget(9, 13)).toBe(6); // Köpslå 9 mot hästhandlarens 13
    expect(resistanceTarget(1, 10)).toBe(1);
    expect(resistanceTarget(10, 1)).toBe(19);
  });
  it('20 eller mer lyckas och 0 eller mindre misslyckas automatiskt', () => {
    const auto = resistance(15, 5, d20(20)); // FYS 15 mot gift med SG 5
    expect(auto.automatic).toBe(true);
    expect(auto.success).toBe(true);
    const never = resistance(1, 12, d20(1));
    expect(never.automatic).toBe(true);
    expect(never.success).toBe(false);
  });
  it('grundegenskapsslag Normalt är att slå under grundegenskapen', () => {
    expect(attributeCheck(12, d20(12)).success).toBe(true);
    expect(attributeCheck(12, d20(13)).success).toBe(false);
    expect(attributeCheck(12, d20(8), 'Svårt').success).toBe(false);
  });
});

describe('härledda värden', () => {
  // Teval Ailindurbom, bokens exempelrollperson: alv med STY 11, FYS 15, SMI 18, STO 11.
  const teval = { STY: 11, STO: 11, FYS: 15, SMI: 18, INT: 11, PSY: 14, KAR: 12 };

  it('kroppspoäng och träffområden', () => {
    expect(maxKp(teval)).toBe(13);
    expect(locationKp(13)).toEqual({
      huvud: 5,
      bröstkorg: 6,
      mage: 5,
      'vänster arm': 4,
      'höger arm': 4,
      'vänster ben': 5,
      'höger ben': 5,
    });
    expect(locationKp(5).bröstkorg).toBe(4);
    expect(locationKp(45).bröstkorg).toBe(12);
    expect(locationKp(3)['höger arm']).toBe(1);
  });
  it('skadebonus', () => {
    expect(damageBonus(teval)).toBe('');
    expect(damageBonus({ STY: 14, STO: 14 })).toBe('1');
    expect(damageBonus({ STY: 15, STO: 16 })).toBe('1T2');
    expect(damageBonus({ STY: 25, STO: 25 })).toBe('1T6'); // troll
    expect(damageBonus({ STY: 29, STO: 28 })).toBe('1T10'); // mantikora enligt formeln
    expect(damageBonus({ STY: 100, STO: 100 })).toBe('6T6'); // draken
  });
  it('förflyttning', () => {
    expect(movement(teval, 1)).toBe(12);
    expect(movement({ STO: 5, FYS: 3, SMI: 3 })).toBe(7);
    expect(movement({ STO: 40, FYS: 30, SMI: 30 })).toBe(17);
  });
  it('baschans och B-nivåer', () => {
    expect(baseChance(18)).toBe(4);
    expect(baseChance(12)).toBe(2);
    expect(baseChance(3)).toBe(0);
    expect(baseChance(21)).toBe(5);
    expect([0, 4, 5, 15, 16, 20].map(bLevel)).toEqual([0, 1, 2, 3, 4, 5]);
  });
  it('kostnadstabellen stämmer med boken', () => {
    const row0 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 21, 24, 27, 31, 35, 39, 44];
    row0.forEach((v, i) => expect(fvCostMultiplier(0, i + 1)).toBe(v));
    expect(fvCostMultiplier(12, 21)).toBe(30);
    expect(fvCostMultiplier(17, 18)).toBe(4);
    expect(fvCostMultiplier(20, 21)).toBe(5);
    expect(fvCostMultiplier(14, 15)).toBe(3);
  });
  it('Tevals startfärdigheter kostar exakt hans 175 EP', () => {
    const spent = [
      fvCost(2, 4, 10), // Klättra
      fvCost(3, 4, 11), // Hantera fällor
      fvCost(3, 4, 15), // Långbåge
      fvCost(3, 2, 11), // Kortsvärd
      fvCost(3, 4, 9), // Trästav
      fvCost(2, 4, 10), // Smyga
      fvCost(2, 4, 11), // Rida
      fvCost(2, 2, 5), // Spåra
      fvCost(2, 7, 10), // Upptäcka fara
      fvCost(3, 4, 5), // Dolk
    ];
    expect(spent).toEqual([12, 24, 51, 30, 15, 12, 16, 6, 6, 3]);
    expect(spent.reduce((s, v) => s + v, 0)).toBe(175);
  });
  it('besvärjelser kostar efter skolvärde', () => {
    expect(spellBaseCost(6)).toBe(4);
    expect(spellBaseCost(19)).toBe(14);
    expect(spellBaseCost(22)).toBe(16);
    expect(spellBaseCost(6) * fvCostMultiplier(7, 10)).toBe(12); // KNÄCKA
    expect(spellBaseCost(19) * fvCostMultiplier(7, 10)).toBe(42); // FÖRSTENA
  });
  it('Tevals bakgrundspoäng går jämnt ut', () => {
    const attrs = [12, 15, 15, 8, 14, 10].map(attrPrice).reduce((s, v) => s + v, 0);
    expect(attrs).toBe(86);
    // Ras 25, grundegenskaper 86, särskild förmåga 1, socialt stånd 5, startkapital 3, 5 kvar.
    expect(25 + attrs + 1 + 5 + 3 + 5).toBe(START_BP);
    expect(stoPrice(4)).toBe(8);
    expect(stoPrice(-4)).toBe(-5);
    expect(() => attrPrice(19)).toThrow();
  });
  it('socialt stånd, startkapital, svärdshand och modersmål', () => {
    expect(lookup(SOCIAL_CLASS, 14)).toBe('Högre medelklass');
    expect(lookup(START_CAPITAL, 17)).toBe(3000);
    expect(lookup(SWORD_HAND, 9)).toBe('höger');
    expect(lookup(SWORD_HAND, 19)).toBe('ambidextriös');
    expect(nativeLiteracyBc('Högre medelklass', 11)).toBe(11);
    expect(nativeLiteracyBc('Egendomslös', 10)).toBe(0);
    expect(nativeSpeechBc('Högre medelklass')).toBe(16);
    expect(nativeSpeechBc('Lågadel')).toBe(20);
  });
  it('träfftabellen täcker 1–20', () => {
    for (const table of Object.values(HIT_TABLE)) {
      for (let r = 1; r <= 20; r++) expect(lookup(table, r)).toBeDefined();
    }
    expect(lookup(HIT_TABLE.närstrid, 17)).toBe('huvud');
    expect(lookup(HIT_TABLE.avstånd, 14)).toBe('bröstkorg');
  });
  it('hantering, rustningsvikt och börda', () => {
    expect(grip(13, 13)).toBe('en hand');
    expect(grip(13, 12)).toBe('två händer');
    expect(grip(7, 15, true)).toBe('två händer');
    expect(grip(30, 14)).toBe('för tungt');
    expect(armorWeightPercent({ STY: 17, FYS: 15, STO: 16 })).toBe(20);
    expect(armorWeightPercent({ STY: 13, FYS: 13, STO: 13 })).toBe(0);
    expect(encumbrance(10, 12)).toBe(0);
    expect(encumbrance(30, 12)).toBe(-2);
    expect(encumbrance(80, 12)).toBeNull();
  });
});
