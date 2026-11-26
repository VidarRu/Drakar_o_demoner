/**
 * Färd på världskartan (Vidar, efter steg 8). Besluten står i docs/regelbeslut.md under Världskartan.
 * Värdena som är markerade som platshållare kan bytas ut när reglerna finns.
 */

/** Terrängen på en ruta på världskartan. */
export type Terrain = 'slätt' | 'väg' | 'öppen skog' | 'tät skog' | 'kullar' | 'berg' | 'bro' | 'vadställe';

/** Minuter per ruta i vanlig terräng (Vidar: en kvart). En modul kan ange något annat. */
export const QUARTER_MINUTES = 15;

/**
 * Hur många gånger längre tid en ruta tar än vanlig terräng (Vidar). Öppen terräng och öppen skog
 * går som vanligt, tät skog och kullar dubbelt så långsamt och berg fyra gånger. En flod korsas på
 * en kvart över en bro och på dubbla tiden vid ett vadställe.
 */
export const TERRAIN_COST: Record<Terrain, number> = {
  slätt: 1,
  väg: 1,
  'öppen skog': 1,
  'tät skog': 2,
  kullar: 2,
  berg: 4,
  bro: 1,
  vadställe: 2,
};

/** Stridskartornas terränger (Vidar). Väg, bro och vadställe strider på slätten. */
export type BattleTerrain = 'slätt' | 'öppen skog' | 'tät skog' | 'kullar' | 'berg';

export const BATTLE_TERRAIN: Record<Terrain, BattleTerrain> = {
  slätt: 'slätt',
  väg: 'slätt',
  'öppen skog': 'öppen skog',
  'tät skog': 'tät skog',
  kullar: 'kullar',
  berg: 'berg',
  bro: 'slätt',
  vadställe: 'slätt',
};

export const TRAVEL = {
  /** Synhåll i rutor på världskartan, dag och natt (platshållare). Mörkersyn ser som om det vore dag. */
  sight: { dag: 4, natt: 2 },
  /** Dagsljus från klockan sex till klockan arton (samma tider som vädret). */
  dayStart: 6,
  dayEnd: 18,
  /** Finna dolda ting för en varelse som saknar värdet (Vidar: 6–12 efter hur vaksam den är). */
  defaultSpot: 9,
  /**
   * En grupp som jagar skyndar sig: den hinner dubbelt så långt på samma tid som gruppen, som reser
   * i marschtakt (tolkning). Annars skulle den aldrig hinna ifatt.
   */
  huntPace: 2,
  /** En grupp som gruppen har smugit förbi går åt ett annat håll så här många kvartar (tolkning). */
  evadeQuarters: 4,
  /** En vandrande grupp flyttar sig ungefär varannan kvart, inom så många rutor från sin plats. */
  wanderChance: 0.5,
  wanderRadius: 5,
  /** Slumpmöten: ett slag per timme färd, och 1 på 1T6 ger ett möte (platshållare). */
  encounterEvery: 60,
  encounterDie: 6,
  encounterOn: 1,
  /** En grupp från ett slumpmöte som inte jagar försvinner efter så många timmar. */
  randomBandHours: 6,
} as const;

/** Klockslaget i timmar (0–23) för en speltid i sekunder. */
export const hourOfDay = (seconds: number) => Math.floor((seconds % 86400) / 3600);

export const isDaylight = (seconds: number) => {
  const h = hourOfDay(seconds);
  return h >= TRAVEL.dayStart && h < TRAVEL.dayEnd;
};
