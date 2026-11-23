import { describe, expect, it } from 'vitest';
import * as combat from '../src/engine/combat';
import { seededRng, type Rng } from '../src/engine/dice';
import { Game } from '../src/engine/game';
import { banemanCl, folkOf, foeMatches, initiativeOf, passive, passiveCl, professionsOf, weaponCl } from '../src/engine/hero';
import { FOLK_LIST } from '../src/data/creatures';
import type { AbilityChoice, Actor } from '../src/engine/types';
import { testCharacter } from './helpers';

/** Slumpkälla som ger talen i tur och ordning och sedan 0,5. */
function queue(...values: number[]): Rng {
  return () => (values.length ? values.shift()! : 0.5);
}
const face = (n: number, sides = 20) => (n - 0.5) / sides;

function withAbility(id: string, choice?: AbilityChoice): Game {
  const ch = testCharacter();
  ch.ability = { id, total: 0, choice };
  return Game.create(ch, seededRng(3));
}

function duel(g: Game, foeDef = 'svartalf'): Actor {
  const a = g.player;
  const foe = g.state.actors.find((x) => x.defId === foeDef)!;
  a.x = 10;
  a.y = 12;
  foe.x = 11;
  foe.y = 12;
  combat.startCombat(g, [foe]);
  return foe;
}

describe('särskilda förmågor med regelvärden', () => {
  it('Starka nypor och Övertygande tonfall ger tillägg på CL i färdighetsslagen', () => {
    const plain = Game.create(testCharacter(), seededRng(3));
    const strong = withAbility('starka_nypor');
    expect(combat.skillMod(strong, strong.player, 'klattra') - combat.skillMod(plain, plain.player, 'klattra')).toBe(3);
    const talk = withAbility('overtygande_tonfall');
    expect(passiveCl(talk.char, 'overtala')).toBe(3);
    expect(passiveCl(talk.char, 'muta')).toBe(3);
    expect(passiveCl(talk.char, 'klattra')).toBe(0);
  });

  it('Magikänsla gäller Känna magi i alla skolor', () => {
    const g = withAbility('magikansla');
    expect(passiveCl(g.char, 'kanna_magi:elementarmagi')).toBe(5);
  });

  it('Precisionssinne ger +1 på anfall med vapen', () => {
    const g = withAbility('precisionssinne');
    expect(weaponCl(g.char)).toBe(1);
    const foe = duel(g);
    g.rng = queue(face(20));
    combat.attackOnce(g, g.player, foe, 'weapon');
    expect(g.state.log.join('\n')).toContain('+1 precisionssinne');
  });

  it('Baneman ger +5 mot det valda folkslaget men inte mot andra', () => {
    const g = withAbility('baneman', { foe: 'svartalf' });
    const alf = g.state.actors.find((x) => x.defId === 'svartalf_skytt')!;
    const wolf = g.state.actors.find((x) => x.defId === 'varg');
    expect(folkOf(g, alf)).toBe('svartalf');
    expect(banemanCl(g, g.player, alf)).toBe(5);
    if (wolf) expect(banemanCl(g, g.player, wolf)).toBe(0);
    const foe = duel(g);
    g.rng = queue(face(20));
    combat.attackOnce(g, g.player, foe, 'weapon');
    expect(g.state.log.join('\n')).toContain('+5 baneman');
  });

  it('Baneman förstår äldre val i fritext och listan har raserna', () => {
    expect(foeMatches('orcher', 'orch')).toBe(true);
    expect(foeMatches('Svartalfer', 'svartalf')).toBe(true);
    expect(foeMatches('orcher', 'svartalf')).toBe(false);
    expect(FOLK_LIST.map(([id]) => id)).toEqual(expect.arrayContaining(['manniska', 'svartalf', 'orch', 'alv']));
    const g = Game.create(testCharacter(), seededRng(3));
    expect(folkOf(g, g.player)).toBe('manniska');
  });

  it('Extremt orädd drar 5 från slaget på Skräcktabellen, utöver den högsta modifikationen', () => {
    const roll = (g: Game) => {
      const foe = g.state.actors.find((x) => x.defId === 'svartalf')!;
      g.state.fearMet.push(foe.defId); // −2 för att ha mött varelsen förut
      g.rng = queue(face(15));
      combat.scare(g, g.player, foe, 10);
      return g.state.log.at(-1)!;
    };
    const brave = roll(withAbility('extremt_orädd'));
    expect(brave).toContain('− 5 orädd');
    // T20 15 − PSY 10 + 10 − 2 (mött förut) − 5 (orädd) = 8
    expect(brave).toContain('= 8.');
    expect(roll(Game.create(testCharacter(), seededRng(3)))).toContain('= 13.');
  });

  it('Orubblig vilja och Härdig mot element ger +5', () => {
    expect(passive(withAbility('orubblig_vilja').char, 'psyResist')).toBe(5);
    expect(passive(withAbility('hardig_mot_element').char, 'elementResist')).toBe(5);
    expect(passive(Game.create(testCharacter(), seededRng(3)).char, 'psyResist')).toBe(0);
  });
});

describe('yrkesförmågor med regelvärden', () => {
  it('lärd mans Snusförnuft och sjöfararens Härdad av havet', () => {
    const ch = testCharacter();
    ch.profession = 'lard_man';
    expect(passive(ch, 'fear')).toBe(-5);
    ch.profession = 'sjofarare';
    expect(passive(ch, 'elementResist')).toBe(5);
  });

  it('krigarens Stridsvana, och Kluven personlighet ger ett annat yrkes förmåga', () => {
    const ch = testCharacter();
    expect(initiativeOf(ch)).toBe(5);
    ch.profession = 'tjuv';
    expect(initiativeOf(ch)).toBe(0);
    ch.ability = { id: 'kluven_personlighet', total: 0, choice: { profession: 'krigare' } };
    expect(professionsOf(ch)).toEqual(['tjuv', 'krigare']);
    expect(initiativeOf(ch)).toBe(5);
  });
});
