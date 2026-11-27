import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ARMOR_LIST,
  CREATURE_LIST,
  ITEM_LIST,
  MELEE_WEAPONS,
  PROFESSION_LIST,
  RACE_LIST,
  RACES,
  SHIELD_LIST,
  SKILL_LIST,
  SKILLS,
  SPELL_LIST,
  TREASURES,
  WEAPON_LIST,
  WEAPONS,
  weaponSkill,
} from '../src/data';
import { maxRoll, minRoll } from '../src/engine/dice';
import { AGE_GROUPS, HIT_LOCATIONS } from '../src/engine/rules';
import { ATTR_KEYS } from '../src/engine/types';

const unique = (ids: string[]) => expect(new Set(ids).size).toBe(ids.length);
const parses = (expr: string) => {
  expect(() => [maxRoll(expr), minRoll(expr)], expr).not.toThrow();
};

describe('färdigheter', () => {
  it('har unika id och rimliga fält', () => {
    unique(SKILL_LIST.map((s) => s.id));
    for (const s of SKILL_LIST) {
      if (s.cappedBy) expect(SKILLS[s.cappedBy], s.id).toBeDefined();
      if (s.attr !== 'spec') expect(ATTR_KEYS, s.id).toContain(s.attr);
    }
    expect(SKILL_LIST.filter((s) => s.type === 'primär')).toHaveLength(19);
  });
});

describe('raser', () => {
  it('har en egen kort beskrivning', () => {
    for (const r of RACE_LIST) {
      expect(r.desc.length, r.id).toBeGreaterThanOrEqual(20);
      expect(r.desc.length, r.id).toBeLessThanOrEqual(160);
    }
  });

  it('har en bild för varje ras och yrke', () => {
    for (const r of RACE_LIST) {
      expect(fs.existsSync(`public/art/bok/raser/${r.id}.webp`), r.id).toBe(true);
    }
    for (const p of PROFESSION_LIST) {
      expect(fs.existsSync(`public/art/bok/yrken/${p.id}.webp`), p.id).toBe(true);
    }
  });

  it('följer tabellerna i Bok I', () => {
    expect(RACE_LIST.map((r) => [r.id, r.bp])).toEqual([
      ['alv', 25],
      ['anka', 0],
      ['dvarg', 25],
      ['halvalv', 15],
      ['halvlangdsman', 15],
      ['halvorch', 10],
      ['manniska', 10],
    ]);
    expect(RACES.dvarg.mods.PSY).toBe(2);
    for (const r of RACE_LIST) {
      for (const id of [...Object.keys(r.skillBonus), ...Object.keys(r.fixedSkills)]) expect(SKILLS[id], `${r.id}: ${id}`).toBeDefined();
      expect(r.sto.min).toBeLessThanOrEqual(r.sto.normal);
      expect(r.sto.normal).toBeLessThanOrEqual(r.sto.max);
      for (const k of ATTR_KEYS) parses(r.dice[k]);
      if (r.ages) for (const g of AGE_GROUPS) expect(r.ages[g][0]).toBeLessThanOrEqual(r.ages[g][1]);
      else expect(r.ageRules).toBeDefined();
    }
  });
});

describe('yrken', () => {
  it('alla val i yrkeslistorna finns som färdigheter', () => {
    unique(PROFESSION_LIST.map((p) => p.id));
    expect(PROFESSION_LIST).toHaveLength(11);
    for (const p of PROFESSION_LIST) {
      expect(p.picks, p.id).toBe(p.id === 'magiker' ? 9 : 12);
      for (const o of p.options) {
        if (typeof o !== 'string') continue;
        const [id, sub] = o.split(':');
        expect(SKILLS[id], `${p.id}: ${o}`).toBeDefined();
        if (sub) expect(SKILLS[id].specialized?.options?.some((x) => x.id === sub), `${p.id}: ${o}`).toBe(true);
      }
      for (const id of p.primarySkills ?? []) expect(SKILLS[id]).toBeDefined();
    }
  });
  it('följer yrkeslistorna där de skiljer sig från tabellen', () => {
    const opts = (id: string) => PROFESSION_LIST.find((p) => p.id === id)!.options;
    expect(opts('utbygdsjagare')).not.toContain('trastav');
    expect(opts('helare')).toContain('dolkar');
    expect(opts('helare')).not.toContain('sprakkunskap');
    expect(opts('tjuv')).toContain('drogkunskap');
    expect(opts('tjuv')).not.toContain('hasardspel');
  });
});

describe('vapen, rustningar och sköldar', () => {
  it('har giltiga värden', () => {
    unique(WEAPON_LIST.map((w) => w.id));
    for (const w of WEAPON_LIST) {
      parses(w.damage);
      for (const sty of [3, 10, 18, 40]) {
        const skill = weaponSkill(w, sty);
        expect(SKILLS[skill], `${w.id} (STY ${sty})`).toBeDefined();
      }
    }
    unique(ARMOR_LIST.map((a) => a.id));
    for (const a of ARMOR_LIST) for (const loc of a.covers) expect(HIT_LOCATIONS).toContain(loc);
    unique(SHIELD_LIST.map((s) => s.id));
    expect(MELEE_WEAPONS).toHaveLength(34); // alla rader i närstridstabellen
  });
  it('vapengruppen beror på om rollpersonen orkar föra vapnet med en hand', () => {
    expect(weaponSkill(WEAPONS.bredsvard, 13)).toBe('enhandssvard');
    expect(weaponSkill(WEAPONS.bredsvard, 12)).toBe('tvahandsvapen');
    expect(weaponSkill(WEAPONS.tvahandssvard, 40)).toBe('tvahandsvapen');
    expect(weaponSkill(WEAPONS.handyxa, 10)).toBe('enhandsyxor');
    expect(weaponSkill(WEAPONS.trastav, 10)).toBe('trastav');
    expect(weaponSkill(WEAPONS.langbage, 10)).toBe('bagar');
  });
});

describe('varelser', () => {
  it('har giltiga färdigheter och anfall', () => {
    unique(CREATURE_LIST.map((c) => c.id));
    const free = new Set(['narstridsvapen', 'avstandsvapen', 'som_levande', 'besvarjelser']);
    for (const c of CREATURE_LIST) {
      for (const id of Object.keys(c.skills)) expect(SKILLS[id] || free.has(id), `${c.id}: ${id}`).toBeTruthy();
      for (const atk of c.attacks) parses(atk.damage);
      if (c.race) expect(RACES[c.race], c.id).toBeDefined();
    }
  });
});

describe('besvärjelser och utrustning', () => {
  it('besvärjelserna är kompletta', () => {
    // 66 i boken, där FRAMMANA/SKICKA BORT ELEMENTAR är uppdelad i en besvärjelse per sorts elementar (8),
    // och Vidars egen HAMNSKIFTARE.
    expect(SPELL_LIST).toHaveLength(74);
    unique(SPELL_LIST.map((s) => s.id));
    for (const s of SPELL_LIST) {
      expect(s.sv).toBeGreaterThanOrEqual(1);
      expect(s.sv).toBeLessThanOrEqual(15);
      if (s.ritual) expect(s.school).toBe('allmän');
    }
  });
  it('utrustning och skatter', () => {
    unique(ITEM_LIST.map((i) => i.id));
    for (const i of ITEM_LIST) expect(i.price).toBeGreaterThan(0);
    for (const t of Object.values(TREASURES)) for (const e of [t.gm, t.sm, t.km, t.magic, t.jewels]) if (e) parses(e);
  });
});

describe('magi i modulerna', () => {
  // Vidar: ingen, varken rollperson, följeslagare eller person i en modul, kan en besvärjelse utan
  // FV i magiskolan (minst skolvärdet, som när man lär sig den).
  it('varelser och följeslagare kan bara besvärjelser ur skolor där de har FV', async () => {
    const { CREATURES, RECRUITS } = await import('../src/content');
    const { SPELLS } = await import('../src/data/spells');
    const fvIn = (skills: Record<string, number>, school: string) =>
      school === 'allmän' ? Math.max(0, ...Object.entries(skills).filter(([k]) => k.startsWith('magiskola:')).map(([, v]) => v)) : (skills[`magiskola:${school}`] ?? 0);
    for (const c of Object.values(CREATURES)) {
      if (!c.magic) continue;
      const skills = Object.fromEntries(Object.entries(c.magic.schools).map(([k, v]) => [`magiskola:${k}`, v as number]));
      for (const id of c.magic.spells) {
        const sp = SPELLS[id];
        expect(sp, `${c.id}: ${id}`).toBeDefined();
        expect(fvIn(skills, sp.school), `${c.id}: ${id}`).toBeGreaterThanOrEqual(sp.sv);
      }
    }
    for (const r of Object.values(RECRUITS)) {
      const ch = r.character();
      for (const id of ch.spells) expect(fvIn(ch.skills, SPELLS[id].school), `${r.id}: ${id}`).toBeGreaterThanOrEqual(SPELLS[id].sv);
    }
  });
});
