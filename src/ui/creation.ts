import { ABILITY_BY_ID, type RaisableAttr } from '../data/abilities';
import { FOLK_LIST } from '../data/creatures';
import { ARMOR_LIST, SHIELD_LIST } from '../data/armor';
import { ITEM_LIST } from '../data/equipment';
import { PROFESSION_LIST } from '../data/professions';
import { RACE_LIST } from '../data/races';
import { MARTIAL_TECHNIQUES, SKILL_LIST, SKILLS } from '../data/skills';
import { SPELLS } from '../data/spells';
import type { ProfessionDef, RaceDef, SkillOption } from '../data/types';
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
  swordHand,
  type Draft,
} from '../engine/creation';
import { AGE, AGE_GROUPS, attrPrice, damageBonus, grip, maxKp, movement, stoPrice } from '../engine/rules';
import { listSaves } from '../engine/save';
import type { Character } from '../engine/types';
import { PLAYER_SPRITES, PROFESSION_SPRITES } from '../content';
import { portraitUrl } from '../game/art';
import { BookUi, renderChapterStrip } from './book';
import { bookArt, Carousel } from './carousel';
import { CHAPTER_NAMES, CHAPTERS, chapterErrors, inCarousel, sheetSideOnEntering, type Chapter } from './chapters';
import { el } from './hud';
import { changedInk, readInk } from './ink';
import { ATTR_NAMES, sheetFromDraft } from './sheet';

const LANGUAGES = ['Alviska', 'Dvärgiska', 'Svartiska'];
const INSTRUMENTS = ['Luta', 'Harpa', 'Lyra', 'Flöjt', 'Trumma'];
const AGE_NAMES = { ung: 'Ung', mogen: 'Mogen', medelålders: 'Medelålders', gammal: 'Gammal' };
const sign = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0');
const GENDER_NAMES: Record<Draft['gender'], string> = { man: 'Man', kvinna: 'Kvinna' };

function button(text: string, onclick: () => void, cls = '', disabled = false) {
  const b = el('button', cls, text);
  b.type = 'button';
  b.disabled = disabled;
  b.onclick = onclick;
  return b;
}

/**
 * En knapp som byter kapitel eller gör ett val. Bara första klicket i ett dubbelklick räknas:
 * det andra skulle annars landa på knappen som står på samma plats i nästa kapitel (utan
 * sidvändning, med prefers-reduced-motion, eller i nästa karusell).
 */
function stepButton(text: string, onclick: () => void, cls = '', disabled = false) {
  const b = button(text, onclick, cls, disabled);
  b.onclick = (e) => {
    if (e.detail <= 1) onclick();
  };
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

/** En rad i rutan under karusellen: namnet till vänster, värdet med blyerts till höger. */
function factRow(label: string, value: string) {
  const row = el('div', 'rad');
  row.append(el('span', '', label), el('span', '', value));
  return row;
}

const portraits: Record<string, string> = {};
const portrait = (id: string) => (portraits[id] ??= portraitUrl(id));

export interface CreatorOptions {
  /** Utkastet att börja med, t.ex. en färdig rollperson. Utan det börjar guiden med ett nytt. */
  draft?: Draft;
  /** Kapitlet att börja i. Förval: folk för ett nytt utkast, namn för ett givet. */
  chapter?: Chapter;
  /** Visar utkastet som en färdig rollperson med knapparna "Börja äventyret" och "Ändra". */
  preview?: boolean;
  /** "Tillbaka" från folket eller från förhandsvisningen: tillbaka till menyn. */
  onBack?: () => void;
}

/**
 * Guiden för att skapa en rollperson med bakgrundspoäng enligt Bok I, som kapitel i
 * rollpersonsboken. Folk och yrke väljs i en karusell över hela skärmen, med ett hörn av
 * rollformuläret uppe till höger. Resten av kapitlen ritas på vänster sida av uppslaget, och
 * rollformuläret på höger sida fylls i medan man väljer.
 */
export class CreatorUi {
  private readonly d: Draft;
  private chapter: Chapter;
  private preview: boolean;
  /** Om folket och yrket har valts. Ett nytt utkast har förval, men de skrivs inte in förrän man väljer. */
  private readonly chosen: { folk: boolean; yrke: boolean };
  /** Frågan om sparningen ska skrivas över visas. */
  private asking = false;
  private done = false;
  /** Formulärets sida när ett kapitel öppnas (se `sheetSideOnEntering`). */
  private side: 'front' | 'back' | undefined;

  private readonly book: BookUi;
  private readonly bookRoot = el('div', 'skapa-bok');
  private readonly screen = el('div', 'skapa-karusell');
  private readonly strip = el('ol', 'kapitelremsa');
  private readonly corner = el('div', 'horn');
  private readonly holder = el('div', 'skapa-plats');
  private readonly carouselNav = el('div', 'skapa-nav');
  private carousel: { destroy(): void } | null = null;
  /** Räknas upp när boken stängs för en karusell, så att ett senare kapitelbyte vinner. */
  private closing = 0;

  /** Knappen "Nästa" och felen under den, som namnfältet uppdaterar medan man skriver. */
  private nextButton: HTMLButtonElement | null = null;
  private errorList: HTMLElement | null = null;
  /** Utrustningens avsnitt som är uppfällda, så att de förblir det när sidan ritas om. */
  private readonly openSections = new Set<string>();

  /** En musknapp eller ett finger är nedtryckt i guiden. */
  private pressing = false;
  /** Ändringen kom från ett textfält som just lämnades. */
  private textChange = false;
  /** En omritning väntar på att knappen släpps (se `update`). */
  private pending = false;

  constructor(
    private readonly root: HTMLElement,
    private readonly onDone: (c: Character) => void,
    private readonly opts: CreatorOptions = {},
  ) {
    if (opts.draft) this.d = opts.draft;
    else {
      this.d = newDraft();
      this.d.name = 'Halvar';
    }
    const known = opts.draft !== undefined;
    this.chosen = { folk: known, yrke: known };
    this.preview = !!opts.preview;
    // Förhandsvisningen ligger efter sista kapitlet, så att "Ändra" vänder sidan bakåt.
    this.chapter = this.preview ? 'utrustning' : (opts.chapter ?? (known ? 'namn' : 'folk'));
    this.book = new BookUi(this.bookRoot, { onChapter: (c) => this.go(c) });

    this.corner.setAttribute('aria-label', 'Rollformuläret');
    const top = el('div', 'skapa-topp');
    top.append(this.strip, this.corner);
    this.screen.append(top, this.holder, this.carouselNav);
    root.replaceChildren(this.screen, this.bookRoot);
    this.listen();

    if (!this.preview && inCarousel(this.chapter)) this.showCarousel();
    else this.render();
  }

  /**
   * Ändrar utkastet och ritar om. När ändringen kommer från ett textfält som lämnas, t.ex.
   * för att knappen "Nästa" trycks ned, väntar omritningen tills knappen har släppts. Annars
   * skulle knappen bytas ut under musen, och klicket skulle inte nå fram.
   */
  private update = (fn: () => void) => {
    fn();
    // Frågan om att skriva över gällde utkastet som det var: en ändring stänger den.
    this.asking = false;
    if (!this.textChange) {
      this.render();
      return;
    }
    this.textChange = false;
    this.pending = true;
    // Musknappen kan vara nedtryckt utanför sidan (t.ex. i en lista som fälls ut): vänta högst en stund.
    setTimeout(() => this.flush(), this.pressing ? 1000 : 0);
  };

  private flush() {
    if (this.pending) this.render();
  }

  private listen() {
    const root = this.root;
    root.addEventListener('pointerdown', () => (this.pressing = true), true);
    const release = () => {
      this.pressing = false;
      if (this.pending) setTimeout(() => this.flush());
    };
    root.addEventListener('pointerup', release, true);
    root.addEventListener('pointercancel', release, true);
    root.addEventListener(
      'change',
      (e) => {
        const t = e.target as HTMLElement;
        // En utfälld lista släpper musknappen utanför sidan.
        if (t instanceof HTMLSelectElement) this.pressing = false;
        this.textChange = t instanceof HTMLTextAreaElement || (t instanceof HTMLInputElement && t.type !== 'checkbox');
      },
      true,
    );
    root.addEventListener('change', () => (this.textChange = false));
  }

  /** Slutar följa karusellens storlek. Görs när guiden lämnas. */
  private destroy() {
    this.carousel?.destroy();
    this.carousel = null;
    this.holder.replaceChildren();
    this.carouselNav.replaceChildren();
  }

  // ---------------------------------------------------------------- kapitlen

  /** Går till ett kapitel. Folk och yrke stänger boken och visar karusellen. */
  private go(c: Chapter) {
    const from = this.chapter;
    this.chapter = c;
    this.asking = false;
    if (!inCarousel(c)) {
      this.side = sheetSideOnEntering(from, c);
      this.render();
      return;
    }
    if (this.bookRoot.hidden) {
      this.showCarousel();
      return;
    }
    const n = ++this.closing;
    void this.book.close().then(() => {
      if (n === this.closing && inCarousel(this.chapter)) this.showCarousel();
    });
  }

  /** Ritar kapitlet i uppslaget (eller förhandsvisningen) och rollformuläret. */
  private render() {
    this.pending = false;
    // Boken stängs redan för att spelet ska börja, eller kapitlet ligger i en karusell.
    if (this.done || (inCarousel(this.chapter) && !this.preview)) return;
    this.closing++;
    if (!this.screen.hidden) {
      this.destroy();
      this.screen.hidden = true;
      this.bookRoot.hidden = false;
      this.root.scrollIntoView({ block: 'start' });
    }
    const d = this.d;
    if (this.preview) {
      this.book.show({
        chapter: this.chapter,
        left: this.previewPage(),
        sheet: sheetFromDraft(d),
        head: { label: 'Färdig rollperson', title: d.name },
        strip: false,
      });
      return;
    }
    this.book.show({ chapter: this.chapter, left: this.chapterPage(), sheet: sheetFromDraft(d), side: this.side });
    this.side = undefined;
  }

  /** Vänster sida i ett kapitel: det som är kvar att lägga, kapitlets innehåll, knapparna och felen. */
  private chapterPage(): HTMLElement {
    const d = this.d;
    const c = this.chapter;
    const page = el('div', 'kapitel');
    const budget = el('div', 'budget');
    budget.append(el('span', bpLeft(d) < 0 ? 'bad' : '', `BP kvar: ${bpLeft(d)}`));
    if (c === 'fardigheter' || c === 'utrustning') budget.append(el('span', epBudget(d) - epSpent(d) < 0 ? 'bad' : '', `EP kvar: ${epBudget(d) - epSpent(d)}`));
    if (c === 'utrustning') budget.append(el('span', '', `Silver kvar: ${(startCapital(d) ?? 0) - equipmentCost(d)}`));

    const body = el('div', 'step-body');
    switch (c) {
      case 'namn':
        this.namn(body);
        break;
      case 'egenskaper':
      case 'bakgrund':
      case 'yrkesfardigheter':
      case 'fardigheter':
      case 'utrustning':
        this[c](body);
        break;
    }

    const at = CHAPTERS.indexOf(c);
    const errors = chapterErrors(d, c);
    const nav = el('div', 'kapitel-nav');
    const prev = CHAPTERS[at - 1];
    nav.append(stepButton(`← ${CHAPTER_NAMES[prev]}`, () => this.go(prev), 'tillbaka'));
    if (c === 'utrustning') this.nextButton = stepButton('Börja äventyret', () => this.start(), 'band nasta', errors.length > 0 || this.asking);
    else this.nextButton = stepButton(`${CHAPTER_NAMES[CHAPTERS[at + 1]]} →`, () => this.go(CHAPTERS[at + 1]), 'band nasta', errors.length > 0);
    nav.append(this.nextButton);
    this.errorList = el('ul', 'errors');
    for (const e of errors) this.errorList.append(el('li', '', e));
    page.append(budget, body, nav, this.errorList);
    if (this.asking) page.append(this.overwriteQuestion());
    return page;
  }

  /** Uppdaterar knappen "Nästa" och felen under den utan att rita om sidan (medan man skriver). */
  private refreshNav() {
    if (!this.nextButton || !this.errorList) return;
    const errors = chapterErrors(this.d, this.chapter);
    this.nextButton.disabled = errors.length > 0;
    this.errorList.replaceChildren(...errors.map((e) => el('li', '', e)));
  }

  // ---------------------------------------------------------------- färdig rollperson och start

  /** Vänster sida för en färdig rollperson: vem det är och knapparna "Börja äventyret" och "Ändra". */
  private previewPage(): HTMLElement {
    const d = this.d;
    const page = el('div', 'kapitel forhandsvisning');
    const a = ability(d);
    page.append(
      el('p', 'forh-vem', `${race(d).name}, ${profession(d).name.toLowerCase()}, ${socialClass(d)?.toLowerCase()}.`),
      el('p', 'forh-utseende hand', d.appearance),
      el('p', 'note', `${a ? `Särskild förmåga: ${ABILITY_BY_ID[a.id].name}. ` : ''}KP ${maxKp(finalAttrs(d))}. Startkapitalet är ${startCapital(d)} sm, och ${(startCapital(d) ?? 0) - equipmentCost(d)} sm är kvar i börsen.`),
      el('p', 'note', 'Rollformuläret är ifyllt. Vänd det för att se vapnen och utrustningen. Med "Ändra" kan du ändra allt utom tärningsslagen, som redan är slagna.'),
    );
    const nav = el('div', 'kapitel-nav');
    const back = stepButton('← Tillbaka', () => this.back(), 'tillbaka');
    const edit = stepButton('Ändra', () => this.edit(), 'band ljus');
    this.nextButton = stepButton('Börja äventyret', () => this.start(), 'band nasta', this.asking);
    const right = el('span', 'kapitel-nav-hoger');
    right.append(edit, this.nextButton);
    nav.append(back, right);
    page.append(nav);
    if (this.asking) page.append(this.overwriteQuestion());
    return page;
  }

  /** "Ändra" på en färdig rollperson: utkastet öppnas i kapitlet namn. Tärningsslagen är låsta. */
  private edit() {
    this.preview = false;
    this.asking = false;
    this.go('namn');
  }

  private back() {
    this.destroy();
    this.opts.onBack?.();
  }

  /** "Börja äventyret". Finns det en sparning frågar boken först om den ska skrivas över. */
  private start() {
    if (this.done || this.asking) return;
    if (listSaves().length > 0) {
      this.asking = true;
      this.render();
      this.root.querySelector<HTMLElement>('.fraga .avbryt')?.focus();
      return;
    }
    void this.finish();
  }

  private overwriteQuestion(): HTMLElement {
    const box = el('section', 'blad-ruta fraga');
    box.setAttribute('role', 'alertdialog');
    box.setAttribute('aria-label', 'Skriva över sparningen?');
    const save = listSaves()[0]?.summary;
    const text = save
      ? `Det finns ett sparat äventyr med ${save.name} (${save.race.toLowerCase()}, ${save.profession.toLowerCase()}) i ${save.module}. Ett nytt äventyr skriver över det.`
      : 'Ett nytt äventyr skriver över det sparade.';
    const buttons = el('div', 'fraga-knappar');
    buttons.append(
      stepButton('Skriv över', () => void this.finish(), 'band skriv-over'),
      stepButton(
        'Avbryt',
        () => {
          this.asking = false;
          this.render();
          this.nextButton?.focus();
        },
        'band ljus avbryt',
      ),
    );
    box.append(el('header', '', 'Skriva över sparningen?'), el('p', '', text), buttons);
    return box;
  }

  /** Stänger boken och startar spelet med rollpersonen. */
  private async finish() {
    if (this.done) return;
    // Utkastet kan ha blivit ofullständigt medan frågan var öppen: stäng frågan och visa felen.
    if (allErrors(this.d).length > 0) {
      this.asking = false;
      this.render();
      return;
    }
    this.done = true;
    const c = finalize(this.d);
    this.destroy();
    await this.book.close();
    this.onDone(c);
  }

  // ---------------------------------------------------------------- 1–2. folk och yrke

  /** Folk eller yrke: karusellen över hela skärmen och hörnet av rollformuläret. */
  private showCarousel() {
    this.destroy();
    this.bookRoot.hidden = true;
    this.screen.hidden = false;
    renderChapterStrip(this.strip, this.chapter, (c) => this.go(c));
    this.writeCorner();
    const d = this.d;
    const folk = this.chapter === 'folk';
    if (folk) {
      this.carousel = new Carousel<RaceDef>(this.holder, RACE_LIST, {
        start: RACE_LIST.findIndex((r) => r.id === d.race),
        card: (r) => ({ name: r.name, img: bookArt('raser', r.id), badge: `${r.bp} BP` }),
        info: (r, choose) => this.raceInfo(r, choose),
        onChoose: (r) => {
          this.setRace(r.id);
          this.chosen.folk = true;
          this.go('yrke');
        },
      });
    } else {
      this.carousel = new Carousel<ProfessionDef>(this.holder, PROFESSION_LIST, {
        start: PROFESSION_LIST.findIndex((p) => p.id === d.profession),
        card: (p) => ({ name: p.name, img: bookArt('yrken', p.id) }),
        info: (p, choose) => this.professionInfo(p, choose),
        onChoose: (p) => {
          this.setProfession(p.id);
          this.chosen.yrke = true;
          this.go('namn');
        },
      });
    }
    const nav = this.carouselNav;
    nav.replaceChildren(folk ? stepButton('← Tillbaka', () => this.back(), 'tillbaka') : stepButton(`← ${CHAPTER_NAMES.folk}`, () => this.go('folk'), 'tillbaka'));
    const next: Chapter = folk ? 'yrke' : 'namn';
    if (this.chosen[folk ? 'folk' : 'yrke']) nav.append(stepButton(`${CHAPTER_NAMES[next]} →`, () => this.go(next), 'band nasta'));
    this.root.scrollIntoView({ block: 'start' });
    this.holder.querySelector<HTMLElement>('.karusell-scen')?.focus({ preventScroll: true });
  }

  /** Knappen som väljer kortet i mitten, eller att det redan är valt. */
  private choice(name: string, isChosen: boolean, choose: () => void, chosenText: string) {
    return isChosen ? el('div', 'vald', `✓ ${chosenText} – skrivet i formuläret`) : stepButton(`Välj ${name.toLowerCase()}`, choose, 'band');
  }

  private raceInfo(r: RaceDef, choose: () => void): HTMLElement[] {
    const head = el('div', 'rubrik');
    head.append(el('span', '', r.name), el('span', '', `${r.bp} BP`));
    const desc = el('div', 'beskr');
    desc.append(el('p', '', r.desc));
    if (r.traits.length) {
      const traits = el('p', 'formaga');
      traits.append(el('b', '', 'Särdrag:'), ` ${r.traits.join(' ')}`);
      desc.append(traits);
    }
    const mods = el('div', 'mods');
    for (const k of RAISABLE) {
      const v = r.mods[k];
      const cell = el('div');
      cell.append(el('i', '', k), el('b', v < 0 ? 'minus' : '', v ? sign(v) : '–'));
      mods.append(cell);
    }
    const facts = el('div', 'fakta');
    facts.append(
      el('div', '', 'Modifikationer'),
      mods,
      factRow('Storlek (STO)', `${r.sto.min}–${r.sto.max}`),
      this.choice(r.name, this.chosen.folk && this.d.race === r.id, choose, 'Vald'),
    );
    return [head, desc, facts];
  }

  private professionInfo(p: ProfessionDef, choose: () => void): HTMLElement[] {
    const head = el('div', 'rubrik');
    head.append(el('span', '', p.name), el('span', '', 'Yrke'));
    const desc = el('div', 'beskr');
    const ab = el('p', 'formaga');
    ab.append(el('b', '', `Yrkesförmåga – ${p.ability.name}:`), ` ${p.ability.desc}`);
    desc.append(el('p', '', p.desc), ab);
    const facts = el('div', 'fakta');
    facts.append(el('div', '', 'Krav på grundegenskaper'));
    for (const [k, v] of Object.entries(p.requirements)) facts.append(factRow(`${ATTR_NAMES[k as RaisableAttr]} (${k})`, `minst ${v}`));
    facts.append(this.choice(p.name, this.chosen.yrke && this.d.profession === p.id, choose, 'Valt'));
    return [head, desc, facts];
  }

  /** Hörnet av rollformuläret: namn, kön, folk och yrke. Det som just skrevs in skrivs fram med blyerts. */
  private writeCorner() {
    const d = this.d;
    const fields: [string, string, string][] = [
      ['namn', 'Namn', d.name],
      ['kon', 'Kön', GENDER_NAMES[d.gender]],
      ['ras', 'Ras', this.chosen.folk ? race(d).name : ''],
      ['yrke', 'Yrke', this.chosen.yrke ? profession(d).name : ''],
    ];
    const grid = el('div', 'horn-falt');
    for (const [key, label, value] of fields) {
      const cell = el('div');
      const v = el('span', 'hand', value);
      v.dataset.ink = key;
      cell.append(label, v);
      grid.append(cell);
    }
    const before = this.corner.isConnected ? readInk(this.corner) : new Map<string, string>();
    const changed = new Set(before.size ? changedInk(before, readInk(grid)) : []);
    for (const e of grid.querySelectorAll<HTMLElement>('[data-ink]')) if (changed.has(e.dataset.ink!)) e.classList.add('ink-new', 'ink-hot');
    this.corner.replaceChildren(el('div', 'horn-titel', 'Rollformulär'), grid);
  }

  // ---------------------------------------------------------------- 3. namn, kön och figur

  private namn(body: HTMLElement) {
    const d = this.d;
    const name = el('label', '', 'Namn ');
    const input = textInput(d.name, (v) => this.update(() => (d.name = v))) as HTMLInputElement;
    // Felet "namn saknas" och knappen följer med medan man skriver.
    input.oninput = () => {
      d.name = input.value;
      this.refreshNav();
    };
    name.append(input);
    const gender = el('label', '', 'Kön ');
    gender.append(select([['man', 'Man'], ['kvinna', 'Kvinna']], d.gender, (v) => this.update(() => (d.gender = v as Draft['gender']))));
    body.append(name, gender, el('h3', '', 'Figur'), el('p', 'note', 'Figuren som visar rollpersonen på kartan.'), this.figures());
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
    if (this.d.race === id) return;
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
        if (e.filter === 'tva_vapen' && !keys.length) box.append(el('p', 'note', 'Välj Två vapen bland yrkesfärdigheterna för att få nytta av förmågan (kommer i kapitlet Yrkesfärdigheter).'));
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
      det.open = this.openSections.has(title);
      det.ontoggle = () => (det.open ? this.openSections.add(title) : this.openSections.delete(title));
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
    ta.onchange = () => this.update(() => (d.appearance = ta.value));
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
