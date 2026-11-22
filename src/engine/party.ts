import { RECRUITS } from '../content';
import { HIT_LOCATIONS, PARTY_MAX, ROUND_SECONDS } from './rules';
import { canAct, hasEffect, isOut, limbUsable, tick } from './combat';
import { bandageOnce } from './maneuvers';
import { distance, walkable } from './map';
import { dayOf } from './time';
import type { Game } from './game';
import type { Actor } from './types';

/**
 * Följeslagare (steg 7, husregler i docs/regelbeslut.md). Gruppen är rollpersonen och upp till fem
 * följeslagare. Var och en har ett eget rollformulär och följer samma regler som rollpersonen.
 */

/** Varför personen inte kan värvas just nu, eller null. */
export function recruitProblem(g: Game, npc: Actor): string | null {
  const c = npc.companion;
  if (!c || !npc.alive || npc.hostile) return 'Hen vill inte följa med.';
  if (g.state.party.includes(npc.id)) return 'Hen följer redan med.';
  if (g.state.party.length >= PARTY_MAX) return `Gruppen är full (högst ${PARTY_MAX}).`;
  const left = g.state.departed?.[c.recruit];
  if (left !== undefined && left >= dayOf(g.state.time)) return 'Hen vill inte följa med igen förrän i morgon.';
  if (c.pay === 'dagslön' && g.leader.silver < (c.wage ?? 0)) return `Du har inte råd med dagslönen (${c.wage} silvermynt).`;
  return null;
}

/** Värvar en person. Den som tar dagslön får dagens lön direkt. */
export function recruit(g: Game, npcId: string): string {
  const npc = g.actor(npcId);
  if (!npc) return 'Personen finns inte.';
  const problem = recruitProblem(g, npc);
  if (problem) return problem;
  const c = npc.companion!;
  const def = RECRUITS[c.recruit];
  npc.kind = 'player';
  npc.hostile = false;
  npc.refused = false;
  npc.morale = [];
  g.state.party.push(npc.id);
  if (c.pay === 'dagslön') {
    g.leader.silver -= c.wage!;
    npc.silver += c.wage!;
    c.paidDay = dayOf(g.state.time);
  }
  const terms =
    c.pay === 'dagslön' ? `för ${c.wage} silvermynt om dagen` : c.pay === 'andel' ? 'mot en lika stor del av silvret ni hittar' : 'utan att begära något';
  g.log(`${npc.name} går med i gruppen ${terms}.`);
  g.changed();
  return `${def.name} följer med spelaren ${terms}.`;
}

/** En följeslagare lämnar gruppen och går hem. */
export function leaveParty(g: Game, a: Actor, why: 'avskedad' | 'vägrar' | 'flydde' | 'obetald') {
  if (!g.state.party.includes(a.id) || a.id === g.state.playerId) return;
  g.state.party = g.state.party.filter((id) => id !== a.id);
  a.kind = 'npc';
  a.hostile = false;
  a.sneaking = false;
  a.hidden = false;
  a.refused = false;
  a.fled = false;
  a.effects = a.effects.filter((e) => e.kind !== 'flyr' && e.kind !== 'bärsärk');
  if (g.state.focus === a.id) g.state.focus = g.state.playerId;
  const c = a.companion;
  if (c) {
    (g.state.departed ??= {})[c.recruit] = dayOf(g.state.time);
    const place = c.homeMap && c.homeMap !== g.state.mapId ? g.state.places[c.homeMap] : undefined;
    if (place) {
      // Hen bor på en annan karta och går hem dit: där finns hen när gruppen kommer tillbaka.
      g.state.actors = g.state.actors.filter((x) => x !== a);
      a.x = c.home.x;
      a.y = c.home.y;
      place.actors.push(a);
    } else goHome(g, a);
  }
  const text = {
    avskedad: `${a.name} lämnar gruppen och går hem.`,
    vägrar: `${a.name} har fått nog och vägrar följa med längre. Hen går hem.`,
    flydde: `${a.name} har flytt hem.`,
    obetald: `${a.name} får ingen lön och lämnar gruppen.`,
  }[why];
  g.log(text);
}

/** Ställer personen på sin hemplats, eller så nära den som går. */
function goHome(g: Game, a: Actor) {
  const home = a.companion!.home;
  for (let r = 0; r < 6; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = home.x + dx;
        const y = home.y + dy;
        if (!walkable(g.map, x, y) || (g.actorAt(x, y) && g.actorAt(x, y) !== a)) continue;
        a.x = x;
        a.y = y;
        return;
      }
    }
  }
}

/** Avskeda: bara utanför strid. */
export function dismiss(g: Game, id: string, why: 'avskedad' = 'avskedad') {
  const a = g.actor(id);
  if (!a || g.state.mode !== 'explore') return;
  leaveParty(g, a, why);
}

/** En följeslagare har dött: ägodelarna blir kvar på platsen. */
export function fallenCompanion(g: Game, a: Actor) {
  g.state.party = g.state.party.filter((id) => id !== a.id);
  const ch = g.charOf(a);
  const worn = new Set([a.weapon, a.offhand, a.shield].filter(Boolean));
  if (a.weapon && a.weapon !== 'nave') g.state.dropped.push({ item: a.weapon, slot: 'weapon', owner: a.id, x: a.x, y: a.y, bv: a.bv.weapon });
  if (a.offhand) g.state.dropped.push({ item: a.offhand, slot: 'offhand', owner: a.id, x: a.x, y: a.y, bv: a.bv.offhand });
  if (a.shield) g.state.dropped.push({ item: a.shield, slot: 'shield', owner: a.id, x: a.x, y: a.y, bv: a.bv.shield });
  if (ch) {
    const left = [...ch.inventory];
    for (const id of worn) {
      const i = left.indexOf(id!);
      if (i >= 0) left.splice(i, 1);
    }
    for (const item of left) g.state.dropped.push({ item, slot: 'item', owner: a.id, x: a.x, y: a.y });
    delete g.state.companions[a.id];
  }
  if (a.silver > 0 && g.leader.alive) {
    g.leader.silver += a.silver;
    g.log(`${g.leader.name} tar hand om ${a.name}s ${a.silver} silvermynt.`);
    a.silver = 0;
  }
  if (g.state.focus === a.id) g.state.focus = g.state.playerId;
}

/** Silver som hittas delas lika mellan rollpersonen och dem som går med för en del av bytet. */
export function shareLoot(g: Game, silver: number, from: string) {
  const sharers = g.partyMembers().filter((m) => m.companion?.pay === 'andel' && !m.fled);
  const each = Math.floor(silver / (sharers.length + 1));
  for (const m of sharers) m.silver += each;
  g.leader.silver += silver - each * sharers.length;
  if (!sharers.length) g.log(`Du hittar ${silver} silvermynt hos ${from}.`);
  else g.log(`Ni hittar ${silver} silvermynt hos ${from}. ${sharers.map((m) => m.name).join(' och ')} tar ${each} var som sin del.`);
}

/** Dagslönen dras från rollpersonens silver för varje ny dag. Kan hen inte betala går följeslagaren. */
export function payWages(g: Game) {
  const today = dayOf(g.state.time);
  for (const m of g.partyMembers()) {
    const c = m.companion;
    if (c?.pay !== 'dagslön' || !c.wage) continue;
    while ((c.paidDay ?? today) < today) {
      if (g.leader.silver < c.wage) {
        // I strid väntar lönen tills striden är över.
        if (g.state.mode === 'explore') leaveParty(g, m, 'obetald');
        break;
      }
      g.leader.silver -= c.wage;
      m.silver += c.wage;
      c.paidDay = (c.paidDay ?? today) + 1;
      g.log(`${m.name} får sin dagslön (${c.wage} silvermynt).`);
    }
  }
}

/**
 * Efter striden tar kamraterna hand om dem som ligger medvetslösa: de lägger förband på det som
 * blöder (Första hjälpen, en kroppsdel per lyckat slag och runda). Blödningen fortsätter under tiden.
 */
export function aidAfterCombat(g: Game) {
  const able = (m: Actor) =>
    canAct(m) && !m.down && m.kp > 1 && (['vänster arm', 'höger arm'] as const).every((l) => limbUsable(m, l)) && !hasEffect(m, 'flyr');
  // Den döende hinner som mest FYS rundor till; blödningen tar en KP var sjätte runda (tolkning: högst 20 rundor).
  for (let round = 0; round < 100; round++) {
    const patients = g.partyMembers().filter((m) => m.dying || ((m.unconscious || m.down) && m.bleeding.length));
    const helpers = g.partyMembers().filter((m) => able(m) && !patients.includes(m));
    if (!patients.length || !helpers.length) return;
    if (round >= 20 && !patients.some((m) => m.dying)) return;
    for (const [i, h] of helpers.entries()) {
      const pt = patients[i % patients.length];
      if (pt.alive && (pt.dying || pt.bleeding.length)) bandageOnce(g, h, pt);
    }
    for (const pt of patients) tick(g, pt);
    g.state.time += ROUND_SECONDS;
  }
}

/** Ledarens grupp som kan ses tillsammans, för gränssnittet. */
export function partyStatus(g: Game) {
  return g.partyMembers().map((m) => ({
    actor: m,
    out: isOut(m),
    wounded: HIT_LOCATIONS.some((l) => m.locKp[l] < m.locMax[l]),
    near: distance(m.x, m.y, g.leader.x, g.leader.y),
  }));
}
