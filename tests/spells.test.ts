import { describe, expect, it } from 'vitest';
import * as combat from '../src/engine/combat';
import { seededRng, type Rng } from '../src/engine/dice';
import { Game } from '../src/engine/game';
import { ironProblem } from '../src/engine/inventory';
import { castProblem, enemyCast, spellS, spellTargets } from '../src/engine/magic';
import type { Actor } from '../src/engine/types';
import { testCharacter } from './helpers';

/** Slumpkälla som ger talen i tur och ordning och sedan 0,5. */
function queue(...values: number[]): Rng {
  return () => (values.length ? values.shift()! : 0.5);
}
/** Talet som ger `n` på en tärning med `sides` sidor. */
const face = (n: number, sides = 20) => (n - 0.5) / sides;

/** Häxkonstnären mot rollpersonen på vägen, och det är häxkonstnärens tur. */
function witchFight(dist: number): { g: Game; p: Actor; witch: Actor } {
  const g = Game.create(testCharacter(), seededRng(5));
  const p = g.player;
  const witch = g.state.actors.find((a) => a.defId === 'haxkonstnar')!;
  p.x = 10;
  p.y = 12;
  witch.x = 10 + dist;
  witch.y = 12;
  combat.startCombat(g, [witch]);
  const c = g.state.combat!;
  c.round = 1;
  c.order = [witch.id, p.id];
  c.turn = 0;
  c.acted = {};
  c.movesLeft = witch.move;
  witch.movedLast = 0;
  return { g, p, witch };
}

describe('fiender som lägger besvärjelser', () => {
  it('häxkonstnären har sina besvärjelser i minnet och inget järn', () => {
    const { g, p, witch } = witchFight(4);
    expect(witch.spells).toEqual(['blixt', 'skold', 'hela']);
    expect(witch.skills['magiskola:elementarmagi']).toBe(14);
    expect(ironProblem(g, witch)).toBeNull();
    // S för BLIXT: 14 − 6 + 3 (INT 14).
    expect(spellS(witch, 'blixt')).toBe(11);
    expect(spellTargets(g, 'blixt', 0, witch)).toEqual([p]);
    expect(castProblem(g, 'blixt', { grade: 1, target: p.id, caster: witch })).toBeNull();
    // Gruppens magiker kan inte lägga hennes besvärjelser.
    expect(castProblem(g, 'blixt', { grade: 1, target: witch.id })).toMatch(/kan inte den besvärjelsen/);
  });

  it('på håll slår hon med BLIXT, och E väljs så att CL blir minst 8', () => {
    const { g, p, witch } = witchFight(4);
    const kp = p.kp;
    // E3 (S 11 − 2 = CL 9): T20 2 lyckas, skadan 3T6 blir 2 + 3 + 4.
    g.rng = queue(face(2), face(2, 6), face(3, 6), face(4, 6));
    combat.autoTurn(g);
    expect(witch.psy).toBe(16 - 3);
    expect(p.kp).toBe(kp - 9);
    expect(g.state.log.join('\n')).toContain('BLIXT E3');
  });

  it('när någon står intill lägger hon SKÖLD en gång och slåss sedan', () => {
    const { g, witch } = witchFight(1);
    g.rng = queue(face(2));
    combat.autoTurn(g);
    expect(combat.hasEffect(witch, 'luftsköld')).toBe(true);
    // Nästa tur: SKÖLD är redan lagd i striden.
    witch.effects = witch.effects.filter((e) => e.kind !== 'luftsköld');
    const c = g.state.combat!;
    c.turn = 0;
    c.order = [witch.id, g.player.id];
    c.acted = {};
    expect(enemyCast(g, witch)).toBe(false);
  });

  it('svårt skadad börjar hon mana HELA, och en träff bryter koncentrationen', () => {
    const { g, p, witch } = witchFight(4);
    witch.kp = Math.floor(witch.maxKp / 2);
    combat.autoTurn(g);
    const c = g.state.combat!;
    expect(c.pending).toHaveLength(1);
    expect(c.pending![0]).toMatchObject({ caster: witch.id, spell: 'hela', target: witch.id });
    expect(g.state.log.join('\n')).toContain('börjar mana HELA');
    const psy = witch.psy;
    combat.wound(g, witch, 1, null);
    expect(c.pending).toHaveLength(0);
    expect(witch.psy).toBe(psy - 1);
    expect(p.alive).toBe(true);
  });

  it('hon sparar alltid PSY till en E1 och tar aldrig PSY till 0', () => {
    const { g, witch } = witchFight(4);
    witch.psy = 3;
    g.rng = queue(face(2));
    combat.autoTurn(g);
    expect(g.state.log.join('\n')).toContain('BLIXT E1');
    expect(witch.psy).toBe(2);
    const next = witchFight(4);
    next.witch.psy = 2;
    expect(enemyCast(next.g, next.witch)).toBe(false);
  });
});
