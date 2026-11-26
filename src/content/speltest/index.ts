/**
 * Speltestmodulen: byn Gråvad med grottan österut. Den är en övningsmodul som inte ingår i
 * kampanjen, och har bara en mötesplatskarta och ingen världskarta (Vidar, steg 8).
 *
 * OBS: värdena är provisoriska och ska stämmas av mot regelboken efterhand.
 */
import type { CreatureDef, NpcDef } from '../../engine/types';
import type { MapDef } from '../../engine/map';
import type { Intent } from '../../engine/intents';
import { finalize, newDraft, type Draft } from '../../engine/creation';
import { ARMOR } from '../../data/armor';
import type { Character } from '../../engine/types';
import type { BookDef, DeedDef, MagicItemDef, ModuleDef, QuestDef, RecruitDef, SpellSceneDef } from '../types';

const human = { STY: 11, STO: 13, FYS: 11, SMI: 11, INT: 11, PSY: 11, KAR: 11 };

/** Varelser i äventyret. Värdena följer Bok II; KP räknas fram ur STO och FYS. */
const creatures: CreatureDef[] = [
  {
    id: 'varg',
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
    id: 'svartalf',
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
  {
    id: 'svartalf_skytt',
    name: 'Svartalfsskytt',
    sprite: 'svartalf',
    attrs: { STY: 9, STO: 7, FYS: 11, SMI: 12, INT: 9, PSY: 11, KAR: 7 },
    skills: { bagar: 8, dolkar: 5, upptacka_fara: 10, smyga: 8, finna_dolda_ting: 10 },
    weapon: 'dolk',
    ranged: { weapon: 'kortbage', ammo: 8 },
    move: 10,
    hostile: true,
    humanoid: true,
    folk: 'svartalf',
    darkvision: true,
    sight: 8,
    silver: '2T6',
  },
  {
    id: 'svartalfshovding',
    name: 'Svartalfshövdingen Grukk',
    sprite: 'hovding',
    attrs: { STY: 14, STO: 11, FYS: 13, SMI: 11, INT: 10, PSY: 11, KAR: 8 },
    skills: { enhandssvard: 11, skoldar: 9, upptacka_fara: 9, finna_dolda_ting: 9 },
    weapon: 'grukks_bredsvard',
    armor: ['harnesk_nitlader', 'nitladerhuva'],
    shield: 'vanlig_skold',
    move: 10,
    hostile: true,
    humanoid: true,
    folk: 'svartalf',
    darkvision: true,
    leader: true,
    // En hövding som slåss till slutet: boken undantar hjältar och ledare av det slaget från moralen.
    noMorale: true,
    sight: 7,
    silver: '6T6+20',
    deathFlag: 'hovding_dod',
    loot: ['kronika_gravad'],
  },
  {
    // Provfiende för fiendernas magi (Vidar): svartalfer kan lära sig magi, och hon följer samma
    // regler som gruppens magiker. Trästaven är inte av järn.
    id: 'haxkonstnar',
    name: 'Svartalfisk häxkonstnär',
    sprite: 'haxkonstnar',
    attrs: { STY: 8, STO: 7, FYS: 10, SMI: 11, INT: 14, PSY: 16, KAR: 8 },
    skills: { trastav: 6, upptacka_fara: 11, smyga: 8, finna_dolda_ting: 11 },
    weapon: 'haxstav',
    magic: { schools: { elementarmagi: 14, animism: 16 }, spells: ['blixt', 'skold', 'hela'] },
    move: 10,
    hostile: true,
    humanoid: true,
    folk: 'svartalf',
    darkvision: true,
    sight: 8,
    silver: '3T6',
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
    attrs: { ...human, STY: 7, INT: 13, PSY: 16 },
    // Läkekonst 17 och INT 13: Asta kan undervisa i Läkekonst (Vidar, steg 8).
    skills: { dolkar: 6, lakekonst: 17, ortkunskap: 15, drogkunskap: 12, kopsla: 13 },
    weapon: 'dolk',
    move: 9,
    hostile: false,
    humanoid: true,
    npc: 'gumma',
  },
];

const npcs: NpcDef[] = [
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
      'Hon kan förbinda sår för 5 silvermynt, och vårda sår och infektioner med Läkekonst en gång om dagen för samma pris. Hon säljer läkeörter och andra droger som hon har plockat i skogen; vilka hon har inne skiftar från dag till dag. Hon vet att vargarna i skogen flyr ogärna och att svartalferna fruktar eld och dagsljus. Hon lär ut läkekonst till den som vilar en vecka på värdshuset och betalar för undervisningen.',
    greeting: 'Jaså, en vandrare. Jag såg dig i teet i morse. Du blöder snart, om du inte redan gör det.',
    topics: [
      {
        text: 'Kan du berätta något om skogen?',
        reply: 'Skogen minns allt. Vargarna är hungriga i år. Håll dig på stigen, så räcker det med att vara rädd.',
      },
    ],
    shop: { goods: ['läkedroger', 'droger'] },
    intents: ['forbind', 'vard', 'handla', 'anfall'],
    teaches: ['lakekonst'],
  },
  {
    id: 'hjalmar',
    persona:
      'Hjalmar är en grånad legoknekt som sitter i ett hörn på Gyllene Galten och väntar på arbete. Han är fåordig, praktisk och ärlig mot den som betalar. Han tar 20 silvermynt om dagen och slåss så länge hans uppdragsgivare står upp.',
    knowledge:
      'Han har hört att svartalferna i grottan österut leds av en hövding som heter Grukk. Han följer med den som betalar dagslönen, och han går om lönen uteblir. Han tycker att man ska ha en sköld och inte springa först in i en grotta.',
    greeting: 'Behöver du ett svärd till? Jag tar tjugo silver om dagen. Yxan ingår.',
    topics: [
      { text: 'Vad har du gjort förut?', reply: 'Vaktat karavaner, slagits i andras krig. Jag lever än, så jag gjorde nog något rätt.' },
      { text: 'Vad tror du om svartalferna?', reply: 'Fega en och en, farliga i flock. Håll ihop, så klarar vi oss.' },
    ],
    intents: ['folj_med', 'anfall'],
  },
  {
    id: 'sigrid',
    persona:
      'Sigrid är en tystlåten jägarinna som känner skogen öster om Gråvad bättre än någon annan. Hon är försiktig och vill hellre skjuta från avstånd än slåss på nära håll. Hon följer med mot en lika stor del av silvret som hittas.',
    knowledge:
      'Hon vet att vargarna jagar i flock i skogen och att svartalferna har skyttar i grottan. Hon följer gärna med för en del av bytet men flyr om det går riktigt illa.',
    greeting: 'Sch. Du skrämmer viltet. Vad vill du?',
    topics: [
      { text: 'Vad vet du om skogen?', reply: 'Vargarna har blivit djärvare sedan svartalferna kom. De driver dem framför sig.' },
      { text: 'Vill du tjäna lite silver?', reply: 'Lika delar av det vi hittar. Och jag går först om det luktar illa.' },
    ],
    intents: ['folj_med', 'anfall'],
  },
  {
    id: 'linnea',
    persona:
      'Linnea är en ung kvinna från Gråvad som går i lära hos kloka gumman Asta. Svartalferna dödade hennes far på stigen i våras, och hon vill hämnas. Hon kan förbinda sår och vårda skadade, men hon har aldrig varit i en riktig strid.',
    knowledge:
      'Hon vet var grottan ligger och att svartalferna skyr ljus. Hon följer med utan betalning, men hon kan få nog om det går illa.',
    greeting: 'Ska du till grottan? Ta mig med. Jag vill se dem som dödade min far få sitt straff.',
    topics: [
      { text: 'Vad kan du?', reply: 'Lägga förband och sköta sår. Asta säger att jag har händerna för det.' },
      { text: 'Är du inte rädd?', reply: 'Jo. Men jag är argare än jag är rädd.' },
    ],
    intents: ['folj_med', 'anfall'],
  },
];

/** Personer som kan följa med (husregel, steg 7). */
function recruitChar(fill: (d: Draft) => void): () => Character {
  return () => {
    const d = newDraft();
    fill(d);
    return finalize(d);
  };
}

const recruits: RecruitDef[] = [
  {
    id: 'hjalmar',
    name: 'Legoknekten Hjalmar',
    sprite: 'knekt',
    npc: 'hjalmar',
    pay: 'dagslön',
    wage: 20,
    morale: 'ledare',
    character: recruitChar((d) => {
      d.name = 'Hjalmar';
      d.profession = 'krigare';
      d.bought = { STY: 15, FYS: 14, SMI: 12, INT: 9, PSY: 11, KAR: 9 };
      d.swordDice = 7;
      d.socialDice = 8;
      d.capitalDice = 12;
      d.profSkills = ['enhandsyxor', 'skoldar', 'bagar', 'dolkar', 'dra_vapen', 'avvapna', 'geografi', 'hasardspel', 'kulturkannedom:manniskor', 'simma', 'trastav', 'barsarkagang'];
      d.targets = { enhandsyxor: 13, skoldar: 12, dra_vapen: 10, avvapna: 8, upptacka_fara: 9, forsta_hjalpen: 7 };
      d.bought_items = { stridsyxa: 1, vanlig_skold: 1, harnesk_nitlader: 1, nitladerhuva: 1, fackla: 4 };
      d.equipped = { weapon: 'stridsyxa', shield: 'vanlig_skold', armor: ['harnesk_nitlader', 'nitladerhuva'] };
      d.appearance = 'Grånad legoknekt med ärrat ansikte och en yxa som sett många strider.';
    }),
  },
  {
    id: 'sigrid',
    name: 'Jägarinnan Sigrid',
    sprite: 'jagarinna',
    npc: 'sigrid',
    pay: 'andel',
    morale: 'alltid',
    character: recruitChar((d) => {
      d.name = 'Sigrid';
      d.gender = 'kvinna';
      d.profession = 'utbygdsjagare';
      d.bought = { STY: 12, FYS: 12, SMI: 15, INT: 11, PSY: 12, KAR: 10 };
      d.swordDice = 6;
      d.socialDice = 4;
      d.capitalDice = 9;
      d.profSkills = ['bagar', 'dolkar', 'stickvapen', 'djurhelning:hund', 'drogkunskap', 'geografi', 'knopar', 'orientering', 'simma', 'spa_vader', 'ortkunskap', 'overlevnad'];
      d.targets = { bagar: 13, dolkar: 9, smyga: 12, gomma_sig: 10, spara: 12, upptacka_fara: 11, forsta_hjalpen: 9 };
      d.bought_items = { kortbage: 1, dolk: 1, pilar: 2, harnesk_lader: 1, fackla: 4 };
      d.equipped = { weapon: 'kortbage', armor: ['harnesk_lader'] };
      d.appearance = 'Smidig och tystlåten jägarinna i grön kappa, med en båge över axeln.';
    }),
  },
  {
    id: 'linnea',
    name: 'Bybon Linnea',
    sprite: 'linnea',
    npc: 'linnea',
    pay: 'gratis',
    morale: 'alltid',
    character: recruitChar((d) => {
      d.name = 'Linnea';
      d.gender = 'kvinna';
      d.profession = 'helare';
      d.age = 'ung';
      d.bought = { STY: 9, FYS: 12, SMI: 11, INT: 13, PSY: 14, KAR: 12 };
      d.swordDice = 6;
      d.socialDice = 3;
      d.capitalDice = 3;
      d.profSkills = ['dolkar', 'drogkunskap', 'geografi', 'kulturkannedom:manniskor', 'lakekonst', 'massage', 'orientering', 'simma', 'trastav', 'zoologi', 'ortkunskap', 'overlevnad'];
      d.targets = { trastav: 8, lakekonst: 11, ortkunskap: 10, forsta_hjalpen: 12 };
      d.bought_items = { trastav: 1, fackla: 4 };
      d.equipped = { weapon: 'trastav', armor: [] };
      d.appearance = 'Ung kvinna med flätat hår och örtpåsar i bältet. Svartalferna dödade hennes far.';
    }),
  },
];

/** Anteckningar som ges till språkmodellen beroende på vad som hänt i spelet. */
const flagNotes: Record<string, string> = {
  uppdrag_antaget: 'Spelaren har lovat värdshusvärden att döda svartalfshövdingen Grukk.',
  hovding_dod: 'Svartalfshövdingen Grukk är död – spelaren dödade honom.',
  uppdrag_klart: 'Spelaren har fått sin belöning för att ha dödat hövdingen.',
  hogre_beloning: 'Värdshusvärden har gått med på en högre belöning (750 silvermynt).',
  kopt_ringbrynja: 'Spelaren har köpt smedens ringbrynjeskjorta.',
  syn_grukk: 'Spelaren har med besvärjelsen SYN sett Grukk och hans häxkonstnär i grottans innersta del, och vet att de har en låst kista.',
};

/** Magiska föremål i Gråvad (egna exempel enligt Bok III s. 43–44). */
const magicItems: MagicItemDef[] = [
  {
    id: 'grukks_bredsvard',
    name: 'Grukks bredsvärd',
    looks: 'Bredsvärd med svarta runor',
    kind: 'vapen',
    base: 'bredsvard',
    spells: [{ spell: 'fortrolla_vapen', grade: 1, permanent: true, nexus: true, always: true }],
  },
  {
    id: 'haxstav',
    name: 'Häxkonstnärens stav',
    looks: 'Knotig trästav med en ugglefjäder',
    kind: 'stav',
    base: 'trastav',
    spells: [
      { spell: 'laddning', grade: 2 },
      { spell: 'ljus', grade: 1, permanent: true, nexus: true },
    ],
  },
  {
    id: 'lakebrygd',
    name: 'Läkebrygd',
    looks: 'Liten flaska med grönaktig dryck',
    kind: 'brygd',
    weight: 0,
    price: 300,
    spells: [{ spell: 'hela', grade: 2, nexus: true }],
  },
];

/** Scener som besvärjelser kan visa i Gråvad (exempel för modulformatet). */
const spellScenes: SpellSceneDef[] = [
  {
    id: 'syn_grukk',
    spells: ['syn'],
    unlessFlag: 'hovding_dod',
    text: 'I synen ser du grottan österut. I dess innersta del sitter en storvuxen svartalf med bredsvärd och sköld vid en järnbeslagen kista, och bredvid honom en svartalfisk häxkonstnär i mörk kåpa som viskar besvärjelser över en trästav.',
    setFlag: 'syn_grukk',
  },
];

const maps: MapDef[] = [
  {
    id: 'gravad',
    name: 'Gråvad',
    start: { char: '@', tile: ',' },
    habitats: ['överallt', 'skog', 'ängar', 'åkerkanter', 'snårskog'],
    exits: { X: { tile: ',', name: 'Vägen västerut' } },
    // Grukks kista: låst, med svartalfernas rövade silver.
    locks: { K: { tile: ':', kind: 'kista', name: 'Grukks kista', difficulty: 12, silver: '5T10+20', loot: ['oljelykta', 'lakebrygd'] } },
    spawns: {
      i: { tile: '_', creature: 'vardshusvard' },
      s: { tile: '_', creature: 'smed' },
      o: { tile: '.', creature: 'gumma' },
      w: { tile: '.', creature: 'varg' },
      g: { tile: ':', creature: 'svartalf' },
      b: { tile: ':', creature: 'svartalf_skytt' },
      C: { tile: ':', creature: 'svartalfshovding' },
      m: { tile: ':', creature: 'haxkonstnar' },
      h: { tile: '_', recruit: 'hjalmar' },
      j: { tile: '.', recruit: 'sigrid' },
      l: { tile: '.', recruit: 'linnea' },
    },
    rows: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'T..........T....TT......T...%%%%%%%%%%%%%%%T',
      'T.#######.......T....T......%%::::%%%%:::%%T',
      'T.#___h_#..........TT....T..%:::g::%%:::K%%T',
      'T.#_i___#....T..........T...%::::::::b:C:%%T',
      'T.#_____#.........T.........%%::::%%%:::m%%T',
      'T.###+###......T......w..T..%%%:%%%%%%%%%%%T',
      'T....,..............T.......%%%:%%%%%%%%%%%T',
      'T....,....####.........T....%%::%%%%%%%%%%%T',
      'T....,....#__#...T..........%:::g%%%%%%%%%%T',
      'T....,,,,,+s_#........T.....%::::%%%%%%%%%%T',
      'T....,....####....T......T..%%:%%%%%%%%%%%%T',
      'X,,,,@,,,,,,,,,,,,,,,,,,,,,,,,:%%%%%%%%%%%%T',
      'T....,.......T...j...,...T..%%%%%%%%%%%%%%%T',
      'T....,..~~~.......T..,......T...T....T.....T',
      'T..o.,.~~~~~....T....,..w......T...T.......T',
      'T..l.,..~~~..........,.......T.......T.....T',
      'T.........T....T.....,,,,,..T...w....T.....T',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    ],
  },
];

/** Priser och belöning enligt Bok III:s nivå: ringbrynjeskjorta 1 500 sm, uppdraget 500 sm (750 om man prutar). */
const MAIL_COST = 1500;
const MAIL = 'ringbrynjeskjorta';
const REWARD = 500;
const HIGHER_REWARD = 750;
/** Bonus-EP för uppdraget (Bok I: 1–4). */
const QUEST_EP = 3;

/** Samtalsval som hör till Gråvad. */
const intents: Record<string, Intent> = {
  uppdrag_anta: {
    label: () => 'Åta dig att döda svartalfshövdingen',
    available: (g) => !g.state.flags.uppdrag_antaget && !g.state.flags.uppdrag_klart,
    apply: (g) => {
      g.state.flags.uppdrag_antaget = true;
      return `Spelaren åtar sig uppdraget att döda svartalfshövdingen Grukk i grottan österut. Belöningen är ${REWARD} silvermynt.`;
    },
  },
  overtala_beloning: {
    label: () => 'Pruta upp belöningen (Övertala)',
    available: (g) => !!g.state.flags.uppdrag_antaget && !g.state.flags.prutat && !g.state.flags.uppdrag_klart,
    apply: (g) => {
      g.state.flags.prutat = true;
      const check = g.playerCheck('overtala');
      if (check.success) {
        g.state.flags.hogre_beloning = true;
        return `Spelaren lyckas övertala värdshusvärden: belöningen höjs till ${HIGHER_REWARD} silvermynt.`;
      }
      return `Spelaren försöker pruta upp belöningen men misslyckas. Belöningen förblir ${REWARD} silvermynt och frågan är avgjord.`;
    },
  },
  uppdrag_beloning: {
    label: () => 'Hämta belöningen för hövdingens död',
    available: (g) => !!g.state.flags.hovding_dod && !!g.state.flags.uppdrag_antaget && !g.state.flags.uppdrag_klart,
    apply: (g) => {
      const reward = g.state.flags.hogre_beloning ? HIGHER_REWARD : REWARD;
      g.player.silver += reward;
      g.state.flags.uppdrag_klart = true;
      return `Spelaren berättar att hövdingen är död och får sin belöning på ${reward} silvermynt. (Uppdraget ger också ${QUEST_EP} bonus-EP var att fördela vid träningen.)`;
    },
  },
  kop_ringbrynja: {
    label: () => `Köp ringbrynjeskjortan (${MAIL_COST} silver)`,
    available: (g) => g.player.silver >= MAIL_COST && !g.player.armor.includes(MAIL),
    apply: (g) => {
      g.player.silver -= MAIL_COST;
      g.equipArmor(MAIL);
      g.state.flags.kopt_ringbrynja = true;
      return `Spelaren köper ringbrynjeskjortan för ${MAIL_COST} silvermynt och tar på sig den (absorberar ${ARMOR[MAIL].abs} på bröstkorg och mage).`;
    },
  },
};

/** Böcker i Gråvad (steg 8). Grukk har plundrat krönikan från en resande. */
const books: BookDef[] = [
  {
    id: 'kronika_gravad',
    name: 'Krönika över Gråvadsbygden',
    description: 'En sliten handskrift om bygdens släkter, gamla fejder och hur byn grundades. Svartalferna har tagit den från en resande.',
    weight: 1,
    price: 100,
    skill: 'historia',
    maxEp: 5,
  },
];

/** Dåd som ger hjältepoäng i Gråvad (exempel till speltestet; värdena bestäms per modul). */
const deeds: DeedDef[] = [{ id: 'grukk_fallen', flag: 'hovding_dod', text: 'svartalfshövdingen Grukk är fälld', kind: 'dåd', heroPoints: 2 }];

const quests: QuestDef[] = [
  {
    id: 'grukk',
    name: 'Svartalfshövdingen',
    main: true,
    description: 'Värdshusvärden Bertil betalar den som gör slut på svartalfshövdingen Grukk i grottan öster om byn.',
    start: 'uppdrag_antaget',
    done: 'uppdrag_klart',
    bonusEp: QUEST_EP,
    steps: [
      { flag: 'hogre_beloning', text: `Bertil har gått med på ${HIGHER_REWARD} silvermynt.` },
      { flag: 'hovding_dod', text: 'Grukk är död. Hämta belöningen hos Bertil.' },
    ],
  },
];

export const SPELTEST: ModuleDef = {
  id: 'speltest',
  name: 'Gråvad',
  description:
    'Speltestmodulen. Svartalfer har slagit sig ner i en grotta öster om byn Gråvad, och deras hövding plundrar resande. Ett kort äventyr för att lära sig spelet.',
  difficulty: 'lätt',
  campaign: false,
  start: 'gravad',
  travel: { x: 30, y: 62, icon: 'ikon_by' },
  maps,
  creatures,
  npcs,
  recruits,
  quests,
  deeds,
  books,
  intents,
  flagNotes,
  spellScenes,
  magicItems,
  epilogue: [
    'Med Grukk död skingras svartalferna, och stigen genom skogen blir åter säker att gå.',
    'På Gyllene Galten bjuder Bertil på öl, och för en kväll är ni byns hjältar. Men vägen västerut leder vidare, mot nya äventyr.',
  ],
};
