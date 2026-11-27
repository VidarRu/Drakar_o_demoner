import { afterEach, describe, expect, it, vi } from 'vitest';
import { allErrors, newDraft, stepErrors } from '../src/engine/creation';
import { CHAPTER_NAMES, CHAPTERS, chapterErrors, Turn } from '../src/ui/chapters';

describe('kapitlen', () => {
  it('är åtta, i bokens ordning, och alla har ett namn', () => {
    expect(CHAPTERS.length).toBe(8);
    expect(CHAPTERS[0]).toBe('folk');
    expect(CHAPTERS[7]).toBe('utrustning');
    expect(CHAPTERS.map((c) => CHAPTER_NAMES[c])).toEqual([
      'Folk',
      'Yrke',
      'Namn och figur',
      'Grundegenskaper',
      'Bakgrund',
      'Yrkesfärdigheter',
      'Startfärdigheter',
      'Utrustning',
    ]);
  });

  it('folk och yrke har inga fel', () => {
    expect(chapterErrors(newDraft(), 'folk')).toEqual([]);
    expect(chapterErrors(newDraft(), 'yrke')).toEqual([]);
  });

  it('ett utkast utan namn ger ett fel i kapitlet namn', () => {
    const d = newDraft();
    expect(chapterErrors(d, 'namn')).toHaveLength(1);
    d.name = 'Halvar';
    expect(chapterErrors(d, 'namn')).toEqual([]);
  });

  it('grundegenskaperna ger samma fel som steget', () => {
    // Krigaren kräver STY 14 och FYS 12, så det nya utkastet har fel här.
    const d = newDraft();
    expect(chapterErrors(d, 'egenskaper')).toEqual(stepErrors(d, 'egenskaper'));
    expect(chapterErrors(d, 'egenskaper').length).toBeGreaterThan(0);
  });

  it('utrustningen ger alla fel i utkastet', () => {
    const d = newDraft();
    expect(chapterErrors(d, 'utrustning')).toEqual(allErrors(d));
  });
});

describe('Turn', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('två start direkt efter varandra blir en vändning', () => {
    vi.useFakeTimers();
    let turns = 0;
    const t = new Turn(
      () => 700,
      () => turns++,
    );
    t.start();
    t.start();
    expect(t.busy).toBe(true);
    vi.advanceTimersByTime(700);
    expect(turns).toBe(1);
    expect(t.busy).toBe(false);
  });

  it('skip avslutar direkt, en gång', () => {
    vi.useFakeTimers();
    let turns = 0;
    const t = new Turn(
      () => 700,
      () => turns++,
    );
    t.start();
    t.skip();
    expect(t.busy).toBe(false);
    expect(turns).toBe(1);
    vi.advanceTimersByTime(1000);
    t.skip();
    expect(turns).toBe(1);
  });

  it('utan tid (prefers-reduced-motion) är vändningen klar direkt', () => {
    let turns = 0;
    const t = new Turn(
      () => 0,
      () => turns++,
    );
    t.start();
    expect(t.busy).toBe(false);
    expect(turns).toBe(1);
  });
});
