import type { CreatureStats, NaturalAttack } from './types';

/**
 * Varelser (Bok II s. 25–48) med typvärden. KP och SB räknas alltid fram med formlerna
 * (maxKp, damageBonus) och skrivs därför inte här, utom där boken har en egen regel
 * (gasten: KP = PSY; spöket saknar kropp). Förmågorna är egna sammanfattningar.
 *
 * Färdigheter anges med färdighetens id. "narstridsvapen" och "avstandsvapen" betyder
 * ett valfritt vapen av det slaget.
 */

const a = (name: string, count: number | string, damage: string, fv: number, sb: NaturalAttack['sb'] = 'full', note?: string): NaturalAttack => ({
  name,
  count,
  damage,
  fv,
  sb,
  ...(note ? { note } : {}),
});
const NAVAR = (fv: number) => a('Näve', 2, '1T3', fv);
const SPARK = (fv: number) => a('Spark', 1, '1T6', fv);

const ANIMAL = { INT: 2, PSY: 11 };

export const CREATURE_LIST: CreatureStats[] = [
  // ---------------------------------------------------------------- djur
  {
    id: 'bjorn_liten', name: 'Liten björn', group: 'djur', number: '1–2',
    attrs: { STY: 14, STO: 14, FYS: 11, SMI: 11, ...ANIMAL }, armor: 2, move: { L: 12 },
    attacks: [a('Bett', 1, '1T6', 8), a('Klor', 2, '1T6', 10), a('Kram', 1, '2T8', 0, 'full', 'Särskild: används när båda klorna träffar.')],
    skills: { klattra: 12, upptacka_fara: 5, simma: 12, spara: 12 }, noMorale: false, traits: [],
  },
  {
    id: 'bjorn_medel', name: 'Medelstor björn', group: 'djur', number: '1–2',
    attrs: { STY: 23, STO: 23, FYS: 11, SMI: 11, ...ANIMAL }, armor: 3, move: { L: 12 },
    attacks: [a('Bett', 1, '1T8', 12), a('Klor', 2, '1T6', 12), a('Kram', 1, '2T8', 0, 'full', 'Särskild: används när båda klorna träffar.')],
    skills: { klattra: 2, upptacka_fara: 5, simma: 10, spara: 13 }, traits: [],
  },
  {
    id: 'bjorn_stor', name: 'Stor björn', group: 'djur', number: '1–2',
    attrs: { STY: 35, STO: 35, FYS: 16, SMI: 11, ...ANIMAL }, armor: 4, move: { L: 12 },
    attacks: [a('Bett', 1, '1T8', 12), a('Klor', 2, '1T6', 14), a('Kram', 1, '2T8', 0, 'full', 'Särskild: används när båda klorna träffar.')],
    skills: { klattra: 2, upptacka_fara: 5, simma: 10, spara: 16 }, traits: [],
  },
  {
    id: 'fladdermussvarm', name: 'Vampyrfladdermöss', group: 'djur', habitat: '8', frequency: 'vanlig', number: '1T100 × 10',
    // Boken ger inga grundegenskaper för svärmen; värdena är platshållare. Reglerna nedan styr.
    attrs: { STY: 1, STO: 1, FYS: 1, SMI: 15, INT: 2, PSY: 5 }, armor: 0, move: { F: 20 }, attacks: [], skills: {}, noMorale: true,
    traits: [
      'Upp till 2T6 fladdermöss anfaller en person per runda. För varje fladdermus slås 1T10: över rustningens abs biter den sig fast för 1 KP, sedan 1 KP per runda.',
      '10 % risk för sjukdom eller infektion per bett. Att slita loss en kostar 1 KP; eld får dem att släppa.',
      'Varje lyckat anfall dödar en fladdermus. En fackla skrämmer bort 1T10 per runda.',
    ],
  },
  {
    id: 'hast_liten', name: 'Liten häst', group: 'djur', frequency: 'vanlig',
    attrs: { STY: 29, STO: 25, FYS: 11, SMI: 13, ...ANIMAL }, armor: 1, move: { L: 26 },
    attacks: [a('Bett', 1, '1T4', 8, 'halv'), a('Hovspark', 2, '1T8', 8)], skills: { upptacka_fara: 14 }, traits: ['Ston har −2 på STY och STO.'],
  },
  {
    id: 'hast_stor', name: 'Stor häst', group: 'djur', frequency: 'vanlig',
    attrs: { STY: 32, STO: 28, FYS: 11, SMI: 11, ...ANIMAL }, armor: 1, move: { L: 24 },
    attacks: [a('Bett', 1, '1T4', 8, 'halv'), a('Hovspark', 2, '1T8', 8)], skills: { upptacka_fara: 17 }, traits: ['Ston har −2 på STY och STO.'],
  },
  {
    id: 'asna', name: 'Åsna', group: 'djur', frequency: 'ovanlig',
    attrs: { STY: 20, STO: 15, FYS: 11, SMI: 13, ...ANIMAL }, armor: 0, move: { L: 16 },
    attacks: [a('Bett', 1, '1T4', 8, 'halv'), a('Hovspark', 2, '1T8', 8)], skills: { upptacka_fara: 7 }, traits: [],
  },
  {
    id: 'ponny', name: 'Ponny', group: 'djur', frequency: 'ovanlig',
    attrs: { STY: 22, STO: 17, FYS: 11, SMI: 11, ...ANIMAL }, armor: 0, move: { L: 26 },
    attacks: [a('Bett', 1, '1T4', 8, 'halv'), a('Hovspark', 2, '1T8', 8)], skills: { upptacka_fara: 17 }, traits: [],
  },
  {
    id: 'mula', name: 'Mula', group: 'djur', habitat: 'B, C', frequency: 'ovanlig',
    attrs: { STY: 25, STO: 17, FYS: 11, SMI: 11, ...ANIMAL }, armor: 0, move: { L: 20 },
    attacks: [a('Bett', 1, '1T4', 8, 'halv'), a('Hovspark', 2, '1T8', 8)], skills: { upptacka_fara: 7 }, traits: [],
  },
  {
    id: 'hund_liten', name: 'Liten hund', group: 'djur',
    attrs: { STY: 6, STO: 4, FYS: 6, SMI: 13, ...ANIMAL }, armor: 0, move: { L: 12 },
    attacks: [a('Bett', 1, '1T2', 5)], skills: { upptacka_fara: 17, spara: 10, smyga: 10, gomma_sig: 13 }, traits: [],
  },
  {
    id: 'hund_medel', name: 'Medelstor hund', group: 'djur',
    attrs: { STY: 8, STO: 6, FYS: 8, SMI: 11, ...ANIMAL }, armor: 0, move: { L: 14 },
    attacks: [a('Bett', 1, '1T4', 5)], skills: { upptacka_fara: 17, spara: 12, smyga: 10, gomma_sig: 10 }, traits: ['Även vildhund och räv.'],
  },
  {
    id: 'hund_stor', name: 'Stor hund', group: 'djur',
    attrs: { STY: 10, STO: 9, FYS: 11, SMI: 13, ...ANIMAL }, armor: 0, move: { L: 12 },
    attacks: [a('Bett', 1, '1T6', 5)], skills: { upptacka_fara: 17, spara: 14, smyga: 7, gomma_sig: 8 }, traits: ['Även schakal, hyena och prärievarg.'],
  },
  {
    id: 'varg', name: 'Varg', group: 'djur', habitat: '3, 5, 11', frequency: 'vanlig', number: '2–50',
    attrs: { STY: 11, STO: 7, FYS: 14, SMI: 16, ...ANIMAL }, armor: 1, move: { L: 16 },
    attacks: [a('Bett', 1, '1T8', 10)], skills: { upptacka_fara: 17, spara: 16, smyga: 9, gomma_sig: 9 }, traits: ['Flocklevande; kan anfalla människor när den är mycket hungrig.'],
  },
  {
    id: 'ulv', name: 'Ulv', group: 'djur', habitat: '3, 5, 11', frequency: 'ovanlig', number: '1–10',
    attrs: { STY: 15, STO: 11, FYS: 14, SMI: 16, INT: 3, PSY: 11 }, armor: 2, move: { L: 16 },
    attacks: [a('Bett', 1, '1T8', 11)], skills: { upptacka_fara: 17, spara: 15, smyga: 7, gomma_sig: 8 }, traits: ['Svartalfer rider ofta på vargar och ulvar.'],
  },
  {
    id: 'blackfisk', name: 'Jättebläckfisk', group: 'djur', habitat: '13', frequency: 'mycket sällsynt', number: '1',
    attrs: { STY: 35, STO: 125, FYS: 42, SMI: 35, INT: 0, PSY: 11 }, armor: 4, move: { S: 12 },
    attacks: [a('Tentakelgrepp', 2, '1T6', 5, 'full', 'Håller fast offret; STY mot STY för att slita sig loss.'), a('Tentakelsnärt', 1, '1T6', 5, 'halv')],
    skills: {}, noMorale: true, traits: ['Drunknar sina byten. Kan spruta ett bläckmoln på 10×10×10 m som bländar.'],
  },
  {
    id: 'katt_liten', name: 'Liten katt', group: 'djur',
    attrs: { STY: 2, STO: 1, FYS: 6, SMI: 18, ...ANIMAL }, armor: 0, move: { L: 12 },
    attacks: [a('Klor', 2, '1T2', 5)], skills: { klattra: 18, upptacka_fara: 17, smyga: 16, gomma_sig: 14 }, traits: [],
  },
  {
    id: 'katt_medel', name: 'Medelstort kattdjur', group: 'djur',
    attrs: { STY: 11, STO: 8, FYS: 11, SMI: 17, ...ANIMAL }, armor: 1, move: { L: 14 },
    attacks: [a('Bett', 1, '1T6', 10), a('Klor', 2, '1T4', 10)], skills: { klattra: 16, upptacka_fara: 17, smyga: 12, gomma_sig: 12 }, traits: ['Lodjur, leopard, puma, jaguar m.fl.'],
  },
  {
    id: 'katt_stor', name: 'Stort kattdjur', group: 'djur',
    attrs: { STY: 27, STO: 19, FYS: 12, SMI: 16, ...ANIMAL }, armor: 2, move: { L: 16 },
    attacks: [a('Bett', 1, '1T8', 14), a('Klor', 2, '1T6', 14)], skills: { klattra: 14, upptacka_fara: 17, smyga: 8, gomma_sig: 10 }, traits: ['Lejon och tiger.'],
  },
  {
    id: 'klovdjur_litet', name: 'Litet klövdjur', group: 'djur',
    attrs: { STY: 11, STO: 14, FYS: 8, SMI: 14, ...ANIMAL }, armor: 0, move: { L: 14 },
    attacks: [a('Stångning', 1, '1T4', 6), a('Spark', 1, '1T4', 6)], skills: { upptacka_fara: 14 }, traits: ['Rådjur och mindre hjortar.'],
  },
  {
    id: 'klovdjur_medel', name: 'Medelstort klövdjur', group: 'djur',
    attrs: { STY: 17, STO: 20, FYS: 11, SMI: 10, ...ANIMAL }, armor: 2, move: { L: 14 },
    attacks: [a('Bett', 1, '1T4', 5), a('Stångning', 1, '1T6', 6), a('Spark', 1, '1T6', 6)], skills: { upptacka_fara: 8 }, traits: ['Ren, ko, kamel, oxe m.fl.'],
  },
  {
    id: 'klovdjur_stort', name: 'Stort klövdjur', group: 'djur',
    attrs: { STY: 29, STO: 29, FYS: 17, SMI: 13, ...ANIMAL }, armor: 3, move: { L: 20 },
    attacks: [a('Bett', 1, '1T4', 5), a('Stångning', 1, '1T8', 9), a('Spark', 1, '1T8', 13)], skills: { upptacka_fara: 11 }, traits: ['Bison, älg, vattenbuffel m.fl.'],
  },
  {
    id: 'orm_liten', name: 'Liten orm', group: 'djur',
    attrs: { STY: 1, STO: 1, FYS: 5, SMI: 19, INT: 1, PSY: 11 }, armor: 0, move: { L: 10 },
    attacks: [a('Bett', 1, '1T2', 9, 'full', 'Oftast giftigt.')], skills: { upptacka_fara: 7, gomma_sig: 18, smyga: 12 }, traits: [],
  },
  {
    id: 'orm_medel', name: 'Medelstor orm', group: 'djur',
    attrs: { STY: 5, STO: 2, FYS: 7, SMI: 17, INT: 1, PSY: 13 }, armor: 0, move: { L: 8 },
    attacks: [a('Bett', 1, '1T4', 9, 'full', 'Oftast giftigt.')], skills: { upptacka_fara: 5, gomma_sig: 14, smyga: 10 }, traits: ['Huggorm, kobra, skallerorm.'],
  },
  {
    id: 'orm_stor', name: 'Stor orm', group: 'djur',
    attrs: { STY: 23, STO: 18, FYS: 11, SMI: 15, INT: 1, PSY: 15 }, armor: 1, move: { L: 8 },
    attacks: [a('Bett', 1, '1T6', 11, 'full', 'Biter eller kramar, inte båda.'), a('Kram', 1, '1T8', 11)], skills: { upptacka_fara: 5, gomma_sig: 16, smyga: 16 }, traits: ['Pyton och boa.'],
  },
  {
    id: 'skorpion', name: 'Skorpion', group: 'djur', habitat: '9, 10', frequency: 'ovanlig', number: '1',
    attrs: { STY: 1, STO: 0, FYS: 1, SMI: 17, INT: 1, PSY: 1 }, armor: 0, move: { L: 2 },
    attacks: [a('Sting', 1, '0', 18, 'ingen', 'Gift med STY 2T8 mot oskyddad kroppsdel.')], skills: {}, noMorale: true, traits: [],
  },
  {
    id: 'spindel', name: 'Giftspindel', group: 'djur', frequency: 'vanlig',
    attrs: { STY: 1, STO: 1, FYS: 1, SMI: 17, INT: 1, PSY: 1 }, armor: 0, move: { L: 2 },
    attacks: [a('Bett', 1, '0', 19, 'ingen', 'Gift; effekten beror på arten.')], skills: {}, noMorale: true, traits: [],
  },
  {
    id: 'tamsvin', name: 'Tamsvin', group: 'djur', habitat: 'B, 2', frequency: 'vanlig',
    attrs: { STY: 5, STO: 6, FYS: 11, SMI: 7, ...ANIMAL }, armor: 0, move: { L: 10 },
    attacks: [a('Bett', 1, '1T4', 5)], skills: { upptacka_fara: 5 }, traits: ['Vildsvin: +5 på STY och STO.'],
  },
  {
    id: 'get', name: 'Get och får', group: 'djur', habitat: 'B, 5', frequency: 'vanlig',
    attrs: { STY: 5, STO: 4, FYS: 7, SMI: 11, ...ANIMAL }, armor: 2, move: { L: 12 },
    attacks: [a('Spark', 1, '1T4', 5), a('Stångning', 1, '1T4', 5)], skills: { upptacka_fara: 5 }, traits: [],
  },
  {
    id: 'bock', name: 'Bock och bagge', group: 'djur', habitat: 'B, 5', frequency: 'vanlig',
    attrs: { STY: 7, STO: 5, FYS: 11, SMI: 11, ...ANIMAL }, armor: 2, move: { L: 12 },
    attacks: [a('Spark', 1, '1T4', 5), a('Bett', 1, '1T4', 5), a('Stångning', 1, '1T6', 12)], skills: { upptacka_fara: 5 }, traits: [],
  },

  // ---------------------------------------------------------------- legendariska varelser
  {
    id: 'alv', name: 'Alv', group: 'legendarisk', race: 'alv', habitat: '2G, 3G', frequency: 'ovanlig', number: '1–20',
    attrs: { STY: 10, STO: 11, FYS: 11, SMI: 14, INT: 14, PSY: 11, KAR: 13 }, armor: 0, move: { L: 10 },
    attacks: [NAVAR(5), SPARK(5)], skills: { bagar: 8, enhandssvard: 3, smyga: 8, gomma_sig: 6, upptacka_fara: 8, klattra: 12 },
    darkvision: 'nattsyn', traits: ['Gömmer sig hellre än slåss och flyr bort från sin boning.'],
  },
  {
    id: 'anka', name: 'Anka', group: 'legendarisk', race: 'anka', frequency: 'sällsynt',
    attrs: { STY: 7, STO: 5, FYS: 13, SMI: 13, INT: 11, PSY: 11, KAR: 8 }, armor: 0, move: { L: 10 },
    attacks: [NAVAR(4), SPARK(4)],
    skills: { smyga: 10, gomma_sig: 6, upptacka_fara: 6, klattra: 4, simma: 20, narstridsvapen: 8, avstandsvapen: 6 },
    traits: ['Vapen-FV gäller bruna och svarta ankor. Vita ankor är handelsmän (Värdera 14); svarta ankor är pirater (Sjökunnighet 10, Navigera 10).'],
  },
  {
    id: 'demon', name: 'Typisk demon', group: 'legendarisk', frequency: 'mycket sällsynt', number: '1',
    attrs: { STY: 26, STO: 21, FYS: 26, SMI: 26, INT: 16, PSY: 26, KAR: 1 }, armor: 6, move: { L: 22 },
    attacks: [NAVAR(12), SPARK(12), a('Bett', 1, '1T8', 12, 'halv'), a('Svanssnärt', 1, '1T8', 12), a('Klor', '1T4', '1T8', 12)],
    skills: { narstridsvapen: 10, smyga: 8, gomma_sig: 2, upptacka_fara: 18 }, fear: [3, 0],
    traits: ['Har 1T6+1 demoniska förmågor (se DEMONIC_ABILITIES).', 'Kan inte själv ta sig till människornas värld.'],
  },
  {
    id: 'drake', name: 'Drake', group: 'legendarisk', habitat: '5, 8, G', frequency: 'mycket sällsynt', number: '1',
    attrs: { STY: 100, STO: 100, FYS: 35, SMI: 22, INT: 19, PSY: 23 }, armor: { kropp: 10, buk: 5, vingar: 1 }, move: { L: 14, F: 52 },
    attacks: [
      a('Klor', 2, '1T8', 26),
      a('Bett', 1, '1T8', 26, 'halv'),
      a('Svanssnärt', 1, '1T4', 24),
      a('Eldkvast', 1, '10T10', 19, 'ingen', 'Tänder allt brännbart. Skyddas bara av stark magi, mithril och drakfjäll. 1T6 rundor mellan varje.'),
    ],
    skills: { finna_dolda_ting: 19, smyga: 19, spara: 19, upptacka_fara: 19, besvarjelser: 15 }, fear: [0, 15], darkvision: 'perfekt', noMorale: true,
    traits: [
      'Den som ser draken i ögonen måste klara ett Normalt INT-slag eller bli paralyserad.',
      'Frätande blod: 1T10 i skada och −1 abs på icke-magisk rustning. Vapen som skadar draken förlorar 1T4 BV.',
      'Skattpansar ger +4 abs på buken, men med 50 % risk för en blotta.',
      'Drakmagi: KÄNSLOLÄSNING, TANKEÖVERFÖRING, SYN, TANKELÄSNING, KONTROLLERA PERSON, TELEPATI, MAGISK SYN.',
      'Ointelligenta djur flyr när draken skräckslår.',
    ],
  },
  {
    id: 'dvarg', name: 'Dvärg', group: 'legendarisk', race: 'dvarg', habitat: '5B, 8B', frequency: 'ovanlig',
    attrs: { STY: 14, STO: 6, FYS: 13, SMI: 11, INT: 11, PSY: 13, KAR: 11 }, armor: 0, move: { L: 8 },
    attacks: [NAVAR(5), SPARK(5)],
    skills: { narstridsvapen: 7, avstandsvapen: 2, smyga: 4, gomma_sig: 5, upptacka_fara: 5, klattra: 2, hantverk: 8, geologi: 5 },
    darkvision: 'perfekt', traits: ['Principfast, disciplinerad och svår att skrämma. Lever 250–400 år.'],
  },
  {
    id: 'enhorning', name: 'Enhörning', group: 'legendarisk', habitat: '2G, 4G, 5G', frequency: 'mycket sällsynt', number: '1',
    attrs: { STY: 35, STO: 30, FYS: 15, SMI: 15, INT: 11, PSY: 13 }, armor: 1, move: { L: 26 },
    attacks: [a('Stångning', 1, '1T8', 14), a('Hovar', 2, '1T8', 16), a('Bett', 1, '1T4', 8, 'ingen')],
    skills: { gomma_sig: 13, lyssna: 22, smyga: 13, hoppa: 13, upptacka_fara: 22 },
    traits: ['Immun mot gift.', 'Hornet läker 1T6 KP på en vänligt sinnad varelse.', 'Känner telepatiskt av alla som är fientliga mot den.'],
  },
  {
    id: 'gast', name: 'Gast', group: 'legendarisk', frequency: 'mycket sällsynt', number: '1',
    attrs: { STY: 21, STO: 11, FYS: 0, SMI: 11, INT: 11, PSY: 32 }, kp: 'PSY', armor: 0, move: { L: 10 },
    attacks: [a('Beröring', 1, '0', 18, 'ingen')], skills: { som_levande: '1T10+15' }, fear: [5, 15], noMorale: true,
    traits: ['Odöd med fysisk kropp. Tar halv skada av vanliga vapen, full av eld, magi och magiska vapen.', 'Behåller färdigheterna från livet.'],
  },
  {
    id: 'grip', name: 'Grip', group: 'legendarisk', habitat: '4, 5G', frequency: 'mycket sällsynt', number: '1–2',
    attrs: { STY: 21, STO: 14, FYS: 13, SMI: 17, INT: 5, PSY: 13 }, armor: 4, move: { L: 12, F: 28 },
    attacks: [a('Klor', 2, '1T6', 16), a('Bett', 1, '1T6', 12, 'halv')],
    skills: { finna_dolda_ting: 13, lyssna: 10, hoppa: 14, klattra: 16, smyga: 18, spara: 18, upptacka_fara: 13 },
    traits: ['Hästar som vittrar en grip flyr i panik; bara vältränade stridshästar kan hållas kvar.'],
  },
  {
    id: 'halvalv', name: 'Halvalv', group: 'legendarisk', race: 'halvalv', frequency: 'sällsynt',
    attrs: { STY: 11, STO: 13, FYS: 11, SMI: 13, INT: 11, PSY: 11, KAR: 12 }, armor: 0, move: { L: 10 },
    attacks: [NAVAR(5), SPARK(5)],
    skills: { narstridsvapen: 4, avstandsvapen: 4, smyga: 5, gomma_sig: 5, upptacka_fara: 5, klattra: 5 },
    traits: ['Åldras hälften så fort som människor.'],
  },
  {
    id: 'halvlangdsman', name: 'Halvlängdsman', group: 'legendarisk', race: 'halvlangdsman', habitat: '2, 3, 4, 5', frequency: 'ovanlig',
    attrs: { STY: 7, STO: 4, FYS: 14, SMI: 14, INT: 11, PSY: 13, KAR: 11 }, armor: 0, move: { L: 8 },
    attacks: [NAVAR(4), SPARK(4)],
    skills: { narstridsvapen: 2, avstandsvapen: 4, smyga: 12, gomma_sig: 17, upptacka_fara: 7, klattra: 3 },
    traits: ['Fredligt folk som bor i kullar. Lever 80–110 år.'],
  },
  {
    id: 'halvorch', name: 'Halvorch', group: 'legendarisk', race: 'halvorch', frequency: 'mycket sällsynt',
    attrs: { STY: 13, STO: 11, FYS: 13, SMI: 10, INT: 11, PSY: 11, KAR: 8 }, armor: 0, move: { L: 10 },
    attacks: [NAVAR(5), SPARK(5)],
    skills: { narstridsvapen: 4, avstandsvapen: 4, klattra: 4, upptacka_fara: 6, smyga: 4, gomma_sig: 4 },
    darkvision: 'perfekt', traits: ['Kan lära sig magi, till skillnad från svartfolken.'],
  },
  {
    id: 'harpya', name: 'Harpya', group: 'legendarisk', habitat: '2, 5', frequency: 'sällsynt', number: '2–5',
    attrs: { STY: 11, STO: 11, FYS: 11, SMI: 17, INT: 7, PSY: 11 }, armor: 1, move: { L: 4, F: 14 },
    attacks: [a('Klor', 2, '1T6', 6)], skills: { finna_dolda_ting: 11, upptacka_fara: 11 },
    traits: ['Smittobärare: 5 % risk per skada att offret får en svår sjukdom.'],
  },
  {
    id: 'hydra', name: 'Hydra', group: 'legendarisk', habitat: '5, 8', frequency: 'mycket sällsynt', number: '1',
    attrs: { STY: 21, STO: 21, FYS: 22, SMI: 7, INT: 5, PSY: 11 }, armor: 1, move: { L: 16 },
    attacks: [a('Bett per huvud', 1, '1T8', 11)], skills: { finna_dolda_ting: 13 },
    traits: [
      '6 eller mer i skada från ett huggvapen hugger av ett huvud. Två nya växer ut efter 1T6+1 rundor om inte stumpen bränns.',
      'Att träffa stumpen med en fackla har halva CL mot liten träklubba; ELD och ENERGISTRÅLE fungerar också.',
    ],
  },
  {
    id: 'jatte', name: 'Jätte', group: 'legendarisk', habitat: 'Överallt, G', frequency: 'sällsynt', number: '1–10',
    attrs: { STY: 60, STO: 60, FYS: 22, SMI: 11, INT: 10, PSY: 11, KAR: 9 }, armor: 1, move: { L: 18 },
    attacks: [NAVAR(5), SPARK(5)], skills: { narstridsvapen: 6, upptacka_fara: 5, klattra: 2 }, traits: ['Omkring sex meter hög.'],
  },
  {
    id: 'jattespindel', name: 'Jättespindel', group: 'legendarisk', habitat: '3, 8', frequency: 'sällsynt', number: '1–10',
    attrs: { STY: 17, STO: 17, FYS: 17, SMI: 19, INT: 7, PSY: 17 }, armor: 5, move: { L: 18 },
    attacks: [a('Bett', 1, '1T8', 8, 'full', 'Giftigt.')], skills: { klattra: 11, spara: 10, upptacka_fara: 11 },
    traits: ['Hoppar upp till 10 meter.'],
  },
  {
    id: 'kentaur', name: 'Kentaur', group: 'legendarisk', habitat: '2', frequency: 'sällsynt',
    attrs: { STY: 17, STO: 26, FYS: 11, SMI: 11, INT: 11, PSY: 11, KAR: 11 }, armor: 1, move: { L: 24 },
    attacks: [NAVAR(5), a('Hovspark', 1, '1T8', 4)],
    skills: { stickvapen: 8, bagar: 5, smyga: 4, gomma_sig: 4, upptacka_fara: 12, sjunga: 'B4', spela_instrument: 'B3', astrologi: 10 },
    traits: ['Kan inte rida eller klättra men hoppar mycket bra.'],
  },
  {
    id: 'mantikora', name: 'Mantikora', group: 'legendarisk', habitat: '2, 4, 5', frequency: 'mycket sällsynt', number: '1–3',
    attrs: { STY: 29, STO: 28, FYS: 22, SMI: 14, INT: 7, PSY: 11 }, armor: 4, move: { L: 12 },
    attacks: [
      a('Klor', 2, '1T6', 11),
      a('Bett', 1, '1T8', 11, 'ingen'),
      a('Svansprojektil', 1, '1T4', 9, 'ingen', 'Gift med STY = PSY. Räckvidd STY rutor. Taggarna växer ut igen, en per dag upp till sju.'),
      a('Svanssnärt', 1, '1T10', 11, 'full', 'Gift med STY = PSY. Kan göras samtidigt som klor eller bett.'),
    ],
    skills: { lyssna: 10, gomma_sig: 14, klattra: 14, smyga: 14, spara: 15, upptacka_fara: 11 },
    traits: ['Har ett eget språk; en del talar människospråk.'],
  },
  {
    id: 'minotaur', name: 'Minotaur', group: 'legendarisk', frequency: 'sällsynt',
    attrs: { STY: 35, STO: 23, FYS: 13, SMI: 13, INT: 10, PSY: 11, KAR: 9 }, armor: 3, move: { L: 12 },
    attacks: [a('Bett', 1, '1T6', 8, 'halv'), NAVAR(10), SPARK(5), a('Stångning', 1, '1T6', 6)],
    skills: { tvahandsvapen: 14, smyga: 2, gomma_sig: 3, upptacka_fara: 4, klattra: 4 }, traits: ['Kan inte använda magi. Slåss gärna med tvåhandsyxa.'],
  },
  {
    id: 'mumie', name: 'Mumie', group: 'legendarisk', frequency: 'sällsynt',
    attrs: { STY: 32, STO: 11, FYS: 0, SMI: 3, INT: 7, PSY: 2 }, armor: 2, move: { L: 8 },
    attacks: [], skills: { som_levande: '1T20', smyga: 19 }, noMorale: true,
    traits: ['Lindorna brinner. En brinnande mumie fortsätter två rundor och faller sedan ihop.'],
  },
  {
    id: 'orch', name: 'Orch', group: 'legendarisk', habitat: '8', frequency: 'ovanlig',
    attrs: { STY: 14, STO: 12, FYS: 11, SMI: 11, INT: 8, PSY: 11, KAR: 7 }, armor: 0, move: { L: 10 },
    attacks: [NAVAR(5), SPARK(5), a('Bett', 1, '1T6', 4)],
    skills: { narstridsvapen: 5, avstandsvapen: 4, smyga: 5, gomma_sig: 6, upptacka_fara: 6, klattra: 5 }, darkvision: 'perfekt',
    traits: [
      'Ser suddigt i dagsljus och avskyr det.',
      'Kaxiga i medgång och fega i motgång; ger gärna upp och erbjuder sig som följe när ledaren fallit. Slåss till sista man på hemmaplan.',
      'Kan aldrig lära sig magi.',
    ],
  },
  {
    id: 'pegas', name: 'Pegas', group: 'legendarisk', habitat: '5AG', frequency: 'mycket sällsynt', number: '1',
    attrs: { STY: 35, STO: 26, FYS: 13, SMI: 11, INT: 7, PSY: 16 }, armor: 1, move: { F: 30, L: 26 },
    attacks: [a('Hovar', 2, '1T6', 12), a('Bett', 1, '1T4', 10, 'halv')], skills: { smyga: 10, spara: 10, upptacka_fara: 16 },
    traits: ['Hör sin herres visselsignal på tio mils håll.', 'Skyr underjorden; måste klara ett "kritiskt" PSY-slag (tolkat som Extremt svårt) för att följa en kallelse dit.'],
  },
  {
    id: 'reptilman', name: 'Reptilman', group: 'legendarisk', habitat: '6, 7', frequency: 'ovanlig',
    attrs: { STY: 17, STO: 14, FYS: 13, SMI: 11, INT: 10, PSY: 11, KAR: 5 }, armor: 3, move: { L: 10, S: 10 },
    attacks: [a('Klor', 2, '1T6', 6), SPARK(5), a('Bett', 1, '1T8', 6), a('Svanssnärt', 1, '1T4', 4)],
    skills: { stickvapen: 8, enhandssvard: 3, smyga: 6, gomma_sig: 4, upptacka_fara: 8 }, traits: ['Okänslig för vanlig eld.'],
  },
  {
    id: 'rese', name: 'Rese', group: 'legendarisk', habitat: '2, 3, 5, 8', frequency: 'sällsynt', number: '1–2',
    attrs: { STY: 35, STO: 23, FYS: 13, SMI: 10, INT: 7, PSY: 11, KAR: 5 }, armor: 1, move: { L: 10 },
    attacks: [NAVAR(9), SPARK(9)], skills: { narstridsvapen: 5, gomma_sig: 2, upptacka_fara: 3, klattra: 3 }, darkvision: 'begränsad',
    traits: ['Undviker klart solsken men ser bra i dagsljus.', 'Kan aldrig lära sig magi.'],
  },
  {
    id: 'sfinx', name: 'Sfinx', group: 'legendarisk', habitat: '5', frequency: 'mycket sällsynt', number: '1',
    attrs: { STY: 26, STO: 17, FYS: 11, SMI: 17, INT: 15, PSY: 16 }, armor: 2, move: { L: 14, F: 20 },
    attacks: [a('Klor', 2, '1T6', 13), a('Bett', 1, '1T8', 9, 'halv')],
    skills: { finna_dolda_ting: 11, gomma_sig: 15, klattra: 15, lyssna: 15, smyga: 17, spara: 13, upptacka_fara: 14, overtala: 11 },
    traits: ['Talar flera språk och lär sig nya med lätthet. Älskar gåtor.'],
  },
  {
    id: 'skelett', name: 'Skelett', group: 'legendarisk', frequency: 'sällsynt',
    attrs: { STY: 13, STO: 11, FYS: 0, SMI: 7, INT: 2, PSY: 2 }, armor: 0, move: { L: 6 },
    attacks: [], skills: { som_levande: '1T20', smyga: 19 }, noMorale: true,
    traits: ['Tar ingen skada av pilar, stickvapen eller vanlig eld.'],
  },
  {
    id: 'spoke', name: 'Spöke', group: 'legendarisk', frequency: 'sällsynt', number: '1',
    attrs: { STY: 0, STO: 11, FYS: 0, SMI: 21, INT: 11, PSY: 21 }, kp: 'ingen', armor: 0, move: { A: 10 },
    attacks: [a('Beröring', 1, '0', 0, 'ingen', 'Boken anger inget FV. Suger ut 1 FYS per runda; FYS återfås med 1 per vecka och FYS 0 är döden.')],
    skills: {}, fear: [5, 10], noMorale: true,
    traits: ['Ande som är bunden vid en ouppfylld uppgift. Saknar kropp.'],
  },
  {
    id: 'svartalf', name: 'Svartalf', group: 'legendarisk', habitat: '3, 5, 8', frequency: 'ovanlig',
    attrs: { STY: 9, STO: 7, FYS: 11, SMI: 11, INT: 9, PSY: 11, KAR: 7 }, armor: 0, move: { L: 10 },
    attacks: [NAVAR(4), SPARK(4)],
    skills: { narstridsvapen: 4, avstandsvapen: 5, smyga: 7, gomma_sig: 7, upptacka_fara: 9, klattra: 5, rida: 4 }, darkvision: 'perfekt',
    traits: ['Rövarband som lyder sin ledare. Rider ofta på vargar.', 'Ser perfekt på natten men tål inte starkt solsken.', 'Fega i motgång. Kan aldrig lära sig magi.'],
  },
  {
    id: 'troll', name: 'Grottroll', group: 'legendarisk', habitat: '8', frequency: 'sällsynt', number: '1–5',
    attrs: { STY: 25, STO: 25, FYS: 13, SMI: 10, INT: 7, PSY: 11, KAR: 3 }, armor: 4, move: { L: 12 },
    attacks: [NAVAR(9), SPARK(4), a('Bett', 1, '1T6', 5, 'halv'), a('Klor', 2, '1T8', 7)],
    skills: { narstridsvapen: 4, smyga: 2, gomma_sig: 2, upptacka_fara: 4, klattra: 2 }, fear: [0, null], darkvision: 'perfekt',
    traits: [
      'Förstenas av rent solljus. Halverade FV på dagen.',
      'Den som ser ett troll närmare än 15 meter slår ett PSY-slag; misslyckas det slår hen på Skräcktabellen.',
      'Läker 3 KP per runda om skadan inte kommer från magi, eld eller magiska vapen.',
      'Måste klara ett PSY-slag för att gå närmare än 3 meter från eld.',
    ],
  },
  {
    id: 'vatte', name: 'Vätte', group: 'legendarisk', habitat: '8', frequency: 'sällsynt',
    attrs: { STY: 7, STO: 6, FYS: 11, SMI: 13, INT: 11, PSY: 11, KAR: 7 }, armor: 0, move: { L: 10 },
    attacks: [NAVAR(4), SPARK(4)],
    skills: { narstridsvapen: 5, avstandsvapen: 4, smyga: 14, gomma_sig: 16, upptacka_fara: 6, klattra: 10, rida: 4 }, darkvision: 'nattsyn',
    traits: ['Ser i mörker som människor på dagen, men inget i totalt mörker.', 'I starkt solsken: slå INT×3 eller lägre på 1T100, annars flyr den till skuggan.', 'Misstänksamma och giriga gruvbyggare.'],
  },
  {
    id: 'zombie', name: 'Zombie', group: 'legendarisk', frequency: 'sällsynt',
    attrs: { STY: 19, STO: 11, FYS: 0, SMI: 4, INT: 2, PSY: 2 }, armor: 0, move: { L: 8 },
    attacks: [], skills: { som_levande: '1T20', smyga: 19 }, darkvision: 'perfekt', noMorale: true,
    traits: ['Stanken ger illamående: klara ett FYS-slag eller bli oförmögen i en minut.', 'Känner ingen smärta och blöder inte. Behåller färdigheterna från livet utom de INT-baserade.'],
  },
];

export const CREATURES: Record<string, CreatureStats> = Object.fromEntries(CREATURE_LIST.map((c) => [c.id, c]));

/** Demoniska förmågor (1T20), egna sammanfattningar. */
export const DEMONIC_ABILITIES: string[] = [
  'Besudlar naturen omkring sig; växterna dör om den stannar länge.',
  'Kvävande stank vid varje utandning.',
  'Eldkvast: 2T10 i skada, 25 meters räckvidd.',
  'Två huvuden med egna INT och PSY.',
  'Exploderar när den dör: 1 i skada per STO, minus 1 per meter.',
  'Frätande blod: 1T6 i skada och −1 abs. Den som skadar den i närstrid slår under SMI för att undvika stänk.',
  'Kan åldra eller föryngra ett offer upp till 5 år (PSY mot PSY).',
  'Giftbett med giftstyrka lika med PSY.',
  'Jordbävning: alla inom 25 meter faller omkull.',
  'Anfaller alltid först i rundan.',
  'Suger ut 1T6 FYS för gott vid beröring (PSY mot PSY).',
  'Immun mot all magi.',
  'Får ett offer att glömma en färdighet eller besvärjelse för gott (PSY mot PSY).',
  'Kan bara skadas av magi och heliga eller magiska vapen.',
  'Läker 1T10 KP per runda.',
  'Suger ut 1T6 PSY för gott vid beröring (PSY mot PSY).',
  'Skräckslå 5/25.',
  'Suger ut 1T6 STY för gott vid beröring (PSY mot PSY).',
  'Vingar: flyger lika fort som den går.',
  'Naturligt skydd +1T10+1.',
];
