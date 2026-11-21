import { describe, expect, it } from 'vitest';
import { HERBS, herbPrice } from '../src/data/herbs';
import { SPELLS } from '../src/data/spells';
import * as combat from '../src/engine/combat';
import { seededRng, type Rng } from '../src/engine/dice';
import { Game } from '../src/engine/game';
import { carriedWeight, equip, ironProblem, loadMod } from '../src/engine/inventory';
import { castProblem, castSpell, memorize, memorizeProblem, resolvePending, spellS } from '../src/engine/magic';
import { neutralize, poisonActor, searchHerb, useHerb } from '../src/engine/poison';
import {
  memoryCapacity,
  poisonOnsets,
  poisonStage,
  resistance,
  spellCl,
  spellPsyCost,
  spellSkill,
  suicideBudget,
} from '../src/engine/rules';
import { buy, haggle, sell, sellable, wares } from '../src/engine/trade';
import type { Actor, Character } from '../src/engine/types';
import { testCharacter } from './helpers';

/** Slumpkälla som ger talen i tur och ordning och sedan 0,5. */
function queue(...values: number[]): Rng {
  return () => (values.length ? values.shift()! : 0.5);
}
/** Talet som ger `n` på en tärning med `sides` sidor. */
const face = (n: number, sides = 20) => (n - 0.5) / sides;

/** En elementarmagiker med trästav och läderharnesk (inget järn). */
function testMage(): Character {
  const c = testCharacter();
  c.profession = 'magiker';
  c.attrs.INT = 15;
  c.attrs.PSY = 16;
  c.skills['magiskola:elementarmagi'] = 12;
  c.spells = ['eld', 'blixt', 'skold', 'knacka', 'energistrale', 'skingra'];
  c.memorized = ['eld', 'blixt', 'skold', 'knacka'];
  c.inventory = ['trastav', 'harnesk_lader'];
  c.equipped = { weapon: 'trastav', armor: ['harnesk_lader'] };
  return c;
}

function fight(char: Character, defId = 'svartalf', dist = 1): { g: Game; p: Actor; foe: Actor } {
  const g = Game.create(char, seededRng(3));
  const p = g.player;
  const foe = g.state.actors.find((a) => a.defId === defId)!;
  p.x = 10;
  p.y = 12;
  foe.x = 10 + dist;
  foe.y = 12;
  combat.startCombat(g, [foe]);
  // Låt rollpersonen ha turen.
  const c = g.state.combat!;
  c.round = 1;
  c.order = [p.id, foe.id];
  c.turn = 0;
  c.acted = {};
  c.movesLeft = p.move;
  p.movedLast = 0;
  return { g, p, foe };
}

describe('magins regler', () => {
  it('räknar S, CL och PSY enligt husreglerna', () => {
    // Exemplet i regelbeslut: Elementarmagi 15, ELD (SV 6), INT 15 → S12.
    expect(spellSkill(15, 6, 15)).toBe(12);
    // Husregel: −1 per E utöver den första (boken säger −2).
    expect(spellCl(12, 1)).toBe(12);
    expect(spellCl(12, 3)).toBe(10);
    expect(spellPsyCost(3, 'lyckat')).toBe(3);
    expect(spellPsyCost(3, 'misslyckat')).toBe(1);
    expect(spellPsyCost(3, 'perfekt')).toBe(1);
    expect(spellPsyCost(4, 'perfekt')).toBe(2);
    expect(spellPsyCost(3, 'fummel')).toBe(3);
    expect(memoryCapacity(15, 16)).toBe(7);
    // Bokens exempel: Zot med 4 PSY kvar och PSY 16 kan offra 12.
    expect(suicideBudget(4, 16)).toBe(12);
  });

  it('ELD läggs i en runda och verkar i början av nästa', () => {
    const { g, p, foe } = fight(testMage(), 'svartalf', 3);
    expect(spellS(p, 'eld')).toBe(12 - 6 + 3);
    expect(castProblem(g, 'eld', { grade: 2, target: foe.id })).toBeNull();
    const kp = foe.kp;
    expect(castSpell(g, 'eld', { grade: 2, target: foe.id })).toBeNull();
    expect(g.state.combat!.pending).toHaveLength(1);
    expect(g.state.log.join('\n')).toContain('börjar lägga ELD E2');
    // I början av nästa runda: T20 3 lyckas (CL 9 − 1 = 8), skadan 2T6 blir 4 + 5.
    g.rng = queue(face(3), face(4, 6), face(5, 6));
    resolvePending(g);
    expect(p.psy).toBe(14);
    expect(foe.kp).toBe(kp - 9);
  });

  it('en lyckad BLIXT drar PSY och gör skada utan rustning', () => {
    const { g, p, foe } = fight(testMage(), 'svartalf', 3);
    const kp = foe.kp;
    // BLIXT är kvick: T20 5 lyckas, skadan 2T6 blir 3 + 4.
    g.rng = queue(face(5), face(3, 6), face(4, 6));
    expect(castSpell(g, 'blixt', { grade: 2, target: foe.id })).toBeNull();
    expect(p.psy).toBe(16 - 2);
    expect(foe.kp).toBe(kp - 7);
  });

  it('ett misslyckat slag kostar 1 PSY, och fummel ger snedtändning', () => {
    const { g, p, foe } = fight(testMage(), 'svartalf', 3);
    g.rng = queue(face(19));
    castSpell(g, 'blixt', { grade: 3, target: foe.id });
    expect(p.psy).toBe(15);
    const { g: g2, p: p2, foe: foe2 } = fight(testMage(), 'svartalf', 3);
    // 20 och sedan över FV: fummel. Snedtändning 1T20 = 8: skada lika med E och medvetslös.
    g2.rng = queue(face(20), face(20), face(8));
    castSpell(g2, 'blixt', { grade: 3, target: foe2.id });
    expect(p2.psy).toBe(13);
    expect(g2.state.log.join('\n')).toContain('Snedtändningstabellen 8');
    expect(p2.kp).toBe(p2.maxKp - 3);
  });

  it('järn i handen eller metallrustning stoppar magin', () => {
    const c = testMage();
    c.inventory.push('kortsvard');
    const g = Game.create(c, seededRng(1));
    expect(ironProblem(g)).toMatch(/järn i packningen/);
    expect(castProblem(g, 'skold', { grade: 1 })).toMatch(/Järnet stör magin/);
  });

  it('minnet rymmer (INT + PSY) / 4 besvärjelser och memorering tar tid', () => {
    const g = Game.create(testMage(), seededRng(1));
    const t = g.state.time;
    expect(memorizeProblem(g, 'energistrale')).toBeNull();
    expect(memorize(g, 'energistrale')).toBeNull();
    expect(g.state.time - t).toBe(6 * 20 * 60);
    expect(g.state.character.memorized).toContain('energistrale');
  });

  it('SKÖLD parerar nästa anfall automatiskt', () => {
    const { g, p, foe } = fight(testMage());
    g.rng = queue(face(3));
    castSpell(g, 'skold', { grade: 1 });
    expect(combat.hasEffect(p, 'luftsköld')).toBe(true);
    foe.skills.enhandssvard = 15;
    g.rng = queue(face(2), 0.9);
    combat.attackOnce(g, foe, p, 'weapon');
    expect(g.state.log.join('\n')).toContain('parerar (SKÖLD)');
    expect(combat.hasEffect(p, 'luftsköld')).toBe(false);
  });

  it('KNÄCKA sänker BV på fiendens vapen', () => {
    const { g, foe } = fight(testMage(), 'svartalf', 2);
    g.rng = queue(face(3));
    castSpell(g, 'knacka', { grade: 2, target: foe.id });
    expect(foe.bv.weapon).toBe(15 - 12);
  });

  it('besvärjelser med verkan i spelet har räckvidd och mål', () => {
    const withEffect = Object.values(SPELLS).filter((s) => s.effect);
    expect(withEffect.length).toBeGreaterThanOrEqual(20);
    for (const s of withEffect) expect(s.aim).toBeDefined();
  });
});

describe('avståndsstrid', () => {
  function archer(): Character {
    const c = testCharacter();
    c.skills.bagar = 14;
    c.inventory.push('kortbage');
    c.ammo = { pilar: 10 };
    return c;
  }

  it('skjuter med båge: kräver en ruta emellan, förbrukar pilar och träffar', () => {
    const { g, p, foe } = fight(archer(), 'svartalf', 1);
    expect(equip(g, 'kortbage', 'weapon')).toBeNull();
    // Skölden läggs undan: projektilvapen kräver två händer.
    expect(p.shield).toBeUndefined();
    g.state.combat!.acted = {};
    expect(g.attackProblem(foe.id)).toMatch(/minst en ruta/);
    foe.x = 14;
    const kp = foe.kp;
    // T20 3 träffar, slitage, träffområde 1T20 = 10 (bröstkorg), skada 1T6+1 = 6.
    g.rng = queue(face(3), 0.9, face(10), face(5, 6));
    expect(g.playerAttack(foe.id)).toBe(true);
    expect(g.state.character.ammo.pilar).toBe(9);
    expect(foe.kp).toBeLessThan(kp);
  });

  it('halverar CL mot ett mål som springer och drar av för avståndet', () => {
    const { g, p, foe } = fight(archer(), 'svartalf', 1);
    equip(g, 'kortbage', 'weapon');
    g.state.combat!.acted = {};
    const info = combat.rangedInfo(p)!;
    expect(info.range).toBe(90);
    foe.movedLast = foe.move;
    foe.x = 16;
    g.rng = queue(face(15));
    combat.shoot(g, p, foe);
    expect(g.state.log.join('\n')).toContain('halverad mot rörligt mål');
  });

  it('armborst måste laddas om', () => {
    const c = testCharacter();
    c.attrs.STY = 14;
    c.skills.armborst = 12;
    c.inventory.push('latt_armborst');
    c.ammo = { armborstlod: 5 };
    const { g, p, foe } = fight(c, 'svartalf', 4);
    equip(g, 'latt_armborst', 'weapon');
    g.state.combat!.acted = {};
    g.rng = queue(face(18));
    combat.shoot(g, p, foe);
    expect(p.reload).toBe(3);
    expect(combat.shootProblem(g, p, foe)).toMatch(/laddas om/);
  });

  it('kastvapen landar på marken och kan plockas upp', () => {
    const c = testCharacter();
    c.skills.kastvapen = 12;
    c.inventory.push('kastyxa');
    const { g, p, foe } = fight(c, 'svartalf', 3);
    equip(g, 'kastyxa', 'weapon');
    g.state.combat!.acted = {};
    g.rng = queue(face(19));
    combat.shoot(g, p, foe);
    expect(p.weapon).toBe('nave');
    expect(g.state.dropped.some((d) => d.item === 'kastyxa')).toBe(true);
  });

  it('svartalfsskytten skjuter på håll', () => {
    const g = Game.create(testCharacter(), seededRng(5));
    const s = g.state.actors.find((a) => a.defId === 'svartalf_skytt')!;
    expect(s.ranged).toBe('kortbage');
    expect(s.rangedAmmo).toBe(8);
  });
});

describe('bärförmåga och handel', () => {
  it('räknar bördan med halv rustningsvikt och ger avdrag över STY', () => {
    const g = Game.create(testCharacter(), seededRng(1));
    const p = g.player;
    const light = carriedWeight(g);
    expect(light).toBeGreaterThan(0);
    expect(loadMod(g, p)).toBe(0);
    // Bredsvärd, sköld, halva läderharnesket och silvret.
    expect(light).toBeGreaterThan(12);
    expect(light).toBeLessThan(20);
    // Två tvåhandsyxor (16 kg) ger mellan STY × 2 och STY × 3: −2.
    for (let i = 0; i < 2; i++) g.state.character.inventory.push('tvahandsyxa');
    expect(carriedWeight(g)).toBeCloseTo(light + 16, 1);
    expect(loadMod(g, p)).toBe(-2);
    expect(combat.effectiveMove(p, g)).toBe(p.move - 2);
    // Över STY × 6 går det inte att röra sig.
    for (let i = 0; i < 8; i++) g.state.character.inventory.push('tvahandsyxa');
    expect(loadMod(g, p)).toBeNull();
    expect(combat.effectiveMove(p, g)).toBe(0);
  });

  it('köper till Bok III:s priser och säljer för halva priset', () => {
    const g = Game.create(testCharacter(), seededRng(1));
    const smith = g.state.actors.find((a) => a.npc === 'smed')!;
    const silver = g.player.silver;
    expect(wares(g, smith).some((w) => w.id === 'langbage')).toBe(true);
    expect(buy(g, smith, 'dolk')).toBeNull();
    expect(g.player.silver).toBe(silver - 70);
    expect(sellable(g, smith).find((w) => w.id === 'dolk')?.price).toBe(35);
    expect(sell(g, smith, 'dolk')).toBeNull();
    expect(g.player.silver).toBe(silver - 35);
  });

  it('Köpslå ger 5 % per poäng i differensvärde', () => {
    const g = Game.create(testCharacter(), seededRng(1));
    const bertil = g.state.actors.find((a) => a.npc === 'vardshusvard')!;
    g.player.skills.kopsla = 14;
    // 10 + 14 − 12 = 12. T20 8 ger differensvärde 4, alltså 20 %.
    g.rng = queue(face(8));
    expect(haggle(g, bertil)).toBe(20);
    expect(resistance(14, 12, queue(face(8))).diff).toBe(4);
  });

  it('pilar köps tio i taget', () => {
    const g = Game.create(testCharacter(), seededRng(1));
    const smith = g.state.actors.find((a) => a.npc === 'smed')!;
    buy(g, smith, 'pilar');
    expect(g.state.character.ammo.pilar).toBe(10);
  });
});

describe('örter och gifter', () => {
  it('giftets stadium och tider följer Bok II', () => {
    // Exemplet med Strahinya: STY 16 ger 4 SR, sedan 4 minuter och 4 timmar till.
    const t = poisonOnsets(16);
    expect(t.lindrig).toBe(4 * 5);
    expect(t.måttlig).toBe(4 * 5 + 4 * 60);
    expect(t.allvarlig).toBe(4 * 5 + 4 * 60 + 4 * 3600);
    // FYS 13 mot STY 16: 7 eller lägre. Slaget 13 misslyckas med 6: allvarlig.
    expect(poisonStage(resistance(13, 16, queue(face(13))))).toBe('allvarlig');
    expect(poisonStage(resistance(13, 16, queue(face(9))))).toBe('måttlig');
    expect(poisonStage(resistance(13, 16, queue(face(5))))).toBe('lindrig');
    expect(poisonOnsets(25).lindrig).toBe(5);
  });

  it('priset är vanligheten upphöjt till tre', () => {
    expect(herbPrice(HERBS.honungslilja)).toBe(729);
    expect(herbPrice(HERBS.cepirbuske)).toBe(1);
  });

  it('en läkeört läker, och ett motgift bryter ned giftet', () => {
    const g = Game.create(testCharacter(), seededRng(2));
    const p = g.player;
    p.kp = p.maxKp - 8;
    g.state.character.herbs.push({ id: 'mirenbuske', quality: 'normal' });
    expect(useHerb(g, 0)).toBeNull();
    expect(p.kp).toBe(p.maxKp);
    g.rng = queue(face(20), face(20));
    poisonActor(g, p, { id: 'spikklubbsort', quality: 'normal' });
    expect(p.poisons?.length).toBe(1);
    neutralize(g, p, 10);
    expect(p.poisons?.length).toBe(0);
  });

  it('nervgiftets lindriga stadium ger −5 på SMI-färdigheter', () => {
    const g = Game.create(testCharacter(), seededRng(2));
    const p = g.player;
    // FYS 13 mot STY 5: 18 eller lägre lyckas; lindrig efter 15 SR.
    g.rng = queue(face(10));
    poisonActor(g, p, { id: 'spikklubbsort', quality: 'normal' });
    g.state.time += 15 * 5;
    combat.tick(g, p);
    expect(p.effects.some((e) => e.label.startsWith('Spikklubbsört: lindrig') && e.mod === -5)).toBe(true);
  });

  it('gift på vapnet verkar vid nästa träff', () => {
    const { g, p, foe } = fight(testCharacter());
    p.weaponPoison = { id: 'krigarfasa', quality: 'normal' };
    g.rng = queue(face(2), 0.9, face(20), face(2, 6), face(20), face(20));
    combat.attackOnce(g, p, foe, 'weapon');
    expect(p.weaponPoison).toBeUndefined();
    expect(g.state.log.join('\n')).toContain('krigarfasa');
  });

  it('att leta örter tar en dag och använder Örtkunskap', () => {
    const c = testCharacter();
    c.skills.ortkunskap = 15;
    const g = Game.create(c, seededRng(4));
    g.player.skills.ortkunskap = 15;
    const t = g.state.time;
    // T20 2 mot CL 13 lyckas, och 1T4 ger 3 doser.
    g.rng = queue(face(2), face(3, 4));
    expect(searchHerb(g, 'krakflader')).toBeNull();
    expect(g.state.time - t).toBe(10 * 3600);
    expect(g.state.character.herbs.length).toBe(3);
  });
});
