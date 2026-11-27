import type { Game } from '../engine/game';
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
    soundFor(game, c).forEach((p, i) => (i ? setTimeout(() => audio.play(p), LAYER_MS * i) : audio.play(p)));
  });
  const settle = new Settle<MusicId>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const update = () => {
    try {
      const next = settle.push(musicFor(game), performance.now());
      if (next) audio.playMusic(next);
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

function mountControls() {
  const root = document.createElement('div');
  root.id = 'ljud';
  root.innerHTML = `
    <button id="ljud-knapp" aria-label="Ljud och musik" aria-expanded="false">♪</button>
    <div id="ljud-panel" hidden>
      <label>Ljud <input id="ljud-sfx" type="range" min="0" max="100" step="5" /></label>
      <label>Musik <input id="ljud-musik" type="range" min="0" max="100" step="5" /></label>
      <label class="ljud-tyst"><input id="ljud-tyst" type="checkbox" /> Tyst</label>
    </div>`;
  document.body.append(root);
  const button = root.querySelector<HTMLButtonElement>('#ljud-knapp')!;
  const panel = root.querySelector<HTMLDivElement>('#ljud-panel')!;
  const sfx = root.querySelector<HTMLInputElement>('#ljud-sfx')!;
  const music = root.querySelector<HTMLInputElement>('#ljud-musik')!;
  const muted = root.querySelector<HTMLInputElement>('#ljud-tyst')!;
  const show = () => {
    sfx.value = String(Math.round(settings.sfx * 100));
    music.value = String(Math.round(settings.music * 100));
    muted.checked = settings.muted;
    button.classList.toggle('tyst', settings.muted);
  };
  const change = () => {
    settings = { sfx: Number(sfx.value) / 100, music: Number(music.value) / 100, muted: muted.checked };
    audio.apply(settings);
    saveSettings(settings);
    show();
  };
  button.onclick = () => {
    panel.hidden = !panel.hidden;
    button.setAttribute('aria-expanded', String(!panel.hidden));
    // Knappen ska inte behålla fokus, så att spelets snabbtangenter fungerar direkt.
    button.blur();
  };
  for (const el of [sfx, music, muted]) el.oninput = change;
  show();
}
