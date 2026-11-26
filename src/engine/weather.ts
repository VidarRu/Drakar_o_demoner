/**
 * Vädret (Vidar, husregel): två mätare, himlen och vinden, med fem steg var. De ändras ett steg i
 * taget klockan sex och arton. Modulerna kan ange vädret vid start eller låsa det, och
 * väderbesvärjelserna kan ändra det en tid. Inomhus och i grottor märks det inte.
 * Se docs/regelbeslut.md under Vädret.
 */
import type { Game } from './game';
import { tileAt } from './map';
import { die } from './dice';
import { HOUR, SKY, WEATHER, WIND } from './rules';
import type { Actor, GameState, WeatherState } from './types';

/** Vädret när inget annat är sagt: halvklart och svag vind. */
export const DEFAULT_WEATHER: WeatherState = { sky: 1, wind: 1 };

export function weatherOf(g: Game): WeatherState {
  return (g.state.weather ??= { ...DEFAULT_WEATHER });
}

export function weatherText(w: WeatherState): string {
  return `${SKY[w.sky]}, ${WIND[w.wind]}`;
}

/** Är rutan under bar himmel (gräs, stig och vatten, inte hus och grottor)? */
export function underSky(g: Game, at: { x: number; y: number }): boolean {
  const t = tileAt(g.map, at.x, at.y);
  return !!t && (t.outdoor === true || t.name === 'vatten' || t.name === 'träd');
}

/** Regnar det (regn eller åska)? */
export const raining = (g: Game) => weatherOf(g).sky >= 3;

/** Brinner figurens fackla? Regnet släcker facklor utomhus. */
export function torchBurns(g: Game, a: Actor): boolean {
  return !a.torchOut && !(raining(g) && underSky(g, a));
}

/** Avdraget för vädret på ett skott eller kast, när skytten eller målet står utomhus. */
export function weatherRanged(g: Game, a: Actor, t: Actor): [string, number][] {
  if (!underSky(g, a) && !underSky(g, t)) return [];
  const w = weatherOf(g);
  const out: [string, number][] = [];
  if (w.sky >= 3) out.push(['regn', WEATHER.rainRanged]);
  const wind = WEATHER.windRanged[w.wind];
  if (wind) out.push([WIND[w.wind], wind]);
  return out;
}

/** Ett steg för en mätare med 1T6 (se WEATHER i rules/tables.ts). */
export function stepMeter(v: number, d: number): number {
  if (v === 2) return d <= WEATHER.middle.down ? 1 : d >= WEATHER.middle.up ? 3 : 2;
  if (v === 1 || v === 3) {
    const edge = v === 1 ? 0 : 4;
    if (d >= WEATHER.nearEdge.toEdge) return edge;
    if (d <= WEATHER.nearEdge.toMiddle) return 2;
    return v;
  }
  return d <= WEATHER.edge.back ? (v === 0 ? 1 : 3) : v;
}

/** Hur många av klockslagen sex och arton som har passerats mellan två tidpunkter. */
function changes(before: number, now: number): number {
  const at = (t: number) => Math.floor((t - WEATHER.changeHours[0] * HOUR) / (12 * HOUR));
  return Math.max(0, at(now) - at(before));
}

/**
 * Låter vädret ändras för den tid som har gått. En besvärjelse som håller vädret släpper när
 * den tar slut, och vädret går tillbaka till det det var. Ett låst väder (modulen) ändras inte.
 */
export function updateWeather(g: Game, before: number) {
  const w = weatherOf(g);
  const now = g.state.time;
  if (w.held && w.held.until <= now) {
    const back = w.held.prev;
    delete w.held;
    w.sky = back.sky;
    w.wind = back.wind;
    g.log(`Magin över vädret släpper: ${weatherText(w)}.`);
  }
  if (w.locked || w.held) return;
  const n = Math.min(changes(before, now), 28);
  if (!n) return;
  const was = weatherText(w);
  for (let i = 0; i < n; i++) {
    w.sky = stepMeter(w.sky, die(6, g.rng));
    w.wind = stepMeter(w.wind, die(6, g.rng));
  }
  if (weatherText(w) !== was && n <= 2) g.log(`Vädret slår om: ${weatherText(w)}.`);
}

/** En besvärjelse ändrar vädret en tid. Det gamla vädret kommer tillbaka när den tar slut. */
export function holdWeather(g: Game, sky: number, wind: number, seconds: number) {
  const w = weatherOf(g);
  const prev = w.held?.prev ?? { sky: w.sky, wind: w.wind };
  w.sky = Math.max(0, Math.min(4, sky));
  w.wind = Math.max(0, Math.min(4, wind));
  w.held = { until: Math.max(w.held?.until ?? 0, g.state.time + seconds), prev };
}

/** Vädret när en modul börjar: modulens eget, eller det som rådde. */
export function startWeather(s: GameState, start?: { sky: number; wind: number; locked?: boolean }) {
  if (start) s.weather = { sky: start.sky, wind: start.wind, locked: start.locked };
  else if (s.weather) delete s.weather.locked;
  else s.weather = { ...DEFAULT_WEATHER };
}
