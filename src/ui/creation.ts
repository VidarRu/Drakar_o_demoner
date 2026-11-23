import { ABILITY_BY_ID, type RaisableAttr } from '../data/abilities';
import { FOLK_LIST } from '../data/creatures';
import { ARMOR_LIST, SHIELD_LIST } from '../data/armor';
import { ITEM_LIST } from '../data/equipment';
import { PROFESSION_LIST } from '../data/professions';
import { RACE_LIST } from '../data/races';
import { MARTIAL_TECHNIQUES, SKILL_LIST, SKILLS } from '../data/skills';
import { SPELLS } from '../data/spells';
import type { SkillOption } from '../data/types';
import { MELEE_WEAPONS, RANGED_WEAPONS, WEAPONS } from '../data/weapons';
import {
  ability,
  allErrors,
  availableSpells,
  baseCost,
  bpLeft,
  capitalTotal,
  epBudget,
  epSpent,
  equipmentCost,
  equipmentName,
  finalAttrs,
  finalize,
  GROUP_NAMES,
  isForbidden,
  maxPurchase,
  maxStartFv,
  newDraft,
  optionFor,
  profession,
  race,
  racialAttrs,
  RAISABLE,
  rollAbility,
  rollCapital,
  rollSocial,
  rollSwordHand,
  skillAttr,
  skillBase,
  skillCost,
  skillName,
  skillStatus,
  skillValue,
  slug,
  socialClass,
  socialTotal,
  startSpellCount,
  startSpellSkill,
  startCapital,
  startingSkills,
  stepErrors,
  STEPS,
  swordHand,
  type Draft,
  type Step,
} from '../engine/creation';
import { AGE, AGE_GROUPS, attrPrice, damageBonus, grip, maxKp, movement, stoPrice } from '../engine/rules';
import type { Character } from '../engine/types';
import { PLAYER_SPRITES, PROFESSION_SPRITES } from '../content';
import { portraitUrl } from '../game/art';
import { $, el } from './hud';

const STEP_NAMES: Record<Step, string> = {
  grund: 'Ras och yrke',
  egenskaper: 'Grundegenskaper',
  bakgrund: 'Bakgrund',
  yrkesfardigheter: 'Yrkesfärdigheter',
  fardigheter: 'Startfärdigheter',
  utrustning: 'Utrustning',
};

const LANGUAGES = ['Alviska', 'Dvärgiska', 'Svartiska'];
const INSTRUMENTS = ['Luta', 'Harpa', 'Lyra', 'Flöjt', 'Trumma'];
const AGE_NAMES = { ung: 'Ung', mogen: 'Mogen', medelålders: 'Medelålders', gammal: 'Gammal' };
const sign = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0');

function button(text: string, onclick: () => void, cls = '', disabled = false) {
  const b = el('button', cls, text);
  b.type = 'button';
  b.disabled = disabled;
  b.onclick = onclick;
  return b;
}

function stepper(value: string, dec: () => void, inc: () => void, canDec: boolean, canInc: boolean) {
  const box = el('span', 'stepper');
  box.append(button('−', dec, '', !canDec), el('b', '', value), button('+', inc, '', !canInc));
  return box;
}

function select(options: [string, string][], value: string, onchange: (v: string) => void, placeholder?: string) {
  const s = el('select');
  if (placeholder) s.append(new Option(placeholder, ''));
  for (const [v, label] of options) s.append(new Option(label, v));
  s.value = value;
  s.onchange = () => onchange(s.value);
  return s;
}

function textInput(value: string, onchange: (v: string) => void, placeholder = '', list?: string[]) {
  const i = el('input');
  i.value = value;
  i.placeholder = placeholder;
  i.onchange = () => onchange(i.value);
  if (list) {
    const id = `dl-${Math.random().toString(36).slice(2)}`;
    const dl = el('datalist');
    dl.id = id;
    for (const v of list) dl.append(new Option(v));
    i.setAttribute('list', id);
    const wrap = el('span');
    wrap.append(i, dl);
    return wrap;
  }
  return i;
}

/** Guiden för att skapa en rollperson med bakgrundspoäng, steg för steg enligt Bok I. */
const portraits: Record<string, string> = {};
const portrait = (id: string) => (portraits[id] ??= portraitUrl(id));

export class CreatorUi {
  private d: Draft = newDraft();
  private step = 0;

  constructor(
    private root: HTMLElement,
    private onDone: (c: Character) => void,
  ) {
    this.d.name = 'Halvar';
    this.render();
  }

  private update = (fn: () => void) => {
    fn();
    this.render();
  };

  private render() {
    const d = this.d;
    const step = STEPS[this.step];
    // På sista steget visas allt som återstår, så att knappen aldrig är spärrad utan förklaring.
    const errors = this.step === STEPS.length - 1 ? allErrors(d) : stepErrors(d, step);
    const root = this.root;
    root.replaceChildren();

    const tabs = el('ol', 'steps');
    STEPS.forEach((s, i) => {
      const li = el('li', i === this.step ? 'on' : i < this.step ? 'done' : '', `${i + 1}. ${STEP_NAMES[s]}`);
      if (i < this.step) li.onclick = () => this.update(() => (this.step = i));
      tabs.append(li);
    });

    const budget = el('div', 'budget');
    budget.append(el('span', bpLeft(d) < 0 ? 'bad' : '', `BP kvar: ${bpLeft(d)}`));
    if (this.step >= 4) budget.append(el('span', epBudget(d) - epSpent(d) < 0 ? 'bad' : '', `EP kvar: ${epBudget(d) - epSpent(d)}`));
    if (this.step >= 5) budget.append(el('span', '', `Silver kvar: ${(startCapital(d) ?? 0) - equipmentCost(d)}`));

    const body = el('div', 'step-body');
    this[step](body);

    const nav = el('div', 'row');
    nav.append(button('← Tillbaka', () => this.update(() => this.step--), '', this.step === 0));
    if (this.step < STEPS.length - 1) {
      nav.append(button('Nästa →', () => this.update(() => this.step++), 'primary', errors.length > 0));
    } else {
      const all = allErrors(d);
      nav.append(button('Börja äventyret', () => this.onDone(finalize(this.d)), 'primary', all.length > 0));
    }

    const err = el('ul', 'errors');
    for (const e of errors) err.append(el('li', '', e));
    root.append(tabs, budget, body, err, nav);
  }

  // ---------------------------------------------------------------- 1. ras och yrke

  private grund(body: HTMLElement) {
    const d = this.d;
    const name = el('label', '', 'Namn ');
    name.append(textInput(d.name, (v) => this.update(() => (d.name = v))));
    const gender = el('label', '', 'Kön ');
    gender.append(select([['man', 'Man'], ['kvinna', 'Kvinna']], d.gender, (v) => this.update(() => (d.gender = v as Draft['gender']))));

    const races = el('div', 'choices');
    for (const r of RACE_LIST) {
      const mods = RAISABLE.filter((k) => r.mods[k]).map((k) => `${k} ${sign(r.mods[k])}`).join(', ') || 'inga modifikationer';
      const b = button('', () => this.update(() => this.setRace(r.id)), d.race === r.id ? 'sel' : '');
      b.append(el('b', '', r.name), el('small', '', `${r.bp} BP · ${mods} · STO ${r.sto.min}–${r.sto.max}`));
      races.append(b);
    }

    const profs = el('div', 'choices');
    for (const p of PROFESSION_LIST) {
      const req = Object.entries(p.requirements).map(([k, v]) => `${k} ${v}`).join(', ');
      const b = button('', () => this.update(() => this.setProfession(p.id)), d.profession === p.id ? 'sel' : '');
      b.title = `${p.desc}\n\n${p.ability.name}: ${p.ability.desc}`;
      b.append(el('b', '', p.name), el('small', '', `Krav: ${req}`));
      profs.append(b);
    }
    const p = profession(d);
    const info = el('p', 'note', `${p.desc} Yrkesförmåga – ${p.ability.name}: ${p.ability.desc}`);
    const r = race(d);
    const raceInfo = el('p', 'note', r.traits.join(' ') || 'Människor passar till alla yrken.');
    body.append(name, gender, el('h3', '', 'Ras'), races, raceInfo, el('h3', '', 'Yrke'), profs, info, el('h3', '', 'Figur'), this.figures());
  }

  /** Figuren på kartan. Utan eget val används den som hör till yrket. */
  private figures(): HTMLElement {
    const d = this.d;
    const current = d.sprite ?? PROFESSION_SPRITES[d.profession] ?? 'krigare';
    const box = el('div', 'choices figures');
    for (const s of PLAYER_SPRITES) {
      const b = button('', () => this.update(() => (d.sprite = s.id)), current === s.id ? 'sel' : '');
      const img = el('img') as HTMLImageElement;
      img.src = portrait(s.id);
      img.alt = '';
      b.append(img, el('b', '', s.name));
      box.append(b);
    }
    return box;
  }

  private setRace(id: string) {
    this.d.race = id;
    this.d.stoSteps = 0;
    this.d.reads = undefined;
  }

  private setProfession(id: string) {
    const d = this.d;
    if (d.profession === id) return;
    d.profession = id;
    d.profSkills = [];
    d.targets = {};
    d.spells = [];
    d.techniques = [];
    if (d.abilityDice !== undefined && ability(d)?.magicianOnly) d.abilityChoice = undefined;
  }

  // ---------------------------------------------------------------- 2. grundegenskaper

  private egenskaper(body: HTMLElement) {
    const d = this.d;
    const r = race(d);
    const req = profession(d).requirements;
    const attrs = racialAttrs(d);
    const table = el('table', 'attr-table');
    const head = el('tr');
    for (const h of ['', 'Krav', 'Ras', 'Köpt', 'Pris', 'Värde']) head.append(el('th', '', h));
    table.append(head);
    for (const k of RAISABLE) {
      const tr = el('tr');
      const v = d.bought[k];
      const cell = el('td');
      cell.append(
        stepper(String(v), () => this.update(() => d.bought[k]--), () => this.update(() => d.bought[k]++), v > 3, v < 18),
      );
      const ok = !req[k] || attrs[k] >= req[k]!;
      tr.append(el('th', '', k), el('td', '', req[k] ? String(req[k]) : ''), el('td', '', sign(r.mods[k])), cell, el('td', '', String(attrPrice(v))), el('td', ok ? '' : 'bad', String(attrs[k])));
      table.append(tr);
    }
    const sto = el('tr');
    const stoCell = el('td');
    stoCell.append(
      stepper(
        sign(d.stoSteps),
        () => this.update(() => d.stoSteps--),
        () => this.update(() => d.stoSteps++),
        d.stoSteps > -5 && attrs.STO > r.sto.min,
        d.stoSteps < 5 && attrs.STO < r.sto.max,
      ),
    );
    sto.append(el('th', '', 'STO'), el('td', '', ''), el('td', '', `${r.sto.min}–${r.sto.max} (${r.sto.normal})`), stoCell, el('td', '', String(stoPrice(d.stoSteps))), el('td', '', String(attrs.STO)));
    table.append(sto);
    body.append(
      el('p', 'note', 'Köp grundegenskaper för bakgrundspoäng. Kraven för yrket gäller värdet efter rasens modifikation. Mindre STO än normalt ger BP tillbaka.'),
      table,
      el('p', 'note', `KP ${maxKp(attrs)} · Skadebonus ${damageBonus(attrs) || 'ingen'} · Förflyttning ${movement(attrs, r.move)} (före ålder och förmåga)`),
    );
  }

  // ---------------------------------------------------------------- 3. bakgrund

  private bakgrund(body: HTMLElement) {
    const d = this.d;
    const bpRow = (label: string, get: () => number, set: (n: number) => void, locked: boolean, max = 99) => {
      const row = el('div', 'kv');
      row.append(
        el('span', '', label),
        stepper(`${get()} BP`, () => this.update(() => set(get() - 1)), () => this.update(() => set(get() + 1)), !locked && get() > 0, !locked && get() < max && bpLeft(d) > 0),
      );
      return row;
    };

    // Särskild förmåga
    const a = ability(d);
    const abilityBox = el('section', 'box');
    abilityBox.append(
      el('h3', '', 'Särskild förmåga (2T20 + BP)'),
      bpRow('Bakgrundspoäng', () => d.abilityBp, (n) => (d.abilityBp = n), d.abilityDice !== undefined, 40),
    );
    if (d.abilityDice === undefined) {
      abilityBox.append(button('Slå 2T20', () => this.update(() => rollAbility(d, Math.random)), '', d.abilityBp < 1));
      if (d.abilityBp < 1) abilityBox.append(el('p', 'note', 'Lägg minst 1 BP för att få slå. Utan BP får rollpersonen ingen särskild förmåga.'));
    } else if (a) {
      abilityBox.append(el('p', '', `Slaget: ${d.abilityDice} + ${d.abilityBp} = ${d.abilityDice + d.abilityBp} – `), el('b', '', a.name), el('p', 'note', a.desc));
      this.abilityChoice(abilityBox);
      if (!d.abilityRerolled) {
        abilityBox.append(
          button('Spelledaren låter mig slå om (en gång)', () =>
            this.update(() => {
              rollAbility(d, Math.random);
              d.abilityRerolled = true;
            }),
          ),
        );
      }
    }

    // Svärdshand
    const swordBox = el('section', 'box');
    swordBox.append(el('h3', '', 'Svärdshand (2T6 + BP)'));
    if (a?.effect.kind === 'swordHand') swordBox.append(el('p', '', `${a.effect.value} genom den särskilda förmågan.`));
    else {
      swordBox.append(bpRow('Bakgrundspoäng', () => d.swordBp, (n) => (d.swordBp = n), d.swordDice !== undefined));
      if (d.swordDice === undefined) swordBox.append(button('Slå 2T6', () => this.update(() => rollSwordHand(d, Math.random))));
      else swordBox.append(el('p', '', `Slaget: ${d.swordDice} + ${d.swordBp} = ${d.swordDice + d.swordBp} – ${swordHand(d)}`));
    }

    // Socialt stånd och startkapital
    const socialBox = el('section', 'box');
    socialBox.append(el('h3', '', 'Socialt stånd (2T6 + BP)'), bpRow('Bakgrundspoäng', () => d.socialBp, (n) => (d.socialBp = n), d.socialDice !== undefined));
    if (d.socialDice === undefined) socialBox.append(button('Slå 2T6', () => this.update(() => rollSocial(d, Math.random))));
    else socialBox.append(el('p', '', `Slaget: ${d.socialDice} + ${d.socialBp} = ${socialTotal(d)} – ${socialClass(d)}`));

    const capBox = el('section', 'box');
    capBox.append(el('h3', '', 'Startkapital (2T6 + BP + halva BP för stånd)'), bpRow('Bakgrundspoäng', () => d.capitalBp, (n) => (d.capitalBp = n), d.capitalDice !== undefined));
    if (d.capitalDice === undefined) capBox.append(button('Slå 2T6', () => this.update(() => rollCapital(d, Math.random)), '', d.socialDice === undefined));
    else {
      capBox.append(
        el('p', '', `Slaget: ${d.capitalDice} + ${d.capitalBp} + ${Math.ceil(d.socialBp / 2)} = ${capitalTotal(d)} (högst ståndet + 10) – ${startCapital(d)} sm efter ålder`),
      );
    }

    // Ålder och modersmål
    const ageBox = el('section', 'box');
    const r = race(d);
    ageBox.append(el('h3', '', 'Ålder'));
    if (r.ageRules) {
      ageBox.append(el('p', 'note', 'Alver åldras inte: de räknas som unga för EP och startkapital och som mogna för grundegenskaper och högsta FV.'));
      const years = el('label', '', 'Ålder i år ');
      years.append(textInput(String(d.years ?? 200), (v) => this.update(() => (d.years = Math.max(20, parseInt(v, 10) || 200)))));
      ageBox.append(years);
    } else {
      const choices = el('div', 'choices small');
      for (const g of AGE_GROUPS) {
        const e = AGE[g];
        const mods = (['STY', 'FYS', 'SMI', 'INT', 'PSY', 'KAR'] as const).filter((k) => e.mods[k]).map((k) => `${k} ${sign(e.mods[k])}`).join(', ');
        const b = button('', () => this.update(() => ((d.age = g), (d.years = undefined))), d.age === g ? 'sel' : '');
        b.append(el('b', '', AGE_NAMES[g]), el('small', '', `${r.ages![g][0]}–${r.ages![g][1]} år · ${e.ep} EP · kapital ×${e.capital} · max FV ${e.maxFv}${mods ? ' · ' + mods : ''}`));
        choices.append(b);
      }
      ageBox.append(choices);
    }
    ageBox.append(el('p', 'note', `Överblivna BP blir ${5} EP styck. Just nu: ${epBudget(d)} EP till startfärdigheterna.`));

    const langBox = el('section', 'box');
    langBox.append(el('h3', '', 'Modersmål'));
    if ([...r.speaks, ...(Array.isArray(r.reads) ? r.reads : r.reads.oneOf)].includes('människospråk')) {
      const l = el('label', '', 'Människospråkets namn ');
      l.append(textInput(d.humanLanguage, (v) => this.update(() => (d.humanLanguage = v || 'Människospråket'))));
      langBox.append(l);
    }
    if (!Array.isArray(r.reads)) {
      const l = el('label', '', 'Läser och skriver ');
      l.append(select(r.reads.oneOf.map((x) => [x, x === 'människospråk' ? d.humanLanguage : 'Alviska']), d.reads ?? r.reads.oneOf[0], (v) => this.update(() => (d.reads = v))));
      langBox.append(l);
    }
    langBox.append(el('p', 'note', `Talar: ${r.speaks.map((x) => (x === 'människospråk' ? d.humanLanguage : x)).join(', ')}.`));
    body.append(abilityBox, swordBox, socialBox, capBox, ageBox, langBox);
  }

  private abilityChoice(box: HTMLElement) {
    const d = this.d;
    const a = ability(d)!;
    const e = a.effect;
    const c = (d.abilityChoice ??= {});
    const skillSelect = (keys: string[]) =>
      select(keys.map((k) => [k, skillName(k)] as [string, string]).sort((x, y) => x[1].localeCompare(y[1], 'sv')), c.skill ?? '', (v) => this.update(() => (c.skill = v || undefined)), 'Välj färdighet…');
    const secondary = SKILL_LIST.filter((s) => s.type === 'sekundär' && !s.specialized && !isForbidden(d, s.id)).map((s) => s.id);
    switch (e.kind) {
      case 'fvChoice': {
        const keys =
          e.filter === 'vapen'
            ? SKILL_LIST.filter((s) => s.weaponGroup).map((s) => s.id)
            : e.filter === 'hantverk'
              ? SKILLS.hantverk.specialized!.options!.map((o) => `hantverk:${o.id}`)
              : e.filter === 'tva_vapen'
                ? d.profSkills.filter((k) => k.startsWith('tva_vapen:'))
                : e.filter === 'alla'
                  ? SKILL_LIST.filter((s) => !s.specialized && !isForbidden(d, s.id)).map((s) => s.id)
                  : secondary;
        if (e.filter === 'tva_vapen' && !keys.length) box.append(el('p', 'note', 'Välj Två vapen bland yrkesfärdigheterna för att få nytta av förmågan (kommer i steg 4).'));
        box.append(skillSelect(keys.length ? keys : secondary));
        break;
      }
      case 'fixedChoice':
        box.append(skillSelect(secondary));
        break;
      case 'language':
        box.append(textInput(c.language ?? '', (v) => this.update(() => (c.language = v)), 'Språk', LANGUAGES));
        break;
      case 'extraProfessionAbility':
        box.append(select(PROFESSION_LIST.filter((p) => p.id !== d.profession).map((p) => [p.id, `${p.name}: ${p.ability.name}`]), c.profession ?? '', (v) => this.update(() => (c.profession = v)), 'Välj yrkesförmåga…'));
        break;
      case 'foe':
        box.append(select(FOLK_LIST, c.foe ?? '', (v) => this.update(() => (c.foe = v)), 'Välj folkslag eller ras…'));
        break;
      case 'attrs': {
        const row = el('div', 'kv');
        const attrs = (c.attrs ??= {});
        for (const k of RAISABLE) {
          const v = attrs[k] ?? 0;
          row.append(stepper(`${k} +${v}`, () => this.update(() => (attrs[k as RaisableAttr] = Math.max(0, v - 1))), () => this.update(() => (attrs[k as RaisableAttr] = v + 1)), v > 0, v < 2));
        }
        box.append(row);
        break;
      }
    }
  }

  // ---------------------------------------------------------------- 4. yrkesfärdigheter

  private yrkesfardigheter(body: HTMLElement) {
    const d = this.d;
    const p = profession(d);
    const toggle = (key: string) =>
      this.update(() => {
        if (d.profSkills.includes(key)) {
          d.profSkills = d.profSkills.filter((k) => k !== key);
          delete d.targets[key];
        } else d.profSkills.push(key);
      });
    body.append(el('p', 'note', `Välj ${p.picks} yrkesfärdigheter ur listan (${d.profSkills.length} valda). Bara yrkesfärdigheter och primära färdigheter kan köpas från start.`));

    const plain = el('div', 'checks');
    const special: HTMLElement[] = [];
    for (const o of p.options) {
      if (typeof o === 'string') {
        const def = SKILLS[o.split(':')[0]];
        if (def.specialized && !o.includes(':')) {
          special.push(this.addRow(def.name, def.specialized.label, o, def.id === 'tva_vapen'));
          continue;
        }
        plain.append(this.check(skillName(o), d.profSkills.includes(o), () => toggle(o), `${skillAttr(o)}`));
      } else {
        special.push(this.groupRow(o));
      }
    }
    body.append(el('h3', '', 'Färdigheter'), plain, ...special);

    if (d.profSkills.some((k) => k === 'stridskonster')) {
      const box = el('section', 'box');
      box.append(el('h3', '', 'Stridskonstens tekniker (grundkostnaden summeras)'));
      const checks = el('div', 'checks');
      for (const t of MARTIAL_TECHNIQUES) {
        checks.append(
          this.check(`${t.name} (${t.cost})`, d.techniques.includes(t.id), () =>
            this.update(() => (d.techniques = d.techniques.includes(t.id) ? d.techniques.filter((x) => x !== t.id) : [...d.techniques, t.id])),
          t.desc),
        );
      }
      box.append(checks);
      body.append(box);
    }

    const extra = ability(d)?.effect;
    if (extra?.kind === 'extraPicks') {
      const box = el('section', 'box');
      box.append(el('h3', '', `Stort kunskapsområde: ${extra.count} valfria sekundära färdigheter`));
      const options = SKILL_LIST.filter((s) => s.type === 'sekundär' && !s.specialized && !isForbidden(d, s.id) && !d.profSkills.includes(s.id)).map((s) => [s.id, s.name] as [string, string]);
      for (let i = 0; i < extra.count; i++) {
        box.append(select(options, d.extraSkills[i] ?? '', (v) => this.update(() => (d.extraSkills[i] = v, (d.extraSkills = d.extraSkills.filter(Boolean)))), 'Välj…'));
      }
      body.append(box);
    }
  }

  /** Lägger till en yrkesfärdighet en gång, även om ändringshändelsen skulle komma två gånger. */
  private addProf(key: string) {
    if (!this.d.profSkills.includes(key)) this.update(() => this.d.profSkills.push(key));
  }

  private check(label: string, on: boolean, onclick: () => void, title = '') {
    const l = el('label', on ? 'on' : '');
    const c = el('input');
    c.type = 'checkbox';
    c.checked = on;
    c.onchange = onclick;
    l.title = title;
    l.append(c, document.createTextNode(` ${label}`));
    return l;
  }

  /** En grupp i yrkeslistan: vapen, språk, hantverk, instrument eller magiskola. */
  private groupRow(o: Exclude<SkillOption, string>): HTMLElement {
    const d = this.d;
    const box = el('section', 'box');
    const chosen = d.profSkills.filter((k) => optionFor(profession(d), k) === o);
    box.append(el('h3', '', `${GROUP_NAMES[o.group]} (högst ${o.max}${o.required ? ', obligatorisk' : ''}) – ${chosen.length} valda`));
    if (o.group === 'vapen') {
      const checks = el('div', 'checks');
      for (const s of SKILL_LIST.filter((x) => x.weaponGroup)) {
        if (d.profSkills.includes(s.id) && !chosen.includes(s.id)) continue;
        checks.append(
          this.check(`${s.name} (${s.attr})`, chosen.includes(s.id), () =>
            this.update(() => (d.profSkills = chosen.includes(s.id) ? d.profSkills.filter((k) => k !== s.id) : [...d.profSkills, s.id])),
          s.desc),
        );
      }
      box.append(checks);
      return box;
    }
    const base = { tala: 'tala_frammande', läsa: 'las_skriv_frammande', hantverk: 'hantverk', instrument: 'spela_instrument', magiskola: 'magiskola' }[o.group];
    const def = SKILLS[base];
    this.chips(box, chosen);
    if (chosen.length < o.max) {
      if (def.specialized?.options) {
        const opts = def.specialized.options.filter((x) => !chosen.includes(`${base}:${x.id}`) && !isForbidden(d, `${base}:${x.id}`)).map((x) => [x.id, x.name] as [string, string]);
        box.append(select(opts, '', (v) => v && this.addProf(`${base}:${v}`), `Lägg till ${def.specialized.label}…`));
      } else {
        box.append(
          textInput('', (v) => v.trim() && this.addProf(`${base}:${slug(v)}`), `Lägg till ${def.specialized!.label} …`, o.group === 'instrument' ? INSTRUMENTS : LANGUAGES),
        );
      }
    }
    return box;
  }

  /** En underfärdighet utan tak i listan, t.ex. Kulturkännedom eller Två vapen. */
  private addRow(name: string, label: string, base: string, weaponPair: boolean): HTMLElement {
    const d = this.d;
    const box = el('section', 'box');
    const chosen = d.profSkills.filter((k) => k.startsWith(`${base}:`));
    box.append(el('h3', '', `${name} (ett val per ${label})`));
    this.chips(box, chosen);
    if (weaponPair) {
      const groups = SKILL_LIST.filter((s) => s.weaponGroup && s.weaponGroup !== 'avstånd').map((s) => [s.id, s.name] as [string, string]);
      let first = '';
      box.append(
        select(groups, '', (v) => (first = v), 'Svärdshand…'),
        select(groups, '', (v) => first && v && this.addProf(`${base}:${first}+${v}`), 'Sköldhand…'),
      );
    } else {
      box.append(textInput('', (v) => v.trim() && this.addProf(`${base}:${slug(v)}`), `Lägg till ${label} …`));
    }
    return box;
  }

  private chips(box: HTMLElement, keys: string[]) {
    const d = this.d;
    const row = el('div', 'chips');
    for (const k of keys) {
      const label = k.startsWith('tva_vapen:') ? `Två vapen: ${k.split(':')[1].split('+').map((x) => SKILLS[x]?.name ?? x).join(' + ')}` : skillName(k);
      row.append(button(`${label} ✕`, () => this.update(() => ((d.profSkills = d.profSkills.filter((x) => x !== k)), delete d.targets[k]))));
    }
    box.append(row);
  }

  // ---------------------------------------------------------------- 5. startfärdigheter

  private fardigheter(body: HTMLElement) {
    const d = this.d;
    const attrs = finalAttrs(d);
    body.append(
      el('p', 'note', `Höj FV med erfarenhetspoäng. Grundkostnad: primär 2, yrkesfärdighet 3. Kostnaden växer med FV, och inget får köpas högre än ${maxStartFv(d)} från start.`),
      el('p', 'note', `Grundegenskaper efter ålder: ${Object.entries(attrs).map(([k, v]) => `${k} ${v}`).join(', ')}.`),
    );
    const table = el('table', 'skill-table');
    const head = el('tr');
    for (const h of ['Färdighet', 'Grund', 'FV', 'EP']) head.append(el('th', '', h));
    table.append(head);
    const keys = startingSkills(d).sort((a, b) => {
      const order = (k: string) => ({ yrke: 0, primär: 1, fast: 2, sekundär: 3 })[skillStatus(d, k)];
      return order(a) - order(b) || skillName(a).localeCompare(skillName(b), 'sv');
    });
    for (const key of keys) {
      const tr = el('tr', skillStatus(d, key) === 'yrke' ? 'prof' : '');
      const base = skillBase(d, key);
      const fv = skillValue(d, key);
      const canBuy = baseCost(d, key) !== null;
      const max = maxPurchase(d, key);
      const cell = el('td');
      const set = (v: number) => this.update(() => (v <= base ? delete d.targets[key] : (d.targets[key] = v)));
      cell.append(canBuy ? stepper(String(fv), () => set(fv - 1), () => set(fv + 1), fv > base, fv < max) : el('b', '', String(fv)));
      const attr = skillAttr(key);
      tr.append(el('td', '', `${skillName(key)}${attr === 'spec' ? '' : ` (${attr})`}`), el('td', '', String(base)), cell, el('td', '', String(skillCost(d, key) || '')));
      table.append(tr);
    }
    body.append(table);

    const spells = availableSpells(d);
    if (profession(d).spellsAtStart) {
      const box = el('section', 'box');
      const max = startSpellCount(d);
      d.spells = d.spells.filter((id) => spells.includes(id));
      box.append(
        el('h3', '', `Besvärjelser (${d.spells.length} av ${max})`),
        el(
          'p',
          'note',
          'Husregel: välj (INT + PSY) / 4 besvärjelser ur din skola och de allmänna. De kostar inga EP. S = FV i skolan − skolvärdet + baschansen för INT, och växer när skolans FV stiger.',
        ),
      );
      if (!spells.length) box.append(el('p', 'note', 'Höj magiskolans FV för att kunna lära dig besvärjelser (FV måste vara minst skolvärdet).'));
      const st = el('table', 'skill-table');
      for (const id of spells) {
        const sp = SPELLS[id];
        const chosen = d.spells.includes(id);
        const tr = el('tr');
        const cell = el('td');
        const box2 = el('input');
        box2.type = 'checkbox';
        box2.checked = chosen;
        box2.disabled = !chosen && d.spells.length >= max;
        box2.onchange = () => this.update(() => (d.spells = chosen ? d.spells.filter((x) => x !== id) : [...d.spells, id]));
        cell.append(box2);
        tr.title = sp.desc;
        tr.append(cell, el('td', '', `${sp.name} (SV ${sp.sv}, ${sp.school})${sp.effect ? '' : ' – verkar inte i spelet än'}`), el('td', '', `S${startSpellSkill(d, id)}`));
        st.append(tr);
      }
      box.append(st);
      body.append(box);
    }

    if (ability(d)?.effect.kind === 'halfCost') {
      const box = el('section', 'box');
      box.append(el('h3', '', 'God känsla för yrket: halverad kostnad för'));
      const opts = d.profSkills.map((k) => [k, skillName(k)] as [string, string]);
      box.append(select(opts, d.halfCost ?? '', (v) => this.update(() => (d.halfCost = v || undefined)), 'Välj…'));
      body.append(box);
    }
  }

  // ---------------------------------------------------------------- 6. utrustning

  private utrustning(body: HTMLElement) {
    const d = this.d;
    const sty = finalAttrs(d).STY;
    const count = (id: string) => d.bought_items[id] ?? 0;
    const left = (startCapital(d) ?? 0) - equipmentCost(d);
    const buyRow = (id: string, label: string, detail: string, price: number) => {
      const row = el('div', 'kv');
      row.append(
        el('span', '', `${label} – ${detail}`),
        stepper(
          `${count(id)} × ${price} sm`,
          () => this.update(() => (count(id) > 1 ? (d.bought_items[id] = count(id) - 1) : (delete d.bought_items[id], this.unequip(id)))),
          () => this.update(() => (d.bought_items[id] = count(id) + 1)),
          count(id) > 0,
          price <= left,
        ),
      );
      return row;
    };
    const section = (title: string, rows: HTMLElement[]) => {
      const det = el('details');
      det.append(el('summary', '', title), ...rows);
      return det;
    };
    const gripText = (req: number, two: boolean) => ({ 'en hand': 'en hand', 'två händer': 'två händer', 'för tungt': 'för tungt' })[grip(req, sty, two)];

    body.append(el('p', 'note', `Startkapital ${startCapital(d)} sm. Köp det du behöver; resten blir silvermynt i börsen. Priserna gäller en större stad.`));
    body.append(
      section('Närstridsvapen', MELEE_WEAPONS.map((w) => buyRow(w.id, w.name, `${w.damage}, STY-krav ${w.styReq} (${gripText(w.styReq, w.twoHandedOnly)})`, w.price))),
      section('Avståndsvapen', RANGED_WEAPONS.map((w) => buyRow(w.id, w.name, `${w.damage}, STY-krav ${w.styReq}`, w.price))),
      section('Sköldar', SHIELD_LIST.map((s) => buyRow(s.id, s.name, `BV ${s.bv}, STY-krav ${s.styReq}`, s.price))),
      section('Rustningar', ARMOR_LIST.map((a) => buyRow(a.id, a.name, `abs ${a.abs}, ${a.covers.join(', ')}, ${a.weight} kg`, a.price))),
      section('Övrig utrustning', ITEM_LIST.filter((i) => ['behållare', 'kläder', 'äventyr', 'verktyg', 'tjuvverktyg', 'diverse', 'instrument'].includes(i.category)).map((i) => buyRow(i.id, i.name, i.category, i.price))),
    );

    const box = el('section', 'box');
    box.append(el('h3', '', 'Bär och använd'));
    const owned = Object.keys(d.bought_items);
    const weapons = owned.filter((id) => WEAPONS[id]?.kind === 'närstrid');
    const wl = el('label', '', 'Vapen i handen ');
    wl.append(select(weapons.map((id) => [id, equipmentName(id)]), d.equipped.weapon ?? '', (v) => this.update(() => (d.equipped.weapon = v || undefined)), 'Obeväpnad'));
    const shields = owned.filter((id) => SHIELD_LIST.some((s) => s.id === id));
    const sl = el('label', '', 'Sköld ');
    sl.append(select(shields.map((id) => [id, equipmentName(id)]), d.equipped.shield ?? '', (v) => this.update(() => (d.equipped.shield = v || undefined)), 'Ingen sköld'));
    const armorChecks = el('div', 'checks');
    for (const id of owned.filter((x) => ARMOR_LIST.some((a) => a.id === x))) {
      const on = d.equipped.armor.includes(id);
      armorChecks.append(this.check(equipmentName(id), on, () => this.update(() => (d.equipped.armor = on ? d.equipped.armor.filter((x) => x !== id) : [...d.equipped.armor, id]))));
    }
    const ol = el('label', '', 'Vapen i andra handen (Två vapen) ');
    ol.append(select(weapons.map((id) => [id, equipmentName(id)]), d.equipped.offhand ?? '', (v) => this.update(() => (d.equipped.offhand = v || undefined)), 'Inget'));
    box.append(wl, sl, ol, el('p', 'note', 'Med ett vapen i varje hand slår du först ett slag i Två vapen varje gång du anfaller: lyckas det anfaller du med båda. Avståndsvapen kan köpas men används först när avståndsstriden byggs in.'), armorChecks);

    const looks = el('section', 'box');
    looks.append(el('h3', '', 'Utseende och bakgrund'));
    const ta = el('textarea');
    ta.value = d.appearance;
    ta.rows = 3;
    ta.placeholder = 'Hår, ögon, klädsel, var rollpersonen kommer ifrån och varför hen är äventyrare …';
    ta.onchange = () => (d.appearance = ta.value);
    looks.append(ta);

    const a = ability(d);
    const summary = el('p', 'note', `${d.name}: ${race(d).name}, ${profession(d).name.toLowerCase()}, ${socialClass(d)?.toLowerCase()}. ${a ? `Särskild förmåga: ${ABILITY_BY_ID[a.id].name}. ` : ''}KP ${maxKp(finalAttrs(d))}.`);
    body.append(box, looks, summary);
  }

  private unequip(id: string) {
    const e = this.d.equipped;
    if (e.weapon === id) e.weapon = undefined;
    if (e.offhand === id) e.offhand = undefined;
    if (e.shield === id) e.shield = undefined;
    e.armor = e.armor.filter((x) => x !== id);
  }
}

/** Startskärmen med guiden. */
export function mountCreator(onDone: (c: Character) => void) {
  return new CreatorUi($('creator'), onDone);
}

