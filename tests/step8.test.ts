import { describe, expect, it } from 'vitest';
import * as combat from '../src/engine/combat';
import { seededRng, type Rng } from '../src/engine/dice';
import { Game } from '../src/engine/game';
import { bandageOnce } from '../src/engine/maneuvers';
import type { Actor } from '../src/engine/types';
import { testCharacter } from './helpers';

/** Slumpkälla som alltid ger samma tal. */
const always = (v: number): Rng => () => v;

const recruitOf = (g: Game, id: string) => g.state.actors.find((a) => a.companion?.recruit === id)!;

function withParty(...ids: string[]): Game {
  const g = Game.create(testCharacter(), seededRng(5));
  g.leader.silver = 1000;
  for (const id of ids) expect(g.recruit(recruitOf(g, id).id)).not.toMatch(/inte|full/);
  return g;
}

function fight(g: Game): Actor {
  const foe = g.state.actors.find((x) => x.defId === 'svartalf')!;
  combat.startCombat(g, [foe]);
  return foe;
}

describe('döden (husregel, steg 8)', () => {
  it('den som når 0 KP blir döende, förlorar 1 KP per runda utan blödning och dör vid −FYS', () => {
    const g = withParty('hjalmar');
    const p = g.leader;
    fight(g);
    p.locKp['höger arm'] = 0;
    combat.wound(g, p, p.kp, 'höger arm');
    expect(p.alive).toBe(true);
    expect(p.unconscious).toBe(true);
    expect(p.dying).toBe(true);
    expect(p.kp).toBe(0);
    g.rng = always(0.99); // FYS-slagen misslyckas
    for (let i = 0; i < 5; i++) combat.tick(g, p);
    expect(p.kp).toBe(-5);
    for (let i = 0; i < 20 && p.alive; i++) combat.tick(g, p);
    expect(p.alive).toBe(false);
    expect(g.state.mode).toBe('dead');
  });

  it('den som är ensam och döende dör direkt', () => {
    const g = Game.create(testCharacter(), seededRng(5));
    const p = g.leader;
    fight(g);
    combat.wound(g, p, p.kp, null);
    expect(p.alive).toBe(false);
    expect(g.state.log.join('\n')).toContain('Ingen i gruppen står upp');
  });

  it('ett lyckat FYS-slag var tionde runda i strid stabiliserar: KP 1, ingen minusskada, vaken', () => {
    const g = withParty('hjalmar');
    const p = g.leader;
    fight(g);
    combat.wound(g, p, p.kp + 1, null);
    expect(p.dying).toBe(true);
    p.locKp.huvud = -1;
    p.locKp['vänster arm'] = -2;
    p.bleeding = ['huvud', 'vänster arm'];
    g.rng = always(0.99);
    for (let i = 0; i < 9; i++) combat.tick(g, p);
    expect(p.dying).toBe(true);
    g.rng = always(0.01);
    combat.tick(g, p);
    expect(p.dying).toBe(false);
    expect(p.kp).toBe(1);
    expect(p.locKp.huvud).toBe(1);
    expect(Object.values(p.locKp).every((v) => v >= 0)).toBe(true);
    expect(p.bleeding).toEqual([]);
    expect(p.unconscious).toBe(false);
    expect(combat.canUseSkills(p)).toBe(false);
    const half = combat.effectiveMove(p, g);
    p.kp = p.maxKp;
    expect(half).toBe(Math.floor(combat.effectiveMove(p, g) / 2));
  });

  it('en kamrat stabiliserar med Första hjälpen, och läkning stabiliserar också', () => {
    const g = withParty('hjalmar', 'linnea');
    const p = g.leader;
    const linnea = recruitOf(g, 'linnea');
    fight(g);
    combat.wound(g, p, p.kp + 3, null);
    expect(p.dying).toBe(true);
    g.rng = always(0.01);
    expect(bandageOnce(g, linnea, p)).toBe(true);
    expect(p.dying).toBe(false);
    expect(p.kp).toBe(1);

    const hjalmar = recruitOf(g, 'hjalmar');
    combat.wound(g, hjalmar, hjalmar.kp, null);
    expect(hjalmar.dying).toBe(true);
    g.heal(3, hjalmar);
    expect(hjalmar.dying).toBe(false);
    expect(hjalmar.kp).toBe(4);
  });

  it('efter striden räddar kamraterna den som är döende', () => {
    const g = withParty('linnea');
    const p = g.leader;
    const foe = fight(g);
    combat.wound(g, p, p.kp + 2, null);
    expect(p.dying).toBe(true);
    foe.alive = false;
    g.rng = always(0.01);
    combat.endCombat(g, 'Slut.');
    expect(p.alive).toBe(true);
    expect(p.dying).toBe(false);
    expect(p.kp).toBeGreaterThanOrEqual(1);
  });

  it('fiender på 0 KP är ur striden men inte döende', () => {
    const g = withParty('hjalmar');
    const foe = fight(g);
    combat.wound(g, foe, foe.kp, null);
    expect(foe.dying).toBeFalsy();
    expect(foe.unconscious).toBe(true);
    const kp = foe.kp;
    combat.tick(g, foe);
    expect(foe.kp).toBe(kp);
  });
});
