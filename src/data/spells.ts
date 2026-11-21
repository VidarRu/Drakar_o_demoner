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
  spell('allmän', 6, 'ANTIMAGI', '', S(10, 'rutor'), Tdiv(4, 'minuter'), 'Magisk sköld kring en varelse eller ett föremål. Inkommande magi måste övervinna dess E, annars studsar den tillbaka.'),
  spell('allmän', 6, 'SKINGRA', '', S(10, 'rutor'), 'omedelbar', 'Upphäver en annan besvärjelse om E övervinner dess E. Kan förstöra elementarer och avbryta en besvärjelse som håller på att läggas.'),
  spell('allmän', 6, 'VARSEBLIVNING', '', S(10, 'rutor'), 'omedelbar', 'Ger riktning och avstånd till det närmaste av något valt slag, en sak per E.'),
  spell('allmän', 9, 'BESKYDDARE', '', 'beröring', 'permanent', 'Skyddande kub (3×3×3 m) som fungerar som ANTIMAGI E1 och ENERGISTRÅLE E1 mot allt som passerar.'),
  spell('allmän', 14, 'FÖRYNGRA', 'R', 'beröring', Tdiv(4, 'veckor'), 'Gör kroppen E×5 år yngre för en tid. Bara de kroppsliga grundegenskaperna påverkas.'),
  spell('allmän', 14, 'LADDNING', 'R', 'beröring', 'permanent', 'Lagrar 5 PSY per E i ett föremål, att använda i stället för egna PSY. Ett föremål kan laddas en gång.'),

  // ---------------------------------------------------------------- animism
  spell('animism', 1, 'FINNA VATTEN', '', Sdiv(4, 'rutor'), 'omedelbar', 'Avstånd och riktning till drickbart vatten. Fungerar inte när det regnar.'),
  spell('animism', 2, 'TRÄELD', 'FK', 'beröring', 'omedelbar', 'Tänder ett stycke torrt trä, ett till per extra E.'),
  spell('animism', 4, 'SPÅRLÖS', '', 'beröring', Tdiv(4, 'minuter'), 'Lämnar varken spår eller lukt, en varelse till per extra E.'),
  spell('animism', 5, 'VÄXTKUNSKAP', '', 'beröring', 'omedelbar', 'All kunskap om den växt man rör vid.'),
  spell('animism', 6, 'MINSKA', '', 'beröring', Tdiv(4, 'minuter'), 'Sänker STY, FYS, STO, KAR eller SMI med 1 per E, lägst till 1.'),
  spell('animism', 6, 'NEDKALLA ÅSKVIGG', 'F', S(10, 'rutor'), 'omedelbar', 'Blixt ur ett regnmoln som regnar över både magikern och målet. Skadar som BLIXT.'),
  spell('animism', 6, 'VINDPIL', 'F', S(2, 'rutor'), T(1, 'SR'), 'En träpil utan järnspets svävar framför ansiktet och skjuts iväg dit magikern tittar.'),
  spell('animism', 6, 'ÖKA', '', 'beröring', Tdiv(4, 'minuter'), 'Höjer STY, FYS, STO, KAR eller SMI med 1 per E.'),
  spell('animism', 6, 'ÖRTRANKOR', 'F', 'särskild', T(1, 'SR'), 'Frön kastade (STY+SMI)/2 rutor snärjer offret. En E per 10 STO.'),
  spell('animism', 7, 'KAMOUFLAGE', '', 'personlig', Tdiv(4, 'minuter'), 'Magikern smälter in i naturen och kan inte upptäckas så länge hen står still.'),
  spell('animism', 11, 'VINDKONTROLL', '', S(1, 'km'), T(1, 'timmar'), 'Ändrar vinden med E m/s och vrider den ett åttondels varv per E.'),
  spell('animism', 12, 'FÖRÄNDRA', '', S(2, 'rutor'), T(1, 'minuter'), 'Förvandlar djur, växt eller mineral till en annan form av samma slag. En E per 3 STO.'),
  spell('animism', 12, 'HELA', '', 'beröring', 'omedelbar', 'Läker 1T6 KP per E på en levande varelse. Botar inte sjukdom.'),
  spell('animism', 12, 'KÄNNA FIENDSKAP', '', S(2, 'rutor'), 'omedelbar', 'Känner om en intelligent varelse är fientligt inställd.'),
  spell('animism', 13, 'REGNKONTROLL', '', Sdiv(4, 'km'), T(1, 'minuter'), 'Får molnen att regna, eller stoppar regnet.'),
  spell('animism', 15, 'DIMMA', '', S(10, 'rutor'), Tdiv(4, 'timmar'), 'Dimbank med högst 15 meters sikt. Kräver vatten i terrängen.'),
  spell('animism', 15, 'NEUTRALISERA GIFT', 'F', 'beröring', 'omedelbar', 'Tar bort 1T6+1 giftstyrka per E. Läker inte skada som redan skett.'),
  spell('animism', 2, 'TILLKALLA VARELSE', '', Sdiv(4, 'km'), 'omedelbar', 'Kallar till sig 20 STO varelser per E ur en viss grupp.', { perCreatureGroup: true }),
  spell('animism', 5, 'TALA MED VARELSE', '', 'personlig', T(1, 'minuter'), 'Samtal med en varelse ur en viss grupp, med 1 FV i språket per E.', { perCreatureGroup: true }),
  spell('animism', 10, 'KONTROLLERA VARELSE', '', S(10, 'rutor'), T(1, 'SR'), 'Styr 20 STO varelser per E ur en viss grupp genom telepati.', { perCreatureGroup: true }),

  // ---------------------------------------------------------------- elementarmagi
  spell('elementarmagi', 2, 'LJUS', 'F', S(10, 'rutor'), T(4, 'minuter'), 'Ett föremål lyser upp tre meter, tre meter till eller fem minuter till per extra E.'),
  spell('elementarmagi', 2, 'LÅGA', 'FK', 'personlig', { dice: '1T3', unit: 'SR' }, 'En liten låga ur tummen som tänder brännbart.'),
  spell('elementarmagi', 3, 'FÖRSEGLA', 'F', 'beröring', T(1, 'minuter'), 'Sammanfogar två föremål, till exempel en dörr och karmen. Ger 20 KP extra.'),
  spell('elementarmagi', 3, 'MÖRKER', 'F', S(10, 'rutor'), Tdiv(4, 'minuter'), 'Släcker allt ljus i en sfär med sex meters diameter.'),
  spell('elementarmagi', 3, 'SKÖLD', 'FK', 'personlig', 'omedelbar', 'Luften parerar en fysisk attack automatiskt med BV 4, +2 per extra E.'),
  spell('elementarmagi', 4, 'FLAMMANDE HAND', 'F', 'beröring', { dice: '1T3', unit: 'minuter' }, 'Handen brinner och ger 1T3 extra skada per E.'),
  spell('elementarmagi', 4, 'KALLA HANDEN', 'FK', Sdiv(2, 'rutor'), 'omedelbar', 'Köldstråle. Offret slår Svårt FYS-slag; misslyckas det kan offret inte göra något den rundan, annars −4 på CL.'),
  spell('elementarmagi', 6, 'BLIXT', 'FK', S(10, 'rutor'), 'omedelbar', 'Blixt mot närmaste mål: 1T6 per E från totala KP. Rustning skyddar inte.'),
  spell('elementarmagi', 6, 'ELD', 'F', S(10, 'rutor'), 'omedelbar', '1T6 per E i en eller flera sfärer, från totala KP. Rustning och SKYDD absorberar.'),
  spell('elementarmagi', 6, 'ENERGISTRÅLE', 'F', S(10, 'rutor'), 'omedelbar', 'Stråle mot ett mål: 1T6 per E, eller 1T3 per E i detaljerad strid. Träffar en kroppsdel.'),
  spell('elementarmagi', 6, 'FROST', 'F', S(10, 'rutor'), 'omedelbar', 'Som ELD men med köld. Släcker eldar.'),
  spell('elementarmagi', 6, 'FÖRBANNA VAPEN', '', S(10, 'rutor'), T(1, 'minuter'), '−1 CL och −1 skada per E på ett vapen, eller sämre parering med en sköld.'),
  spell('elementarmagi', 6, 'FÖRTROLLA VAPEN', '', S(10, 'rutor'), T(1, 'minuter'), '+1 CL och +1 skada per E. Vapnet kan skada varelser som annars bara tar skada av magi.'),
  spell('elementarmagi', 6, 'KNÄCKA', 'FK', S(2, 'rutor'), 'omedelbar', 'Sänker ett föremåls BV med 10, plus 2 per extra E.'),
  spell('elementarmagi', 6, 'ÖPPNA', 'F', 'beröring', 'omedelbar', 'Öppnar lås och lock. Kan bryta FÖRSEGLA.'),
  spell('elementarmagi', 7, 'VIGGFÅNGARE', 'F', 'personlig', 'omedelbar', 'Under åska: lockar till sig en blixt (5T6) och omvandlar en del av skadan till PSY.'),
  spell('elementarmagi', 8, 'VIRVELSKÖLD', 'F', 'personlig', T(1, 'SR'), 'Luftvirvel som stöter bort projektiler, åt båda hållen.'),
  spell('elementarmagi', 9, 'FRAMMANA/SKICKA BORT ELEMENTAR', 'F', S(10, 'rutor'), T(1, 'SR'), 'Kallar fram eller skickar bort en elementar. Varje sorts elementar är en egen besvärjelse.'),
  spell('elementarmagi', 10, 'ASTRALVAPEN', 'F', Sdiv(2, 'rutor'), T(1, 'SR'), 'Ett eggvapen av magisk energi. En E per kg som vapnet väger.'),
  spell('elementarmagi', 11, 'EXPLOSION', 'FK', S(10, 'rutor'), 'omedelbar', '5 per E i skada inom E meter, minus 1 per ruta utanför. Bländar alla som ser den.'),

  // ---------------------------------------------------------------- mentalism
  spell('mentalism', 1, 'SPRÅNG', 'K', 'beröring', Tdiv(4, 'SR'), 'Jättesprång: 4 m långt och 2 m högt per E. Normalt SMI-slag vid landningen.'),
  spell('mentalism', 3, 'MOTSTÅNDSKRAFT', '', 'beröring', T(1, 'minuter'), 'Minskar skada av hetta och köld med 1 per E och attack.'),
  spell('mentalism', 4, 'LEVITATION', '', 'personlig', T(1, 'minuter'), 'Stiger rakt upp 5 m per E med upp till 50 kg packning.'),
  spell('mentalism', 5, 'KÄNSLOLÄSNING', '', S(2, 'rutor'), Tdiv(4, 'SR'), 'Läser av en varelses känslor och om den är vänligt eller fientligt inställd.'),
  spell('mentalism', 6, 'LYFT', '', S(4, 'rutor'), T(1, 'minuter'), 'Lyfter 3 STO per E och flyttar det två rutor per runda, plus en per extra E.'),
  spell('mentalism', 6, 'SKYDD', '', S(2, 'rutor'), Tdiv(4, 'minuter'), '+1 abs per E på hela kroppen.'),
  spell('mentalism', 6, 'TANKEÖVERFÖRING', '', S(10, 'rutor'), T(1, 'SR'), 'Ljudlös kontakt med ytliga tankar och känslor, en varelse per E.'),
  spell('mentalism', 7, 'VATTENANDNING', '', 'beröring', T(1, 'timmar'), 'Andas under vatten på vilket djup som helst.'),
  spell('mentalism', 8, 'FLYGA', '', 'beröring', Tdiv(4, 'timmar'), 'Flyger E×5 rutor per runda. En extra E per 20 STO över de första 20.'),
  spell('mentalism', 8, 'LÄDERHUD', '', 'personlig', T(1, 'timmar'), 'Huden ger 2 i naturligt skydd men KAR −2.'),
  spell('mentalism', 8, 'MÖRKERSYN', '', 'beröring', T(1, 'timmar'), 'Ser värme. Fungerar inte i ljus eller nära starka värmekällor.'),
  spell('mentalism', 9, 'OSYNLIGHET', '', 'beröring', T(1, 'minuter'), 'Gör 6 STO osynliga per E. Bryts om den osynlige slåss, springer, lägger magi eller skadas.'),
  spell('mentalism', 9, 'SYN', '', 'personlig', T(1, 'SR'), 'Ser och hör ett känt ställe inom 120 m (annars 30 m), en dag bakåt per extra E. Identifierar magiska föremål.'),
  spell('mentalism', 10, 'ELCHOCK', 'FK', 'beröring', 'omedelbar', '1T4 per E på den som berörs. Metallrustning skyddar bara till hälften.'),
  spell('mentalism', 11, 'TANKELÄSNING', '', S(2, 'rutor'), T(1, 'minuter'), 'Läser en intelligent varelses tankar utan att den märker det.'),
  spell('mentalism', 12, 'KONTROLLERA PERSON', '', S(4, 'rutor'), T(1, 'SR'), 'Styr en humanoids kropp, en per E. PSY mot PSY.'),
  spell('mentalism', 12, 'TELEPATI', '', 'särskild', T(1, 'minuter'), 'Tankekontakt på vilket avstånd som helst med någon man känner till namnet, en person till per extra E.'),
  spell('mentalism', 12, 'TELEPORTERA', '', 'beröring', 'omedelbar', 'Flyttar 3 STO per E till en välkänd plats inom 100 m, längre med extra E.'),
  spell('mentalism', 13, 'MAGISK SYN', '', 'beröring', T(1, 'minuter'), 'Ser det osynliga och skyddar mot besvärjelser som förblindar.'),
  spell('mentalism', 14, 'ORÄDD', '', 'beröring', T(1, 'minuter'), 'Behöver inte slå på Skräcktabellen.'),
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

/** Grupper för varelsebesvärjelserna; varje grupp är en egen besvärjelse. Bara mot ointelligenta varelser. */
export const CREATURE_SPELL_GROUPS = [
  'Däggdjur',
  'Fåglar',
  'Kräldjur',
  'Groddjur',
  'Fiskar',
  'Insekter och spindlar',
  'Skaldjur',
  'Maskar',
  'Blötdjur',
  'Växter',
];
