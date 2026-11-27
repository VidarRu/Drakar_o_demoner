import { describe, expect, it } from 'vitest';
import * as combat from '../src/engine/combat';
import { seededRng } from '../src/engine/dice';
import { Game } from '../src/engine/game';
import { testCharacter } from './helpers';

/** Husregel (Vidar): gruppens medlemmar går igenom varandra genom att byta plats. */

function withHjalmar() {
  const g = Game.create(testCharacter(), seededRng(5));
  g.leader.silver = 1000;
  const h = g.state.actors.find((a) => a.companion?.recruit === 'hjalmar')!;
  g.recruit(h.id);
  const p = g.leader;
  // Vägen genom byn (rad 12) är öppen åt båda hållen.
  p.x = 10;
  p.y = 12;
  h.x = 11;
  h.y = 12;
  return { g, p, h };
}

describe('gå igenom varandra', () => {
  it('ledaren byter plats med en följeslagare utanför strid', () => {
    const { g, p, h } = withHjalmar();
    expect(g.stepPlayer({ x: 11, y: 12 })).toBe(true);
    expect([p.x, p.y]).toEqual([11, 12]);
    expect([h.x, h.y]).toEqual([10, 12]);
  });

  it('vägen går genom kamrater men inte genom fiender', () => {
    const { g, p } = withHjalmar();
    const path = g.pathTo(13, 12)!;
    expect(path.map((t) => `${t.x},${t.y}`)).toContain('11,12');
    expect(path.at(-1)).toEqual({ x: 13, y: 12 });
    const foe = g.state.actors.find((a) => a.defId === 'svartalf')!;
    foe.x = 12;
    foe.y = 12;
    expect(g.pathTo(13, 12)!.map((t) => `${t.x},${t.y}`)).not.toContain('12,12');
    expect(p.x).toBe(10);
  });

  it('i strid byter man plats med en kamrat, och steget räknas', () => {
    const { g, p, h } = withHjalmar();
    const foe = g.state.actors.find((a) => a.defId === 'svartalf')!;
    combat.startCombat(g, [foe]);
    const c = g.state.combat!;
    c.order = [p.id, ...c.order.filter((id) => id !== p.id)];
    c.turn = 0;
    c.acted = {};
    c.movesLeft = 5;
    g.state.focus = p.id;
    expect(g.combatStep({ x: 11, y: 12 })).toBe(true);
    expect([p.x, p.y]).toEqual([11, 12]);
    expect([h.x, h.y]).toEqual([10, 12]);
    expect(c.movesLeft).toBe(4);
    expect(g.reachableTiles()).toContainEqual({ x: 10, y: 12 });
  });

  it('man byter inte plats med en fiende', () => {
    const { g, p } = withHjalmar();
    const foe = g.state.actors.find((a) => a.defId === 'svartalf')!;
    foe.x = 10;
    foe.y = 13;
    expect(g.stepPlayer({ x: 10, y: 13 })).toBe(false);
    expect([p.x, p.y]).toEqual([10, 12]);
  });
});
