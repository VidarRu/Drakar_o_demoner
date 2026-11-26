import { describe, expect, it } from 'vitest';
import * as combat from '../src/engine/combat';
import { seededRng, type Rng } from '../src/engine/dice';
import { Game } from '../src/engine/game';
import { castSpell } from '../src/engine/magic';
import { empathy, itemLabel, itemUses, knownLevel, senseMagic, useItem, useProblem } from '../src/engine/magicitems';
import { chargeAvailable } from '../src/engine/rituals';
import { ironProblem } from '../src/engine/inventory';
import type { Character } from '../src/engine/types';
import { testCharacter } from './helpers';

function queue(...values: number[]): Rng {
  return () => (values.length ? values.shift()! : 0.5);
}
const face = (n: number, sides = 20) => (n - 0.5) / sides;

function seer(): Character {
  const c = testCharacter();
  c.profession = 'magiker';
  c.attrs.INT = 15;
  c.attrs.PSY = 18;
  c.skills['magiskola:mentalism'] = 16;
  c.skills['magiskola:animism'] = 14;
  c.skills['kanna_magi:animism'] = 14;
  c.spells = ['syn', 'varseblivning'];
  c.memorized = [...c.spells];
  c.inventory = ['trastav', 'lakebrygd', 'haxstav'];
  c.equipped = { weapon: 'trastav', armor: [] };
  return c;
}

function calm(c: Character) {
  const g = Game.create(c, seededRng(3));
  for (const a of g.state.actors) if (a.hostile) a.alive = false;
  return { g, p: g.player };
}

describe('magiska föremål', () => {
  it('ser ut som vanliga föremål tills de är analyserade, och Känna magi visar att de är magiska', () => {
    const { g, p } = calm(seer());
    expect(itemLabel(g, 'lakebrygd')).toBe('Liten flaska med grönaktig dryck');
    expect(itemUses(g, p, 'lakebrygd')).toEqual([]);
    // Känna magi i animism: FV 14 − 20 + 2 E = CL −4, alltså bara på ett perfekt slag.
    g.rng = queue(face(1), face(1));
    expect(senseMagic(g, p, 'lakebrygd')).toBeNull();
    expect(knownLevel(g, 'lakebrygd')).toBe(1);
    expect(itemLabel(g, 'lakebrygd')).toMatch(/\(magiskt\)/);
  });

  it('VARSEBLIVNING visar besvärjelserna, SYN hur de används; sedan kan brygden drickas', () => {
    const { g, p } = calm(seer());
    g.rng = queue(face(2));
    expect(castSpell(g, 'varseblivning', { grade: 3, seek: 'magi' })).toBeNull();
    expect(knownLevel(g, 'lakebrygd')).toBe(2);
    expect(itemLabel(g, 'lakebrygd')).toBe('Läkebrygd');
    expect(useProblem(g, p, 'lakebrygd', 0)).toMatch(/aktiveras/);
    g.rng = queue(face(2));
    expect(castSpell(g, 'syn', { grade: 3 })).toBeNull();
    expect(knownLevel(g, 'lakebrygd')).toBe(3);
    combat.wound(g, p, 5, 'bröstkorg');
    const kp = p.kp;
    const psy = p.psy;
    // HELA E2 lyckas alltid: 2T6 blir 3 + 3. NEXUS: inga PSY.
    g.rng = queue(face(3, 6), face(3, 6));
    expect(useItem(g, p, 'lakebrygd', 0)).toBeNull();
    expect(p.kp).toBe(kp + 5);
    expect(p.psy).toBe(psy);
    expect(g.char.inventory).not.toContain('lakebrygd');
  });

  it('häxkonstnärens stav: LADDNING ger 10 PSY och LJUS kostar inget; den är inte av järn', () => {
    const { g, p } = calm(seer());
    expect(ironProblem(g, p)).toBeNull();
    expect(chargeAvailable(g, p)).toBe(0);
    g.state.itemKnown = { haxstav: 3 };
    expect(chargeAvailable(g, p)).toBe(10);
    expect(itemUses(g, p, 'haxstav').map((u) => u.spell)).toEqual(['ljus']);
    expect(useItem(g, p, 'haxstav', 1, { target: p.id })).toBeNull();
    expect(p.effects.some((e) => e.kind === 'ljus')).toBe(true);
    // PERMANENS: den kan användas igen.
    expect(itemUses(g, p, 'haxstav').map((u) => u.spell)).toEqual(['ljus']);
  });

  it('Grukks bredsvärd verkar ständigt med FÖRTROLLA VAPEN E1 i handen, utan analys', () => {
    const c = testCharacter();
    c.inventory.push('grukks_bredsvard');
    const { g, p } = calm(c);
    expect(combat.weaponMagic(p, 'weapon')).toBe(0);
    p.weapon = 'grukks_bredsvard';
    g.changed();
    expect(combat.weaponMagic(p, 'weapon')).toBe(1);
    expect(combat.weaponInfo(p).damage).toBe('1T8+1');
    p.weapon = 'bredsvard';
    g.changed();
    expect(combat.weaponMagic(p, 'weapon')).toBe(0);
    // Grukk själv bär det.
    const grukk = g.state.actors.find((a) => a.defId === 'svartalfshovding')!;
    grukk.alive = true;
    g.changed();
    expect(combat.weaponMagic(grukk, 'weapon')).toBe(1);
  });

  it('Magisk empati: PSY mot effektgraderna visar besvärjelserna', () => {
    const c = seer();
    c.ability = { id: 'magisk_empati', total: 62 };
    const { g, p } = calm(c);
    // PSY 18 mot 3 E: 25 eller mer lyckas alltid.
    g.rng = queue(face(10));
    expect(empathy(g, p, 'haxstav')).toBeNull();
    expect(knownLevel(g, 'haxstav')).toBe(2);
  });
});
