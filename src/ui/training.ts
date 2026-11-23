import { SKILLS } from '../data/skills';
import { skillName } from '../engine/creation';
import type { Game } from '../engine/game';
import { bLevel } from '../engine/rules';
import { weekProblem } from '../engine/progress';
import { baseCost, canConvert, raiseCost, raiseSkill, skillCap } from '../engine/time';
import { $, el } from './hud';
import { WeekPlanner } from './week';

/**
 * Vila och träning: EP växlas in mot FV enligt kostnadstabellen efter en veckas vila, bonus-EP
 * fördelas, och gruppen planerar veckor med träning, lärare, böcker och arbete (steg 8).
 */
export class TrainingUi {
  private planner: WeekPlanner;

  constructor(private g: Game) {
    this.planner = new WeekPlanner(g, () => this.render());
    $('training-close').onclick = () => this.close();
    g.onUi((name) => name === 'training' && this.open());
  }

  open() {
    $('training').hidden = false;
    this.render();
  }

  private close() {
    $('training').hidden = true;
    this.g.changed();
  }

  private render() {
    const g = this.g;
    const p = g.player;
    const ch = g.char;
    const body = $('training-body');
    body.replaceChildren();
    // Var och en i gruppen tränar för sig.
    const members = g.partyMembers();
    if (members.length > 1) {
      const tabs = el('div', 'chips');
      for (const m of members) {
        const b = el('button', m === p ? 'primary' : '', m.name);
        b.onclick = () => {
          g.setFocus(m.id);
          this.render();
        };
        tabs.append(b);
      }
      body.append(tabs);
    }
    const week = weekProblem(g);
    if (week) body.append(el('p', 'note', `Veckoplanen: ${week}`));
    else body.append(this.planner.render());
    body.append(el('h3', '', `Växla in EP: ${p.name}`));
    const bonus = ch.bonusEp ?? 0;
    body.append(
      el(
        'p',
        'note',
        canConvert(p)
          ? `Du har vilat en vecka och kan växla in erfarenhetspoäng. Bonus-EP att fördela: ${bonus}. Silver: ${p.silver}.`
          : 'Erfarenhetspoäng kan bara växlas in efter en sammanhängande vila på minst sju dagar.',
      ),
    );
    const keys = [...new Set([...Object.keys(p.skills), ...Object.keys(p.ep)])]
      .filter((k) => SKILLS[k.split(':')[0]])
      .sort((a, b) => (p.ep[b] ?? 0) - (p.ep[a] ?? 0) || skillName(a).localeCompare(skillName(b), 'sv'));
    const table = el('table', 'training-table');
    const head = el('tr');
    for (const h of ['Färdighet', 'FV', 'EP', 'Nästa FV kostar', '']) head.append(el('th', '', h));
    table.append(head);
    for (const k of keys) {
      const fv = p.skills[k] ?? 0;
      const def = SKILLS[k.split(':')[0]];
      const cost = raiseCost(g, p, k);
      const capped = fv + 1 > skillCap(g, p, k);
      const tr = el('tr');
      const raise = el('button', '', 'Höj');
      raise.disabled = !canConvert(p) || capped || (p.ep[k] ?? 0) + bonus < cost;
      raise.title = capped ? 'FV kan inte bli högre' : `Grundkostnad ${baseCost(g, k)} EP`;
      raise.onclick = () => {
        raiseSkill(g, k);
        this.render();
      };
      const fvText = def.category === 'B' ? `${fv} (B${bLevel(fv)})` : String(fv);
      tr.append(el('td', '', skillName(k)), el('td', '', fvText), el('td', '', String(p.ep[k] ?? '')), el('td', '', capped ? 'tak' : `${cost} EP`));
      const c1 = el('td');
      c1.append(raise);
      tr.append(c1);
      table.append(tr);
    }
    body.append(table);
  }
}
