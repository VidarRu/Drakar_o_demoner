/**
 * Spelinnehåll. Allt här är data – nya vapen, varelser, yrken, personer och kartor
 * läggs till här utan att motorn behöver ändras.
 *
 * OBS: värdena är provisoriska och ska stämmas av mot regelboken efterhand.
 */
import type { CreatureDef, NaturalWeaponDef, NpcDef } from '../engine/types';
import type { MapDef } from '../engine/map';

const list = <T extends { id: string }>(items: T[]): Record<string, T> =>
  Object.fromEntries(items.map((i) => [i.id, i]));

/**
 * Naturliga vapen och obeväpnade anfall. Riktiga vapen, rustningar och sköldar finns i
 * regeldatan (src/data) och refereras med sina id.
 */
export const NATURAL_WEAPONS = list<NaturalWeaponDef>([
  { id: 'nave', name: 'Knytnäve', damage: '1T3', skill: 'slagsmal', useDamageBonus: true },
  { id: 'bett', name: 'Bett', damage: '1T8', skill: 'bett', useDamageBonus: false },
]);

/** Figurer för rollpersonens yrke, tills det finns egna för alla elva yrken. */
export const PROFESSION_SPRITES: Record<string, string> = {
  krigare: 'krigare',
  riddare: 'krigare',
  munk: 'krigare',
  utbygdsjagare: 'jagare',
  sjofarare: 'jagare',
  helare: 'jagare',
  magiker: 'jagare',
  lard_man: 'jagare',
  tjuv: 'tjuv',
  lonnmordare: 'tjuv',
  bard: 'tjuv',
};

const human = { STY: 11, STO: 13, FYS: 11, SMI: 11, INT: 11, PSY: 11, KAR: 11 };

/** Varelser i äventyret. Värdena följer Bok II; KP räknas fram ur STO och FYS. */
export const CREATURES = list<CreatureDef>([
  {
    id: 'varg',
    name: 'Varg',
    sprite: 'varg',
    attrs: { STY: 11, STO: 7, FYS: 14, SMI: 16, INT: 2, PSY: 11, KAR: 5 },
    skills: { bett: 10, upptacka_fara: 17, spara: 16, smyga: 9 },
    weapon: 'bett',
    naturalArmor: 1,
    move: 16,
    hostile: true,
    humanoid: false,
    sight: 6,
  },
  {
    id: 'svartalf',
    name: 'Svartalf',
    sprite: 'svartalf',
    attrs: { STY: 9, STO: 7, FYS: 11, SMI: 11, INT: 9, PSY: 11, KAR: 7 },
    skills: { enhandssvard: 4, slagsmal: 4, upptacka_fara: 9, smyga: 7 },
    weapon: 'kortsvard',
    move: 10,
    hostile: true,
    humanoid: true,
    darkvision: true,
    sight: 6,
    silver: '2T6',
  },
  {
    id: 'svartalf_skytt',
    name: 'Svartalfsskytt',
    sprite: 'svartalf',
    attrs: { STY: 9, STO: 7, FYS: 11, SMI: 12, INT: 9, PSY: 11, KAR: 7 },
    skills: { bagar: 8, dolkar: 5, upptacka_fara: 10, smyga: 8 },
    weapon: 'dolk',
    ranged: { weapon: 'kortbage', ammo: 8 },
    move: 10,
    hostile: true,
    humanoid: true,
    darkvision: true,
    sight: 8,
    silver: '2T6',
  },
  {
    id: 'svartalfshovding',
    name: 'Svartalfshövdingen Grukk',
    sprite: 'hovding',
    attrs: { STY: 14, STO: 11, FYS: 13, SMI: 11, INT: 10, PSY: 11, KAR: 8 },
    skills: { enhandssvard: 11, skoldar: 9, upptacka_fara: 9 },
    weapon: 'bredsvard',
    armor: ['harnesk_nitlader', 'nitladerhuva'],
    shield: 'vanlig_skold',
    move: 10,
    hostile: true,
    humanoid: true,
    darkvision: true,
    leader: true,
    // En hövding som slåss till slutet: boken undantar hjältar och ledare av det slaget från moralen.
    noMorale: true,
    sight: 7,
    silver: '6T6+20',
    deathFlag: 'hovding_dod',
  },
  {
    id: 'vardshusvard',
    name: 'Värdshusvärden Bertil',
    sprite: 'vard',
    attrs: { ...human, STO: 15 },
    skills: { enhandskross: 9, kopsla: 12 },
    weapon: 'klubba',
    move: 10,
    hostile: false,
    humanoid: true,
    npc: 'vardshusvard',
  },
  {
    id: 'smed',
    name: 'Smeden Ylva',
    sprite: 'smed',
    attrs: { ...human, STY: 15 },
    skills: { enhandskross: 12, 'hantverk:smide': 16, kopsla: 10 },
    weapon: 'klubba',
    armor: ['harnesk_lader'],
    move: 10,
    hostile: false,
    humanoid: true,
    npc: 'smed',
  },
  {
    id: 'gumma',
    name: 'Kloka gumman Asta',
    sprite: 'gumma',
    attrs: { ...human, STY: 7, PSY: 16 },
    skills: { dolkar: 6, lakekonst: 15, ortkunskap: 15, drogkunskap: 12, kopsla: 13 },
    weapon: 'dolk',
    move: 9,
    hostile: false,
    humanoid: true,
    npc: 'gumma',
  },
]);

export const NPCS = list<NpcDef>([
  {
    id: 'vardshusvard',
    persona:
      'Bertil är en rund, pratglad värdshusvärd i byn Gråvad. Han är godmodig men snål, orolig för sina gäster och sin handel, och pratar gärna om mat och öl.',
    knowledge:
      'Svartalfer har slagit sig ner i en grotta öster om byn, längs stigen genom skogen. Deras hövding Grukk leder plundringståg mot resande. Vargar stryker runt i skogen. Bertil erbjuder 500 silvermynt till den som gör slut på hövdingen. En plats i sovsalen kostar 10 silvermynt per natt, och man kan hyra den en hel vecka för att vila upp sig och träna. Bertil säljer mat, kläder och utrustning för resan. Smeden Ylva säljer vapen, rustningar och sköldar, och kloka gumman Asta vid dammen sköter om sår och säljer örter.',
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
    shop: { goods: ['mat', 'äventyr', 'behållare', 'kläder', 'diverse', 'verktyg'] },
    intents: ['uppdrag_anta', 'overtala_beloning', 'uppdrag_beloning', 'overnatta', 'vila_vecka', 'handla', 'anfall'],
  },
  {
    id: 'smed',
    persona:
      'Ylva är byns smed: fåordig, rak och stolt över sitt hantverk. Hon har föga tålamod med skrävlare men respekterar den som slåss för byn.',
    knowledge:
      'Hon säljer vapen, pilar, rustningar och sköldar och köper begagnade vapen för halva priset. Hon har en färdig ringbrynjeskjorta till salu för 1 500 silvermynt. Hon lagar slitna vapen, sköldar och rustningar för en tjugondel av priset per skadat ställe. Svartalfernas hövding bär ett bredsvärd och sköld och är farligare än sina underhuggare. Grottan ligger österut längs stigen.',
    greeting: 'Hm. Behöver du något, eller står du bara i vägen för värmen?',
    topics: [
      {
        text: 'Vad har du till salu?',
        reply: 'En ringbrynjeskjorta, färdig i går. Femtonhundra silver. Den håller för mer än din läderlapp gör.',
      },
      {
        text: 'Vad vet du om svartalferna?',
        reply: 'Småttingarna är fega en och en. Hövdingen är det inte. Gå inte in dit sårad.',
      },
    ],
    shop: { goods: ['närstridsvapen', 'avståndsvapen', 'rustningar', 'sköldar'] },
    intents: ['kop_ringbrynja', 'laga_utrustning', 'handla', 'anfall'],
  },
  {
    id: 'gumma',
    persona:
      'Asta är byns kloka gumma: gammal, skarpögd och lite kuslig. Hon talar i gåtor och ordspråk men menar väl.',
    knowledge:
      'Hon kan förbinda sår för 5 silvermynt, och vårda sår och infektioner med Läkekonst en gång om dagen för samma pris. Hon säljer läkeörter och andra droger som hon har plockat i skogen; vilka hon har inne skiftar från dag till dag. Hon vet att vargarna i skogen flyr ogärna och att svartalferna fruktar eld och dagsljus.',
    greeting: 'Jaså, en vandrare. Jag såg dig i teet i morse. Du blöder snart, om du inte redan gör det.',
    topics: [
      {
        text: 'Kan du berätta något om skogen?',
        reply: 'Skogen minns allt. Vargarna är hungriga i år. Håll dig på stigen, så räcker det med att vara rädd.',
      },
    ],
    shop: { goods: ['läkedroger', 'droger'] },
    intents: ['forbind', 'vard', 'handla', 'anfall'],
  },
]);

/** Anteckningar som ges till språkmodellen beroende på vad som hänt i spelet. */
export const FLAG_NOTES: Record<string, string> = {
  uppdrag_antaget: 'Spelaren har lovat värdshusvärden att döda svartalfshövdingen Grukk.',
  hovding_dod: 'Svartalfshövdingen Grukk är död – spelaren dödade honom.',
  uppdrag_klart: 'Spelaren har fått sin belöning för att ha dödat hövdingen.',
  hogre_beloning: 'Värdshusvärden har gått med på en högre belöning (750 silvermynt).',
  kopt_ringbrynja: 'Spelaren har köpt smedens ringbrynjeskjorta.',
};

export const MAPS = list<MapDef>([
  {
    id: 'gravad',
    name: 'Gråvad',
    start: { char: '@', tile: ',' },
    habitats: ['överallt', 'skog', 'ängar', 'åkerkanter', 'snårskog'],
    spawns: {
      i: { tile: '_', creature: 'vardshusvard' },
      s: { tile: '_', creature: 'smed' },
      o: { tile: '.', creature: 'gumma' },
      w: { tile: '.', creature: 'varg' },
      g: { tile: ':', creature: 'svartalf' },
      b: { tile: ':', creature: 'svartalf_skytt' },
      C: { tile: ':', creature: 'svartalfshovding' },
    },
    rows: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'T..........T....TT......T...%%%%%%%%%%%%%%%T',
      'T.#######.......T....T......%%::::%%%%:::%%T',
      'T.#_____#..........TT....T..%:::g::%%::::%%T',
      'T.#_i___#....T..........T...%::::::::b:C:%%T',
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
