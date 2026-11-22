import { NON_IRON_WEAPONS, WEAPONS } from '../data/weapons';
import { roll } from './dice';
import type { Game } from './game';
import { makeActor } from './game';
import { distance, lineOfSight, tileAt, walkable } from './map';
import {
  addEffect,
  darkAt,
  DIRS,
  finishTurn,
  isOut,
  isParty,
  moraleCheck,
  scare,
  short,
  torchLit,
  wearItem,
  weaponMagic,
  type WeaponInfo,
} from './combat';
import { attributeCheck, DAY, HOUR, resistance } from './rules';
import type { Actor, ElementKind } from './types';

/**
 * Elementarer (Bok III s. 21–22 och 27). Alla har PSY 3T6, SMI 3T6 och STO 1T6, och för varje
 * effektgrad utöver den första +1T6 STO och +1T6 PSY. KP och STY är lika med STO. De saknar FYS och
 * INT, är immuna mot gift och styrs av magikern utan att det kostar en handling. Tolkningarna står i
 * docs/regelbeslut.md.
 */

interface ElementalDef {
  name: string;
  sprite: string;
  /** Förflyttning i rutor per SR. */
  move: number;
  /** Anfall: skada per grad (eller fast), och CL. */
  attack?: { name: string; dice: string; perGrade: boolean; cl: (e: number) => number; armor: boolean };
  /** Hur materiella vapen biter: inte alls, bara magiska, halv skada eller som vanligt. */
  material: 'immun' | 'magi' | 'halv' | 'full';
  /** Elementarer som den kan förstöra genom att övervinna deras grad. */
  destroys: ElementKind[];
  /** Immun mot eld- respektive köldattacker, eller tar dubbel skada. */
  fire?: 'immun' | 'dubbel';
  cold?: 'immun' | 'dubbel';
  darkvision?: boolean;
  /** Kyla eller hetta runt sig (glacial, therm): Svårt FYS-slag inom 2 rutor. */
  aura?: string;
}

export const ELEMENTALS: Record<ElementKind, ElementalDef> = {
  luft: { name: 'Sylf', sprite: 'sylf', move: 10, material: 'immun', destroys: ['eld'] },
  eld: {
    name: 'Salamander',
    sprite: 'salamander',
    move: 6,
    // Boken anger ingen CL för salamanderns lågor; den får samma som glacialen och thermen (tolkning).
    attack: { name: 'Lågor', dice: '1T6', perGrade: true, cl: (e) => 8 + e, armor: true },
    material: 'full',
    destroys: ['luft', 'köld'],
  },
  jord: {
    name: 'Gnom',
    sprite: 'gnom',
    move: 6,
    attack: { name: 'Knytnäve', dice: '1T4', perGrade: true, cl: (e) => 6 + 2 * e, armor: true },
    material: 'full',
    destroys: ['vatten'],
  },
  vatten: {
    name: 'Undin',
    sprite: 'undin',
    // Tio rutor i vatten, men vattnet går inte att beträda i spelet: en ruta per SR på land.
    move: 1,
    attack: { name: 'Virvel', dice: '1T8', perGrade: false, cl: (e) => 8 + e, armor: false },
    material: 'halv',
    destroys: ['jord'],
  },
  mörker: { name: 'Umbra', sprite: 'umbra', move: 15, material: 'immun', destroys: ['ljus'], fire: 'dubbel', darkvision: true },
  ljus: { name: 'Luminal', sprite: 'luminal', move: 15, material: 'immun', destroys: ['mörker'], fire: 'immun', darkvision: true },
  köld: {
    name: 'Glacial',
    sprite: 'glacial',
    move: 6,
    attack: { name: 'Kram', dice: '1T4', perGrade: true, cl: (e) => 8 + e, armor: true },
    material: 'full',
    destroys: ['eld', 'värme'],
    cold: 'immun',
    fire: 'dubbel',
    aura: 'den starka kylan',
  },
  värme: {
    name: 'Therm',
    sprite: 'therm',
    move: 15,
    attack: { name: 'Hetta', dice: '1T4', perGrade: true, cl: (e) => 8 + e, armor: true },
    material: 'magi',
    destroys: ['köld'],
    fire: 'immun',
    cold: 'dubbel',
    aura: 'den starka hettan',
  },
};

// ------------------------------------------------------------------ att frammana

const hourOf = (t: number) => Math.floor((t % DAY) / HOUR);
const daylight = (g: Game) => hourOf(g.state.time) >= 6 && hourOf(g.state.time) < 21;

/** Rutor runt en punkt. */
const around = (x: number, y: number) => DIRS.map(([dx, dy]) => ({ x: x + dx, y: y + dy }));

/**
 * Elementaren måste ha lite av sitt element att uppenbara sig ur (tolkningar): luft finns överallt,
 * jord under bar mark, eld och värme ur en tänd fackla, vatten ur dammen, mörker i grottan eller
 * natten, ljus i dagsljus eller facklans sken. Fruset finns inte i Gråvad.
 */
export function elementSourceProblem(g: Game, caster: Actor, kind: ElementKind): string | null {
  switch (kind) {
    case 'luft':
      return null;
    case 'jord':
      return [{ x: caster.x, y: caster.y }, ...around(caster.x, caster.y)].some((p) => ['gräs', 'stig', 'grottgolv', 'berg'].includes(tileAt(g.map, p.x, p.y)?.name))
        ? null
        : 'Gnomen behöver bar jord att uppstå ur.';
    case 'eld':
    case 'värme':
      return ownTorch(g, caster) ? null : 'Det krävs eld att frammana den ur, till exempel en tänd fackla.';
    case 'vatten':
      return waterNear(g, caster) ? null : 'Det finns inget vatten inom räckhåll.';
    case 'mörker':
      return darkAt(g, caster) || !daylight(g) ? null : 'Umbran kan bara frammanas ur mörker eller skugga.';
    case 'ljus':
      return (!darkAt(g, caster) && daylight(g)) || torchLit(g, caster) ? null : 'Luminalen behöver ett ljus att uppstå ur.';
    case 'köld':
      return 'Glacialen måste frammanas ur något fruset, och det finns inget fruset här.';
  }
}

/** Magikern eller någon intill har en tänd fackla. */
function ownTorch(g: Game, caster: Actor): boolean {
  return g.state.actors.some((a) => a.alive && isParty(a) && !a.elemental && !a.torchOut && distance(a.x, a.y, caster.x, caster.y) <= 1);
}

function waterNear(g: Game, caster: Actor): { x: number; y: number } | null {
  for (let r = 1; r <= 10; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const x = caster.x + dx;
        const y = caster.y + dy;
        if (tileAt(g.map, x, y)?.name === 'vatten' && lineOfSight(g.map, caster.x, caster.y, x, y)) return { x, y };
      }
  return null;
}

/** Närmsta lediga ruta intill en punkt. */
function freeNear(g: Game, at: { x: number; y: number }): { x: number; y: number } | null {
  for (let r = 1; r <= 4; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const x = at.x + dx;
        const y = at.y + dy;
        if (walkable(g.map, x, y) && !g.actorAt(x, y)) return { x, y };
      }
  return null;
}

/** Varför elementaren inte kan frammanas (eller skickas bort) just nu, eller null. */
export function summonProblem(g: Game, caster: Actor, kind: ElementKind, target?: Actor): string | null {
  if (target && target !== caster) {
    if (!target.elemental) return 'Välj dig själv för att frammana, eller en elementar för att skicka bort den.';
    return target.elemental.kind === kind ? null : `Besvärjelsen kan bara skicka bort en ${ELEMENTALS[kind].name.toLowerCase()}.`;
  }
  if (g.state.mode !== 'combat') return 'Elementarer frammanas bara i strid i spelet.';
  if (g.state.actors.some((a) => a.alive && a.elemental?.caster === caster.id)) return 'Du styr redan en elementar.';
  return elementSourceProblem(g, caster, kind);
}

/** Frammanar en elementar intill magikern, eller skickar bort målet om det är en elementar av samma sort. */
export function summonOrBanish(g: Game, caster: Actor, target: Actor, kind: ElementKind, grade: number, S: number, extraDuration: number) {
  if (target !== caster && target.elemental) {
    const r = resistance(grade, target.elemental.grade, g.rng);
    if (r.success) dissolve(g, target, `${target.name} skickas bort (E${grade} mot grad ${target.elemental.grade}, ${short(r)}).`);
    else g.log(`${target.name} står emot (E${grade} mot grad ${target.elemental.grade}, ${short(r)}).`);
    return;
  }
  const def = ELEMENTALS[kind];
  const origin = kind === 'vatten' ? (waterNear(g, caster) ?? caster) : caster;
  const at = freeNear(g, origin);
  if (!at) {
    g.log(`Det finns ingen plats för ${def.name.toLowerCase()}en.`);
    return;
  }
  const extra = grade - 1;
  const sto = roll('1T6', g.rng) + (extra ? roll(`${extra}T6`, g.rng) : 0);
  const psy = roll('3T6', g.rng) + (extra ? roll(`${extra}T6`, g.rng) : 0);
  const smi = roll('3T6', g.rng);
  const id = `a${g.state.nextId++}`;
  const e = makeActor(
    {
      id,
      defId: `elementar:${kind}`,
      name: `${def.name} (E${grade})`,
      kind: 'player',
      sprite: def.sprite,
      x: at.x,
      y: at.y,
      attrs: { STY: sto, STO: sto, FYS: 0, SMI: smi, INT: 0, PSY: psy, KAR: 0 },
      skills: def.attack ? { elementar: def.attack.cl(grade) } : {},
      weapon: 'nave',
      armor: [],
      naturalArmor: 0,
      move: def.move,
      hostile: false,
      detailed: false,
      sight: 8,
      darkvision: !!def.darkvision,
      silver: 0,
    },
    { elemental: { kind, grade, caster: caster.id, rounds: Math.max(1, S * (1 + extraDuration)) }, noMorale: true, torchOut: true },
  );
  e.kp = e.maxKp = sto;
  g.state.actors.push(e);
  g.state.combat?.order.push(id);
  addEffect(caster, { kind: 'styr', label: `Styr ${def.name.toLowerCase()}en`, sourceId: id });
  g.log(`En ${def.name.toLowerCase()} uppenbarar sig (STO ${sto}, PSY ${psy}, SMI ${smi}). ${caster.name} styr den.`);
  g.updateFov();
}

/** Elementaren försvinner, och magikern är fri igen. */
export function dissolve(g: Game, e: Actor, text: string) {
  e.alive = false;
  const caster = e.elemental ? g.actor(e.elemental.caster) : undefined;
  if (caster) caster.effects = caster.effects.filter((x) => !(x.kind === 'styr' && x.sourceId === e.id));
  g.log(text);
}

/** I början av varje runda: tiden går, och en elementar som ingen styr försvinner. Kyla och hetta verkar. */
export function elementalRound(g: Game) {
  for (const e of g.state.actors.filter((a) => a.alive && a.elemental)) {
    const info = e.elemental!;
    const caster = g.actor(info.caster);
    info.rounds--;
    if (info.rounds <= 0) dissolve(g, e, `${e.name} återvänder till sitt element.`);
    else if (!caster || !caster.alive || caster.unconscious || !caster.effects.some((x) => x.kind === 'styr' && x.sourceId === e.id))
      dissolve(g, e, `Ingen styr längre ${e.name}, och den upplöses.`);
    else aura(g, e);
  }
}

function aura(g: Game, e: Actor) {
  const def = ELEMENTALS[e.elemental!.kind];
  if (!def.aura) return;
  for (const x of g.state.actors) {
    if (!x.alive || x.elemental || x.fled || x.unconscious || distance(x.x, x.y, e.x, e.y) > 2) continue;
    const fys = attributeCheck(x.attrs.FYS, g.rng, 'Svårt');
    if (fys.success) continue;
    addEffect(x, { kind: 'flämtar', label: `Flämtar i ${def.aura}`, rounds: 1 });
    g.log(`${x.name} står och flämtar i ${def.aura} (Svårt FYS-slag, ${short(fys)}).`);
  }
}

// ------------------------------------------------------------------ i strid

/** Elementarens anfall som ett naturligt vapen (vapenlängd 0). */
export function elementalWeapon(a: Actor): WeaponInfo {
  const def = ELEMENTALS[a.elemental!.kind];
  const atk = def.attack;
  const e = a.elemental!.grade;
  return {
    slot: 'weapon',
    id: `elementar:${a.elemental!.kind}`,
    name: atk?.name ?? 'Ingenting',
    damage: atk ? (atk.perGrade ? `${e}${atk.dice.slice(1)}` : atk.dice) : '0',
    skill: 'elementar',
    sb: false,
    natural: true,
    unarmed: false,
    twoHanded: false,
    twoHandBonus: false,
    reach: 1,
    entangling: false,
    noParryWear: true,
    bvKey: null,
  };
}

/** Kan elementaren anfalla med ett vanligt anfall? */
export const elementalAttacks = (a: Actor) => !!ELEMENTALS[a.elemental!.kind].attack;

/**
 * En träff mot en elementar med ett vapen: sylf, umbra och luminal skadas inte av materiella vapen,
 * thermen bara av magiska, undinen tar halv skada. Salamandern, gnomen, glacialen och thermen skadar
 * vapnen som träffar dem. Returnerar skadan som går in, eller null om ingen gör det.
 */
export function elementalTakes(g: Game, att: Actor, def: Actor, w: WeaponInfo, dmg: number): number | null {
  const info = def.elemental!;
  const d = ELEMENTALS[info.kind];
  const magic = weaponMagic(att, w.slot) > 0 || !!att.elemental;
  const key = w.bvKey;
  const harm = (amount: number, why: string) => {
    if (key && att.bv[key] !== undefined && amount > att.bv[key]) wearItem(g, att, key, why);
  };
  if (!magic && (d.material === 'immun' || d.material === 'magi')) {
    g.log(`${w.name} går rakt igenom ${def.name} utan att skada den.`);
    if (d.material === 'magi' && key && att.bv[key] !== undefined) wearItem(g, att, key, 'tar skada av hettan');
    return null;
  }
  if (!w.natural && !magic) {
    if (info.kind === 'eld') harm(roll(`${info.grade}T6`, g.rng), 'tar skada av lågorna');
    if (info.kind === 'jord') {
      const t100 = Math.floor(g.rng() * 100) + 1;
      if (t100 > att.attrs.PSY * 5) {
        g.log(`Gnomens lera griper tag i vapnet (1T100: ${t100} mot PSY × 5 = ${att.attrs.PSY * 5}).`);
        harm(dmg, 'tar lika mycket skada');
      }
    }
    if (info.kind === 'köld' && WEAPONS[att.weapon] && !NON_IRON_WEAPONS.has(att.weapon) && key) wearItem(g, att, key, 'rostar av kylan');
  }
  return d.material === 'halv' && !magic ? Math.floor(dmg / 2) : dmg;
}

/** Eld- och köldbesvärjelser mot elementarer: 0 (immun), 1 eller 2 (dubbel skada). */
export function spellVersusElemental(_g: Game, spell: string, t: Actor): number {
  if (!t.elemental) return 1;
  const d = ELEMENTALS[t.elemental.kind];
  const kind = ['eld', 'flammande_hand'].includes(spell) ? d.fire : ['frost', 'kalla_handen'].includes(spell) ? d.cold : undefined;
  return kind === 'immun' ? 0 : kind === 'dubbel' ? 2 : 1;
}

// ------------------------------------------------------------------ särskilda handlingar

export interface ElementalAction {
  id: string;
  label: string;
  /** Möjliga mål (aktörs-id), tomt om handlingen inte behöver något mål. */
  targets: string[];
}

const adjacent = (a: Actor, b: Actor) => distance(a.x, a.y, b.x, b.y) <= 1;
const metalWeapon = (a: Actor) => !!WEAPONS[a.weapon] && WEAPONS[a.weapon].kind === 'närstrid' && !NON_IRON_WEAPONS.has(a.weapon);

/** Det som elementaren kan göra på sin tur utöver att flytta och anfalla. */
export function actions(g: Game, e: Actor): ElementalAction[] {
  const info = e.elemental;
  const c = g.state.combat;
  if (!info || !c || !g.isPlayerTurn() || g.player !== e || c.acted[e.id]) return [];
  const foes = g.state.actors.filter((x) => x.alive && x.hostile && !isParty(x) && !isOut(x));
  const friends = g.state.actors.filter((x) => x.alive && isParty(x) && !x.elemental && x.id !== info.caster);
  const caster = g.actor(info.caster)!;
  const out: ElementalAction[] = [];
  const add = (id: string, label: string, targets: Actor[]) => {
    if (targets.length) out.push({ id, label, targets: targets.map((x) => x.id) });
  };
  switch (info.kind) {
    case 'luft':
      add('blåsa', 'Blås omkull (STO mot STO)', foes.filter((x) => adjacent(e, x)));
      add('styra', 'Styr nästa skott', [caster, ...friends].filter((x) => !!WEAPONS[x.weapon] && WEAPONS[x.weapon].kind !== 'närstrid'));
      break;
    case 'eld':
      add('hetta', 'Hetta upp ett metallvapen', [caster, ...friends].filter((x) => adjacent(e, x) && metalWeapon(x)));
      if (g.state.actors.some((x) => x.alive && isParty(x) && !x.elemental && !x.torchOut && adjacent(e, x)) && e.kp < e.maxKp) out.push({ id: 'läka', label: 'Hämta kraft ur facklan', targets: [] });
      break;
    case 'mörker':
      add('skräck', 'Svep in i skräck (PSY mot PSY)', foes.filter((x) => adjacent(e, x) && x.attrs.INT > 0));
      break;
    case 'ljus':
      if (foes.some((x) => g.canSee(x, e))) out.push({ id: 'blända', label: 'Blända fienderna', targets: [] });
      break;
    case 'köld':
      add('kyla', 'Kyl ned ett metallvapen', [caster, ...friends].filter((x) => adjacent(e, x) && metalWeapon(x)));
      break;
    case 'värme':
      add('värma', 'Värm ett metallvapen', [caster, ...friends].filter((x) => adjacent(e, x) && metalWeapon(x)));
      break;
  }
  const destroyable = g.state.actors.filter((x) => x.alive && x.elemental && x.hostile && ELEMENTALS[info.kind].destroys.includes(x.elemental.kind) && adjacent(e, x));
  add('förinta', 'Förinta elementaren', destroyable);
  out.push({ id: 'släpp', label: 'Släpp elementaren', targets: [] });
  return out;
}

/** Utför en särskild handling. Det tar elementarens tur. Returnerar ett fel eller null. */
export function act(g: Game, e: Actor, id: string, targetId?: string): string | null {
  const action = actions(g, e).find((x) => x.id === id);
  if (!action) return 'Det går inte nu.';
  if (action.targets.length && (!targetId || !action.targets.includes(targetId))) return 'Välj ett mål.';
  const t = targetId ? g.actor(targetId)! : undefined;
  const info = e.elemental!;
  const E = info.grade;
  switch (id) {
    case 'blåsa': {
      const r = resistance(e.attrs.STO, t!.attrs.STO, g.rng);
      if (r.success) {
        addEffect(t!, { kind: 'liggande', label: 'Omkullblåst', rounds: 2 });
        g.log(`${e.name} blåser omkull ${t!.name} (STO ${e.attrs.STO} mot ${t!.attrs.STO}, ${short(r)}).`);
      } else g.log(`${t!.name} står emot vinden (STO ${e.attrs.STO} mot ${t!.attrs.STO}, ${short(r)}).`);
      break;
    }
    case 'styra':
      t!.effects = t!.effects.filter((x) => x.kind !== 'sylfstyrd');
      addEffect(t!, { kind: 'sylfstyrd', label: `${e.name} styr nästa skott`, mod: E, grade: E, rounds: 3 });
      g.log(`${e.name} lägger sig kring ${t!.name}s nästa skott: +${E} på CL och ${E}T3 i skada.`);
      break;
    case 'hetta':
    case 'kyla':
    case 'värma':
      heatWeapon(g, e, t!, id);
      break;
    case 'läka': {
      const n = roll(`${E}T6`, g.rng);
      e.kp = Math.min(e.maxKp, e.kp + n);
      g.log(`${e.name} slickar i sig kraft ur facklan och läker ${n} KP.`);
      break;
    }
    case 'skräck': {
      const r = resistance(e.attrs.PSY, t!.attrs.PSY, g.rng);
      if (!r.success) g.log(`${t!.name} står emot mörkret (PSY ${e.attrs.PSY} mot ${t!.attrs.PSY}, ${short(r)}).`);
      else {
        g.log(`${e.name} sveper sig om ${t!.name} (PSY ${e.attrs.PSY} mot ${t!.attrs.PSY}, ${short(r)}).`);
        // Fiender slår inte på Skräcktabellen (husregel); de slår moral i stället.
        if (g.charOf(t)) scare(g, t!, e, umbraFear(e));
        else if (!t!.noMorale) moraleCheck(g, t!, 'skräck från umbran');
      }
      break;
    }
    case 'blända':
      for (const x of g.state.actors.filter((y) => y.alive && y.hostile && !isParty(y) && !y.unconscious && g.canSee(y, e))) {
        const hard = x.darkvision ? 'Svårt' : 'Normalt';
        const psy = attributeCheck(x.attrs.PSY, g.rng, hard);
        if (psy.success) g.log(`${x.name} vänder bort blicken i tid (${hard} PSY-slag, ${short(psy)}).`);
        else {
          addEffect(x, { kind: 'blind', label: 'Bländad av luminalen', rounds: roll('2T6', g.rng) });
          g.log(`${x.name} bländas (${hard} PSY-slag, ${short(psy)}).`);
        }
      }
      break;
    case 'förinta': {
      const other = t!.elemental!;
      const r = resistance(E, other.grade, g.rng);
      if (r.success) dissolve(g, t!, `${e.name} förintar ${t!.name} (grad ${E} mot ${other.grade}, ${short(r)}).`);
      else g.log(`${t!.name} står emot (grad ${E} mot ${other.grade}, ${short(r)}).`);
      break;
    }
    case 'släpp':
      dissolve(g, e, `${g.actor(info.caster)?.name ?? 'Magikern'} släpper ${e.name}, som återvänder till sitt element.`);
      if (g.state.mode === 'combat') finishTurn(g);
      return null;
  }
  if (g.state.mode === 'combat') {
    g.state.combat!.acted[e.id] = true;
    finishTurn(g);
  }
  return null;
}

/**
 * Salamandern hettar upp ett metallvapen (+1T6 i SR lika med graden, men vapnet tar 1T6 per grad),
 * glacialen kyler det och thermen värmer det (+1T4 per grad i 1T4+5 SR, 5 % per grad att vapnet
 * splittras eller smälter vid första träffen).
 */
function heatWeapon(g: Game, e: Actor, t: Actor, how: 'hetta' | 'kyla' | 'värma') {
  const E = e.elemental!.grade;
  t.effects = t.effects.filter((x) => x.kind !== 'vapenElement');
  const name = WEAPONS[t.weapon]?.name.toLowerCase() ?? 'vapnet';
  if (how === 'hetta') {
    addEffect(t, { kind: 'vapenElement', label: `Glödande ${name}`, slot: 'weapon', dice: '1T6', rounds: E + 1 });
    g.log(`${e.name} hettar upp ${t.name}s ${name}: +1T6 i skada i ${E} SR.`);
    const harm = roll(`${E}T6`, g.rng);
    if (t.bv.weapon !== undefined && harm > t.bv.weapon) wearItem(g, t, 'weapon', 'tar skada av hettan');
    return;
  }
  const rounds = roll('1T4', g.rng) + 5 + 1;
  addEffect(t, { kind: 'vapenElement', label: how === 'kyla' ? `Iskallt ${name}` : `Hett ${name}`, slot: 'weapon', dice: `${E}T4`, rounds, mod: 5 * E, uses: 1 });
  g.log(`${e.name} ${how === 'kyla' ? 'kyler ned' : 'värmer'} ${t.name}s ${name}: +${E}T4 i skada i ${rounds - 1} SR.`);
}

/** Skräckvärdet för en elementar som angriper med skräck (umbran): dess grad. */
export const umbraFear = (e: Actor) => e.elemental?.grade ?? 1;
