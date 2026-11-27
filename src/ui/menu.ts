import { audioSliders } from '../audio';
import { PREGENS } from '../content/forgenererade';
import { listSaves } from '../engine/save';
import type { Character } from '../engine/types';
import { bookArt } from './carousel';
import { CreatorUi, type CreatorOptions } from './creation';
import { $, el } from './hud';

export type MenuView = 'huvud' | 'nytt' | 'ladda' | 'installningar' | 'om';

export interface MenuHandlers {
  continueGame(): void;
  /** Startar ett nytt äventyr med rollpersonen från rollpersonsboken. */
  startNew(c: Character): void;
  load(key: string): void;
}

const TITLES: Record<Exclude<MenuView, 'huvud'>, string> = {
  nytt: 'Nytt äventyr',
  ladda: 'Ladda sparat spel',
  installningar: 'Inställningar',
  om: 'Om spelet',
};

function button(text: string, cls: string, onclick: () => void) {
  const b = el('button', cls, text);
  b.type = 'button';
  b.onclick = onclick;
  return b;
}

/** En ruta i rollformulärets stil: rött band med rubriken och vitt papper under. */
function box(title: string, ...content: (Node | string)[]) {
  const section = el('section', 'blad-ruta');
  section.append(el('header', '', title), ...content);
  return section;
}

/**
 * Huvudmenyn på bokomslaget och undermenyerna på grindbilden. Allt byggs en gång, så att
 * fälten (t.ex. åtkomstkoden `#in-code`) finns kvar mellan vyerna. Listan över sparningar och
 * knappen "Fortsätt äventyret" läses på nytt varje gång huvudmenyn eller listan visas.
 */
export function mountMenu(handlers: MenuHandlers): { show(view?: MenuView): void; hide(): void } {
  const root = $('menu');

  // ---- Huvudmenyn
  const main = el('div', 'meny-huvud');
  const cover = el('div', 'omslag');
  const coverImg = el('img');
  coverImg.src = 'art/bok/omslag.webp';
  coverImg.alt = 'Omslaget till Drakar och Demoner';
  const nav = el('nav', 'meny-knappar');
  nav.setAttribute('aria-label', 'Huvudmeny');
  const continueBtn = button('Fortsätt äventyret', 'band', () => handlers.continueGame());
  nav.append(
    continueBtn,
    button('Nytt äventyr', 'band', () => show('nytt')),
    button('Ladda sparat spel', 'band', () => show('ladda')),
    button('Inställningar', 'band', () => show('installningar')),
    button('Om spelet', 'band', () => show('om')),
  );
  cover.append(coverImg, nav);
  main.append(cover);

  // ---- Undermenyerna
  const sub = el('div', 'meny-under');
  const sheet = el('div', 'blad');
  const back = button('← Tillbaka', 'tillbaka', () => show('huvud'));
  const title = el('h2', 'blad-rubrik');
  const body = el('div', 'blad-innehall');
  sheet.append(back, title, body);

  // Rollpersonsboken: karusellerna och uppslaget, på samma grindbild som undermenyerna.
  const creator = el('div', 'skapa');
  creator.hidden = true;
  sub.append(sheet, creator);

  const views: Record<Exclude<MenuView, 'huvud'>, HTMLElement> = {
    nytt: newView(),
    ladda: el('div', 'sparningar'),
    installningar: settingsView(),
    om: aboutView(),
  };
  // Alla vyerna ligger i sidan hela tiden, så att `#in-code` går att läsa innan Inställningar har visats.
  body.append(...Object.values(views));
  root.replaceChildren(main, sub);

  /** Öppnar rollpersonsboken, eller stänger den med `null`. "Tillbaka" i boken leder till "Nytt äventyr". */
  function openCreator(opts: CreatorOptions | null) {
    sheet.hidden = opts !== null;
    creator.hidden = opts === null;
    if (opts === null) {
      creator.replaceChildren();
      return;
    }
    sub.scrollTop = 0;
    new CreatorUi(creator, handlers.startNew, { ...opts, onBack: () => show('nytt') });
  }

  function newView() {
    const view = el('div', 'nytt');
    const create = el('div', 'nytt-skapa');
    create.append(
      button('Skapa ny rollperson', 'band', () => openCreator({})),
      el('p', '', 'Välj folk och yrke och fyll i rollformuläret själv, steg för steg.'),
    );
    const cards = el('div', 'nytt-fardiga');
    for (const p of PREGENS) {
      const card = el('button', 'fardig');
      card.type = 'button';
      const img = el('img');
      img.alt = '';
      img.onerror = () => img.remove();
      img.src = bookArt('yrken', p.draft().profession);
      const text = el('span', 'fardig-text');
      text.append(el('b', '', p.title), el('span', '', p.blurb));
      card.append(img, text);
      card.onclick = () => openCreator({ draft: p.draft(), preview: true });
      cards.append(card);
    }
    view.append(create, box('Färdiga rollpersoner', cards));
    return view;
  }

  function renderSaves() {
    const list = views.ladda;
    const saves = listSaves();
    if (!saves.length) {
      list.replaceChildren(el('p', 'tomt', 'Inga sparade spel än.'));
      return;
    }
    const table = el('table');
    const head = el('tr');
    for (const h of ['Namn', 'Ras', 'Yrke', 'Modul', 'Tid', '']) head.append(el('th', '', h));
    table.append(head);
    for (const { key, summary } of saves) {
      const row = el('tr');
      for (const v of [summary.name, summary.race, summary.profession, summary.module, summary.clock]) row.append(el('td', 'hand', v));
      const cell = el('td');
      cell.append(button('Ladda', 'band litet', () => handlers.load(key)));
      row.append(cell);
      table.append(row);
    }
    list.replaceChildren(box('Sparningar', table));
  }

  function settingsView() {
    const view = el('div', 'installningar');
    const code = el('input');
    code.id = 'in-code';
    code.type = 'password';
    code.autocomplete = 'off';
    const label = el('label', 'falt');
    label.append('Åtkomstkod (om servern kräver en)', code);
    view.append(
      box('Ljud och musik', audioSliders()),
      box('AI-spelledaren', el('p', '', 'Personerna i spelet svarar med hjälp av en AI på servern.'), label),
    );
    return view;
  }

  function aboutView() {
    const view = el('div', 'om');
    view.innerHTML = `
      <p>Det här spelet är ett fritt fanprojekt som följer reglerna i <i>Drakar och Demoner</i> (Äventyrsspel, 1991).
      Det har ingen koppling till dem som äger Drakar och Demoner.</p>
      <p>Bilderna på omslaget, grinden, folken och yrkena kommer ur böckerna och tillhör sina upphovspersoner.
      Alla texter i spelet är egna.</p>
      <p>Grafiken och ljudet från Flare har licensen CC BY-SA 3.0.
      Läs mer om <a href="art/CREDITS.md" target="_blank">grafiken och licenserna</a>
      och om <a href="audio/CREDITS.md" target="_blank">ljudet och musiken</a>.</p>
      <p>Typsnitten Grenze Gotisch, Archivo Narrow och Kalam har licensen
      <a href="https://openfontlicense.org/" target="_blank" rel="noopener">SIL Open Font License</a>.</p>`;
    return view;
  }

  function show(view: MenuView = 'huvud') {
    root.hidden = false;
    const isMain = view === 'huvud';
    main.hidden = !isMain;
    sub.hidden = isMain;
    if (isMain) {
      continueBtn.hidden = listSaves().length === 0;
      return;
    }
    if (view === 'ladda') renderSaves();
    openCreator(null);
    title.textContent = TITLES[view];
    for (const [id, node] of Object.entries(views)) node.hidden = id !== view;
  }

  show();
  return {
    show,
    hide: () => {
      root.hidden = true;
    },
  };
}
