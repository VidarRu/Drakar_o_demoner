import Phaser from 'phaser';
import { getAccessCode, setAccessCode } from './ai/dialogClient';
import { PROFESSIONS } from './content';
import { Game } from './engine/game';
import { rollAttrs } from './engine/rules';
import { clearSave, loadGame, saveGame } from './engine/save';
import { ATTR_KEYS } from './engine/types';
import { portraitUrl } from './game/art';
import { WorldScene } from './game/WorldScene';
import { $, DialogUi, el, Hud } from './ui/hud';

let attrs = rollAttrs(Math.random);
let profession = Object.keys(PROFESSIONS)[0];

function renderStart() {
  const profs = $('professions');
  profs.replaceChildren(
    ...Object.values(PROFESSIONS).map((p) => {
      const b = el('button', p.id === profession ? 'sel' : '');
      const img = el('img');
      img.src = portraitUrl(p.sprite);
      b.append(img, el('b', '', p.name), el('small', '', p.desc));
      b.onclick = () => {
        profession = p.id;
        renderStart();
      };
      return b;
    }),
  );
  $('attrs').replaceChildren(
    ...ATTR_KEYS.map((k) => {
      const cell = el('div', '', String(attrs[k]));
      cell.prepend(el('small', '', k));
      return cell;
    }),
  );
}

function launch(game: Game) {
  $('start').hidden = true;
  const dialog = new DialogUi(game);
  new Hud(game);
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
$('btn-reroll').onclick = () => {
  attrs = rollAttrs(Math.random);
  renderStart();
};
$('btn-start').onclick = () => {
  const name = $<HTMLInputElement>('in-name').value.trim() || 'Namnlös';
  setAccessCode($<HTMLInputElement>('in-code').value.trim());
  clearSave();
  launch(Game.create({ name, profession, attrs }));
};
$('btn-restart').onclick = () => location.reload();
$<HTMLInputElement>('in-code').value = getAccessCode();
renderStart();
