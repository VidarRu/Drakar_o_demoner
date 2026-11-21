import { requestTurn, scriptedTurn, type DialogEntry } from '../ai/dialogClient';
import { NPCS } from '../content';
import { ABILITY_BY_ID } from '../data/abilities';
import { ARMOR, SHIELDS } from '../data/armor';
import { PROFESSIONS } from '../data/professions';
import { RACES } from '../data/races';
import { SKILLS } from '../data/skills';
import { SPELLS } from '../data/spells';
import { skillName } from '../engine/creation';
import type { Game } from '../engine/game';
import { INTENTS } from '../engine/intents';
import { damageBonus } from '../engine/rules';
import { ATTR_KEYS, type Actor } from '../engine/types';
import { portraitUrl } from '../game/art';

export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
}

/** Rollformulär, logg och stridspanel. */
export class Hud {
  private logCount = -1;

  constructor(private g: Game) {
    $('hud').hidden = false;
    $('btn-parry').onclick = () => g.playerParry();
    $('btn-end').onclick = () => g.endTurn();
    $('btn-sheet').onclick = () => $('sheet').classList.toggle('open');
    g.onChange(() => this.render());
    this.render();
  }

  render() {
    this.renderSheet();
    this.renderLog();
    this.renderCombat();
    $('dead').hidden = this.g.state.mode !== 'dead';
  }

  private renderSheet() {
    const g = this.g;
    const p = g.player;
    const ch = g.state.character;
    const sheet = $('sheet');
    sheet.replaceChildren();

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

    const grid = el('div', 'grid');
    for (const k of ATTR_KEYS) {
      const cell = el('div', '', String(p.attrs[k]));
      cell.prepend(el('small', '', k));
      grid.append(cell);
    }

    const kv = (key: string, value: string, mark = false) => {
      const row = el('div', 'kv');
      const left = el('span', '', key);
      if (mark) left.append(el('span', 'mark', ' ✓'));
      row.append(left, el('b', '', value));
      return row;
    };

    const weapon = g.weaponOf(p);
    const sb = weapon.useDamageBonus ? damageBonus(p.attrs) : '';
    const armor = p.armor.map((id) => ARMOR[id]).filter(Boolean);
    const skills = Object.entries(p.skills).filter(([, fv]) => fv > 0);
    const isProf = (k: string) => ch.profSkills.includes(k);
    const isPrimary = (k: string) => SKILLS[k.split(':')[0]]?.type === 'primär';
    const row = ([k, fv]: [string, number]) => kv(skillName(k), String(fv), p.marks.includes(k));
    const byName = (a: [string, number], b: [string, number]) => skillName(a[0]).localeCompare(skillName(b[0]), 'sv');
    const ability = ch.ability ? ABILITY_BY_ID[ch.ability.id] : null;

    sheet.append(
      who,
      bar,
      el('h3', '', 'Grundegenskaper'),
      grid,
      kv('Skadebonus', sb ? `+${sb}` : 'ingen'),
      kv('Förflyttning', `${p.move} rutor`),
      el('h3', '', 'Utrustning'),
      kv(`${weapon.name} (${g.skillFv(p, weapon.skill)})`, weapon.damage + (sb ? ` + ${sb}` : '')),
      ...(p.shield ? [kv(`${SHIELDS[p.shield].name} (${g.skillFv(p, 'skoldar')})`, `BV ${SHIELDS[p.shield].bv}`)] : []),
      ...(armor.length ? armor.map((a) => kv(a.name, `abs ${a.abs}`)) : [kv('Ingen rustning', 'abs 0')]),
      kv('Silvermynt', String(p.silver)),
      ...(ability ? [el('h3', '', 'Särskild förmåga'), kv(ability.name, '')] : []),
      el('h3', '', 'Yrkesfärdigheter'),
      ...skills.filter(([k]) => isProf(k)).sort(byName).map(row),
      el('h3', '', 'Primära färdigheter'),
      ...skills.filter(([k]) => !isProf(k) && isPrimary(k)).sort(byName).map(row),
      ...(skills.some(([k]) => !isProf(k) && !isPrimary(k)) ? [el('h3', '', 'Övriga färdigheter')] : []),
      ...skills.filter(([k]) => !isProf(k) && !isPrimary(k)).sort(byName).map(row),
      ...(Object.keys(ch.spells).length ? [el('h3', '', 'Besvärjelser')] : []),
      ...Object.entries(ch.spells).map(([id, sv]) => kv(SPELLS[id].name, `S${sv}`)),
    );
  }

  private renderLog() {
    const log = this.g.state.log;
    if (log.length === this.logCount) return;
    this.logCount = log.length;
    const box = $('log');
    box.replaceChildren(...log.slice(-60).map((line) => el('p', '', line)));
    box.scrollTop = box.scrollHeight;
  }

  private renderCombat() {
    const { g } = this;
    const c = g.state.combat;
    $('combat').hidden = g.state.mode !== 'combat' || !c;
    if (g.state.mode !== 'combat' || !c) return;
    const mine = g.isPlayerTurn();
    const acted = !!c.acted[g.player.id];
    $('combat-info').textContent = mine
      ? `Runda ${c.round} · Din tur · ${c.movesLeft} steg kvar${acted ? ' · ingen handling' : ' · klicka på en fiende för att anfalla'}`
      : `Runda ${c.round} · ${g.actor(c.order[c.turn])?.name ?? 'Fienden'} agerar…`;
    $<HTMLButtonElement>('btn-parry').disabled = !mine || acted;
    $<HTMLButtonElement>('btn-end').disabled = !mine;
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
