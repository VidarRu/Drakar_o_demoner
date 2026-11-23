import { BOOKS } from '../content';
import { SKILLS } from '../data/skills';
import { SPELLS } from '../data/spells';
import { skillName } from '../engine/creation';
import type { Game } from '../engine/game';
import {
  activityProblem,
  groupBooks,
  inCity,
  isTeaching,
  planProblem,
  runWeek,
  teacherCost,
  teachers,
  weekCost,
  weekWage,
  type WeekActivity,
  type WeekPlan,
} from '../engine/progress';
import { CITY } from '../content';
import { TRAINING } from '../engine/rules';
import type { Actor } from '../engine/types';
import { el } from './hud';

const optionLabel = (key: string) => (key.startsWith('spell:') ? `Besvärjelse: ${SPELLS[key.slice(6)]?.name ?? key}` : skillName(key));

/** Färdigheter och besvärjelser som är värda att pröva för en sysselsättning. */
function candidates(g: Game, a: Actor): string[] {
  const own = Object.keys(a.skills).filter((k) => SKILLS[k.split(':')[0]]);
  const general = Object.values(SKILLS).filter((s) => !s.specialized).map((s) => s.id);
  const spells = Object.keys(SPELLS).map((id) => `spell:${id}`);
  return [...new Set([...own, ...general, ...spells])];
}

/** Sysselsättningens första del: vad man gör (värdet kodar typ och lärare eller bok). */
function kindValue(act: WeekActivity): string {
  if (act.kind === 'lärare') return `lärare:${act.teacher}`;
  if (act.kind === 'bok') return `bok:${act.book}`;
  return act.kind;
}

/**
 * Veckoplanen (steg 8): var och en i gruppen väljer vad hen gör en vecka, och sedan går veckan.
 * Används i träningsvyn, både i en modul och mellan äventyren.
 */
export class WeekPlanner {
  private plan: WeekPlan = {};
  private result: string[] = [];

  constructor(
    private g: Game,
    private rerender: () => void,
  ) {}

  render(): HTMLElement {
    const g = this.g;
    const box = el('div', 'week');
    box.append(
      el('h3', '', inCity(g) ? `Veckan i ${CITY.name}` : 'Planera en vecka'),
      el(
        'p',
        'note',
        `Var och en väljer vad hen gör. Kost och logi kostar ${TRAINING.weekCost} sm per person och vecka. En lärare behöver FV ${TRAINING.teacherFv} och INT ${TRAINING.teacherInt} och kostar ${TRAINING.teacherCost} sm i veckan (${TRAINING.magicTeacherCost} för magi), tre gånger så mycket för en ensam elev.`,
      ),
    );
    const table = el('table', 'training-table week-table');
    const head = el('tr');
    for (const h of ['', 'Gör', 'Vad', '']) head.append(el('th', '', h));
    table.append(head);
    for (const m of g.partyMembers()) if (g.charOf(m)) table.append(this.row(m));
    box.append(table);

    const cost = weekCost(g, this.plan);
    const problem = planProblem(g, this.plan);
    const go = el('button', 'primary', `Låt veckan gå (${cost} sm)`);
    go.disabled = !!problem;
    go.title = problem ?? '';
    go.onclick = () => {
      const r = runWeek(g, this.plan);
      this.result = 'lines' in r ? r.lines : [r.problem];
      // Planen står kvar till nästa vecka, men det som inte längre går blir vila.
      for (const m of g.partyMembers()) if (this.plan[m.id] && activityProblem(g, m, this.plan[m.id], this.plan)) this.plan[m.id] = { kind: 'vila' };
      this.rerender();
    };
    const foot = el('div', 'week-foot');
    foot.append(go, el('span', 'note', problem ?? `Silver: ${g.leader.silver}`));
    box.append(foot);
    if (this.result.length) {
      const log = el('div', 'training-log');
      for (const line of this.result) log.append(el('p', '', line));
      box.append(log);
    }
    return box;
  }

  private set(id: string, act: WeekActivity) {
    this.plan[id] = act;
    this.rerender();
  }

  private row(a: Actor): HTMLElement {
    const g = this.g;
    const ch = g.charOf(a)!;
    const tr = el('tr');
    const act = this.plan[a.id] ?? { kind: 'vila' };
    if (isTeaching(g, this.plan, a.id)) {
      tr.append(el('td', '', a.name), el('td', '', 'Undervisar'), el('td'), el('td', 'note', 'Gratis'));
      return tr;
    }

    const kind = el('select');
    kind.append(new Option('Vila', 'vila'), new Option('Träna själv', 'ensam'));
    for (const t of teachers(g)) if (t.actorId !== a.id) kind.append(new Option(`Lärare: ${t.name}${t.free ? ' (gratis)' : ''}`, `lärare:${t.id}`));
    if (inCity(g) && ch.academy) kind.append(new Option(`Biblioteket i ${CITY.academy}`, 'bibliotek'));
    for (const b of groupBooks(g)) kind.append(new Option(`Läsa: ${b.name}`, `bok:${b.id}`));
    if (inCity(g)) kind.append(new Option(`Arbeta (${weekWage(ch)} sm)`, 'arbete'));
    kind.value = kindValue(act);
    kind.onchange = () => {
      const v = kind.value;
      if (v === 'vila') this.set(a.id, { kind: 'vila' });
      else if (v.startsWith('bok:')) this.set(a.id, { kind: 'bok', book: v.slice(4) });
      else if (v === 'arbete') this.set(a.id, { kind: 'arbete' });
      else this.set(a.id, this.firstValid(a, v) ?? (v === 'ensam' ? { kind: 'ensam', skill: '' } : v === 'bibliotek' ? { kind: 'bibliotek', skill: '' } : { kind: 'lärare', teacher: v.slice(7), skill: '' }));
    };

    const what = el('td');
    const options = this.options(a, act);
    if (options) {
      const pick = el('select');
      if (act.kind === 'arbete') pick.append(new Option('Ingen deltidsträning', ''));
      for (const k of options) pick.append(new Option(optionLabel(k), k));
      const current = 'skill' in act ? (act.skill ?? '') : '';
      if (current && !options.includes(current)) pick.append(new Option(optionLabel(current), current));
      pick.value = current;
      pick.onchange = () => this.set(a.id, { ...act, skill: pick.value } as WeekActivity);
      if (!options.length && act.kind !== 'arbete') what.append(el('span', 'note', 'Inget att lära här.'));
      else what.append(pick);
    } else if (act.kind === 'bok') {
      const b = BOOKS[act.book];
      what.append(el('span', 'note', b?.spell ? `Kodex: ${SPELLS[b.spell]?.name}` : `${skillName(b?.skill ?? '')}, ${ch.studied?.[act.book] ?? 0} av ${b?.maxEp ?? 0} EP`));
    }

    const problem = activityProblem(g, a, act, this.plan);
    let note = problem ?? '';
    if (!problem && act.kind === 'lärare') {
      const t = teachers(g).find((x) => x.id === act.teacher)!;
      const alone = Object.values(this.plan).filter((x) => x.kind === 'lärare' && x.teacher === act.teacher && x.skill === act.skill).length === 1;
      note = `${teacherCost(t, ch, act.skill, alone)} sm${alone && !t.free ? ', ensam elev (+5)' : ''}`;
    }
    const c1 = el('td');
    c1.append(kind);
    tr.append(el('td', '', a.name), c1, what, el('td', problem ? 'note warn' : 'note', note));
    return tr;
  }

  /** Valen i andra kolumnen, eller null om sysselsättningen inte har några. */
  private options(a: Actor, act: WeekActivity): string[] | null {
    const g = this.g;
    if (act.kind === 'vila' || act.kind === 'bok') return null;
    if (act.kind === 'arbete') return g.charOf(a)!.profSkills.filter((k) => !activityProblem(g, a, { kind: 'arbete', skill: k }, this.plan));
    const list = candidates(g, a).filter((k) => !activityProblem(g, a, { ...act, skill: k }, this.plan));
    return list.sort((x, y) => optionLabel(x).localeCompare(optionLabel(y), 'sv'));
  }

  /** Den första färdigheten som går för en ny sysselsättning. */
  private firstValid(a: Actor, v: string): WeekActivity | null {
    const base: WeekActivity = v === 'ensam' ? { kind: 'ensam', skill: '' } : v === 'bibliotek' ? { kind: 'bibliotek', skill: '' } : { kind: 'lärare', teacher: v.slice(7), skill: '' };
    const first = this.options(a, base)?.[0];
    return first ? ({ ...base, skill: first } as WeekActivity) : null;
  }
}
