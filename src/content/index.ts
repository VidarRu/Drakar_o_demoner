/**
 * Spelinnehåll. Allt här är data – nya vapen, varelser, yrken, personer och kartor
 * läggs till här utan att motorn behöver ändras.
 *
 * OBS: värdena är provisoriska och ska stämmas av mot regelboken efterhand.
 */
import type { ArmorDef, CreatureDef, NpcDef, ProfessionDef, WeaponDef } from '../engine/types';
import type { MapDef } from '../engine/map';

const list = <T extends { id: string }>(items: T[]): Record<string, T> =>
  Object.fromEntries(items.map((i) => [i.id, i]));

export const WEAPONS = list<WeaponDef>([
  { id: 'bredsvard', name: 'Bredsvärd', skill: 'Svärd', damage: '1T8', useDamageBonus: true },
  { id: 'kortsvard', name: 'Kortsvärd', skill: 'Svärd', damage: '1T6', useDamageBonus: true },
  { id: 'dolk', name: 'Dolk', skill: 'Dolk', damage: '1T4+1', useDamageBonus: true },
  { id: 'spjut', name: 'Spjut', skill: 'Spjut', damage: '1T8', useDamageBonus: true },
  { id: 'klubba', name: 'Klubba', skill: 'Klubba', damage: '1T6', useDamageBonus: true },
  { id: 'bett', name: 'Bett', skill: 'Bett', damage: '1T6', useDamageBonus: false },
]);

export const ARMORS = list<ArmorDef>([
  { id: 'lader', name: 'Läderrustning', abs: 1 },
  { id: 'nitlader', name: 'Nitläder', abs: 2 },
  { id: 'ringbrynja', name: 'Ringbrynja', abs: 4 },
  { id: 'pals', name: 'Päls', abs: 1 },
]);

export const PROFESSIONS = list<ProfessionDef>([
  {
    id: 'krigare',
    name: 'Krigare',
    desc: 'Van vid svärd och sköld. Tål stryk och delar ut det.',
    sprite: 'krigare',
    skills: { Svärd: 13, Sköld: 11, Övertala: 6, 'Upptäcka fara': 8 },
    weapon: 'bredsvard',
    armor: 'nitlader',
    shield: true,
    silver: '2T6',
  },
  {
    id: 'jagare',
    name: 'Jägare',
    desc: 'Hemma i skog och mark, snabb med spjutet och svår att överraska.',
    sprite: 'jagare',
    skills: { Spjut: 13, Övertala: 7, 'Upptäcka fara': 13 },
    weapon: 'spjut',
    armor: 'lader',
    silver: '3T6',
  },
  {
    id: 'tjuv',
    name: 'Tjuv',
    desc: 'Kvick i både tanke och tunga. Dolken sitter löst.',
    sprite: 'tjuv',
    skills: { Dolk: 13, Övertala: 13, 'Upptäcka fara': 10 },
    weapon: 'dolk',
    armor: 'lader',
    silver: '5T6',
  },
]);

const human = { STY: 11, STO: 11, FYS: 11, SMI: 10, INT: 11, PSY: 11, KAR: 11 };

export const CREATURES = list<CreatureDef>([
  {
    id: 'varg',
    name: 'Varg',
    sprite: 'varg',
    attrs: { STY: 10, STO: 8, FYS: 11, SMI: 13, INT: 4, PSY: 8, KAR: 5 },
    kp: 8,
    skills: { Bett: 9 },
    weapon: 'bett',
    armor: 'pals',
    move: 7,
    hostile: true,
    sight: 6,
  },
  {
    id: 'svartalf',
    name: 'Svartalf',
    sprite: 'svartalf',
    attrs: { STY: 9, STO: 7, FYS: 10, SMI: 12, INT: 9, PSY: 8, KAR: 6 },
    kp: 7,
    skills: { Svärd: 8 },
    weapon: 'kortsvard',
    move: 5,
    hostile: true,
    sight: 6,
    silver: '2T6',
  },
  {
    id: 'svartalfshovding',
    name: 'Svartalfshövdingen Grukk',
    sprite: 'hovding',
    attrs: { STY: 14, STO: 11, FYS: 13, SMI: 11, INT: 10, PSY: 11, KAR: 8 },
    kp: 13,
    skills: { Svärd: 11, Sköld: 9 },
    weapon: 'bredsvard',
    armor: 'nitlader',
    shield: true,
    move: 5,
    hostile: true,
    sight: 7,
    silver: '6T6+20',
    deathFlag: 'hovding_dod',
  },
  {
    id: 'vardshusvard',
    name: 'Värdshusvärden Bertil',
    sprite: 'vard',
    attrs: { ...human, STO: 14 },
    skills: { Klubba: 9 },
    weapon: 'klubba',
    move: 5,
    hostile: false,
    npc: 'vardshusvard',
  },
  {
    id: 'smed',
    name: 'Smeden Ylva',
    sprite: 'smed',
    attrs: { ...human, STY: 15 },
    skills: { Klubba: 12 },
    weapon: 'klubba',
    armor: 'lader',
    move: 5,
    hostile: false,
    npc: 'smed',
  },
  {
    id: 'gumma',
    name: 'Kloka gumman Asta',
    sprite: 'gumma',
    attrs: { ...human, STY: 7, PSY: 16 },
    skills: { Dolk: 6 },
    weapon: 'dolk',
    move: 4,
    hostile: false,
    npc: 'gumma',
  },
]);

export const NPCS = list<NpcDef>([
  {
    id: 'vardshusvard',
    persona:
      'Bertil är en rund, pratglad värdshusvärd i byn Gråvad. Han är godmodig men snål, orolig för sina gäster och sin handel, och pratar gärna om mat och öl.',
    knowledge:
      'Svartalfer har slagit sig ner i en grotta öster om byn, längs stigen genom skogen. Deras hövding Grukk leder plundringståg mot resande. Vargar stryker runt i skogen. Bertil erbjuder 60 silvermynt till den som gör slut på hövdingen. Ett nattlogi kostar 5 silvermynt. Smeden Ylva säljer rustningar och kloka gumman Asta vid dammen sköter om sår.',
    greeting: 'Välkommen till Gyllene Galten, främling! Du ser ut som någon som kan hantera ett vapen.',
    topics: [
      {
        text: 'Vad är det som oroar byn?',
        reply:
          'Svartalfer! De har krupit in i grottan österut, bortom skogen. Deras hövding Grukk plundrar alla som tar stigen. Och vargarna har blivit djärvare.',
      },
      {
        text: 'Berätta om byn.',
        reply:
          'Gråvad är inte mycket för världen, men Ylva i smedjan kan sitt hantverk och gumman Asta nere vid dammen lappar ihop den som fått stryk.',
      },
    ],
    intents: ['uppdrag_anta', 'overtala_beloning', 'uppdrag_beloning', 'overnatta', 'anfall'],
  },
  {
    id: 'smed',
    persona:
      'Ylva är byns smed: fåordig, rak och stolt över sitt hantverk. Hon har föga tålamod med skrävlare men respekterar den som slåss för byn.',
    knowledge:
      'Hon har en färdig ringbrynja till salu för 40 silvermynt. Svartalfernas hövding bär ett bredsvärd och sköld och är farligare än sina underhuggare. Grottan ligger österut längs stigen.',
    greeting: 'Hm. Behöver du något, eller står du bara i vägen för värmen?',
    topics: [
      {
        text: 'Vad har du till salu?',
        reply: 'En ringbrynja, färdig i går. Fyrtio silver. Den håller för mer än din läderlapp gör.',
      },
      {
        text: 'Vad vet du om svartalferna?',
        reply: 'Småttingarna är fega en och en. Hövdingen är det inte. Gå inte in dit sårad.',
      },
    ],
    intents: ['kop_ringbrynja', 'anfall'],
  },
  {
    id: 'gumma',
    persona:
      'Asta är byns kloka gumma: gammal, skarpögd och lite kuslig. Hon talar i gåtor och ordspråk men menar väl.',
    knowledge:
      'Hon kan förbinda sår för 2 silvermynt. Hon vet att vargarna i skogen flyr ogärna och att svartalferna fruktar eld och dagsljus.',
    greeting: 'Jaså, en vandrare. Jag såg dig i teet i morse. Du blöder snart, om du inte redan gör det.',
    topics: [
      {
        text: 'Kan du berätta något om skogen?',
        reply: 'Skogen minns allt. Vargarna är hungriga i år. Håll dig på stigen, så räcker det med att vara rädd.',
      },
    ],
    intents: ['forbind', 'anfall'],
  },
]);

/** Anteckningar som ges till språkmodellen beroende på vad som hänt i spelet. */
export const FLAG_NOTES: Record<string, string> = {
  uppdrag_antaget: 'Spelaren har lovat värdshusvärden att döda svartalfshövdingen Grukk.',
  hovding_dod: 'Svartalfshövdingen Grukk är död – spelaren dödade honom.',
  uppdrag_klart: 'Spelaren har fått sin belöning för att ha dödat hövdingen.',
  hogre_beloning: 'Värdshusvärden har gått med på en högre belöning (90 silvermynt).',
  kopt_ringbrynja: 'Spelaren har köpt smedens ringbrynja.',
};

export const MAPS = list<MapDef>([
  {
    id: 'gravad',
    name: 'Gråvad',
    start: { char: '@', tile: ',' },
    spawns: {
      i: { tile: '_', creature: 'vardshusvard' },
      s: { tile: '_', creature: 'smed' },
      o: { tile: '.', creature: 'gumma' },
      w: { tile: '.', creature: 'varg' },
      g: { tile: ':', creature: 'svartalf' },
      C: { tile: ':', creature: 'svartalfshovding' },
    },
    rows: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'T..........T....TT......T...%%%%%%%%%%%%%%%T',
      'T.#######.......T....T......%%::::%%%%:::%%T',
      'T.#_____#..........TT....T..%:::g::%%::::%%T',
      'T.#_i___#....T..........T...%::::::::g:C:%%T',
      'T.#_____#.........T.........%%::::%%%::::%%T',
      'T.###+###......T......w..T..%%%:%%%%%%%%%%%T',
      'T....,..............T.......%%%:%%%%%%%%%%%T',
      'T....,....####.........T....%%::%%%%%%%%%%%T',
      'T....,....#__#...T..........%:::g%%%%%%%%%%T',
      'T....,,,,,+s_#........T.....%::::%%%%%%%%%%T',
      'T....,....####....T......T..%%:%%%%%%%%%%%%T',
      'T....@,,,,,,,,,,,,,,,,,,,,,,,,:%%%%%%%%%%%%T',
      'T....,.......T.......,...T..%%%%%%%%%%%%%%%T',
      'T....,..~~~.......T..,......T...T....T.....T',
      'T..o.,.~~~~~....T....,..w......T...T.......T',
      'T....,..~~~..........,.......T.......T.....T',
      'T.........T....T.....,,,,,..T...w....T.....T',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    ],
  },
]);
