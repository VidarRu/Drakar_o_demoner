import { ARMOR, SHIELDS } from '../data/armor';
import type { MeleeWeaponDef } from '../data/types';
import { WEAPONS } from '../data/weapons';
import { armorBv } from './combat';
import { roll } from './dice';
import { EXPERIENCE, REPAIR_PERCENT } from './rules';
import { canMedicine, clockText, medicine } from './time';
import type { Game } from './game';
import type { Actor } from './types';

/**
 * En spelmekanisk handling som kan utföras i ett samtal. Språkmodellen får aldrig
 * avgöra utfall – den får bara veta resultatet och spela vidare utifrån det.
 */
export interface Intent {
  label: (g: Game) => string;
  available: (g: Game, npc: Actor) => boolean;
  /** Utför handlingen och returnerar en beskrivning av vad som hände. */
  apply: (g: Game, npc: Actor) => string;
  /** Avslutar samtalet direkt. */
  ends?: boolean;
}

/** Priser enligt Bok III: sovsal 10 sm per natt, ringbrynjeskjorta 1 500 sm. */
const REST_COST = 10;
const HEAL_COST = 5;
const MAIL_COST = 1500;
const MAIL = 'ringbrynjeskjorta';
const REWARD = 500;
const HIGHER_REWARD = 750;

/** Det smeden kan laga: föremål med sänkt BV, högsta BV efter lagning och pris per BV-poäng. */
export function repairs(g: Game, smith: Actor): { key: string; name: string; from: number; to: number; each: number }[] {
  const p = g.player;
  const smithFv = smith.skills['hantverk:smide'] ?? 0;
  const out: { key: string; name: string; from: number; to: number; each: number }[] = [];
  const add = (key: string, name: string, max: number, price: number) => {
    const from = p.bv[key];
    if (from === undefined) return;
    const to = Math.min(max, Math.max(from, smithFv));
    if (to > from) out.push({ key, name, from, to, each: Math.ceil((price * REPAIR_PERCENT) / 100) });
  };
  for (const slot of ['weapon', 'offhand'] as const) {
    const id = slot === 'weapon' ? p.weapon : p.offhand;
    const w = id ? (WEAPONS[id] as MeleeWeaponDef | undefined) : undefined;
    if (w?.kind === 'närstrid' && w.bv !== null) add(slot, w.name, w.bv, w.price);
  }
  if (p.shield) add('shield', SHIELDS[p.shield].name, SHIELDS[p.shield].bv, SHIELDS[p.shield].price);
  for (const id of p.armor) add(id, ARMOR[id].name, armorBv(id), ARMOR[id].price);
  return out;
}

export const INTENTS: Record<string, Intent> = {
  uppdrag_anta: {
    label: () => 'Åta dig att döda svartalfshövdingen',
    available: (g) => !g.state.flags.uppdrag_antaget && !g.state.flags.uppdrag_klart,
    apply: (g) => {
      g.state.flags.uppdrag_antaget = true;
      return `Spelaren åtar sig uppdraget att döda svartalfshövdingen Grukk i grottan österut. Belöningen är ${REWARD} silvermynt.`;
    },
  },
  overtala_beloning: {
    label: () => 'Pruta upp belöningen (Övertala)',
    available: (g) =>
      !!g.state.flags.uppdrag_antaget && !g.state.flags.prutat && !g.state.flags.uppdrag_klart,
    apply: (g) => {
      g.state.flags.prutat = true;
      const check = g.playerCheck('overtala');
      if (check.success) {
        g.state.flags.hogre_beloning = true;
        return `Spelaren lyckas övertala värdshusvärden: belöningen höjs till ${HIGHER_REWARD} silvermynt.`;
      }
      return `Spelaren försöker pruta upp belöningen men misslyckas. Belöningen förblir ${REWARD} silvermynt och frågan är avgjord.`;
    },
  },
  uppdrag_beloning: {
    label: () => 'Hämta belöningen för hövdingens död',
    available: (g) => !!g.state.flags.hovding_dod && !!g.state.flags.uppdrag_antaget && !g.state.flags.uppdrag_klart,
    apply: (g) => {
      const reward = g.state.flags.hogre_beloning ? HIGHER_REWARD : REWARD;
      g.player.silver += reward;
      g.state.flags.uppdrag_klart = true;
      g.state.character.bonusEp = (g.state.character.bonusEp ?? 0) + EXPERIENCE.questBonus;
      return `Spelaren berättar att hövdingen är död och får sin belöning på ${reward} silvermynt. (Uppdraget ger också ${EXPERIENCE.questBonus} bonus-EP att fördela vid träningen.)`;
    },
  },
  overnatta: {
    label: () => `Övernatta (${REST_COST} silver)`,
    available: (g) => g.player.silver >= REST_COST,
    apply: (g) => {
      g.player.silver -= REST_COST;
      g.sleep(8);
      return `Spelaren betalar ${REST_COST} silvermynt och sover över natten. Klockan är nu ${clockText(g.state.time)}.`;
    },
  },
  vila_vecka: {
    label: () => `Vila en vecka och träna (${REST_COST * 7} silver)`,
    available: (g) => g.player.silver >= REST_COST * 7,
    ends: true,
    apply: (g) => {
      g.player.silver -= REST_COST * 7;
      g.restWeek();
      g.log(`${g.player.name} vilar en vecka på värdshuset. Klockan är nu ${clockText(g.state.time)}.`);
      g.openUi('training');
      return 'Spelaren vilar en vecka.';
    },
  },
  vard: {
    label: () => `Låt gumman vårda såren med Läkekonst (${HEAL_COST} silver)`,
    available: (g) => g.player.silver >= HEAL_COST && canMedicine(g, g.player),
    apply: (g, npc) => {
      g.player.silver -= HEAL_COST;
      const check = medicine(g, npc, g.player, npc.skills.lakekonst ?? 0);
      return check?.success
        ? 'Gumman vårdar spelarens sår med sina örter och läker en KP. Har såret varit infekterat hävs infektionen.'
        : 'Gumman vårdar såren, men det hjälper inte i dag.';
    },
  },
  forbind: {
    label: () => `Få såren förbundna (${HEAL_COST} silver)`,
    available: (g) => g.player.silver >= HEAL_COST && (g.player.kp < g.player.maxKp || g.player.bleeding.length > 0),
    apply: (g) => {
      g.player.silver -= HEAL_COST;
      const amount = roll('1T6', g.rng);
      const before = g.player.kp;
      const bled = g.player.bleeding.length > 0;
      g.player.bleeding = [];
      g.heal(amount);
      return `Spelaren betalar ${HEAL_COST} silvermynt och får sina sår förbundna${bled ? ' så att blödningen stannar' : ''} (läker ${g.player.kp - before} KP).`;
    },
  },
  laga_utrustning: {
    label: (g) => {
      const smith = g.state.actors.find((a) => a.npc === 'smed');
      const cost = smith ? repairs(g, smith).reduce((s, r) => s + r.each * (r.to - r.from), 0) : 0;
      return `Laga vapen och rustning (${cost} silver)`;
    },
    available: (g, npc) => repairs(g, npc).some((r) => g.player.silver >= r.each),
    apply: (g, npc) => {
      const p = g.player;
      const done: string[] = [];
      let paid = 0;
      for (const r of repairs(g, npc)) {
        let points = 0;
        while (p.bv[r.key] < r.to && p.silver >= r.each) {
          p.silver -= r.each;
          paid += r.each;
          p.bv[r.key]++;
          points++;
        }
        if (points) done.push(`${r.name.toLowerCase()} till BV ${p.bv[r.key]}`);
      }
      return done.length
        ? `Smeden lagar ${done.join(', ')} för ${paid} silvermynt.`
        : 'Spelaren har inte råd att låta smeden laga något.';
    },
  },
  kop_ringbrynja: {
    label: () => `Köp ringbrynjeskjortan (${MAIL_COST} silver)`,
    available: (g) => g.player.silver >= MAIL_COST && !g.player.armor.includes(MAIL),
    apply: (g) => {
      g.player.silver -= MAIL_COST;
      g.equipArmor(MAIL);
      g.state.flags.kopt_ringbrynja = true;
      return `Spelaren köper ringbrynjeskjortan för ${MAIL_COST} silvermynt och tar på sig den (absorberar ${ARMOR[MAIL].abs} på bröstkorg och mage).`;
    },
  },
  handla: {
    label: () => 'Handla',
    available: () => true,
    ends: true,
    apply: (g, npc) => {
      g.openUi('shop', npc.id);
      return `Spelaren handlar med ${npc.name}.`;
    },
  },
  anfall: {
    label: () => 'Dra vapen och anfall!',
    available: () => true,
    ends: true,
    apply: (g, npc) => {
      g.provoke(npc.id);
      return `Spelaren drar vapen mot ${npc.name}.`;
    },
  },
};
