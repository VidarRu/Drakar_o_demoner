/**
 * Magiska föremål (Bok III s. 43–44). Ett föremål innehåller besvärjelser med fasta effektgrader
 * som alltid lyckas. Användaren betalar PSY för dem, utom med NEXUS, och de förbrukas, utom med
 * PERMANENS. Vapen och rustningar kan verka ständigt när de bärs.
 *
 * För att använda ett föremål måste man veta (1) att det är magiskt (Känna magi eller
 * VARSEBLIVNING), (2) vilka besvärjelser det har (VARSEBLIVNING eller SYN) och (3) hur de
 * aktiveras (bara SYN). Magisk empati ger (2). Föremål som verkar ständigt behöver ingen analys.
 * Tolkningarna står i docs/regelbeslut.md under Magiska föremål.
 */
import { MAGIC_ITEMS, type MagicItemDef } from '../content';
import { SPELLS } from '../data/spells';
import { finishTurn, short, skillMod } from './combat';
import type { Game } from './game';
import { actorHas } from './hero';
import { castFromItem, type CastOptions } from './magic';
import { distance } from './map';
import { baseChance, resistance, skillCheck } from './rules';
import { advanceTime } from './time';
import type { ActiveEffect, Actor } from './types';

/** Räckvidd och varaktighet för besvärjelser ur föremål räknas med S 10 (tolkning). */
export const ITEM_S = 10;

export const magicDef = (id: string): MagicItemDef | undefined => MAGIC_ITEMS[id];

/** Hur mycket gruppen vet om föremålet: 0 inget, 1 att det är magiskt, 2 vilka besvärjelser, 3 hur de används. */
export function knownLevel(g: Game, id: string): number {
  return g.state.itemKnown?.[id] ?? 0;
}

function know(g: Game, id: string, level: number) {
  const k = (g.state.itemKnown ??= {});
  k[id] = Math.max(k[id] ?? 0, level);
}

export const totalGrade = (m: MagicItemDef) => m.spells.reduce((n, s) => n + s.grade, 0);

/** Namnet som visas: utseendet tills man vet vilka besvärjelser föremålet har. */
export function itemLabel(g: Game, id: string): string | null {
  const m = magicDef(id);
  if (!m) return null;
  const k = knownLevel(g, id);
  return k >= 2 ? m.name : k === 1 ? `${m.looks} (magiskt)` : m.looks;
}

/** Det man vet om föremålet, till packningen. */
export function itemDetails(g: Game, id: string): string {
  const m = magicDef(id);
  if (!m) return '';
  const k = knownLevel(g, id);
  if (k < 2) return k === 1 ? 'Magiskt, men du vet inte vilka besvärjelser det har.' : '';
  const spent = g.state.itemSpent?.[id] ?? [];
  const list = m.spells
    .map((s, i) => `${SPELLS[s.spell]?.name ?? s.spell} E${s.grade}${s.always ? ' (verkar när det bärs)' : s.permanent ? '' : spent.includes(i) ? ' (förbrukad)' : ' (en gång)'}${s.nexus ? '' : ', kostar PSY'}`)
    .join('; ');
  return `${list}.${k < 3 ? ' Du vet inte hur besvärjelserna aktiveras.' : ''}`;
}

// ------------------------------------------------------------------ analys

/** Skolan för Känna magi: den första besvärjelsen som inte är allmän (Bok I). */
function senseSkill(a: Actor, m: MagicItemDef): string {
  const school = m.spells.map((s) => SPELLS[s.spell]?.school).find((x) => x && x !== 'allmän');
  if (school) return `kanna_magi:${school}`;
  const own = Object.keys(a.skills).filter((k) => k.startsWith('kanna_magi:')).sort((x, y) => a.skills[y] - a.skills[x]);
  return own[0] ?? 'kanna_magi:elementarmagi';
}

export function senseProblem(g: Game, a: Actor, id: string): string | null {
  if (!magicDef(id) && !g.charOf(a)?.inventory.includes(id)) return 'Föremålet finns inte.';
  if (g.state.mode !== 'explore') return 'Inte nu.';
  if (a.shape) return 'Inte i djurhamn.';
  if (magicDef(id) && knownLevel(g, id) >= 1) return 'Du vet redan att det är magiskt.';
  return null;
}

/**
 * Känna magi (Bok I s. 51–52) på ett föremål: −20 på CL om man inte har känt på ett likadant
 * föremål förut, och +1 per effektgrad i föremålet. Lyckas det vet man att det är magiskt; ett
 * perfekt slag ger också antalet besvärjelser och effektgrader. Den som saknar FV slår med BC för
 * PSY. Tolkning: ett försök tar en minut.
 */
export function senseMagic(g: Game, a: Actor, id: string): string | null {
  const problem = senseProblem(g, a, id);
  if (problem) return problem;
  const m = magicDef(id);
  advanceTime(g, 60, 'aktiv');
  if (!m) {
    g.log(`${a.name} känner efter, men anar ingen magi.`);
    g.changed();
    return null;
  }
  const key = senseSkill(a, m);
  const fv = a.skills[key] ?? baseChance(a.attrs.PSY);
  const check = skillCheck(fv, g.rng, -20 + totalGrade(m) + skillMod(g, a, key));
  if (check.success) {
    know(g, id, 1);
    g.log(`${a.name} känner att föremålet är magiskt (Känna magi, ${short(check)}).${check.result === 'perfekt' ? ` Det har ${m.spells.length} besvärjelser med sammanlagt ${totalGrade(m)} effektgrader.` : ''}`);
  } else g.log(`${a.name} känner efter, men anar ingen magi (Känna magi, ${short(check)}).`);
  g.changed();
  return null;
}

export function empathyProblem(g: Game, a: Actor, id: string): string | null {
  if (!actorHas(g, a, 'magisk_empati')) return 'Du har inte Magisk empati.';
  if (g.state.mode !== 'explore') return 'Inte nu.';
  const m = magicDef(id);
  if (m && knownLevel(g, id) >= 2) return 'Du vet redan vilka besvärjelser föremålet har.';
  return null;
}

/**
 * Magisk empati (Bok I): PSY mot antalet effektgrader i föremålet på motståndstabellen. Lyckas det
 * vet man vilka besvärjelser föremålet har och deras effektgrader. Tolkning: det tar tio minuter.
 */
export function empathy(g: Game, a: Actor, id: string): string | null {
  const problem = empathyProblem(g, a, id);
  if (problem) return problem;
  const m = magicDef(id);
  advanceTime(g, 600, 'aktiv');
  if (!m) {
    g.log(`${a.name} känner ingen magi i föremålet.`);
    g.changed();
    return null;
  }
  const r = resistance(a.attrs.PSY, totalGrade(m), g.rng);
  if (r.success) {
    know(g, id, 2);
    g.log(`${a.name} känner föremålets magi inifrån (PSY ${a.attrs.PSY} mot ${totalGrade(m)} E, ${short(r)}): ${itemDetails(g, id)}`);
  } else g.log(`${a.name} når inte fram till föremålets magi (PSY ${a.attrs.PSY} mot ${totalGrade(m)} E, ${short(r)}).`);
  g.changed();
  return null;
}

/** Magiska föremål som gruppen bär, och de som ligger på marken inom räckvidden. */
function magicNear(g: Game, a: Actor, range: number): string[] {
  const carried = g.partyMembers().flatMap((m) => g.charOf(m)?.inventory ?? []);
  const ground = g.state.dropped.filter((d) => distance(a.x, a.y, d.x, d.y) <= range).map((d) => d.item);
  const worn = g.partyMembers().flatMap((m) => [m.weapon, m.offhand ?? '', m.shield ?? '', ...m.armor]);
  return [...new Set([...carried, ...worn, ...ground])].filter((id) => magicDef(id));
}

/** VARSEBLIVNING mot magi: (1) och (2) för de E första föremålen som inte är analyserade. */
export function seekMagic(g: Game, a: Actor, grade: number, range: number): string[] {
  const found = magicNear(g, a, range).filter((id) => knownLevel(g, id) < 2).slice(0, grade);
  for (const id of found) know(g, id, 2);
  return found;
}

/** SYN: (3) för de E första föremålen som magikern och gruppen bär och som inte är helt analyserade. */
export function seeMagic(g: Game, a: Actor, grade: number): string[] {
  const found = magicNear(g, a, 0).filter((id) => knownLevel(g, id) < 3).slice(0, grade);
  for (const id of found) know(g, id, 3);
  return found;
}

// ------------------------------------------------------------------ användning

export interface ItemUse {
  index: number;
  spell: string;
  grade: number;
  nexus: boolean;
}

/** Besvärjelserna som figuren kan använda ur föremålet: analyserat, inte förbrukat och inte ständigt verksamt. */
export function itemUses(g: Game, a: Actor, id: string): ItemUse[] {
  const m = magicDef(id);
  if (!m || knownLevel(g, id) < 3 || !g.charOf(a)?.inventory.includes(id)) return [];
  const spent = g.state.itemSpent?.[id] ?? [];
  return m.spells
    .map((s, index) => ({ index, spell: s.spell, grade: s.grade, nexus: !!s.nexus, s }))
    .filter((u) => !u.s.always && !spent.includes(u.index) && u.spell !== 'laddning')
    .map(({ index, spell, grade, nexus }) => ({ index, spell, grade, nexus }));
}

export function useProblem(g: Game, a: Actor, id: string, index: number): string | null {
  const use = itemUses(g, a, id).find((u) => u.index === index);
  if (!use) return 'Du vet inte hur besvärjelsen aktiveras.';
  if (a.shape) return 'Inte i djurhamn.';
  if (g.state.mode === 'combat') {
    const c = g.state.combat!;
    if (c.order[c.turn] !== a.id || c.acted[a.id] || !g.isPlayerTurn()) return 'Det är inte din tur.';
  } else if (g.state.mode !== 'explore') return 'Inte nu.';
  if (!use.nexus && use.grade >= a.psy) return `Föremålet tar ${use.grade} PSY, och du har bara ${a.psy}.`;
  return null;
}

/**
 * Använder en besvärjelse ur föremålet: den lyckas alltid. Utan NEXUS kostar den lika många PSY som
 * effektgraden, och utan PERMANENS förbrukas den. En brygd förbrukas när den dricks. I strid tar det
 * handlingen.
 */
export function useItem(g: Game, a: Actor, id: string, index: number, o: Partial<CastOptions> = {}): string | null {
  const problem = useProblem(g, a, id, index);
  if (problem) return problem;
  const m = magicDef(id)!;
  const s = m.spells[index];
  // En brygd verkar på den som dricker den (Bok III s. 44).
  const r = castFromItem(g, a, s.spell, s.grade, ITEM_S, m.kind === 'brygd' ? { ...o, target: a.id } : o);
  if (r) return r;
  if (!s.nexus) a.psy -= s.grade;
  g.log(`${a.name} använder ${m.name}${s.nexus ? '' : ` (−${s.grade} PSY)`}.`);
  if (m.kind === 'brygd') {
    const inv = g.charOf(a)!.inventory;
    inv.splice(inv.indexOf(id), 1);
  } else if (!s.permanent) ((g.state.itemSpent ??= {})[id] ??= []).push(index);
  if (g.state.mode === 'combat') {
    g.state.combat!.acted[a.id] = true;
    finishTurn(g);
  }
  g.changed();
  return null;
}

// ------------------------------------------------------------------ föremål som verkar ständigt

/** Verkan för de besvärjelser som kan verka ständigt i ett vapen, en rustning eller en sköld. */
function alwaysEffect(spell: string, grade: number, slot: 'weapon' | 'offhand' | undefined): Partial<ActiveEffect> | null {
  switch (spell) {
    case 'fortrolla_vapen':
      return slot ? { kind: 'vapenMagi', mod: grade, slot } : null;
    case 'skydd':
      return { kind: 'skydd', mod: grade };
    case 'antimagi':
      return { kind: 'antimagi', grade };
    case 'ljus':
      return { kind: 'ljus', mod: 2 * grade };
    case 'virvelskold':
      return { kind: 'virvelsköld' };
    case 'motstandskraft':
      return { kind: 'motståndskraft', grade };
    case 'magisk_syn':
      return { kind: 'magiskSyn' };
    case 'morkersyn':
      return { kind: 'mörkersyn' };
    default:
      return null;
  }
}

/**
 * Lägger på verkan från magiska föremål som figurerna har i händerna eller på kroppen och som verkar
 * ständigt, och tar bort den från dem som inte längre bär dem. Körs när något har ändrats.
 */
export function syncItemEffects(g: Game) {
  for (const a of g.state.actors) {
    if (!a.alive) continue;
    a.effects = a.effects.filter((e) => !e.item?.startsWith('magi:'));
    const worn: [string, 'weapon' | 'offhand' | undefined][] = [[a.weapon, 'weapon'], [a.offhand ?? '', 'offhand'], [a.shield ?? '', undefined], ...a.armor.map((x) => [x, undefined] as [string, undefined])];
    for (const [id, slot] of worn) {
      const m = magicDef(id);
      if (!m) continue;
      for (const s of m.spells) {
        if (!s.always) continue;
        const e = alwaysEffect(s.spell, s.grade, slot);
        if (!e) continue;
        a.effects.push({ label: `${m.name}: ${SPELLS[s.spell]?.name ?? s.spell} E${s.grade}`, persist: true, ...e, item: `magi:${id}` } as ActiveEffect);
      }
    }
  }
}

/** LADDNING i en stav: när den är analyserad kan PSY:n dras ur den som ur ett laddat föremål. */
export function itemCharges(g: Game, a: Actor) {
  const ch = g.charOf(a);
  if (!ch) return;
  for (const id of new Set(ch.inventory)) {
    const m = magicDef(id);
    const charge = m?.spells.find((s) => s.spell === 'laddning');
    if (!m || !charge || knownLevel(g, id) < 3 || ch.charges?.some((c) => c.item === id)) continue;
    (ch.charges ??= []).push({ item: id, psy: charge.grade * 5 });
  }
}
