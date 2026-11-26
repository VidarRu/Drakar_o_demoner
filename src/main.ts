import Phaser from 'phaser';
import { getAccessCode, setAccessCode } from './ai/dialogClient';
import { Game } from './engine/game';
import { clearSave, loadGame, saveGame } from './engine/save';
import { WorldScene } from './game/WorldScene';
import { mountCreator } from './ui/creation';
import { $, DialogUi, Hud } from './ui/hud';
import { Minimap } from './ui/minimap';
import { ModuleUi } from './ui/module';
import { mountPanels } from './ui/panels';
import { TrainingUi } from './ui/training';

function launch(game: Game) {
  $('start').hidden = true;
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
  const phaser = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#08070a',
    pixelArt: true,
    scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
    scene: [new WorldScene(game, (npc) => void dialog.open(npc))],
  });
  // TANKEÖVERFÖRING och TELEPATI öppnar ett samtal på avstånd.
  game.onUi((name, arg) => {
    const who = name === 'talk' && arg ? game.actor(arg) : undefined;
    if (who) void dialog.open(who);
  });
  // Åtkomst för felsökning och automatiska tester.
  Object.assign(window, { game, phaser });
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

const saved = loadGame();
$('btn-continue').hidden = !saved;
$('btn-continue').onclick = () => saved && launch(new Game(saved));
let resume = false;
try {
  resume = sessionStorage.getItem(AUTOSTART) === '1';
  sessionStorage.removeItem(AUTOSTART);
} catch {
  // Se ovan.
}
if (resume && saved) launch(new Game(saved));
$('btn-load-last').onclick = () => autostart();
mountCreator((character) => {
  setAccessCode($<HTMLInputElement>('in-code').value.trim());
  clearSave();
  launch(Game.create(character));
});
$('btn-restart').onclick = () => {
  clearSave();
  location.reload();
};
$<HTMLInputElement>('in-code').value = getAccessCode();
