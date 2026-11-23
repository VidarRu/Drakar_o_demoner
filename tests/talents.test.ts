import { describe, expect, it } from 'vitest';
import * as combat from '../src/engine/combat';
import { maxRoll, seededRng, type Rng } from '../src/engine/dice';
import { Game } from '../src/engine/game';
import { provokeAnimal, spares } from '../src/engine/hero';
import { attackModes, maneuver } from '../src/engine/maneuvers';
import { DAY, HOUR } from '../src/engine/rules';
import { bodyControlProblem, layOnHands, luckProblem, meditate, thiefLuckLeft } from '../src/engine/talents';
import { advanceTime } from '../src/engine/time';
import type { Actor, Character } from '../src/engine/types';
import { testCharacter } from './helpers';

/** Slumpkälla som ger talen i tur och ordning och sedan 0,5. */
function queue(...values: number[]): Rng {
  return () => (values.length ? values.shift()! : 0.5);
}
const face = (n: number, sides = 20) => (n - 0.5) / sides;

/** Ett spel där rollpersonen har förmågan och/eller yrket. */
function hero(opts: { ability?: string; profession?: string; edit?: (ch: Character) => void } = {}): Game {
  const ch = testCharacter();
  if (opts.ability) ch.ability = { id: opts.ability, total: 0 };
  if (opts.profession) ch.profession = opts.profession;
  opts.edit?.(ch);
  return Game.create(ch, seededRng(4));
}

function foeNextTo(g: Game, def = 'svartalf'): Actor {
  const a = g.player;
  const foe = g.state.actors.find((x) => x.defId === def)!;
  a.x = 10;
  a.y = 12;
  foe.x = 11;
  foe.y = 12;
  return foe;
}

/** Gör turen till `a`:s i en strid mot `foe`. */
function turnOf(g: Game, a: Actor, foe: Actor) {
  if (!g.state.combat) combat.startCombat(g, [foe]);
  const c = g.state.combat!;
  c.order = [a.id, ...c.order.filter((id) => id !== a.id)];
  c.turn = 0;
  c.acted = {};
  g.state.focus = a.id;
}

const lastLogs = (g: Game, n = 6) => g.state.log.slice(-n).join('\n');

describe('passiva förmågor i striden', () => {
  it('God bågskytt ger 25 % längre räckvidd med projektilvapen', () => {
    const plain = hero({ edit: (ch) => (ch.equipped.weapon = 'kortbage') });
    const archer = hero({ ability: 'god_bagskytt', edit: (ch) => (ch.equipped.weapon = 'kortbage') });
    const a = combat.rangedInfo(plain.player, plain)!.range;
    const b = combat.rangedInfo(archer.player, archer)!.range;
    // 1,5 meter per ruta: 135 m blir 90 rutor och 168,75 m blir 112.
    expect(a).toBe(90);
    expect(b).toBe(112);
  });

  it('Järnnäve gör alltid högsta skada obeväpnad', () => {
    const g = hero({ ability: 'jarnnave', edit: (ch) => (ch.equipped.weapon = undefined) });
    const p = g.player;
    p.weapon = 'nave';
    const foe = foeNextTo(g);
    const w = combat.weaponInfo(p);
    expect(w.unarmed).toBe(true);
    const before = foe.kp;
    combat.hit(g, p, foe, w, { aim: 'bröstkorg' });
    expect(before - foe.kp).toBe(maxRoll(combat.damageExpr(p, w)));
  });

  it('Snabb uppfattning ger +5 på pareringen i närstrid', () => {
    const g = hero({ ability: 'snabb_uppfattning' });
    const foe = foeNextTo(g);
    turnOf(g, foe, g.player);
    g.rng = queue(face(2), face(15));
    combat.attackOnce(g, foe, g.player, 'weapon');
    expect(lastLogs(g)).toContain('+5 snabb uppfattning');
  });

  it('Djurvän: djuret går inte på personen förrän hen anfaller det', () => {
    const g = hero({ ability: 'djurvan' });
    const wolf = g.state.actors.find((x) => x.defId === 'varg')!;
    const alf = g.state.actors.find((x) => x.defId === 'svartalf')!;
    expect(spares(g, wolf, g.player)).toBe(true);
    expect(spares(g, alf, g.player)).toBe(false);
    provokeAnimal(g, g.player, wolf);
    expect(spares(g, wolf, g.player)).toBe(false);
    expect(spares(g, wolf, hero().player)).toBe(false);
  });
});

describe('läkning och PSY', () => {
  it('Gott läkekött läker dubbelt så fort', () => {
    const heal = (g: Game) => {
      const p = g.player;
      p.locKp.bröstkorg -= 4;
      p.kp -= 4;
      advanceTime(g, DAY, 'vila');
      return p.locMax.bröstkorg - p.locKp.bröstkorg;
    };
    expect(heal(hero())).toBe(3);
    expect(heal(hero({ ability: 'gott_lakekott' }))).toBe(2);
  });

  it('God mental kontroll ger tillbaka PSY dubbelt så fort', () => {
    const regain = (g: Game) => {
      g.player.psy = 1;
      advanceTime(g, 4 * HOUR, 'vila');
      return g.player.psy - 1;
    };
    const normal = regain(hero());
    expect(normal).toBeGreaterThan(0);
    expect(regain(hero({ ability: 'god_mental_kontroll', profession: 'magiker' }))).toBe(Math.min(9, normal * 2));
  });
});

describe('Turgubbe och Tjuvtur', () => {
  it('Turgubbe köper upp till +3 för lika många PSY och kan vända ett misslyckat slag', () => {
    const g = hero({ ability: 'turgubbe' });
    const p = g.player;
    const psy = p.psy;
    for (let i = 0; i < 3; i++) g.cycleLuck('turgubbe');
    expect(p.luckArmed).toEqual({ source: 'turgubbe', n: 3 });
    g.cycleLuck('turgubbe');
    expect(p.luckArmed).toBeUndefined();
    for (let i = 0; i < 3; i++) g.cycleLuck('turgubbe');
    const fv = g.skillFv(p, 'overtala');
    g.rng = queue(face(fv + 2));
    const check = g.playerCheck('overtala');
    expect(check.success).toBe(true);
    expect(p.psy).toBe(psy - 3);
    expect(p.luckArmed).toBeUndefined();
  });

  it('Tjuvtur går två gånger mellan varje sömn', () => {
    const g = hero({ profession: 'tjuv' });
    const p = g.player;
    for (let i = 0; i < 2; i++) {
      g.cycleLuck('tjuvtur');
      g.rng = queue(face(10));
      g.playerCheck('overtala');
    }
    expect(thiefLuckLeft(g, p)).toBe(0);
    expect(luckProblem(g, p, 'tjuvtur', 1)).toMatch(/sömn/);
    g.sleep(8);
    expect(thiefLuckLeft(g, p)).toBe(2);
  });
});

describe('stridsförmågor', () => {
  it('Gudarnas gunstling återställer KP en gång per äventyr', () => {
    const g = hero({ ability: 'gudarnas_gunstling' });
    const p = g.player;
    g.rng = queue(face(10, 100));
    combat.wound(g, p, p.kp, null);
    expect(p.kp).toBe(p.maxKp);
    expect(p.dying).toBeFalsy();
    expect(g.char.favorUsed).toBe(true);
    g.rng = queue(face(1, 100));
    combat.wound(g, p, p.kp, null);
    expect(p.kp).toBe(0);
  });

  it('Riddarslag utan sikte gör högsta skada för 5 PSY', () => {
    const g = hero({ profession: 'riddare' });
    const p = g.player;
    const foe = foeNextTo(g);
    turnOf(g, p, foe);
    expect(attackModes(g, p).map((m) => m.id)).toContain('riddarslag');
    const psy = p.psy;
    const kp = foe.kp;
    // Anfallet 5 lyckas, svartalfens parering 19 misslyckas, träffområdet 10 (bröstkorgen).
    g.rng = queue(face(5), face(19), face(10));
    maneuver(g, p, foe, 'riddarslag');
    expect(p.psy).toBe(psy - 5);
    const w = combat.weaponInfo(p);
    expect(kp - foe.kp).toBe(maxRoll(combat.damageExpr(p, w)));
  });

  it('Anfall bakifrån: lönnmördarens misslyckade anfall från smygarläge träffar ändå', () => {
    const g = hero({ profession: 'lonnmordare', edit: (ch) => (ch.skills.smyga = 15) });
    const p = g.player;
    p.skills.smyga = 15;
    const foe = foeNextTo(g);
    turnOf(g, p, foe);
    p.hidden = true;
    const kp = foe.kp;
    // Smyga 2 lyckas, Upptäcka fara 20 misslyckas, anfallet 19 misslyckas, skadan.
    g.rng = queue(face(2), face(5), face(20), face(1), face(19), 0.99, face(10));
    combat.attackOnce(g, p, foe, 'weapon');
    expect(lastLogs(g)).toContain('Anfall bakifrån');
    expect(foe.kp).toBeLessThan(kp);
  });
});

describe('handlingar', () => {
  it('Handpåläggning läker för PSY och kan bota en infektion', () => {
    const g = hero({ profession: 'helare' });
    const p = g.player;
    p.locKp.bröstkorg -= 3;
    p.kp -= 3;
    const psy = p.psy;
    expect(layOnHands(g, p, p, 'handpåläggning')).toBeNull();
    expect(p.kp).toBe(p.maxKp);
    expect(p.psy).toBe(psy - 3);
    p.psy = 15;
    p.infections.push({ loc: 'vänster arm', until: g.state.time + 7 * DAY, gangrene: false });
    g.rng = queue(face(1));
    expect(layOnHands(g, p, p, 'sjukbot')).toBeNull();
    expect(p.infections).toHaveLength(0);
  });

  it('Meditation ger upp till dubbla FV på nästa slag i färdigheten', () => {
    const g = hero({ profession: 'munk' });
    const p = g.player;
    const fv = g.skillFv(p, 'overtala');
    expect(meditate(g, p, 'overtala')).toBeNull();
    expect(combat.skillMod(g, p, 'overtala')).toBe(fv);
    g.rng = queue(face(10));
    g.playerCheck('overtala');
    expect(combat.skillMod(g, p, 'overtala')).toBe(0);
  });

  it('God kroppskontroll ger +5 STY två gånger om dagen', () => {
    const g = hero({ ability: 'god_kroppskontroll' });
    const p = g.player;
    const sty = p.attrs.STY;
    g.rng = queue(face(1));
    g.bodyControl();
    expect(combat.strength(p)).toBe(sty + 5);
    p.effects = p.effects.filter((e) => e.kind !== 'styrka');
    g.rng = queue(face(20));
    g.bodyControl();
    expect(combat.strength(p)).toBe(sty);
    expect(bodyControlProblem(g, p)).toMatch(/Två gånger/);
  });
});
