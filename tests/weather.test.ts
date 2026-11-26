import { describe, expect, it } from 'vitest';
import { seededRng, type Rng } from '../src/engine/dice';
import { Game } from '../src/engine/game';
import { castProblem, castSpell } from '../src/engine/magic';
import { HOUR } from '../src/engine/rules';
import type { Character } from '../src/engine/types';
import { stepMeter, torchBurns, underSky, updateWeather, weatherOf, weatherRanged } from '../src/engine/weather';
import { lit, testCharacter } from './helpers';
import { advanceTime } from '../src/engine/time';

function queue(...values: number[]): Rng {
  return () => (values.length ? values.shift()! : 0.5);
}
const face = (n: number, sides = 20) => (n - 0.5) / sides;

function weatherMage(): Character {
  const c = testCharacter();
  c.profession = 'magiker';
  c.attrs.INT = 15;
  c.attrs.PSY = 18;
  c.skills['magiskola:animism'] = 18;
  c.skills['magiskola:elementarmagi'] = 14;
  c.spells = ['vindkontroll', 'regnkontroll', 'nedkalla_askvigg', 'viggfangare', 'finna_vatten'];
  c.memorized = [...c.spells];
  c.inventory = ['trastav'];
  c.equipped = { weapon: 'trastav', armor: [] };
  return c;
}

function outside() {
  const g = Game.create(weatherMage(), seededRng(4));
  const p = g.player;
  p.x = 10;
  p.y = 12;
  g.updateFov();
  return { g, p };
}

describe('vädret', () => {
  it('mätarna går ett steg i taget, och ytterlägena är ovanligare', () => {
    // Mittsteget: ned på 1–2, kvar på 3–4, upp på 5–6.
    expect([1, 2, 3, 4, 5, 6].map((d) => stepMeter(2, d))).toEqual([1, 1, 2, 2, 3, 3]);
    // Ett steg från ytterläget: mot mitten på 1–2, kvar på 3–5, mot ytterläget på 6.
    expect([1, 2, 3, 4, 5, 6].map((d) => stepMeter(3, d))).toEqual([2, 2, 3, 3, 3, 4]);
    expect([1, 2, 3, 4, 5, 6].map((d) => stepMeter(1, d))).toEqual([2, 2, 1, 1, 1, 0]);
    // I ytterläget: tillbaka på 1–3, kvar på 4–6.
    expect([1, 2, 3, 4, 5, 6].map((d) => stepMeter(4, d))).toEqual([3, 3, 3, 4, 4, 4]);
    expect([1, 2, 3, 4, 5, 6].map((d) => stepMeter(0, d))).toEqual([1, 1, 1, 0, 0, 0]);
  });

  it('vädret ändras klockan sex och arton, men inte när modulen har låst det', () => {
    const { g } = outside();
    const w = weatherOf(g);
    expect(w).toMatchObject({ sky: 1, wind: 1 });
    // Klockan 08 till 17: ingen ändring.
    g.rng = queue(face(6, 6), face(6, 6));
    const before = g.state.time;
    g.state.time += 9 * HOUR;
    updateWeather(g, before);
    expect(w).toMatchObject({ sky: 1, wind: 1 });
    // Förbi klockan 18: halvklart blir klart på en sexa, och svag vind blir frisk på en etta.
    g.rng = queue(face(6, 6), face(1, 6));
    const t = g.state.time;
    g.state.time += 2 * HOUR;
    updateWeather(g, t);
    expect(w).toMatchObject({ sky: 0, wind: 2 });
    w.locked = true;
    g.rng = queue(face(1, 6), face(1, 6));
    const t2 = g.state.time;
    g.state.time += 24 * HOUR;
    updateWeather(g, t2);
    expect(w).toMatchObject({ sky: 0, wind: 2 });
  });

  it('regnet släcker facklor utomhus och ger −2 på skott; hård vind ger −2 till', () => {
    const { g, p } = outside();
    lit(p);
    const alf = g.state.actors.find((a) => a.defId === 'svartalf')!;
    alf.x = 14;
    alf.y = 12;
    expect(torchBurns(g, p)).toBe(true);
    Object.assign(weatherOf(g), { sky: 3, wind: 3 });
    expect(torchBurns(g, p)).toBe(false);
    expect(weatherRanged(g, p, alf)).toEqual([
      ['regn', -2],
      ['hård vind', -2],
    ]);
    // I grottan märks inget väder.
    const chief = g.state.actors.find((a) => a.defId === 'svartalfshovding')!;
    p.x = chief.x - 1;
    p.y = chief.y;
    expect(underSky(g, p)).toBe(false);
    expect(torchBurns(g, p)).toBe(true);
  });
});

describe('väderbesvärjelserna', () => {
  it('VINDKONTROLL ökar vinden ett steg per fyra E, och vinden går tillbaka när den tar slut', () => {
    const { g } = outside();
    expect(castProblem(g, 'vindkontroll', { grade: 4 })).toMatch(/mer eller mindre/);
    g.rng = queue(face(2));
    expect(castSpell(g, 'vindkontroll', { grade: 8, change: 1 })).toBeNull();
    expect(weatherOf(g).wind).toBe(3);
    g.sleep(24);
    expect(weatherOf(g).held).toBeUndefined();
  });

  it('REGNKONTROLL kräver moln, och NEDKALLA ÅSKVIGG kräver regn', () => {
    const { g } = outside();
    const alf = g.state.actors.find((a) => a.defId === 'svartalf')!;
    alf.x = 14;
    alf.y = 12;
    alf.hostile = true;
    g.updateFov();
    expect(castProblem(g, 'regnkontroll', { grade: 1, change: 1 })).toMatch(/inga moln/);
    expect(castProblem(g, 'nedkalla_askvigg', { grade: 2, target: alf.id })).toMatch(/regna/);
    weatherOf(g).sky = 2;
    g.rng = queue(face(2));
    expect(castSpell(g, 'regnkontroll', { grade: 1, change: 1 })).toBeNull();
    expect(weatherOf(g).sky).toBe(3);
    expect(castProblem(g, 'finna_vatten', { grade: 1 })).toMatch(/regnar/);
    const kp = alf.kp;
    // ÅSKVIGG E2 lyckas, 2T6 blir 3 + 4.
    g.rng = queue(face(2), face(3, 6), face(4, 6));
    expect(castSpell(g, 'nedkalla_askvigg', { grade: 2, target: alf.id })).toBeNull();
    expect(alf.kp).toBe(kp - 7);
  });

  it('VIGGFÅNGARE under åska: hela blixten blir PSY, upp till grundvärdet', () => {
    const { g, p } = outside();
    expect(castProblem(g, 'viggfangare', { grade: 1 })).toMatch(/åska/);
    weatherOf(g).sky = 4;
    p.psy = 4;
    const kp = p.kp;
    // Slaget lyckas (2) och kostar 1 PSY; 5T6 blir 2 × 5 = 10.
    g.rng = queue(face(2), ...Array(5).fill(face(2, 6)));
    expect(castSpell(g, 'viggfangare', { grade: 1 })).toBeNull();
    expect(p.psy).toBe(3 + 10);
    expect(p.kp).toBe(kp);
    g.rng = queue(face(2), ...Array(5).fill(face(6, 6)));
    castSpell(g, 'viggfangare', { grade: 1 });
    expect(p.psy).toBe(18);
  });
});

describe('facklor och lyktor', () => {
  it('en fackla brinner en timme, och sedan tänds nästa tills de är slut', () => {
    const ch = testCharacter();
    ch.inventory.push('fackla', 'fackla', 'fackla');
    const g = Game.create(ch, seededRng(2));
    const p = g.player;
    const n = g.char.inventory.filter((x) => x === 'fackla').length;
    expect(p.light).toMatchObject({ kind: 'fackla', left: 3600 });
    g.sleep(8);
    expect(p.light!.left).toBe(3600);
    advance(g, 3600);
    expect(g.char.inventory.filter((x) => x === 'fackla').length).toBe(n - 1);
    expect(p.light!.left).toBe(3600);
    g.char.inventory = g.char.inventory.filter((x) => x !== 'fackla');
    advance(g, 3600);
    expect(p.torchOut).toBe(true);
    expect(torchBurns(g, p)).toBe(false);
    expect(g.state.log.join('\n')).toMatch(/har inget mer att tända/);
  });

  it('en oljelykta brinner sex timmar, fylls på med lampolja och slocknar inte i regn', () => {
    const c = testCharacter();
    c.inventory = c.inventory.filter((x) => x !== 'fackla');
    c.inventory.push('oljelykta', 'lampolja');
    const g = Game.create(c, seededRng(2));
    const p = g.player;
    expect(p.light).toMatchObject({ kind: 'oljelykta', left: 6 * 3600 });
    weatherOf(g).sky = 3;
    expect(torchBurns(g, p)).toBe(true);
    advance(g, 6 * 3600);
    expect(p.light).toMatchObject({ kind: 'oljelykta', left: 3600 });
    expect(g.char.inventory).not.toContain('lampolja');
  });
});

/** Låter tiden gå i aktivitet, utan att vädret eller annat stör (en timme i taget). */
function advance(g: Game, seconds: number) {
  for (let t = 0; t < seconds; t += 3600) advanceTime(g, Math.min(3600, seconds - t), 'aktiv');
}
