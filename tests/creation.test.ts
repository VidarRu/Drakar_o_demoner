import { describe, expect, it } from 'vitest';
import {
  ability,
  availableSpells,
  bpLeft,
  epBudget,
  epSpent,
  finalAttrs,
  finalize,
  maxPurchase,
  newDraft,
  profSkillErrors,
  skillBase,
  skillCost,
  startCapital,
  stepErrors,
  swordHand,
  socialClass,
  type Draft,
} from '../src/engine/creation';
import { movement } from '../src/engine/rules';

/**
 * Teval Ailindurbom, bokens exempel (Bok I s. 9–33): alvisk utbygdsjägare.
 * Enda skillnaden mot boken: Trästav står inte som egen post i utbygdsjägarens yrkeslista
 * (yrkeslistorna gäller) och hans tre vapenval är redan använda, så Knopar väljs i stället.
 * De 15 EP som Trästav kostade blir över.
 */
function teval(): Draft {
  const d = newDraft();
  d.name = 'Teval Ailindurbom';
  d.race = 'alv';
  d.profession = 'utbygdsjagare';
  d.bought = { STY: 12, FYS: 15, SMI: 15, INT: 8, PSY: 14, KAR: 10 };
  d.abilityBp = 1;
  d.abilityDice = 18; // 18 + 1 = 19: Hobbyist (boken slog om till 19)
  d.abilityChoice = { skill: 'lasdyrkning' };
  d.swordDice = 9;
  d.socialBp = 5;
  d.socialDice = 9;
  d.capitalBp = 3;
  d.capitalDice = 11;
  d.humanLanguage = 'Berendiska';
  d.profSkills = [
    'bagar', // Långbåge
    'enhandssvard', // Kortsvärd
    'skoldar',
    'magiskola:animism',
    'dolkar',
    'drogkunskap',
    'giftkunskap',
    'hantera_fallor',
    'hantverk:lader',
    'simma',
    'knopar',
    'overlevnad',
  ];
  d.targets = {
    klattra: 10,
    hantera_fallor: 11,
    bagar: 15,
    enhandssvard: 11,
    smyga: 10,
    rida: 11,
    spara: 5,
    upptacka_fara: 10,
    dolkar: 5,
  };
  return d;
}

describe('skapa rollperson med bakgrundspoäng', () => {
  it('Tevals bakgrundspoäng, slag och härledda värden', () => {
    const d = teval();
    expect(bpLeft(d)).toBe(5);
    expect(finalAttrs(d)).toEqual({ STY: 11, FYS: 15, SMI: 18, INT: 11, PSY: 14, KAR: 12, STO: 11 });
    expect(ability(d)?.id).toBe('hobbyist');
    expect(swordHand(d)).toBe('höger');
    expect(socialClass(d)).toBe('Högre medelklass');
    expect(startCapital(d)).toBe(3000);
    expect(epBudget(d)).toBe(175);
    expect(movement(finalAttrs(d), 1)).toBe(12);
    for (const step of ['grund', 'egenskaper', 'bakgrund', 'yrkesfardigheter'] as const) expect(stepErrors(d, step), step).toEqual([]);
  });

  it('baschanser som på Tevals rollformulär', () => {
    const d = teval();
    const expected: Record<string, number> = {
      bluffa: 2,
      finna_dolda_ting: 2,
      hoppa: 4,
      klattra: 4,
      lyssna: 6, // BC 2 + 4 för alv
      upptacka_fara: 7, // BC 3 + 4 för alv
      slagsmal: 2,
      'tala_modersmal:alviska': 16,
      'las_skriv_modersmal:alviska': 11,
      'tala_modersmal:berendiska': 16,
      'magiskola:animism': 2,
      skoldar: 4,
      'hantverk:lader': 4,
      simma: 4,
      lasdyrkning: 3, // Hobbyist
    };
    for (const [key, fv] of Object.entries(expected)) expect(skillBase(d, key), key).toBe(fv);
  });

  it('köper startfärdigheter som i boken', () => {
    const d = teval();
    expect(skillCost(d, 'bagar')).toBe(51);
    expect(skillCost(d, 'enhandssvard')).toBe(30);
    expect(skillCost(d, 'upptacka_fara')).toBe(6);
    expect(epSpent(d)).toBe(160);
    expect(maxPurchase(d, 'bagar')).toBe(15); // alver räknas som mogna för högsta FV
    expect(stepErrors(d, 'fardigheter')).toEqual([]);
  });

  it('stoppar köp som reglerna inte tillåter', () => {
    const d = teval();
    d.targets.bagar = 16;
    expect(stepErrors(d, 'fardigheter').join()).toMatch(/högst köpas till 15/);
    d.targets = { lasdyrkning: 5 };
    expect(stepErrors(d, 'fardigheter').join()).toMatch(/kan inte höjas/);
    d.targets = { geografi: 5 };
    expect(stepErrors(d, 'fardigheter').join()).toMatch(/kan inte höjas/);
  });

  it('kontrollerar yrkesfärdigheterna mot yrkeslistan', () => {
    const d = teval();
    d.profSkills = [...d.profSkills.slice(0, 11), 'lasdyrkning'];
    expect(profSkillErrors(d).join()).toMatch(/Låsdyrkning kan inte väljas/);
    d.profSkills = ['bagar', 'enhandssvard', 'skoldar', 'stickvapen', ...d.profSkills.slice(4, 12)];
    expect(profSkillErrors(d).join()).toMatch(/vapenfärdigheter \(högst 3\)/);
    d.profSkills = [...teval().profSkills.slice(0, 11), 'hantverk'];
    expect(profSkillErrors(d).join()).toMatch(/måste specificeras/);
  });

  it('kontrollerar grundegenskapskrav och STO', () => {
    const d = teval();
    d.bought.FYS = 11;
    expect(stepErrors(d, 'egenskaper').join()).toMatch(/FYS/);
    d.bought.FYS = 15;
    d.stoSteps = 4; // 11 + 4 = 15 > alvernas max 14
    expect(stepErrors(d, 'egenskaper').join()).toMatch(/STO/);
  });

  it('magiker väljer skola och besvärjelser', () => {
    const d = newDraft();
    d.name = 'Zot';
    d.profession = 'magiker';
    d.bought = { STY: 8, FYS: 10, SMI: 10, INT: 14, PSY: 15, KAR: 8 };
    d.swordDice = 7;
    d.socialDice = 7;
    d.capitalDice = 7;
    d.profSkills = ['magiskola:elementarmagi', 'kunskap_om_magi', 'alkemi', 'drogkunskap', 'geografi', 'giftkunskap', 'simma', 'zoologi', 'ortkunskap'];
    expect(profSkillErrors(d)).toEqual([]);
    d.targets['magiskola:elementarmagi'] = 6;
    const spells = availableSpells(d);
    expect(spells).toContain('eld');
    expect(spells).toContain('antimagi');
    expect(spells).not.toContain('hela');
    d.spells = { eld: 7 };
    expect(stepErrors(d, 'fardigheter')).toEqual([]);
    const c = finalize(d);
    expect(c.skills['kanna_magi:elementarmagi']).toBe(6);
    expect(c.spells.eld).toBe(7);
    d.profSkills = d.profSkills.filter((k) => !k.startsWith('magiskola'));
    expect(profSkillErrors(d).join()).toMatch(/måste välja en magiskola/);
  });

  it('gör färdigt en rollperson med utrustning', () => {
    const d = teval();
    d.bought_items = { kortsvard: 1, langbage: 1, harnesk_lader: 1, ryggsack: 1 };
    d.equipped = { weapon: 'kortsvard', armor: ['harnesk_lader'] };
    const c = finalize(d);
    expect(c.maxKp).toBe(13);
    expect(c.silver).toBe(3000 - 400 - 700 - 600 - 20);
    expect(c.skills.bagar).toBe(15);
    expect(c.skills.lasdyrkning).toBe(3);
    expect(c.skills.upptacka_fara).toBe(10);
    expect(c.inventory).toContain('langbage');
    d.equipped.shield = 'targ';
    expect(stepErrors(d, 'utrustning').join()).toMatch(/måste köpas/);
  });
});
