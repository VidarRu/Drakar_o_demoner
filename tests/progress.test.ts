import { describe, expect, it } from 'vitest';
import * as combat from '../src/engine/combat';
import { seededRng, type Rng } from '../src/engine/dice';
import { Game } from '../src/engine/game';
import { abilitiesOf, chooseHeroAbility, meet, psyRaise, raiseAttribute, rollHeroAbility, setFv } from '../src/engine/hero';
import { leaveModule } from '../src/engine/modules';
import { BOOKS } from '../src/content';
import { activityProblem, joinAcademy, readLevel, runWeek, teacherBonus, teacherCost, teachers, teachProblem, weekCost, type Teacher } from '../src/engine/progress';
import { baseChance, TRAINING } from '../src/engine/rules';
import type { Actor } from '../src/engine/types';
import { testCharacter } from './helpers';

/** Slumpkälla som alltid ger samma tal: 0 ger ettor, 0.5 ger elvor och 0.99 ger tjugor på 1T20. */
const always = (v: number): Rng => () => v;

const DAY = 24 * 3600;
const recruitOf = (g: Game, id: string) => g.state.actors.find((a) => a.companion?.recruit === id)!;

function game(...recruits: string[]): Game {
  const g = Game.create(testCharacter(), seededRng(5));
  g.leader.silver = 5000;
  for (const id of recruits) g.recruit(recruitOf(g, id).id);
  return g;
}

/** Mellan äventyren: gruppen är i staden. */
function between(...recruits: string[]): Game {
  const g = game(...recruits);
  g.state.mode = 'ended';
  return g;
}

const teacher = (fv: number, int = 14, race = 'manniska'): Teacher => ({ id: 't', name: 'Läraren', race, int, skills: { enhandssvard: fv }, magic: 'också', free: false });

describe('träning med lärare (Bok I s. 62)', () => {
  it('läraren behöver FV 17, INT 13 och mer än 3 högre FV än eleven', () => {
    const g = game();
    const p = g.leader; // Enhandssvärd 13
    expect(teachProblem(g, p, teacher(16), 'enhandssvard')).toMatch(/FV 17/);
    expect(teachProblem(g, p, teacher(17, 12), 'enhandssvard')).toMatch(/INT 13/);
    expect(teachProblem(g, p, teacher(17), 'enhandssvard')).toBeNull();
    p.skills.enhandssvard = 14;
    expect(teachProblem(g, p, teacher(17), 'enhandssvard')).toMatch(/mer än 3/);
  });

  it('kostar 150 sm (300 för magi), ×1,5 för annan ras och ×3 för en ensam elev', () => {
    const ch = testCharacter();
    expect(teacherCost(teacher(18), ch, 'enhandssvard', false)).toBe(150);
    expect(teacherCost(teacher(18), ch, 'magiskola:elementarmagi', false)).toBe(300);
    expect(teacherCost(teacher(18, 14, 'dvarg'), ch, 'enhandssvard', false)).toBe(225);
    expect(teacherCost(teacher(18), ch, 'enhandssvard', true)).toBe(450);
  });

  it('ger +1 per FV över 18 och +5 till en ensam elev (Vidar)', () => {
    expect(teacherBonus(18, false)).toBe(0);
    expect(teacherBonus(20, false)).toBe(2);
    expect(teacherBonus(20, true)).toBe(7);
  });

  it('mellan äventyren: stadens lärare, två slag i veckan, betalning och en vecka', () => {
    const g = between();
    g.rng = always(0);
    const p = g.leader;
    const before = { silver: p.silver, time: g.state.time };
    const plan = { [p.id]: { kind: 'lärare' as const, teacher: 'stadens_larare', skill: 'enhandssvard' } };
    expect(weekCost(g, plan)).toBe(TRAINING.weekCost + 450);
    const r = runWeek(g, plan);
    expect('lines' in r).toBe(true);
    expect(p.ep.enhandssvard).toBe(2);
    expect(p.silver).toBe(before.silver - 520);
    expect(g.state.time - before.time).toBe(7 * DAY);
  });

  it('i Gråvad undervisar Asta i Läkekonst (FV 17, INT 13)', () => {
    const g = game();
    const asta = teachers(g).find((t) => t.name === 'Kloka gumman Asta')!;
    expect(asta).toBeDefined();
    expect(teachProblem(g, g.leader, asta, 'lakekonst')).toBeNull();
    expect(teacherCost(asta, g.state.character, 'lakekonst', true)).toBe(450);
  });

  it('flera elever hos samma lärare är inte ensamma, och en följeslagare undervisar gratis', () => {
    const g = game('linnea', 'sigrid');
    const linnea = recruitOf(g, 'linnea');
    const sigrid = recruitOf(g, 'sigrid');
    linnea.skills.forsta_hjalpen = 18;
    linnea.attrs.INT = 14;
    g.rng = always(0.5); // elvor: lyckas med INT-slag mot 11 eller mer
    const plan = {
      [g.leader.id]: { kind: 'lärare' as const, teacher: linnea.id, skill: 'forsta_hjalpen' },
      [sigrid.id]: { kind: 'lärare' as const, teacher: linnea.id, skill: 'forsta_hjalpen' },
    };
    expect(weekCost(g, plan)).toBe(3 * TRAINING.weekCost);
    // Vidar: Linnea undervisar och hinner ändå träna själv samma vecka.
    expect(activityProblem(g, linnea, { kind: 'ensam', skill: 'smyga' }, plan)).toBeNull();
    const r = runWeek(g, { ...plan, [linnea.id]: { kind: 'ensam', skill: 'smyga' } });
    const text = 'lines' in r ? r.lines.join('\n') : '';
    expect(text).toContain('Linnea tränar');
    expect(text).toContain('Linnea undervisar också');
  });
});

describe('ensamträning och arbete', () => {
  it('magiskolor tränas inte på egen hand', () => {
    const g = between();
    g.leader.skills['magiskola:elementarmagi'] = 8;
    expect(activityProblem(g, g.leader, { kind: 'ensam', skill: 'magiskola:elementarmagi' })).toMatch(/magibibliotek/);
  });

  it('arbete ger veckolön efter yrket, och deltidsträningen ger ett slag varannan vecka', () => {
    const g = between();
    g.rng = always(0);
    const p = g.leader;
    const plan = { [p.id]: { kind: 'arbete' as const, skill: 'enhandssvard' } };
    const start = p.silver;
    runWeek(g, plan);
    expect(p.silver).toBe(start - TRAINING.weekCost + 15 * 6);
    expect(p.ep.enhandssvard).toBeUndefined();
    runWeek(g, plan);
    expect(p.ep.enhandssvard).toBe(1);
  });

  it('arbete finns bara mellan äventyren', () => {
    const g = game();
    expect(activityProblem(g, g.leader, { kind: 'arbete' })).toMatch(/mellan äventyren/);
  });
});

describe('magi (Bok III s. 7)', () => {
  function mage(): Game {
    const g = between();
    const p = g.leader;
    g.state.character.profession = 'magiker';
    p.skills['magiskola:elementarmagi'] = 8;
    g.state.character.skills['magiskola:elementarmagi'] = 8;
    p.attrs.INT = 15;
    p.skills['las_skriv_modersmal:människospråket'] = 16; // B4
    return g;
  }

  it('bibliotekets magiska skrifter kräver B4 i Läsa/Skriva (Vidar)', () => {
    const g = mage();
    const p = g.leader;
    g.state.character.academy = true;
    p.skills['las_skriv_modersmal:människospråket'] = 15; // B3
    expect(activityProblem(g, p, { kind: 'bibliotek', skill: 'magiskola:elementarmagi' })).toMatch(/B4/);
  });

  it('biblioteket kräver medlemskap i akademin (1 000 sm) och ger EP i skolan', () => {
    const g = mage();
    const p = g.leader;
    const act = { kind: 'bibliotek' as const, skill: 'magiskola:elementarmagi' };
    expect(activityProblem(g, p, act)).toMatch(/medlem/);
    const silver = p.silver;
    expect(joinAcademy(g, p)).toBeNull();
    expect(p.silver).toBe(silver - 1000);
    g.rng = always(0);
    runWeek(g, { [p.id]: act });
    expect(p.ep['magiskola:elementarmagi']).toBe(1);
  });

  it('en kodex lär ut en besvärjelse med INT-slag −1 per poäng under 19 (bokens exempel: INT 15 ger 11)', () => {
    const g = mage();
    const p = g.leader;
    g.state.character.academy = true;
    g.rng = always(0.5); // 11
    const r = runWeek(g, { [p.id]: { kind: 'bibliotek', skill: 'spell:eld' } });
    expect('lines' in r && r.lines.join('\n')).toContain('mot 11');
    expect(g.state.character.spells).toContain('eld');
  });

  it('en lärare lär ut en besvärjelse på en vecka, om eleven har FV i skolan minst skolvärdet', () => {
    const g = mage();
    const p = g.leader;
    runWeek(g, { [p.id]: { kind: 'lärare', teacher: 'akademins_magister', skill: 'spell:knacka' } });
    expect(g.state.character.spells).toContain('knacka');
    p.skills['magiskola:elementarmagi'] = 5;
    expect(activityProblem(g, p, { kind: 'lärare', teacher: 'akademins_magister', skill: 'spell:eld' })).toMatch(/FV 6 i skolan/);
  });

  it('EP i magiskolan kommer inte genom erfarenhet', () => {
    const g = mage();
    const p = g.leader;
    g.gainExperience(p, 'magiskola:elementarmagi', { roll: 1, rolls: [1], target: 8, fv: 8, result: 'lyckat', success: true, diff: 7 });
    expect(p.ep['magiskola:elementarmagi']).toBeUndefined();
  });
});

describe('böcker (Vidar)', () => {
  it('Grukk bär krönikan, och den ger EP i Historia upp till bokens tak', () => {
    const g = game();
    const grukk = g.state.actors.find((a) => a.defId === 'svartalfshovding')!;
    expect(grukk.loot).toEqual(['kronika_gravad']);
    combat.kill(g, grukk);
    expect(g.state.dropped.some((d) => d.item === 'kronika_gravad' && d.slot === 'item')).toBe(true);

    const p = g.leader;
    g.state.character.inventory.push('kronika_gravad');
    g.state.mode = 'ended';
    g.rng = always(0);
    const act = { kind: 'bok' as const, book: 'kronika_gravad' };
    for (let i = 0; i < 5; i++) expect(runWeek(g, { [p.id]: act })).toHaveProperty('lines');
    expect(p.ep.historia).toBe(5);
    expect(activityProblem(g, p, act)).toMatch(/allt som står/);
  });

  it('läsnivån följer bokens tak i EP, och magiska skrifter kräver B4', () => {
    const book = (maxEp: number, spell?: string) => ({ id: 'x', name: 'X', description: '', weight: 1, price: 1, maxEp, spell });
    expect([3, 5, 10, 15, 20].map((n) => readLevel(book(n)))).toEqual([1, 2, 3, 4, 5]);
    expect(readLevel(book(0, 'eld'))).toBe(4);
    expect(readLevel(BOOKS.kronika_gravad)).toBe(2);
  });

  it('den som inte kan läsa kan inte studera boken', () => {
    const g = between();
    const p = g.leader;
    g.state.character.inventory.push('kronika_gravad');
    p.skills['las_skriv_modersmal:människospråket'] = 0;
    expect(activityProblem(g, p, { kind: 'bok', book: 'kronika_gravad' })).toMatch(/B2/);
  });
});

describe('bonus-EP och hjältepoäng för uppdrag och dåd', () => {
  it('Grukks död ger hela gruppen 2 HP var, en gång', () => {
    const g = game('linnea');
    const linnea = recruitOf(g, 'linnea');
    g.state.flags.hovding_dod = true;
    g.changed();
    g.changed();
    expect(g.state.character.heroPoints).toBe(2);
    expect(g.state.character.heroTotal).toBe(2);
    expect(g.charOf(linnea)!.heroPoints).toBe(2);
  });

  it('FV 21 ger 1T4 hjältepoäng (Bok I)', () => {
    const g = game();
    g.rng = always(0.99);
    setFv(g, g.leader, 'enhandssvard', 21);
    expect(g.state.character.heroPoints).toBe(4);
  });
});

describe('hjältepoäng före slaget (Bok I s. 65)', () => {
  function armed(rng: number): Game {
    const g = game();
    g.state.character.heroPoints = 2;
    g.toggleHero();
    expect(g.leader.heroArmed).toBe(true);
    g.rng = always(rng);
    return g;
  }

  it('ett misslyckat slag lyckas och kostar en hjältepoäng', () => {
    const g = armed(0.5); // 11 mot Övertala 6
    expect(g.playerCheck('overtala').result).toBe('lyckat');
    expect(g.state.character.heroPoints).toBe(1);
    expect(g.leader.heroArmed).toBe(false);
  });

  it('ett fummel blir bara misslyckat', () => {
    const g = armed(0.99);
    expect(g.playerCheck('overtala').result).toBe('misslyckat');
  });

  it('ett perfekt slag ger tillbaka hjältepoängen', () => {
    const g = armed(0);
    expect(g.playerCheck('overtala').result).toBe('perfekt');
    expect(g.state.character.heroPoints).toBe(2);
  });
});

describe('att spendera hjältepoäng mellan äventyren', () => {
  it('2T20 + 40 för 10 HP; en förmåga man har ger nästa rad', () => {
    const g = between();
    const ch = g.state.character;
    ch.heroPoints = 20;
    g.rng = always(0); // 1 + 1 + 40 = 42: Absolut gehör
    expect(rollHeroAbility(g, g.leader, 2)).toBeNull();
    expect(rollHeroAbility(g, g.leader, 2)).toBeNull();
    expect(abilitiesOf(ch).map((a) => a.def.id)).toEqual(['absolut_gehor', 'precisionssinne']);
    expect(ch.heroPoints).toBe(0);
  });

  it('Höjd grundegenskap väntar på ett val och höjer grundegenskapen', () => {
    const g = between();
    const ch = g.state.character;
    ch.heroPoints = 20;
    g.rng = always(0.99); // 20 + 20 + 40 = 80: God PSY-potential, som inte kräver något val
    rollHeroAbility(g, g.leader, 2);
    expect(ch.heroPending).toBeUndefined();
    // 80 igen, men God PSY-potential finns redan: nästa rad är Höjd grundegenskap (81+).
    rollHeroAbility(g, g.leader, 2);
    expect(ch.heroPending?.id).toBe('hojd_grundegenskap');
    expect(rollHeroAbility(g, g.leader, 0)).toMatch(/Välj först/);
    expect(chooseHeroAbility(g, g.leader, { attrs: { STO: 2 } })).toMatch(/inte STO/);
    expect(chooseHeroAbility(g, g.leader, { attrs: { SMI: 2 } })).toBeNull();
    expect(ch.attrs.SMI).toBe(14);
    expect(g.leader.attrs.SMI).toBe(14);
  });

  it('5 HP höjer en grundegenskap (inte STO), och baschansen följer med', () => {
    const g = between();
    const ch = g.state.character;
    const p: Actor = g.leader;
    ch.heroPoints = 10;
    expect(raiseAttribute(g, p, 'STO')).toMatch(/STO/);
    const before = p.skills.finna_dolda_ting;
    expect(raiseAttribute(g, p, 'INT')).toBeNull();
    expect(ch.attrs.INT).toBe(11);
    expect(ch.heroPoints).toBe(5);
    expect(p.skills.finna_dolda_ting - before).toBe(baseChance(11) - baseChance(10));
    g.state.mode = 'explore';
    expect(raiseAttribute(g, p, 'INT')).toMatch(/mellan äventyren/);
  });
});

describe('PSY-höjning efter äventyret (Bok I s. 64)', () => {
  it('den som blir oberörd på Skräcktabellen har vunnit en PSY-kamp', () => {
    const g = game();
    const foe = g.state.actors.find((a) => a.defId === 'varg')!;
    g.rng = always(0);
    combat.scare(g, g.leader, foe, 5);
    expect(g.state.character.psyWin).toBe('motstånd');
  });

  it('andra än magiker: 1T20 mot 20 − PSY ger +1, och en etta 1T3+1', () => {
    const g = game();
    const p = g.leader; // PSY 10
    g.state.character.psyWin = 'motstånd';
    g.rng = always(0.45); // 10
    expect(psyRaise(g, p)).toBe(1);
    expect(g.state.character.attrs.PSY).toBe(11);
    expect(g.state.character.psyWin).toBeUndefined();
    g.state.character.psyWin = 'motstånd';
    g.rng = always(0.5); // 11 mot 9: ingen höjning
    expect(psyRaise(g, p)).toBe(0);
  });

  it('den som kan magi: 25 − PSY, och över 24 krävs ettor', () => {
    const g = game();
    const p = g.leader;
    g.state.character.attrs.PSY = 25;
    p.attrs.PSY = 25;
    p.skills['magiskola:elementarmagi'] = 8;
    g.state.character.psyWin = 'magiker';
    g.rng = always(0); // två ettor i rad: 1T3+1
    expect(psyRaise(g, p)).toBe(2);
  });

  it('den som kan magi slår mot 25 − PSY även efter en kamp på Skräcktabellen (Vidar)', () => {
    const g = game();
    const p = g.leader; // PSY 10
    p.skills['magiskola:elementarmagi'] = 8;
    g.state.character.psyWin = 'motstånd';
    g.rng = always(0.6); // 13: lyckas mot 15 men inte mot 10
    expect(psyRaise(g, p)).toBe(1);
  });

  it('slaget slås när gruppen lämnar modulen', () => {
    const g = game();
    g.state.character.psyWin = 'motstånd';
    g.rng = always(0);
    leaveModule(g);
    expect(g.state.character.attrs.PSY).toBeGreaterThan(10);
  });
});

describe('igenkänd som hjälte', () => {
  it('första mötet slås 1T100 mot alla HP i livet; igenkänd sätter modulens flagga', () => {
    const g = game();
    const host = g.state.actors.find((a) => a.npc === 'vardshusvard')!;
    expect(meet(g, host)).toBe(false);
    const smith = g.state.actors.find((a) => a.npc === 'smed')!;
    g.state.character.heroTotal = 30;
    g.rng = always(0.2); // 21
    expect(meet(g, smith)).toBe(true);
    expect(g.state.flags.igenkand_smed).toBe(true);
    // Bara första mötet räknas.
    g.state.character.heroTotal = 0;
    expect(meet(g, smith)).toBe(true);
  });
});
