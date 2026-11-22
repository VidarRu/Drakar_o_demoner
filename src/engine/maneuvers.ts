import { HERBS } from '../data/herbs';
import { MARTIAL_TECHNIQUES } from '../data/skills';
import { WEAPONS } from '../data/weapons';
import { roll } from './dice';
import type { Game } from './game';
import { distance, walkable } from './map';
import {
  addEffect,
  attackOnce,
  canAttackNow,
  canUseSkills,
  drop,
  finishTurn,
  hasEffect,
  hit,
  inReach,
  isParty,
  limbUsable,
  martialOk,
  short,
  skillMod,
  stabilize,
  tick,
  weaponInfo,
  wound,
  type WeaponInfo,
} from './combat';
import { useHerbOn } from './poison';
import { attributeCheck, DISARM, resistance, skillCheck, type HitLocation } from './rules';
import { canMedicine, medicine } from './time';
import type { Actor } from './types';

/**
 * Fler handlingar i strid (steg 7): hjälpa en kamrat, Avväpna (Bok I s. 46), Fasthållning
 * (Bok II s. 21) och stridskonsternas tekniker (Bok I s. 56–58). Tolkningarna står i
 * docs/regelbeslut.md.
 */

const ARMS: HitLocation[] = ['vänster arm', 'höger arm'];

// ------------------------------------------------------------------ hjälpa en kamrat

export type HelpKind = 'förband' | 'kvävning' | 'resa' | 'ört' | 'läkekonst';

export interface HelpOption {
  kind: HelpKind;
  target: string;
  label: string;
}

/** Kan hjälparen göra något alls just nu (i strid: på sin tur och med handlingen kvar)? */
function canHelp(g: Game, a: Actor): boolean {
  if (!canUseSkills(a) || a.elemental) return false;
  if (g.state.mode === 'combat') return g.isPlayerTurn() && g.player === a && !g.state.combat!.acted[a.id];
  return g.state.mode === 'explore';
}

/** Det som hjälparen kan göra för kamrater intill sig. */
export function helpOptions(g: Game, a: Actor): HelpOption[] {
  if (!canHelp(g, a)) return [];
  const hands = ARMS.every((l) => limbUsable(a, l));
  const out: HelpOption[] = [];
  for (const m of g.partyMembers()) {
    if (m === a || distance(a.x, a.y, m.x, m.y) > 1) continue;
    if (hands && m.dying) out.push({ kind: 'förband', target: m.id, label: `Rädda ${m.name} (döende)` });
    else if (hands && m.bleeding.length) out.push({ kind: 'förband', target: m.id, label: `Lägg förband på ${m.name}` });
    if (hands && m.effects.some((e) => e.kind === 'dödsfara' && e.label === 'Kvävs')) out.push({ kind: 'kvävning', target: m.id, label: `Hjälp ${m.name} som kvävs` });
    if (hasEffect(m, 'liggande') && !m.unconscious) out.push({ kind: 'resa', target: m.id, label: `Res upp ${m.name}` });
    if (g.charOf(a)?.herbs.some((d) => HERBS[d.id]?.kind === 'läkedrog')) out.push({ kind: 'ört', target: m.id, label: `Ge ${m.name} en ört` });
    if (g.state.mode === 'explore' && a.skills.lakekonst !== undefined && canMedicine(g, m)) out.push({ kind: 'läkekonst', target: m.id, label: `Läkekonst på ${m.name}` });
  }
  return out;
}

/** Första hjälpen på en blödande kroppsdel. */
export function bandageOnce(g: Game, healer: Actor, patient: Actor): boolean {
  if (patient.dying) {
    // En döende stabiliseras av ett lyckat slag i Första hjälpen (husregel, steg 8).
    const check = skillCheck(g.skillFv(healer, 'forsta_hjalpen'), g.rng, skillMod(g, healer, 'forsta_hjalpen'));
    if (check.success) {
      g.gainExperience(healer, 'forsta_hjalpen', check);
      stabilize(g, patient, `av ${healer.name} (Första hjälpen, ${short(check)})`);
    } else g.log(`${healer.name} försöker rädda ${patient.name} men misslyckas (Första hjälpen, ${short(check)}).`);
    return check.success;
  }
  const loc = patient.bleeding[0];
  if (!loc) return false;
  const check = skillCheck(g.skillFv(healer, 'forsta_hjalpen'), g.rng, skillMod(g, healer, 'forsta_hjalpen'));
  const on = healer === patient ? loc : `${patient.name}s ${loc}`;
  if (check.success) {
    patient.bleeding = patient.bleeding.filter((l) => l !== loc);
    g.gainExperience(healer, 'forsta_hjalpen', check);
    g.log(`${healer.name} lägger förband på ${on} (Första hjälpen, ${short(check)}). Blödningen stannar.`);
  } else g.log(`${healer.name} försöker lägga förband på ${on} men misslyckas (Första hjälpen, ${short(check)}).`);
  return check.success;
}

/** Hjälper en kamrat. I strid tar det handlingen; utanför strid går en runda. Returnerar ett fel eller null. */
export function help(g: Game, a: Actor, kind: HelpKind, targetId: string, arg?: number): string | null {
  const opt = helpOptions(g, a).find((o) => o.kind === kind && o.target === targetId);
  if (!opt) return 'Det går inte just nu.';
  const t = g.actor(targetId)!;
  switch (kind) {
    case 'förband':
      bandageOnce(g, a, t);
      break;
    case 'kvävning': {
      // Tolkning: ett slag i Första hjälpen får tungan på plats.
      const check = skillCheck(g.skillFv(a, 'forsta_hjalpen'), g.rng, skillMod(g, a, 'forsta_hjalpen'));
      if (check.success) {
        t.effects = t.effects.filter((e) => !(e.kind === 'dödsfara' && e.label === 'Kvävs'));
        g.gainExperience(a, 'forsta_hjalpen', check);
        g.log(`${a.name} får loss tungan ur halsen på ${t.name} (Första hjälpen, ${short(check)}). Hen andas igen.`);
      } else g.log(`${a.name} försöker hjälpa ${t.name} som kvävs, men lyckas inte (Första hjälpen, ${short(check)}).`);
      break;
    }
    case 'resa':
      t.effects = t.effects.filter((e) => e.kind !== 'liggande');
      g.log(`${a.name} hjälper ${t.name} på fötter.`);
      break;
    case 'ört': {
      const problem = useHerbOn(g, a, t, arg ?? -1);
      if (problem) return problem;
      break;
    }
    case 'läkekonst':
      medicine(g, a, t);
      break;
  }
  spend(g, a);
  return null;
}

/** I strid kostar handlingen turen; utanför strid går en runda. */
function spend(g: Game, a: Actor) {
  if (g.state.mode === 'combat') {
    g.state.combat!.acted[a.id] = true;
    finishTurn(g);
  } else tick(g, a);
}

// ------------------------------------------------------------------ anfallssätt

export interface ModeInfo {
  id: string;
  name: string;
  /** Kort förklaring till gränssnittet. */
  desc: string;
}

const DAMAGE: Record<string, string> = Object.fromEntries(MARTIAL_TECHNIQUES.filter((t) => t.damage).map((t) => [t.id, t.damage!]));
/** Tekniker som används när man anfaller någon (inte de som alltid är påkopplade). */
const ATTACK_TECHNIQUES = ['normalt_slag', 'normal_spark', 'krosslag', 'rundspark', 'hoppspark', 'dubbelslag', 'dubbelspark', 'bakatspark', 'bedovningsslag', 'lagt_kast', 'hogt_kast', 'lasning'];
const KICKS_WITH_RUN = ['hoppspark', 'dubbelspark'];

/** Anfallssätten som den som styrs kan välja mellan. */
export function attackModes(g: Game, a: Actor): ModeInfo[] {
  const out: ModeInfo[] = [{ id: 'vanligt', name: 'Vanligt anfall', desc: 'Anfall med vapnet i handen.' }];
  if (a.elemental || !a.detailed) return out;
  if (a.skills.avvapna !== undefined && WEAPONS[a.weapon]?.kind === 'närstrid')
    out.push({ id: 'avvapna', name: 'Avväpna', desc: 'Anfall utan skada som inte kan pareras; lyckas Avväpna och STY + FV mot målets STY flyger vapnet.' });
  out.push({ id: 'fasthallning', name: 'Fasthållning', desc: 'Grip tag: CL (STO+SMI+STY)/3, sedan STY mot STY varje runda.' });
  if (martialOk(g, a)) {
    for (const id of ATTACK_TECHNIQUES) {
      if (!a.techniques!.includes(id)) continue;
      const t = MARTIAL_TECHNIQUES.find((x) => x.id === id)!;
      out.push({ id, name: t.name, desc: t.desc });
    }
  }
  return out;
}

const techName = (id: string) => MARTIAL_TECHNIQUES.find((t) => t.id === id)?.name ?? id;

/** Rutan bakom aktören. */
const behind = (a: Actor) => ({ x: a.x - a.facing.dx, y: a.y - a.facing.dy });

/** Varför anfallssättet inte går mot målet, eller null. */
export function maneuverProblem(g: Game, a: Actor, t: Actor, mode: string): string | null {
  if (!canAttackNow(a)) return 'Du kan inte anfalla nu.';
  const d = distance(a.x, a.y, t.x, t.y);
  if (mode === 'avvapna') {
    if (a.skills.avvapna === undefined) return 'Du kan inte Avväpna.';
    if (WEAPONS[a.weapon]?.kind !== 'närstrid') return 'Det krävs ett vapen eller en käpp i handen.';
    if (!WEAPONS[t.weapon] || WEAPONS[t.weapon].kind !== 'närstrid') return `${t.name} har inget vapen att slå ur handen.`;
    return inReach(g, a, t) ? null : 'Målet är utom räckhåll.';
  }
  if (mode === 'fasthallning') {
    if (d !== 1) return 'Du måste stå intill för att gripa tag.';
    if (!ARMS.every((l) => limbUsable(a, l))) return 'Det krävs två hela armar.';
    return null;
  }
  if (!ATTACK_TECHNIQUES.includes(mode) || !a.techniques?.includes(mode)) return 'Du kan inte den tekniken.';
  if (!martialOk(g, a)) return 'Stridskonst kräver tomma händer och högst läderrustning.';
  const tech = MARTIAL_TECHNIQUES.find((x) => x.id === mode)!;
  if (tech.humanoidOnly && !t.detailed) return `${tech.name} går bara mot människolika motståndare.`;
  if (mode === 'bakatspark') {
    const b = behind(a);
    return b.x === t.x && b.y === t.y ? null : 'Bakåtsparken når bara rutan rakt bakom dig.';
  }
  if (KICKS_WITH_RUN.includes(mode)) {
    if ((a.movedLast ?? 0) < 1) return `${tech.name} kräver en rutas ansats: flytta dig först.`;
    return d >= 1 && d <= 2 ? null : 'Målet är utom räckhåll.';
  }
  return d === 1 ? null : 'Målet är utom räckhåll.';
}

/** Ett slag eller en spark ur stridskonsten. Normalt slag och normal spark kan också använda Slagsmål. */
function martialWeapon(g: Game, a: Actor, id: string): WeaponInfo {
  const either = id === 'normalt_slag' || id === 'normal_spark';
  const skill = either && g.skillFv(a, 'slagsmal') > g.skillFv(a, 'stridskonster') ? 'slagsmal' : 'stridskonster';
  return {
    slot: 'weapon',
    id,
    name: techName(id),
    damage: DAMAGE[id] ?? '1T3',
    skill,
    sb: true,
    natural: true,
    unarmed: true,
    twoHanded: false,
    twoHandBonus: false,
    reach: KICKS_WITH_RUN.includes(id) ? 2 : 1,
    entangling: false,
    noParryWear: true,
    bvKey: null,
  };
}

const GRIP: WeaponInfo = {
  slot: 'weapon',
  id: 'grepp',
  name: 'Grepp',
  damage: '0',
  skill: 'slagsmal',
  sb: false,
  natural: true,
  unarmed: true,
  twoHanded: false,
  twoHandBonus: false,
  reach: 1,
  entangling: false,
  noParryWear: true,
  bvKey: null,
};

/** Utför ett anfallssätt. Turen avslutas av den som anropar. */
export function maneuver(g: Game, a: Actor, t: Actor, mode: string) {
  if (maneuverProblem(g, a, t, mode)) return;
  switch (mode) {
    case 'avvapna':
      return disarm(g, a, t);
    case 'fasthallning':
      return grapple(g, a, t);
  }
  const w = martialWeapon(g, a, mode);
  const slow = mode === 'hoppspark' || mode === 'dubbelspark' || mode === 'rundspark';
  if (slow) addEffect(a, { kind: 'initiativ', label: `${w.name}: −2 på initiativet`, mod: -2, rounds: 2 });
  switch (mode) {
    case 'hoppspark':
    case 'dubbelspark': {
      const targets = [t];
      if (mode === 'dubbelspark') {
        const other = g.state.actors.find((x) => x !== t && x.alive && x.hostile && !isParty(x) && distance(x.x, x.y, t.x, t.y) <= 1 && distance(a.x, a.y, x.x, x.y) <= 2);
        if (other) targets.push(other);
      }
      let missed = false;
      for (const x of targets) {
        const r = attackOnce(g, a, x, 'weapon', { weapon: w, locs: ['huvud', 'bröstkorg'] });
        if (r === 'miss' || r === 'parerat') missed = true;
      }
      if (missed) regainBalance(g, a, w.name);
      return;
    }
    case 'rundspark': {
      const r = attackOnce(g, a, t, 'weapon', { weapon: w });
      if (r === 'miss') {
        addEffect(a, { kind: 'ingenHandling', label: 'Återvinner balansen efter rundsparken', rounds: 2 });
        g.log(`${a.name} snurrar runt och tappar balansen: inget anfall eller parering nästa runda.`);
      }
      return;
    }
    case 'dubbelslag': {
      attackOnce(g, a, t, 'weapon', { weapon: w });
      // Båda slagen kan inte riktas mot samma motståndare.
      const other = g.state.actors.find((x) => x !== t && x.alive && x.hostile && !isParty(x) && distance(a.x, a.y, x.x, x.y) === 1);
      if (other && canAttackNow(a)) attackOnce(g, a, other, 'weapon', { weapon: w });
      return;
    }
    case 'bakatspark':
      attackOnce(g, a, t, 'weapon', { weapon: w, keepFacing: true });
      return;
    case 'bedovningsslag':
      attackOnce(g, a, t, 'weapon', { weapon: w, onHit: stun(w) });
      return;
    case 'lagt_kast':
      attackOnce(g, a, t, 'weapon', { weapon: { ...w, name: 'Lågt kast' }, onHit: lowThrow });
      return;
    case 'hogt_kast':
      attackOnce(g, a, t, 'weapon', { weapon: { ...w, name: 'Högt kast' }, onHit: highThrow });
      return;
    case 'lasning':
      attackOnce(g, a, t, 'weapon', { weapon: { ...w, name: 'Låsning' }, onHit: lock });
      return;
    default:
      attackOnce(g, a, t, 'weapon', { weapon: w });
  }
}

/** Efter en hoppspark som inte gick in: ett SMI-slag avgör om man landar på fötterna. */
function regainBalance(g: Game, a: Actor, name: string) {
  const smi = attributeCheck(a.attrs.SMI, g.rng, 'Normalt');
  if (smi.success) {
    addEffect(a, { kind: 'ingenHandling', label: 'Återvinner balansen', rounds: 2 });
    g.log(`${a.name} landar på fötterna efter ${name.toLowerCase()} men måste återvinna balansen nästa runda (SMI-slag, ${short(smi)}).`);
  } else {
    addEffect(a, { kind: 'liggande', label: `Föll efter ${name.toLowerCase()}`, rounds: 2 });
    g.log(`${a.name} ramlar omkull efter ${name.toLowerCase()} (SMI-slag, ${short(smi)}).`);
    getUp(g, a);
  }
}

/** Bedövningsslag: skadar det måste offret klara ett Svårt FYS-slag eller förlora sin nästa handling. */
function stun(w: WeaponInfo) {
  return (g: Game, att: Actor, def: Actor, check: { result: string }) => {
    const before = def.kp;
    hit(g, att, def, w, { perfect: check.result === 'perfekt' });
    if (def.kp >= before || !def.alive || !def.detailed) return 'klart' as const;
    const fys = attributeCheck(def.attrs.FYS, g.rng, 'Svårt');
    if (fys.success) g.log(`${def.name} skakar av sig slaget (Svårt FYS-slag, ${short(fys)}).`);
    else {
      addEffect(def, { kind: 'misslyckas', label: 'Bedövad', scope: 'strid', uses: 1, rounds: 3 });
      g.log(`${def.name} blir bedövad och förlorar sin nästa attack eller parering (Svårt FYS-slag, ${short(fys)}).`);
    }
    return 'klart' as const;
  };
}

/** Lågt kast: offret faller omkull i sin ruta utan att skadas och reser sig efter 1T2 SR. */
function lowThrow(g: Game, att: Actor, def: Actor) {
  const rounds = roll('1T2', g.rng) + 1;
  addEffect(def, { kind: 'liggande', label: 'Omkullkastad', rounds });
  g.log(`${att.name} kastar omkull ${def.name}.`);
  getUp(g, def);
  return 'klart' as const;
}

/** Högt kast: offret kastas 1T3 rutor och landar liggande; ett Svårt SMI-slag annars 1T3 i skada. */
function highThrow(g: Game, att: Actor, def: Actor) {
  const n = roll('1T3', g.rng);
  const dx = Math.sign(def.x - att.x);
  const dy = Math.sign(def.y - att.y);
  for (let i = 0; i < n; i++) {
    const x = def.x + dx;
    const y = def.y + dy;
    if (!walkable(g.map, x, y) || g.actorAt(x, y)) break;
    def.x = x;
    def.y = y;
  }
  addEffect(def, { kind: 'liggande', label: 'Kastad till marken', rounds: 2 });
  g.log(`${att.name} kastar ${def.name} genom luften.`);
  const smi = attributeCheck(def.attrs.SMI, g.rng, 'Svårt');
  if (!smi.success) {
    const dmg = roll('1T3', g.rng);
    g.log(`${def.name} slår i marken och tar ${dmg} i skada (Svårt SMI-slag, ${short(smi)}).`);
    wound(g, def, dmg, null);
  } else g.log(`${def.name} tar emot sig (Svårt SMI-slag, ${short(smi)}).`);
  getUp(g, def);
  return 'klart' as const;
}

/** Låsning: offret dras ned och låses fast. Hen tar sig loss med halva SMI mot anfallarens FV. */
function lock(g: Game, att: Actor, def: Actor) {
  hold(g, att, def, 'Låsning', g.skillFv(att, 'stridskonster'));
  addEffect(def, { kind: 'liggande', label: 'Nerdragen', rounds: 2 });
  return 'klart' as const;
}

/** Uppresning (stridskonst): den som har fällts kan resa sig direkt med ett lyckat slag. */
export function getUp(g: Game, a: Actor) {
  if (!a.techniques?.includes('uppresning') || a.skills.stridskonster === undefined || hasEffect(a, 'fasthållen')) return;
  const check = skillCheck(g.skillFv(a, 'stridskonster'), g.rng, skillMod(g, a, 'stridskonster'));
  if (!check.success) return;
  a.effects = a.effects.filter((e) => e.kind !== 'liggande');
  g.gainExperience(a, 'stridskonster', check);
  g.log(`${a.name} rullar upp på fötterna direkt (Uppresning, ${short(check)}).`);
}

// ------------------------------------------------------------------ Avväpna

/**
 * Avväpna (Bok I s. 46, husregel): anfallet kan inte pareras och gör ingen skada. Går det in slår
 * man Avväpna, och lyckas det ställs STY + FV i Avväpna mot målets STY på motståndstabellen.
 */
function disarm(g: Game, a: Actor, t: Actor) {
  const w = weaponInfo(a);
  attackOnce(g, a, t, 'weapon', {
    weapon: w,
    noParry: true,
    onHit: () => {
      const check = skillCheck(g.skillFv(a, 'avvapna'), g.rng, skillMod(g, a, 'avvapna'));
      if (!check.success) {
        g.log(`${a.name} misslyckas med att avväpna ${t.name} (Avväpna, ${short(check)}).`);
        return 'klart';
      }
      g.gainExperience(a, 'avvapna', check);
      const value = a.attrs.STY + g.skillFv(a, 'avvapna');
      const r = resistance(value, t.attrs.STY, g.rng);
      if (r.success) {
        g.log(`${a.name} slår vapnet ur handen på ${t.name} (Avväpna ${short(check)}; STY + FV ${value} mot STY ${t.attrs.STY}, ${short(r)})!`);
        drop(g, t, 'weapon', DISARM.skill);
      } else g.log(`${t.name} håller kvar vapnet (STY + FV ${value} mot STY ${t.attrs.STY}, ${short(r)}).`);
      return 'klart';
    },
  });
}

// ------------------------------------------------------------------ Fasthållning

/**
 * Fasthållning (Bok II s. 21): ett anfall med CL (STO + SMI + STY) / 3. Går det in ställs
 * anfallarens STY mot försvararens STY. Varje runda som det fortgår slås ett nytt motståndsslag,
 * och ingen av dem kan göra något annat.
 */
function grapple(g: Game, a: Actor, t: Actor) {
  const fv = Math.floor((a.attrs.STO + a.attrs.SMI + a.attrs.STY) / 3);
  attackOnce(g, a, t, 'weapon', {
    weapon: GRIP,
    fv,
    onHit: () => {
      const r = resistance(a.attrs.STY, t.attrs.STY, g.rng);
      if (r.success) hold(g, a, t, 'Fasthållning', 0, r);
      else g.log(`${a.name} griper tag i ${t.name} men hen sliter sig loss (STY ${a.attrs.STY} mot ${t.attrs.STY}, ${short(r)}).`);
      return 'klart';
    },
  });
}

function hold(g: Game, a: Actor, t: Actor, kind: 'Fasthållning' | 'Låsning', fv: number, r?: { roll: number; target: number }) {
  a.effects = a.effects.filter((e) => e.kind !== 'håller');
  addEffect(a, { kind: 'håller', label: `${kind}: håller fast ${t.name}`, sourceId: t.id, mod: fv });
  addEffect(t, { kind: 'fasthållen', label: `${kind}: hålls fast av ${a.name}`, sourceId: a.id, mod: fv });
  g.log(`${a.name} håller fast ${t.name}${r ? ` (STY ${a.attrs.STY} mot ${t.attrs.STY}, T20: ${r.roll} mot ${r.target})` : ''}.`);
}

/** Släpper taget. */
export function release(g: Game, a: Actor, quiet = false) {
  const e = a.effects.find((x) => x.kind === 'håller');
  if (!e) return;
  const t = e.sourceId ? g.actor(e.sourceId) : undefined;
  a.effects = a.effects.filter((x) => x !== e);
  if (t) t.effects = t.effects.filter((x) => !(x.kind === 'fasthållen' && x.sourceId === a.id));
  if (!quiet && t) g.log(`${a.name} släpper taget om ${t.name}.`);
}

/** Vid den som håller fasts tur: ett nytt STY-slag för att hålla kvar (Fasthållning). */
export function keepHold(g: Game, a: Actor) {
  const e = a.effects.find((x) => x.kind === 'håller');
  const t = e?.sourceId ? g.actor(e.sourceId) : undefined;
  if (!e || !t || !t.alive) return release(g, a, true);
  if (e.label.startsWith('Låsning')) {
    g.log(`${a.name} håller ${t.name} låst.`);
    return;
  }
  const r = resistance(a.attrs.STY, t.attrs.STY, g.rng);
  if (r.success) g.log(`${a.name} håller kvar ${t.name} (STY ${a.attrs.STY} mot ${t.attrs.STY}, ${short(r)}).`);
  else {
    g.log(`${t.name} sliter sig loss från ${a.name} (STY ${a.attrs.STY} mot ${t.attrs.STY}, ${short(r)}).`);
    release(g, a, true);
  }
}

/** Vid den fasthållnas tur: ur en låsning tar man sig med halva SMI mot anfallarens FV. */
export function breakHold(g: Game, a: Actor) {
  const e = a.effects.find((x) => x.kind === 'fasthållen');
  const holder = e?.sourceId ? g.actor(e.sourceId) : undefined;
  if (!e || !holder) return;
  if (!e.label.startsWith('Låsning')) return;
  const smi = Math.floor(a.attrs.SMI / 2);
  const r = resistance(smi, e.mod ?? 0, g.rng);
  if (r.success) {
    g.log(`${a.name} vrider sig ur låsningen (halva SMI ${smi} mot FV ${e.mod}, ${short(r)}).`);
    release(g, holder, true);
  } else g.log(`${a.name} kommer inte loss ur låsningen (halva SMI ${smi} mot FV ${e.mod}, ${short(r)}).`);
}

/** I början av rundan: tag som inte längre håller släpps. */
export function holdRound(g: Game) {
  for (const a of g.state.actors) {
    for (const e of a.effects.filter((x) => x.kind === 'håller' || x.kind === 'fasthållen')) {
      const other = e.sourceId ? g.actor(e.sourceId) : undefined;
      const ok = other && other.alive && !other.unconscious && other.effects.some((x) => (x.kind === 'håller' || x.kind === 'fasthållen') && x.sourceId === a.id);
      if (!ok || !a.alive || (e.kind === 'håller' && a.unconscious)) a.effects = a.effects.filter((x) => x !== e);
    }
  }
}

// ------------------------------------------------------------------ rulla (Fallteknik)

/** Fallteknik/Rullning: lyckas slaget rullar man upp till 5 rutor och kan inte huggas förrän nästa tur. */
export function roll5(g: Game, a: Actor): string | null {
  if (!a.techniques?.includes('fallteknik') || a.skills.stridskonster === undefined) return 'Du kan inte rulla.';
  const c = g.state.combat;
  if (!c || !g.isPlayerTurn() || c.acted[a.id] || (a.movedLast ?? 0) > 0) return 'Rullningen tar hela turen och måste göras innan du flyttat dig.';
  const check = skillCheck(g.skillFv(a, 'stridskonster'), g.rng, skillMod(g, a, 'stridskonster'));
  c.acted[a.id] = true;
  if (check.success) {
    g.gainExperience(a, 'stridskonster', check);
    c.movesLeft = 5;
    addEffect(a, { kind: 'rullar', label: 'Rullar', rounds: 2 });
    g.log(`${a.name} rullar iväg (Fallteknik, ${short(check)}): upp till 5 rutor, och kan inte huggas förrän nästa tur.`);
  } else {
    c.movesLeft = 0;
    addEffect(a, { kind: 'liggande', label: 'Misslyckad rullning', rounds: 2 });
    g.log(`${a.name} försöker rulla men blir liggande (Fallteknik, ${short(check)}).`);
  }
  return null;
}

/** Stridskonstens påkopplade tekniker, för rollformuläret. */
export function passiveTechniques(a: Actor): string[] {
  return (a.techniques ?? []).filter((t) => !ATTACK_TECHNIQUES.includes(t)).map(techName);
}
