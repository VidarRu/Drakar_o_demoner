import { ARMOR } from '../data/armor';
import { roll } from './dice';
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
      return `Spelaren berättar att hövdingen är död och får sin belöning på ${reward} silvermynt.`;
    },
  },
  overnatta: {
    label: () => `Övernatta (${REST_COST} silver)`,
    available: (g) => g.player.silver >= REST_COST,
    apply: (g) => {
      g.player.silver -= REST_COST;
      const improved = g.rest();
      const gains = improved.length ? ` Erfarenheten ger resultat: ${improved.join(', ')}.` : '';
      return `Spelaren betalar ${REST_COST} silvermynt, sover över natten och vaknar helt återställd.${gains}`;
    },
  },
  forbind: {
    label: () => `Få såren förbundna (${HEAL_COST} silver)`,
    available: (g) => g.player.silver >= HEAL_COST && g.player.kp < g.player.maxKp,
    apply: (g) => {
      g.player.silver -= HEAL_COST;
      const amount = roll('1T6', g.rng);
      const before = g.player.kp;
      g.heal(amount);
      return `Spelaren betalar ${HEAL_COST} silvermynt och får sina sår förbundna (läker ${g.player.kp - before} KP).`;
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
