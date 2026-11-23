import { describe, expect, it } from 'vitest';
import * as combat from '../src/engine/combat';
import { seededRng, type Rng } from '../src/engine/dice';
import { Game } from '../src/engine/game';
import { INTENTS } from '../src/engine/intents';
import { DAY, HOUR, type Check } from '../src/engine/rules';
import * as time from '../src/engine/time';
import { testCharacter } from './helpers';

const newGame = (seed = 1) => Game.create(testCharacter(), seededRng(seed));
const ok = (result: Check['result'] = 'lyckat'): Check => ({ roll: 5, rolls: [5], target: 10, fv: 10, result, success: true, diff: 5 });
const queue = (...values: number[]): Rng => () => (values.length ? values.shift()! : 0.5);

describe('tid och läkning', () => {
  it('klockan börjar dag 1 klockan 08:00 och varje steg tar fem sekunder', () => {
    const g = newGame();
    expect(time.clockText(g.state.time)).toBe('Dag 1, 08:00');
    g.stepPlayer({ x: g.player.x + 1, y: g.player.y });
    expect(g.state.time).toBe(8 * HOUR + 5);
  });

  it('läker i halv takt utan vila', () => {
    const g = newGame();
    const p = g.player;
    p.locKp.mage -= 2;
    p.kp -= 2;
    time.advanceTime(g, DAY, 'aktiv');
    expect(p.locKp.mage).toBe(p.locMax.mage - 2);
    time.advanceTime(g, DAY, 'aktiv');
    expect(p.locKp.mage).toBe(p.locMax.mage - 1);
  });

  it('när alla kroppsdelar har läkt återställs totala KP', () => {
    const g = newGame();
    const p = g.player;
    p.locKp.mage -= 1;
    p.kp -= 5;
    time.advanceTime(g, DAY, 'vila');
    expect(p.kp).toBe(p.maxKp);
  });

  it('PSY-poäng: 1 per timmes vila, 1 per tre timmar i rörelse', () => {
    const g = newGame();
    const p = g.player;
    p.psy = 2;
    time.advanceTime(g, 2 * HOUR, 'vila');
    expect(p.psy).toBe(4);
    time.advanceTime(g, 3 * HOUR, 'aktiv');
    expect(p.psy).toBe(5);
  });

  it('en infekterad kroppsdel läker inte, och Läkekonst häver infektionen', () => {
    const g = newGame();
    const p = g.player;
    p.combatWounds = [{ loc: 'höger arm', dmg: 3, kind: 'smutsig' }];
    p.locKp['höger arm'] -= 3;
    p.kp -= 3;
    g.rng = queue(0.01, 0.5, 0.9); // infektion (1 ≤ 9 %), 1T4 = 3 veckor, ingen kallbrand
    time.rollInfections(g, p);
    expect(p.infections).toHaveLength(1);
    time.advanceTime(g, 2 * DAY, 'vila');
    expect(p.locKp['höger arm']).toBe(p.locMax['höger arm'] - 3);
    g.rng = () => 0.1;
    const check = time.medicine(g, p, p, 15);
    expect(check?.success).toBe(true);
    expect(p.infections).toHaveLength(0);
    expect(time.canMedicine(g, p)).toBe(false); // en gång per dag
  });

  it('sår under ringbrynja blir inte infekterade', () => {
    const g = newGame();
    const p = g.player;
    g.equipArmor('ringbrynjeskjorta');
    p.combatWounds = [{ loc: 'bröstkorg', dmg: 10, kind: 'smutsig' }];
    g.rng = () => 0;
    time.rollInfections(g, p);
    expect(p.infections).toHaveLength(0);
  });

  it('amputation sänker FYS med kroppsdelens KP', () => {
    const g = newGame();
    const p = g.player;
    const fys = p.attrs.FYS;
    time.amputate(g, p, 'vänster arm');
    expect(p.attrs.FYS).toBe(fys - 4);
    expect(p.injuries[0]).toMatchObject({ loc: 'vänster arm', lost: true });
    expect(combat.limbUsable(p, 'vänster arm')).toBe(false);
  });
});

describe('erfarenhet', () => {
  it('första lyckade användningen efter sömnen ger 1 EP, sedan inget förrän man sovit', () => {
    const g = newGame();
    const p = g.player;
    g.gainExperience(p, 'smyga', ok());
    g.gainExperience(p, 'smyga', ok());
    expect(p.ep.smyga).toBe(1);
    g.sleep(8);
    g.rng = () => 0.99;
    g.gainExperience(p, 'smyga', ok('perfekt')); // perfekt: 1T3+1
    expect(p.ep.smyga).toBe(5);
  });

  it('färdigheter i kategori B ger inga EP genom erfarenhet', () => {
    const g = newGame();
    g.gainExperience(g.player, 'geografi', ok());
    expect(g.player.ep.geografi).toBeUndefined();
  });

  it('EP växlas in efter en veckas vila enligt kostnadstabellen', () => {
    const g = newGame();
    const p = g.player;
    p.ep.overtala = 3;
    expect(time.raiseSkill(g, 'overtala')).toBe(false); // ingen vila ännu
    g.restWeek();
    expect(time.canConvert(p)).toBe(true);
    // Övertala är primär (grundkostnad 2) och FV 6 → 7 kostar 2.
    expect(time.raiseSkill(g, 'overtala')).toBe(true);
    expect(p.skills.overtala).toBe(7);
    expect(p.ep.overtala).toBe(1);
    g.stepPlayer({ x: p.x + 1, y: p.y });
    expect(time.canConvert(p)).toBe(false);
  });

  it('uppdraget ger bonus-EP', () => {
    const g = newGame();
    const host = g.state.actors.find((a) => a.npc === 'vardshusvard')!;
    INTENTS.uppdrag_anta.apply(g, host);
    g.state.flags.hovding_dod = true;
    INTENTS.uppdrag_beloning.apply(g, host);
    // Belöningen delas ut när spelet uppdateras (samtalet anropar changed()), och bara en gång.
    g.changed();
    g.changed();
    expect(g.state.character.bonusEp).toBe(3);
  });

  it('fobier kan mildras efter en veckas vila', () => {
    const g = newGame();
    g.state.character.phobias = [{ source: 'Varg', level: 'normal' }];
    g.rng = () => 0.1;
    g.restWeek();
    expect(g.state.character.phobias).toEqual([{ source: 'Varg', level: 'mild' }]);
  });
});
