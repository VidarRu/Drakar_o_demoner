import type { Game } from '../engine/game';
import { leaveModule, mainQuestDone, moduleOf, nextModules, pendingEpilogue, questLog, stayAfterEpilogue, startModule } from '../engine/modules';
import type { GameState } from '../engine/types';
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
    const party = g.partyMembers().map((m) => m.name).join(', ');
    body.replaceChildren(
      el('p', 'sub', done ? `Äventyret i ${mod.name} är fullbordat.` : `Ni lämnade ${mod.name}.`),
      el('h3', '', 'Uppdrag'),
      renderQuestLog(g),
      el('h3', '', 'Gruppen'),
      el('p', '', `${party}. Silver: ${g.leader.silver}.`),
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
}
