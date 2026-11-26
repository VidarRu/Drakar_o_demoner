import type { School, SpellDef, SpellDuration, SpellRange } from './types';

/**
 * Besvärjelserna i Bok III: allmänna, animism, elementarmagi och mentalism. Skolvärde,
 * räckvidd och varaktighet följer boken; beskrivningarna är egna och korta.
 * FROST har räckvidden tryckt som "Sx10 minuter" och tolkas som Sx10 rutor.
 */

const S = (mult: number, unit: 'rutor' | 'km'): SpellRange => ({ per: 'S', mult, unit });
const Sdiv = (div: number, unit: 'rutor' | 'km'): SpellRange => ({ per: 'S', div, unit });
const T = (mult: number, unit: 'SR' | 'minuter' | 'timmar' | 'dygn' | 'veckor'): SpellDuration => ({ per: 'S', mult, unit });
const Tdiv = (div: number, unit: 'SR' | 'minuter' | 'timmar' | 'dygn' | 'veckor'): SpellDuration => ({ per: 'S', div, unit });

function spell(
  school: School,
  sv: number,
  name: string,
  flags: string,
  range: SpellRange,
  duration: SpellDuration,
  desc: string,
  extra: Partial<SpellDef> = {},
): SpellDef {
  const id = name
    .toLowerCase()
    .replace(/[åä]/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/[^a-z]+/g, '_')
    .replace(/^_|_$/g, '');
  return {
    id,
    name,
    school,
    sv,
    physical: flags.includes('F'),
    quick: flags.includes('K'),
    ritual: flags.includes('R'),
    range,
    duration,
    desc,
    ...extra,
  };
}

export const SPELL_LIST: SpellDef[] = [
  // ---------------------------------------------------------------- allmänna
  spell('allmän', 6, 'ANTIMAGI', '', S(10, 'rutor'), Tdiv(4, 'minuter'), 'Magisk sköld kring en varelse eller ett föremål. Inkommande magi måste övervinna dess E, annars studsar den tillbaka.', { effect: { kind: 'antimagi' }, aim: 'valfri' }),
  spell('allmän', 6, 'SKINGRA', '', S(10, 'rutor'), 'omedelbar', 'Upphäver en annan besvärjelse om E övervinner dess E. Kan förstöra elementarer och avbryta en besvärjelse som håller på att läggas.', { effect: { kind: 'skingra' }, aim: 'valfri' }),
  spell('allmän', 6, 'VARSEBLIVNING', '', S(10, 'rutor'), 'omedelbar', 'Ger riktning och avstånd till det närmaste av något valt slag, en sak per E.', { effect: { kind: 'varseblivning' }, aim: 'själv' }),
  spell('allmän', 9, 'BESKYDDARE', '', 'beröring', 'permanent', 'Skyddande kub (3×3×3 m) som fungerar som ANTIMAGI E1 och ENERGISTRÅLE E1 mot allt som passerar.', { effect: { kind: 'beskyddare' }, aim: 'själv' }),
  spell('allmän', 14, 'FÖRYNGRA', 'R', 'beröring', Tdiv(4, 'veckor'), 'Gör kroppen E×5 år yngre för en tid. Bara de kroppsliga grundegenskaperna påverkas.', { effect: { kind: 'föryngra' }, aim: 'valfri' }),
  spell('allmän', 14, 'LADDNING', 'R', 'beröring', 'permanent', 'Lagrar 5 PSY per E i ett föremål, att använda i stället för egna PSY. Ett föremål kan laddas en gång.', { effect: { kind: 'laddning' }, aim: 'själv' }),

  // ---------------------------------------------------------------- animism
  spell('animism', 1, 'FINNA VATTEN', '', Sdiv(4, 'rutor'), 'omedelbar', 'Avstånd och riktning till drickbart vatten. Fungerar inte när det regnar. I spelet (Vidar): hittar alltid vatten, hur långt bort det än är.', { effect: { kind: 'finnaVatten' }, aim: 'själv' }),
  spell('animism', 2, 'TRÄELD', 'FK', 'beröring', 'omedelbar', 'Tänder ett stycke torrt trä, ett till per extra E. I spelet (Vidar): en kvist blir en fackla som brinner lika länge som en vanlig.', { effect: { kind: 'tända' }, aim: 'valfri' }),
  spell('animism', 4, 'SPÅRLÖS', '', 'beröring', Tdiv(4, 'minuter'), 'Lämnar varken spår eller lukt, en varelse till per extra E.', { effect: { kind: 'spårlös' }, aim: 'valfri' }),
  spell('animism', 5, 'VÄXTKUNSKAP', '', 'beröring', 'omedelbar', 'All kunskap om växter. I spelet (Vidar): hittar en ört som växer i närheten, 1T4 doser på en timme, som bereds med Drogkunskap eller Giftkunskap.', { effect: { kind: 'växtkunskap' }, aim: 'själv' }),
  spell('animism', 6, 'MINSKA', '', 'beröring', Tdiv(4, 'minuter'), 'Sänker STY, FYS, STO, KAR eller SMI med 1 per E, lägst till 1.', { effect: { kind: 'egenskap', sign: -1 }, aim: 'valfri' }),
  spell('animism', 6, 'NEDKALLA ÅSKVIGG', 'F', S(10, 'rutor'), 'omedelbar', 'Blixt ur ett regnmoln som regnar över både magikern och målet. Skadar som BLIXT.', { effect: { kind: 'skada', dice: '1T6', armor: 'ingen', loc: false, needsRain: true }, aim: 'fiende' }),
  spell('animism', 6, 'VINDPIL', 'F', S(2, 'rutor'), T(1, 'SR'), 'En träpil utan järnspets svävar framför ansiktet och skjuts iväg dit magikern tittar. 1T10 + 1 per E i skada (Vidar).', { effect: { kind: 'skada', dice: '1T10', armor: 'full', loc: true, fixed: true, perGrade: 1, projectile: true }, aim: 'fiende' }),
  spell('animism', 6, 'ÖKA', '', 'beröring', Tdiv(4, 'minuter'), 'Höjer STY, FYS, STO, KAR eller SMI med 1 per E.', { effect: { kind: 'egenskap', sign: 1 }, aim: 'valfri' }),
  spell('animism', 6, 'ÖRTRANKOR', 'F', 'särskild', T(1, 'SR'), 'Frön kastade (STY+SMI)/2 rutor snärjer offret. En E per 10 STO.', { effect: { kind: 'rankor' }, aim: 'fiende' }),
  spell('animism', 7, 'KAMOUFLAGE', '', 'personlig', Tdiv(4, 'minuter'), 'Magikern smälter in i naturen och kan inte upptäckas så länge hen står still.', { effect: { kind: 'kamouflage' }, aim: 'själv' }),
  spell('animism', 11, 'VINDKONTROLL', '', S(1, 'km'), T(1, 'timmar'), 'Ändrar vinden med E m/s och vrider den ett åttondels varv per E.', { effect: { kind: 'vindkontroll' }, aim: 'själv' }),
  spell('animism', 12, 'FÖRÄNDRA', '', S(2, 'rutor'), T(1, 'minuter'), 'Förvandlar djur, växt eller mineral till en annan form av samma slag. En E per 3 STO. I spelet: ett vapen i handen blir ett annat vapen, också ett järnvapen ett trävapen (Vidar).', { effect: { kind: 'förändra' }, aim: 'valfri' }),
  spell('animism', 12, 'HELA', '', 'beröring', 'omedelbar', 'Läker 1T6 KP per E på en levande varelse. Botar inte sjukdom.', { effect: { kind: 'läka', dice: '1T6' }, aim: 'valfri' }),
  spell('animism', 12, 'KÄNNA FIENDSKAP', '', S(2, 'rutor'), 'omedelbar', 'Känner om en intelligent varelse är fientligt inställd.', { effect: { kind: 'fiendskap' }, aim: 'valfri', resisted: true }),
  spell('animism', 13, 'REGNKONTROLL', '', Sdiv(4, 'km'), T(1, 'minuter'), 'Får molnen att regna, eller stoppar regnet.', { effect: { kind: 'regnkontroll' }, aim: 'själv' }),
  spell('animism', 15, 'DIMMA', '', S(10, 'rutor'), Tdiv(4, 'timmar'), 'Dimbank med högst 15 meters sikt. Kräver vatten i terrängen.', { effect: { kind: 'dimma' }, aim: 'valfri' }),
  spell('animism', 15, 'NEUTRALISERA GIFT', 'F', 'beröring', 'omedelbar', 'Tar bort 1T6+1 giftstyrka per E. Läker inte skada som redan skett.', { effect: { kind: 'motgift', dice: '1T6+1' }, aim: 'valfri' }),
  spell('animism', 2, 'TILLKALLA VARELSE', '', Sdiv(4, 'km'), 'omedelbar', 'Kallar till sig 20 STO ointelligenta djur per E. Inte människor och inte magiska varelser (Vidar).', { effect: { kind: 'tillkalla' }, aim: 'själv' }),
  spell('animism', 5, 'TALA MED VARELSE', '', 'personlig', T(1, 'minuter'), 'Samtal med ett ointelligent djur, med 1 FV i språket per E. Inte människor och inte magiska varelser (Vidar).', { effect: { kind: 'talaMed' }, aim: 'själv' }),
  spell('animism', 10, 'KONTROLLERA VARELSE', '', S(10, 'rutor'), T(1, 'SR'), 'Styr 20 STO ointelligenta djur per E genom telepati. Inte människor och inte magiska varelser (Vidar).', { effect: { kind: 'kontrollera', who: 'djur' }, aim: 'valfri', resisted: true }),

  // ---------------------------------------------------------------- elementarmagi
  spell('elementarmagi', 2, 'LJUS', 'F', S(10, 'rutor'), T(4, 'minuter'), 'Ett föremål lyser upp tre meter, tre meter till eller fem minuter till per extra E.', { effect: { kind: 'ljus' }, aim: 'valfri' }),
  spell('elementarmagi', 2, 'LÅGA', 'FK', 'personlig', { dice: '1T3', unit: 'SR' }, 'En liten låga ur tummen som tänder brännbart. I spelet (Vidar): tänder en kvist till en fackla.', { effect: { kind: 'tända', glow: true }, aim: 'själv' }),
  spell('elementarmagi', 3, 'FÖRSEGLA', 'F', 'beröring', T(1, 'minuter'), 'Sammanfogar två föremål, till exempel en dörr och karmen. Ger 20 KP extra.', { effect: { kind: 'försegla' }, aim: 'själv' }),
  spell('elementarmagi', 3, 'MÖRKER', 'F', S(10, 'rutor'), Tdiv(4, 'minuter'), 'Släcker allt ljus i en sfär med sex meters diameter.', { effect: { kind: 'mörker' }, aim: 'valfri' }),
  spell('elementarmagi', 3, 'SKÖLD', 'FK', 'personlig', 'omedelbar', 'Luften parerar en fysisk attack automatiskt med BV 4, +2 per extra E.', { effect: { kind: 'luftsköld' }, aim: 'själv' }),
  spell('elementarmagi', 4, 'FLAMMANDE HAND', 'F', 'beröring', { dice: '1T3', unit: 'minuter' }, 'Handen brinner och ger 1T3 extra skada per E.', { effect: { kind: 'flammandeHand' }, aim: 'valfri' }),
  spell('elementarmagi', 4, 'KALLA HANDEN', 'FK', Sdiv(2, 'rutor'), 'omedelbar', 'Köldstråle. Offret slår Svårt FYS-slag; misslyckas det kan offret inte göra något den rundan, annars −4 på CL.', { effect: { kind: 'köld' }, aim: 'fiende' }),
  spell('elementarmagi', 6, 'BLIXT', 'FK', S(10, 'rutor'), 'omedelbar', 'Blixt mot ett mål som magikern väljer: 1T6 per E från totala KP. Rustning skyddar inte.', { effect: { kind: 'skada', dice: '1T6', armor: 'ingen', loc: false }, aim: 'fiende' }),
  spell('elementarmagi', 6, 'ELD', 'F', S(10, 'rutor'), 'omedelbar', '1T6 per E i en eller flera sfärer, från totala KP. Rustning och SKYDD absorberar.', { effect: { kind: 'skada', dice: '1T6', armor: 'full', loc: false }, aim: 'fiende' }),
  spell('elementarmagi', 6, 'ENERGISTRÅLE', 'F', S(10, 'rutor'), 'omedelbar', 'Stråle mot ett mål: 1T6 per E, eller 1T3 per E i detaljerad strid. Träffar en kroppsdel.', { effect: { kind: 'skada', dice: '1T6', detailedDice: '1T3', armor: 'full', loc: true }, aim: 'fiende' }),
  spell('elementarmagi', 6, 'FROST', 'F', S(10, 'rutor'), 'omedelbar', 'Som ELD men med köld. Släcker eldar.', { effect: { kind: 'skada', dice: '1T6', armor: 'full', loc: false }, aim: 'fiende' }),
  spell('elementarmagi', 6, 'FÖRBANNA VAPEN', '', S(10, 'rutor'), T(1, 'minuter'), '−1 CL och −1 skada per E på ett vapen, eller sämre parering med en sköld.', { effect: { kind: 'vapen', sign: -1 }, aim: 'fiende' }),
  spell('elementarmagi', 6, 'FÖRTROLLA VAPEN', '', S(10, 'rutor'), T(1, 'minuter'), '+1 CL och +1 skada per E. Vapnet kan skada varelser som annars bara tar skada av magi.', { effect: { kind: 'vapen', sign: 1 }, aim: 'själv' }),
  spell('elementarmagi', 6, 'KNÄCKA', 'FK', S(2, 'rutor'), 'omedelbar', 'Sänker ett föremåls BV med 10, plus 2 per extra E.', { effect: { kind: 'knäcka', base: 10, perGrade: 2 }, aim: 'fiende' }),
  spell('elementarmagi', 6, 'ÖPPNA', 'F', 'beröring', 'omedelbar', 'Öppnar lås och lock. Kan bryta FÖRSEGLA.', { effect: { kind: 'öppna' }, aim: 'själv' }),
  spell('elementarmagi', 7, 'VIGGFÅNGARE', 'F', 'personlig', 'omedelbar', 'Under åska: lockar till sig en blixt (5T6) och omvandlar en del av skadan till PSY.', { effect: { kind: 'viggfångare' }, aim: 'själv' }),
  spell('elementarmagi', 8, 'VIRVELSKÖLD', 'F', 'personlig', T(1, 'SR'), 'Luftvirvel som stöter bort projektiler, åt båda hållen.', { effect: { kind: 'virvelsköld' }, aim: 'själv' }),
  // FRAMMANA/SKICKA BORT ELEMENTAR: varje sorts elementar är en egen besvärjelse (Bok III s. 21–22, 27).
  ...(
    [
      ['SYLF', 'luft', 'Luftens elementar: snabb, kan blåsa omkull och styra pilar. Skadas inte av vanliga vapen.'],
      ['SALAMANDER', 'eld', 'Eldens elementar: sveper in målet i lågor (1T6 per grad) och skadar vapen som träffar den.'],
      ['GNOM', 'jord', 'Jordens elementar: slår med nävarna (1T4 per grad, CL 6 + 2 per grad).'],
      ['UNDIN', 'vatten', 'Vattnets elementar: sveper in och dränker (1T8 per SR). Långsam på land.'],
      ['UMBRA', 'mörker', 'Mörkrets elementar: en glob av mörker och angrepp med skräck. Skadas inte av vanliga vapen.'],
      ['LUMINAL', 'ljus', 'Ljusets elementar: lyser upp och bländar. Skadas inte av vanliga vapen.'],
      ['GLACIAL', 'köld', 'Köldens elementar: kramar (1T4 per grad) och kyler vapen. Kräver något fruset att uppstå ur.'],
      ['THERM', 'värme', 'Värmens elementar: sveper in i hetta (1T4 per grad) och värmer vapen. Bara magi skadar den.'],
    ] as const
  ).map(([name, element, desc]) =>
    spell('elementarmagi', 9, `FRAMMANA ${name}`, 'F', S(10, 'rutor'), T(1, 'SR'), `${desc} Kan också skicka bort en elementar av samma sort.`, {
      effect: { kind: 'elementar', element },
      aim: 'valfri',
    }),
  ),
  spell('elementarmagi', 10, 'ASTRALVAPEN', 'F', Sdiv(2, 'rutor'), T(1, 'SR'), 'Ett eggvapen av magisk energi i handen med FV lika med S: 1T10 som enhandsvapen (E2), 2T10 som tvåhandsvapen (E4).', { effect: { kind: 'astralvapen' }, aim: 'själv' }),
  spell('elementarmagi', 11, 'EXPLOSION', 'FK', S(10, 'rutor'), 'omedelbar', '5 per E i skada inom E meter, minus 1 per ruta utanför. Bländar alla som ser den.', { effect: { kind: 'explosion', perGrade: 5 }, aim: 'fiende' }),

  // ---------------------------------------------------------------- mentalism
  spell('mentalism', 1, 'SPRÅNG', 'K', 'beröring', Tdiv(4, 'SR'), 'Jättesprång: 4 m långt och 2 m högt per E. Normalt SMI-slag vid landningen.', { effect: { kind: 'språng' }, aim: 'valfri' }),
  spell('mentalism', 3, 'MOTSTÅNDSKRAFT', '', 'beröring', T(1, 'minuter'), 'Minskar skada av hetta och köld med 1 per E och attack.', { effect: { kind: 'motståndskraft' }, aim: 'valfri' }),
  spell('mentalism', 4, 'LEVITATION', '', 'personlig', T(1, 'minuter'), 'Stiger rakt upp 5 m per E med upp till 50 kg packning.', { effect: { kind: 'levitation' }, aim: 'själv' }),
  spell('mentalism', 5, 'KÄNSLOLÄSNING', '', S(2, 'rutor'), Tdiv(4, 'SR'), 'Läser av en varelses känslor och om den är vänligt eller fientligt inställd.', { effect: { kind: 'fiendskap' }, aim: 'valfri', resisted: true }),
  spell('mentalism', 6, 'LYFT', '', S(4, 'rutor'), T(1, 'minuter'), 'Lyfter 3 STO per E och flyttar det två rutor per runda, plus en per extra E.', { effect: { kind: 'lyft' }, aim: 'valfri' }),
  spell('mentalism', 6, 'SKYDD', '', S(2, 'rutor'), Tdiv(4, 'minuter'), '+1 abs per E på hela kroppen.', { effect: { kind: 'skydd', perGrade: 1 }, aim: 'valfri' }),
  spell('mentalism', 6, 'TANKEÖVERFÖRING', '', S(10, 'rutor'), T(1, 'SR'), 'Ljudlös kontakt med ytliga tankar och känslor, en varelse per E.', { effect: { kind: 'tankar', mode: 'överföring' }, aim: 'valfri' }),
  spell('mentalism', 7, 'VATTENANDNING', '', 'beröring', T(1, 'timmar'), 'Andas under vatten på vilket djup som helst.', { effect: { kind: 'vattenandning' }, aim: 'valfri' }),
  spell('mentalism', 8, 'FLYGA', '', 'beröring', Tdiv(4, 'timmar'), 'Flyger E×5 rutor per runda. En extra E per 20 STO över de första 20.', { effect: { kind: 'flyga' }, aim: 'valfri' }),
  spell('mentalism', 8, 'LÄDERHUD', '', 'personlig', T(1, 'timmar'), 'Huden ger 2 i naturligt skydd men KAR −2.', { effect: { kind: 'skydd', fixed: 2 }, aim: 'själv' }),
  spell('mentalism', 8, 'MÖRKERSYN', '', 'beröring', T(1, 'timmar'), 'Ser värme. Fungerar inte i ljus eller nära starka värmekällor.', { effect: { kind: 'mörkersyn' }, aim: 'valfri' }),
  spell('mentalism', 9, 'OSYNLIGHET', '', 'beröring', T(1, 'minuter'), 'Gör 6 STO osynliga per E. Bryts om den osynlige slåss, springer, lägger magi eller skadas.', { effect: { kind: 'osynlighet' }, aim: 'valfri' }),
  spell('mentalism', 9, 'SYN', '', 'personlig', T(1, 'SR'), 'Ser och hör ett känt ställe inom 120 m (annars 30 m), en dag bakåt per extra E. Identifierar magiska föremål. I spelet (Vidar): identifierar magiska föremål, och modulerna kan ge den scener.', { effect: { kind: 'syn' }, aim: 'själv' }),
  spell('mentalism', 10, 'ELCHOCK', 'FK', 'beröring', 'omedelbar', '1T4 per E på den som berörs. Metallrustning skyddar bara till hälften.', { effect: { kind: 'skada', dice: '1T4', armor: 'halvMetall', loc: true }, aim: 'fiende' }),
  spell('mentalism', 11, 'TANKELÄSNING', '', S(2, 'rutor'), T(1, 'minuter'), 'Läser en intelligent varelses tankar utan att den märker det.', { effect: { kind: 'tankar', mode: 'läsning' }, aim: 'valfri' }),
  spell('mentalism', 12, 'KONTROLLERA PERSON', '', S(4, 'rutor'), T(1, 'SR'), 'Styr en humanoids kropp, en per E. PSY mot PSY.', { effect: { kind: 'kontrollera', who: 'person' }, aim: 'fiende', resisted: true }),
  spell('mentalism', 12, 'TELEPATI', '', 'särskild', T(1, 'minuter'), 'Tankekontakt på vilket avstånd som helst med någon man känner till namnet, en person till per extra E.', { effect: { kind: 'tankar', mode: 'telepati' }, aim: 'själv' }),
  spell('mentalism', 12, 'TELEPORTERA', '', 'beröring', 'omedelbar', 'Flyttar 3 STO per E till en välkänd plats inom 100 m, längre med extra E.', { effect: { kind: 'teleportera' }, aim: 'valfri' }),
  spell('mentalism', 13, 'MAGISK SYN', '', 'beröring', T(1, 'minuter'), 'Ser det osynliga och skyddar mot besvärjelser som förblindar.', { effect: { kind: 'magiskSyn' }, aim: 'valfri' }),
  spell('mentalism', 14, 'ORÄDD', '', 'beröring', T(1, 'minuter'), 'Behöver inte slå på Skräcktabellen.', { effect: { kind: 'orädd' }, aim: 'valfri' }),
];

export const SPELLS: Record<string, SpellDef> = Object.fromEntries(SPELL_LIST.map((s) => [s.id, s]));

/** Räckvidd i rutor eller kilometer för ett skicklighetsvärde S. */
export function spellRange(range: SpellRange, s: number, extraGrades = 0): { value: number; unit: 'rutor' | 'km' } | null {
  if (typeof range === 'string') return null;
  const base = range.mult ? s * range.mult : s / (range.div ?? 1);
  // Kort räckvidd avrundas nedåt; extrem räckvidd (S/4 km) avrundas inte.
  const value = range.unit === 'rutor' ? Math.floor(base) : base;
  return { value: value * (1 + extraGrades), unit: range.unit };
}
