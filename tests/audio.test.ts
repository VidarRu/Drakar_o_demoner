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

  const attack = (g: Game, weapon: string, result: 'träff' | 'miss' | 'parerat', natural = false) =>
    soundFor(g, { type: 'anfall', actorId: g.player.id, targetId: foe(g).id, weapon, natural, result }, mid);

  it('svärd, yxa, klubba, dolk och spjut hugger olika', () => {
    const g = gravad();
    const swing = (weapon: string) => attack(g, weapon, 'miss')[0];
    expect(SFX.hugg_sabel).toContain(swing('bredsvard').file);
    expect(SFX.hugg_yxa).toContain(swing('handyxa').file);
    // Klubban har inget eget hugg: yxans, tyngre.
    expect(SFX.hugg_yxa).toContain(swing('klubba').file);
    expect(swing('klubba').rate).toBeLessThan(swing('handyxa').rate);
    expect(SFX.hugg_dolk).toContain(swing('dolk').file);
    expect(SFX.hugg_spjut).toContain(swing('kortspjut').file);
    // Klor och nävar låter som förut.
    expect(SFX.hugg).toContain(attack(g, 'klo', 'miss', true)[0].file);
    // En miss är bara hugget.
    expect(attack(g, 'bredsvard', 'miss')).toHaveLength(1);
  });

  it('en träff låter efter vapnet och efter om målet har rustning', () => {
    const g = gravad();
    const f = foe(g);
    const impact = (weapon: string, natural = false) => {
      const p = attack(g, weapon, 'träff', natural);
      expect(p).toHaveLength(2);
      expect(p[1].delay).toBeGreaterThan(0);
      return p[1].file;
    };
    f.armor = [];
    expect(SFX.traff_svard).toContain(impact('bredsvard'));
    expect(SFX.traff_svard).toContain(impact('handyxa'));
    expect(SFX.traff_kross).toContain(impact('stridshammare'));
    expect(SFX.traff_stick).toContain(impact('dolk'));
    expect(SFX.traff_slag).toContain(impact('nave', true));
    f.armor = ['ringbrynjeskjorta'];
    expect(SFX.traff_svard_rustning).toContain(impact('bredsvard'));
    expect(SFX.traff_kross_rustning).toContain(impact('stridshammare'));
    expect(SFX.traff_stick_rustning).toContain(impact('dolk'));
  });

  it('ett parerat anfall ger hugg och vapen mot vapen', () => {
    const g = gravad();
    const f = attack(g, 'bredsvard', 'parerat').map((p) => p.file);
    expect(f).toHaveLength(2);
    expect(SFX.hugg_sabel).toContain(f[0]);
    expect(SFX.parera).toContain(f[1]);
  });

  it('båge och armborst låter olika, och en pil som träffar ger ett nedslag', () => {
    const g = gravad();
    const shot = (weapon: string, result: 'träff' | 'miss' = 'miss') => soundFor(g, { type: 'skott', actorId: g.player.id, targetId: foe(g).id, weapon, result }, mid);
    expect(SFX.skott_bage).toContain(shot('kortbage')[0].file);
    expect(SFX.skott_armborst).toContain(shot('latt_armborst')[0].file);
    expect(SFX.skott).toContain(shot('slunga')[0].file);
    expect(SFX.hugg_yxa).toContain(shot('kastyxa')[0].file);
    foe(g).armor = [];
    const hit = shot('kortbage', 'träff');
    expect(SFX.traff_stick).toContain(hit[1].file);
  });

  it('grymtandet kommer efter nedslaget', () => {
    const g = gravad();
    const grunt = soundFor(g, { type: 'skada', actorId: foe(g).id }, mid)[0];
    const hit = attack(g, 'bredsvard', 'träff')[1];
    expect(grunt.delay).toBeGreaterThan(hit.delay!);
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

  it('en fackla som tänds låter som en låga som tar sig, en som släcks dämpat', () => {
    const g = gravad();
    const id = g.player.id;
    expect(SFX.tanda).toContain(files(g, { type: 'ljus', actorId: id, lit: true })[0]);
    const out = soundFor(g, { type: 'ljus', actorId: id, lit: false }, mid);
    expect(SFX.tanda).not.toContain(out[0].file);
    expect(out[0].volume).toBeLessThan(1);
  });

  it('att sova: man lägger sig och vaknar till fågelkvitter', () => {
    const g = gravad();
    const p = soundFor(g, { type: 'vila', how: 'sömn' }, mid);
    expect(p.map((x) => x.file)).toEqual(['oga/vila/lagga1', 'flare/sfx/utdrag/kvitter']);
    expect(p[1].delay).toBeGreaterThan(1000);
  });

  it('att slå läger: lägereld och uggla under natten, fågelkvitter sist', () => {
    const g = gravad();
    const p = soundFor(g, { type: 'vila', how: 'läger' }, mid);
    expect(p.map((x) => x.file)).toEqual(['oga/vila/lagga1', 'flare/sfx/utdrag/lagereld', 'flare/sfx/utdrag/uggla', 'flare/sfx/utdrag/kvitter']);
    const delays = p.map((x) => x.delay ?? 0);
    expect(delays).toEqual([...delays].sort((x, y) => x - y));
    expect(delays[3]).toBeGreaterThan(delays[2]);
  });

  it('vargen morrar och ylar, björnen brummar', () => {
    const g = gravad();
    const wolf = foe(g, 'varg');
    expect(SFX.varg_traff).toContain(files(g, { type: 'skada', actorId: wolf.id })[0]);
    expect(SFX.varg_dor).toContain(files(g, { type: 'död', actorId: wolf.id })[0]);
    wolf.sprite = 'bjorn';
    expect(SFX.bjorn_traff).toContain(files(g, { type: 'skada', actorId: wolf.id })[0]);
    expect(SFX.bjorn_dor).toContain(files(g, { type: 'död', actorId: wolf.id })[0]);
  });

  it('elementarerna låter efter sitt element', () => {
    const g = gravad();
    const a = foe(g);
    const expected: Record<string, [string[], string[]]> = {
      eld: [SFX.brann, SFX.eld],
      värme: [SFX.brann, SFX.eld],
      jord: [SFX.sten, SFX.sten_dor],
      vatten: [SFX.plask, SFX.plask_dor],
      luft: [SFX.hugg_spjut, SFX.flytt],
      köld: [SFX.kold, SFX.kold],
      mörker: [SFX.skugga, SFX.skugga_dor],
      ljus: [SFX.skydd, SFX.lak],
    };
    for (const [kind, [hit, die]] of Object.entries(expected)) {
      a.elemental = { kind } as never;
      expect(hit, kind).toContain(files(g, { type: 'skada', actorId: a.id })[0]);
      expect(die, kind).toContain(files(g, { type: 'död', actorId: a.id })[0]);
    }
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
