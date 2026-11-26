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
