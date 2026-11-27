import { allErrors, stepErrors, type Draft } from '../engine/creation';

/**
 * Kapitlen i rollpersonsboken och sidvändningen mellan dem. Inget här rör sidan (DOM), så att
 * det går att testa i Node.
 *
 * Motorns sex steg (`STEPS`) ligger kvar. De tre första kapitlen motsvarar tillsammans steget
 * `grund`: folk och yrke har alltid ett giltigt val, så felen i `grund` visas i kapitlet `namn`.
 */

export type Chapter = 'folk' | 'yrke' | 'namn' | 'egenskaper' | 'bakgrund' | 'yrkesfardigheter' | 'fardigheter' | 'utrustning';

export const CHAPTERS: Chapter[] = ['folk', 'yrke', 'namn', 'egenskaper', 'bakgrund', 'yrkesfardigheter', 'fardigheter', 'utrustning'];

export const CHAPTER_NAMES: Record<Chapter, string> = {
  folk: 'Folk',
  yrke: 'Yrke',
  namn: 'Namn och figur',
  egenskaper: 'Grundegenskaper',
  bakgrund: 'Bakgrund',
  yrkesfardigheter: 'Yrkesfärdigheter',
  fardigheter: 'Startfärdigheter',
  utrustning: 'Utrustning',
};

/** Felen som hindrar att man går vidare från kapitlet. I det sista kapitlet är det alla fel. */
export function chapterErrors(d: Draft, c: Chapter): string[] {
  switch (c) {
    case 'folk':
    case 'yrke':
      return [];
    case 'namn':
      return stepErrors(d, 'grund');
    case 'utrustning':
      return allErrors(d);
    default:
      return stepErrors(d, c);
  }
}

/**
 * En animation som tar en viss tid och kan hoppas över: sidvändningen och när boken stängs.
 * `start` medan animationen pågår gör ingenting, så ett dubbelklick blir en vändning. `onEnd`
 * körs en gång per vändning, när tiden har gått eller när `skip` hoppar till slutet. Med tiden
 * 0 (prefers-reduced-motion) är vändningen klar redan i `start`.
 */
export class Turn {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;

  constructor(
    private readonly ms: () => number,
    private readonly onEnd: () => void,
  ) {}

  get busy(): boolean {
    return this.running;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    const ms = this.ms();
    if (ms <= 0) this.finish();
    else this.timer = setTimeout(() => this.finish(), ms);
  }

  skip(): void {
    if (this.running) this.finish();
  }

  private finish(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.running = false;
    this.onEnd();
  }
}
