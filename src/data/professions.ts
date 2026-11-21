import type { ProfessionDef, SkillOption } from './types';

/**
 * De elva yrkena (Bok I). Listorna över möjliga yrkesfärdigheter följer yrkesbeskrivningarna,
 * inte färdighetstabellen (se regelbeslut). "Vapen" betyder vapengrupper enligt husregeln;
 * Dolk och Trästav i böckernas listor är grupperna Dolkar och Trästav.
 */

const v = (max: number): SkillOption => ({ group: 'vapen', max });
const tala = (max: number): SkillOption => ({ group: 'tala', max });
const lasa = (max: number): SkillOption => ({ group: 'läsa', max });
const hantverk: SkillOption = { group: 'hantverk', max: 1 };
const instrument = (max: number): SkillOption => ({ group: 'instrument', max });
/** Utan angivet tak får man välja hur många som helst, i praktiken högst tolv. */
const ALL = 12;

export const PROFESSION_LIST: ProfessionDef[] = [
  {
    id: 'bard',
    name: 'Bard',
    requirements: { SMI: 12, KAR: 14 },
    picks: 12,
    spellsAtStart: false,
    ability: {
      name: 'Förtrollande framträdande',
      desc: 'Efter minst en minuts sång eller spel och ett lyckat slag ser alla åhörare bardens KAR som 5 högre i en timme. KAR-baserade färdigheter får +5.',
    },
    desc: 'Underhållare och mångsysslare: sång, musik, berättande och list.',
    options: [
      v(1), tala(2), lasa(1), 'administration', 'akrobatik', 'buktala', 'dans', 'djurtraning', 'dolkar', 'forfalskning',
      'geografi', 'gyckelkonster', hantverk, 'hasardspel', 'heraldik', 'historia', 'hypnotisera', 'knopar', 'kulturkannedom',
      'lasdyrkning', 'lapplasning', 'muta', 'malning', 'schack', 'simma', 'skadespeleri', instrument(ALL), 'sprakkunskap', 'trastav',
    ],
  },
  {
    id: 'helare',
    name: 'Helare',
    requirements: { INT: 12, PSY: 12 },
    picks: 12,
    spellsAtStart: false,
    ability: {
      name: 'Handpåläggning',
      desc: 'Läker 1 KP per stridsrunda för 1 PSY per KP. Kan bota sjukdom och gift: PSY/2 mot sjukdomens svårighetsgrad eller giftets STY, för lika många PSY-poäng som giftets eller sjukdomens STY.',
    },
    desc: 'Läker med händerna, vördar livet och kan mycket om örter.',
    options: [
      tala(2), lasa(1), 'alkemi', 'djurhelning', 'dolkar', 'drogkunskap', 'geografi', 'giftkunskap', hantverk, 'hypnotisera',
      'kulturkannedom', 'kunskap_om_demoner', 'kunskap_om_magi', 'kunskap_om_ododa', 'lakekonst', 'massage', 'orientering',
      'simma', 'trastav', 'zoologi', 'ortkunskap', 'overlevnad',
    ],
  },
  {
    id: 'krigare',
    name: 'Krigare',
    requirements: { STY: 14, FYS: 12 },
    picks: 12,
    spellsAtStart: false,
    ability: { name: 'Stridsvana', desc: '+5 på alla initiativslag.' },
    desc: 'Legosoldat, livvakt, stadsvakt eller rövare. Lever av att slåss.',
    options: [
      v(ALL), tala(1), 'avvapna', 'barsarkagang', 'dra_vapen', 'dolkar', 'geografi', hantverk, 'hasardspel', 'kulturkannedom',
      'simma', 'stridskonster', 'trastav', 'tva_vapen',
    ],
  },
  {
    id: 'lard_man',
    name: 'Lärd man',
    requirements: { INT: 16 },
    picks: 12,
    spellsAtStart: false,
    ability: { name: 'Snusförnuft', desc: '−5 på alla slag på Skräcktabellen.' },
    desc: 'Forskare och boklärd, ofta i staden men ibland på upptäcktsfärd.',
    options: [
      tala(4), lasa(4), 'administration', 'alkemi', 'astrologi', 'dolkar', 'drogkunskap', 'forfalskning', 'geografi', 'geologi',
      'giftkunskap', 'hasardspel', 'heraldik', 'historia', 'kulturkannedom', 'kunskap_om_demoner', 'kunskap_om_magi',
      'kunskap_om_ododa', 'rakning', 'schack', 'simma', 'sprakkunskap', 'trastav', 'zoologi', 'ortkunskap',
    ],
  },
  {
    id: 'lonnmordare',
    name: 'Lönnmördare',
    requirements: { SMI: 14, PSY: 12 },
    picks: 12,
    spellsAtStart: false,
    ability: {
      name: 'Anfall bakifrån',
      desc: 'Efter lyckat Smyga och offrets misslyckade Upptäcka fara: misslyckat anfall ger normal skada, lyckat dubbel och perfekt fyrdubbel, utan SB. Fummel misslyckas. Bara mot humanoider högst 2 m längre än lönnmördaren.',
    },
    desc: 'Smyger, klättrar, dyrkar lås och dödar med ett hugg bakifrån.',
    options: [
      v(1), tala(1), 'administration', 'akrobatik', 'dra_vapen', 'dolkar', 'forfalskning', 'geografi', 'giftkunskap',
      'hantera_fallor', 'hasardspel', 'hypnotisera', 'knopar', 'kulturkannedom', 'lasdyrkning', 'muta', 'simma', 'skadespeleri',
      'stavhopp', 'stridskonster', 'teckensprak', 'trastav', 'undre_varlden', 'anterhake',
    ],
  },
  {
    id: 'magiker',
    name: 'Magiker',
    requirements: { INT: 12, PSY: 14 },
    picks: 9,
    spellsAtStart: true,
    primarySkills: ['kanna_magi'],
    ability: { name: 'Ingen', desc: 'Magiker har ingen yrkesförmåga, men kan lära sig besvärjelser redan från start.' },
    desc: 'Förändrar verkligheten med besvärjelser. Väljer en magiskola som yrkesfärdighet.',
    options: [
      tala(3), lasa(3), 'alkemi', 'astrologi', 'djurhelning', 'djurtraning', 'drogkunskap', 'geografi', 'giftkunskap',
      'kulturkannedom', 'kunskap_om_demoner', 'kunskap_om_magi', 'kunskap_om_ododa', 'magisk_kanalisering',
      { group: 'magiskola', max: 1, required: true }, 'rakning', 'simma', 'sprakkunskap', 'trastav', 'zoologi', 'ortkunskap',
    ],
  },
  {
    id: 'munk',
    name: 'Munk',
    requirements: { INT: 12, PSY: 12 },
    picks: 12,
    spellsAtStart: false,
    ability: {
      name: 'Meditation',
      desc: 'Varje hel stridsrunda av meditation ger +1 FV i en färdighet, högst till dubbla FV. Gäller ett slag inom en minut.',
    },
    desc: 'Lever för sin tro, mediterar och undviker våld.',
    options: [
      tala(3), lasa(3), 'avvapna', 'djurhelning', 'dolkar', 'drogkunskap', 'forfalskning', 'geografi', 'giftkunskap', hantverk,
      'heraldik', 'historia', 'knopar', 'kulturkannedom', 'kunskap_om_demoner', 'kunskap_om_magi', 'kunskap_om_ododa',
      'lakekonst', 'massage', 'malning', 'rakning', 'simma', instrument(2), 'sprakkunskap', 'stridskonster', 'trastav', 'zoologi',
      'ortkunskap',
    ],
  },
  {
    id: 'sjofarare',
    name: 'Sjöfarare',
    requirements: { FYS: 12, SMI: 12 },
    picks: 12,
    spellsAtStart: false,
    ability: {
      name: 'Härdad av havet',
      desc: '+5 på FYS, STO eller STY vid motståndsslag mot elementens besvärjelser och mot eld, köld och liknande.',
    },
    desc: 'Matros, kapten, pirat eller handelsresande.',
    options: [
      v(3), tala(3), lasa(1), 'akrobatik', 'dans', 'dolkar', 'geografi', hantverk, 'hasardspel', 'gyckelkonster', 'knopar',
      'kulturkannedom', 'muta', 'navigera', 'orientering', 'schack', 'simma', 'sjokunnighet', instrument(2), 'spa_vader',
      'stavhopp', 'trastav', 'undre_varlden', 'anterhake',
    ],
  },
  {
    id: 'riddare',
    name: 'Riddare',
    requirements: { STY: 14, FYS: 12, PSY: 12 },
    picks: 12,
    spellsAtStart: false,
    ability: {
      name: 'Riddarslag',
      desc: 'För 5 PSY: träffa valfri kroppsdel utan avdrag, eller göra maximal skada med maximal SB. Abs och parering gäller som vanligt.',
    },
    desc: 'Adlig krigare som försöker leva efter ridderlighetens ideal.',
    options: [
      v(5), tala(1), lasa(1), 'administration', 'avvapna', 'dans', 'djurtraning', 'dra_vapen', 'dolkar', 'geografi', 'heraldik',
      'historia', 'kulturkannedom', 'kunskap_om_magi', 'kunskap_om_ododa', 'malning', 'rakning', 'schack', 'simma', instrument(2),
      'sprakkunskap', 'trastav', 'tva_vapen',
    ],
  },
  {
    id: 'tjuv',
    name: 'Tjuv',
    requirements: { SMI: 16 },
    picks: 12,
    spellsAtStart: false,
    ability: {
      name: 'Tjuvtur',
      desc: 'Spendera 1–3 PSY för lika mycket plus på CL i valfri färdighet. Högst två gånger mellan varje sömn om åtta timmar (fyra för alver).',
    },
    desc: 'Smyger och stjäl, har tur och känner den undre världen.',
    options: [
      v(2), tala(1), 'administration', 'akrobatik', 'buktala', 'dra_vapen', 'dolkar', 'drogkunskap', 'forfalskning', 'geografi',
      'giftkunskap', 'hypnotisera', 'gyckelkonster', 'knopar', 'kulturkannedom', 'lasdyrkning', 'lapplasning', 'muta', 'rakning',
      'simma', 'skadespeleri', instrument(2), 'stavhopp', 'teckensprak', 'trastav', 'undre_varlden', 'anterhake',
    ],
  },
  {
    id: 'utbygdsjagare',
    name: 'Utbygdsjägare',
    requirements: { FYS: 12, SMI: 12, PSY: 12 },
    picks: 12,
    spellsAtStart: false,
    ability: {
      name: 'Animism',
      desc: 'Kan lära sig magiskolan Animism och allmänna och animistiska besvärjelser med skolvärde 12 eller lägre, men inga besvärjelser från start.',
    },
    desc: 'Lever i vildmarken som jägare, spejare, skogvaktare eller vägvisare.',
    options: [
      v(3), tala(1), 'magiskola:animism', 'djurhelning', 'djurtraning', 'dolkar', 'drogkunskap', 'geografi', 'geologi',
      'giftkunskap', hantverk, 'hantera_fallor', 'knopar', 'kulturkannedom', 'orientering', 'simma', 'spa_vader', 'zoologi',
      'ortkunskap', 'overlevnad',
    ],
  },
];

export const PROFESSIONS: Record<string, ProfessionDef> = Object.fromEntries(PROFESSION_LIST.map((p) => [p.id, p]));

/** Utbygdsjägarens högsta skolvärde för besvärjelser. */
export const RANGER_MAX_SCHOOL_VALUE = 12;
