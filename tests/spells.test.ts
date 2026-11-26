import { describe, expect, it } from 'vitest';
import * as combat from '../src/engine/combat';
import { seededRng, type Rng } from '../src/engine/dice';
import { Game } from '../src/engine/game';
import { ironProblem } from '../src/engine/inventory';
import { castProblem, castSpell, enemyCast, resolvePending, spellS, spellTargets, wardCheck } from '../src/engine/magic';
import { maxKp } from '../src/engine/rules';
import { isLocked, lockAt, lootChest, lootProblem, pickLock, pickProblem } from '../src/engine/locks';
import { herbChoices } from '../src/engine/worldspells';
import { distance } from '../src/engine/map';
import { dialogDef } from '../src/ai/dialogClient';
import type { Actor, Character } from '../src/engine/types';
import { testCharacter } from './helpers';

/** Slumpkälla som ger talen i tur och ordning och sedan 0,5. */
function queue(...values: number[]): Rng {
  return () => (values.length ? values.shift()! : 0.5);
}
/** Talet som ger `n` på en tärning med `sides` sidor. */
const face = (n: number, sides = 20) => (n - 0.5) / sides;

/** Häxkonstnären mot rollpersonen på vägen, och det är häxkonstnärens tur. */
function witchFight(dist: number): { g: Game; p: Actor; witch: Actor } {
  const g = Game.create(testCharacter(), seededRng(5));
  const p = g.player;
  const witch = g.state.actors.find((a) => a.defId === 'haxkonstnar')!;
  p.x = 10;
  p.y = 12;
  witch.x = 10 + dist;
  witch.y = 12;
  combat.startCombat(g, [witch]);
  const c = g.state.combat!;
  c.round = 1;
  c.order = [witch.id, p.id];
  c.turn = 0;
  c.acted = {};
  c.movesLeft = witch.move;
  witch.movedLast = 0;
  return { g, p, witch };
}

describe('fiender som lägger besvärjelser', () => {
  it('häxkonstnären har sina besvärjelser i minnet och inget järn', () => {
    const { g, p, witch } = witchFight(4);
    expect(witch.spells).toEqual(['blixt', 'skold', 'hela']);
    expect(witch.skills['magiskola:elementarmagi']).toBe(14);
    expect(ironProblem(g, witch)).toBeNull();
    // S för BLIXT: 14 − 6 + 3 (INT 14).
    expect(spellS(witch, 'blixt')).toBe(11);
    expect(spellTargets(g, 'blixt', 0, witch)).toEqual([p]);
    expect(castProblem(g, 'blixt', { grade: 1, target: p.id, caster: witch })).toBeNull();
    // Gruppens magiker kan inte lägga hennes besvärjelser.
    expect(castProblem(g, 'blixt', { grade: 1, target: witch.id })).toMatch(/kan inte den besvärjelsen/);
  });

  it('på håll slår hon med BLIXT, och E väljs så att CL blir minst 8', () => {
    const { g, p, witch } = witchFight(4);
    const kp = p.kp;
    // E3 (S 11 − 2 = CL 9): T20 2 lyckas, skadan 3T6 blir 2 + 3 + 4.
    g.rng = queue(face(2), face(2, 6), face(3, 6), face(4, 6));
    combat.autoTurn(g);
    expect(witch.psy).toBe(16 - 3);
    expect(p.kp).toBe(kp - 9);
    expect(g.state.log.join('\n')).toContain('BLIXT E3');
  });

  it('när någon står intill lägger hon SKÖLD en gång och slåss sedan', () => {
    const { g, witch } = witchFight(1);
    g.rng = queue(face(2));
    combat.autoTurn(g);
    expect(combat.hasEffect(witch, 'luftsköld')).toBe(true);
    // Nästa tur: SKÖLD är redan lagd i striden.
    witch.effects = witch.effects.filter((e) => e.kind !== 'luftsköld');
    const c = g.state.combat!;
    c.turn = 0;
    c.order = [witch.id, g.player.id];
    c.acted = {};
    expect(enemyCast(g, witch)).toBe(false);
  });

  it('svårt skadad börjar hon mana HELA, och en träff bryter koncentrationen', () => {
    const { g, p, witch } = witchFight(4);
    witch.kp = Math.floor(witch.maxKp / 2);
    combat.autoTurn(g);
    const c = g.state.combat!;
    expect(c.pending).toHaveLength(1);
    expect(c.pending![0]).toMatchObject({ caster: witch.id, spell: 'hela', target: witch.id });
    expect(g.state.log.join('\n')).toContain('börjar mana HELA');
    const psy = witch.psy;
    combat.wound(g, witch, 1, null);
    expect(c.pending).toHaveLength(0);
    expect(witch.psy).toBe(psy - 1);
    expect(p.alive).toBe(true);
  });

  it('hon sparar alltid PSY till en E1 och tar aldrig PSY till 0', () => {
    const { g, witch } = witchFight(4);
    witch.psy = 3;
    g.rng = queue(face(2));
    combat.autoTurn(g);
    expect(g.state.log.join('\n')).toContain('BLIXT E1');
    expect(witch.psy).toBe(2);
    const next = witchFight(4);
    next.witch.psy = 2;
    expect(enemyCast(next.g, next.witch)).toBe(false);
  });
});

/** En magiker med alla tre skolorna på FV 14 och de besvärjelser som provas här. Inget järn. */
function allRounder(): Character {
  const c = testCharacter();
  c.profession = 'magiker';
  c.attrs.INT = 15;
  c.attrs.PSY = 18;
  c.skills['magiskola:animism'] = 14;
  c.skills['magiskola:elementarmagi'] = 14;
  c.skills['magiskola:mentalism'] = 14;
  c.spells = ['oka', 'minska', 'kamouflage', 'flammande_hand', 'virvelskold', 'ljus', 'morker', 'motstandskraft', 'magisk_syn', 'osynlighet', 'antimagi', 'eld', 'vindpil', 'astralvapen', 'sprang', 'levitation', 'flyga', 'lyft', 'teleportera', 'dimma', 'beskyddare', 'kontrollera_person', 'kontrollera_varelse', 'oppna', 'forsegla', 'finna_vatten', 'varseblivning', 'vaxtkunskap', 'traeld', 'laga', 'vattenandning', 'syn', 'tala_med_varelse', 'telepati', 'tankelasning', 'tillkalla_varelse'];
  c.memorized = [...c.spells];
  c.inventory = ['trastav', 'harnesk_lader'];
  c.equipped = { weapon: 'trastav', armor: ['harnesk_lader'] };
  return c;
}

/** Utforskning med magikern på vägen och en fiende (inte i strid). */
function explore(defId = 'svartalf', dist = 3): { g: Game; p: Actor; foe: Actor } {
  const g = Game.create(allRounder(), seededRng(9));
  const p = g.player;
  p.psy = 18;
  const foe = g.state.actors.find((a) => a.defId === defId)!;
  p.x = 10;
  p.y = 12;
  foe.x = 10 + dist;
  foe.y = 12;
  foe.hostile = false;
  g.updateFov();
  return { g, p, foe };
}

describe('besvärjelser i strid', () => {
  it('ÖKA STO ger KP medan den varar, och förlorade KP står kvar när den tar slut', () => {
    const { g, p } = explore();
    const before = p.maxKp;
    const sto = p.attrs.STO;
    const gain = maxKp({ FYS: p.attrs.FYS, STO: sto + 2 }) - maxKp(p.attrs);
    g.rng = queue(face(2));
    expect(castSpell(g, 'oka', { grade: 2, target: p.id, attr: 'STO' })).toBeNull();
    expect(p.attrs.STO).toBe(sto + 2);
    expect(p.maxKp).toBe(before + gain);
    combat.wound(g, p, 3, 'bröstkorg');
    const kp = p.kp;
    g.sleep(1);
    expect(p.attrs.STO).toBe(sto);
    expect(p.maxKp).toBe(before);
    expect(p.kp).toBe(kp - gain);
  });

  it('ÖKA SMI ändrar baschansen för SMI-färdigheter, och MINSKA sänker en fiendes STY', () => {
    const { g, p, foe } = explore('svartalf', 1);
    const smyga = combat.skillMod(g, p, 'smyga');
    // SMI 12 → 13 ger baschans 3 i stället för 2.
    g.rng = queue(face(2));
    castSpell(g, 'oka', { grade: 1, target: p.id, attr: 'SMI' });
    expect(combat.skillMod(g, p, 'smyga')).toBe(smyga + 1);
    const sty = foe.attrs.STY;
    g.rng = queue(face(2));
    castSpell(g, 'minska', { grade: 3, target: foe.id, attr: 'STY' });
    expect(foe.attrs.STY).toBe(sty - 3);
    expect(foe.hostile).toBe(true);
  });

  it('FLAMMANDE HAND ger 1T3 per E på anfall med vapen i handen', () => {
    const { g, p, foe } = explore('svartalf', 1);
    g.rng = queue(face(2));
    castSpell(g, 'flammande_hand', { grade: 2, target: p.id });
    expect(combat.hasEffect(p, 'flammandeHand')).toBe(true);
    g.rng = queue(face(3, 3), face(3, 3), face(3, 6), face(10));
    combat.hit(g, p, foe, combat.weaponInfo(p), {});
    expect(g.state.log.join('\n')).toContain('Den flammande handen bränner: +6');
  });

  it('VIRVELSKÖLD stöter bort pilar', () => {
    const { g, p } = explore();
    g.rng = queue(face(2));
    castSpell(g, 'virvelskold', { grade: 1 });
    const skytt = g.state.actors.find((a) => a.defId === 'svartalf_skytt')!;
    skytt.x = 15;
    skytt.y = 12;
    const kp = p.kp;
    combat.shoot(g, skytt, p);
    expect(p.kp).toBe(kp);
    expect(g.state.log.join('\n')).toContain('virvelskölden');
  });

  it('MOTSTÅNDSKRAFT tar 1 per E av skadan från ELD', () => {
    const { g, foe } = explore();
    foe.hostile = true;
    foe.effects.push({ kind: 'motståndskraft', label: 'MOTSTÅNDSKRAFT E3', grade: 3, spell: 'motstandskraft', rounds: 100 });
    const kp = foe.kp;
    // ELD E2: T20 2 lyckas, 2T6 blir 4 + 4 = 8, minus 3.
    g.rng = queue(face(2), face(4, 6), face(4, 6));
    expect(castSpell(g, 'eld', { grade: 2, target: foe.id })).toBeNull();
    expect(foe.kp).toBe(kp - 5);
  });

  it('ANTIMAGI får en BLIXT att studsa tillbaka på häxkonstnären', () => {
    const { g, p, witch } = witchFight(4);
    p.effects.push({ kind: 'antimagi', label: 'ANTIMAGI E6', grade: 6, spell: 'antimagi', rounds: 100 });
    const kp = witch.kp;
    const pkp = p.kp;
    // BLIXT E3 lyckas (2), E3 mot E6 ger 7: 20 misslyckas, skadan 3T6 blir 1 + 1 + 1.
    g.rng = queue(face(2), face(20), face(20), face(1, 6), face(1, 6), face(1, 6));
    combat.autoTurn(g);
    expect(g.state.log.join('\n')).toContain('studsar');
    expect(witch.kp).toBe(kp - 3);
    expect(p.kp).toBe(pkp);
  });

  it('MÖRKER släcker facklorna i sfären, och LJUS lyser som en fackla', () => {
    const { g, p, foe } = explore('svartalf', 6);
    expect(combat.darkAt(g, foe)).toBe(false);
    g.rng = queue(face(2));
    expect(castSpell(g, 'morker', { grade: 1, target: foe.id })).toBeNull();
    expect(combat.darkAt(g, foe)).toBe(true);
    expect(combat.darkAt(g, p)).toBe(false);
    // Gruppens fackla lyser inte in i mörkret.
    p.x = foe.x - 1;
    expect(combat.torchLit(g, foe)).toBe(false);
    // Mörkret går över.
    g.sleep(1);
    expect(combat.darkAt(g, foe)).toBe(false);
    p.x = 10;
    p.torchOut = true;
    expect(combat.torchLit(g, foe)).toBe(false);
    g.rng = queue(face(2));
    expect(castSpell(g, 'ljus', { grade: 2, target: foe.id })).toBeNull();
    expect(combat.torchLit(g, { x: foe.x + 3, y: foe.y })).toBe(true);
    expect(combat.torchLit(g, { x: foe.x + 5, y: foe.y })).toBe(false);
  });

  it('OSYNLIGHET: fienden ser inte magikern förrän hen skadas, utom med MAGISK SYN', () => {
    const { g, p, witch } = witchFight(4);
    // Rollpersonen lägger bort järnet och lär sig OSYNLIGHET.
    g.char.spells = ['osynlighet'];
    g.char.memorized = ['osynlighet'];
    g.char.inventory = [];
    p.skills['magiskola:mentalism'] = 14;
    p.weapon = 'nave';
    p.shield = undefined;
    p.armor = [];
    p.psy = 10;
    const c = g.state.combat!;
    c.order = [p.id, witch.id];
    c.turn = 0;
    // 6 STO per E: E1 räcker inte för rollpersonens STO, E3 gör det.
    expect(castProblem(g, 'osynlighet', { grade: 1, target: p.id })).toMatch(/Det krävs E/);
    resolveNow(g, () => castSpell(g, 'osynlighet', { grade: 3, target: p.id }));
    expect(p.hidden).toBe(true);
    expect(spellTargets(g, 'blixt', 0, witch)).toEqual([]);
    witch.effects.push({ kind: 'magiskSyn', label: 'MAGISK SYN', rounds: 10 });
    expect(spellTargets(g, 'blixt', 0, witch)).toEqual([p]);
    combat.wound(g, p, 1, null);
    expect(p.hidden).toBe(false);
  });

  it('KAMOUFLAGE verkar bara utomhus och bryts när magikern flyttar sig', () => {
    const { g, p } = explore();
    g.rng = queue(face(2));
    expect(castSpell(g, 'kamouflage', { grade: 1 })).toBeNull();
    expect(p.hidden).toBe(true);
    p.x += 1;
    combat.tick(g, p);
    expect(p.hidden).toBe(false);
    const chief = g.state.actors.find((a) => a.defId === 'svartalfshovding')!;
    p.x = chief.x - 1;
    p.y = chief.y;
    expect(castProblem(g, 'kamouflage', { grade: 1 })).toMatch(/ute i naturen/);
  });
});

describe('skada på totala KP och de nya värdena', () => {
  it('skada utan kroppsdel fördelas jämnt över kroppsdelarna, och resten går till dem med flest KP', () => {
    const { g, p } = explore();
    const before = { ...p.locKp };
    // 10 i skada på sju kroppsdelar: 1 var, och 3 till de tre med flest KP.
    const extra = [...combat.spreadDamage(p, 10)].filter(([, d]) => d === 2).map(([l]) => l);
    expect(extra).toHaveLength(3);
    const top = Object.entries(before).sort((x, y) => y[1] - x[1])[2][1];
    for (const l of extra) expect(before[l]).toBeGreaterThanOrEqual(top);
    combat.wound(g, p, 10, null);
    const lost = Object.keys(before).reduce((n, l) => n + before[l as keyof typeof before] - p.locKp[l as keyof typeof before], 0);
    expect(lost).toBe(10);
    // Skadan står kvar när tiden går, eftersom kroppsdelarna inte är läkta.
    g.sleep(1);
    expect(p.kp).toBeLessThan(p.maxKp);
  });

  it('blödningen fördelas inte, och fördelad skada ger ingen blödning', () => {
    const { g, p } = explore();
    const before = { ...p.locKp };
    combat.wound(g, p, 2, null, false);
    expect(p.locKp).toEqual(before);
    // Så mycket att huvudet går till 0: det blöder inte.
    p.kp = 200;
    combat.wound(g, p, before.huvud * 7, null);
    expect(p.locKp.huvud).toBeLessThanOrEqual(0);
    expect(p.bleeding).toEqual([]);
  });

  it('VINDPIL gör 1T10 + 1 per E, och VIRVELSKÖLD stöter bort den', () => {
    const { g, p, foe } = explore('svartalf', 3);
    foe.hostile = true;
    const kp = foe.kp;
    // VINDPIL E3 lyckas (2), skadan 1T10 + 3 blir 7 + 3 och träffområdet slås (10). Svartalfen har ingen rustning.
    g.rng = queue(face(2), face(7, 10), face(10));
    expect(castSpell(g, 'vindpil', { grade: 3, target: foe.id })).toBeNull();
    expect(foe.kp).toBe(kp - 10);
    foe.effects.push({ kind: 'virvelsköld', label: 'VIRVELSKÖLD', rounds: 10 });
    g.rng = queue(face(2));
    castSpell(g, 'vindpil', { grade: 1, target: foe.id });
    expect(foe.kp).toBe(kp - 10);
    expect(g.state.log.join('\n')).toContain('Virvelskölden stöter bort VINDPIL');
    expect(p.alive).toBe(true);
  });

  it('ASTRALVAPEN: 1T10 med en hand (E2) och 2T10 med två (E4), med FV lika med S', () => {
    const { g, p } = explore();
    expect(castProblem(g, 'astralvapen', { grade: 1, hands: 1 })).toMatch(/kräver E2/);
    expect(castProblem(g, 'astralvapen', { grade: 3, hands: 2 })).toMatch(/kräver E4/);
    g.rng = queue(face(2));
    expect(castSpell(g, 'astralvapen', { grade: 2, hands: 1 })).toBeNull();
    const w = combat.weaponInfo(p);
    expect(w).toMatchObject({ id: 'astralvapen', damage: '1T10', twoHanded: false, magical: true });
    // S: Elementarmagi 14 − 10 + 3.
    expect(g.skillFv(p, 'astralvapen')).toBe(7);
    g.rng = queue(face(2));
    castSpell(g, 'astralvapen', { grade: 4, hands: 2 });
    expect(combat.weaponInfo(p).damage).toBe('2T10');
    expect(p.effects.filter((e) => e.kind === 'astralvapen')).toHaveLength(1);
    g.sleep(1);
    expect(combat.weaponInfo(p).id).toBe('trastav');
  });
});

describe('rörelse, zoner och kontroll', () => {
  it('SPRÅNG: 4 m per E, över en fiende, med SMI-slag vid landningen', () => {
    const { g, p, foe } = explore('svartalf', 1);
    expect(castProblem(g, 'sprang', { grade: 1, target: p.id, at: { x: 13, y: 12 } })).toMatch(/1–2 rutor/);
    // E2 räcker 5 rutor. SPRÅNG är kvickt: slaget (2) och SMI-slaget (3).
    g.rng = queue(face(2), face(3));
    expect(castSpell(g, 'sprang', { grade: 2, target: p.id, at: { x: 13, y: 12 } })).toBeNull();
    expect([p.x, p.y]).toEqual([13, 12]);
    expect(foe.x).toBe(11);
    expect(combat.hasEffect(p, 'liggande')).toBe(false);
    // Inte genom ett träd.
    expect(castProblem(g, 'sprang', { grade: 3, target: p.id, at: { x: 13, y: 16 } })).toMatch(/träd|ledig/);
  });

  it('LEVITATION: bara långa vapen når den som svävar, och den som svävar står still', () => {
    const { g, p, foe } = explore('svartalf', 1);
    g.rng = queue(face(2));
    expect(castSpell(g, 'levitation', { grade: 1 })).toBeNull();
    expect(combat.inReach(g, foe, p)).toBe(false);
    expect(combat.inReach(g, p, foe)).toBe(false);
    expect(combat.effectiveMove(p, g)).toBe(0);
    g.land();
    expect(combat.inReach(g, foe, p)).toBe(true);
  });

  it('FLYGA: E × 5 rutor per runda och över vattnet', () => {
    const { g, p } = explore();
    g.rng = queue(face(2));
    expect(castSpell(g, 'flyga', { grade: 2, target: p.id })).toBeNull();
    expect(combat.effectiveMove(p, g)).toBe(10);
    // Över dammen söder om vägen.
    p.x = 8;
    p.y = 13;
    expect(g.pathTo(8, 15)).not.toBeNull();
    p.x = 8;
    p.y = 15;
    g.land();
    expect(g.map.tiles[p.y * g.map.w + p.x]).not.toBe('~');
  });

  it('LYFT flyttar en ovillig fiende som förlorar STY-slaget', () => {
    const { g, p, foe } = explore('svartalf', 2);
    foe.hostile = true;
    // Svartalfen har STO 7: E3 krävs, och E4 ger tre rutor.
    expect(castProblem(g, 'lyft', { grade: 2, target: foe.id, at: { x: 14, y: 12 } })).toMatch(/E3/);
    g.rng = queue(face(2), face(1));
    expect(castSpell(g, 'lyft', { grade: 4, target: foe.id, at: { x: 15, y: 12 } })).toBeNull();
    expect([foe.x, foe.y]).toEqual([15, 12]);
    expect(p.alive).toBe(true);
  });

  it('TELEPORTERA går bara till en plats man känner till', () => {
    const { g, p } = explore();
    expect(castProblem(g, 'teleportera', { grade: 5, target: p.id, at: { x: 10, y: 12 + 1 } })).toBeNull();
    expect(castProblem(g, 'teleportera', { grade: 5, target: p.id, at: { x: 40, y: 15 } })).toMatch(/känner till/);
    // S är bara 5 med Mentalism 14 (skolvärde 12), så magikern behöver mer FV för E5.
    p.skills['magiskola:mentalism'] = 18;
    g.rng = queue(face(2));
    expect(castSpell(g, 'teleportera', { grade: 5, target: p.id, at: { x: 14, y: 12 } })).toBeNull();
    expect([p.x, p.y]).toEqual([14, 12]);
  });

  it('DIMMA kräver vatten och skymmer sikten bortom 10 rutor', () => {
    const { g, p, foe } = explore('svartalf', 3);
    foe.sight = 20;
    foe.x = 22;
    foe.y = 12;
    expect(g.canSee(foe, p)).toBe(true);
    g.rng = queue(face(2));
    expect(castSpell(g, 'dimma', { grade: 1, target: p.id })).toBeNull();
    expect(g.canSee(foe, p)).toBe(false);
    // Långt från vattnet går det inte.
    p.x = 38;
    p.y = 12;
    expect(castProblem(g, 'dimma', { grade: 1, target: p.id })).toMatch(/vatten/);
  });

  it('BESKYDDARE: den som går in träffas av en energistråle, och magi utifrån möter ANTIMAGI E1', () => {
    const { g, p, foe } = explore('svartalf', 3);
    g.rng = queue(face(2));
    expect(castSpell(g, 'beskyddare', { grade: 1 })).toBeNull();
    const kp = foe.kp;
    foe.x = 11;
    g.rng = queue(face(3, 3), face(10));
    wardCheck(g);
    expect(foe.kp).toBe(kp - 3);
    // Magikern själv kan gå ut och in.
    p.x = 13;
    wardCheck(g);
    p.x = 10;
    wardCheck(g);
    expect(p.kp).toBe(p.maxKp);
  });

  it('KONTROLLERA PERSON: svartalfen slåss för gruppen tills besvärjelsen tar slut', () => {
    const { g, p, witch } = witchFight(3);
    const alf = g.state.actors.find((a) => a.defId === 'svartalf')!;
    alf.x = 12;
    alf.y = 12;
    witch.x = 14;
    // Rollpersonen tar kontroll över svartalfen.
    g.char.spells = ['kontrollera_person'];
    g.char.memorized = ['kontrollera_person'];
    g.char.inventory = [];
    p.skills['magiskola:mentalism'] = 14;
    p.weapon = 'nave';
    p.shield = undefined;
    p.armor = [];
    p.psy = 18;
    const c = g.state.combat!;
    c.order = [p.id, alf.id, witch.id];
    c.turn = 0;
    // Läggs nu och verkar nästa runda: slaget (2) och PSY 18 mot svartalfens 11 (1).
    expect(castSpell(g, 'kontrollera_person', { grade: 1, target: alf.id })).toBeNull();
    g.rng = queue(face(2), face(1));
    resolvePending(g);
    expect(alf.hostile).toBe(false);
    expect(combat.activeHostiles(g)).not.toContain(alf);
    // Svartalfen går på häxkonstnären på sin tur.
    c.order = [alf.id, witch.id, p.id];
    c.turn = 0;
    c.acted = {};
    c.movesLeft = alf.move;
    combat.autoTurn(g);
    expect(g.state.log.join('\n')).toMatch(/Svartalf.*Svartalfisk häxkonstnär/);
    const ctl = alf.effects.find((e) => e.kind === 'kontrollerad')!;
    combat.endSpellEffect(g, alf, ctl);
    expect(alf.hostile).toBe(true);
  });
});

describe('varelsebesvärjelserna', () => {
  it('KONTROLLERA VARELSE gäller ointelligenta djur, KONTROLLERA PERSON bara personer', () => {
    const { g, p, foe } = explore('varg', 3);
    foe.hostile = true;
    const alf = g.state.actors.find((a) => a.defId === 'svartalf')!;
    alf.x = 10;
    alf.y = 13;
    alf.hostile = true;
    g.updateFov();
    expect(castProblem(g, 'kontrollera_person', { grade: 1, target: foe.id })).toMatch(/bara på personer/);
    expect(castProblem(g, 'kontrollera_varelse', { grade: 1, target: alf.id })).toMatch(/ointelligenta djur/);
    expect(castProblem(g, 'kontrollera_varelse', { grade: 1, target: foe.id })).toBeNull();
    // Slaget (2) och PSY mot vargens PSY (1).
    g.rng = queue(face(2), face(1));
    expect(castSpell(g, 'kontrollera_varelse', { grade: 1, target: foe.id })).toBeNull();
    expect(foe.hostile).toBe(false);
    expect(foe.effects.some((e) => e.kind === 'kontrollerad' && e.by === p.id)).toBe(true);
  });
});

describe('lås och besvärjelser utanför strid', () => {
  /** Magikern intill Grukks kista i grottan, utan fiender i närheten. */
  function atChest() {
    const r = explore();
    const { g, p } = r;
    for (const a of g.state.actors) if (a !== p && a.hostile) a.alive = false;
    const chest = g.map.locks.find((l) => l.kind === 'kista')!;
    p.x = chest.x - 1;
    p.y = chest.y;
    g.updateFov();
    return { ...r, chest };
  }

  it('Grukks kista är låst: den står i vägen och kan dyrkas upp och tömmas', () => {
    const { g, p, chest } = atChest();
    expect(g.blocked(chest.x, chest.y)).toBe(true);
    const l = lockAt(g, chest.x, chest.y)!;
    expect(isLocked(l)).toBe(true);
    expect(pickProblem(g, p, l)).toMatch(/dyrka lås|dyrkar/);
    p.skills.lasdyrkning = 15;
    g.char.inventory.push('dyrkar_sma');
    expect(lootProblem(g, p, l)).toMatch(/stängd/);
    // Differensvärdet 15 − 2 = 13 räcker för svårighetsgraden 12.
    g.rng = queue(face(2));
    expect(pickLock(g, p, l)).toBeNull();
    expect(isLocked(l)).toBe(false);
    const silver = g.leader.silver;
    expect(lootChest(g, p, l)).toBeNull();
    expect(g.leader.silver).toBeGreaterThan(silver);
    expect(g.char.inventory).toContain('oljelykta');
    expect(lootProblem(g, p, l)).toMatch(/tom/);
  });

  it('ÖPPNA öppnar låset, och FÖRSEGLA stänger en dörr tills ÖPPNA övervinner den', () => {
    const { g, p, chest } = atChest();
    g.rng = queue(face(2));
    expect(castSpell(g, 'oppna', { grade: 1, at: { x: chest.x, y: chest.y } })).toBeNull();
    expect(isLocked(lockAt(g, chest.x, chest.y)!)).toBe(false);
    // Värdshusets dörr.
    p.x = 5;
    p.y = 7;
    expect(g.blocked(5, 6)).toBe(false);
    g.rng = queue(face(2));
    expect(castSpell(g, 'forsegla', { grade: 3, at: { x: 5, y: 6 } })).toBeNull();
    expect(g.blocked(5, 6)).toBe(true);
    // E1 mot E3: 20 misslyckas.
    g.rng = queue(face(2), face(20), face(20));
    castSpell(g, 'oppna', { grade: 1, at: { x: 5, y: 6 } });
    expect(g.blocked(5, 6)).toBe(true);
    g.rng = queue(face(2), face(1));
    castSpell(g, 'oppna', { grade: 1, at: { x: 5, y: 6 } });
    expect(g.blocked(5, 6)).toBe(false);
  });

  it('FINNA VATTEN och VARSEBLIVNING ger riktning och avstånd', () => {
    const { g, p } = explore();
    p.x = 9;
    p.y = 12;
    g.rng = queue(face(2));
    expect(castSpell(g, 'finna_vatten', { grade: 1 })).toBeNull();
    expect(g.state.log.join('\n')).toMatch(/känner vatten 3 meter åt söder/);
    g.rng = queue(face(2));
    expect(castSpell(g, 'varseblivning', { grade: 2, seek: 'utgång' })).toBeNull();
    expect(g.state.log.join('\n')).toMatch(/förnimmer utgångar: Vägen västerut \d+ m åt väster/);
  });

  it('VÄXTKUNSKAP hittar en ört i närheten på en timme, utan slag', () => {
    const { g, p } = explore();
    for (const a of g.state.actors) if (a !== p && a.hostile) a.alive = false;
    const herb = herbChoices(g)[0];
    const before = g.char.herbs.length;
    const t = g.state.time;
    // Slaget (2) och 1T4 doser (3).
    g.rng = queue(face(2), face(3, 4));
    expect(castSpell(g, 'vaxtkunskap', { grade: 1, herb })).toBeNull();
    expect(g.char.herbs.length).toBe(before + 3);
    expect(g.char.herbs.slice(-3).every((d) => d.id === herb)).toBe(true);
    expect(g.state.time - t).toBeGreaterThanOrEqual(3600);
  });

  it('TRÄELD tänder facklan, och VATTENANDNING låter en gå ut i vattnet', () => {
    const { g, p } = explore();
    p.torchOut = true;
    const torches = g.char.inventory.filter((x) => x === 'fackla').length;
    g.rng = queue(face(2));
    expect(castSpell(g, 'traeld', { grade: 1, target: p.id })).toBeNull();
    expect(p.torchOut).toBe(false);
    expect(g.char.inventory.filter((x) => x === 'fackla').length).toBe(torches + 1);
    p.x = 8;
    p.y = 13;
    expect(g.pathTo(9, 15)).toBeNull();
    g.rng = queue(face(2));
    expect(castSpell(g, 'vattenandning', { grade: 1, target: p.id })).toBeNull();
    expect(g.pathTo(9, 15)).not.toBeNull();
  });

  it('SYN visar modulens scen, och annars ingenting särskilt', () => {
    const { g, p } = explore();
    g.rng = queue(face(2));
    expect(castSpell(g, 'syn', { grade: 1 })).toBeNull();
    expect(g.state.log.join('\n')).toContain('I synen ser du grottan österut');
    expect(g.state.flags.syn_grukk).toBe(true);
    g.state.flags.hovding_dod = true;
    g.rng = queue(face(2));
    castSpell(g, 'syn', { grade: 1 });
    expect(g.state.log.join('\n')).toMatch(/ingenting särskilt/);
    expect(p.alive).toBe(true);
  });

  it('TILLKALLA VARELSE: vargarna kommer, följer med och går att tala med genom TALA MED VARELSE', () => {
    const { g, p } = explore();
    for (const a of g.state.actors) if (a.defId !== 'varg' && a !== p && a.hostile) a.alive = false;
    const wolves = g.state.actors.filter((a) => a.defId === 'varg' && a.alive);
    expect(wolves.length).toBeGreaterThan(0);
    g.rng = queue(face(2), face(3, 10));
    expect(castSpell(g, 'tillkalla_varelse', { grade: 1 })).toBeNull();
    // 20 STO per E: två vargar med STO 7.
    const come = wolves.filter((w) => w.effects.some((e) => e.kind === 'kontrollerad'));
    expect(come.length).toBe(2);
    for (const w of come) expect(w.hostile).toBe(false);
    expect(g.canTalk(come[0])).toBe(false);
    g.rng = queue(face(2));
    expect(castSpell(g, 'tala_med_varelse', { grade: 3 })).toBeNull();
    expect(g.canTalk(come[0])).toBe(true);
    expect(dialogDef(come[0]).persona).toMatch(/djur/);
    // De går efter gruppen.
    g.stepPlayer({ x: p.x + 1, y: p.y });
    g.stepPlayer({ x: p.x + 1, y: p.y });
    for (const w of come) expect(distance(w.x, w.y, p.x, p.y)).toBeLessThanOrEqual(3);
  });

  it('TELEPATI öppnar ett samtal med en känd person, och TANKELÄSNING läggs på magikern', () => {
    const { g, p } = explore();
    const asta = g.state.actors.find((a) => a.npc === 'gumma')!;
    expect(castProblem(g, 'telepati', { grade: 1, target: asta.id })).toMatch(/känner till namnet/);
    g.state.met = { gumma: false };
    const opened: string[] = [];
    g.onUi((name, arg) => name === 'talk' && arg && opened.push(arg));
    g.rng = queue(face(2));
    expect(castSpell(g, 'telepati', { grade: 1, target: asta.id })).toBeNull();
    expect(opened).toEqual([asta.id]);
    expect(p.effects.some((e) => e.kind === 'tankekontakt' && e.by === 'gumma')).toBe(true);
  });
});

/** Lägger en besvärjelse i strid och låter den verka direkt (som i början av nästa runda). */
function resolveNow(g: Game, cast: () => string | null) {
  expect(cast()).toBeNull();
  g.rng = queue(face(2));
  resolvePending(g);
}
