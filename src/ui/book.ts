import { CHAPTER_NAMES, CHAPTERS, Turn, type Chapter } from './chapters';
import { el } from './hud';
import { changedInk, readInk } from './ink';
import { renderSide, type SheetSource } from './sheet';

/**
 * Uppslaget i rollpersonsboken: kapitelremsan överst, kapitlet på vänster sida och
 * rollformuläret på höger. Sidan vänds när kapitlet byts, och det som just skrevs in i
 * formuläret skrivs fram med blyerts och lyser upp en kort stund.
 *
 * Tiderna håller sig inom ramarna: sidvändningen under en sekund och skrivandet under en halv.
 * Ett klick under en vändning hoppar till slutet och når inte knappen under, så ett dubbelklick
 * på "Nästa" ger ett kapitel fram. Med prefers-reduced-motion blir allt direkt.
 */

type Side = 'front' | 'back';

/** Tiderna i millisekunder. Animationerna i book.css har samma längd. */
const TURN_MS = 700;
const FADE_MS = 350;
const CLOSE_MS = 500;

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Smalare än så ligger sidorna under varandra (samma gräns som i book.css). */
const stacked = () => matchMedia('(max-width: 1023px)').matches;

const SIDE_NAMES: Record<Side, string> = { front: 'Framsidan', back: 'Baksidan' };

export interface BookOptions {
  /** Ett klick på ett kapitel man redan har klarat i remsan. Utan den går remsan inte att klicka i. */
  onChapter?: (c: Chapter) => void;
}

export class BookUi {
  private readonly book = el('div', 'uppslag');
  private readonly strip = el('ol', 'kapitelremsa');
  private readonly flipButton = el('button', 'band litet', 'Vänd formuläret');
  private readonly sideLabel = el('span', 'formular-sida');
  private readonly pages = el('div', 'uppslag-sidor');
  private readonly leftPage = el('section', 'sida vanster');
  private readonly rightPage = el('section', 'sida hoger');
  /** Behållaren `.rf` ger rollformulärets stilar. */
  private readonly sheetBox = el('div', 'rf');

  private chapter: Chapter | null = null;
  private source: SheetSource | null = null;
  private side: Side = 'front';
  private sheetPage: HTMLElement | null = null;

  /** Det som görs när vändningen är klar: det nya kapitlet läggs på vänster sida. */
  private afterTurn: (() => void) | null = null;
  private readonly turn = new Turn(
    () => (stacked() ? FADE_MS : TURN_MS),
    () => {
      const done = this.afterTurn;
      this.afterTurn = null;
      done?.();
    },
  );
  private closed: (() => void) | null = null;
  private readonly closing = new Turn(
    () => (reducedMotion() ? 0 : CLOSE_MS),
    () => {
      this.book.remove();
      this.book.classList.remove('stanger');
      const done = this.closed;
      this.closed = null;
      done?.();
    },
  );

  constructor(
    private readonly root: HTMLElement,
    private readonly opts: BookOptions = {},
  ) {
    this.flipButton.type = 'button';
    this.flipButton.addEventListener('click', () => this.flipSheet());
    const top = el('div', 'uppslag-topp');
    const flip = el('div', 'formular-vand');
    flip.append(this.sideLabel, this.flipButton);
    top.append(this.strip, flip);
    this.rightPage.append(this.sheetBox);
    this.pages.append(this.leftPage, this.rightPage);
    this.book.append(top, this.pages);

    // Ett klick under en animation hoppar till slutet. Under sidvändningen och när boken stängs
    // når klicket inte fram, så att samma klick inte också trycker på en knapp i det nya kapitlet.
    this.book.addEventListener(
      'click',
      (e) => {
        if (!this.turn.busy && !this.closing.busy) return;
        e.preventDefault();
        e.stopPropagation();
        this.turn.skip();
        this.closing.skip();
      },
      true,
    );
    // Blyertsen och vändningen av formuläret är klara redan när knappen trycks ned.
    this.book.addEventListener('pointerdown', () => this.finishInk(), true);
  }

  /** Visar kapitlet och formuläret. Ett nytt kapitel vänder sidan, samma kapitel ritas om på plats. */
  show(opts: { chapter: Chapter; left: HTMLElement; sheet: SheetSource; side?: Side }): void {
    this.closing.skip();
    if (!this.book.isConnected) this.open();
    this.turn.skip();
    const from = this.chapter;
    this.chapter = opts.chapter;
    this.renderStrip();

    const content = this.pageContent(opts.chapter, opts.left);
    const turned = from !== null && from !== opts.chapter;
    if (turned && !reducedMotion()) this.turnTo(content, CHAPTERS.indexOf(opts.chapter) > CHAPTERS.indexOf(from));
    else this.leftPage.replaceChildren(content);
    if (turned) {
      if (this.book.getBoundingClientRect().top < 0) this.book.scrollIntoView({ block: 'start' });
      if (content.parentElement === this.leftPage) this.focusHeading(content);
    }

    this.source = opts.sheet;
    this.renderSheet(opts.side ?? this.side);
  }

  /** Vänder rollformuläret mellan framsidan och baksidan. */
  flipSheet(): void {
    if (this.source) this.renderSheet(this.side === 'front' ? 'back' : 'front');
  }

  /** Stänger boken. Löftet löses när animationen är klar och uppslaget är borta. */
  close(): Promise<void> {
    if (!this.book.isConnected) return Promise.resolve();
    this.turn.skip();
    this.finishInk();
    return new Promise((resolve) => {
      const before = this.closed;
      this.closed = () => {
        before?.();
        resolve();
      };
      this.book.classList.add('stanger');
      this.closing.start();
    });
  }

  /** Lägger uppslaget i `root` och börjar om: inget kapitel och inget formulär före. */
  private open(): void {
    this.chapter = null;
    this.sheetPage = null;
    this.side = 'front';
    this.root.append(this.book);
  }

  private renderStrip(): void {
    const at = CHAPTERS.indexOf(this.chapter!);
    this.strip.replaceChildren(
      ...CHAPTERS.map((c, i) => {
        const li = el('li', i < at ? 'klar' : i === at ? 'nu' : '');
        const name = CHAPTER_NAMES[c];
        if (i < at && this.opts.onChapter) {
          const b = el('button', '', name);
          b.type = 'button';
          b.addEventListener('click', () => this.opts.onChapter!(c));
          li.append(b);
        } else li.textContent = name;
        if (i === at) li.setAttribute('aria-current', 'step');
        return li;
      }),
    );
  }

  /** Vänster sidas innehåll: "Kapitel N", rubriken och det som kapitlet ritar. */
  private pageContent(c: Chapter, left: HTMLElement): HTMLElement {
    const content = el('div', 'sida-innehall');
    const head = el('header', 'sida-huvud');
    head.append(el('span', 'kapitel-nr', `Kapitel ${CHAPTERS.indexOf(c) + 1}`), el('h2', 'sida-rubrik', CHAPTER_NAMES[c]));
    content.append(head, left);
    return content;
  }

  /**
   * Vänder sidan. Ett blad vänds kring mitten av uppslaget: framåt kommer det från höger med
   * det nya kapitlet, bakåt lyfts det gamla kapitlet från vänster och läggs över till höger.
   * När sidorna ligger under varandra tonar det nya kapitlet bara fram.
   */
  private turnTo(content: HTMLElement, forward: boolean): void {
    if (stacked()) {
      this.leftPage.replaceChildren(content);
      content.classList.add('tonar-fram');
      this.afterTurn = () => content.classList.remove('tonar-fram');
      this.turn.start();
      return;
    }
    const leaf = el('div', `vandblad ${forward ? 'framat' : 'bakat'}`);
    const face = el('div', 'vandblad-text');
    leaf.style.width = `${this.leftPage.offsetWidth}px`;
    leaf.append(face, el('div', 'vandblad-baksida'));
    if (forward) {
      // Det gamla kapitlet ligger kvar under bladet tills bladet har landat.
      face.append(content);
      this.afterTurn = () => {
        this.leftPage.replaceChildren(content);
        leaf.remove();
        this.focusHeading(content);
      };
    } else {
      face.append(...this.leftPage.childNodes);
      this.leftPage.replaceChildren(content);
      this.afterTurn = () => leaf.remove();
    }
    this.pages.append(leaf);
    this.turn.start();
  }

  /**
   * Ritar formulärets sida. På samma sida som förut jämförs det handskrivna före och efter, och
   * det som ändrades skrivs fram. Nycklarna gäller bara inom en sida, så när sidan byts finns
   * inget "före" att jämföra med: då vänds formuläret i stället.
   */
  private renderSheet(side: Side): void {
    const page = renderSide(this.source!, side);
    if (this.sheetPage && side === this.side) {
      const changed = new Set(changedInk(readInk(this.sheetPage), readInk(page)));
      for (const e of page.querySelectorAll<HTMLElement>('[data-ink]'))
        if (changed.has(e.dataset.ink!)) e.classList.add('ink-new', 'ink-hot');
    } else if (this.sheetPage && !reducedMotion()) {
      page.classList.add('vands');
    }
    this.sheetPage = page;
    this.side = side;
    this.sheetBox.replaceChildren(page);
    this.rightPage.setAttribute('aria-label', `Rollformulärets ${SIDE_NAMES[side].toLowerCase()}`);
    this.sideLabel.textContent = SIDE_NAMES[side];
    this.flipButton.setAttribute('aria-label', `Vänd formuläret till ${side === 'front' ? 'baksidan' : 'framsidan'}`);
  }

  /** Knappen som fördes hit försvann med det gamla kapitlet: fokus läggs på den nya rubriken. */
  private focusHeading(content: HTMLElement): void {
    const active = document.activeElement;
    if (active && active !== document.body && active.isConnected) return;
    const h = content.querySelector<HTMLElement>('.sida-rubrik')!;
    h.tabIndex = -1;
    h.focus({ preventScroll: true });
  }

  /** Hoppar till slutet av blyertsen och vändningen av formuläret. */
  private finishInk(): void {
    if (!this.sheetPage) return;
    this.sheetPage.classList.remove('vands');
    for (const e of this.sheetPage.querySelectorAll('.ink-new, .ink-hot')) e.classList.remove('ink-new', 'ink-hot');
  }
}
