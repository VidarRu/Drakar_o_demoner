import { ABILITY_BY_ID } from '../data/abilities';
import { ARMOR, SHIELDS } from '../data/armor';
import { ITEMS } from '../data/equipment';
import { PROFESSIONS } from '../data/professions';
import { RACES } from '../data/races';
import { SKILL_LIST, SKILLS } from '../data/skills';
import { SPELLS } from '../data/spells';
import type { MeleeWeaponDef, RangedWeaponDef } from '../data/types';
import { WEAPONS } from '../data/weapons';
import { armorBv, armorPiece, damageExpr, effectiveMove } from '../engine/combat';
import { skillName } from '../engine/creation';
import type { Game } from '../engine/game';
import { bLevel, damageBonus, type HitLocation } from '../engine/rules';
import type { Actor, AttrKey } from '../engine/types';
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

/** Ett handskrivet värde. */
const hand = (text: string | number, cls = '') => el('span', `hand ${cls}`.trim(), String(text));

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
      else if (v) td.append(i === 0 ? document.createTextNode(v) : hand(v));
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
  f.append(el('small', '', label), hand(value));
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

function front(g: Game): HTMLElement {
  const p = g.player;
  const ch = g.state.character;
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
    field('Ålder', `${ch.age.years} år (${ch.age.group})`),
  );
  head.append(logo, fields);

  const attrs = lined(
    ATTR_ORDER.map((k) => [`${ATTR_NAMES[k]} (${k})`, String(p.attrs[k])]),
    2,
  );
  attrs.classList.add('attrs');

  const mark = (k: string) => (p.marks.includes(k) ? '✓' : '');
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

  const ability = ch.ability ? ABILITY_BY_ID[ch.ability.id] : null;
  const abilities = el('div', 'rf-text');
  if (ability) abilities.append(el('p', 'hand', `${ability.name}: ${ability.desc}`));
  abilities.append(el('p', 'hand', `${prof.ability.name}: ${prof.ability.desc}`));
  for (const ph of ch.phobias ?? []) abilities.append(el('p', 'hand', `Fobi (${ph.level}): ${ph.source}`));
  if (ch.techniques.length) abilities.append(el('p', 'hand', `Tekniker: ${ch.techniques.join(', ').replace(/_/g, ' ')}`));

  const cols = el('div', 'rf-cols');
  const c1 = el('div', 'col');
  c1.append(box('Grundegenskap', ['Värde'], attrs), box('Primära färdigheter', ['erf', 'FV'], lined(primRows, 3)));
  const c2 = el('div', 'col');
  c2.append(
    box('Utseende', [], el('p', 'hand rf-text', ch.appearance || '')),
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
  h.append(document.createTextNode(`${title.toUpperCase()} (`), hand(a.locMax[loc]), document.createTextNode(')'));
  const piece = armorPiece(a, loc) ?? a.armor.map((id) => ARMOR[id]).find((p) => p?.covers.includes(loc));
  const bv = piece ? a.bv[piece.id] : undefined;
  const rows = el('div', 'rf-loc-rows');
  const kp = el('div', 'rf-loc-kp');
  kp.append(kpBoxes(a.locMax[loc], a.locKp[loc], Math.min(a.locMax[loc], 6)));
  if (a.locKp[loc] < 0) kp.append(hand(`(${a.locKp[loc]})`, 'red'));
  const armor = el('div', 'rf-loc-armor');
  armor.append(el('small', '', 'Rustning'), hand(piece ? piece.name : ''));
  const abs = el('div', 'rf-loc-armor');
  abs.append(el('small', '', 'Abs'), hand(piece ? `${piece.abs}${bv !== undefined ? ` · BV ${bv}/${armorBv(piece.id)}` : ''}` : ''));
  rows.append(kp, armor, abs);
  b.append(h, rows);
  const notes: string[] = [];
  if (a.bleeding.includes(loc)) notes.push('blöder');
  if (a.disabled.includes(loc)) notes.push('obrukbar');
  for (const inj of a.injuries) if (inj.loc === loc) notes.push(inj.text);
  if (notes.length) b.append(hand(notes.join('. '), 'red small'));
  return b;
}

function back(g: Game): HTMLElement {
  const p = g.player;
  const ch = g.state.character;
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
    for (const v of vals) {
      const cell = el('span', 'rf-cell');
      cell.append(hand(v));
      r.append(cell);
    }
    return r;
  };
  const move = effectiveMove(p);
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
  if (p.kp < 0) tot.append(hand(`(${p.kp})`, 'red'));
  const psy = el('div', 'rf-stat rf-kp');
  psy.append(el('span', 'rf-chip', 'PSY'), kpBoxes(p.attrs.PSY, p.attrs.PSY, 10));
  right2.append(tot, psy);
  stats.append(left2, right2);

  // Vapen och sköld.
  const wrows: (string | HTMLElement)[][] = [];
  for (const slot of ['weapon', 'offhand'] as const) {
    const id = slot === 'weapon' ? p.weapon : p.offhand;
    if (!id) continue;
    const w = g.weaponOf(p, slot);
    const def = WEAPONS[id] as MeleeWeaponDef | RangedWeaponDef | undefined;
    const maxBv = def && def.kind === 'närstrid' ? def.bv : null;
    wrows.push([
      w.name,
      String(g.skillFv(p, w.skill)),
      damageExpr(p, w),
      maxBv !== null && maxBv !== undefined ? `${p.bv[slot] ?? 0}/${maxBv}` : '—',
      def && def.kind === 'närstrid' ? String(def.length) : '—',
      def && def.kind !== 'närstrid' ? String(def.range) : '—',
      p.marks.includes(w.skill) ? '✓' : '',
      kg(def?.weight ?? 0),
    ]);
  }
  if (p.shield) {
    const s = SHIELDS[p.shield];
    wrows.push([s.name, String(g.skillFv(p, 'skoldar')), '—', `${p.bv.shield ?? 0}/${s.bv}`, '—', '—', p.marks.includes('skoldar') ? '✓' : '', kg(s.weight)]);
  }
  for (const id of ch.inventory) {
    const w = WEAPONS[id];
    if (!w || id === p.weapon || id === p.offhand) continue;
    wrows.push([w.name, '', w.damage, w.kind === 'närstrid' && w.bv !== null ? String(w.bv) : '—', w.kind === 'närstrid' ? String(w.length) : '—', w.kind !== 'närstrid' ? String(w.range) : '—', '', kg(w.weight)]);
  }
  const weapons = box('Vapen/Sköld', ['FV', 'Skada', 'BV', 'Längd', 'Räckv', 'Erf', 'Vikt'], lined(wrows, 8, 6));
  weapons.classList.add('rf-weapons');

  // Besvärjelser.
  const spells = Object.entries(ch.spells).map(([id, sv]) => [SPELLS[id]?.name ?? id, p.marks.includes(id) ? '✓' : '', String(sv)]);
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
  const gear: string[][] = [];
  for (const id of p.armor) gear.push([`${itemName(id)} (buren)`, kg(weight(id))]);
  for (const [id, n] of counts) gear.push([n > 1 ? `${n} × ${itemName(id)}` : itemName(id), kg(weight(id) * n)]);
  const gearList = el('div', 'rf-gear');
  const all = [...gear];
  while (all.length < 18) all.push(['', '']);
  for (const [name, w] of all) {
    const r = el('div', 'rf-gear-row');
    r.append(el('span', '', ''), el('span', '', ''));
    if (name) r.firstElementChild!.append(hand(name));
    if (w) r.lastElementChild!.append(hand(w));
    gearList.append(r);
  }
  const gearBox = box('Utrustning', ['Vikt'], gearList);
  gearBox.classList.add('rf-gearbox');

  page.append(body, spellBox, stats, weapons, money, gearBox);
  return page;
}

/** Hela rollformuläret, båda sidorna. */
export function renderSheet(g: Game): HTMLElement {
  const wrap = el('div', 'rf');
  wrap.append(front(g), back(g));
  return wrap;
}
