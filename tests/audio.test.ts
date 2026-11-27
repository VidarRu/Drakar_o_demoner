import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MUSIC, musicFor } from '../src/audio/music';
import { SFX, SFX_FILES, soundFor } from '../src/audio/sounds';
import * as combat from '../src/engine/combat';
import { seededRng } from '../src/engine/dice';
import { Game, type Cue } from '../src/engine/game';
import { testCharacter } from './helpers';

const gravad = () => Game.create(testCharacter(), seededRng(1));

describe('musikvalet', () => {
  it('titelmusik utan spel', () => {
    expect(musicFor(null)).toBe('titel');
  });

  it('Gråvad är en by, grottgolvet grotta och värdshuset tryggt', () => {
    const g = gravad();
    expect(musicFor(g)).toBe('by');
    const p = g.leader;
    // Grottan i öster och värdshuset i nordväst (se kartan i src/content/speltest).
    p.x = 31;
    p.y = 4;
    expect(musicFor(g)).toBe('grotta');
    p.x = 4;
    p.y = 4;
    expect(musicFor(g)).toBe('trygg');
  });

  it('strid, och boss mot Grukk', () => {
    const g = gravad();
    combat.startCombat(g, [g.state.actors.find((a) => a.defId === 'svartalf')!]);
    expect(musicFor(g)).toBe('strid');
    const h = gravad();
    combat.startCombat(h, [h.state.actors.find((a) => a.defId === 'svartalfshovding')!]);
    expect(musicFor(h)).toBe('boss');
  });

  it('världskartan i Provfärden', () => {
    const g = Game.create(testCharacter(), seededRng(1), 'provfard');
    expect(g.map.kind).toBe('värld');
    expect(musicFor(g)).toBe('värld');
  });

  it('död och mellan äventyren', () => {
    const g = gravad();
    g.state.mode = 'dead';
    expect(musicFor(g)).toBe('oro');
    g.state.mode = 'ended';
    expect(musicFor(g)).toBe('trygg');
  });

  it('varje musikfil finns', () => {
    for (const f of Object.values(MUSIC)) expect(existsSync(`public/audio/flare/music/${f}.mp3`), f).toBe(true);
  });
});

describe('ljudtabellen', () => {
  const mid = () => 0.5;
  const files = (g: Game, c: Cue) => soundFor(g, c, mid).map((p) => p.file);
  const foe = (g: Game, id = 'svartalf') => g.state.actors.find((a) => a.defId === id)!;

  it('varje ljudfil finns', () => {
    expect(SFX_FILES.length).toBeGreaterThan(30);
    for (const f of SFX_FILES) expect(existsSync(`public/audio/${f}.mp3`), f).toBe(true);
  });

  it('ett anfall med stridshammare låter lägre än med dolk', () => {
    const g = gravad();
    const hit = (weapon: string) => soundFor(g, { type: 'anfall', actorId: g.player.id, targetId: foe(g).id, weapon, natural: false, result: 'träff' }, mid)[0];
    expect(SFX.hugg).toContain(hit('stridshammare').file);
    expect(hit('stridshammare').rate).toBeLessThan(hit('bredsvard').rate);
    expect(hit('dolk').rate).toBeGreaterThan(hit('bredsvard').rate);
  });

  it('ett parerat anfall ger hugg och block', () => {
    const g = gravad();
    const f = files(g, { type: 'anfall', actorId: g.player.id, targetId: foe(g).id, weapon: 'bredsvard', natural: false, result: 'parerat' });
    expect(f).toHaveLength(2);
    expect(SFX.hugg).toContain(f[0]);
    expect(f[1]).toBe('flare/sfx/powers/block');
  });

  it('ELD ger eld, FROST köld, HELA läkning och en mentalistisk besvärjelse sinne', () => {
    const g = gravad();
    const spell = (id: string) => files(g, { type: 'besvärjelse', actorId: g.player.id, spell: id, result: 'lyckas' });
    expect(SFX.eld).toEqual(expect.arrayContaining(spell('eld')));
    expect(spell('frost')).toEqual(['flare/sfx/powers/freeze']);
    expect(spell('hela')).toEqual(['flare/sfx/powers/heal']);
    expect(spell('telepati')).toEqual(['flare/sfx/powers/timestop']);
    expect(files(g, { type: 'besvärjelse', actorId: g.player.id, spell: 'eld', result: 'misslyckas' })).toEqual(['flare/sfx/no_mana']);
  });

  it('stegen följer marken, inte rustningen', () => {
    const g = gravad();
    const p = g.leader;
    const on = (tile: string) => {
      const i = g.map.tiles.indexOf(tile);
      expect(i, tile).toBeGreaterThanOrEqual(0);
      p.x = i % g.map.w;
      p.y = Math.floor(i / g.map.w);
      return soundFor(g, { type: 'steg', actorId: p.id }, mid);
    };
    expect(SFX.steg_gras).toContain(on('.')[0].file);
    expect(on('.')[0].volume).toBe(0.35);
    expect(SFX.steg_grus).toContain(on(',')[0].file);
    expect(SFX.steg_tra).toContain(on('_')[0].file);
    expect(SFX.steg_grotta).toContain(on(':')[0].file);
    const door = on('+');
    expect(SFX.steg_tra).toContain(door[0].file);
    expect(door[1].file).toBe('flare/sfx/door_open');
    // Rustningen ändrar inget.
    p.armor = ['ringbrynjeskjorta'];
    expect(SFX.steg_gras).toContain(on('.')[0].file);
  });

  it('världskartans terräng: skog, tät skog, berg och vadställe', () => {
    const g = Game.create(testCharacter(), seededRng(1), 'provfard');
    const p = g.leader;
    const on = (tile: string) => {
      const i = g.map.tiles.indexOf(tile);
      expect(i, tile).toBeGreaterThanOrEqual(0);
      p.x = i % g.map.w;
      p.y = Math.floor(i / g.map.w);
      return soundFor(g, { type: 'steg', actorId: p.id }, mid)[0].file;
    };
    expect(SFX.steg_gras).toContain(on('f'));
    expect(SFX.steg_lov).toContain(on('F'));
    expect(SFX.steg_sten).toContain(on('M'));
    expect(SFX.steg_vatten).toContain(on('v'));
    expect(SFX.steg_tra).toContain(on('='));
  });

  it('en kvinnlig rollperson låter som en kvinna, en svartalf som en svartalf', () => {
    const ch = testCharacter();
    ch.gender = 'kvinna';
    const g = Game.create(ch, seededRng(1));
    expect(files(g, { type: 'skada', actorId: g.player.id })).toEqual(['flare/sfx/female_hit']);
    expect(files(g, { type: 'död', actorId: foe(g).id })).toEqual(['flare/sfx/enemies/goblin_die']);
  });

  it('striden börjar med vapenskrammel: ett svärd som dras och ringbrynja', () => {
    const g = gravad();
    const f = files(g, { type: 'strid', phase: 'börjar' });
    expect(f).toHaveLength(2);
    expect(SFX.svard).toContain(f[0]);
    expect(SFX.ringbrynja).toContain(f[1]);
  });

  it('alla signaler ger minst ett ljud', () => {
    const g = gravad();
    const id = g.player.id;
    const all: Cue[] = [
      { type: 'anfall', actorId: id, targetId: foe(g).id, weapon: 'klo', natural: true, result: 'fummel' },
      { type: 'skott', actorId: id, targetId: foe(g).id, weapon: 'kortbage', result: 'miss' },
      { type: 'skada', actorId: foe(g, 'varg').id },
      { type: 'död', actorId: id },
      { type: 'besvärjelse', actorId: id, spell: 'okand', result: 'snedtändning' },
      { type: 'förmåga', actorId: id, ability: 'handpåläggning' },
      { type: 'steg', actorId: id },
      { type: 'ljus', actorId: id, lit: true },
      { type: 'ljus', actorId: id, lit: false },
      { type: 'vila', how: 'läger' },
      { type: 'lås', kind: 'dörr', how: 'dyrkat' },
      { type: 'packning', item: 'okant_foremal', how: 'köpt' },
      { type: 'träning', actorId: id },
    ];
    for (const c of all) expect(soundFor(g, c, mid).length, c.type).toBeGreaterThan(0);
    // När striden slutar byter musiken, och det räcker.
    expect(soundFor(g, { type: 'strid', phase: 'slutar' }, mid)).toEqual([]);
  });
});
