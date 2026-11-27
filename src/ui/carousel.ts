import { el } from './hud';

/** Bokens bild av ett folk eller ett yrke. */
export function bookArt(kind: 'raser' | 'yrken', id: string): string {
  return `art/bok/${kind}/${id}.webp`;
}

/** Det ett kort visar: namnet i det röda bandet, bilden och ett litet tillägg i bandet (t.ex. "4 BP"). */
export interface CardFace {
  name: string;
  img?: string;
  badge?: string;
}

export interface CarouselOptions<T> {
  /** Kortet som står i mitten från början. */
  start: number;
  card(item: T): CardFace;
  /** Rutan under bilden. `choose` väljer kortet i mitten, som Enter. */
  info(item: T, choose: () => void): HTMLElement[];
  onChoose(item: T): void;
}

/** Hur långt fingret eller musen ska dras för att bläddra ett steg. */
const SWIPE = 40;
/** Kort längre bort än så från mitten syns inte. */
const VISIBLE = 3;

/**
 * Korten i en rad där kortet i mitten är större och korten vid sidan mindre och mörkare.
 * Man bläddrar med pilknapparna, piltangenterna när scenen har fokus, ett svep eller ett
 * klick på ett kort vid sidan. Enter väljer kortet i mitten.
 */
export class Carousel<T> {
  private at: number;
  private readonly stage: HTMLDivElement;
  private readonly info: HTMLDivElement;
  private readonly cards: HTMLElement[];
  private readonly prev: HTMLButtonElement;
  private readonly next: HTMLButtonElement;
  private readonly resize: ResizeObserver;

  constructor(
    root: HTMLElement,
    private readonly items: T[],
    private readonly opts: CarouselOptions<T>,
  ) {
    this.at = this.clamp(opts.start);
    this.stage = el('div', 'karusell-scen');
    this.stage.tabIndex = 0;
    this.stage.setAttribute('aria-label', 'Bläddra med piltangenterna och välj med Enter.');
    this.info = el('div', 'karusell-info');
    this.info.setAttribute('aria-live', 'polite');
    this.cards = items.map((item, i) => this.card(item, i));
    this.prev = this.arrow('‹', 'Föregående', -1);
    this.next = this.arrow('›', 'Nästa', 1);
    this.stage.append(...this.cards, this.prev, this.next);
    const wrap = el('div', 'karusell');
    wrap.append(this.stage, this.info);
    root.replaceChildren(wrap);
    this.listen();
    // Avstånden mellan korten följer kortens storlek, som följer skärmens.
    this.resize = new ResizeObserver(() => this.layout());
    this.resize.observe(this.stage);
    this.layout();
    this.renderInfo();
  }

  /** Ställer kort nummer `i` i mitten. */
  go(i: number) {
    const n = this.clamp(i);
    if (n === this.at) return;
    this.at = n;
    this.layout();
    this.renderInfo();
  }

  /** Slutar följa scenens storlek. Görs när karusellen tas bort. */
  destroy() {
    this.resize.disconnect();
  }

  private clamp(i: number) {
    return Math.max(0, Math.min(this.items.length - 1, i));
  }

  private choose = () => {
    this.opts.onChoose(this.items[this.at]);
    this.renderInfo();
  };

  private card(item: T, i: number) {
    const face = this.opts.card(item);
    const card = el('div', 'kort');
    const pic = el('div', 'kort-bild');
    const fallback = () => pic.replaceChildren(el('div', 'kort-ersattning', face.name.charAt(0)));
    if (face.img) {
      const img = el('img');
      img.alt = face.name;
      img.draggable = false;
      img.onerror = fallback;
      img.src = face.img;
      pic.append(img);
    } else fallback();
    const band = el('div', 'kort-namn');
    band.append(el('span', '', face.name));
    if (face.badge) band.append(el('em', '', face.badge));
    card.append(pic, band);
    card.onclick = () => this.go(i);
    return card;
  }

  private arrow(text: string, label: string, step: number) {
    const b = el('button', `karusell-pil ${step < 0 ? 'vanster' : 'hoger'}`, text);
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.onclick = () => this.go(this.at + step);
    return b;
  }

  private listen() {
    this.stage.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') this.go(this.at - 1);
      else if (e.key === 'ArrowRight') this.go(this.at + 1);
      else if (e.key === 'Enter' && e.target === this.stage) this.choose();
      else return;
      e.preventDefault();
    });
    let startX: number | null = null;
    let swiped = false;
    this.stage.addEventListener('pointerdown', (e) => {
      startX = e.clientX;
      swiped = false;
    });
    // När fingret eller musen har dragits en bit fångas pekaren, så att ett svep som släpps
    // utanför scenen ändå räknas. Ett vanligt klick fångas inte: då går klicket till kortet
    // eller pilen under, inte till scenen.
    this.stage.addEventListener('pointermove', (e) => {
      if (startX === null || Math.abs(e.clientX - startX) < 10 || this.stage.hasPointerCapture(e.pointerId)) return;
      this.stage.setPointerCapture(e.pointerId);
    });
    this.stage.addEventListener('pointerup', (e) => {
      if (startX === null) return;
      const dx = e.clientX - startX;
      startX = null;
      if (Math.abs(dx) <= SWIPE) return;
      swiped = true;
      this.go(this.at + (dx < 0 ? 1 : -1));
    });
    this.stage.addEventListener('pointercancel', () => (startX = null));
    // Ett svep som slutar på samma kort som det började på ger också ett klick. Det ska inte räknas.
    this.stage.addEventListener(
      'click',
      (e) => {
        if (!swiped) return;
        swiped = false;
        e.stopPropagation();
      },
      { capture: true },
    );
  }

  private layout() {
    const width = this.cards[0]?.offsetWidth ?? 0;
    // Smal scen: korten vid sidan läggs tätare.
    const gap = width * (this.stage.clientWidth < 3.4 * width ? 0.62 : 0.86);
    this.cards.forEach((card, i) => {
      const off = i - this.at;
      const a = Math.abs(off);
      const scale = a === 0 ? 1 : Math.max(0.5, 0.72 - (a - 1) * 0.1);
      const x = Math.sign(off) * (a === 0 ? 0 : gap + (a - 1) * gap * 0.6);
      card.style.transform = `translateX(${x}px) scale(${scale})`;
      card.style.zIndex = String(20 - a);
      card.style.opacity = a > VISIBLE ? '0' : '1';
      card.style.filter = a === 0 ? '' : `brightness(${0.6 - a * 0.1}) saturate(0.6)`;
      card.style.pointerEvents = a > VISIBLE ? 'none' : '';
      card.classList.toggle('mitt', a === 0);
      card.setAttribute('aria-hidden', String(a !== 0));
    });
    this.prev.disabled = this.at === 0;
    this.next.disabled = this.at === this.items.length - 1;
  }

  private renderInfo() {
    this.info.replaceChildren(...this.opts.info(this.items[this.at], this.choose));
    // Rutan tonar fram på nytt för varje kort (direkt med prefers-reduced-motion).
    this.info.classList.remove('ny');
    void this.info.offsetWidth;
    this.info.classList.add('ny');
  }
}
