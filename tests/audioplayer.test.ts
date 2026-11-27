import { afterEach, describe, expect, it, vi } from 'vitest';
import { attachAudio } from '../src/audio';
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

  it('en webbläsare som blockerar lagringen kraschar inte spelet', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError');
      },
    });
    try {
      expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
      expect(() => saveSettings(DEFAULT_SETTINGS)).not.toThrow();
    } finally {
      delete (globalThis as { localStorage?: unknown }).localStorage;
    }
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

/** En minimal AudioContext och ett <audio> som räknar anropen. */
function fakeBrowser(state: 'running' | 'suspended' = 'running') {
  const gains: { gain: { value: number } }[] = [];
  const music: FakeAudio[] = [];
  class FakeContext {
    state = state;
    currentTime = 0;
    destination = {};
    resume = () => Promise.resolve();
    createGain = () => {
      const g = { gain: { value: 1 }, connect: () => {} };
      gains.push(g);
      return g;
    };
    createMediaElementSource = () => ({ connect: (g: { gain: { value: number } }) => (musicGain.node = g) });
    decodeAudioData = () => Promise.reject(new Error('trasig'));
  }
  const musicGain: { node?: { gain: { value: number } } } = {};
  class FakeAudio {
    paused = true;
    muted = false;
    volume = 1;
    loop = false;
    preload = '';
    plays = 0;
    allow = false;
    onerror: (() => void) | null = null;
    constructor(public src: string) {
      music.push(this);
    }
    play() {
      this.plays++;
      if (!this.allow) return Promise.reject(new Error('NotAllowedError'));
      this.paused = false;
      return Promise.resolve();
    }
    pause() {
      this.paused = true;
    }
  }
  const fetch = vi.fn(() => Promise.reject(new Error('404')));
  vi.stubGlobal('AudioContext', FakeContext);
  vi.stubGlobal('Audio', FakeAudio);
  vi.stubGlobal('fetch', fetch);
  return { music, musicGain, fetch };
}

describe('AudioEngine i en webbläsare', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('spelar inga ljud medan webbläsaren håller ljudet avstängt', () => {
    vi.useFakeTimers();
    const b = fakeBrowser('suspended');
    const e = new AudioEngine();
    e.unlock();
    e.play({ file: 'melee_attack', volume: 1, rate: 1 });
    expect(b.fetch).not.toHaveBeenCalled();
  });

  it('musiken som webbläsaren stoppade försöker igen vid nästa klick', () => {
    vi.useFakeTimers();
    const b = fakeBrowser();
    const e = new AudioEngine();
    e.playMusic('titel');
    e.unlock();
    expect(b.music).toHaveLength(1);
    expect(b.music[0].plays).toBe(1);
    b.music[0].allow = true;
    e.unlock();
    expect(b.music[0].plays).toBe(2);
  });

  it('Tyst och musikreglaget verkar på musiken även där volume inte går att ändra (iPhone)', () => {
    vi.useFakeTimers();
    const b = fakeBrowser();
    const e = new AudioEngine();
    e.unlock();
    e.playMusic('strid');
    vi.advanceTimersByTime(3000);
    expect(b.musicGain.node?.gain.value).toBeCloseTo(0.5);
    e.apply({ sfx: 0.7, music: 0.5, muted: true });
    expect(b.musicGain.node?.gain.value).toBe(0);
    expect(b.music[0].muted).toBe(true);
    e.apply({ sfx: 0.7, music: 0.2, muted: false });
    expect(b.musicGain.node?.gain.value).toBeCloseTo(0.2);
    expect(b.music[0].muted).toBe(false);
  });
});

describe('kopplingen till spelet', () => {
  it('ett fel i musikvalet stoppar inte spelets andra lyssnare', () => {
    vi.useFakeTimers();
    const listeners: (() => void)[] = [];
    const broken = {
      onCue: () => {},
      onChange: (fn: () => void) => listeners.push(fn),
      onMapChange: () => {},
      get state(): never {
        throw new Error('trasigt tillstånd');
      },
    };
    expect(() => attachAudio(broken as never)).not.toThrow();
    expect(() => listeners[0]()).not.toThrow();
    vi.advanceTimersByTime(2000);
    vi.useRealTimers();
  });
});
