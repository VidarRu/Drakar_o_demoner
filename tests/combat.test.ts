import { describe, expect, it } from 'vitest';
import * as combat from '../src/engine/combat';
import { seededRng, type Rng } from '../src/engine/dice';
import { Game } from '../src/engine/game';
import { INTENTS } from '../src/engine/intents';
import { FUMBLE_TABLES, FEAR_TABLE } from '../src/engine/rules';
import type { Actor } from '../src/engine/types';
import { testCharacter } from './helpers';

/** Slumpkälla som ger talen i tur och ordning och sedan 0,5. */
function queue(...values: number[]): Rng {
  return () => (values.length ? values.shift()! : 0.5);
}
/** Talet som ger `n` på en tärning med `sides` sidor. */
const face = (n: number, sides = 20) => (n - 0.5) / sides;

/** Ett spel där rollpersonen står på stigen med en svartalf bredvid sig och striden har börjat. */
function duel(): { g: Game; p: Actor; alf: Actor } {
  const g = Game.create(testCharacter(), seededRng(3));
  const p = g.player;
  const alf = g.state.actors.find((a) => a.defId === 'svartalf')!;
  p.x = 10;
  p.y = 12;
  alf.x = 11;
  alf.y = 12;
  combat.startCombat(g, [alf]);
  return { g, p, alf };
}

describe('detaljerad strid', () => {
  it('rollpersonen håller ett enhandsvapen med båda händerna om den andra handen är fri', () => {
    const g = Game.create(testCharacter(), seededRng(1));
    const p = g.player;
    expect(combat.damageExpr(p, combat.weaponInfo(p))).toBe('1T8+1+1');
    p.shield = undefined;
    expect(combat.damageExpr(p, combat.weaponInfo(p))).toBe('1T8+1+1+1T2');
  });

  it('krigaren får +5 på initiativet', () => {
    const g = Game.create(testCharacter(), seededRng(1));
    expect(g.player.initiative).toBe(5);
    expect(g.player.locMax).toEqual({ huvud: 5, bröstkorg: 6, mage: 5, 'vänster arm': 4, 'höger arm': 4, 'vänster ben': 5, 'höger ben': 5 });
    expect(g.player.bv).toEqual({ weapon: 15, shield: 11, harnesk_lader: 4 });
  });

  it('pareringar efter den första får −5, och skölden ger en extra parering utan avdrag', () => {
    const { g, p, alf } = duel();
    alf.skills.enhandssvard = 15;
    g.rng = () => 0.5; // alla T20 blir 11: svartalfen träffar, och rollpersonen parerar så länge CL räcker
    g.state.combat!.parries = {};
    const start = g.state.log.length;
    combat.attackOnce(g, alf, p, 'weapon');
    combat.attackOnce(g, alf, p, 'weapon');
    combat.attackOnce(g, alf, p, 'weapon');
    const lines = g.state.log.slice(start);
    expect(lines[0]).toContain('parerar med bredsvärd (T20: 11 mot 13)');
    expect(lines[1]).toContain('parerar med vanlig sköld (trekantig) (T20: 11 mot 11)');
    expect(lines.join('\n')).toContain('mot 8, -5 fler pareringar');
    expect(g.state.combat!.parries[p.id]).toEqual({ count: 2, shieldFree: true });
  });

  it('ett perfekt anfall gör maximal skada utan rustning och kan inte pareras', () => {
    const { g, p, alf } = duel();
    g.rng = () => 0; // ettor överallt: perfekt slag, vänster ben, brutet ben
    combat.attackOnce(g, p, alf, 'weapon');
    // Bredsvärd 1T8+1 och skadebonus +1 ger högst 10. Svartalfen har 9 KP och 4 i benet.
    expect(alf.kp).toBe(-1);
    expect(alf.locKp['vänster ben']).toBe(-6);
    expect(alf.unconscious).toBe(true);
    expect(alf.bleeding).toContain('vänster ben');
    expect(alf.injuries[0]).toMatchObject({ loc: 'vänster ben', id: 'brutet', cl: -3 });
    // Husregeln om 2 % slitage slog till (slaget blev 0).
    expect(p.bv.weapon).toBe(14);
  });

  it('en träff i bröstet drar KP där och från totala KP, och rustningen tappar BV', () => {
    const { g, p, alf } = duel();
    alf.skills.enhandssvard = 15;
    expect(combat.damageExpr(alf, combat.weaponInfo(alf))).toBe('1T6+1');
    // Anfall 5, inget slitage, parering 20 och omslag 1 (misslyckad), inget slitage,
    // skada 5+1 = 6 mot läderharnesk abs 2, träffområde 15 (bröstkorg).
    g.rng = queue(face(5), 0.5, face(20), face(1), 0.5, face(5, 6), face(15));
    combat.attackOnce(g, alf, p, 'weapon');
    expect(p.locKp.bröstkorg).toBe(2);
    expect(p.kp).toBe(9);
    expect(p.bv.harnesk_lader).toBe(3);
  });

  it('husregel: −2 på alla färdighetsslag för varje kroppsdel på 0 KP, men inget för mindre skador', () => {
    const { g, p, alf } = duel();
    combat.wound(g, p, 2, 'höger arm');
    expect(combat.woundPenalty(p)).toBe(0);
    combat.wound(g, p, 5, 'vänster ben');
    combat.wound(g, p, 9, 'huvud');
    expect(combat.woundPenalty(p)).toBe(-2); // huvudet räknas inte, där blir man medvetslös
    p.unconscious = false;
    g.rng = () => 0.5;
    const start = g.state.log.length;
    combat.attackOnce(g, p, alf, 'weapon');
    expect(g.state.log.slice(start).join('\n')).toContain('-2 skador');
  });

  it('ett misslyckat anfall pareras inte, och en lyckad parering stoppar all skada', () => {
    const { g, p, alf } = duel();
    g.rng = () => 0.5; // svartalfen (FV 4) missar med 11
    combat.attackOnce(g, alf, p, 'weapon');
    expect(g.state.combat!.parries[p.id]).toBeUndefined();
    alf.skills.enhandssvard = 15;
    combat.attackOnce(g, alf, p, 'weapon');
    expect(g.state.combat!.parries[p.id]).toEqual({ count: 1, shieldFree: false });
    expect(p.kp).toBe(p.maxKp);
  });

  it('Dra vapen ger en gratis tur före första rundan', () => {
    const g = Game.create(testCharacter(), seededRng(4));
    const p = g.player;
    p.skills.dra_vapen = 20;
    const alf = g.state.actors.find((a) => a.defId === 'svartalf')!;
    p.x = 10;
    p.y = 12;
    alf.x = 13;
    alf.y = 12;
    g.rng = () => 0.3; // lyckas med Dra vapen
    combat.startCombat(g, [alf]);
    expect(g.state.combat!.round).toBe(0);
    expect(g.state.log.join('\n')).toContain('Gratisrunda');
    expect(g.isPlayerTurn()).toBe(true);
    g.endTurn();
    expect(g.state.combat!.round).toBe(1);
  });

  it('blödningen tar 1 KP var sjätte runda tills någon lägger förband', () => {
    const { g, p } = duel();
    g.state.mode = 'explore';
    g.state.combat = null;
    combat.wound(g, p, 4, 'vänster arm');
    expect(p.bleeding).toEqual(['vänster arm']);
    expect(p.kp).toBe(9);
    for (let i = 0; i < 6; i++) combat.tick(g, p);
    expect(p.kp).toBe(8);
    // Med en obrukbar arm går det inte att lägga förband själv.
    expect(g.canBandage()).toBe(false);
  });

  it('förband stoppar blödningen', () => {
    const { g, p } = duel();
    g.state.mode = 'explore';
    g.state.combat = null;
    combat.wound(g, p, 6, 'bröstkorg');
    expect(p.down).toBe(true);
    p.down = false;
    p.skills.forsta_hjalpen = 18;
    g.rng = () => 0.3;
    expect(g.bandage()).toBe(true);
    expect(p.bleeding).toEqual([]);
  });

  it('fummel som träffar närmsta vän slås om när det inte finns någon följeslagare', () => {
    const { g, p } = duel();
    expect(FUMBLE_TABLES.närstrid[16].effects[0].kind).toBe('vän');
    g.rng = queue(face(17), face(14), 0.5);
    combat.fumble(g, p, 'närstrid', 'weapon');
    expect(p.weapon).toBe('nave');
    expect(g.state.character.inventory).not.toContain('bredsvard');
    expect(g.state.dropped).toMatchObject([{ item: 'bredsvard', x: p.x, y: p.y }]);
    expect(combat.pickUp(g)).toBe(true);
    expect(p.weapon).toBe('bredsvard');
    expect(p.bv.weapon).toBe(15);
  });

  it('fummel 20 ger två nya slag på tabellen', () => {
    const { g, p } = duel();
    g.rng = queue(face(20), face(13), face(16));
    const start = g.state.log.length;
    combat.fumble(g, p, 'sköld', 'shield');
    const lines = g.state.log.slice(start);
    expect(lines).toHaveLength(3);
    expect(p.effects.filter((e) => e.kind === 'cl')).toHaveLength(1);
    expect(p.effects.filter((e) => e.kind === 'motståndarBonus')).toHaveLength(1);
  });

  it('anfall från sidan ger +3 och bakifrån +7', () => {
    const { p, alf } = duel();
    p.facing = { dx: 0, dy: 1 };
    alf.x = p.x;
    alf.y = p.y - 1;
    expect(combat.flankMod(alf, p)).toBe(7);
    alf.x = p.x + 1;
    alf.y = p.y;
    expect(combat.flankMod(alf, p)).toBe(3);
    alf.x = p.x + 1;
    alf.y = p.y + 1;
    expect(combat.flankMod(alf, p)).toBe(0);
  });

  it('mörker ger −15, facklans sken −5, och mörkersyn tar bort avdraget', () => {
    const { g, p, alf } = duel();
    // Grottgolv öster om byn.
    p.x = 31;
    p.y = 4;
    alf.x = 32;
    alf.y = 4;
    expect(combat.lightMod(g, p, alf)).toBe(-5);
    expect(combat.lightMod(g, alf, p)).toBe(0);
    alf.x = 37;
    expect(combat.lightMod(g, p, alf)).toBe(-15);
  });

  it('moralslaget: lyckas det står varelsen kvar, annars flyr den', () => {
    const g = Game.create(testCharacter(), seededRng(2));
    const wolf = g.state.actors.find((a) => a.defId === 'varg')!;
    combat.startCombat(g, [wolf]);
    wolf.kp = 3; // PSY 11 − 1 motståndare − 4 för halva KP = 6
    g.rng = queue(face(7));
    expect(combat.moraleCheck(g, wolf, 'test')).toBe(false);
    expect(combat.hasEffect(wolf, 'flyr')).toBe(true);
    wolf.effects = [];
    g.rng = queue(face(6));
    expect(combat.moraleCheck(g, wolf, 'test')).toBe(true);
  });

  it('skräck: 1T20 − PSY + skräckvärdet på Skräcktabellen', () => {
    const { g, p, alf } = duel();
    expect(FEAR_TABLE[15].effects[0]).toEqual({ kind: 'fobi', level: 'normal' });
    g.rng = queue(face(20)); // 20 − PSY 10 + 5 = 15: normal fobi
    combat.scare(g, p, alf, 5);
    expect(g.state.character.phobias).toEqual([{ source: alf.name, level: 'normal' }]);
    expect(g.state.fearMet).toContain('svartalf');
  });

  it('kritisk skada i huvudet dödar', () => {
    const { g, alf } = duel();
    combat.wound(g, alf, alf.locMax.huvud * 2, 'huvud');
    expect(alf.alive).toBe(false);
  });

  it('smeden lagar för 5 % av priset per BV-poäng', () => {
    const g = Game.create(testCharacter(), seededRng(1));
    const smith = g.state.actors.find((a) => a.npc === 'smed')!;
    g.player.bv.weapon = 12;
    const before = g.player.silver;
    INTENTS.laga_utrustning.apply(g, smith);
    expect(g.player.bv.weapon).toBe(15);
    expect(before - g.player.silver).toBe(150);
  });
});

describe('hela strider', () => {
  it('striden mot svartalferna i grottan tar slut utan fel', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const g = Game.create(testCharacter(), seededRng(seed));
      const chief = g.state.actors.find((a) => a.defId === 'svartalfshovding')!;
      g.player.x = chief.x - 5;
      g.player.y = chief.y;
      g.player.kp = 40; // tål mer så att striden pågår längre
      g.player.maxKp = 40;
      g.stepPlayer({ x: chief.x - 4, y: chief.y });
      expect(g.state.mode).toBe('combat');
      for (let i = 0; i < 3000 && g.state.mode === 'combat'; i++) {
        if (g.isPlayerTurn()) {
          const target = combat.activeHostiles(g).find((a) => g.canAttack(a.id));
          if (target) g.playerAttack(target.id);
          else {
            const near = combat.activeHostiles(g)[0];
            const path = near && g.pathTo(near.x, near.y, true);
            if (path) for (const step of path) if (!g.combatStep(step)) break;
            const t = combat.activeHostiles(g).find((a) => g.canAttack(a.id));
            if (t) g.playerAttack(t.id);
            else g.endTurn();
          }
        } else g.enemyTurn();
      }
      expect(['explore', 'dead']).toContain(g.state.mode);
    }
  });
});
