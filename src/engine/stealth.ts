import { isParty, short, sneakMod } from './combat';
import { skillCheck } from './rules';
import type { Game } from './game';
import type { Actor } from './types';

/**
 * Smygarläge (husregel, steg 7): den som smyger slår Smyga varje runda som en fiende skulle kunna
 * se hen, och varje steg utanför strid räknas som en runda. Lyckas slaget förblir hen oupptäckt;
 * misslyckas det blir hen upptäckt och smygarläget tar slut. Fienderna slår Upptäcka fara först när
 * den som smyger anfaller (se ambush i combat.ts).
 */

/** Fiender som skulle se aktören om hen inte smög. */
export function watchers(g: Game, a: Actor): Actor[] {
  return g.state.actors.filter((e) => e.alive && e.hostile && !e.fled && !isParty(e) && g.canSee(e, a));
}

/** Slår på eller av smygarläget. Den som redan är upptäckt kan inte gömma sig mitt framför fienden. */
export function toggleSneak(g: Game, a: Actor): string | null {
  if (a.elemental) return 'En elementar kan inte smyga.';
  if (a.sneaking) {
    a.sneaking = false;
    a.hidden = false;
    return `${a.name} slutar smyga.`;
  }
  if (g.state.mode === 'combat' && watchers(g, a).length) return `${a.name} är redan upptäckt; det går inte att gömma sig mitt framför fienden.`;
  a.sneaking = true;
  a.hidden = true;
  return `${a.name} smyger.`;
}

/** En runda i smygarläge för alla i gruppen som smyger. */
export function sneakRound(g: Game) {
  for (const a of g.state.actors) {
    if (!a.alive || !isParty(a) || !a.sneaking || !a.hidden) continue;
    if (!watchers(g, a).length) continue;
    const check = skillCheck(g.skillFv(a, 'smyga'), g.rng, sneakMod(g, a));
    if (check.success) {
      g.gainExperience(a, 'smyga', check);
      g.log(`${a.name} smyger oupptäckt (Smyga, ${short(check)}).`);
    } else {
      a.hidden = false;
      a.sneaking = false;
      g.log(`${a.name} blir upptäckt (Smyga, ${short(check)})!`);
    }
  }
}
