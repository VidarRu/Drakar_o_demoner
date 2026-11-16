import type { GameMap } from '../../engine/map';

/** Rutstorlek i världspixlar. */
export const TILE = 32;

/** Tecknet på en kartruta, eller '' utanför kartan. */
export function charAt(map: GameMap, x: number, y: number): string {
  return x >= 0 && y >= 0 && x < map.w && y < map.h ? map.tiles[y * map.w + x] : '';
}

/** Väggrutor och berg som kastar skugga på marken intill. */
export const isBlocker = (ch: string) => ch === '#' || ch === '%' || ch === '+';
