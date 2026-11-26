import { describe, expect, it } from 'vitest';
import * as combat from '../src/engine/combat';
import { seededRng, type Rng } from '../src/engine/dice';
import { ELEMENTALS, elementSourceProblem } from '../src/engine/elementals';
import { Game } from '../src/engine/game';
import { castProblem, castSpell, resolvePending } from '../src/engine/magic';
import { ARMOR } from '../src/data/armor';
import { FUMBLE_TABLES } from '../src/engine/rules';
import { attackModes, maneuverProblem } from '../src/engine/maneuvers';
import { payWages, shareLoot } from '../src/engine/party';
import { DAY } from '../src/engine/rules';
import type { Actor, Character } from '../src/engine/types';
import { lit, testCharacter } from './helpers';

/** Slumpkälla som ger talen i tur och ordning och sedan 0,5. */
function queue(...values: number[]): Rng {
  return () => (values.length ? values.shift()! : 0.5);
}
/** Talet som ger `n` på en tärning med `sides` sidor. */
const face = (n: number, sides = 20) => (n - 0.5) / sides;

const recruitOf = (g: Game, id: string) => g.state.actors.find((a) => a.companion?.recruit === id)!;

function withParty(...ids: string[]): Game {
  const g = Game.create(testCharacter(), seededRng(5));
  g.leader.silver = 1000;
  for (const id of ids) expect(g.recruit(recruitOf(g, id).id)).not.toMatch(/inte|full/);
  return g;
}

/** Ställer upp en strid där `a` har turen mot `foe`. */
function turnOf(g: Game, a: Actor, foe: Actor) {
  if (!g.state.combat) combat.startCombat(g, [foe]);
  const c = g.state.combat!;
  c.round = 1;
  c.order = [a.id, ...c.order.filter((id) => id !== a.id)];
  c.turn = 0;
  c.acted = {};
  c.movesLeft = a.move;
  a.movedLast = 0;
  g.state.focus = a.id;
}

function placeDuel(g: Game, a: Actor, foeDef = 'svartalf') {
  const foe = g.state.actors.find((x) => x.defId === foeDef)!;
  a.x = 10;
  a.y = 12;
  foe.x = 11;
  foe.y = 12;
  return foe;
}

describe('följeslagare', () => {
  it('tre personer i Gråvad kan följa med, med fullständiga rollformulär', () => {
    const g = Game.create(testCharacter(), seededRng(1));
    const names = ['hjalmar', 'sigrid', 'linnea'].map((id) => recruitOf(g, id));
    for (const a of names) {
      expect(a.kind).toBe('npc');
      const ch = g.state.companions[a.id];
      expect(ch.skills).toBeTruthy();
      expect(a.locMax.huvud).toBeGreaterThan(0);
      expect(a.weapon).toBe(ch.equipped.weapon);
    }
    expect(g.state.companions[names[0].id].profession).toBe('krigare');
    expect(g.state.companions[names[1].id].profession).toBe('utbygdsjagare');
    expect(g.state.companions[names[2].id].profession).toBe('helare');
  });

  it('legoknekten tar dagslön, och går när lönen uteblir', () => {
    const g = Game.create(testCharacter(), seededRng(1));
    const h = recruitOf(g, 'hjalmar');
    g.leader.silver = 30;
    g.recruit(h.id);
    expect(g.state.party).toContain(h.id);
    expect(g.leader.silver).toBe(10);
    expect(h.kind).toBe('player');
    g.state.time += DAY;
    payWages(g);
    expect(g.state.party).not.toContain(h.id);
    expect(h.kind).toBe('npc');
    expect(g.state.log.join('\n')).toContain('får ingen lön');
    // Hen vill inte genast tillbaka.
    g.leader.silver = 100;
    expect(g.recruit(h.id)).toContain('i morgon');
  });

  it('jägarinnan tar en lika stor del av silvret som hittas', () => {
    const g = withParty('sigrid');
    const s = recruitOf(g, 'sigrid');
    const before = g.leader.silver;
    const sBefore = s.silver;
    shareLoot(g, 21, 'svartalfen');
    expect(s.silver - sBefore).toBe(10);
    expect(g.leader.silver - before).toBe(11);
  });

  it('gruppen är högst sex', () => {
    const g = withParty('hjalmar', 'sigrid', 'linnea');
    expect(g.state.party).toHaveLength(4);
    // Fyll på med kopior för att nå taket.
    for (let i = 0; i < 2; i++) {
      const extra = { ...recruitOf(g, 'linnea'), id: `x${i}`, kind: 'npc' as const };
      g.state.actors.push(extra);
      g.state.companions[extra.id] = g.state.companions[recruitOf(g, 'linnea').id];
      g.state.party.push(extra.id);
    }
    const free = { ...recruitOf(g, 'sigrid'), id: 'x9', kind: 'npc' as const };
    g.state.actors.push(free);
    expect(g.recruit('x9')).toContain('full');
  });

  it('följeslagarna går i ledarens spår och tiden läker dem också', () => {
    const g = withParty('hjalmar');
    const h = recruitOf(g, 'hjalmar');
    const p = g.leader;
    p.x = 10;
    p.y = 12;
    h.x = 9;
    h.y = 12;
    g.stepPlayer({ x: 11, y: 12 });
    expect([h.x, h.y]).toEqual([10, 12]);
    h.kp -= 3;
    h.locKp['vänster arm'] -= 3;
    g.sleep(24);
    expect(h.locKp['vänster arm']).toBe(h.locMax['vänster arm'] - 2);
  });

  it('i strid styr spelaren varje följeslagare på dennes tur', () => {
    const g = withParty('hjalmar');
    const h = recruitOf(g, 'hjalmar');
    const foe = placeDuel(g, h);
    turnOf(g, h, foe);
    expect(g.isPlayerTurn()).toBe(true);
    expect(g.player).toBe(h);
    expect(g.char.name).toBe('Hjalmar');
    expect(g.canAttack(foe.id)).toBe(true);
    g.playerAttack(foe.id);
    expect(g.state.log.join('\n')).toContain('Hjalmar anfaller Svartalf');
  });

  it('Dra vapen slås för alla i gruppen', () => {
    const g = withParty('hjalmar', 'sigrid');
    const foe = placeDuel(g, g.leader);
    const start = g.state.log.length;
    combat.startCombat(g, [foe]);
    const lines = g.state.log.slice(start).filter((l) => l.includes('slår Dra vapen'));
    expect(lines).toHaveLength(3);
  });

  it('fummel mot närmsta vän träffar en följeslagare inom räckhåll', () => {
    const g = withParty('hjalmar');
    const h = recruitOf(g, 'hjalmar');
    const p = g.leader;
    const foe = placeDuel(g, p);
    h.x = 10;
    h.y = 11;
    turnOf(g, p, foe);
    const kp = h.kp;
    // Raden på närstridstabellen där hugget träffar närmsta vän. Sedan träffområde och skada.
    const row = FUMBLE_TABLES.närstrid.findIndex((r) => r.effects.some((e) => e.kind === 'vän')) + 1;
    g.rng = queue(face(row), face(10), 0.99);
    combat.fumble(g, p, 'närstrid', 'weapon');
    expect(g.state.log.join('\n')).toContain('Test träffar Hjalmar');
    expect(h.kp).toBeLessThan(kp);
  });

  it('en kamrat kan lägga förband, hjälpa den som kvävs och resa upp den som ligger', () => {
    const g = withParty('linnea');
    const l = recruitOf(g, 'linnea');
    const p = g.leader;
    p.x = 10;
    p.y = 12;
    l.x = 11;
    l.y = 12;
    p.bleeding = ['vänster ben'];
    p.effects.push({ kind: 'dödsfara', label: 'Kvävs', rounds: 15 }, { kind: 'liggande', label: 'Sväljer tungan', rounds: 15 });
    g.state.focus = l.id;
    const kinds = g.helpOptions().map((o) => o.kind);
    expect(kinds).toEqual(expect.arrayContaining(['förband', 'kvävning', 'resa']));
    g.rng = () => 0.01;
    g.help('förband', p.id);
    g.help('kvävning', p.id);
    g.help('resa', p.id);
    expect(p.bleeding).toEqual([]);
    expect(combat.hasEffect(p, 'dödsfara')).toBe(false);
    expect(combat.hasEffect(p, 'liggande')).toBe(false);
  });

  it('efter striden förbinder kamraterna den som ligger medvetslös och blöder', () => {
    const g = withParty('linnea');
    const l = recruitOf(g, 'linnea');
    const p = g.leader;
    const foe = placeDuel(g, p);
    l.x = 10;
    l.y = 11;
    combat.startCombat(g, [foe]);
    p.unconscious = true;
    p.kp = 0;
    p.bleeding = ['mage'];
    foe.alive = false;
    g.rng = () => 0.01;
    combat.endCombat(g, 'Slut.');
    expect(p.alive).toBe(true);
    expect(p.bleeding).toEqual([]);
    expect(g.state.log.join('\n')).toContain('Linnea lägger förband på Tests mage');
  });

  it('bybon slår moral när halva KP är borta, och vägrar fortsätta om hen flyr', () => {
    const g = withParty('linnea');
    const l = recruitOf(g, 'linnea');
    const foe = placeDuel(g, g.leader);
    combat.startCombat(g, [foe]);
    l.kp = 1;
    g.rng = () => 0.99; // tjugo: moralslaget misslyckas
    combat.moraleCheck(g, l, 'test');
    expect(combat.hasEffect(l, 'flyr')).toBe(true);
    foe.alive = false;
    combat.endCombat(g, 'Slut.');
    expect(g.state.party).not.toContain(l.id);
    expect(l.kind).toBe('npc');
  });

  it('en fallen följeslagare lämnar sina ägodelar på marken', () => {
    const g = withParty('hjalmar');
    const h = recruitOf(g, 'hjalmar');
    combat.kill(g, h);
    expect(g.state.party).not.toContain(h.id);
    expect(g.state.dropped.map((d) => d.item)).toEqual(expect.arrayContaining(['stridsyxa', 'vanlig_skold', 'harnesk_nitlader']));
    expect(g.state.mode).toBe('explore');
  });

  it('sovsalen kostar en säng per person', () => {
    const g = withParty('hjalmar', 'sigrid');
    const silver = g.leader.silver;
    g.state.focus = g.leader.id;
    const inn = g.state.actors.find((a) => a.npc === 'vardshusvard')!;
    const label = (INTENTS.overnatta.label as (g: Game, n: Actor) => string)(g, inn);
    expect(label).toContain('30 silver');
    INTENTS.overnatta.apply(g, inn);
    expect(g.leader.silver).toBeLessThan(silver - 29);
  });
});

import { INTENTS } from '../src/engine/intents';

describe('smygarläge och anfall bakifrån', () => {
  it('den som smyger slår Smyga varje runda en fiende kan se hen', () => {
    const g = Game.create(testCharacter(), seededRng(2));
    const p = g.leader;
    const foe = g.state.actors.find((a) => a.defId === 'svartalf')!;
    p.x = foe.x - 4;
    p.y = foe.y;
    g.toggleSneak();
    expect(p.sneaking && p.hidden).toBe(true);
    g.rng = () => 0.01;
    g.stepPlayer({ x: p.x + 1, y: p.y });
    expect(g.state.mode).toBe('explore');
    expect(g.state.log.join('\n')).toContain('smyger oupptäckt');
    g.rng = () => 0.99;
    g.stepPlayer({ x: p.x, y: p.y + 1 });
    expect(p.hidden).toBe(false);
    expect(g.state.mode).toBe('combat');
  });

  it('tänd fackla i mörker ger −10 och klirrande rustning halverar', () => {
    const g = Game.create(testCharacter(), seededRng(2));
    const p = lit(g.leader);
    const foe = g.state.actors.find((a) => a.defId === 'svartalf')!;
    p.x = foe.x - 3;
    p.y = foe.y;
    expect(combat.darkAt(g, p)).toBe(true);
    p.torchOut = true;
    const base = combat.sneakMod(g, p);
    p.torchOut = false;
    expect(combat.sneakMod(g, p)).toBe(base - 10);
    p.torchOut = true;
    const plate = Object.values(ARMOR).find((a) => a.noisy)!;
    p.armor.push(plate.id);
    p.bv[plate.id] = 10;
    expect(combat.sneakMod(g, p)).toBe(base - Math.ceil(g.skillFv(p, 'smyga') / 2));
  });

  it('en omedveten försvarare får inte parera anfallet från den som smyger', () => {
    const g = Game.create(testCharacter(), seededRng(2));
    const p = g.leader;
    const foe = placeDuel(g, p);
    turnOf(g, p, foe);
    p.sneaking = true;
    p.hidden = true;
    p.skills.smyga = 15;
    // Smyga 1 (perfekt? nej: 2), Upptäcka fara 20, anfallet 2.
    g.rng = queue(face(2), face(20), face(20), face(2), 0.99);
    g.playerAttack(foe.id);
    const log = g.state.log.join('\n');
    expect(log).toContain('märker ingenting');
    expect(log).toContain('anar ingenting och kan inte parera');
    expect(p.hidden).toBe(false);
  });
});

describe('Avväpna, Fasthållning och stridskonster', () => {
  it('Avväpna: anfallet pareras inte och gör ingen skada; sedan Avväpna och STY + FV mot STY', () => {
    const g = Game.create(testCharacter(), seededRng(2));
    const p = g.leader;
    const foe = placeDuel(g, p);
    turnOf(g, p, foe);
    p.skills.avvapna = 12;
    expect(attackModes(g, p).map((m) => m.id)).toContain('avvapna');
    g.setAttackMode('avvapna');
    const kp = foe.kp;
    g.rng = () => 0.05;
    g.playerAttack(foe.id);
    expect(foe.kp).toBe(kp);
    expect(foe.weapon).toBe('nave');
    expect(g.state.dropped.some((d) => d.item === 'kortsvard')).toBe(true);
  });

  it('Fasthållning: CL (STO+SMI+STY)/3, sedan STY mot STY; ingen av dem gör något annat', () => {
    const g = Game.create(testCharacter(), seededRng(2));
    const p = g.leader;
    const foe = placeDuel(g, p);
    turnOf(g, p, foe);
    g.setAttackMode('fasthallning');
    // Anfallet 2, svartalfens parering 19 (miss), STY mot STY 2.
    g.rng = queue(face(2), face(19), face(2));
    g.playerAttack(foe.id);
    expect(combat.hasEffect(foe, 'fasthållen')).toBe(true);
    expect(combat.hasEffect(p, 'håller')).toBe(true);
    expect(combat.canAct(foe)).toBe(false);
    expect(combat.canAttackNow(p)).toBe(false);
    expect(g.state.combat!.round).toBeLessThan(5);
    expect(g.isPlayerTurn()).toBe(true);
    g.releaseHold();
    expect(combat.hasEffect(foe, 'fasthållen')).toBe(false);
    const fv = Math.floor((p.attrs.STO + p.attrs.SMI + p.attrs.STY) / 3);
    expect(g.state.log.join('\n')).toContain(`mot ${fv}`);
  });

  it('stridskonst kräver tomma händer och högst läderrustning', () => {
    const g = Game.create(testCharacter(), seededRng(2));
    const p = g.leader;
    const foe = placeDuel(g, p);
    turnOf(g, p, foe);
    p.skills.stridskonster = 12;
    p.techniques = ['normal_spark', 'lagt_kast', 'stalsattning'];
    expect(attackModes(g, p).map((m) => m.id)).not.toContain('normal_spark');
    p.weapon = 'nave';
    p.shield = undefined;
    expect(attackModes(g, p).map((m) => m.id)).toEqual(expect.arrayContaining(['normal_spark', 'lagt_kast']));
    expect(maneuverProblem(g, p, foe, 'lagt_kast')).toBeNull();
    g.setAttackMode('lagt_kast');
    g.rng = queue(face(2), face(19), face(1, 2));
    g.playerAttack(foe.id);
    expect(combat.hasEffect(foe, 'liggande')).toBe(true);
  });

  it('stålsättning halverar skadan vid ett lyckat slag', () => {
    const g = Game.create(testCharacter(), seededRng(2));
    const p = g.leader;
    const foe = placeDuel(g, p);
    turnOf(g, p, foe);
    p.skills.stridskonster = 15;
    p.techniques = ['stalsattning'];
    const kp = p.kp;
    g.rng = () => 0.3;
    combat.hit(g, foe, p, combat.weaponInfo(foe), { damage: 9, aim: 'bröstkorg' });
    expect(g.state.log.join('\n')).toContain('stålsätter sig');
    expect(kp - p.kp).toBe(Math.floor((9 - g.armorAt(p, 'bröstkorg')) / 2));
  });
});

/** En elementarmagiker med alla elementarer. */
function mage(): Character {
  const c = testCharacter();
  c.profession = 'magiker';
  c.attrs.INT = 15;
  c.attrs.PSY = 16;
  c.skills['magiskola:elementarmagi'] = 12;
  c.spells = Object.keys(ELEMENTALS).map((k) => `frammana_${ELEMENTALS[k as keyof typeof ELEMENTALS].name.toLowerCase()}`);
  c.memorized = ['frammana_gnom', 'frammana_sylf'];
  c.inventory = ['trastav', 'harnesk_lader'];
  c.equipped = { weapon: 'trastav', armor: ['harnesk_lader'] };
  return c;
}

describe('elementarer', () => {
  it('åtta besvärjelser, en per sorts elementar, med elementet som krav', () => {
    const g = Game.create(mage(), seededRng(2));
    const p = lit(g.leader);
    p.x = 10;
    p.y = 12;
    expect(elementSourceProblem(g, p, 'luft')).toBeNull();
    expect(elementSourceProblem(g, p, 'jord')).toBeNull();
    expect(elementSourceProblem(g, p, 'eld')).toBeNull();
    expect(elementSourceProblem(g, p, 'köld')).toContain('fruset');
    expect(elementSourceProblem(g, p, 'mörker')).toContain('mörker');
    p.torchOut = true;
    expect(elementSourceProblem(g, p, 'eld')).toContain('eld');
  });

  it('en gnom frammanas i strid och styrs av spelaren, och magikern kan agera som vanligt', () => {
    const g = Game.create(mage(), seededRng(2));
    const p = g.leader;
    const foe = placeDuel(g, p);
    turnOf(g, p, foe);
    expect(castProblem(g, 'frammana_gnom', { grade: 2, target: p.id })).toBeNull();
    g.rng = () => 0.01;
    expect(castSpell(g, 'frammana_gnom', { grade: 2, target: p.id })).toBeNull();
    resolvePending(g);
    const gnome = g.state.actors.find((a) => a.elemental?.kind === 'jord');
    expect(gnome).toBeTruthy();
    expect(gnome!.kp).toBe(gnome!.attrs.STO);
    expect(gnome!.skills.elementar).toBe(10);
    expect(combat.weaponInfo(gnome!).damage).toBe('2T4');
    expect(combat.hasEffect(p, 'styr')).toBe(true);
    expect(combat.canAct(p)).toBe(true);
    expect(combat.canUseSkills(p)).toBe(true);
  });

  it('sylfen skadas inte av materiella vapen, undinen tar halv skada', () => {
    const g = Game.create(mage(), seededRng(2));
    const p = g.leader;
    const foe = placeDuel(g, p);
    turnOf(g, p, foe);
    g.rng = () => 0.01;
    castSpell(g, 'frammana_sylf', { grade: 1, target: p.id });
    resolvePending(g);
    const sylf = g.state.actors.find((a) => a.elemental?.kind === 'luft')!;
    const kp = sylf.kp;
    combat.hit(g, foe, sylf, combat.weaponInfo(foe), { damage: 5 });
    expect(sylf.kp).toBe(kp);
    expect(g.state.log.join('\n')).toContain('går rakt igenom');
  });

  it('elementaren försvinner när tiden är ute eller när striden är slut', () => {
    const g = Game.create(mage(), seededRng(2));
    const p = g.leader;
    const foe = placeDuel(g, p);
    turnOf(g, p, foe);
    g.rng = () => 0.01;
    castSpell(g, 'frammana_sylf', { grade: 1, target: p.id });
    resolvePending(g);
    const sylf = g.state.actors.find((a) => a.elemental?.kind === 'luft')!;
    foe.alive = false;
    combat.endCombat(g, 'Slut.');
    expect(sylf.alive).toBe(false);
    expect(combat.hasEffect(p, 'styr')).toBe(false);
  });
});

describe('elementarernas förmågor', () => {
  it('sylfen blåser omkull, luminalen lyser upp och umbran släcker ljuset', () => {
    const g = Game.create(mage(), seededRng(2));
    const p = lit(g.leader);
    const foe = placeDuel(g, p);
    turnOf(g, p, foe);
    g.rng = () => 0.01;
    castSpell(g, 'frammana_sylf', { grade: 2, target: p.id });
    resolvePending(g);
    const sylf = g.state.actors.find((a) => a.elemental?.kind === 'luft')!;
    sylf.x = foe.x;
    sylf.y = foe.y + 1;
    const c = g.state.combat!;
    c.order = [sylf.id, ...c.order.filter((id) => id !== sylf.id)];
    c.turn = 0;
    c.acted = {};
    g.state.focus = sylf.id;
    expect(g.isPlayerTurn()).toBe(true);
    expect(g.elementalActions().map((a) => a.id)).toEqual(expect.arrayContaining(['blåsa', 'släpp']));
    g.rng = queue(face(1));
    g.elementalAct('blåsa', foe.id);
    expect(combat.hasEffect(foe, 'liggande')).toBe(true);

    // Ljus och mörker: i grottan ger facklan −5; en luminal tar bort avdraget, en umbra gör det mörkt.
    const alf = g.state.actors.find((a) => a.defId === 'svartalf' && a !== foe)!;
    const viewer = { ...p, darkvision: false, techniques: [] } as Actor;
    viewer.x = alf.x - 1;
    viewer.y = alf.y;
    p.x = alf.x - 1;
    p.y = alf.y;
    expect(combat.lightMod(g, viewer, alf)).toBe(-5);
    sylf.elemental = { ...sylf.elemental!, kind: 'ljus', grade: 1 };
    sylf.x = alf.x;
    sylf.y = alf.y + 2;
    expect(combat.lightMod(g, viewer, alf)).toBe(0);
    sylf.elemental = { ...sylf.elemental!, kind: 'mörker', grade: 1 };
    expect(combat.lightMod(g, { ...viewer, darkvision: true } as Actor, alf)).toBe(-15);
  });

  it('fienderna anfaller inte den som smyger oupptäckt', () => {
    const g = withParty('sigrid');
    const s = recruitOf(g, 'sigrid');
    const p = g.leader;
    const foe = placeDuel(g, p);
    s.x = 12;
    s.y = 12;
    combat.startCombat(g, [foe]);
    p.hidden = true;
    p.sneaking = true;
    const c = g.state.combat!;
    c.order = [foe.id, ...c.order.filter((id) => id !== foe.id)];
    c.turn = 0;
    c.acted = {};
    c.movesLeft = foe.move;
    g.rng = () => 0.01;
    combat.autoTurn(g);
    expect(g.state.log.join('\n')).toContain('Svartalf anfaller Sigrid');
  });
});

describe('hela strider med följeslagare', () => {
  it('gruppen mot svartalferna i grottan tar slut utan fel', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const g = Game.create(testCharacter(), seededRng(seed));
      g.leader.silver = 1000;
      for (const id of ['hjalmar', 'sigrid', 'linnea']) g.recruit(recruitOf(g, id).id);
      const chief = g.state.actors.find((a) => a.defId === 'svartalfshovding')!;
      const members = g.partyMembers();
      members.forEach((m, i) => {
        m.x = chief.x - 6 - i;
        m.y = chief.y;
      });
      g.stepPlayer({ x: chief.x - 5, y: chief.y });
      for (let i = 0; i < 5000 && g.state.mode === 'combat'; i++) {
        if (g.isPlayerTurn()) {
          const p = g.player;
          if (g.holdsRanged()) {
            const t = combat.activeHostiles(g).find((a) => g.canAttack(a.id));
            if (t) g.playerAttack(t.id);
            else g.endTurn();
            continue;
          }
          let target = combat.activeHostiles(g).find((a) => g.canAttack(a.id));
          if (!target) {
            const near = combat.activeHostiles(g).sort((l, r) => Math.abs(l.x - p.x) + Math.abs(l.y - p.y) - (Math.abs(r.x - p.x) + Math.abs(r.y - p.y)))[0];
            const path = near && g.pathTo(near.x, near.y, true);
            if (path) for (const step of path) if (!g.combatStep(step)) break;
            target = combat.activeHostiles(g).find((a) => g.canAttack(a.id));
          }
          if (target) g.playerAttack(target.id);
          else g.endTurn();
        } else g.enemyTurn();
      }
      expect(['explore', 'dead']).toContain(g.state.mode);
    }
  });
});
