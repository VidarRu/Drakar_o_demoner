/**
 * Det som alla moduler med världskarta delar (Vidar, efter steg 8): stridskartorna för varje
 * terräng, generiska varelser och tabellerna för slumpmöten. Tabellerna är platshållare som byts
 * ut när riktiga tabeller finns. Besluten står i docs/regelbeslut.md under Världskartan.
 */
import type { MapDef } from '../engine/map';
import type { BattleTerrain } from '../engine/rules/travel';
import type { CreatureDef } from '../engine/types';
import type { BandDef } from './types';

// ------------------------------------------------------------------ varelser

/** Generiska varelser för slumpmötena. Finna dolda ting efter hur vaksamma de är (6–12). */
export const WILD_CREATURES: CreatureDef[] = [
  {
    id: 'vild_varg',
    name: 'Varg',
    sprite: 'varg',
    attrs: { STY: 11, STO: 7, FYS: 14, SMI: 16, INT: 2, PSY: 11, KAR: 5 },
    skills: { bett: 10, upptacka_fara: 17, spara: 16, smyga: 9, finna_dolda_ting: 12 },
    weapon: 'bett',
    naturalArmor: 1,
    move: 16,
    hostile: true,
    humanoid: false,
    sight: 6,
  },
  {
    id: 'vild_bjorn',
    name: 'Björn',
    sprite: 'bjorn',
    attrs: { STY: 23, STO: 23, FYS: 11, SMI: 11, INT: 2, PSY: 11, KAR: 5 },
    skills: { bett: 12, upptacka_fara: 5, spara: 13, finna_dolda_ting: 8 },
    weapon: 'bett',
    naturalArmor: 3,
    move: 12,
    hostile: true,
    humanoid: false,
    sight: 5,
  },
  {
    id: 'stratrovare',
    name: 'Stråtrövare',
    sprite: 'knekt',
    attrs: { STY: 12, STO: 12, FYS: 12, SMI: 12, INT: 10, PSY: 10, KAR: 9 },
    skills: { enhandssvard: 9, slagsmal: 6, upptacka_fara: 8, smyga: 7, finna_dolda_ting: 9 },
    weapon: 'kortsvard',
    armor: ['harnesk_lader'],
    move: 10,
    hostile: true,
    humanoid: true,
    folk: 'manniska',
    sight: 6,
    silver: '2T10',
  },
  {
    id: 'vild_svartalf',
    name: 'Svartalf',
    sprite: 'svartalf',
    attrs: { STY: 9, STO: 7, FYS: 11, SMI: 11, INT: 9, PSY: 11, KAR: 7 },
    skills: { enhandssvard: 4, slagsmal: 4, upptacka_fara: 9, smyga: 7, finna_dolda_ting: 9 },
    weapon: 'kortsvard',
    move: 10,
    hostile: true,
    humanoid: true,
    folk: 'svartalf',
    darkvision: true,
    sight: 6,
    silver: '2T6',
  },
];

// ------------------------------------------------------------------ slumpmöten

const band = (id: string, name: string, creature: string, count: string): BandDef => ({ id, name, members: [{ creature, count }] });

const WOLVES = band('slump_vargar', 'Vargflock', 'vild_varg', '1T3+1');
const BEAR = band('slump_bjorn', 'Björn', 'vild_bjorn', '1');
const ROBBERS = band('slump_stratrovare', 'Stråtrövare', 'stratrovare', '1T3+1');
const DARK_ELVES = band('slump_svartalfer', 'Svartalfer', 'vild_svartalf', '1T4+1');

/** Grupperna i slumptabellerna, så att de finns i registret BANDS. */
export const WILD_BANDS: BandDef[] = [WOLVES, BEAR, ROBBERS, DARK_ELVES];

/** En rad i en slumptabell: 1T6 från och med `from` till och med `to`. */
export interface EncounterRow {
  from: number;
  to: number;
  band: BandDef;
}

/**
 * Generiska slumptabeller per terräng (platshållare, Vidar). Ett slag per timme färd; ger det ett
 * möte slås 1T6 på tabellen för terrängen där gruppen står.
 */
export const ENCOUNTER_TABLES: Record<string, Record<BattleTerrain, EncounterRow[]>> = {
  vildmark: {
    slätt: [
      { from: 1, to: 3, band: ROBBERS },
      { from: 4, to: 5, band: WOLVES },
      { from: 6, to: 6, band: DARK_ELVES },
    ],
    'öppen skog': [
      { from: 1, to: 2, band: WOLVES },
      { from: 3, to: 4, band: ROBBERS },
      { from: 5, to: 5, band: BEAR },
      { from: 6, to: 6, band: DARK_ELVES },
    ],
    'tät skog': [
      { from: 1, to: 3, band: WOLVES },
      { from: 4, to: 5, band: BEAR },
      { from: 6, to: 6, band: DARK_ELVES },
    ],
    kullar: [
      { from: 1, to: 2, band: ROBBERS },
      { from: 3, to: 4, band: WOLVES },
      { from: 5, to: 6, band: DARK_ELVES },
    ],
    berg: [
      { from: 1, to: 3, band: DARK_ELVES },
      { from: 4, to: 5, band: WOLVES },
      { from: 6, to: 6, band: BEAR },
    ],
  },
};

// ------------------------------------------------------------------ stridskartor

/**
 * Stridskartorna (Vidar): en per terräng. Gruppen står i väster (@) och fienderna i öster (E).
 * Kartorna är tillfälliga: när striden är slut går gruppen ut genom kanten i väster (X) och
 * kommer tillbaka till världskartan där mötet började.
 */
const battle = (id: string, name: string, rows: string[]): MapDef => ({
  id,
  name,
  kind: 'strid',
  start: { char: '@', tile: '.' },
  foes: { char: 'E', tile: '.' },
  exits: { X: { tile: '.', name: 'Tillbaka till färden', to: 'tillbaka' } },
  habitats: ['överallt'],
  spawns: {},
  rows,
});

export const BATTLE_MAP_LIST: MapDef[] = [
  battle('strid_slatt', 'Grässlätten', [
    '........................',
    '........................',
    '.............T..........',
    'X.........E.............',
    'X.........E.............',
    'X.@........EE...........',
    'X.......................',
    'X...........E...........',
    'X..........E............',
    'X.......................',
    '.......~~...............',
    '......~~~~..............',
    '........................',
    '........................',
  ]),
  battle('strid_oppen_skog', 'Gles skog', [
    '...T.......T.......T....',
    '.T.....T.......T.....T..',
    '.....T.....T.......T....',
    'X.T.......T....T........',
    'X.......T.E...........T.',
    'X.@........EE.T.........',
    'X.....T...E.............',
    'X..........TE.........T.',
    'X..T.......E............',
    'X.......T....T.........T',
    '.T...........T.....T....',
    '.....T...T.........T....',
    '..T.........T...T.......',
    '.......T........T....T..',
  ]),
  battle('strid_tat_skog', 'Tät skog', [
    'TTTTTTTTTTTTTTTTTTTTTTTT',
    'TT.TT.TTT.TTTT.TTT.TTTTT',
    'T...T...T..TT...T...T.TT',
    'X.......TT......T......T',
    'X..T......ET.TT.......TT',
    'X.@...T....EE..........T',
    'X......TT.ETE.T........T',
    'X..T........T..........T',
    'X.....T..T.E......T....T',
    'T.TT....TTT..TT.....T..T',
    'TT...TT.TT....T..TT...TT',
    'TTT.TTTTT.TTTTTTT.TTT.TT',
    'TTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTT',
  ]),
  battle('strid_kullar', 'Kullarna', [
    '..........%%%...........',
    '.........%%%%%......%...',
    '..........%%%......%%%..',
    'X...................%...',
    'X........%E.............',
    'X.@.....%%%EE...........',
    'X........%E.............',
    'X.........E.E...........',
    'X..........,,,,,........',
    'X.....%%...,..,.........',
    '.....%%%%..,..,.....%%..',
    '......%%..,,..,,...%%%%.',
    '..........,....,....%%..',
    '........................',
  ]),
  battle('strid_berg', 'Bergspasset', [
    '%%%%%%%%%%%%%%%%%%%%%%%%',
    '%%%%%%%%%..%%%%%%%%%%%%%',
    '%%%%%.........%%%%..%%%%',
    'X.........%.........%%%%',
    'X.........E..........%%%',
    'X.@......%%EE.........%%',
    'X........%%E............',
    'X...........E.........%%',
    'X.......%..E.........%%%',
    '%%..........%%.......%%%',
    '%%%%......%%%%%.....%%%%',
    '%%%%%%%..%%%%%%%%..%%%%%',
    '%%%%%%%%%%%%%%%%%%%%%%%%',
    '%%%%%%%%%%%%%%%%%%%%%%%%',
  ]),
];

/** Stridskartan för varje terräng. */
export const BATTLE_MAPS: Record<BattleTerrain, string> = {
  slätt: 'strid_slatt',
  'öppen skog': 'strid_oppen_skog',
  'tät skog': 'strid_tat_skog',
  kullar: 'strid_kullar',
  berg: 'strid_berg',
};
