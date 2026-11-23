/**
 * Spelinnehåll. Allt här är data – nya vapen, varelser, yrken, personer och kartor läggs till
 * utan att motorn behöver ändras. Varje äventyrsmodul ligger i en egen mapp (se types.ts).
 *
 * Spelmotorn slår ihop modulernas varelser, personer, följeslagare och kartor i gemensamma
 * register, så att en följeslagare från en modul fungerar i nästa. Därför måste id:n vara unika
 * över alla moduler.
 */
import type { Intent } from '../engine/intents';
import type { MapDef } from '../engine/map';
import type { CreatureDef, NaturalWeaponDef, NpcDef } from '../engine/types';
import { COMMON_BOOKS } from './mellanspel';
import { SPELTEST } from './speltest';
import type { BookDef, ModuleDef, RecruitDef } from './types';

export type { BookDef, DeedDef, Difficulty, ModuleDef, QuestDef, RecruitDef } from './types';
export { CITY, type CityTeacher } from './mellanspel';

/** Alla äventyrsmoduler. */
export const MODULE_LIST: ModuleDef[] = [SPELTEST];

const list = <T extends { id: string }>(items: T[], what: string): Record<string, T> => {
  const out: Record<string, T> = {};
  for (const i of items) {
    if (out[i.id]) throw new Error(`${what} "${i.id}" finns i flera moduler`);
    out[i.id] = i;
  }
  return out;
};

export const MODULES = list(MODULE_LIST, 'Modulen');

/**
 * Naturliga vapen och obeväpnade anfall. Riktiga vapen, rustningar och sköldar finns i
 * regeldatan (src/data) och refereras med sina id.
 */
export const NATURAL_WEAPONS = list<NaturalWeaponDef>(
  [
    { id: 'nave', name: 'Knytnäve', damage: '1T3', skill: 'slagsmal', useDamageBonus: true },
    { id: 'bett', name: 'Bett', damage: '1T8', skill: 'bett', useDamageBonus: false },
  ],
  'Vapnet',
);

/** Figurer som spelaren kan välja åt rollpersonen (Vidar). */
export const PLAYER_SPRITES: { id: string; name: string }[] = [
  { id: 'krigare', name: 'Krigare' },
  { id: 'krigarinna', name: 'Krigarinna' },
  { id: 'jagare', name: 'Jägare' },
  { id: 'tjuv', name: 'Tjuv' },
  { id: 'magiker', name: 'Magiker' },
  { id: 'alv', name: 'Alv' },
  { id: 'dvarg', name: 'Dvärg' },
];

/** Förvald figur för rollpersonens yrke, när spelaren inte har valt någon. */
export const PROFESSION_SPRITES: Record<string, string> = {
  krigare: 'krigare',
  riddare: 'krigare',
  munk: 'krigare',
  utbygdsjagare: 'jagare',
  sjofarare: 'jagare',
  helare: 'jagare',
  magiker: 'magiker',
  lard_man: 'jagare',
  tjuv: 'tjuv',
  lonnmordare: 'tjuv',
  bard: 'tjuv',
};

export const CREATURES = list<CreatureDef>(MODULE_LIST.flatMap((m) => m.creatures), 'Varelsen');
export const NPCS = list<NpcDef>(MODULE_LIST.flatMap((m) => m.npcs), 'Personen');
export const RECRUITS = list<RecruitDef>(MODULE_LIST.flatMap((m) => m.recruits), 'Följeslagaren');
export const MAPS = list<MapDef>(MODULE_LIST.flatMap((m) => m.maps), 'Kartan');
/** Böcker och magiska kodexar som går att studera (steg 8). De ligger i packningen med sitt id. */
export const BOOKS = list<BookDef>([...COMMON_BOOKS, ...MODULE_LIST.flatMap((m) => m.books ?? [])], 'Boken');

/** Modulernas egna samtalsval. */
export const MODULE_INTENTS: Record<string, Intent> = {};
for (const m of MODULE_LIST) {
  for (const [id, intent] of Object.entries(m.intents ?? {})) {
    if (MODULE_INTENTS[id]) throw new Error(`Samtalsvalet "${id}" finns i flera moduler`);
    MODULE_INTENTS[id] = intent;
  }
}

/** Modulen som en karta hör till. */
export const MAP_MODULE: Record<string, string> = Object.fromEntries(MODULE_LIST.flatMap((m) => m.maps.map((map) => [map.id, m.id])));
