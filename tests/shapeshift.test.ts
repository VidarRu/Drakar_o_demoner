import { describe, expect, it } from 'vitest';
import * as combat from '../src/engine/combat';
import { seededRng, type Rng } from '../src/engine/dice';
import { Game } from '../src/engine/game';
import { castProblem } from '../src/engine/magic';
import { shapeOf } from '../src/engine/shapeshift';
import { HAMN } from '../src/engine/rules';
import { flightSpeed, passable } from '../src/engine/spelleffects';
import type { Character } from '../src/engine/types';
import { testCharacter } from './helpers';

function queue(...values: number[]): Rng {
  return () => (values.length ? values.shift()! : 0.5);
}
const face = (n: number, sides = 20) => (n - 0.5) / sides;

/** En hamnbytare med djuret `animal` (index i HAMN). */
function shifter(animal: number): Character {
  const c = testCharacter();
  c.ability = { id: 'hamnbytare', total: 78, choice: { animal } };
  c.skills.historia = 9;
  return c;
}

describe('Hamnbytare', () => {
  it('djuret slås med 1T6 första gången och står sedan fast', () => {
    const c = testCharacter();
    c.ability = { id: 'hamnbytare', total: 78 };
    const g = Game.create(c, seededRng(1));
    g.rng = queue(face(2, 6));
    expect(shapeOf(g, g.player)).toBe(1);
    expect(HAMN[shapeOf(g, g.player)!].name).toBe('björn');
    expect(g.state.log.join('\n')).toContain('djurhamn är en björn');
  });

  it('som varg: djurets kropp och bett, men INT och INT-färdigheter är kvar; skadan följer med tillbaka', () => {
    const g = Game.create(shifter(0), seededRng(1));
    const p = g.player;
    const int = p.attrs.INT;
    combat.wound(g, p, 2, 'bröstkorg');
    expect(g.shapeshift()).toBeNull();
    expect(p.shape).toBeDefined();
    expect(p.attrs).toMatchObject({ STY: 11, STO: 7, FYS: 14, SMI: 16, INT: int });
    expect(p.skills.historia).toBe(9);
    expect(p.skills.enhandssvard).toBeUndefined();
    expect(combat.weaponInfo(p)).toMatchObject({ name: 'Bett', damage: '1T8', natural: true });
    expect(g.skillFv(p, 'hamn')).toBe(10);
    expect(p.kp).toBe(p.maxKp - 2);
    expect(p.detailed).toBe(false);
    expect(p.torchOut).toBe(true);
    expect(castProblem(g, 'blixt', { grade: 1 })).toMatch(/djurhamn/);
    // Vargen tar 3 i skada, och den följer med när hen blir människa igen.
    combat.wound(g, p, 3, null);
    const kp = p.shape!.human.kp;
    expect(g.shapeshift()).toBeNull();
    expect(p.shape).toBeUndefined();
    expect(p.detailed).toBe(true);
    expect(p.kp).toBe(kp - 3);
    expect(p.weapon).toBe('bredsvard');
  });

  it('som hök flyger hen över vatten, och som svan simmar hen', () => {
    const g = Game.create(shifter(2), seededRng(1));
    const p = g.player;
    g.shapeshift();
    expect(flightSpeed(p)).toBe(30);
    expect(combat.effectiveMove(p, g)).toBe(30);
    expect(passable(g, p, 8, 14)).toBe(true);
    const g2 = Game.create(shifter(4), seededRng(1));
    g2.shapeshift();
    expect(passable(g2, g2.player, 8, 14)).toBe(true);
  });

  it('efter fler timmar än PSY i hamnen slås PSY-slag, och ett misslyckat ger hamnen för alltid', () => {
    const g = Game.create(shifter(0), seededRng(1));
    const p = g.player;
    g.shapeshift();
    // PSY 10: tio timmar går bra, den elfte kräver ett slag.
    g.rng = queue(face(20), face(20));
    g.sleep(10);
    expect(g.char.stuckInShape).toBeUndefined();
    g.sleep(1);
    expect(g.char.stuckInShape).toBe(true);
    expect(g.shapeshift()).toMatch(/fastnat/);
    expect(p.shape).toBeDefined();
  });
});

describe('HAMNSKIFTARE, kanalisering, vänster hand och borttagna förmågor', () => {
  it('HAMNSKIFTARE: magikern väljer djur och kan bli människa igen utan förmågan', async () => {
    const { castSpell } = await import('../src/engine/magic');
    const c = testCharacter();
    c.attrs.INT = 15;
    c.skills['magiskola:animism'] = 14;
    c.spells = ['hamnskiftare'];
    c.memorized = ['hamnskiftare'];
    c.inventory = [];
    c.equipped = { armor: [] };
    const g = Game.create(c, seededRng(1));
    const p = g.player;
    expect(castProblem(g, 'hamnskiftare', { grade: 1 })).toMatch(/Välj ett djur/);
    g.rng = queue(face(2));
    expect(castSpell(g, 'hamnskiftare', { grade: 1, animal: 1 })).toBeNull();
    expect(p.shape?.animal).toBe(1);
    expect(p.sprite).toBe('bjorn');
    expect(g.shapeshift()).toBeNull();
    expect(p.shape).toBeUndefined();
  });

  it('Magisk kanalisering: ett lyckat slag ger magikern mediets PSY, och mediet behåller 1', async () => {
    const { channel, mediumPsy } = await import('../src/engine/channel');
    const { castSpell } = await import('../src/engine/magic');
    const { RECRUITS } = await import('../src/content');
    const c = testCharacter();
    c.attrs.INT = 15;
    c.skills['magiskola:animism'] = 14;
    c.skills.magisk_kanalisering = 12;
    c.spells = ['hamnskiftare'];
    c.memorized = ['hamnskiftare'];
    c.inventory = [];
    c.equipped = { armor: [] };
    const g = Game.create(c, seededRng(1));
    const p = g.player;
    // Linnea som medium: en villig person i gruppen bredvid.
    const linnea = g.state.actors.find((a) => a.companion?.recruit === 'linnea')!;
    expect(RECRUITS.linnea).toBeDefined();
    g.state.party.push(linnea.id);
    linnea.kind = 'player';
    linnea.x = p.x + 1;
    linnea.y = p.y;
    g.rng = queue(face(2));
    expect(channel(g, p, linnea)).toBeNull();
    expect(mediumPsy(g, p)).toBe(linnea.psy - 1);
    p.psy = 1;
    const before = linnea.psy;
    g.rng = queue(face(2));
    expect(castSpell(g, 'hamnskiftare', { grade: 1, animal: 0, useMedium: true })).toBeNull();
    expect(linnea.psy).toBe(before - 1);
    expect(p.psy).toBe(1);
  });

  it('vänster hand ger motståndaren −2 på parering, och de borttagna förmågorna ger raden ovanför', async () => {
    const { abilityFor } = await import('../src/data/abilities');
    expect(abilityFor(47).id).not.toBe('god_tidskansla');
    expect(abilityFor(50).id).not.toBe('absolut_ogonmatt');
    expect(abilityFor(47).id).toBe(abilityFor(52).id);
    const g = Game.create(testCharacter(), seededRng(3));
    const p = g.player;
    const alf = g.state.actors.find((a) => a.defId === 'svartalf')!;
    p.x = 10;
    p.y = 12;
    alf.x = 11;
    alf.y = 12;
    combat.startCombat(g, [alf]);
    // Svartalfen får −2 på pareringen mot ett hugg med vänster hand.
    p.swordArm = 'vänster arm';
    g.rng = queue(face(5), face(3), face(5, 6), face(10));
    combat.attackOnce(g, p, alf, 'weapon');
    expect(g.state.log.join('\n')).toMatch(/−2 vänster hand|-2 vänster hand/);
  });
});
