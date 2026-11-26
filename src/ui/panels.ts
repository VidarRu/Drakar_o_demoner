import { ARMOR, SHIELDS } from '../data/armor';
import { HERBS, herbWorks } from '../data/herbs';
import { SPELLS } from '../data/spells';
import { WEAPONS } from '../data/weapons';
import { ammoLeft, rangedInfo } from '../engine/combat';
import type { Game } from '../engine/game';
import {
  carriedWeight,
  equip,
  equipProblem,
  ironProblem,
  itemInfo,
  loadMod,
  removeArmor,
  stow,
  wearArmor,
  type EquipSlot,
} from '../engine/inventory';
import {
  BODY_ATTRS,
  moveReach,
  castProblem,
  castSpell,
  forget,
  maxGrade,
  memorize,
  memorizeProblem,
  memoryLimit,
  memoryUsed,
  rangeSquares,
  spellS,
  spellTargets,
} from '../engine/magic';
import { herbProblem, herbsHere, searchHerb, useHerb } from '../engine/poison';
import { herbChoices, lockChoices, SEEK_KINDS, telepathyTargets } from '../engine/worldspells';
import { spellCl } from '../engine/rules';
import { buy, buyPrice, canHaggle, discount, haggle, sell, sellable, wares } from '../engine/trade';
import type { Actor, AttrKey } from '../engine/types';
import { $, el } from './hud';
import { renderQuestLog } from './module';

function button(text: string, onClick: () => void, cls = '', disabled = false, title = ''): HTMLButtonElement {
  const b = el('button', cls, text);
  b.onclick = onClick;
  b.disabled = disabled;
  if (title) b.title = title;
  return b;
}

function table(head: string[], rows: (string | HTMLElement)[][]): HTMLTableElement {
  const t = el('table', 'training-table');
  const tr = el('tr');
  for (const h of head) tr.append(el('th', '', h));
  t.append(tr);
  for (const r of rows) {
    const row = el('tr');
    for (const c of r) {
      const td = el('td');
      td.append(typeof c === 'string' ? document.createTextNode(c) : c);
      row.append(td);
    }
    t.append(row);
  }
  return t;
}

/** Ett gemensamt fönster för packningen, handeln och magin. */
class Panel {
  private render: (() => void) | null = null;

  constructor(private g: Game) {
    $('panel-close').onclick = () => this.close();
    g.onChange(() => this.refresh());
  }

  open(title: string, render: (body: HTMLElement) => void) {
    $('panel-title').textContent = title;
    $('panel').hidden = false;
    this.render = () => {
      const body = $('panel-body');
      body.replaceChildren();
      render(body);
      const log = el('div', 'training-log');
      for (const line of this.g.state.log.slice(-4)) log.append(el('p', '', line));
      body.append(log);
    };
    this.render();
  }

  refresh() {
    if (!$('panel').hidden && this.render) this.render();
  }

  close() {
    $('panel').hidden = true;
    this.render = null;
    this.g.changed();
  }

  /** Visar ett felmeddelande i loggen och ritar om. */
  report(problem: string | null) {
    if (problem) this.g.log(problem);
    this.g.changed();
  }
}

/** Packningen: utrustning i händerna och på kroppen, föremål, ammunition, örter och bördan. */
export class PackUi {
  private panel: Panel;

  constructor(private g: Game, panel?: Panel) {
    this.panel = panel ?? new Panel(g);
  }

  open() {
    this.panel.open('Packning', (body) => this.render(body));
  }

  private render(body: HTMLElement) {
    const g = this.g;
    const p = g.player;
    const ch = g.char;
    const kg = carriedWeight(g);
    const mod = loadMod(g, p);
    body.append(
      el(
        'p',
        'note',
        `Börda ${kg} kg av ${p.attrs.STY} kg (STY). ${
          mod === null ? 'För tungt för att röra sig!' : mod ? `${mod} på förflyttning, SMI och SMI-färdigheter.` : 'Ingen belastning.'
        } Rustning på kroppen räknas med halva vikten, kläder inte alls. Silver: ${p.silver}.`,
      ),
    );

    // Händerna och kroppen.
    const hands: (string | HTMLElement)[][] = [];
    const slot = (label: string, s: EquipSlot, id: string | undefined, name: string) => {
      hands.push([label, name, id ? button('Lägg undan', () => this.act(() => stow(g, s))) : '']);
    };
    slot('Svärdshand', 'weapon', WEAPONS[p.weapon] ? p.weapon : undefined, WEAPONS[p.weapon]?.name ?? 'tom');
    slot('Andra handen', 'offhand', p.offhand, p.offhand ? WEAPONS[p.offhand].name : 'tom');
    slot('Sköld', 'shield', p.shield, p.shield ? SHIELDS[p.shield].name : 'ingen');
    for (const id of p.armor) hands.push(['Rustning', ARMOR[id].name, button('Ta av', () => this.act(() => removeArmor(g, id)), '', g.state.mode !== 'explore')]);
    body.append(el('h3', '', 'Utrustning'), table(['', '', ''], hands));

    const r = rangedInfo(p, g);
    if (r) {
      const left = ammoLeft(g, p, r);
      body.append(el('p', 'note', `${r.name}: räckvidd ${r.range} rutor${r.reload ? `, laddning ${r.reload} SR` : ''}${r.ammo ? `, ${r.ammo.item} kvar: ${left}` : ''}.`));
    }
    const iron = ironProblem(g);
    if (ch.spells.length && iron) body.append(el('p', 'note', `Magin stoppas av järn: ${iron}`));

    // Föremålen i packningen.
    const counts = new Map<string, number>();
    for (const id of ch.inventory) counts.set(id, (counts.get(id) ?? 0) + 1);
    const rows: (string | HTMLElement)[][] = [];
    for (const [id, n] of counts) {
      const info = itemInfo(id);
      if (!info) continue;
      const actions = el('span');
      const offer = (label: string, s: EquipSlot | 'armor') => {
        const problem = equipProblem(g, id, s);
        if (problem === 'Du har inget ledigt exemplar.') return;
        actions.append(
          button(label, () => this.act(() => (s === 'armor' ? wearArmor(g, id) : equip(g, id, s))), '', !!problem, problem ?? ''),
        );
      };
      if (info.kind === 'vapen') {
        offer('I handen', 'weapon');
        if (WEAPONS[id].kind === 'närstrid') offer('Andra handen', 'offhand');
      } else if (info.kind === 'sköld') offer('Ta på', 'shield');
      else if (info.kind === 'rustning') offer('Ta på', 'armor');
      rows.push([`${info.name}${n > 1 ? ` ×${n}` : ''}`, `${info.weight} kg`, actions]);
    }
    for (const [item, n] of Object.entries(ch.ammo)) if (n > 0) rows.push([`${itemInfo(item)?.name.replace(/ \(10 st\)/, '') ?? item}: ${n} st`, '', '']);
    body.append(el('h3', '', 'I packningen'), table(['Föremål', 'Vikt', ''], rows));

    // Örter och droger.
    if (ch.herbs.length || p.weaponPoison) {
      const hrows: (string | HTMLElement)[][] = [];
      ch.herbs.forEach((dose, i) => {
        const h = HERBS[dose.id];
        const problem = herbProblem(g, dose);
        const label = h.kind === 'gift' ? 'Stryk på vapnet' : 'Använd';
        hrows.push([h.name, h.desc + (herbWorks(h) ? '' : ' (verkar inte i spelet än)'), button(label, () => this.act(() => useHerb(g, i)), '', !!problem, problem ?? '')]);
      });
      if (p.weaponPoison) hrows.push([`På vapnet: ${HERBS[p.weaponPoison.id].name}`, 'Verkar vid nästa träff som ger skada.', '']);
      body.append(el('h3', '', 'Örter och droger'), table(['Drog', 'Verkan', ''], hrows));
    }

    // Leta läkeörter i trakten.
    if (p.skills.ortkunskap !== undefined && g.state.mode === 'explore') {
      const here = herbsHere(g);
      const sel = el('select');
      for (const h of here) sel.append(new Option(`${h.name} (vanlighet ${h.common}) – ${h.desc}`, h.id));
      body.append(
        el('h3', '', 'Leta örter'),
        el('p', 'note', 'En hel dag på jakt efter en läkeört: CL = Örtkunskap − vanligheten (minst 1). Lyckat ger 1T4 doser, perfekt 4T4.'),
        sel,
        button('Leta en dag', () => this.act(() => searchHerb(g, sel.value)), '', !g.canRest()),
      );
    }
  }

  private act(fn: () => string | null | void) {
    const r = fn();
    this.panel.report(typeof r === 'string' ? r : null);
  }
}

/** Handeln hos en handlare: köpa, sälja och köpslå. */
export class ShopUi {
  private npc: Actor | null = null;

  constructor(private g: Game, private panel: Panel) {
    g.onUi((name, arg) => {
      if (name !== 'shop' || !arg) return;
      this.npc = g.actor(arg) ?? null;
      if (this.npc) this.panel.open(`Handla med ${this.npc.name}`, (body) => this.render(body));
    });
  }

  private render(body: HTMLElement) {
    const g = this.g;
    const npc = this.npc!;
    const p = g.player;
    const pct = discount(g, npc);
    body.append(
      el('p', 'note', `Silver: ${p.silver}. Priser enligt Bok III. Handlaren köper begagnat för halva priset.${pct ? ` Köpslående i dag: ${pct} % bättre.` : ''}`),
      button('Köpslå (Köpslå mot handlaren, en gång per dag)', () => this.act(() => void haggle(g, npc)), '', !canHaggle(g, npc)),
    );
    const buyRows = wares(g, npc).map((w) => {
      const price = buyPrice(g, npc, w.price);
      return [w.name, w.herb ? HERBS[w.id].desc : `${w.weight} kg`, `${price} sm`, button('Köp', () => this.act(() => buy(g, npc, w.id)), '', p.silver < price)];
    });
    const sellRows = sellable(g, npc).map((w) => [w.name, `${w.price} sm`, button('Sälj', () => this.act(() => sell(g, npc, w.id)))]);
    if (sellRows.length) body.append(el('h3', '', 'Sälja'), table(['Föremål', 'Pris', ''], sellRows));
    body.append(el('h3', '', 'Köpa'), table(['Vara', '', 'Pris', ''], buyRows));
  }

  private act(fn: () => string | null | void) {
    const r = fn();
    this.panel.report(typeof r === 'string' ? r : null);
  }
}

/** Magin: formelsamlingen, minnet och att lägga besvärjelser. */
export class MagicUi {
  private choice: { id: string; grade: number; extraRange: number; extraDuration: number; target: string; suicide: boolean; attr: AttrKey; hands: 1 | 2; dir: number; dist: number; seek: string; herb: string; lock: number } | null = null;

  constructor(private g: Game, private panel: Panel) {}

  open() {
    this.choice = null;
    this.panel.open('Magi', (body) => this.render(body));
  }

  private render(body: HTMLElement) {
    const g = this.g;
    const p = g.player;
    const ch = g.char;
    body.append(
      el(
        'p',
        'note',
        `PSY ${p.psy} av ${p.attrs.PSY}. I minnet ${memoryUsed(g)} av ${memoryLimit(g)}. CL är S − 1 för varje E utöver den första, och varje E kostar 1 PSY (1 PSY vid misslyckande). Når PSY 0 dör magikern.`,
      ),
    );
    const rows = ch.spells.map((id) => {
      const sp = SPELLS[id];
      const inMind = ch.memorized.includes(id);
      const actions = el('span');
      if (inMind) actions.append(button('Glöm', () => forget(g, id)));
      else {
        const problem = memorizeProblem(g, id);
        actions.append(button(`Memorera (${sp.sv * 20} min)`, () => this.act(() => memorize(g, id)), '', !!problem, problem ?? ''));
      }
      actions.append(button('Lägg', () => this.pick(id), 'primary', !sp.effect, sp.effect ? '' : 'Verkar inte i spelet än.'));
      return [`${sp.name}${sp.quick ? ' (K)' : ''}${sp.physical ? ' (F)' : ''}`, `S${spellS(p, id)}`, inMind ? 'i minnet' : '', sp.desc, actions];
    });
    body.append(table(['Besvärjelse', 'S', '', 'Verkan', ''], rows));
    if (this.choice) body.append(this.castForm());
  }

  private pick(id: string) {
    const targets = spellTargets(this.g, id);
    this.choice = { id, grade: 1, extraRange: 0, extraDuration: 0, target: targets[0]?.id ?? '', suicide: false, attr: 'STY', hands: 1, dir: 0, dist: 1, seek: 'fiende', herb: '', lock: 0 };
    this.panel.refresh();
  }

  private castForm(): HTMLElement {
    const g = this.g;
    const p = g.player;
    const c = this.choice!;
    const sp = SPELLS[c.id];
    const box = el('section', 'box');
    const max = maxGrade(p, c.id);
    const total = c.grade + c.extraRange + c.extraDuration;
    const num = (label: string, value: number, set: (v: number) => void, show = true) => {
      if (!show) return el('span');
      const s = el('select');
      for (let i = label === 'E' ? 1 : 0; i <= max; i++) s.append(new Option(String(i), String(i), false, i === value));
      s.onchange = () => {
        set(Number(s.value));
        this.panel.refresh();
      };
      const l = el('label', '', `${label} `);
      l.append(s);
      return l;
    };
    const ranged = typeof sp.range === 'object';
    const timed = typeof sp.duration === 'object' && 'per' in sp.duration;
    box.append(
      el('h3', '', `Lägg ${sp.name}`),
      num('E', c.grade, (v) => (c.grade = v)),
      num('Extra E för räckvidd', c.extraRange, (v) => (c.extraRange = v), ranged),
      num('Extra E för varaktighet', c.extraDuration, (v) => (c.extraDuration = v), timed),
    );
    if (sp.aim !== 'själv') {
      const s = el('select');
      for (const t of spellTargets(g, c.id, c.extraRange)) s.append(new Option(t === p ? `${t.name} (dig själv)` : t.name, t.id, false, t.id === c.target));
      s.onchange = () => (c.target = s.value);
      const l = el('label', '', `Mål (räckvidd ${rangeSquares(g, p, sp, c.extraRange)} rutor) `);
      l.append(s);
      box.append(l);
      if (!c.target && s.options.length) c.target = s.options[0].value;
    }
    if (sp.effect?.kind === 'egenskap') {
      const s = el('select');
      for (const k of BODY_ATTRS) s.append(new Option(k, k, false, k === c.attr));
      s.onchange = () => (c.attr = s.value as AttrKey);
      const l = el('label', '', 'Grundegenskap ');
      l.append(s);
      box.append(l);
    }
    if (sp.effect?.kind === 'astralvapen') {
      const s = el('select');
      s.append(new Option('Enhandsvapen, 1T10 (E2)', '1', false, c.hands === 1), new Option('Tvåhandsvapen, 2T10 (E4)', '2', false, c.hands === 2));
      s.onchange = () => {
        c.hands = s.value === '2' ? 2 : 1;
        this.panel.refresh();
      };
      const l = el('label', '', 'Vapen ');
      l.append(s);
      box.append(l);
    }
    // SPRÅNG, LYFT och TELEPORTERA: rutan väljs med riktning och avstånd från målet.
    const mover = c.target ? g.actor(c.target) : sp.aim === 'själv' ? p : undefined;
    const reach = mover ? moveReach(g, c.id, c.grade, mover) : null;
    let at: { x: number; y: number } | undefined;
    if (reach !== null && mover) {
      c.dist = Math.min(Math.max(1, c.dist), Math.max(1, reach));
      const dirSel = el('select');
      COMPASS.forEach(([name], i) => dirSel.append(new Option(name, String(i), false, i === c.dir)));
      dirSel.onchange = () => {
        c.dir = Number(dirSel.value);
        this.panel.refresh();
      };
      const distSel = el('select');
      for (let i = 1; i <= Math.max(1, reach); i++) distSel.append(new Option(String(i), String(i), false, i === c.dist));
      distSel.onchange = () => {
        c.dist = Number(distSel.value);
        this.panel.refresh();
      };
      const l1 = el('label', '', 'Riktning ');
      l1.append(dirSel);
      const l2 = el('label', '', `Rutor (högst ${reach}) `);
      l2.append(distSel);
      box.append(l1, l2);
      const [, dx, dy] = COMPASS[c.dir];
      at = { x: mover.x + dx * c.dist, y: mover.y + dy * c.dist };
    }
    const kind = sp.effect?.kind;
    const pick = (label: string, options: [string, string][], value: string, set: (v: string) => void) => {
      const s = el('select');
      for (const [v, text] of options) s.append(new Option(text, v, false, v === value));
      s.onchange = () => {
        set(s.value);
        this.panel.refresh();
      };
      const l = el('label', '', `${label} `);
      l.append(s);
      box.append(l);
      return s.value;
    };
    // ÖPPNA och FÖRSEGLA: en dörr eller kista som magikern kan röra vid.
    if (kind === 'öppna' || kind === 'försegla') {
      const locks = lockChoices(g, p);
      if (locks.length) {
        const v = pick('Dörr eller kista', locks.map((l, i) => [String(i), l.text]), String(c.lock), (v) => (c.lock = Number(v)));
        const l = locks[Number(v)] ?? locks[0];
        at = { x: l.spot.x, y: l.spot.y };
      }
    }
    if (kind === 'varseblivning') c.seek = pick('Leta efter', Object.entries(SEEK_KINDS), c.seek, (v) => (c.seek = v));
    if (kind === 'växtkunskap') {
      const herbs = herbChoices(g, p);
      if (herbs.length) c.herb = pick('Ört', herbs.map((id) => [id, HERBS[id].name]), c.herb || herbs[0], (v) => (c.herb = v));
    }
    if (kind === 'tankar' && sp.effect?.kind === 'tankar' && sp.effect.mode === 'telepati') {
      const known = telepathyTargets(g);
      if (known.length) c.target = pick('Person', known.map((a) => [a.id, a.name]), known.some((a) => a.id === c.target) ? c.target : known[0].id, (v) => (c.target = v));
    }
    const suicide = el('label', '', 'Självmordsattack (CL = S, kostar mer PSY än du har, du dör) ');
    const cb = el('input');
    cb.type = 'checkbox';
    cb.checked = c.suicide;
    cb.onchange = () => {
      c.suicide = cb.checked;
      this.panel.refresh();
    };
    suicide.append(cb);
    const S = spellS(p, c.id);
    const opts = { grade: c.grade, extraRange: c.extraRange, extraDuration: c.extraDuration, target: c.target || undefined, suicide: c.suicide, attr: c.attr, hands: c.hands, at, seek: c.seek, herb: c.herb };
    const problem = castProblem(g, c.id, opts);
    box.append(
      suicide,
      el('p', 'note', `Totalt E${total} av högst E${max}: CL ${c.suicide ? S : spellCl(S, total)}, kostar ${total} PSY.${sp.quick ? ' Kvick: verkar direkt.' : g.state.mode === 'combat' ? ' Verkar i början av nästa runda.' : ''}`),
      button(
        'Lägg besvärjelsen',
        () => {
          const r = castSpell(g, c.id, opts);
          if (r) this.panel.report(r);
          else if (g.state.mode === 'combat') this.panel.close();
          else this.panel.refresh();
        },
        'primary',
        !!problem,
        problem ?? '',
      ),
    );
    if (problem) box.append(el('p', 'note', problem));
    return box;
  }

  private act(fn: () => string | null | void) {
    const r = fn();
    this.panel.report(typeof r === 'string' ? r : null);
  }
}

/** Väderstrecken för SPRÅNG, LYFT och TELEPORTERA: namn och steg på kartan (norr är uppåt). */
const COMPASS: [string, number, number][] = [
  ['Norr', 0, -1],
  ['Nordost', 1, -1],
  ['Öster', 1, 0],
  ['Sydost', 1, 1],
  ['Söder', 0, 1],
  ['Sydväst', -1, 1],
  ['Väster', -1, 0],
  ['Nordväst', -1, -1],
];

/** Skapar fönstren och kopplar dem till spelet. */
export function mountPanels(g: Game) {
  const panel = new Panel(g);
  const pack = new PackUi(g, panel);
  const magic = new MagicUi(g, panel);
  new ShopUi(g, panel);
  const quests = { open: () => panel.open('Uppdrag', (body) => body.append(renderQuestLog(g))) };
  return { pack, magic, quests };
}
