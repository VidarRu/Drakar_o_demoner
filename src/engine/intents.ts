import { ARMOR, SHIELDS } from '../data/armor';
import type { MeleeWeaponDef } from '../data/types';
import { WEAPONS } from '../data/weapons';
import { armorBv } from './combat';
import { roll } from './dice';
import { REPAIR_PERCENT } from './rules';
import { canMedicine, clockText, medicine } from './time';
import type { Game } from './game';
import type { Actor } from './types';
import { recruit, recruitProblem } from './party';
import { MODULE_INTENTS } from '../content';

/**
 * En spelmekanisk handling som kan utföras i ett samtal. Språkmodellen får aldrig
 * avgöra utfall – den får bara veta resultatet och spela vidare utifrån det.
 */
export interface Intent {
  label: (g: Game, npc: Actor) => string;
  available: (g: Game, npc: Actor) => boolean;
  /** Utför handlingen och returnerar en beskrivning av vad som hände. */
  apply: (g: Game, npc: Actor) => string;
  /** Avslutar samtalet direkt. */
  ends?: boolean;
}

/** Priser enligt Bok III: sovsal 10 sm per natt. */
const REST_COST = 10;
const HEAL_COST = 5;

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

/** En säng i sovsalen per person i gruppen. */
const beds = (g: Game) => g.partyMembers().length;

/** Samtalsval som finns i alla moduler. Modulerna lägger till sina egna (ModuleDef.intents). */
const COMMON_INTENTS: Record<string, Intent> = {
  folj_med: {
    label: (_g, npc) => {
      const c = npc.companion;
      return c?.pay === 'dagslön' ? `Be personen följa med (${c.wage} silver om dagen)` : c?.pay === 'andel' ? 'Be personen följa med (mot en del av bytet)' : 'Be personen följa med';
    },
    available: (g, npc) => !!npc.companion && !recruitProblem(g, npc),
    ends: true,
    apply: (g, npc) => recruit(g, npc.id),
  },
  overnatta: {
    label: (g) => `Övernatta (${beds(g) * REST_COST} silver${beds(g) > 1 ? `, ${beds(g)} sängar` : ''})`,
    available: (g) => g.player.silver >= beds(g) * REST_COST,
    apply: (g) => {
      const cost = beds(g) * REST_COST;
      g.player.silver -= cost;
      g.sleep(8);
      return `Spelaren betalar ${cost} silvermynt och sover över natten${beds(g) > 1 ? ' med sitt sällskap' : ''}. Klockan är nu ${clockText(g.state.time)}.`;
    },
  },
  vila_vecka: {
    label: (g) => `Vila en vecka och träna (${beds(g) * REST_COST * 7} silver)`,
    available: (g) => g.player.silver >= beds(g) * REST_COST * 7,
    ends: true,
    apply: (g) => {
      g.player.silver -= beds(g) * REST_COST * 7;
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

/** Alla samtalsval: de gemensamma och modulernas. */
export const INTENTS: Record<string, Intent> = { ...COMMON_INTENTS, ...MODULE_INTENTS };
