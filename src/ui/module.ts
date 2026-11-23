import type { Game } from '../engine/game';
import { leaveModule, mainQuestDone, moduleOf, nextModules, pendingEpilogue, questLog, stayAfterEpilogue, startModule } from '../engine/modules';
import { ATTR_KEYS, type AbilityChoice, type Actor, type AttrKey, type GameState } from '../engine/types';
import { ABILITY_BY_ID } from '../data/abilities';
import { PROFESSIONS } from '../data/professions';
import { skillName } from '../engine/creation';
import { abilityTiers, chooseHeroAbility, choiceKind, heroShopProblem, raiseAttribute, rollHeroAbility, skillOptions } from '../engine/hero';
import { joinAcademy } from '../engine/progress';
import { HERO, TRAINING } from '../engine/rules';
import { CITY } from '../content';
import { $, el } from './hud';

function button(text: string, onClick: () => void, cls = ''): HTMLButtonElement {
  const b = el('button', cls, text);
  b.onclick = onClick;
  return b;
}

/** Ett fönster med text och knappar (epilogen och frågan vid utgången). */
function modal(title: string, paragraphs: string[], buttons: HTMLButtonElement[]) {
  $('modal-title').textContent = title;
  $('modal-body').replaceChildren(...paragraphs.map((p) => el('p', '', p)));
  $('modal-buttons').replaceChildren(...buttons);
  $('modal').hidden = false;
}

const closeModal = () => ($('modal').hidden = true);

/** Uppdragsloggen som element: huvuduppdraget först, sedan sidouppdragen. */
export function renderQuestLog(g: Game): HTMLElement {
  const box = el('div');
  const log = questLog(g);
  if (!log.length) box.append(el('p', 'note', 'Ni har inga uppdrag än. Tala med folk.'));
  for (const e of log) {
    const q = el('div', 'quest');
    q.append(el('h4', '', `${e.quest.main ? 'Huvuduppdrag' : 'Sidouppdrag'}: ${e.quest.name}`), el('span', 'status', e.status === 'aktivt' ? 'Pågår' : e.status === 'klart' ? 'Klart' : 'Misslyckat'), el('p', '', e.quest.description));
    if (e.steps.length) {
      const ul = el('ul');
      for (const s of e.steps) ul.append(el('li', '', s));
      q.append(ul);
    }
    box.append(q);
  }
  return box;
}

/**
 * Modulens gränssnitt: epilogen när huvuduppdraget är klart, frågan vid en utgång och skärmen
 * mellan äventyren där nästa modul väljs. `onStart` tar emot speltillståndet för nästa modul.
 */
export class ModuleUi {
  constructor(
    private g: Game,
    private onStart: (state: GameState) => void,
  ) {
    g.onChange(() => this.update());
    g.onUi((name) => name === 'exit' && this.askExit());
    this.update();
  }

  private update() {
    const g = this.g;
    $('between').hidden = g.state.mode !== 'ended';
    if (g.state.mode === 'ended') {
      closeModal();
      this.renderBetween();
      return;
    }
    const ep = pendingEpilogue(g);
    if (ep && $('modal').hidden && $('panel').hidden && $('dialog').hidden && $('training').hidden) {
      modal(`Epilog: ${moduleOf(g).name}`, ep, [
        button('Avsluta äventyret', () => leaveModule(g), 'primary'),
        button('Stanna kvar', () => {
          closeModal();
          stayAfterEpilogue(g);
        }),
      ]);
    }
  }

  private askExit() {
    const g = this.g;
    const mod = moduleOf(g);
    const exit = g.exitHere();
    const text = mainQuestDone(g)
      ? [`${exit?.name ?? 'Utgången'} leder bort från ${mod.name}. Vill ni lämna äventyret?`]
      : [
          `${exit?.name ?? 'Utgången'} leder bort från ${mod.name}.`,
          'Ni har inte fullbordat huvuduppdraget. Är ni säkra på att ni vill lämna äventyret?',
        ];
    modal('Lämna äventyret?', text, [
      button('Lämna', () => {
        closeModal();
        leaveModule(g);
      }, 'danger'),
      button('Stanna', closeModal, 'primary'),
    ]);
  }

  private renderBetween() {
    const g = this.g;
    const body = $('between-body');
    const mod = moduleOf(g);
    const done = g.state.completed.includes(mod.id);
    const party = g
      .partyMembers()
      .map((m) => `${m.name}${g.charOf(m)?.heroTotal ? ` (${g.charOf(m)!.heroPoints ?? 0} HP)` : ''}`)
      .join(', ');
    body.replaceChildren(
      el('p', 'sub', done ? `Äventyret i ${mod.name} är fullbordat.` : `Ni lämnade ${mod.name}.`),
      el('h3', '', 'Uppdrag'),
      renderQuestLog(g),
      el('h3', '', 'Gruppen'),
      el('p', '', `${party}. Silver: ${g.leader.silver}.`),
      el('h3', '', CITY.name),
      el('p', 'note', 'Mellan äventyren stannar ni i staden. Planera veckorna med träning, lärare, studier och arbete, och växla in era erfarenhetspoäng.'),
      button('Vila, träning och EP', () => g.openUi('training'), 'primary'),
      ...this.academy(),
      ...this.heroShop(),
      el('h3', '', 'Välj nästa äventyr'),
    );
    const list = el('div', 'modules');
    for (const { module: m, done: played } of nextModules(g.state)) {
      const card = el('div', 'module-card');
      card.append(
        el('h4', '', m.name),
        el('span', 'status', `Svårighetsgrad: ${m.difficulty}${m.campaign ? '' : ' · övningsmodul'}${played ? ' · redan spelat' : ''}`),
        el('p', '', m.description),
        button(m.id === mod.id ? 'Återvänd' : 'Ge er av', () => this.onStart(startModule(g.state, m.id, g.rng)), 'primary'),
      );
      list.append(card);
    }
    body.append(list);
  }

  /** Medlemskap i magiakademin för dem som kan magi (biblioteket är gratis för medlemmar). */
  private academy(): HTMLElement[] {
    const g = this.g;
    const mages = g.partyMembers().filter((m) => Object.keys(m.skills).some((k) => k.startsWith('magiskola:')));
    if (!mages.length) return [];
    const out: HTMLElement[] = [el('h3', '', CITY.academy)];
    for (const m of mages) {
      const ch = g.charOf(m)!;
      if (ch.academy) {
        out.push(el('p', 'note', `${m.name} är medlem och får studera i biblioteket.`));
        continue;
      }
      const b = button(`${m.name} blir medlem (${TRAINING.academyFee} sm)`, () => {
        joinAcademy(g, m);
        g.changed();
      });
      b.disabled = g.leader.silver < TRAINING.academyFee;
      out.push(b);
    }
    return out;
  }

  /** Hjältepoäng mellan äventyren: slag för särskild förmåga och höjda grundegenskaper. */
  private heroShop(): HTMLElement[] {
    const g = this.g;
    const heroes = g.partyMembers().filter((m) => (g.charOf(m)?.heroPoints ?? 0) > 0 || g.charOf(m)?.heroPending);
    if (!heroes.length) return this.shopNote?.text ? [el('h3', '', 'Hjältepoäng'), el('p', 'sub', this.shopNote.text)] : [];
    const out: HTMLElement[] = [
      el('h3', '', 'Hjältepoäng'),
      el('p', 'note', `Ett slag på tabellen över särskilda förmågor: ${abilityTiers().map((t) => `2T20 + ${t.bonus} för ${t.hp} HP`).join(', ')}. En grundegenskap (inte STO) höjs med 1 för ${HERO.attrCost} HP.`),
    ];
    if (this.shopNote?.text) out.push(el('p', this.shopNote.warn ? 'note warn' : 'sub', this.shopNote.text));
    for (const m of heroes) {
      const ch = g.charOf(m)!;
      const row = el('div', 'hero-shop');
      row.append(el('b', '', `${m.name}: ${ch.heroPoints ?? 0} HP`));
      if (ch.heroPending) {
        row.append(...this.pendingChoice(m));
        out.push(row);
        continue;
      }
      abilityTiers().forEach((t, i) => {
        const b = button(`Förmåga 2T20+${t.bonus} (${t.hp} HP)`, () => this.shop(() => rollHeroAbility(g, m, i)));
        b.disabled = !!heroShopProblem(g, m, t.hp);
        row.append(b);
      });
      const attr = el('select');
      for (const k of ATTR_KEYS.filter((k) => k !== 'STO')) attr.append(new Option(`${k} ${ch.attrs[k]}`, k));
      const raise = button(`Höj (${HERO.attrCost} HP)`, () => this.shop(() => raiseAttribute(g, m, attr.value as AttrKey)));
      raise.disabled = !!heroShopProblem(g, m, HERO.attrCost);
      row.append(attr, raise);
      out.push(row);
    }
    return out;
  }

  /** Valet för en framslagen förmåga som gäller en färdighet, ett språk, ett yrke eller grundegenskaper. */
  private pendingChoice(m: Actor): HTMLElement[] {
    const g = this.g;
    const ch = g.charOf(m)!;
    const def = ABILITY_BY_ID[ch.heroPending!.id];
    const kind = choiceKind(def);
    const out: HTMLElement[] = [el('span', '', `${def.name}: ${def.desc}`)];
    const select = (values: [string, string][]) => {
      const s = el('select');
      for (const [v, t] of values) s.append(new Option(t, v));
      return s;
    };
    let read: () => AbilityChoice = () => ({});
    if (kind === 'färdighet' || kind === 'två färdigheter') {
      const opts = skillOptions(g, m, def).map((k) => [k, k.startsWith('spell:') ? k.slice(6) : skillName(k)] as [string, string]);
      const a = select(opts);
      out.push(a);
      if (kind === 'två färdigheter') {
        const b = select(opts);
        if (opts[1]) b.value = opts[1][0];
        out.push(b);
        read = () => ({ skills: [a.value, b.value] });
      } else read = () => ({ skill: a.value });
    } else if (kind === 'språk' || kind === 'folkslag') {
      const input = el('input');
      input.placeholder = kind === 'språk' ? 'Språk' : 'Folkslag eller ras';
      out.push(input);
      read = () => (kind === 'språk' ? { language: input.value } : { foe: input.value });
    } else if (kind === 'yrke') {
      const s = select(Object.values(PROFESSIONS).filter((p) => p.id !== ch.profession).map((p) => [p.id, p.name]));
      out.push(s);
      read = () => ({ profession: s.value });
    } else if (kind === 'grundegenskaper') {
      const attrs = ATTR_KEYS.filter((k) => k !== 'STO').map((k) => [k, k] as [string, string]);
      const mode = select([
        ['2', '+2 på en'],
        ['1', '+1 på tre'],
      ]);
      const picks = [select(attrs), select(attrs), select(attrs)];
      picks[1].value = attrs[1][0];
      picks[2].value = attrs[2][0];
      out.push(mode, ...picks);
      read = () => {
        if (mode.value === '2') return { attrs: { [picks[0].value]: 2 } };
        return { attrs: Object.fromEntries(picks.map((p) => [p.value, 1])) };
      };
    }
    out.push(button('Ta förmågan', () => this.shop(() => chooseHeroAbility(g, m, read())), 'primary'));
    return out;
  }

  /** Det senaste som hände i hjältebutiken, eller felet. */
  private shopNote: { text: string; warn: boolean } | null = null;

  private shop(fn: () => string | null) {
    const before = this.g.state.log.length;
    const problem = fn();
    this.shopNote = problem ? { text: problem, warn: true } : { text: this.g.state.log.slice(before).join(' '), warn: false };
    this.g.changed();
  }
}
