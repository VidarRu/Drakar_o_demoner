import type { Game } from '../engine/game';
import { distance, inBounds, tileAt } from '../engine/map';
import { isDaylight } from '../engine/rules';

/** Miljöljudet: en slinga i taget under musiken. */
export type AmbienceId = 'faglar' | 'uggla' | 'flod' | 'vind' | 'grotta' | 'hard';

/** Slinga för varje miljö: fil under public/audio/flare/sfx/slinga/, utan .mp3. */
export const AMBIENCE: Record<AmbienceId, string> = {
  faglar: 'bird_twitter_loop',
  uggla: 'forest_owl_loop',
  flod: 'river_loop',
  vind: 'wind_loop',
  grotta: 'cave_droplets_loop',
  hard: 'open_fire_loop',
};

/** Hur nära vatten man ska stå för att höra floden (rutor). */
const WATER_REACH = 3;
const WATER = new Set(['vatten', 'vadställe']);
const FOREST = new Set(['öppen skog', 'tät skog']);

const nearWater = (g: Game, x: number, y: number) => {
  for (let dy = -WATER_REACH; dy <= WATER_REACH; dy++) {
    for (let dx = -WATER_REACH; dx <= WATER_REACH; dx++) {
      const tx = x + dx;
      const ty = y + dy;
      if (inBounds(g.map, tx, ty) && distance(x, y, tx, ty) <= WATER_REACH && WATER.has(tileAt(g.map, tx, ty).name)) return true;
    }
  }
  return false;
};

/**
 * Miljöljudet som passar just nu, eller inget. Bara när gruppen utforskar: i strid tar musiken
 * över. Rutan där ledaren står avgör först (grotta, inomhus), sedan vatten i närheten, sist om
 * det är dag eller natt. Världskartan har vind på öppen mark och fåglar eller uggla i skogen.
 */
export function ambienceFor(g: Game | null): AmbienceId | null {
  if (!g || g.state.mode !== 'explore') return null;
  const p = g.leader;
  if (!p || !inBounds(g.map, p.x, p.y)) return null;
  const tile = tileAt(g.map, p.x, p.y);
  if (tile.name === 'grottgolv') return 'grotta';
  if (tile.name === 'trägolv') return 'hard';
  if (nearWater(g, p.x, p.y)) return 'flod';
  const day = isDaylight(g.state.time);
  if (g.map.kind === 'värld' && !FOREST.has(tile.name)) return 'vind';
  return day ? 'faglar' : 'uggla';
}
