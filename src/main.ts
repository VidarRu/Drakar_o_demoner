import Phaser from 'phaser';
import { getAccessCode, setAccessCode } from './ai/dialogClient';
import { Game } from './engine/game';
import { clearSave, loadGame, saveGame } from './engine/save';
import { WorldScene } from './game/WorldScene';
import { mountCreator } from './ui/creation';
import { $, DialogUi, Hud } from './ui/hud';
import { Minimap } from './ui/minimap';
import { TrainingUi } from './ui/training';

function launch(game: Game) {
  $('start').hidden = true;
  const dialog = new DialogUi(game);
  new Hud(game);
  new Minimap(game);
  new TrainingUi(game);
  game.onChange(() => {
    if (game.state.mode === 'explore') saveGame(game.state);
    else if (game.state.mode === 'dead') clearSave();
  });
  const phaser = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#08070a',
    pixelArt: true,
    scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
    scene: [new WorldScene(game, (npc) => void dialog.open(npc))],
  });
  // Åtkomst för felsökning och automatiska tester.
  Object.assign(window, { game, phaser });
}

const saved = loadGame();
$('btn-continue').hidden = !saved;
$('btn-continue').onclick = () => saved && launch(new Game(saved));
mountCreator((character) => {
  setAccessCode($<HTMLInputElement>('in-code').value.trim());
  clearSave();
  launch(Game.create(character));
});
$('btn-restart').onclick = () => location.reload();
$<HTMLInputElement>('in-code').value = getAccessCode();
