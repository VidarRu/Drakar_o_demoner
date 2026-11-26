import { describe, expect, it } from 'vitest';
import * as combat from '../src/engine/combat';
import { seededRng, type Rng } from '../src/engine/dice';
import { Game } from '../src/engine/game';
import { ironProblem } from '../src/engine/inventory';
import { castProblem, castSpell, enemyCast, resolvePending, spellS, spellTargets } from '../src/engine/magic';
import { maxKp } from '../src/engine/rules';
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
  c.spells = ['oka', 'minska', 'kamouflage', 'flammande_hand', 'virvelskold', 'ljus', 'morker', 'motstandskraft', 'magisk_syn', 'osynlighet', 'antimagi', 'eld', 'vindpil', 'astralvapen'];
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

  it('blödningen fördelas inte', () => {
    const { g, p } = explore();
    const before = { ...p.locKp };
    combat.wound(g, p, 2, null, false);
    expect(p.locKp).toEqual(before);
  });

  it('VINDPIL gör 1T10 hur hög E än är, och VIRVELSKÖLD stöter bort den', () => {
    const { g, p, foe } = explore('svartalf', 3);
    foe.hostile = true;
    const kp = foe.kp;
    // VINDPIL E3 lyckas (2), skadan 1T10 blir 7 och träffområdet slås (10). Svartalfen har ingen rustning.
    g.rng = queue(face(2), face(7, 10), face(10));
    expect(castSpell(g, 'vindpil', { grade: 3, target: foe.id })).toBeNull();
    expect(foe.kp).toBe(kp - 7);
    foe.effects.push({ kind: 'virvelsköld', label: 'VIRVELSKÖLD', rounds: 10 });
    g.rng = queue(face(2));
    castSpell(g, 'vindpil', { grade: 1, target: foe.id });
    expect(foe.kp).toBe(kp - 7);
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

/** Lägger en besvärjelse i strid och låter den verka direkt (som i början av nästa runda). */
function resolveNow(g: Game, cast: () => string | null) {
  expect(cast()).toBeNull();
  g.rng = queue(face(2));
  resolvePending(g);
}
