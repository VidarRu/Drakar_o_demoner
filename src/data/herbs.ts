import type { PoisonType } from '../engine/rules/poison';
import type { Scope } from '../engine/rules/outcomes';

/**
 * Örter och växter (Bok II s. 50–56): läkedroger, allmänna droger och gifter. Namn, vanlighet,
 * intagning, växtplats och giftets STY följer boken; beskrivningarna är egna och korta.
 *
 * Vanligheten dras från FV när man letar (CL minst 1), avgör om en handlare har drogen
 * (1T10 över vanligheten) och priset (vanligheten upphöjt till tre, i silvermynt).
 */

export type HerbKind = 'läkedrog' | 'drog' | 'gift';

/** Det spelmotorn kan göra med en drog. Droger utan effekt här beskrivs men verkar inte i spelet än. */
export type HerbEffect =
  /** Läker KP i totala KP och de skadade kroppsdelarna, efter så här många minuter. */
  | { kind: 'läka'; dice: string; minutes?: number }
  /** Stoppar blödningen i alla kroppsdelar, eller i en. */
  | { kind: 'blödning'; all: boolean }
  /** Sänker ett gifts STY, eller häver ett visst gift helt. */
  | { kind: 'motgift'; amount: number | string; only?: string }
  /** Hejdar kallbrand: infektionen blir vanlig igen. */
  | { kind: 'kallbrand' }
  /** Färska sår från striden infekteras inte. */
  | { kind: 'desinficera' }
  /** Ändrar chansen att sår från nästa strid infekteras. */
  | { kind: 'infektionsrisk'; factor: number }
  /** Tar bort febern från en infektion i ett dygn. */
  | { kind: 'feber' }
  /** Modifikation på CL en tid. */
  | { kind: 'cl'; scope: Scope; mod: number; rounds: string }
  /** Mörkersyn en tid. */
  | { kind: 'mörkersyn'; rounds: string }
  /** Som besvärjelsen ORÄDD: inga slag på Skräcktabellen. */
  | { kind: 'orädd'; minutes: number }
  /** Ersätter en natts sömn (färdigheter kan ge EP igen). */
  | { kind: 'sömn' }
  /** Nästa besvärjelse kostar halva PSY. */
  | { kind: 'halvPsy' };

/** Särskilda följder av gifter som inte är av någon av de fem typerna. */
export type PoisonSpecial =
  | { kind: 'cl'; mod: number; minutes: number }
  | { kind: 'medvetslös'; hours?: string; days?: string }
  | { kind: 'död'; hours?: string }
  /** Kroppsdelen som giftet kom in genom kan inte användas, eller förloras för alltid. */
  | { kind: 'lem'; hours?: string }
  | { kind: 'blind'; days?: string }
  | { kind: 'ingenHandling'; hours: string }
  | { kind: 'bärsärk' }
  | { kind: 'smiHalv'; hours: string }
  | { kind: 'infektionsrisk'; factor: number }
  /** Grundegenskapen sjunker för alltid till ett visst värde. */
  | { kind: 'sänk'; attr: 'STY'; to: number };

export interface HerbDef {
  id: string;
  name: string;
  kind: HerbKind;
  /** Extremt okända droger: lönnmördare drar bort 10 från vanligheten. */
  rare?: boolean;
  /** Vanlighetssiffran. */
  common: number;
  intake: string;
  habitat: string;
  /** Växer inte vilt (odlas i örtagårdar). */
  cultivated?: boolean;
  desc: string;
  effects?: HerbEffect[];
  poison?: { sty: number; type?: PoisonType; special?: PoisonSpecial; byWound?: boolean };
}

type H = [id: string, name: string, common: number, intake: string, habitat: string, desc: string, extra?: Partial<HerbDef>];
const group = (kind: HerbKind, items: H[], rare = false): HerbDef[] =>
  items.map(([id, name, common, intake, habitat, desc, extra]) => ({
    id,
    name,
    kind,
    common,
    intake,
    habitat: habitat.replace(/\*$/, ''),
    desc,
    ...(habitat.endsWith('*') ? { cultivated: true } : {}),
    ...(rare ? { rare } : {}),
    ...extra,
  }));

const heal = (dice: string, minutes?: number): Partial<HerbDef> => ({ effects: [{ kind: 'läka', dice, ...(minutes ? { minutes } : {}) }] });
const gift = (sty: number, type?: PoisonType, special?: PoisonSpecial, byWound = false): Partial<HerbDef> => ({
  poison: { sty, ...(type ? { type } : {}), ...(special ? { special } : {}), ...(byWound ? { byWound } : {}) },
});

export const HERB_LIST: HerbDef[] = [
  ...group('läkedrog', [
    ['alvhandsbuske', 'Alvhandsbuske', 7, 'appliceras', 'Ljus lövskog', 'Stillar alla blödningar.', { effects: [{ kind: 'blödning', all: true }] }],
    ['benhele', 'Benhele', 3, 'drickes', 'Kusttrakter', 'Lindrar benbrott så att de läker på halva tiden.'],
    ['cepirbuske', 'Cepirbuske', 1, 'drickes', 'Överallt', 'Läker 1 KP på en minut.', heal('1', 1)],
    ['domarbunke', 'Domarbunke', 5, 'appliceras', 'Blandskog', 'Läker små skärsår.'],
    ['draklovsek', 'Draklövsek', 3, 'drickes', 'Skog', 'Läker 1T6 KP under en kvart.', heal('1T6', 15)],
    ['gronblara', 'Grönblära', 3, 'tuggas', 'Skog', 'Motgift som sänker ett gifts STY med 5.', { effects: [{ kind: 'motgift', amount: 5 }] }],
    ['havssippa', 'Havssippa', 4, 'ätes', 'Saltvattenshav', 'Läker sträckningar.'],
    ['honungslilja', 'Honungslilja', 9, 'drickes', 'Ljus, fuktig blandskog', 'Läker 1T20 KP på en gång.', heal('1T20')],
    ['horblomster', 'Horblomster', 7, 'drickes', 'Bergstrakter', 'Stillar magont.'],
    ['hundora', 'Hundöra', 3, 'drickes', 'Kalla klimat', 'Lindrar insektsbett i en timme.'],
    ['istappslav', 'Istappslav', 6, 'ätes', 'Barrskog', 'Stärker kroppen mot sjukdom: +5 på FYS mot sjukdomar i två dagar.'],
    ['kardiskt_vildvin', 'Kardiskt vildvin', 7, 'tuggas', 'Blandskog i kalla klimat', 'Läker 1T6 KP brännskador.'],
    ['klomossa', 'Klomossa', 5, 'drickes', 'Lövskog', 'Skyddar mot naturlig hetta.'],
    ['klubblomster', 'Klubblomster', 4, 'drickes', 'Blandskog', 'Läker 2T4 KP skada från krossvapen.'],
    ['kokongtrad', 'Kokongträd', 7, 'drickes', 'Barrskog', 'Läker 3T6 KP på en minut.', heal('3T6', 1)],
    ['kontera', 'Kontera', 3, 'appliceras', 'Lövskog', 'Tar bort blåmärken.'],
    ['kronhjortshorn', 'Kronhjortshorn', 2, 'drickes', 'Skog', 'Läker 1T4 KP inom en halvtimme.', heal('1T4', 15)],
    ['kronlonn', 'Kronlönn', 5, 'appliceras', 'Lövskog', 'Läker lindriga benbrott och stukningar.'],
    ['krakflader', 'Kråkfläder', 2, 'appliceras', 'Skog', 'Stillar en mindre blödning.', { effects: [{ kind: 'blödning', all: false }] }],
    ['koldnapsa', 'Köldnäpsa', 5, 'appliceras', 'Lövskog', 'Lindrar köldskador.'],
    ['malmros', 'Malmros', 4, 'drickes', 'Örtagårdar*', 'Sänker febern.', { effects: [{ kind: 'feber' }] }],
    ['mirenbuske', 'Mirenbuske', 6, 'ätes', 'Snårskog', 'Läker 10 KP på en gång.', heal('10')],
    ['myrblisterbuske', 'Myrblisterbuske', 9, 'drickes', 'Myrar vid trädgränsen', 'Läker 2T20 KP på tio minuter.', heal('2T20', 10)],
    ['martistel', 'Mårtistel', 6, 'appliceras', 'Torrlagda diken', 'Läker insektsbett och sänker ett gifts STY med 2T10.', { effects: [{ kind: 'motgift', amount: '2T10' }] }],
    ['rodbar', 'Rödbär', 6, 'ätes', 'Ängar', 'Läker 1T10 KP inom en minut.', heal('1T10', 1)],
    ['rodstrimmig_spindelskivling', 'Rödstrimmig spindelskivling', 9, 'appliceras', 'Lövskog', 'Hejdar kallbrand.', { effects: [{ kind: 'kallbrand' }] }],
    ['saltsopp', 'Saltsopp', 8, 'ätes', 'Saltvattensträsk', 'Halverar risken att sår infekteras.', { effects: [{ kind: 'infektionsrisk', factor: 0.5 }] }],
    ['sarlindringslark', 'Sårlindringslärk', 8, 'drickes', 'Barrskog', 'Läker 2T10 KP och renar såren.', { effects: [{ kind: 'läka', dice: '2T10' }, { kind: 'desinficera' }] }],
    ['tandort', 'Tandört', 1, 'ångan inhaleras', 'Överallt', 'Lindrar snuva.'],
    ['tagvirkestang', 'Tågvirkestång', 9, 'drickes', 'Kuster', 'Läker 1T10 KP köldskador.'],
    ['argangsmistel', 'Årgångsmistel', 5, 'drickes', 'Lövskog', 'Lindrar huvudvärk och läker 2 KP.', heal('2')],
    ['alghornsen', 'Älghornsen', 2, 'ätes', 'Varma klimat', 'Läker 1T6 KP på en timme.', heal('1T6', 60)],
    ['alskogsort', 'Älskogsört', 6, 'drickes', 'Lövskog', 'Motgift som sänker ett gifts STY med 15.', { effects: [{ kind: 'motgift', amount: 15 }] }],
    ['ortugsblomma', 'Örtugsblomma', 7, 'drickes', 'Över 1 000 m ö.h.', 'Löser upp blodproppar och häver ismossans gift.', { effects: [{ kind: 'motgift', amount: 0, only: 'ismossa' }] }],
  ]),
  ...group('drog', [
    ['apellind', 'Apellind', 7, 'drickes', 'Urskog', 'Verkar som besvärjelsen ANTIMAGI.'],
    ['dalig_mans_fralsare', 'Dålig mans frälsare', 8, 'tuggas', 'Kalfjäll', 'Höjer potensen.'],
    ['forte', 'Forte', 7, 'drickes varm', 'Lövskog', 'Fördubblar STY i 1T4 SR.'],
    ['galdermossa', 'Galdermossa', 7, 'tuggas', 'Blandskog', 'Verkar som besvärjelsen ORÄDD.', { effects: [{ kind: 'orädd', minutes: 10 }] }],
    ['glavbladsklocka', 'Glavbladsklocka', 3, 'drickes', 'Skog', 'Ger mörkersyn i 1T4 SR.', { effects: [{ kind: 'mörkersyn', rounds: '1T4' }] }],
    ['gronfraken', 'Grönfräken', 5, 'drickes', 'Lövskog', 'Sömnmedel med STY 4.', gift(4, undefined, { kind: 'medvetslös', hours: '1T6' })],
    ['holkebar', 'Holkebär', 1, 'strykes på', 'Överallt', 'Skyddar mot solbränna.'],
    ['harstjalk', 'Hårstjälk', 4, 'ätes', 'Bergstrakter', 'Höjer SMI med 4 i 3 SR.'],
    ['indigolilja', 'Indigolilja', 9, 'drickes', 'Lövskog', 'Låter användaren handla dubbelt så snabbt.'],
    ['isskojsbar', 'Isskojsbär', 2, 'tuggas', 'Uttorkade flodbäddar', 'Stillar hungern i två timmar.'],
    ['isterparon', 'Isterpäron', 5, 'ätes', 'Barrskog', 'Skärper lukt och smak.'],
    ['karsonblomster', 'Karsonblomster', 3, 'anbringas', 'Torra sydsluttningar', 'Blandad med en läkedrog verkar den med halv styrka även på djur.'],
    ['klammerormbunke', 'Klammerormbunke', 8, 'rökes', 'Örtagårdar*', 'Skickar ett kort tankemeddelande till en nära vän inom 50 meter.'],
    ['klyvranka', 'Klyvranka', 6, 'drickes', 'Skog', 'Berusar som stark sprit, utan baksmälla. Vanebildande.'],
    ['minnesrot', 'Minnesrot', 5, 'ätes', 'Ängar', 'Det man upplever medan man äter roten glömmer man aldrig.'],
    ['monsterros', 'Mönsterros', 6, 'drickes', 'Barrskog', '+5 på besvärjelser men −10 på allt annat i 1T4 SR.', {
      effects: [
        { kind: 'cl', scope: 'magi', mod: 5, rounds: '1T4' },
        { kind: 'cl', scope: 'ejMagi', mod: -10, rounds: '1T4' },
      ],
    }],
    ['nelevsippa', 'Nelevsippa', 5, 'tuggas', 'Ängar', 'En stjälk ersätter en natts sömn.', { effects: [{ kind: 'sömn' }] }],
    ['ruriksort', 'Ruriksört', 8, 'tuggas', 'Örtagårdar*', 'Nästa besvärjelse kostar halva PSY.', { effects: [{ kind: 'halvPsy' }] }],
    ['vargtass', 'Vargtass', 1, 'drickes', 'Överallt', '+5 på alla vapenfärdigheter i 1 SR.', { effects: [{ kind: 'cl', scope: 'strid', mod: 5, rounds: '1' }] }],
    ['vattenmara', 'Vattenmåra', 6, 'ätes', 'Kustområden', 'Andas under vatten i 2T20 SR.'],
  ]),
  ...group('gift', [
    ['allvarsronn', 'Allvarsrönn', 4, 'genom sår', 'Kalla klimat', 'STY 5. Tredubblar risken att såret infekteras.', gift(5, undefined, { kind: 'infektionsrisk', factor: 3 }, true)],
    ['arvssynden', 'Arvssynden', 7, 'drickes', 'Tundra', 'STY 15. Angriper andningsvägarna.', gift(15, 'andning')],
    ['dubbelstjalkad_korsort', 'Dubbelstjälkad korsört', 2, 'drickes', 'Skog', 'STY 6. Slår ut matsmältningen.', gift(6, 'funktion')],
    ['gravstensalm', 'Gravstensalm', 4, 'drickes', 'Barrskog', 'STY 8. Häftig magsjuka: offret måste vila i 1T4 timmar.', gift(8, undefined, { kind: 'ingenHandling', hours: '1T4' })],
    ['halmbar', 'Halmbär', 9, 'drickes', 'Mörka sydsluttningar i barrskog', 'STY 30. Musklerna förtvinar och STY sjunker för alltid till 4.', gift(30, undefined, { kind: 'sänk', attr: 'STY', to: 4 })],
    ['hirtonbuske', 'Hirtonbuske', 7, 'drickes', 'Bokskog', 'STY 12. Offret blir blint i 2T6 dagar.', gift(12, undefined, { kind: 'blind', days: '2T6' })],
    ['ismossa', 'Ismossa', 5, 'genom föda', 'Under snötäcken', 'STY 14. Blodet levrar sig och offret dör inom 1T100 timmar.', gift(14, undefined, { kind: 'död', hours: '1T100' })],
    ['jagarbane', 'Jägarbane', 3, 'drickes', 'Blandskog', 'STY 8. −5 på alla färdigheter i en timme.', gift(8, undefined, { kind: 'cl', mod: -5, minutes: 60 })],
    ['klisterfraken', 'Klisterfräken', 5, 'drickes', 'Örtagårdar*', 'STY 9. Offret är oförmöget till annat än att uträtta sina behov i 3T4 timmar.', gift(9, undefined, { kind: 'ingenHandling', hours: '3T4' })],
    ['klotrund_roksvamp', 'Klotrund röksvamp', 8, 'genom ögon eller näsa', 'Kalkrik mark vid saltvatten', 'STY 20. Förstör synen och luktsinnet.', gift(20, undefined, { kind: 'blind' })],
    ['korpgladje', 'Korpglädje', 9, 'genom föda', 'Under snötäcken', 'STY 35. Dödar på stället.', gift(35, undefined, { kind: 'död' })],
    ['krigarfasa', 'Krigarfasa', 7, 'genom sår', 'Åkerkanter', 'STY 12. Kroppsdelen förlamas i 3T6 timmar.', gift(12, undefined, { kind: 'lem', hours: '3T6' }, true)],
    ['krakmossa', 'Kråkmossa', 7, 'ätes', 'Bergstrakter', 'STY 11. Offret faller i koma i 2T6 dagar.', gift(11, undefined, { kind: 'medvetslös', days: '2T6' })],
    ['larktradsticka', 'Lärkträdsticka', 7, 'ätes', 'På lärkträd', 'STY 17. Offret blir blödarsjukt i 1T4 veckor.', gift(17)],
    ['marklandsort', 'Marklandsört', 1, 'drickes', 'Överallt', 'STY 5. Näsa och öron blir knallröda och lukt och hörsel försvinner i 10 SR.', gift(5)],
    ['ofardssvamp', 'Ofärdssvamp', 5, 'ätes', 'Under plommonträd', 'STY 10. Offret går bärsärkagång.', gift(10, undefined, { kind: 'bärsärk' })],
    ['spikklubbsort', 'Spikklubbsört', 3, 'med föda', 'Åkerkanter', 'STY 5. Nervgift.', gift(5, 'nerv')],
    ['stumningsmossa', 'Stumningsmossa', 5, 'genom sår', 'Varma klimat', 'STY 5. Kroppsdelen kan inte användas på tre timmar.', gift(5, undefined, { kind: 'lem', hours: '3' }, true)],
    ['tistelbar', 'Tistelbär', 9, 'genom sår', 'Vulkanområden', 'STY 20. Kroppsdelen går förlorad på stället.', gift(20, undefined, { kind: 'lem' }, true)],
    ['tumstocksmistel', 'Tumstocksmistel', 8, 'genom föda', 'Torr morän', 'STY 18. STY sjunker till 3 i 1T4 dagar.', gift(18)],
    ['artbarsbuske', 'Ärtbärsbuske', 2, 'ätes', 'Överallt', 'STY 6. Muskelgift.', gift(6, 'muskel')],
    ['odletungslav', 'Ödletungslav', 6, 'genom föda', 'Kalfjäll', 'STY 21. Ingen fast föda på tre veckor, och FYS och STY halveras under tiden.', gift(21)],
  ]),
  ...group(
    'gift',
    [
      ['allemansstympare', 'Allemansstympare', 16, 'genom sår', 'Skog', 'STY 6. Angriper blodomloppet.', gift(6, 'blod', undefined, true)],
      ['alvglans', 'Alvglans', 18, 'inandas', 'Rågfält', 'STY 20. Offret blir viljelöst och lyder lönnmördaren i 1T2 timmar.', gift(20)],
      ['asblomster', 'Asblomster', 19, 'genom sår', 'Blandskog', 'STY 25. Angriper andningsvägarna.', gift(25, 'andning', undefined, true)],
      ['etterbuske', 'Etterbuske', 17, 'genom sår', 'Över 1 000 m ö.h.', 'Tredubblar risken för infektion och kallbrand.', gift(0, undefined, { kind: 'infektionsrisk', factor: 3 }, true)],
      ['falsk_dvarggran', 'Falsk dvärggran', 16, 'genom sår', 'Granskogar', 'STY 10. Muskelgift.', gift(10, 'muskel', undefined, true)],
      ['havsnackros', 'Havsnäckros', 18, 'genom sår', 'Sandstränder', 'STY 18. Nervgift.', gift(18, 'nerv', undefined, true)],
      ['kolalg', 'Kolalg', 15, 'genom föda', 'Sötvatten', 'STY 7. Lederna stelnar och SMI halveras i 1T4 timmar.', gift(7, undefined, { kind: 'smiHalv', hours: '1T4' })],
      ['kranbane', 'Kranbane', 19, 'genom näsan', 'Åkrar i träda', 'STY 50. Fräter sönder huvudet inifrån på tre timmar.', gift(50, undefined, { kind: 'död', hours: '3' })],
      ['saltalg', 'Saltalg', 15, 'sprutas i ögonen', 'Saltvatten', 'STY 10. Slår ut synen.', gift(10, undefined, { kind: 'blind', days: '1T6' })],
      ['tokfrans', 'Tokfrans', 18, 'inandas', 'Saltvatten', 'STY 22. STY och FYS +2 men PSY och INT −4 i 1T10 minuter.', gift(22)],
      ['traskvattenslilja', 'Träskvattenslilja', 15, 'inandas', 'Sankmarker', 'STY 12. Medvetslöshet med mardrömmar, och minnet av de senaste två timmarna försvinner.', gift(12, undefined, { kind: 'medvetslös', hours: '1T4' })],
    ],
    true,
  ),
  ...group(
    'läkedrog',
    [
      ['underort', 'Underört', 19, 'drickes', 'Örtagårdar*', 'Verkar som besvärjelsen SPÅDOM.'],
      ['undervattensros', 'Undervattensros', 18, 'drickes', 'Vid vattendrag i lövskog', 'Stillar blödningar.', { effects: [{ kind: 'blödning', all: true }] }],
      ['utomgardsbar', 'Utomgårdsbär', 17, 'appliceras på sår', 'Örtagårdar*', 'Läker 15 KP på en timme.', heal('15', 60)],
    ],
    true,
  ),
  ...group('drog', [['blarot', 'Blårot', 12, 'ätes färsk', 'Överallt', 'En rot ersätter en måltid och två timmars sömn.']], true),
];

export const HERBS: Record<string, HerbDef> = Object.fromEntries(HERB_LIST.map((h) => [h.id, h]));

/** Pris i silvermynt: vanligheten upphöjt till tre. */
export function herbPrice(h: HerbDef): number {
  return h.common ** 3;
}

/** Färdigheten som används för att hitta och bereda drogen. */
export function herbSkill(h: HerbDef): 'ortkunskap' | 'drogkunskap' | 'giftkunskap' {
  return h.kind === 'läkedrog' ? 'ortkunskap' : h.kind === 'drog' ? 'drogkunskap' : 'giftkunskap';
}

/** Har drogen någon verkan i spelet? */
export function herbWorks(h: HerbDef): boolean {
  return !!h.effects?.length || !!h.poison?.type || !!h.poison?.special;
}
