import { describe, expect, it } from 'vitest';
import { BANDS, MAPS } from '../src/content';
import * as combat from '../src/engine/combat';
import { seededRng, type Rng } from '../src/engine/dice';
import { Game, makeBand } from '../src/engine/game';
import { parseMap } from '../src/engine/map';
import { startModule } from '../src/engine/modules';
import { HOUR, TERRAIN_COST } from '../src/engine/rules';
import * as worldmap from '../src/engine/worldmap';
import type { BandState } from '../src/engine/types';
import { testCharacter } from './helpers';

/** Slumpkälla som alltid ger samma tal. */
const always = (v: number): Rng => () => v;

/** Provfärden, mitt på dagen, utan fiendegrupper och utan slumpmöten. */
function world(): Game {
  const g = Game.create(testCharacter(), seededRng(3), 'provfard');
  g.state.bands = [];
  g.state.travel = -1e9;
  g.state.time = Math.floor(g.state.time / (24 * HOUR)) * 24 * HOUR + 12 * HOUR;
  g.updateFov();
  return g;
}

function at(g: Game, x: number, y: number) {
  for (const m of g.partyMembers()) {
    m.x = x;
    m.y = y;
  }
  g.updateFov();
}

function band(g: Game, id: string, x: number, y: number): BandState {
  const b = makeBand(g.state, BANDS[id], x, y, g.rng);
  (g.state.bands ??= []).push(b);
  return b;
}

/** Hittar första rutan med ett visst tecken på världskartan. */
function find(ch: string): { x: number; y: number } {
  const rows = MAPS.provfard_karta.rows;
  const y = rows.findIndex((r) => r.includes(ch));
  return { x: rows[y].indexOf(ch), y };
}

describe('världskartan: tid och terräng', () => {
  it('Vidars tider: en kvart i öppen terräng, dubbelt i tät skog och kullar, fyra gånger i berg', () => {
    expect(TERRAIN_COST).toMatchObject({ slätt: 1, väg: 1, 'öppen skog': 1, 'tät skog': 2, kullar: 2, berg: 4, bro: 1, vadställe: 2 });
  });

  it('ett steg tar tid efter terrängen på rutan man går in på', () => {
    const g = world();
    const cases: [string, number][] = [
      [',', 15],
      ['f', 15],
      ['F', 30],
      ['h', 30],
      ['M', 60],
      ['=', 15],
      ['v', 30],
    ];
    for (const [ch, minutes] of cases) {
      const t = find(ch);
      // Stå på en gångbar ruta intill och gå in på rutan.
      const map = parseMap(MAPS.provfard_karta);
      const from = [
        { x: t.x - 1, y: t.y },
        { x: t.x + 1, y: t.y },
        { x: t.x, y: t.y - 1 },
        { x: t.x, y: t.y + 1 },
      ].find((p) => p.x >= 0 && p.y >= 0 && p.x < map.w && p.y < map.h && map.tiles[p.y * map.w + p.x] !== '~' && !map.places.some((q) => q.x === p.x && q.y === p.y))!;
      at(g, from.x, from.y);
      const before = g.state.time;
      expect(g.stepPlayer(t), ch).toBe(true);
      expect(g.state.time - before, ch).toBe(minutes * 60);
    }
  });

  it('gruppen går som en figur: alla står på samma ruta', () => {
    const g = world();
    const s = startModule(g.state, 'provfard', g.rng);
    const ids = new Set(s.party.map((id) => s.actors.find((a) => a.id === id)!).map((a) => `${a.x},${a.y}`));
    expect(ids.size).toBe(1);
  });

  it('vägvalet tar hänsyn till terrängen', () => {
    const g = world();
    const path = worldmap.travelPath(g, { x: 30, y: 13 })!;
    const minutes = path.reduce((sum, p) => sum + worldmap.stepMinutes(g, p.x, p.y), 0);
    // Längs vägen och över bron: en kvart per ruta.
    expect(minutes).toBe(path.length * 15);
  });

  it('synhållet är kortare på natten', () => {
    const g = world();
    expect(worldmap.partySight(g)).toBe(4);
    g.state.time += 12 * HOUR;
    expect(worldmap.partySight(g)).toBe(2);
  });
});

describe('världskartan: smyga förbi, jakt och spår', () => {
  it('gruppens lägsta Smyga slås mot fiendernas högsta Finna dolda ting när de får syn på gruppen', () => {
    const g = world();
    at(g, 10, 14);
    const b = band(g, 'provfard_rovare', 12, 14);
    g.rng = always(0.05);
    worldmap.look(g, b);
    expect(b.mode).toBe('undviker');
    expect(b.evaded).toBe(true);
    expect(g.state.log.at(-1)).toMatch(/Smyga .* mot Finna dolda ting 9/);
  });

  it('slaget görs bara en gång så länge fienderna ser gruppen', () => {
    const g = world();
    at(g, 10, 14);
    const b = band(g, 'provfard_rovare', 12, 14);
    g.rng = always(0.05);
    worldmap.look(g, b);
    const n = g.state.log.length;
    g.rng = always(0.95);
    worldmap.look(g, b);
    expect(g.state.log.length).toBe(n);
    expect(b.mode).toBe('undviker');
    // Ur sikte och tillbaka: ett nytt slag, som nu misslyckas.
    at(g, 2, 14);
    worldmap.look(g, b);
    expect(b.evaded).toBe(false);
    at(g, 10, 14);
    worldmap.look(g, b);
    expect(b.mode).toBe('jagar');
  });

  it('misslyckas gruppen jagar fienderna, och hinner de ifatt blir det ett stridsmöte på stridskartan för terrängen', () => {
    const g = world();
    at(g, 10, 14);
    const b = band(g, 'provfard_rovare', 13, 14);
    g.rng = always(0.95);
    worldmap.look(g, b);
    expect(b.mode).toBe('jagar');
    g.rng = seededRng(7);
    worldmap.bandsAct(g, 1);
    expect(g.state.mapId).toBe('strid_slatt');
    expect(g.state.mode).toBe('combat');
    expect(g.state.encounter).toMatchObject({ band: b.id, map: 'provfard_karta', x: 10, y: 14 });
    const foes = g.state.actors.filter((a) => a.hostile);
    expect(foes.length).toBe(b.members.length);
    // Fienderna syns när striden börjar.
    for (const f of foes) expect(g.isVisible(f.x, f.y)).toBe(true);
  });

  it('efter striden går gruppen ut genom kanten och kommer tillbaka; besegrade grupper är borta', () => {
    const g = world();
    at(g, 10, 14);
    const b = band(g, 'provfard_rovare', 11, 14);
    expect(g.attackBand(b.id)).toBe(true);
    for (const f of g.state.actors.filter((a) => a.hostile)) combat.kill(g, f);
    combat.endCombat(g, 'Striden är över.');
    g.changed();
    expect(g.state.log.join('\n')).toMatch(/kanten i väster/);
    worldmap.takeExit(g, { to: 'tillbaka', name: 'Tillbaka' });
    expect(g.state.mapId).toBe('provfard_karta');
    expect(g.map.kind).toBe('värld');
    expect(g.leader).toMatchObject({ x: 10, y: 14 });
    expect(g.state.bands!.some((x) => x.id === b.id)).toBe(false);
    expect(g.state.encounter).toBeUndefined();
  });

  it('en grupp som jagar följer spåret med Spåra, men inte efter den som är SPÅRLÖS', () => {
    const g = world();
    at(g, 2, 14);
    const b = band(g, 'provfard_vargar', 12, 9);
    b.mode = 'jagar';
    b.goal = { x: 8, y: 14 };
    g.rng = always(0.05);
    worldmap.look(g, b);
    expect(b.mode).toBe('jagar');
    expect(b.goal).toEqual({ x: 2, y: 14 });
    for (const m of g.partyMembers()) m.effects.push({ kind: 'spårlös', label: 'SPÅRLÖS', rounds: 100 });
    worldmap.look(g, b);
    expect(b.mode).toBe('vandrar');
  });
});

describe('världskartan: mötesplatser och slumpmöten', () => {
  it('man går in på en mötesplats genom att kliva på ikonen och kommer ut på samma ruta', () => {
    const g = world();
    const by = find('B');
    at(g, by.x - 1, by.y);
    expect(g.stepPlayer(by)).toBe(true);
    expect(g.state.mapId).toBe('provfard_hagby');
    expect(g.map.kind).toBe('plats');
    const exit = g.map.exits[0];
    at(g, exit.x + 1, exit.y);
    expect(g.stepPlayer({ x: exit.x, y: exit.y })).toBe(true);
    expect(g.state.mapId).toBe('provfard_karta');
    expect(g.leader).toMatchObject(by);
  });

  it('det man har gjort på en mötesplats ligger kvar', () => {
    const g = world();
    const grotta = find('G');
    at(g, grotta.x, grotta.y + 1);
    g.stepPlayer(grotta);
    expect(g.state.mapId).toBe('provfard_grottan');
    const wolves = g.state.actors.filter((a) => a.hostile).length;
    combat.kill(g, g.state.actors.find((a) => a.hostile)!);
    const exit = g.map.exits[0];
    at(g, exit.x, exit.y - 1);
    g.stepPlayer({ x: exit.x, y: exit.y });
    expect(g.state.mapId).toBe('provfard_karta');
    at(g, grotta.x, grotta.y + 1);
    g.stepPlayer(grotta);
    expect(g.state.actors.filter((a) => a.hostile && a.alive).length).toBe(wolves - 1);
  });

  it('ett slumpmöte är en grupp ur tabellen som närmar sig utanför synhållet', () => {
    const g = world();
    at(g, 10, 14);
    g.state.travel = 0;
    g.rng = always(0.01);
    worldmap.randomEncounters(g, 60);
    const b = g.state.bands!.at(-1)!;
    expect(b).toBeDefined();
    expect(b.mode).toBe('närmar');
    expect(b.defId).toBe('slump_stratrovare');
    expect(worldmap.withinSight(b.x - 10, b.y - 14, worldmap.partySight(g))).toBe(false);
  });

  it('inga slumpmöten när tärningen inte visar 1', () => {
    const g = world();
    g.state.travel = 0;
    g.rng = always(0.5);
    worldmap.randomEncounters(g, 180);
    expect(g.state.bands!.length).toBe(0);
  });

  it('en hel färd med seedad slump går utan fel', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const g = Game.create(testCharacter(), seededRng(seed), 'provfard');
      for (let i = 0; i < 60 && g.state.mode === 'explore' && g.map.kind === 'värld'; i++) {
        const p = g.leader;
        const path = g.pathTo(37, 14);
        if (!path?.length) break;
        g.stepPlayer(path[0]);
        expect(g.state.mapId === 'provfard_karta' || g.map.kind !== 'värld').toBe(true);
        if (p.x === g.leader.x && p.y === g.leader.y && g.state.mode === 'explore') break;
      }
    }
  });
});
