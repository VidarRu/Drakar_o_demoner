import { describe, expect, it } from 'vitest';
import { CREATURES, MAPS, NPCS, PROFESSIONS, WEAPONS } from '../src/content';
import { roll, seededRng } from '../src/engine/dice';
import { Game } from '../src/engine/game';
import { INTENTS } from '../src/engine/intents';
import { findPath, lineOfSight, parseMap } from '../src/engine/map';
import { damageBonus, maxKp, rollAttrs, skillCheck } from '../src/engine/rules';

const attrs = { STY: 13, STO: 12, FYS: 13, SMI: 12, INT: 10, PSY: 10, KAR: 10 };
const newGame = (seed = 1, profession = 'krigare') =>
  Game.create({ name: 'Test', profession, attrs }, seededRng(seed));

describe('tärningar', () => {
  it('håller sig inom gränserna', () => {
    const rng = seededRng(42);
    for (let i = 0; i < 500; i++) {
      const a = roll('3T6', rng);
      expect(a).toBeGreaterThanOrEqual(3);
      expect(a).toBeLessThanOrEqual(18);
      const b = roll('1T8+1T4-1', rng);
      expect(b).toBeGreaterThanOrEqual(1);
      expect(b).toBeLessThanOrEqual(11);
    }
    expect(roll('', rng)).toBe(0);
    expect(roll('5', rng)).toBe(5);
    expect(roll('-1T4', rng)).toBeLessThan(0);
    expect(() => roll('abc', rng)).toThrow();
  });
});

describe('regler', () => {
  it('färdighetsslag: 1 följt av lågt slag är perfekt, 20 följt av högt är fummel', () => {
    expect(skillCheck(10, () => 0).result).toBe('perfekt');
    expect(skillCheck(19, () => 0.999).result).toBe('fummel');
    expect(skillCheck(10, () => 0.45).success).toBe(true); // slår 10
    expect(skillCheck(10, () => 0.5).success).toBe(false); // slår 11
  });
  it('räknar KP och skadebonus', () => {
    expect(maxKp(attrs)).toBe(13);
    expect(damageBonus(attrs)).toBe(''); // STY + STO = 25 ger ingen skadebonus
    expect(damageBonus({ ...attrs, STY: 18, STO: 15 })).toBe('1T4');
    const rolled = rollAttrs(seededRng(3));
    expect(Object.keys(rolled)).toHaveLength(7);
  });
});

describe('innehåll', () => {
  it('hänger ihop', () => {
    for (const c of Object.values(CREATURES)) {
      expect(WEAPONS[c.weapon], c.id).toBeDefined();
      if (c.npc) expect(NPCS[c.npc], c.id).toBeDefined();
    }
    for (const p of Object.values(PROFESSIONS)) expect(WEAPONS[p.weapon]).toBeDefined();
    for (const n of Object.values(NPCS)) for (const i of n.intents) expect(INTENTS[i], i).toBeDefined();
  });
  it('alla varelser på kartan går att nå från starten', () => {
    for (const def of Object.values(MAPS)) {
      const map = parseMap(def);
      expect(map.spawns.length).toBeGreaterThan(0);
      for (const s of map.spawns) {
        expect(findPath(map, map.start, s, () => false, true), `${s.creature} (${s.x},${s.y})`).not.toBeNull();
      }
    }
  });
  it('väggar skymmer sikten', () => {
    const map = parseMap(MAPS.gravad);
    expect(lineOfSight(map, 5, 12, 12, 12)).toBe(true);
    expect(lineOfSight(map, 5, 12, 4, 4)).toBe(false);
  });
});

describe('spelmotor', () => {
  it('skapar ett spel med rollperson och varelser', () => {
    const g = newGame();
    expect(g.player.kp).toBe(13);
    expect(g.state.actors.length).toBeGreaterThan(5);
    expect(g.state.mode).toBe('explore');
  });

  it('en hel strid mot en varg går att spela klart', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const g = newGame(seed);
      const wolf = g.state.actors.find((a) => a.defId === 'varg')!;
      g.player.x = wolf.x - 3;
      g.player.y = wolf.y;
      expect(g.stepPlayer({ x: wolf.x - 2, y: wolf.y })).toBe(true);
      expect(g.state.mode).toBe('combat');
      for (let i = 0; i < 400 && g.state.mode === 'combat'; i++) {
        if (g.isPlayerTurn()) {
          if (g.canAttack(wolf.id)) g.playerAttack(wolf.id);
          else g.endTurn();
        } else {
          g.enemyTurn();
        }
      }
      expect(['explore', 'dead']).toContain(g.state.mode);
      expect(g.state.mode === 'dead' ? !g.player.alive : !wolf.alive).toBe(true);
    }
  });

  it('uppdraget går att anta och lösa in', () => {
    const g = newGame();
    const host = g.state.actors.find((a) => a.npc === 'vardshusvard')!;
    expect(INTENTS.uppdrag_beloning.available(g, host)).toBe(false);
    INTENTS.uppdrag_anta.apply(g, host);
    g.state.flags.hovding_dod = true;
    expect(INTENTS.uppdrag_beloning.available(g, host)).toBe(true);
    const before = g.player.silver;
    INTENTS.uppdrag_beloning.apply(g, host);
    expect(g.player.silver).toBe(before + 60);
    expect(INTENTS.uppdrag_beloning.available(g, host)).toBe(false);
  });

  it('vila läker och ger förbättringsslag', () => {
    const g = newGame();
    g.player.kp = 2;
    g.player.marks = ['Svärd'];
    g.rest();
    expect(g.player.kp).toBe(g.player.maxKp);
    expect(g.player.marks).toHaveLength(0);
  });

  it('tillståndet överlever sparning', () => {
    const g = newGame();
    const copy = new Game(JSON.parse(JSON.stringify(g.state)));
    expect(copy.player.name).toBe('Test');
    expect(copy.visible.size).toBe(g.visible.size);
  });
});
