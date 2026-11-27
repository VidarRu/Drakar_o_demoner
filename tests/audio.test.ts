import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MUSIC, musicFor } from '../src/audio/music';
import * as combat from '../src/engine/combat';
import { seededRng } from '../src/engine/dice';
import { Game } from '../src/engine/game';
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
