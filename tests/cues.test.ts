import { describe, expect, it } from 'vitest';
import * as combat from '../src/engine/combat';
import { seededRng, type Rng } from '../src/engine/dice';
import { Game, type Cue } from '../src/engine/game';
import { equip, stow } from '../src/engine/inventory';
import { toggleLight } from '../src/engine/light';
import { castSpell } from '../src/engine/magic';
import type { Actor } from '../src/engine/types';
import { lit, testCharacter } from './helpers';

/** Slumpkälla som ger talen i tur och ordning och sedan 0,5. */
function queue(...values: number[]): Rng {
  return () => (values.length ? values.shift()! : 0.5);
}
const face = (n: number, sides = 20) => (n - 0.5) / sides;

/** Ett spel som samlar ljudsignalerna. */
function listen(seed = 4): { g: Game; cues: Cue[] } {
  const g = Game.create(testCharacter(), seededRng(seed));
  const cues: Cue[] = [];
  g.onCue((c) => cues.push(c));
  return { g, cues };
}

/** Rollpersonen och en svartalf bredvid varandra, och det är rollpersonens tur. */
function fight(g: Game): Actor {
  const p = g.player;
  const foe = g.state.actors.find((x) => x.defId === 'svartalf')!;
  p.x = 10;
  p.y = 12;
  foe.x = 11;
  foe.y = 12;
  lit(p);
  combat.startCombat(g, [foe]);
  const c = g.state.combat!;
  c.order = [p.id, ...c.order.filter((id) => id !== p.id)];
  c.turn = 0;
  c.acted = {};
  g.state.focus = p.id;
  return foe;
}

describe('ljudsignaler från motorn', () => {
  it('ett anfall som träffar ger anfall och skada', () => {
    const { g, cues } = listen();
    const foe = fight(g);
    // T20 1 är perfekt: träffar alltid och kan inte pareras.
    g.rng = queue(face(1));
    combat.playerAttack(g, foe);
    expect(cues).toContainEqual(
      expect.objectContaining({ type: 'anfall', actorId: g.player.id, targetId: foe.id, weapon: 'bredsvard', natural: false, result: 'träff' }),
    );
    expect(cues).toContainEqual({ type: 'skada', actorId: foe.id });
  });

  it('ett anfall som missar ger miss och ingen skada', () => {
    const { g, cues } = listen();
    const foe = fight(g);
    g.rng = queue(face(19));
    combat.playerAttack(g, foe);
    expect(cues).toContainEqual(expect.objectContaining({ type: 'anfall', result: 'miss' }));
    expect(cues.some((c) => c.type === 'skada')).toBe(false);
  });

  it('ett parerat anfall ger parerat', () => {
    const { g, cues } = listen();
    const foe = fight(g);
    // Anfallet lyckas (T20 8), pareringen också (T20 1).
    g.rng = queue(face(8), face(1), face(1));
    combat.playerAttack(g, foe);
    expect(cues).toContainEqual(expect.objectContaining({ type: 'anfall', result: 'parerat' }));
  });

  it('striden börjar och slutar', () => {
    const { g, cues } = listen();
    fight(g);
    expect(cues).toContainEqual({ type: 'strid', phase: 'börjar' });
    combat.endCombat(g, 'Slut.');
    expect(cues).toContainEqual({ type: 'strid', phase: 'slutar' });
  });

  it('död skickas när en varelse dör', () => {
    const { g, cues } = listen();
    const foe = g.state.actors.find((x) => x.defId === 'svartalf')!;
    combat.kill(g, foe);
    expect(cues).toContainEqual({ type: 'död', actorId: foe.id });
  });

  it('en besvärjelse som lyckas', () => {
    const { g, cues } = listen(5);
    const p = g.player;
    const witch = g.state.actors.find((a) => a.defId === 'haxkonstnar')!;
    p.x = 10;
    p.y = 12;
    witch.x = 14;
    witch.y = 12;
    combat.startCombat(g, [witch]);
    const c = g.state.combat!;
    c.order = [witch.id, p.id];
    c.turn = 0;
    c.acted = {};
    // BLIXT är kvick och verkar direkt: T20 2 lyckas.
    g.rng = queue(face(2));
    expect(castSpell(g, 'blixt', { grade: 1, target: p.id, caster: witch })).toBeNull();
    expect(cues).toContainEqual({ type: 'besvärjelse', actorId: witch.id, spell: 'blixt', result: 'lyckas' });
  });

  it('facklan släcks och tänds', () => {
    const { g, cues } = listen();
    const p = lit(g.player);
    expect(toggleLight(g, p)).toBeNull();
    expect(cues.at(-1)).toEqual({ type: 'ljus', actorId: p.id, lit: false });
    expect(toggleLight(g, p)).toBeNull();
    expect(cues.at(-1)).toEqual({ type: 'ljus', actorId: p.id, lit: true });
  });

  it('sömn och läger', () => {
    const { g, cues } = listen();
    g.sleep();
    expect(cues).toContainEqual({ type: 'vila', how: 'sömn' });
    g.sleep(8, 'läger');
    expect(cues).toContainEqual({ type: 'vila', how: 'läger' });
  });

  it('ett steg ger en signal, ett steg som inte blir av ingen', () => {
    const { g, cues } = listen();
    const p = g.leader;
    const free = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].find(([dx, dy]) => !g.blocked(p.x + dx, p.y + dy))!;
    expect(g.stepPlayer({ x: p.x + free[0], y: p.y + free[1] })).toBe(true);
    expect(cues).toEqual([{ type: 'steg', actorId: p.id }]);
    // Tre rutor bort är inget steg.
    expect(g.stepPlayer({ x: p.x + 3, y: p.y })).toBe(false);
    expect(cues).toHaveLength(1);
  });

  it('utrusta och lägga undan', () => {
    const { g, cues } = listen();
    stow(g, 'weapon');
    expect(cues.at(-1)).toEqual({ type: 'packning', item: 'bredsvard', how: 'undanlagt' });
    expect(equip(g, 'bredsvard', 'weapon')).toBeNull();
    expect(cues.at(-1)).toEqual({ type: 'packning', item: 'bredsvard', how: 'utrustat' });
  });

  it('ett fel hos en lyssnare stoppar inte motorn', () => {
    const { g } = listen();
    g.onCue(() => {
      throw new Error('trasigt ljud');
    });
    expect(() => g.sleep()).not.toThrow();
  });
});
