import { CREATURES } from '../content';
import { participants } from '../engine/combat';
import type { Game } from '../engine/game';
import { tileAt, type MusicTheme } from '../engine/map';

/** Vad som spelas: kartornas teman och lägena som inte hör till någon karta. */
export type MusicId = MusicTheme | 'titel' | 'strid' | 'boss' | 'oro';

/** Musikstycke för varje val: fil under public/audio/flare/music/, utan .mp3. */
export const MUSIC: Record<MusicId, string> = {
  titel: 'title_theme',
  värld: 'overworld_theme',
  by: 'town_theme',
  skog: 'forest_theme',
  grotta: 'cave_theme',
  fängelsehåla: 'dungeon_theme',
  trygg: 'safe_room_theme',
  magisk: 'magical_theme',
  strid: 'battle_theme',
  boss: 'boss_theme',
  oro: 'unrest_theme',
};

/** Musiken som passar just nu: läget först, sedan rutan där ledaren står, sist kartan. */
export function musicFor(g: Game | null): MusicId {
  if (!g) return 'titel';
  const mode = g.state.mode;
  if (mode === 'dead') return 'oro';
  if (mode === 'ended') return 'trygg';
  if (mode === 'combat') {
    const boss = participants(g).some((a) => a.alive && a.hostile && CREATURES[a.defId]?.boss);
    return boss ? 'boss' : 'strid';
  }
  const p = g.leader;
  const tile = tileAt(g.map, p.x, p.y)?.name;
  if (tile === 'grottgolv') return 'grotta';
  if (tile === 'trägolv') return 'trygg';
  return g.map.music ?? (g.map.kind === 'värld' ? 'värld' : 'magisk');
}
