import type { Game } from '../engine/game';
import { ambienceFor, type AmbienceId } from './ambience';
import { musicFor, type MusicId } from './music';
import { AudioEngine, Settle } from './player';
import { loadSettings, saveSettings, type AudioSettings } from './settings';
import { buttonSound, soundFor } from './sounds';

/** Ljudet för hela sidan: startskärmen och spelet. */
export const audio = new AudioEngine();

/** Det andra ljudet i en signal (t.ex. pareringen efter hugget) kommer lite efter det första. */
const LAYER_MS = 120;

let settings: AudioSettings = loadSettings();
let mounted = false;

/** Startskärmen: titelmusiken, upplåsningen vid första klicket och ljudknappen. */
export function mountAudio() {
  if (mounted) return;
  mounted = true;
  audio.apply(settings);
  audio.playMusic('titel');
  // Telefoner räknar bara att fingret släpps (pointerup, touchend, click) som ett klick som får starta ljud.
  const unlock = () => audio.unlock();
  for (const type of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) document.addEventListener(type, unlock, { capture: true });
  document.addEventListener('click', (e) => {
    if (e.target instanceof Element && e.target.closest('button')) audio.play(buttonSound());
  });
  mountControls();
}

/** Spelet: ljudsignalerna blir ljud, och musiken följer läget och platsen. */
export function attachAudio(game: Game) {
  game.onCue((c) => {
    soundFor(game, c).forEach((p, i) => {
      const ms = p.delay ?? LAYER_MS * i;
      if (ms) setTimeout(() => audio.play(p), ms);
      else audio.play(p);
    });
  });
  const settle = new Settle<MusicId>();
  // Settle använder null för "inget byte", så "inget miljöljud" heter 'ingen' här.
  const settleAmbience = new Settle<AmbienceId | 'ingen'>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const update = () => {
    try {
      const now = performance.now();
      const next = settle.push(musicFor(game), now);
      if (next) audio.playMusic(next);
      const ambience = settleAmbience.push(ambienceFor(game) ?? 'ingen', now);
      if (ambience) audio.playAmbience(ambience === 'ingen' ? null : ambience);
    } catch {
      // Musiken får aldrig stoppa spelets andra lyssnare (gränssnittet, sparningen).
    }
  };
  // Valet kontrolleras igen när det har hunnit sätta sig, även om inget mer händer.
  const changed = () => {
    update();
    clearTimeout(timer);
    timer = setTimeout(update, 1050);
  };
  game.onChange(changed);
  game.onMapChange(changed);
  changed();
}

/** Det som ska ritas om när ljudinställningarna ändras, så att alla reglage visar samma sak. */
const refreshers: (() => void)[] = [];

/** Reglagen för ljud, musik och tyst. ♪-panelen och Inställningar i menyn har var sin uppsättning. */
export function audioSliders(): HTMLElement {
  const root = document.createElement('div');
  root.className = 'ljud-reglage';
  root.innerHTML = `
    <label>Ljud <input type="range" min="0" max="100" step="5" /></label>
    <label>Musik <input type="range" min="0" max="100" step="5" /></label>
    <label class="ljud-tyst"><input type="checkbox" /> Tyst</label>`;
  const [sfx, music, muted] = root.querySelectorAll('input');
  const show = () => {
    sfx.value = String(Math.round(settings.sfx * 100));
    music.value = String(Math.round(settings.music * 100));
    muted.checked = settings.muted;
  };
  const change = () => {
    settings = { sfx: Number(sfx.value) / 100, music: Number(music.value) / 100, muted: muted.checked };
    audio.apply(settings);
    saveSettings(settings);
    for (const refresh of refreshers) refresh();
  };
  for (const input of [sfx, music, muted]) input.oninput = change;
  refreshers.push(show);
  show();
  return root;
}

function mountControls() {
  const root = document.createElement('div');
  root.id = 'ljud';
  root.innerHTML = `
    <button id="ljud-knapp" aria-label="Ljud och musik" aria-expanded="false">♪</button>
    <div id="ljud-panel" hidden></div>`;
  document.body.append(root);
  const button = root.querySelector<HTMLButtonElement>('#ljud-knapp')!;
  const panel = root.querySelector<HTMLDivElement>('#ljud-panel')!;
  panel.append(audioSliders());
  const show = () => button.classList.toggle('tyst', settings.muted);
  button.onclick = () => {
    panel.hidden = !panel.hidden;
    button.setAttribute('aria-expanded', String(!panel.hidden));
    // Knappen ska inte behålla fokus, så att spelets snabbtangenter fungerar direkt.
    button.blur();
  };
  refreshers.push(show);
  show();
}
