/** Ljudinställningarna sparas i webbläsaren. Går det inte gäller förvalen. */
export interface AudioSettings {
  /** Ljudeffekternas volym, 0–1. */
  sfx: number;
  /** Musikens volym, 0–1. */
  music: number;
  /** Allt ljud av. */
  muted: boolean;
}

export const DEFAULT_SETTINGS: AudioSettings = { sfx: 0.7, music: 0.5, muted: false };
const KEY = 'dod-ljud';

const volume = (v: unknown, fallback: number) => (typeof v === 'number' && v >= 0 && v <= 1 ? v : fallback);

/** Webbläsarens lagring. Läses inuti try: en webbläsare som blockerar lagringen kastar redan här. */
const browserStorage = (): Storage | undefined => (typeof localStorage === 'undefined' ? undefined : localStorage);

export function loadSettings(storage?: Pick<Storage, 'getItem'>): AudioSettings {
  try {
    const raw = (storage ?? browserStorage())?.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const s = JSON.parse(raw) as Partial<AudioSettings>;
    return {
      sfx: volume(s.sfx, DEFAULT_SETTINGS.sfx),
      music: volume(s.music, DEFAULT_SETTINGS.music),
      muted: typeof s.muted === 'boolean' ? s.muted : DEFAULT_SETTINGS.muted,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: AudioSettings, storage?: Pick<Storage, 'setItem'>) {
  try {
    (storage ?? browserStorage())?.setItem(KEY, JSON.stringify(s));
  } catch {
    // Lagring avstängd: inställningarna gäller tills sidan laddas om.
  }
}
