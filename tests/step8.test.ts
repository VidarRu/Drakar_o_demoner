import { describe, expect, it } from 'vitest';
import * as combat from '../src/engine/combat';
import { seededRng, type Rng } from '../src/engine/dice';
import { CREATURES, MAP_MODULE, MAPS, MODULE_LIST, MODULES, RECRUITS } from '../src/content';
import { Game, spawnActors } from '../src/engine/game';
import { INTENTS } from '../src/engine/intents';
import { parseMap } from '../src/engine/map';
import { leaveModule, pendingEpilogue, questLog, startModule, stayAfterEpilogue } from '../src/engine/modules';
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

describe('äventyrsmoduler (steg 8)', () => {
  it('Gråvad är speltestmodulen, och registren är hopslagna ur modulerna', () => {
    expect(MODULES.speltest.name).toBe('Gråvad');
    expect(MODULES.speltest.campaign).toBe(false);
    expect(MODULES.speltest.difficulty).toBe('lätt');
    for (const m of MODULE_LIST) {
      for (const map of m.maps) expect(MAP_MODULE[map.id]).toBe(m.id);
      for (const c of m.creatures) expect(CREATURES[c.id]).toBe(c);
      for (const r of m.recruits) expect(RECRUITS[r.id]).toBe(r);
      expect(m.quests.filter((q) => q.main)).toHaveLength(1);
    }
    expect(INTENTS.uppdrag_anta).toBeTruthy();
    expect(INTENTS.handla).toBeTruthy();
    const map = parseMap(MAPS.gravad);
    expect(map.exits).toEqual([{ x: 0, y: 12, name: 'Vägen västerut' }]);
  });

  it('uppdragsloggen följer flaggorna, och epilogen visas när huvuduppdraget är klart', () => {
    const g = Game.create(testCharacter(), seededRng(1));
    expect(questLog(g)).toEqual([]);
    g.state.flags.uppdrag_antaget = true;
    expect(questLog(g)[0]).toMatchObject({ status: 'aktivt', steps: [] });
    g.state.flags.hovding_dod = true;
    expect(questLog(g)[0].steps).toEqual(['Grukk är död. Hämta belöningen hos Bertil.']);
    expect(pendingEpilogue(g)).toBeNull();
    g.state.flags.uppdrag_klart = true;
    expect(questLog(g)[0].status).toBe('klart');
    expect(pendingEpilogue(g)?.length).toBeGreaterThan(0);
    stayAfterEpilogue(g);
    expect(pendingEpilogue(g)).toBeNull();
  });

  it('vid utgången frågar spelet, och gruppen kan lämna modulen även utan att ha klarat uppdraget', () => {
    const g = Game.create(testCharacter(), seededRng(1));
    const asked: string[] = [];
    g.onUi((name) => asked.push(name));
    const p = g.leader;
    p.x = 1;
    p.y = 12;
    g.updateFov();
    expect(g.stepPlayer({ x: 0, y: 12 })).toBe(true);
    expect(asked).toContain('exit');
    expect(g.exitHere()?.name).toBe('Vägen västerut');
    leaveModule(g);
    expect(g.state.mode).toBe('ended');
    expect(g.state.completed).toEqual([]);
    // Den som kommer tillbaka och klarar uppdraget får se epilogen.
    const g2 = new Game(startModule(g.state, 'speltest', seededRng(2)), seededRng(2));
    g2.state.flags.uppdrag_antaget = true;
    g2.state.flags.uppdrag_klart = true;
    expect(pendingEpilogue(g2)).not.toBeNull();
  });

  it('nästa modul börjar med samma grupp, tid och skador, och det man gjort ligger kvar', () => {
    const g = withParty('hjalmar');
    const hjalmar = recruitOf(g, 'hjalmar');
    const wolf = g.state.actors.find((a) => a.defId === 'varg')!;
    combat.kill(g, wolf);
    const chief = g.state.actors.find((a) => a.defId === 'svartalfshovding')!;
    combat.kill(g, chief);
    g.state.flags.uppdrag_antaget = true;
    g.state.flags.uppdrag_klart = true;
    g.leader.locKp['vänster arm'] -= 2;
    g.leader.kp -= 2;
    const silver = g.leader.silver;
    const when = g.state.time;
    const count = g.state.actors.length;
    leaveModule(g);
    expect(g.state.completed).toEqual(['speltest']);

    const s = startModule(g.state, 'speltest', seededRng(2));
    expect(s.mode).toBe('explore');
    expect(s.time).toBe(when);
    expect(s.party).toEqual(g.state.party);
    expect(s.flags.uppdrag_klart).toBe(true);
    const g2 = new Game(s, seededRng(2));
    expect(g2.leader.silver).toBe(silver);
    expect(g2.leader.kp).toBe(g.leader.kp);
    expect(g2.leader.locKp['vänster arm']).toBe(g.leader.locKp['vänster arm']);
    expect(g2.state.actors).toHaveLength(count);
    expect(g2.state.actors.filter((a) => a.companion?.recruit === 'hjalmar')).toHaveLength(1);
    expect(g2.state.actors.find((a) => a.defId === 'varg' && a.id === wolf.id)?.alive).toBe(false);
    expect(g2.state.actors.find((a) => a.id === hjalmar.id)?.kind).toBe('player');
    const start = parseMap(MAPS.gravad).start;
    expect(g2.leader).toMatchObject(start);
    expect(g2.partyMembers().every((m) => !g2.map.exits.some((e) => e.x === m.x && e.y === m.y))).toBe(true);
  });

  it('en ny karta placerar inte ut varelser som redan är döda eller personer som redan följer med', () => {
    const g = withParty('hjalmar');
    g.state.flags.hovding_dod = true;
    g.state.actors = g.state.actors.filter((a) => g.state.party.includes(a.id));
    spawnActors(g.state, parseMap(MAPS.gravad), seededRng(3));
    expect(g.state.actors.some((a) => a.defId === 'svartalfshovding')).toBe(false);
    expect(g.state.actors.filter((a) => a.companion?.recruit === 'hjalmar')).toHaveLength(1);
    expect(g.state.actors.some((a) => a.companion?.recruit === 'sigrid')).toBe(true);
  });

  it('en följeslagare som lämnar gruppen på en annan karta går hem till sin egen', () => {
    const g = withParty('hjalmar');
    const hjalmar = recruitOf(g, 'hjalmar');
    hjalmar.companion!.homeMap = 'annan';
    g.state.places.annan = { actors: [], explored: [], dropped: [] };
    g.dismiss(hjalmar.id);
    expect(g.state.actors.includes(hjalmar)).toBe(false);
    expect(g.state.places.annan.actors).toContain(hjalmar);
    expect(hjalmar).toMatchObject(hjalmar.companion!.home);
  });

  it('sparformatet är version 7', () => {
    const g = Game.create(testCharacter(), seededRng(1));
    expect(g.state.version).toBe(7);
    expect(g.state.moduleId).toBe('speltest');
  });
});
