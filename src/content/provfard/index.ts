/**
 * Provfärden: en liten modul för att pröva världskartan (Vidar, efter steg 8). Den är en
 * platshållare tills Vidars första äventyr är ombyggt, och ingår inte i kampanjen. Den har en
 * världskarta med alla terränger, en by och en grotta som mötesplatser, och tre fiendegrupper.
 */
import type { MapDef } from '../../engine/map';
import type { CreatureDef } from '../../engine/types';
import type { BandDef, ModuleDef, QuestDef } from '../types';

const WORLD = 'provfard_karta';

const creatures: CreatureDef[] = [
  {
    id: 'grottvarg',
    name: 'Grottvargen',
    sprite: 'varg',
    attrs: { STY: 16, STO: 12, FYS: 15, SMI: 16, INT: 3, PSY: 12, KAR: 6 },
    skills: { bett: 13, upptacka_fara: 17, spara: 16, smyga: 10, finna_dolda_ting: 12 },
    weapon: 'bett',
    naturalArmor: 2,
    move: 16,
    hostile: true,
    humanoid: false,
    sight: 6,
    leader: true,
    deathFlag: 'grottvarg_dod',
  },
];

const bands: BandDef[] = [
  { id: 'provfard_vargar', name: 'Vargflock', members: [{ creature: 'vild_varg', count: '3' }], wander: 4 },
  { id: 'provfard_rovare', name: 'Stråtrövare', members: [{ creature: 'stratrovare', count: '1T3+1' }], wander: 3 },
  { id: 'provfard_bjorn', name: 'Björn', members: [{ creature: 'vild_bjorn', count: '1' }], wander: 4 },
];

const maps: MapDef[] = [
  {
    id: WORLD,
    name: 'Ödemarken',
    kind: 'värld',
    start: { char: '@', tile: ',' },
    habitats: ['överallt', 'skog', 'ängar'],
    exits: { X: { tile: ',', name: 'Vägen västerut' } },
    places: {
      B: { tile: ',', map: 'provfard_hagby', name: 'Hagby', icon: 'ikon_by' },
      G: { tile: 'M', map: 'provfard_grottan', name: 'Varggrottan', icon: 'ikon_grotta' },
    },
    spawns: {
      w: { tile: 'F', band: 'provfard_vargar' },
      r: { tile: 'h', band: 'provfard_rovare' },
      s: { tile: 'f', band: 'provfard_bjorn' },
    },
    rows: [
      '......................~~hhMMMMMMMMMMMMMM',
      '.....................h~~hhMMMMMMMMMMMMMM',
      '........fffff.........h~~hMMMMMMMMMMMMMM',
      '.....fffffffffff......h~~hMMMMGMMMMMMMMM',
      '...ffffffFFFffffff....hh~~hMMM,MMMMMMMMM',
      '..ffffFFFFFFFFFffff....h~~hhMM,MMMMMMMMM',
      '.ffffFFFFFFFFFFFffff....~~hhhh,MMMMMMMMh',
      '.ffffFFFFwFFFFFFffff....~~hhhh,hhhhhhhhh',
      '.ffffFFFFFFFFFFFffff....~~.hhh,hhhhhhhhh',
      '..ffffFFFFFFFFFffff.....~~...h,hhhhhhhhh',
      '...ffffffFFFffffff.....~~.....,.........',
      '.....fffffffffff.......~~.....,.........',
      '........fffff.........~~......,.........',
      '......................~~......,.........',
      'X,@,,,,,,,,,,,,,,,,,,==,,,,,,,,,,,,,,B..',
      '.....................~~.................',
      '....................~~..................',
      '....hhhhh...........~~..................',
      '..hhhhhhhhh.........~~......fffffsf.....',
      '..hhhhrhhhh.........~~.....fffffffff....',
      '..hhhhhhhhh.........~~....fffffffffff...',
      '..hhhhhhhhh.........vv....fffffffffff...',
      '..hhhhhhhhh..........~~...fffffffffff...',
      '....hhhhh............~~....fffffffff....',
      '.....................~~.....fffffff.....',
      '......................~~................',
    ],
  },
  {
    id: 'provfard_hagby',
    name: 'Hagby',
    music: 'by',
    start: { char: '@', tile: ',' },
    habitats: ['överallt', 'ängar', 'åkerkanter'],
    exits: { X: { tile: ',', name: 'Ut på färden', to: WORLD } },
    spawns: {},
    rows: [
      'TTTTTTTTTTTTTTTTTTTT',
      'T..................T',
      'T.#####....#####...T',
      'T.#___#....#___#...T',
      'T.#___#....#___#...T',
      'T.##+##....##+##...T',
      'T...,,,,,,,,,,.....T',
      'X,,,,,,@......,....T',
      'T.........#####,...T',
      'T.........#___+,...T',
      'T.........#####....T',
      'TTTTTTTTTTTTTTTTTTTT',
    ],
  },
  {
    id: 'provfard_grottan',
    name: 'Varggrottan',
    start: { char: '@', tile: ':' },
    habitats: ['grottor'],
    exits: { X: { tile: ':', name: 'Ut ur grottan', to: WORLD } },
    spawns: {
      w: { tile: ':', creature: 'vild_varg' },
      L: { tile: ':', creature: 'grottvarg' },
    },
    rows: [
      '%%%%%%%%%%%%%%%%%%%%%%',
      '%%%%::::%%%%%%::::%%%%',
      '%%%::::::%%%%::::::%%%',
      '%%::w:::::::::::L:::%%',
      '%%:::::%%%%%%:::::::%%',
      '%%%::::%%%%%%%::w::%%%',
      '%%%%::%%%%%%%%%%::%%%%',
      '%%%%::%%%%%%%%%%%%%%%%',
      '%%%:::%%%%%%%%%%%%%%%%',
      '%%%:@:%%%%%%%%%%%%%%%%',
      '%%%:X:%%%%%%%%%%%%%%%%',
      '%%%%%%%%%%%%%%%%%%%%%%',
    ],
  },
];

const quests: QuestDef[] = [
  {
    id: 'provfard_grottvargen',
    name: 'Grottvargen',
    main: true,
    description: 'En stor varg har sitt gryt i en grotta uppe i bergen i nordost. Döda den.',
    done: 'grottvarg_dod',
    bonusEp: 1,
  },
];

export const PROVFARD: ModuleDef = {
  id: 'provfard',
  name: 'Provfärden',
  description: 'En kort färd genom ödemarken för att pröva världskartan: skog, kullar, berg, en flod med bro och vadställe, en by och en grotta.',
  difficulty: 'lätt',
  campaign: false,
  start: WORLD,
  maps,
  creatures,
  npcs: [],
  recruits: [],
  quests,
  bands,
  flagNotes: {},
  epilogue: ['Grottvargen är död, och vägen genom ödemarken blir lite tryggare att gå.'],
  travel: { x: 62, y: 40, icon: 'ikon_grotta' },
};
