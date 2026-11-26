/**
 * Facklor och oljelyktor (Vidar): en fackla brinner en timme och förbrukas, och en oljelykta brinner
 * sex timmar på en fyllning och fylls på med lampolja (en timme per flaska). Tolkningar: man tänder
 * en ny fackla av sig själv när den gamla brinner ut, ljuset brinner inte medan gruppen sover, och
 * en oljelykta slocknar inte i regn. Se docs/regelbeslut.md under Ljus.
 */
import type { Game } from './game';
import { LIGHT_SECONDS } from './rules';
import type { Actor } from './types';

const has = (g: Game, a: Actor, id: string) => !!g.charOf(a)?.inventory.includes(id);

function take(g: Game, a: Actor, id: string): boolean {
  const inv = g.charOf(a)?.inventory;
  const i = inv?.indexOf(id) ?? -1;
  if (!inv || i < 0) return false;
  inv.splice(i, 1);
  return true;
}

/** Bär figuren ljus själv (inte elementarer och varelser)? */
const carriesLight = (g: Game, a: Actor) => !!g.charOf(a) && !a.elemental;

/**
 * Tänder ljus: först oljelyktan om det finns olja i den (eller lampolja att fylla på med), annars en
 * ny fackla ur packningen. Returnerar false om det inte finns något att tända.
 */
export function lightUp(g: Game, a: Actor): boolean {
  const ch = g.charOf(a);
  if (!ch || a.elemental) return false;
  if (a.light && a.light.left > 0) {
    a.torchOut = false;
    return true;
  }
  if (has(g, a, 'oljelykta')) {
    if ((ch.lanternOil ?? LIGHT_SECONDS.oljelykta) <= 0 && take(g, a, 'lampolja')) ch.lanternOil = LIGHT_SECONDS.lampolja;
    const oil = ch.lanternOil ?? LIGHT_SECONDS.oljelykta;
    if (oil > 0) {
      a.light = { kind: 'oljelykta', left: oil };
      a.torchOut = false;
      return true;
    }
  }
  if (take(g, a, 'fackla')) {
    a.light = { kind: 'fackla', left: LIGHT_SECONDS.fackla };
    a.torchOut = false;
    return true;
  }
  a.torchOut = true;
  return false;
}

/** Tänder eller släcker ljuset. Returnerar ett meddelande om det inte gick. */
export function toggleLight(g: Game, a: Actor): string | null {
  if (!a.torchOut) {
    a.torchOut = true;
    g.log(`${a.name} släcker ${a.light?.kind === 'oljelykta' ? 'oljelyktan' : 'facklan'}.`);
    return null;
  }
  if (!lightUp(g, a)) return `${a.name} har ingen fackla och ingen olja till lyktan.`;
  g.log(`${a.name} tänder ${a.light!.kind === 'oljelykta' ? 'oljelyktan' : 'en fackla'}.`);
  return null;
}

/** Ljuset brinner en stund. När det brinner ut tänds nästa fackla, om det finns någon. */
export function burnLight(g: Game, a: Actor, seconds: number) {
  if (!carriesLight(g, a) || a.torchOut) return;
  // En ny följeslagare tänder sin fackla första gången tiden går.
  if (!a.light || a.light.left <= 0) {
    if (!lightUp(g, a)) return;
  }
  if (!a.light) return;
  const ch = g.charOf(a)!;
  a.light.left -= seconds;
  if (a.light.kind === 'oljelykta') ch.lanternOil = Math.max(0, a.light.left);
  if (a.light.left > 0) return;
  const was = a.light.kind;
  a.light = undefined;
  if (lightUp(g, a)) g.log(`${a.name}s ${was === 'fackla' ? 'fackla brinner ut, och hen tänder' : 'lykta slocknar, och hen tänder'} ${a.light!.kind === 'oljelykta' ? 'oljelyktan' : 'en ny fackla'}.`);
  else g.log(`${a.name}s ${was === 'fackla' ? 'fackla brinner ut' : 'lykta slocknar'}, och hen har inget mer att tända.`);
}

/** Ser till att den som ska ha ljus har en fackla eller lykta tänd (nya spel och äldre sparningar). */
export function ensureLight(g: Game, a: Actor) {
  if (!carriesLight(g, a) || a.torchOut || (a.light && a.light.left > 0)) return;
  lightUp(g, a);
}

/** Text till statuspanelen. */
export function lightText(g: Game, a: Actor): string {
  if (!a.light || a.light.left <= 0) return a.torchOut ? (has(g, a, 'fackla') || has(g, a, 'oljelykta') ? 'släckt' : 'ingen fackla') : 'ingen fackla';
  const min = Math.ceil(a.light.left / 60);
  const left = min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`;
  return `${a.light.kind === 'oljelykta' ? 'Oljelykta' : 'Fackla'}${a.torchOut ? ' (släckt)' : ''}, ${left} kvar`;
}
