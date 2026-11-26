/**
 * Magisk kanalisering (Vidar, förenklad ur Bok I): magikern med färdigheten kopplar ihop sig med en
 * villig person efter ett lyckat slag och kan sedan använda personens PSY till sina besvärjelser.
 * Mottagligt medium ger +5 på slaget när personen är mediet. Tolkningar: man måste kunna röra vid
 * mediet, alla i gruppen är villiga, kopplingen håller till nästa sömn, och mediets PSY går inte
 * under 1. Se docs/regelbeslut.md under Magisk kanalisering.
 */
import { addEffect, finishTurn, hasEffect, short, skillMod, tick } from './combat';
import type { Game } from './game';
import { actorHas } from './hero';
import { distance } from './map';
import { skillCheck } from './rules';
import type { Actor } from './types';

/** Mediet som magikern är kopplad till, om det finns och kan ge PSY. */
export function mediumOf(g: Game, a: Actor): Actor | undefined {
  const e = a.effects.find((x) => x.kind === 'kanal');
  const m = e?.by ? g.actor(e.by) : undefined;
  return m && m.alive && !m.unconscious ? m : undefined;
}

/** PSY som magikern kan ta från mediet (mediet behåller minst 1). */
export const mediumPsy = (g: Game, a: Actor) => Math.max(0, (mediumOf(g, a)?.psy ?? 0) - 1);

/** Personer i gruppen som magikern kan kanalisera genom: villiga och inom räckhåll för en beröring. */
export function mediumChoices(g: Game, a: Actor): Actor[] {
  return g.partyMembers().filter((m) => m !== a && m.alive && !m.unconscious && !m.elemental && distance(a.x, a.y, m.x, m.y) <= 1);
}

export function channelProblem(g: Game, a: Actor, m: Actor | undefined): string | null {
  if (!(a.skills.magisk_kanalisering ?? 0)) return 'Du kan inte Magisk kanalisering.';
  if (a.shape) return 'Inte i djurhamn.';
  if (!m || !mediumChoices(g, a).includes(m)) return 'Mediet måste vara en villig person i gruppen som du kan röra vid.';
  if (hasEffect(a, 'kanal') && mediumOf(g, a) === m) return `Du är redan kopplad till ${m.name}.`;
  if (g.state.mode === 'combat') {
    const c = g.state.combat!;
    if (c.order[c.turn] !== a.id || c.acted[a.id] || !g.isPlayerTurn()) return 'Det är inte din tur.';
  } else if (g.state.mode !== 'explore') return 'Inte nu.';
  return null;
}

/** Ett slag i Magisk kanalisering kopplar ihop magikern med mediet. I strid tar det handlingen. */
export function channel(g: Game, a: Actor, m: Actor): string | null {
  const problem = channelProblem(g, a, m);
  if (problem) return problem;
  const medium = actorHas(g, m, 'mottagligt_medium') ? 5 : 0;
  const check = skillCheck(g.skillFv(a, 'magisk_kanalisering'), g.rng, skillMod(g, a, 'magisk_kanalisering') + medium);
  if (check.success) {
    a.effects = a.effects.filter((e) => e.kind !== 'kanal');
    addEffect(a, { kind: 'kanal', by: m.id, label: `Kanaliserar genom ${m.name}`, persist: true, untilRest: true });
    g.gainExperience(a, 'magisk_kanalisering', check);
    g.log(`${a.name} kopplar ihop sitt psyke med ${m.name}s (Magisk kanalisering, ${short(check)}${medium ? ', +5 mottagligt medium' : ''}). Nu kan ${a.name} använda ${m.name}s PSY.`);
  } else g.log(`${a.name} försöker koppla ihop sig med ${m.name}, men det går inte (Magisk kanalisering, ${short(check)}).`);
  if (g.state.mode === 'combat') {
    g.state.combat!.acted[a.id] = true;
    finishTurn(g);
  } else tick(g, a);
  g.changed();
  return null;
}

/** Drar PSY ur mediet. Returnerar hur mycket som togs. */
export function drawMedium(g: Game, a: Actor, want: number): number {
  const m = mediumOf(g, a);
  if (!m) return 0;
  const n = Math.min(want, mediumPsy(g, a));
  m.psy -= n;
  if (n) g.log(`${a.name} tar ${n} PSY från ${m.name}.`);
  return n;
}
