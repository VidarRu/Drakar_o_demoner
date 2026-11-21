import { requestTurn, scriptedTurn, type DialogEntry } from '../ai/dialogClient';
import { NPCS } from '../content';
import { ARMOR, SHIELDS } from '../data/armor';
import { PROFESSIONS } from '../data/professions';
import { RACES } from '../data/races';
import { activeHostiles, damageExpr, effectiveMove, isOut } from '../engine/combat';
import type { Game } from '../engine/game';
import { INTENTS } from '../engine/intents';
import { HIT_LOCATIONS, type HitLocation } from '../engine/rules';
import type { Actor } from '../engine/types';
import { clockText } from '../engine/time';
import { portraitUrl } from '../game/art';
import { bodyFigure } from './figure';
import { renderSheet } from './sheet';

export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
}

function button(text: string, onClick: () => void, cls = '', disabled = false): HTMLButtonElement {
  const b = el('button', cls, text);
  b.onclick = onClick;
  b.disabled = disabled;
  return b;
}

const LOC_SHORT: Record<HitLocation, string> = {
  huvud: 'Huvud',
  bröstkorg: 'Bröst',
  mage: 'Mage',
  'vänster arm': 'V. arm',
  'höger arm': 'H. arm',
  'vänster ben': 'V. ben',
  'höger ben': 'H. ben',
};

/** Statuspanel, rollformulär, logg och stridspanel. */
export class Hud {
  private logCount = -1;

  constructor(private g: Game) {
    $('hud').hidden = false;
    $('btn-sheet').onclick = () => $('status').classList.toggle('open');
    $('rf-close').onclick = () => this.toggleSheet(false);
    $('rollformular').onclick = (e) => {
      if (e.target === $('rollformular')) this.toggleSheet(false);
    };
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.toggleSheet(false);
      if ((e.key === 'r' || e.key === 'R') && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        this.toggleSheet($('rollformular').hidden);
      }
    });
    g.onChange(() => this.render());
    this.render();
  }

  private toggleSheet(open: boolean) {
    $('rollformular').hidden = !open;
    if (open) this.renderFullSheet();
  }

  render() {
    this.renderStatus();
    this.renderLog();
    this.renderActions();
    if (!$('rollformular').hidden) this.renderFullSheet();
    $('dead').hidden = this.g.state.mode !== 'dead';
  }

  private renderFullSheet() {
    $('rf-content').replaceChildren(renderSheet(this.g));
  }

  /** Den lilla panelen: KP per kroppsdel, vapen, rustning och tillstånd. */
  private renderStatus() {
    const g = this.g;
    const p = g.player;
    const ch = g.state.character;
    const box = $('status');
    box.replaceChildren();

    const who = el('div', 'who');
    const img = el('img');
    img.src = portraitUrl(p.sprite);
    const names = el('div');
    names.append(el('h2', '', p.name), el('small', '', `${RACES[ch.race].name}, ${PROFESSIONS[ch.profession].name.toLowerCase()}`));
    who.append(img, names);

    const bar = el('div', 'bar');
    const fill = el('i');
    fill.style.width = `${Math.max(0, (100 * p.kp) / p.maxKp)}%`;
    bar.append(fill, el('span', '', `KP ${p.kp} / ${p.maxKp}`));

    const doll = el('div', 'doll');
    const locs = el('div', 'locs');
    for (const loc of HIT_LOCATIONS) {
      const row = el('div', `loc${p.locKp[loc] <= 0 ? ' hurt' : p.locKp[loc] < p.locMax[loc] ? ' scratched' : ''}`);
      const abs = g.armorAt(p, loc);
      row.append(el('span', '', LOC_SHORT[loc]), el('b', '', `${p.locKp[loc]}/${p.locMax[loc]}`), el('small', '', abs ? `abs ${abs}` : ''));
      if (p.bleeding.includes(loc)) row.append(el('em', 'bleed', '●'));
      locs.append(row);
    }
    doll.append(bodyFigure(p), locs);

    const kv = (key: string, value: string) => {
      const row = el('div', 'kv');
      row.append(el('span', '', key), el('b', '', value));
      return row;
    };
    const gear: HTMLElement[] = [];
    for (const slot of ['weapon', 'offhand'] as const) {
      if (slot === 'offhand' && !p.offhand) continue;
      const w = g.weaponOf(p, slot);
      const bv = w.bvKey && p.bv[w.bvKey] !== undefined ? ` · BV ${p.bv[w.bvKey]}` : '';
      gear.push(kv(`${w.name} (${g.skillFv(p, w.skill)})`, `${damageExpr(p, w)}${bv}`));
    }
    if (p.shield) gear.push(kv(`${SHIELDS[p.shield].name} (${g.skillFv(p, 'skoldar')})`, `BV ${p.bv.shield ?? 0}`));
    for (const id of p.armor) {
      const broken = (p.bv[id] ?? 1) <= 0;
      gear.push(kv(ARMOR[id].name, broken ? 'sönder' : `abs ${ARMOR[id].abs} · BV ${p.bv[id]}`));
    }

    const states: string[] = [];
    if (p.unconscious) states.push('Medvetslös');
    if (p.down) states.push('Utslagen – kan bara krypa');
    if (p.kp === 2) states.push('2 KP: halverad CL');
    if (p.kp === 1) states.push('1 KP: kan inte använda färdigheter');
    if (p.bleeding.length) states.push(`Blöder: ${p.bleeding.join(', ')}`);
    for (const label of new Set(p.effects.map((e) => e.label))) states.push(label);
    for (const inj of p.injuries) states.push(`${inj.loc}: ${inj.text}`);
    for (const ph of ch.phobias ?? []) states.push(`Fobi (${ph.level}): ${ph.source}`);

    box.append(
      who,
      bar,
      doll,
      el('h3', '', 'Utrustning'),
      ...gear,
      kv('Förflyttning', `${effectiveMove(p)} rutor`),
      kv('PSY-poäng', `${p.psy} / ${p.attrs.PSY}`),
      kv('Silvermynt', String(p.silver)),
      kv('Tid', clockText(g.state.time)),
      ...(states.length ? [el('h3', '', 'Tillstånd'), ...states.map((s) => el('p', 'state', s))] : []),
      button('Rollformulär (R)', () => this.toggleSheet(true), 'primary sheet-btn'),
    );
  }

  private renderLog() {
    const log = this.g.state.log;
    if (log.length === this.logCount) return;
    this.logCount = log.length;
    const box = $('log');
    box.replaceChildren(...log.slice(-80).map((line) => el('p', line.startsWith('—') ? 'round' : '', line)));
    box.scrollTop = box.scrollHeight;
  }

  /** Stridspanelen med turordning och handlingar, eller knapparna under utforskning. */
  private renderActions() {
    const { g } = this;
    const c = g.state.combat;
    const p = g.player;
    const panel = $('combat');
    panel.replaceChildren();
    if (g.state.mode === 'dialog' || g.state.mode === 'dead') {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;
    if (g.state.mode !== 'combat' || !c) {
      const hostiles = g.state.actors.some((a) => a.alive && a.hostile && !a.fled && g.isVisible(a.x, a.y));
      panel.append(button('⚔ Till strid', () => g.startCombat(), 'danger', !hostiles));
      if (p.bleeding.length) panel.append(button('Lägg förband', () => g.bandage(), '', !g.canBandage()));
      if (g.canSelfMedicine()) panel.append(button('Läkekonst', () => g.selfMedicine()));
      panel.append(button('Sov 8 timmar', () => g.sleep(8), '', !g.canRest()));
      panel.classList.remove('fighting');
      return;
    }
    panel.classList.add('fighting');

    const order = el('div', 'order');
    c.order.forEach((id, i) => {
      const a = g.actor(id);
      if (!a || (!a.hostile && a.kind !== 'player')) return;
      const chip = el('span', `chip${i === c.turn ? ' now' : ''}${isOut(a) ? ' out' : ''}${a.kind === 'player' ? ' me' : ''}`);
      chip.append(el('b', '', String(c.initiative[id] ?? '')), document.createTextNode(` ${a.name}`));
      order.append(chip);
    });

    const mine = g.isPlayerTurn();
    const acted = !!c.acted[p.id];
    const current = g.actor(c.order[c.turn]);
    const info = el(
      'span',
      'info',
      mine
        ? `Runda ${c.round} · Din tur · ${c.movesLeft} steg kvar${acted ? ' · handlingen är gjord' : ' · klicka på en fiende för att anfalla'}`
        : `Runda ${c.round} · ${current?.name ?? 'Fienden'} agerar…`,
    );

    const aim = el('select');
    aim.title = 'Sikta på en kroppsdel ger −5 på anfallet';
    aim.append(new Option('Slumpvis träff', ''));
    for (const loc of HIT_LOCATIONS) aim.append(new Option(`Sikta: ${loc} (−5)`, loc, false, c.aim === loc));
    aim.onchange = () => g.setAim((aim.value || null) as HitLocation | null);
    aim.disabled = !mine;

    const controls = el('div', 'controls');
    controls.append(info, aim);
    if (p.bleeding.length) controls.append(button('Lägg förband', () => g.bandage(), '', !g.canBandage()));
    if (g.canFix()) controls.append(button('Rätta till', () => g.fix()));
    controls.append(button('Avsluta tur', () => g.endTurn(), 'primary', !mine));
    if (!activeHostiles(g).length) controls.append(el('span', 'info', 'Inga fiender kvar.'));
    panel.append(order, controls);
  }
}

/** Samtalsrutan. Språkmodellen står för replikerna, spelmotorn för allt som har konsekvenser. */
export class DialogUi {
  private npc: Actor | null = null;
  private history: DialogEntry[] = [];
  private options: string[] = [];
  private ai = true;
  private waiting = false;

  constructor(private g: Game) {
    $<HTMLFormElement>('dialog-form').onsubmit = (e) => {
      e.preventDefault();
      const input = $<HTMLInputElement>('dialog-input');
      const text = input.value.trim();
      if (!text || this.waiting) return;
      input.value = '';
      void this.say(text);
    };
  }

  async open(npc: Actor) {
    this.npc = npc;
    this.history = [];
    this.options = [];
    this.ai = true;
    this.g.state.mode = 'dialog';
    $('dialog').hidden = false;
    $('bottom').hidden = true;
    $('dialog-name').textContent = npc.name;
    $<HTMLImageElement>('dialog-portrait').src = portraitUrl(npc.sprite);
    this.g.changed();
    await this.npcTurn();
  }

  private close() {
    this.npc = null;
    $('dialog').hidden = true;
    $('bottom').hidden = false;
    if (this.g.state.mode === 'dialog') this.g.state.mode = 'explore';
    this.g.changed();
  }

  private async npcTurn() {
    const npc = this.npc!;
    this.waiting = true;
    this.render();
    let turn = this.ai ? await requestTurn(this.g, npc, this.history) : null;
    if (this.npc !== npc) return;
    if (!turn) {
      this.ai = false;
      turn = scriptedTurn(npc, this.history);
    }
    this.history.push({ role: 'npc', text: turn.line });
    this.options = turn.options;
    this.waiting = false;
    this.render();
  }

  private async say(text: string) {
    this.history.push({ role: 'player', text });
    await this.npcTurn();
  }

  private async act(id: string) {
    const npc = this.npc!;
    const intent = INTENTS[id];
    const result = intent.apply(this.g, npc);
    const shown = result.replace(/^Spelaren/, this.g.player.name);
    if (intent.ends) {
      this.close();
      return;
    }
    this.g.log(shown);
    this.history.push({ role: 'event', text: result });
    this.g.changed();
    await this.npcTurn();
  }

  private render() {
    const npc = this.npc!;
    const playerName = this.g.player.name;
    $('dialog-mode').textContent = this.ai ? '' : 'Förskriven dialog (ingen AI ansluten)';
    $('dialog-form').hidden = !this.ai;

    const text = $('dialog-text');
    text.replaceChildren(
      ...this.history.slice(-8).map((h) => {
        if (h.role === 'npc') return el('p', '', h.text);
        if (h.role === 'player') return el('p', 'player', `${playerName}: ${h.text}`);
        return el('p', 'event', h.text.replace(/^Spelaren/, playerName));
      }),
    );
    if (this.waiting) text.append(el('p', 'wait', '…'));
    text.scrollTop = text.scrollHeight;

    const box = $('dialog-options');
    box.replaceChildren();
    if (this.waiting) return;
    let n = 1;
    const add = (label: string, cls: string, fn: () => void) => {
      const b = el('button', cls, `${n++}. ${label}`);
      b.onclick = fn;
      box.append(b);
    };
    for (const o of this.options) add(o, '', () => void this.say(o));
    for (const id of NPCS[npc.npc!].intents) {
      const intent = INTENTS[id];
      if (!intent.available(this.g, npc)) continue;
      add(`[${intent.label(this.g)}]`, id === 'anfall' ? 'act danger' : 'act', () => void this.act(id));
    }
    add('Farväl.', 'bye', () => this.close());
  }
}
