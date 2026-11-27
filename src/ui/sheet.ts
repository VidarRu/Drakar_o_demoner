import { abilitiesOf } from '../engine/hero';
import { ARMOR, SHIELDS } from '../data/armor';
import { ITEMS } from '../data/equipment';
import { PROFESSIONS } from '../data/professions';
import { RACES } from '../data/races';
import { SKILL_LIST, SKILLS } from '../data/skills';
import { SPELLS } from '../data/spells';
import { spellS } from '../engine/magic';
import type { MeleeWeaponDef, RangedWeaponDef } from '../data/types';
import { WEAPONS } from '../data/weapons';
import { armorBv, armorPiece, damageExpr, effectiveMove, skillFvOf, weaponInfo, type WeaponInfo } from '../engine/combat';
import { previewCharacter, skillName, type Draft } from '../engine/creation';
import { actorFromCharacter, type Game } from '../engine/game';
import { bLevel, damageBonus, type HitLocation } from '../engine/rules';
import type { Actor, AttrKey, Character } from '../engine/types';
import { bodyFigure } from './figure';
import { el } from './hud';

/**
 * Rollformuläret, uppställt som originalformuläret från 1991: framsidan med grundegenskaper och
 * färdigheter, baksidan med kroppsfiguren, vapnen och utrustningen. Värdena skrivs med en
 * handstil, som med blyerts på papper.
 */

const ATTR_NAMES: Record<AttrKey, string> = {
  STY: 'Styrka',
  FYS: 'Fysik',
  SMI: 'Smidighet',
  INT: 'Intelligens',
  PSY: 'Psyke',
  KAR: 'Karisma',
  STO: 'Storlek',
};
const ATTR_ORDER: AttrKey[] = ['STY', 'FYS', 'SMI', 'INT', 'PSY', 'KAR', 'STO'];

const LANGUAGES = ['tala_frammande', 'las_skriv_frammande'];
const isLanguage = (key: string) => LANGUAGES.includes(key.split(':')[0]);

/** Ett handskrivet värde. `ink` är nyckeln som följer värdet mellan ritningar (se ink.ts). */
function hand(text: string | number, cls = '', ink?: string): HTMLElement {
  const e = el('span', `hand ${cls}`.trim(), String(text));
  if (ink !== undefined) e.dataset.ink = ink;
  return e;
}

/** Det rollformuläret ritas från: aktören och rollpersonen, från ett spel eller från ett utkast. */
export interface SheetSource {
  actor: Actor;
  char: Character;
  fv: (skill: string) => number;
  weapon: (slot: 'weapon' | 'offhand') => WeaponInfo;
  move: number;
  /** Falskt när ett utkast saknar ålder i år och rasen saknar åldersgrupper: fältet Ålder lämnas tomt. */
  ageKnown?: boolean;
}

export function sheetFromGame(g: Game): SheetSource {
  const actor = g.player;
  return {
    actor,
    char: g.char,
    fv: (skill) => g.skillFv(actor, skill),
    weapon: (slot) => g.weaponOf(actor, slot),
    move: effectiveMove(actor, g),
  };
}

export function sheetFromDraft(d: Draft): SheetSource {
  const char = previewCharacter(d);
  const actor = actorFromCharacter(char, 'player', 0, 0);
  return {
    actor,
    char,
    fv: (skill) => skillFvOf(actor, skill),
    weapon: (slot) => weaponInfo(actor, slot),
    move: effectiveMove(actor),
    ageKnown: d.years !== undefined || !!RACES[d.race]?.ages,
  };
}

/** En ruta med röd rubrikrad och eventuella kolumnrubriker till höger. */
function box(title: string, cols: string[], ...content: HTMLElement[]): HTMLElement {
  const b = el('section', 'rf-box');
  const bar = el('header', 'rf-bar');
  bar.append(el('span', '', title));
  if (cols.length) {
    const right = el('span', 'cols');
    for (const c of cols) right.append(el('i', '', c));
    bar.append(right);
  }
  b.append(bar, ...content);
  return b;
}

/** Linjerad tabell: varje rad är [etikett, ...värden]. Tomma rader fyller ut som på papperet. */
function lined(rows: (string | HTMLElement)[][], cols: number, minRows = 0): HTMLElement {
  const t = el('table', 'rf-lines');
  const body = el('tbody');
  const all = [...rows];
  while (all.length < minRows) all.push(['']);
  for (const r of all) {
    const tr = el('tr');
    for (let i = 0; i < cols; i++) {
      const td = el('td', i === 0 ? 'label' : 'val');
      const v = r[i];
      if (v instanceof HTMLElement) td.append(v);
      else if (v) td.append(i === 0 ? document.createTextNode(v) : hand(v, '', typeof r[0] === 'string' ? `${r[0]}|${i}` : undefined));
      tr.append(td);
    }
    body.append(tr);
  }
  t.append(body);
  return t;
}

/** Rutor att kryssa i för KP: förlorade poäng är överkryssade. */
function kpBoxes(max: number, current: number, perRow = 0): HTMLElement {
  const wrap = el('span', 'rf-boxes');
  if (perRow) wrap.style.gridTemplateColumns = `repeat(${perRow}, 1fr)`;
  const lost = max - Math.max(0, Math.min(max, current));
  for (let i = 0; i < max; i++) wrap.append(el('i', i >= max - lost ? 'x' : ''));
  return wrap;
}

function field(label: string, value: string, cls = ''): HTMLElement {
  const f = el('div', `rf-field ${cls}`.trim());
  f.append(el('small', '', label), hand(value, '', label));
  return f;
}

function weight(id: string): number {
  return (WEAPONS[id] ?? SHIELDS[id] ?? ARMOR[id] ?? ITEMS[id])?.weight ?? 0;
}

function itemName(id: string): string {
  return (WEAPONS[id] ?? SHIELDS[id] ?? ARMOR[id] ?? ITEMS[id])?.name ?? id;
}

const kg = (n: number) => (n ? `${String(Math.round(n * 10) / 10).replace('.', ',')} kg` : '');

// ------------------------------------------------------------------ framsidan

function front(src: SheetSource): HTMLElement {
  const p = src.actor;
  const ch = src.char;
  const race = RACES[ch.race];
  const prof = PROFESSIONS[ch.profession];
  const page = el('article', 'rf-page rf-front');

  const head = el('header', 'rf-head');
  const logo = el('div', 'rf-logo');
  const title = el('div', 'rf-title');
  title.append(el('b', '', 'Drakar'), el('em', '', 'och'), el('b', '', 'Demoner'));
  logo.append(title, el('div', 'rf-sub', 'Rollformulär'));
  const fields = el('div', 'rf-fields');
  fields.append(
    field('Spelare', ''),
    field('Spelledare', 'AI-spelledaren'),
    field('Namn', p.name, 'wide'),
    field('Ras', race.name),
    field('Kön', ch.gender),
    field('Socialt stånd', ch.social),
    field('Yrke', prof.name),
    field('Svärdshand', ch.swordHand),
    field('Ålder', src.ageKnown === false ? '' : `${ch.age.years} år (${ch.age.group})`),
  );
  head.append(logo, fields);

  const attrs = lined(
    ATTR_ORDER.map((k) => [`${ATTR_NAMES[k]} (${k})`, String(p.attrs[k])]),
    2,
  );
  attrs.classList.add('attrs');

  const mark = (k: string) => (p.ep[k] ? String(p.ep[k]) : '');
  const fv = (k: string) => (p.skills[k] !== undefined ? String(p.skills[k]) : '');
  const primaries = SKILL_LIST.filter((s) => s.type === 'primär').sort((a, b) => a.name.localeCompare(b.name, 'sv'));
  const primRows = primaries.flatMap((s) => {
    const label = `${s.name} (${s.attr === 'spec' ? 'spec.' : s.attr})`;
    // Specialiserade färdigheter (modersmålen) står med ett värde per språk.
    const keys = Object.keys(p.skills).filter((k) => k.startsWith(`${s.id}:`));
    if (keys.length) return keys.map((k) => [`${skillName(k)} (spec.)`, mark(k), fv(k)]);
    return [[label, mark(s.id), fv(s.id)]];
  });

  const profRows = ch.profSkills.filter((k) => !isLanguage(k)).map((k) => [skillName(k), mark(k), fv(k)]);
  const langs = Object.keys(p.skills).filter(isLanguage);
  const langRows = langs.map((k) => [skillName(k), fv(k), `B${bLevel(p.skills[k])}`]);
  const secondary = Object.entries(p.skills)
    .filter(([k, v]) => v > 0 && !ch.profSkills.includes(k) && SKILLS[k.split(':')[0]]?.type !== 'primär' && !isLanguage(k))
    .map(([k]) => k)
    .sort((a, b) => skillName(a).localeCompare(skillName(b), 'sv'));
  const secRows = secondary.map((k) => [skillName(k), mark(k), fv(k)]);

  const inkParagraph = (text: string, key: string, cls = 'hand'): HTMLElement => {
    const p = el('p', cls, text);
    p.dataset.ink = key;
    return p;
  };
  /** Förmågor nycklas på rubriken före kolon. */
  const ability = (text: string) => inkParagraph(text, `Särskilda förmågor|${text.split(':')[0]}`);
  const abilities = el('div', 'rf-text');
  for (const { def } of abilitiesOf(ch)) abilities.append(ability(`${def.name}: ${def.desc}`));
  abilities.append(ability(`${prof.ability.name}: ${prof.ability.desc}`));
  if (ch.heroTotal) abilities.append(ability(`Hjältepoäng: ${ch.heroPoints ?? 0} (${ch.heroTotal} i livet)`));
  if (ch.academy) abilities.append(ability('Medlem i magiakademin'));
  for (const ph of ch.phobias ?? []) abilities.append(ability(`Fobi (${ph.level}): ${ph.source}`));
  if (ch.techniques.length) abilities.append(ability(`Tekniker: ${ch.techniques.join(', ').replace(/_/g, ' ')}`));

  const cols = el('div', 'rf-cols');
  const c1 = el('div', 'col');
  c1.append(box('Grundegenskap', ['Värde'], attrs), box('Primära färdigheter', ['erf', 'FV'], lined(primRows, 3)));
  const c2 = el('div', 'col');
  c2.append(
    box('Utseende', [], inkParagraph(ch.appearance || '', 'Utseende', 'hand rf-text')),
    box('Särskilda förmågor', [], abilities),
    box('Yrkesfärdigheter', ['erf', 'FV'], lined(profRows, 3, 12)),
    box('Språk (INT)', ['FV', 'B-FV'], lined(langRows, 3, 4)),
  );
  const c3 = el('div', 'col');
  c3.append(box('Sekund. färdigheter', ['erf', 'FV'], lined(secRows, 3, 22)));
  cols.append(c1, c2, c3);
  page.append(head, cols, el('footer', 'rf-foot', '001-1707'));
  return page;
}

// ------------------------------------------------------------------ baksidan

const LOCATION_BOXES: { loc: HitLocation; title: string; side: 'left' | 'right' }[] = [
  { loc: 'huvud', title: 'Huvud', side: 'left' },
  { loc: 'höger arm', title: 'H. arm', side: 'left' },
  { loc: 'mage', title: 'Mage', side: 'left' },
  { loc: 'höger ben', title: 'H. ben', side: 'left' },
  { loc: 'bröstkorg', title: 'Bröstkorg', side: 'right' },
  { loc: 'vänster arm', title: 'V. arm', side: 'right' },
  { loc: 'vänster ben', title: 'V. ben', side: 'right' },
];

function locationBox(a: Actor, loc: HitLocation, title: string): HTMLElement {
  const b = el('div', 'rf-loc');
  b.dataset.loc = loc;
  const h = el('div', 'rf-loc-head');
  h.append(document.createTextNode(`${title.toUpperCase()} (`), hand(a.locMax[loc], '', `${title}|1`), document.createTextNode(')'));
  const piece = armorPiece(a, loc) ?? a.armor.map((id) => ARMOR[id]).find((p) => p?.covers.includes(loc));
  const bv = piece ? a.bv[piece.id] : undefined;
  const rows = el('div', 'rf-loc-rows');
  const kp = el('div', 'rf-loc-kp');
  kp.append(kpBoxes(a.locMax[loc], a.locKp[loc], Math.min(a.locMax[loc], 6)));
  if (a.locKp[loc] < 0) kp.append(hand(`(${a.locKp[loc]})`, 'red', `${title}|2`));
  const armor = el('div', 'rf-loc-armor');
  armor.append(el('small', '', 'Rustning'), hand(piece ? piece.name : '', '', `${title}|3`));
  const abs = el('div', 'rf-loc-armor');
  abs.append(el('small', '', 'Abs'), hand(piece ? `${piece.abs}${bv !== undefined ? ` · BV ${bv}/${armorBv(piece.id)}` : ''}` : '', '', `${title}|4`));
  rows.append(kp, armor, abs);
  b.append(h, rows);
  const notes: string[] = [];
  if (a.bleeding.includes(loc)) notes.push('blöder');
  if (a.disabled.includes(loc)) notes.push('obrukbar');
  for (const inj of a.injuries) if (inj.loc === loc) notes.push(inj.text);
  if (notes.length) b.append(hand(notes.join('. '), 'red small', `${title}|5`));
  return b;
}

function back(src: SheetSource): HTMLElement {
  const p = src.actor;
  const ch = src.char;
  const page = el('article', 'rf-page rf-back');

  // Kroppen med träffområdena runt figuren.
  const body = el('section', 'rf-box rf-bodybox');
  const left = el('div', 'rf-side');
  const right = el('div', 'rf-side');
  for (const b of LOCATION_BOXES) (b.side === 'left' ? left : right).append(locationBox(p, b.loc, b.title));
  const fig = el('div', 'rf-figure');
  fig.append(bodyFigure());
  body.append(left, fig, right);

  // Skadebonus, bärförmåga, förflyttning och KP.
  const stats = el('section', 'rf-stats');
  const sb = damageBonus(p.attrs);
  const statRow = (label: string, ...vals: string[]) => {
    const r = el('div', 'rf-stat');
    r.append(el('span', 'rf-chip', label));
    vals.forEach((v, i) => {
      const cell = el('span', 'rf-cell');
      cell.append(hand(v, '', `${label}|${i + 1}`));
      r.append(cell);
    });
    return r;
  };
  const move = src.move;
  const nm = el('div', 'rf-stat rf-nm');
  nm.append(el('span', ''), el('small', '', 'Normal'), el('small', '', 'Maximal'));
  const left2 = el('div', 'col');
  left2.append(
    statRow('Skadebonus', sb ? `+${sb}` : '—'),
    nm,
    statRow('Bärförmåga', `${p.attrs.STY} kg`, `${p.attrs.STY * 6} kg`),
    statRow('Förflyttning', `${move}`, `${move * 2}`),
  );
  const right2 = el('div', 'col');
  const tot = el('div', 'rf-stat rf-kp');
  tot.append(el('span', 'rf-chip', 'Tot. KP'), kpBoxes(p.maxKp, p.kp, 10));
  if (p.kp < 0) tot.append(hand(`(${p.kp})`, 'red', 'Tot. KP|1'));
  const psy = el('div', 'rf-stat rf-kp');
  psy.append(el('span', 'rf-chip', 'PSY'), kpBoxes(p.attrs.PSY, p.psy, 10));
  right2.append(tot, psy);
  stats.append(left2, right2);

  // Vapen och sköld.
  const wrows: (string | HTMLElement)[][] = [];
  for (const slot of ['weapon', 'offhand'] as const) {
    const id = slot === 'weapon' ? p.weapon : p.offhand;
    if (!id) continue;
    const w = src.weapon(slot);
    const def = WEAPONS[id] as MeleeWeaponDef | RangedWeaponDef | undefined;
    const maxBv = def && def.kind === 'närstrid' ? def.bv : null;
    wrows.push([
      w.name,
      String(src.fv(w.skill)),
      damageExpr(p, w),
      maxBv !== null && maxBv !== undefined ? `${p.bv[slot] ?? 0}/${maxBv}` : '—',
      def && def.kind === 'närstrid' ? String(def.length) : '—',
      def && def.kind !== 'närstrid' ? String(def.range) : '—',
      p.ep[w.skill] ? String(p.ep[w.skill]) : '',
      kg(def?.weight ?? 0),
    ]);
  }
  if (p.shield) {
    const s = SHIELDS[p.shield];
    wrows.push([s.name, String(src.fv('skoldar')), '—', `${p.bv.shield ?? 0}/${s.bv}`, '—', '—', p.ep.skoldar ? String(p.ep.skoldar) : '', kg(s.weight)]);
  }
  for (const id of ch.inventory) {
    const w = WEAPONS[id];
    if (!w || id === p.weapon || id === p.offhand) continue;
    wrows.push([w.name, '', w.damage, w.kind === 'närstrid' && w.bv !== null ? String(w.bv) : '—', w.kind === 'närstrid' ? String(w.length) : '—', w.kind !== 'närstrid' ? String(w.range) : '—', '', kg(w.weight)]);
  }
  const weapons = box('Vapen/Sköld', ['FV', 'Skada', 'BV', 'Längd', 'Räckv', 'Erf', 'Vikt'], lined(wrows, 8, 6));
  weapons.classList.add('rf-weapons');

  // Besvärjelser.
  // Husregel: S räknas fram ur FV i skolan. Besvärjelser i minnet märks med en stjärna.
  const spells = ch.spells.map((id) => [`${SPELLS[id]?.name ?? id}${ch.memorized.includes(id) ? ' *' : ''}`, '', `S${spellS(p, id)}`]);
  const spellBox = box('Besvärjelser', ['erf', 'S'], lined(spells, 3, 16));
  spellBox.classList.add('rf-spells');

  // Pengar.
  const money = box('Pengar', ['gm', 'sm', 'km'], lined([['i börs', '', String(p.silver), ''], ['på bank', '', '', ''], ['Juveler', '', '', '']], 4));
  money.classList.add('rf-money');

  // Utrustning: allt som inte är vapen, sköld eller buren rustning.
  const counts = new Map<string, number>();
  for (const id of ch.inventory) {
    if (WEAPONS[id] || id === p.shield || p.armor.includes(id)) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const gear: string[][] = []; // [text, vikt, nyckel]
  for (const id of p.armor) gear.push([`${itemName(id)} (buren)`, kg(weight(id)), itemName(id)]);
  for (const [id, n] of counts) gear.push([n > 1 ? `${n} × ${itemName(id)}` : itemName(id), kg(weight(id) * n), itemName(id)]);
  const gearList = el('div', 'rf-gear');
  const all = [...gear];
  while (all.length < 18) all.push(['', '', '']);
  all.forEach(([name, w, key]) => {
    const r = el('div', 'rf-gear-row');
    r.append(el('span', '', ''), el('span', '', ''));
    if (name) r.firstElementChild!.append(hand(name, '', `Utrustning|${key}|0`));
    if (w) r.lastElementChild!.append(hand(w, '', `Utrustning|${key}|1`));
    gearList.append(r);
  });
  const gearBox = box('Utrustning', ['Vikt'], gearList);
  gearBox.classList.add('rf-gearbox');

  page.append(body, spellBox, stats, weapons, money, gearBox);
  return page;
}

/** Hela rollformuläret, båda sidorna. */
export function renderSheet(g: Game): HTMLElement {
  const src = sheetFromGame(g);
  const wrap = el('div', 'rf');
  wrap.append(renderSide(src, 'front'), renderSide(src, 'back'));
  return wrap;
}

/** En sida av rollformuläret. */
export function renderSide(src: SheetSource, side: 'front' | 'back'): HTMLElement {
  return side === 'front' ? front(src) : back(src);
}
