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
import { PROVFARD } from './provfard';
import { BATTLE_MAP_LIST, WILD_BANDS, WILD_CREATURES } from './vildmark';
import type { BandDef, BookDef, MagicItemDef, ModuleDef, RecruitDef } from './types';
import { NON_IRON_WEAPONS, WEAPONS } from '../data/weapons';
import { ARMOR, SHIELDS } from '../data/armor';
import { ITEMS } from '../data/equipment';

export type { BandDef, BookDef, DeedDef, Difficulty, ItemSpell, MagicItemDef, ModuleDef, QuestDef, RecruitDef } from './types';
export { CITY, type CityTeacher } from './mellanspel';
export { BATTLE_MAPS, ENCOUNTER_TABLES, type EncounterRow } from './vildmark';

/** Alla äventyrsmoduler. */
export const MODULE_LIST: ModuleDef[] = [SPELTEST, PROVFARD];

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

export const CREATURES = list<CreatureDef>([...WILD_CREATURES, ...MODULE_LIST.flatMap((m) => m.creatures)], 'Varelsen');
export const NPCS = list<NpcDef>(MODULE_LIST.flatMap((m) => m.npcs), 'Personen');
export const RECRUITS = list<RecruitDef>(MODULE_LIST.flatMap((m) => m.recruits), 'Följeslagaren');
export const MAPS = list<MapDef>([...BATTLE_MAP_LIST, ...MODULE_LIST.flatMap((m) => m.maps)], 'Kartan');
/** Fiendegrupperna på världskartorna och i slumptabellerna. */
export const BANDS = list<BandDef>([...WILD_BANDS, ...MODULE_LIST.flatMap((m) => m.bands ?? [])], 'Fiendegruppen');
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

/** Magiska föremål ur alla moduler (Bok III s. 43–44). */
export const MAGIC_ITEMS = list<MagicItemDef>(MODULE_LIST.flatMap((m) => m.magicItems ?? []), 'Det magiska föremålet');

/**
 * De magiska föremålen läggs in i regeldatans register med samma värden som föremålet de bygger
 * på, så att de fungerar som vanliga vapen, rustningar och föremål: vikt, pris, järnregeln, att ta
 * dem i handen och att tappa dem. Namnet är utseendet; vad föremålet är visas när det är analyserat.
 */
for (const m of Object.values(MAGIC_ITEMS)) {
  if (m.base && WEAPONS[m.base]) {
    WEAPONS[m.id] = { ...WEAPONS[m.base], id: m.id, name: m.looks };
    if (NON_IRON_WEAPONS.has(m.base)) NON_IRON_WEAPONS.add(m.id);
  } else if (m.base && ARMOR[m.base]) ARMOR[m.id] = { ...ARMOR[m.base], id: m.id, name: m.looks };
  else if (m.base && SHIELDS[m.base]) SHIELDS[m.id] = { ...SHIELDS[m.base], id: m.id, name: m.looks };
  else ITEMS[m.id] = { id: m.id, name: m.looks, category: 'diverse', weight: m.weight ?? 0, price: m.price ?? 0 };
}

