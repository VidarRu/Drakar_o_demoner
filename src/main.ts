import '@fontsource/grenze-gotisch/700.css';
import '@fontsource/archivo-narrow/400.css';
import '@fontsource/archivo-narrow/700.css';
import '@fontsource/kalam/400.css';
import '@fontsource/kalam/700.css';
import Phaser from 'phaser';
import { getAccessCode, setAccessCode } from './ai/dialogClient';
import { attachAudio, audio, mountAudio } from './audio';
import { Game } from './engine/game';
import { clearSave, loadGame, saveGame } from './engine/save';
import type { Character } from './engine/types';
import { IsoScene } from './game/IsoScene';
import { WorldScene } from './game/WorldScene';
import { $, DialogUi, Hud } from './ui/hud';
import { mountMenu } from './ui/menu';
import { Minimap } from './ui/minimap';
import { ModuleUi } from './ui/module';
import { mountPanels } from './ui/panels';
import { TrainingUi } from './ui/training';

function launch(game: Game) {
  menu.hide();
  // Slängprov: den snedställda vyn är förval; ?vy=plan visar den gamla vyn rakt ovanifrån.
  const plan = new URLSearchParams(location.search).get('vy') === 'plan';
  document.body.classList.toggle('iso', !plan);
  attachAudio(game);
  const dialog = new DialogUi(game);
  const panels = mountPanels(game);
  new Hud(game, { pack: () => panels.pack.open(), magic: () => panels.magic.open(), quests: () => panels.quests.open() });
  // Nästa modul: spara och ladda om sidan, så att kartan och scenen byggs på nytt.
  new ModuleUi(game, (state) => {
    saveGame(state);
    autostart();
  });
  new Minimap(game);
  new TrainingUi(game);
  // Spelet sparas utanför strid. När rollpersonen dör finns den senaste sparningen kvar (Vidar, steg 8).
  game.onChange(() => {
    if (game.state.mode === 'explore' || game.state.mode === 'ended') saveGame(game.state);
  });
  const talk = (npc: Parameters<DialogUi['open']>[0]) => void dialog.open(npc);
  const phaser = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#08070a',
    pixelArt: plan,
    antialias: !plan,
    scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
    scene: [plan ? new WorldScene(game, talk) : new IsoScene(game, talk)],
  });
  // Åtkomst för felsökning och automatiska tester.
  Object.assign(window, { game, phaser, audio });
}

const AUTOSTART = 'dod-autostart';
/** Laddar om sidan och fortsätter direkt med sparningen. */
function autostart() {
  try {
    sessionStorage.setItem(AUTOSTART, '1');
  } catch {
    // Lagring avstängd: spelaren får klicka på "Fortsätt äventyret".
  }
  location.reload();
}

/** Fortsätter med sparningen, om den finns. Än så länge finns bara en sparplats. */
function continueGame() {
  const saved = loadGame();
  if (saved) launch(new Game(saved));
}

/** Ett nytt äventyr skriver över sparningen. */
function startNew(character: Character) {
  setAccessCode($<HTMLInputElement>('in-code').value.trim());
  clearSave();
  launch(Game.create(character));
}

mountAudio();
const menu = mountMenu({
  continueGame,
  startNew,
  load: () => continueGame(),
});
const code = $<HTMLInputElement>('in-code');
code.value = getAccessCode();
code.onchange = () => setAccessCode(code.value.trim());
let resume = false;
try {
  resume = sessionStorage.getItem(AUTOSTART) === '1';
  sessionStorage.removeItem(AUTOSTART);
} catch {
  // Se ovan.
}
if (resume) continueGame();
$('btn-load-last').onclick = () => autostart();
// Tillbaka till huvudmenyn. Sparningen från före döden finns kvar under "Fortsätt äventyret".
$('btn-restart').onclick = () => location.reload();
