import { describe, expect, it } from 'vitest';
import { changedInk } from '../src/ui/ink';

describe('changedInk', () => {
  it('ger nyckeln när tomt blir text', () => {
    expect(changedInk(new Map([['Ras', '']]), new Map([['Ras', 'Alv']]))).toEqual(['Ras']);
  });
  it('ger nyckeln för en ny nyckel och för ändrad text', () => {
    expect(changedInk(new Map(), new Map([['Ras', 'Alv']]))).toEqual(['Ras']);
    expect(changedInk(new Map([['Ras', 'Alv']]), new Map([['Ras', 'Dvärg']]))).toEqual(['Ras']);
  });
  it('ger inget när texten är densamma', () => {
    expect(changedInk(new Map([['Ras', 'Alv']]), new Map([['Ras', 'Alv']]))).toEqual([]);
  });
  it('ger inget när en nyckel försvinner eller blir tom', () => {
    expect(changedInk(new Map([['Ras', 'Alv']]), new Map())).toEqual([]);
    expect(changedInk(new Map([['Ras', 'Alv']]), new Map([['Ras', '']]))).toEqual([]);
  });
});
