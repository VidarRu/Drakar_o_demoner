import { AMBIENCE, type AmbienceId } from './ambience';
import { MUSIC, type MusicId } from './music';
import { DEFAULT_SETTINGS, type AudioSettings } from './settings';
import type { SoundPick } from './sounds';

/** Hur länge musiken tonar över när stycket byts. */
const FADE_MS = 2000;
const FADE_STEP_MS = 50;

/** Släpper in högst `max` ljud samtidigt, och samma fil högst en gång per `gapMs`. */
export class VoiceLimit {
  private playing = 0;
  private last = new Map<string, number>();
  constructor(
    private max = 8,
    private gapMs = 50,
  ) {}

  admit(file: string, now: number): boolean {
    if (this.playing >= this.max) return false;
    const t = this.last.get(file);
    if (t !== undefined && now - t < this.gapMs) return false;
    this.last.set(file, now);
    this.playing++;
    return true;
  }

  release() {
    this.playing = Math.max(0, this.playing - 1);
  }
}

/** Ger ett nytt värde först när det har varit detsamma i `holdMs`, så att musiken inte fladdrar. */
export class Settle<T> {
  private current: T | null = null;
  private candidate: T | null = null;
  private since = 0;
  constructor(private holdMs = 1000) {}

  push(value: T, now: number): T | null {
    if (value === this.current) {
      this.candidate = null;
      return null;
    }
    if (value !== this.candidate) {
      this.candidate = value;
      this.since = now;
    }
    if (now - this.since < this.holdMs) return null;
    this.current = value;
    this.candidate = null;
    return value;
  }
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

type Ctor = new () => AudioContext;
const audioContextClass = (): Ctor | undefined =>
  (globalThis as { AudioContext?: Ctor; webkitAudioContext?: Ctor }).AudioContext ?? (globalThis as { webkitAudioContext?: Ctor }).webkitAudioContext;

/** Miljöljudet spelas så här starkt i förhållande till ljudreglaget, under musiken. */
export const AMBIENCE_LEVEL = 0.5;

/** En miljöslinga: avkodad och loopad i Web Audio. */
interface AmbientTrack {
  id: AmbienceId;
  src?: AudioBufferSourceNode;
  gain: GainNode;
  level: number;
  fading: 'in' | 'out';
}

interface Track {
  id: MusicId;
  el: HTMLAudioElement;
  /** Musikens volym i Web Audio. Utan den används el.volume, som iPhone inte bryr sig om. */
  gain?: GainNode;
  /** 0–1: hur långt intoningen har kommit. */
  level: number;
  fading: 'in' | 'out';
}

/**
 * Spelar upp ljudeffekter (Web Audio, avkodade en gång), musik (ett strömmat <audio> per
 * stycke, som tonar över) och miljöljud (en loopad slinga i Web Audio, som också tonar över). Rör inte webbläsarens ljud förrän det behövs, och gör ingenting
 * där ljud saknas (till exempel i testerna).
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private failed = new Set<string>();
  private voices = new VoiceLimit();
  private settings: AudioSettings = { ...DEFAULT_SETTINGS };
  private unlocked = false;
  private wanted: MusicId | null = null;
  private tracks: Track[] = [];
  private wantedAmbience: AmbienceId | null = null;
  private ambient: AmbientTrack[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private base = '/audio/') {}

  /** Musiken som ska spela just nu (även innan ljudet är upplåst). */
  get musicId(): MusicId | null {
    return this.wanted;
  }

  /** Miljöljudet som ska höras just nu, eller inget. */
  get ambienceId(): AmbienceId | null {
    return this.wantedAmbience;
  }

  /** Låser upp ljudet. Anropas vid ett klick eller tangenttryck. */
  unlock() {
    const C = audioContextClass();
    if (!this.ctx && C) {
      try {
        this.ctx = new C();
        this.out = this.ctx.createGain();
        this.out.connect(this.ctx.destination);
        this.applyGain();
      } catch {
        this.ctx = null;
      }
    }
    if (this.ctx && this.ctx.state !== 'running') this.ctx.resume?.().catch(() => {});
    if (!this.unlocked) {
      this.unlocked = true;
      if (this.wanted) this.startMusic(this.wanted);
      if (this.wantedAmbience) this.startAmbience(this.wantedAmbience);
      return;
    }
    // Musik som webbläsaren stoppade (ljud före ett riktigt klick) får försöka igen.
    for (const t of this.tracks) if (t.fading === 'in' && t.el.paused) t.el.play()?.catch(() => {});
  }

  play(p: SoundPick) {
    const ctx = this.ctx;
    // Medan webbläsaren håller ljudet avstängt köas inga ljud (de skulle komma i en klump sedan).
    if (!ctx || !this.out || ctx.state !== 'running' || this.settings.muted || this.settings.sfx <= 0 || this.failed.has(p.file)) return;
    if (!this.voices.admit(p.file, now())) return;
    this.load(p.file)
      .then((buffer) => {
        if (!buffer) return this.voices.release();
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.playbackRate.value = p.rate;
        const gain = ctx.createGain();
        gain.gain.value = p.volume;
        src.connect(gain);
        gain.connect(this.out!);
        src.onended = () => this.voices.release();
        src.start();
      })
      .catch(() => this.voices.release());
  }

  playMusic(id: MusicId) {
    this.wanted = id;
    if (this.unlocked) this.startMusic(id);
  }

  /** Byter miljöslinga (null: ingen). Den gamla tonas ut och den nya in. */
  playAmbience(id: AmbienceId | null) {
    this.wantedAmbience = id;
    if (this.unlocked) this.startAmbience(id);
  }

  apply(s: AudioSettings) {
    this.settings = { ...s };
    this.applyGain();
    for (const t of this.tracks) this.setVolume(t);
    for (const t of this.ambient) t.gain.gain.value = this.ambientVolume(t);
  }

  private ambientVolume(t: AmbientTrack): number {
    return this.settings.muted ? 0 : this.settings.sfx * AMBIENCE_LEVEL * t.level;
  }

  private startAmbience(id: AmbienceId | null) {
    const ctx = this.ctx;
    if (!ctx) return;
    const live = this.ambient.find((t) => t.fading === 'in');
    if (live?.id === id) return;
    for (const t of this.ambient) t.fading = 'out';
    const back = id && this.ambient.find((t) => t.id === id);
    if (back) back.fading = 'in';
    else if (id) {
      try {
        const gain = ctx.createGain();
        gain.gain.value = 0;
        gain.connect(ctx.destination);
        const t: AmbientTrack = { id, gain, level: 0, fading: 'in' };
        this.ambient.push(t);
        this.load(`flare/sfx/slinga/${AMBIENCE[id]}`)
          .then((buffer) => {
            // Bytt eller borttonad medan filen laddades: spela inte.
            if (!buffer || !this.ambient.includes(t)) return;
            const src = ctx.createBufferSource();
            src.buffer = buffer;
            src.loop = true;
            src.connect(gain);
            src.start();
            t.src = src;
          })
          .catch(() => {});
      } catch {
        return;
      }
    }
    this.timer ??= setInterval(() => this.fadeStep(), FADE_STEP_MS);
  }

  private setVolume(t: Track) {
    const v = this.trackVolume(t);
    if (t.gain) t.gain.gain.value = v;
    else t.el.volume = v;
    t.el.muted = this.settings.muted;
  }

  private applyGain() {
    if (this.out) this.out.gain.value = this.settings.muted ? 0 : this.settings.sfx;
  }

  private load(file: string): Promise<AudioBuffer | null> {
    let p = this.buffers.get(file);
    if (!p) {
      const ctx = this.ctx!;
      p = fetch(`${this.base}${file}.mp3`)
        .then((r) => {
          if (!r.ok) throw new Error(`${r.status}`);
          return r.arrayBuffer();
        })
        .then((data) => ctx.decodeAudioData(data))
        .catch(() => {
          this.failed.add(file);
          this.buffers.delete(file);
          return null;
        });
      this.buffers.set(file, p);
    }
    return p;
  }

  private trackVolume(t: Track): number {
    return this.settings.muted ? 0 : this.settings.music * t.level;
  }

  private startMusic(id: MusicId) {
    if (typeof Audio === 'undefined') return;
    const live = this.tracks.find((t) => t.fading === 'in');
    if (live?.id === id) return;
    for (const t of this.tracks) t.fading = 'out';
    const back = this.tracks.find((t) => t.id === id);
    if (back) back.fading = 'in';
    else {
      try {
        const el = new Audio(`${this.base}flare/music/${MUSIC[id]}.mp3`);
        el.loop = true;
        el.preload = 'auto';
        const t: Track = { id, el, level: 0, fading: 'in' };
        if (this.ctx) {
          try {
            t.gain = this.ctx.createGain();
            this.ctx.createMediaElementSource(el).connect(t.gain);
            t.gain.connect(this.ctx.destination);
          } catch {
            t.gain = undefined;
          }
        }
        this.setVolume(t);
        this.tracks.push(t);
        el.play()?.catch(() => {});
        el.onerror = () => {
          el.pause();
          this.tracks = this.tracks.filter((x) => x !== t);
        };
      } catch {
        return;
      }
    }
    this.timer ??= setInterval(() => this.fadeStep(), FADE_STEP_MS);
  }

  private fadeStep() {
    const step = FADE_STEP_MS / FADE_MS;
    for (const t of this.tracks) {
      t.level = Math.min(1, Math.max(0, t.level + (t.fading === 'in' ? step : -step)));
      this.setVolume(t);
      if (t.fading === 'in' && t.el.paused) t.el.play()?.catch(() => {});
    }
    for (const t of this.tracks.filter((x) => x.fading === 'out' && x.level <= 0)) t.el.pause();
    this.tracks = this.tracks.filter((t) => !(t.fading === 'out' && t.level <= 0));
    for (const t of this.ambient) {
      t.level = Math.min(1, Math.max(0, t.level + (t.fading === 'in' ? step : -step)));
      t.gain.gain.value = this.ambientVolume(t);
    }
    for (const t of this.ambient.filter((x) => x.fading === 'out' && x.level <= 0)) {
      try {
        t.src?.stop();
      } catch {
        // Redan stoppad.
      }
    }
    this.ambient = this.ambient.filter((t) => !(t.fading === 'out' && t.level <= 0));
    if ([...this.tracks, ...this.ambient].every((t) => t.fading === 'in' && t.level >= 1) && this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
