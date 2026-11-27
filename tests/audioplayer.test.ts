import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioEngine, Settle, VoiceLimit } from '../src/audio/player';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../src/audio/settings';

describe('ljudinställningarna', () => {
  it('förvalen', () => {
    expect(DEFAULT_SETTINGS).toEqual({ sfx: 0.7, music: 0.5, muted: false });
  });

  it('förvalen när lagringen kastar eller innehåller skräp', () => {
    expect(
      loadSettings({
        getItem: () => {
          throw new Error('av');
        },
      }),
    ).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings({ getItem: () => '{trasig' })).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings({ getItem: () => null })).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings({ getItem: () => JSON.stringify({ sfx: 0.2, music: 'högt' }) })).toEqual({ ...DEFAULT_SETTINGS, sfx: 0.2 });
  });

  it('sparas under dod-ljud och läses tillbaka', () => {
    const store = new Map<string, string>();
    saveSettings({ sfx: 0.1, music: 0.9, muted: true }, { setItem: (k, v) => store.set(k, v) });
    expect([...store.keys()]).toEqual(['dod-ljud']);
    expect(loadSettings({ getItem: (k) => store.get(k) ?? null })).toEqual({ sfx: 0.1, music: 0.9, muted: true });
    expect(() =>
      saveSettings(DEFAULT_SETTINGS, {
        setItem: () => {
          throw new Error('full');
        },
      }),
    ).not.toThrow();
  });
});

describe('VoiceLimit', () => {
  it('samma fil spelas inte två gånger inom 50 ms', () => {
    const v = new VoiceLimit();
    expect(v.admit('a', 0)).toBe(true);
    expect(v.admit('a', 10)).toBe(false);
    expect(v.admit('a', 60)).toBe(true);
  });

  it('högst 8 ljud samtidigt', () => {
    const v = new VoiceLimit();
    for (let i = 0; i < 8; i++) expect(v.admit(`f${i}`, 0)).toBe(true);
    expect(v.admit('f9', 0)).toBe(false);
    v.release();
    expect(v.admit('f9', 0)).toBe(true);
  });
});

describe('Settle', () => {
  it('byter först när valet har varit detsamma i 1000 ms', () => {
    const s = new Settle<string>();
    expect(s.push('by', 0)).toBe(null);
    expect(s.push('by', 1000)).toBe('by');
    expect(s.push('grotta', 1500)).toBe(null);
    expect(s.push('by', 1700)).toBe(null);
    expect(s.push('grotta', 1800)).toBe(null);
    expect(s.push('grotta', 2700)).toBe(null);
    expect(s.push('grotta', 2800)).toBe('grotta');
    // Redan bytt: inget nytt byte.
    expect(s.push('grotta', 4000)).toBe(null);
  });
});

describe('AudioEngine', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('kastar inte utan webbläsare', () => {
    const e = new AudioEngine();
    expect(() => {
      e.unlock();
      e.play({ file: 'melee_attack', volume: 1, rate: 1 });
      e.playMusic('strid');
      e.apply({ sfx: 0.3, music: 0.3, muted: true });
    }).not.toThrow();
    expect(e.musicId).toBe('strid');
  });

  it('en fil som inte går att hämta ger ingen ohanterad avvisning', async () => {
    const rejected: unknown[] = [];
    const onRejection = (r: unknown) => rejected.push(r);
    process.on('unhandledRejection', onRejection);
    const fetch = vi.fn(() => Promise.reject(new Error('404')));
    class FakeContext {
      state = 'running';
      currentTime = 0;
      destination = {};
      resume = () => Promise.resolve();
      createGain = () => ({ gain: { value: 1 }, connect: () => {} });
      decodeAudioData = () => Promise.reject(new Error('trasig'));
    }
    vi.stubGlobal('fetch', fetch);
    vi.stubGlobal('AudioContext', FakeContext);
    const e = new AudioEngine();
    e.unlock();
    e.play({ file: 'saknas', volume: 1, rate: 1 });
    await new Promise((r) => setTimeout(r, 20));
    e.play({ file: 'saknas', volume: 1, rate: 1 });
    await new Promise((r) => setTimeout(r, 20));
    process.off('unhandledRejection', onRejection);
    expect(rejected).toEqual([]);
    // En fil som har misslyckats försöks inte igen.
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
