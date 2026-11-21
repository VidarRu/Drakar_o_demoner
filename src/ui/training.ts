import { SKILLS } from '../data/skills';
import { skillName } from '../engine/creation';
import type { Game } from '../engine/game';
import { bLevel } from '../engine/rules';
import { baseCost, canConvert, needsTeacher, raiseCost, raiseSkill, selfTrain, skillCap } from '../engine/time';
import { $, el } from './hud';

/** Kostnad för en veckas kost och logi medan man tränar. */
const WEEK_COST = 70;

/**
 * Träningen efter en veckas vila: EP växlas in mot FV enligt kostnadstabellen, bonus-EP fördelas
 * och man kan träna på egen hand en vecka i taget (ett Normalt grundegenskapsslag ger 1 EP).
 */
export class TrainingUi {
  constructor(private g: Game) {
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
    const ch = g.state.character;
    const body = $('training-body');
    body.replaceChildren();
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
    for (const h of ['Färdighet', 'FV', 'EP', 'Nästa FV kostar', '', '']) head.append(el('th', '', h));
    table.append(head);
    for (const k of keys) {
      const fv = p.skills[k] ?? 0;
      const def = SKILLS[k.split(':')[0]];
      const cost = raiseCost(g, p, k);
      const capped = fv + 1 > skillCap(g, p, k);
      const teacher = needsTeacher(k);
      const tr = el('tr');
      const raise = el('button', '', 'Höj');
      raise.disabled = !canConvert(p) || capped || teacher || (p.ep[k] ?? 0) + bonus < cost;
      raise.title = teacher ? 'Magiskolor höjs bara med lärare eller i ett magibibliotek' : capped ? 'FV kan inte bli högre än grundegenskapen' : `Grundkostnad ${baseCost(g, k)} EP`;
      raise.onclick = () => {
        raiseSkill(g, k);
        this.render();
      };
      const train = el('button', '', `Träna en vecka (${WEEK_COST} sm)`);
      train.disabled = p.silver < WEEK_COST || capped || teacher;
      train.onclick = () => {
        p.silver -= WEEK_COST;
        selfTrain(g, k);
        this.render();
      };
      const fvText = def.category === 'B' ? `${fv} (B${bLevel(fv)})` : String(fv);
      tr.append(el('td', '', skillName(k)), el('td', '', fvText), el('td', '', String(p.ep[k] ?? '')), el('td', '', teacher ? 'lärare' : capped ? 'tak' : `${cost} EP`));
      const c1 = el('td');
      c1.append(raise);
      const c2 = el('td');
      c2.append(train);
      tr.append(c1, c2);
      table.append(tr);
    }
    body.append(table);
    const log = el('div', 'training-log');
    for (const line of g.state.log.slice(-4)) log.append(el('p', '', line));
    body.append(log);
  }
}
