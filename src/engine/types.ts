import type { HitLocation } from './rules/tables';
import type { Scope } from './rules/outcomes';
import type { PoisonStage } from './rules/poison';

export type AttrKey = 'STY' | 'STO' | 'FYS' | 'SMI' | 'INT' | 'PSY' | 'KAR';
export const ATTR_KEYS: AttrKey[] = ['STY', 'STO', 'FYS', 'SMI', 'INT', 'PSY', 'KAR'];
export type Attrs = Record<AttrKey, number>;

/** Naturligt vapen eller obeväpnat anfall i äventyrsinnehållet (bett, näve). */
export interface NaturalWeaponDef {
  id: string;
  name: string;
  damage: string;
  /** Färdigheten som används (t.ex. "slagsmal"), eller varelsens egen anfallsnyckel. */
  skill: string;
  /** Om skadebonus läggs till skadan. */
  useDamageBonus: boolean;
}

export interface CreatureDef {
  id: string;
  name: string;
  sprite: string;
  attrs: Attrs;
  skills: Record<string, number>;
  /** Vapen ur regeldatan eller ett naturligt vapen ur innehållet. */
  weapon: string;
  /** Rustningsdelar ur regeldatan. */
  armor?: string[];
  /** Naturligt skydd (päls, hud). */
  naturalArmor?: number;
  shield?: string;
  /** Förflyttning i rutor per stridsrunda. */
  move: number;
  hostile: boolean;
  /** Humanoid: strider detaljerat med träffområden och parering. Djur och monster strider vanligt. */
  humanoid: boolean;
  /** Folkslaget eller rasen i regeldatan (id i src/data/creatures.ts eller races.ts), för Baneman. Utan det används id:t om det finns i regeldatan. */
  folk?: string;
  /** Synhåll i rutor för att upptäcka rollpersonen. */
  sight?: number;
  /** Ser i mörker (inga avdrag för mörker i strid). */
  darkvision?: boolean;
  /** Ledare för sin grupp: om hen faller slår de andra moralslag. */
  leader?: boolean;
  /** Lyder inte under moralreglerna och slåss till slutet. */
  noMorale?: boolean;
  /** Skräckslå: [automatiskt, aktivt]. null = kan inte. */
  fear?: [number | null, number | null];
  /** Avståndsvapen som varelsen använder på håll, och hur många skott eller kast den har. */
  ranged?: { weapon: string; ammo: number };
  /** Silver som varelsen bär på (tärningsuttryck). */
  silver?: string;
  /** Flagga som sätts när varelsen dör. */
  deathFlag?: string;
  /** Koppling till en spelledarperson med dialog. */
  npc?: string;
  /** Föremål som varelsen bär och som blir kvar på marken när den dör (t.ex. en bok). */
  loot?: string[];
  /**
   * Magi (Vidar: samma regler som för gruppen). FV per magiskola och besvärjelserna, som alla
   * räknas som memorerade. PSY-poängen är varelsens PSY.
   */
  magic?: { schools: Partial<Record<'animism' | 'elementarmagi' | 'mentalism', number>>; spells: string[] };
}

/** Varor som en handlare säljer: vapen, rustningar, sköldar, droger eller en kategori ur utrustningslistan. */
export type ShopGoods =
  | 'närstridsvapen'
  | 'avståndsvapen'
  | 'rustningar'
  | 'sköldar'
  | 'läkedroger'
  | 'droger'
  | 'gifter'
  | 'verktyg'
  | 'behållare'
  | 'kläder'
  | 'äventyr'
  | 'tjuvverktyg'
  | 'diverse'
  | 'mat'
  | 'instrument';

export interface NpcDef {
  id: string;
  /** Handlare: vad hen säljer (och köper). */
  shop?: { goods: ShopGoods[] };
  /** Personlighet och roll – skickas till språkmodellen. */
  persona: string;
  /** Vad personen känner till om världen. */
  knowledge: string;
  /** Reservdialog när ingen språkmodell är tillgänglig. */
  greeting: string;
  topics: { text: string; reply: string }[];
  /** Spelmekaniska handlingar som kan utföras i samtal med personen. */
  intents: string[];
  /**
   * Färdigheter som personen kan undervisa i (steg 8). FV och INT tas från varelsen, så
   * lärarkraven (FV 17, INT 13) gäller. Magiskolor ger också undervisning i besvärjelser.
   */
  teaches?: string[];
  /** Personens ras, för lärarens pris (annars människa). */
  race?: string;
}

/** En pågående följd av en fummel, skräck eller skada, med hur länge den varar. */
export interface ActiveEffect {
  kind:
    | 'cl'
    | 'misslyckas'
    | 'endastParera'
    | 'ingenHandling'
    | 'ingenParering'
    | 'liggande'
    | 'medvetslös'
    | 'motståndarBonus'
    | 'utsatt'
    | 'förflyttning'
    | 'flyr'
    | 'bärsärk'
    | 'skräckMod'
    | 'dödsfara'
    | 'armUr'
    // ------------------------------------------------ magi, örter och avståndsstrid (steg 6)
    /** Extra absorbering på hela kroppen (SKYDD, LÄDERHUD). */
    | 'skydd'
    /** FÖRTROLLA eller FÖRBANNA VAPEN: mod på CL och skada med vapnet i `slot`. */
    | 'vapenMagi'
    | 'mörkersyn'
    | 'orädd'
    /** SKÖLD: nästa fysiska anfall pareras automatiskt. */
    | 'luftsköld'
    /** Läker `mod` KP när tiden har gått ut (örter som verkar efter en stund). */
    | 'läkning'
    /** Kan inte lägga besvärjelser (stum eller förlamad efter en snedtändning). */
    | 'stum'
    /** Ser ingenting: räknas som mörker. */
    | 'blind'
    /** Har sökt skydd eller kastat sig ned: `mod` på avståndsanfall mot hen den här rundan. */
    | 'täckning'
    /** Nästa besvärjelse kostar halva PSY (Ruriksört). */
    | 'halvPsy'
    /** Febern från en infektion är nedsatt (Malmros). */
    | 'febernedsatt'
    /** Fångad i ÖRTRANKOR: `mod` är rankornas motståndsvärde mot STY. */
    | 'rankor'
    /** Ändrad risk att sår från nästa strid infekteras (gånger `mod`). */
    | 'infektionsrisk'
    /** Kroppsdelen `loc` går inte att använda en tid (gift). */
    | 'lem'
    /** En kroppsfunktion är utslagen (gift); bara texten visas. */
    | 'funktion'
    // ------------------------------------------------ följeslagare och fler handlingar (steg 7)
    /** Hålls fast (Fasthållning eller Låsning): `sourceId` håller, `mod` är värdet för att ta sig loss. */
    | 'fasthållen'
    /** Håller fast `sourceId` och kan inte göra något annat. */
    | 'håller'
    /** Styr elementaren `sourceId` (markering; kostar ingen handling). */
    | 'styr'
    /** Rullar (Fallteknik): kan inte huggas med närstridsvapen förrän nästa tur. */
    | 'rullar'
    /** Nästa skott får hjälp av en sylf: `mod` på CL och `grade` × 1T3 i skada. */
    | 'sylfstyrd'
    /** Vapnet i `slot` är upphettat eller nedkylt av en elementar: extra skada `label`. */
    | 'vapenElement'
    /** Står och flämtar i kylan eller hettan kring en elementar. */
    | 'flämtar'
    /** −2 på nästa initiativslag (hoppspark, rundspark). */
    | 'initiativ'
    // ------------------------------------------------ förmågor
    /** `mod` på STY (God kroppskontroll), även för skadebonusen. */
    | 'styrka'
    // ------------------------------------------------ besvärjelser i strid
    /** ÖKA eller MINSKA: `mod` har lagts på grundegenskapen `attr` och tas bort när den slutar. */
    | 'egenskap'
    /** FLAMMANDE HAND: `grade` × 1T3 extra skada med händerna och vapen i handen. */
    | 'flammandeHand'
    /** VIRVELSKÖLD: projektiler till och från figuren missar. */
    | 'virvelsköld'
    /** MOTSTÅNDSKRAFT: `grade` mindre skada per angrepp av eld och köld. */
    | 'motståndskraft'
    /** ANTIMAGI med effektgraden `grade`. */
    | 'antimagi'
    /** LJUS: figuren lyser som en fackla `mod` rutor runt sig. */
    | 'ljus'
    /** MAGISK SYN: ser osynliga och bländas inte. */
    | 'magiskSyn'
    /** OSYNLIGHET: osynlig tills hen anfaller, springer, lägger magi eller skadas. */
    | 'osynlig'
    /** KAMOUFLAGE: oupptäckt så länge hen står kvar på rutan `at`. */
    | 'kamouflage'
    /** ASTRALVAPEN: vapnet i handen gör `dice` i skada och har FV `mod`. */
    | 'astralvapen'
    /** LEVITATION eller FLYGA: svävar ovanför marken; `mod` är flygfarten (0 = står still i luften). */
    | 'svävar'
    /** KONTROLLERA PERSON: slåss för `by` så länge den varar; `was` är hur den var innan. */
    | 'kontrollerad'
    // ------------------------------------------------ besvärjelser utanför strid
    | 'spårlös'
    /** VATTENANDNING: kan gå ut i vattnet. */
    | 'vattenandning'
    /** TALA MED VARELSE: kan tala med ointelligenta djur, FV `mod` i deras språk. */
    | 'talaMed'
    /** TANKELÄSNING: läser tankarna hos personen `by` (npc-id) i samtal. */
    | 'tankeläsning'
    /** FÖRÄNDRA: vapnet i handen var `item` innan. */
    | 'förändrad';
  /** Kort text till rollformuläret och loggen. */
  label: string;
  mod?: number;
  /** Halverar i stället för att lägga till (SMI-färdigheter, förflyttning). */
  half?: boolean;
  scope?: Scope;
  /** Vapnet som modifikationen gäller (scope 'vapen'). */
  slot?: WeaponSlot;
  noParry?: boolean;
  random?: boolean;
  /** Rundor kvar, inklusive den pågående. */
  rounds?: number;
  days?: number;
  uses?: number;
  untilPerfect?: boolean;
  untilFixed?: boolean;
  untilRest?: boolean;
  /** Varar så länge den här aktören finns kvar (skräckkällan). */
  sourceId?: string;
  /** Besvärjelsen som gav effekten och dess effektgrad (för SKINGRA). */
  spell?: string;
  grade?: number;
  /** Varar efter striden (magi, örter och gifter). */
  persist?: boolean;
  /** Giftet (drogens id) som gav effekten; den försvinner när giftet är nedbrutet. */
  poison?: string;
  /** Kroppsdelen som effekten gäller. */
  loc?: HitLocation;
  /** Tärningsuttryck för extra skada (elementarernas hetta och köld). */
  dice?: string;
  /** Färdigheten som modifikationen gäller (scope 'färdighet', t.ex. munkens Meditation). */
  skill?: string;
  /** Grundegenskapen som ÖKA eller MINSKA har ändrat. */
  attr?: AttrKey;
  /** Rutan där figuren stod när effekten började (KAMOUFLAGE). */
  at?: { x: number; y: number };
  /** Magikern som styr (KONTROLLERA PERSON). */
  by?: string;
  /** Fientlig innan den blev kontrollerad. */
  was?: { hostile: boolean };
  /** Tillkallad med TILLKALLA VARELSE: går sin väg när striden är slut. */
  summoned?: boolean;
  /** Föremålet som effekten gäller (FÖRÄNDRA: vapnet som det var innan). */
  item?: string;
}

/** Vädret: himlen och vinden som index i SKY och WIND (rules/tables.ts). */
export interface WeatherState {
  sky: number;
  wind: number;
  /** Modulen har låst vädret. */
  locked?: boolean;
  /** En besvärjelse håller vädret till speltiden `until`; sedan kommer `prev` tillbaka. */
  held?: { until: number; prev: { sky: number; wind: number } };
}

/** Hur det står till med en dörr eller kista på kartan. */
export interface LockState {
  /** Låset är öppnat (dyrkat, uppbrutet eller med ÖPPNA). */
  open?: boolean;
  /** Svårighetsgraden som är kvar efter Låsdyrkning. */
  left?: number;
  /** Kistan är tömd. */
  looted?: boolean;
  /** FÖRSEGLA: dörren eller kistan sitter ihop till speltiden `until`. */
  sealed?: { until: number; grade: number };
}

/** En besvärjelse som verkar på en plats i stället för på en figur (MÖRKER). */
export interface SpellZone {
  kind: 'mörker' | 'dimma' | 'beskyddare';
  /** Kartan där zonen finns. */
  map?: string;
  /** Magikern som lade den (BESKYDDARE skadar inte magikern själv). */
  caster?: string;
  /** Figurer som står i zonen (BESKYDDARE slår till mot den som går in). */
  inside?: string[];
  x: number;
  y: number;
  /** Radie i rutor. */
  r: number;
  /** Speltiden då den upphör. */
  until: number;
  spell: string;
  grade: number;
}

/** Ett gift som verkar i kroppen (Bok II s. 50–51). */
export interface Poisoning {
  /** Drogen (src/data/herbs.ts). */
  herb: string;
  /** Giftets STY just nu. Sjunker med 1 för varje dygn som offret klarar motståndsslaget. */
  sty: number;
  /** Det svåraste stadium som giftet når, enligt motståndsslaget. */
  stage: PoisonStage;
  /** Speltiden då giftet kom in i kroppen. */
  start: number;
  /** Stadier som redan har börjat verka. */
  applied: PoisonStage[];
  /** Kroppsdelen som giftet kom in genom (gifter genom sår). */
  loc?: HitLocation;
  /** Dagen då motståndsslaget senast slogs. */
  lastDay: number;
}

/** En dos av en drog. Kvaliteten avgörs när den bereds (Bok II: fel beredning gör den verkningslös). */
export interface HerbDose {
  id: string;
  quality: 'normal' | 'verkningslös' | 'skadlig' | 'dubbel';
}

/** En besvärjelse som håller på att läggas och verkar i början av nästa runda. */
export interface PendingSpell {
  caster: string;
  spell: string;
  grade: number;
  /** Extra E för räckvidd och varaktighet. */
  extraRange: number;
  extraDuration: number;
  target?: string;
  x: number;
  y: number;
  /** Rundor kvar tills besvärjelsen verkar (läsning ur formelsamlingen tar längre tid). */
  rounds: number;
  /** Självmordsattack: CL är S oavsett effektgrad, och magikern dör efteråt. */
  suicide?: boolean;
  /** Grundegenskapen för ÖKA och MINSKA. */
  attr?: AttrKey;
  /** ASTRALVAPEN med en eller två händer. */
  hands?: 1 | 2;
  /** Rutan som besvärjelsen gäller (SPRÅNG, LYFT, TELEPORTERA, SYN, ÖPPNA, FÖRSEGLA). */
  at?: { x: number; y: number };
  /** Vad VARSEBLIVNING letar efter, och örten för VÄXTKUNSKAP. */
  seek?: string;
  herb?: string;
  /** En scen i modulen visades när besvärjelsen verkade. */
  scene?: boolean;
  /** VINDKONTROLL och REGNKONTROLL: mer (1) eller mindre (−1). */
  change?: 1 | -1;
  /** Föremålet: det som LADDNING laddar, eller vapnet som FÖRÄNDRA gör. */
  item?: string;
  /** PSY ur laddade föremål (LADDNING) som besvärjelsen får använda. */
  useCharge?: boolean;
  /** Fast S för räckvidd och varaktighet (besvärjelser ur magiska föremål). */
  s?: number;
}

export type WeaponSlot = 'weapon' | 'offhand';

/** Bestående skada efter en kritisk träff i en arm eller ett ben. */
export interface Injury {
  loc: HitLocation;
  id: string;
  text: string;
  cl: number;
  lost: boolean;
  legMove?: number;
}

export interface Actor {
  id: string;
  defId: string;
  name: string;
  kind: 'player' | 'npc' | 'monster';
  sprite: string;
  x: number;
  y: number;
  attrs: Attrs;
  kp: number;
  maxKp: number;
  /** Detaljerad strid med träffområden (humanoider). Andra har bara totala KP. */
  detailed: boolean;
  locKp: Record<HitLocation, number>;
  locMax: Record<HitLocation, number>;
  /** Kroppsdelar som nått 0 KP och blöder tills någon lägger förband. */
  bleeding: HitLocation[];
  /** Rundor sedan blödningen senast tog en KP. */
  bleedTimer: number;
  /** Döende (husregel, steg 8): medvetslös på 0 KP eller lägre, förlorar 1 KP per runda. */
  dying?: boolean;
  /** Rundor som hen har varit döende (för FYS-slaget var tionde runda). */
  dyingRounds?: number;
  /** Kroppsdelar som inte går att använda (0 KP eller kritiskt skadade). */
  disabled: HitLocation[];
  /** Kroppsdelar som redan har slagit på tabellen för kritiska skador. */
  critical: HitLocation[];
  injuries: Injury[];
  skills: Record<string, number>;
  /** Erfarenhetspoäng per färdighet, som växlas in mot FV efter en veckas vila. */
  ep: Record<string, number>;
  /** Färdigheter som redan gett EP sedan senaste sömnen. */
  epBlocked: string[];
  /** Kvarvarande PSY-poäng (högst PSY). */
  psy: number;
  /** Infekterade kroppsdelar: läker inte förrän infektionen gått över (speltid i sekunder). */
  infections: { loc: HitLocation; until: number; gangrene: boolean }[];
  /** Sår från den pågående striden, för infektionsslagen efteråt. */
  combatWounds: { loc: HitLocation; dmg: number; kind: 'egg' | 'smutsig' }[];
  /** Läktimmar och PSY-timmar som samlats men ännu inte gett en poäng. */
  healHours: number;
  psyHours: number;
  /** Sammanhängande vila i sekunder (för att växla in EP krävs sju dagar). */
  restSeconds: number;
  /** Dagen då Läkekonst senast användes på aktören. */
  medicineDay: number;
  weapon: string;
  /** Vapen i den andra handen (Två vapen). */
  offhand?: string;
  armor: string[];
  naturalArmor: number;
  shield?: string;
  /** Kvarvarande BV: 'weapon', 'offhand', 'shield' och rustningsdelarnas id. */
  bv: Record<string, number>;
  swordArm: HitLocation;
  move: number;
  hostile: boolean;
  sight: number;
  darkvision: boolean;
  alive: boolean;
  /** Medvetslös: kan inget göra och kan inte parera. */
  unconscious: boolean;
  /** Utslagen men vid medvetande: kan bara krypa (bål på 0 KP, misslyckat PSY-slag, 1 KP kvar). */
  down: boolean;
  /** Har flytt från platsen. */
  fled: boolean;
  /** Riktningen figuren vänder sig åt, för anfall från sidan och bakifrån. */
  facing: { dx: number; dy: number };
  effects: ActiveEffect[];
  silver: number;
  profession?: string;
  npc?: string;
  deathFlag?: string;
  leader?: boolean;
  noMorale?: boolean;
  fear?: [number | null, number | null];
  /** Orsaker som redan har gett ett moralslag. */
  morale: string[];
  /** Tillägg på initiativslaget. */
  initiative: number;
  /** Snabbslående: agerar alltid först. */
  firstAlways?: boolean;
  /** Rundor kvar att ladda om avståndsvapnet. */
  reload?: number;
  /** Avståndsvapen som en varelse använder på håll, och hur många skott eller kast den har. */
  ranged?: string;
  rangedAmmo?: number;
  /** Rutor som figuren förflyttade sig under sin senaste tur (springer den är den ett rörligt mål). */
  movedLast?: number;
  /** Gifter som verkar i kroppen. */
  poisons?: Poisoning[];
  /** Gift som är stryket på vapnet och verkar vid nästa träff som skadar. */
  weaponPoison?: HerbDose;
  /** Följeslagare: hur hen följer med och vem hen är i äventyret. */
  companion?: CompanionInfo;
  /** Elementar som en magiker har frammanat. */
  elemental?: ElementalInfo;
  /** Smygarläge: försöker hålla sig dold. `hidden` = oupptäckt just nu. */
  sneaking?: boolean;
  hidden?: boolean;
  /** Facklan är släckt (rollpersoner och följeslagare bär annars en tänd fackla). */
  torchOut?: boolean;
  /** Ljuset som figuren bär: en fackla eller en oljelykta, och hur länge det brinner till. */
  light?: { kind: 'fackla' | 'oljelykta'; left: number };
  /** Stridskonstens tekniker (från rollformuläret). */
  techniques?: string[];
  /** Skräck och moral: följeslagare som flytt och vägrar fortsätta. */
  refused?: boolean;
  /** Hjältepoäng är laddade för nästa egna slag (steg 8). */
  heroArmed?: boolean;
  // ------------------------------------------------ förmågor som används på turen
  /** Turgubbe eller Tjuvtur: `n` på CL för nästa egna slag, för lika många PSY. */
  luckArmed?: { source: 'turgubbe' | 'tjuvtur'; n: number };
  /** Gånger Tjuvtur har använts sedan senaste sömnen. */
  thiefLuck?: number;
  /** God kroppskontroll: dagen och hur många gånger den har använts den dagen. */
  bodyControl?: { day: number; n: number };
  /** Gruppmedlemmar som har anfallit djuret (Djurvän gäller inte längre dem). */
  provokedBy?: string[];
  /** Föremål som varelsen bär och som blir kvar när den dör. */
  loot?: string[];
  /** Besvärjelser som en varelse utan rollformulär kan (alltid i minnet). */
  spells?: string[];
  /** Hamnbytare: figuren är ett djur just nu (se engine/shapeshift.ts). */
  shape?: ShapeState;
}

/** Hamnbytarens djurhamn och den mänskliga kroppen som väntar. */
export interface ShapeState {
  /** Index i HAMN. */
  animal: number;
  /** Speltiden när förvandlingen skedde, och hur många PSY-slag som har slagits. */
  since: number;
  checks: number;
  /** KP som var förlorade när förvandlingen skedde. */
  lost: number;
  /** Den mänskliga kroppen, som den var. */
  human: Pick<Actor, 'attrs' | 'skills' | 'maxKp' | 'kp' | 'locKp' | 'locMax' | 'move' | 'detailed' | 'weapon' | 'offhand' | 'armor' | 'shield' | 'naturalArmor' | 'sprite' | 'sight' | 'darkvision' | 'bv' | 'torchOut'>;
}

/** Hur en följeslagare följer med: dagslön, en del av bytet eller gratis (husregel). */
export interface CompanionInfo {
  /** Rekryterbar person i äventyret (src/content). */
  recruit: string;
  pay: 'dagslön' | 'andel' | 'gratis';
  /** Dagslön i silvermynt. */
  wage?: number;
  /** Senaste dagen som lönen är betald för. */
  paidDay?: number;
  /** Moral: 'alltid' slår som fiender, 'ledare' bara när rollpersonen faller. */
  morale: 'alltid' | 'ledare';
  /** Platsen där personen bor och dit hen går om hen lämnar gruppen. */
  home: { x: number; y: number };
  /** Kartan där hen bor. Lämnar hen gruppen någon annanstans går hen sin väg. */
  homeMap?: string;
}

export type ElementKind = 'luft' | 'eld' | 'jord' | 'vatten' | 'mörker' | 'ljus' | 'köld' | 'värme';

/** En frammanad elementar (Bok III s. 21–22, 27). */
export interface ElementalInfo {
  kind: ElementKind;
  /** Elementarens grad (effektgraden den frammanades med). */
  grade: number;
  /** Magikern som styr den. */
  caster: string;
  /** Rundor kvar. */
  rounds: number;
}

export interface CombatState {
  round: number;
  /** Turordning (aktörs-id), högst initiativ först. */
  order: string[];
  /** Initiativslagen den här rundan. */
  initiative: Record<string, number>;
  turn: number;
  movesLeft: number;
  /** Vilka som gjort sin handling denna runda. */
  acted: Record<string, boolean>;
  /** Pareringar denna runda: antal med avdrag, och om sköldens fria parering är använd. */
  parries: Record<string, { count: number; shieldFree: boolean }>;
  /** Kroppsdel som rollpersonen siktar på (−5), eller null för slumpvis. */
  aim: HitLocation | null;
  /** Varelser som redan har skräckslagit rollpersonen automatiskt eller aktivt. */
  scared: string[];
  /** Runda 0: de som lyckades med Dra vapen och får en gratis tur innan den vanliga turordningen. */
  freeRound?: string[];
  /** Besvärjelser som verkar i början av nästa runda (magi går före slagväxling). */
  pending?: PendingSpell[];
  /** Pilar och lod som rollpersonen har skjutit, för att plocka upp efter striden. */
  fired?: Record<string, number>;
  /** Anfallssättet som väljs för nästa klick: vanligt anfall, Avväpna, Fasthållning eller en teknik. */
  attackMode?: string;
  /** Fint tillsammans med nästa anfall (stridskonsttekniken Fint). */
  feint?: boolean;
  /** Besvärjelser som varje fiende har lagt i striden (för fiendens val av besvärjelse). */
  cast?: Record<string, string[]>;
}

/** Ett föremål som ligger på marken (tappat i strid). */
export interface DroppedItem {
  item: string;
  /** 'item' är ett föremål ur packningen (en fallen följeslagares ägodelar). */
  slot: WeaponSlot | 'shield' | 'armor' | 'item';
  owner: string;
  x: number;
  y: number;
  bv?: number;
}

/** 'ended': äventyrsmodulen är avslutad och gruppen är mellan äventyren. */
export type Mode = 'explore' | 'combat' | 'dialog' | 'dead' | 'ended';

/** En handlares pris den här dagen (Köpslå) och vad hen har inne. */
export interface TradeState {
  day: number;
  /** Rabatt i procent efter Köpslå (positiv = billigare för rollpersonen). */
  pct?: number;
  /** Droger som handlaren har på lager den här dagen. */
  herbs?: string[];
}

/** En karta som gruppen har lämnat: det som finns kvar där när den kommer tillbaka. */
export interface PlaceState {
  actors: Actor[];
  explored: number[];
  dropped: DroppedItem[];
}

export interface GameState {
  version: 7;
  /** Äventyrsmodulen som spelas (src/content). */
  moduleId: string;
  /** Moduler där huvuduppdraget är klart. */
  completed: string[];
  /** Kartor som gruppen har lämnat, per kart-id. */
  places: Record<string, PlaceState>;
  /** Flaggorna från moduler som gruppen har lämnat, per modul. `flags` är den nuvarande modulens. */
  moduleFlags: Record<string, Record<string, boolean>>;
  /** Speltid i sekunder sedan dag 1 klockan 00:00. */
  time: number;
  /** Rollformuläret för rollpersonen. */
  character: Character;
  /** Rollformulären för följeslagarna, per aktörs-id. De följer med mellan äventyren. */
  companions: Record<string, Character>;
  /** Gruppen: rollpersonen först, sedan följeslagarna (aktörs-id). Högst sex. */
  party: string[];
  /** Gruppmedlemmen som visas och styrs utanför strid. I strid är det den vars tur det är. */
  focus?: string;
  /** Rekryterbara personer som lämnat gruppen och dagen de gick (de vill inte genast tillbaka). */
  departed?: Record<string, number>;
  mapId: string;
  playerId: string;
  actors: Actor[];
  explored: number[];
  mode: Mode;
  combat: CombatState | null;
  /** Den nuvarande modulens flaggor (uppdrag och händelser). */
  flags: Record<string, boolean>;
  dropped: DroppedItem[];
  /** Skräckkällor (varelsetyper) som rollpersonen har mött förut. */
  fearMet: string[];
  /** Handeln per handlare (spelledarpersonens npc-id). */
  trade: Record<string, TradeState>;
  /** Personer som rollpersonen har talat med, och om de kände igen hjälten (npc-id). */
  met?: Record<string, boolean>;
  /** Belöningar (bonus-EP och HP) som redan har delats ut, som "modul:id". */
  rewarded?: string[];
  /** Besvärjelser som verkar på en plats på kartan (MÖRKER, DIMMA, BESKYDDARE). */
  zones?: SpellZone[];
  /** Lås och förseglingar per ruta, som "karta:x,y". */
  locks?: Record<string, LockState>;
  /** Vädret. */
  weather?: WeatherState;
  /** Magiska föremål som gruppen har analyserat: 1 vet att det är magiskt, 2 vet vilka besvärjelser, 3 vet hur de används. */
  itemKnown?: Record<string, number>;
  /** Besvärjelser i magiska föremål som är förbrukade (index i föremålets lista). */
  itemSpent?: Record<string, number[]>;
  log: string[];
  nextId: number;
}

/** En färdig rollperson enligt reglerna (skapas i engine/creation.ts). */
export interface Character {
  name: string;
  gender: 'man' | 'kvinna';
  /** Figuren som spelaren valde. Utan den används yrkets figur. */
  sprite?: string;
  race: string;
  profession: string;
  age: { group: string; years: number };
  /** Slutliga grundegenskaper efter ras, förmåga och ålder. */
  attrs: Attrs;
  maxKp: number;
  swordHand: string;
  social: string;
  /** Särskild förmåga: tabellrad, summan av slaget och eventuellt val. */
  ability: { id: string; total: number; choice?: unknown } | null;
  /** Yrkesfärdigheter (nycklar), som är billigare att lära sig. */
  profSkills: string[];
  /** Tekniker i rollpersonens stridskonst. */
  techniques: string[];
  /** FV per färdighetsnyckel, t.ex. "smyga" eller "hantverk:smide". */
  skills: Record<string, number>;
  /** Besvärjelserna i formelsamlingen. S räknas fram ur FV i skolan (husregel). */
  spells: string[];
  /** Besvärjelser som magikern har i minnet och kan lägga direkt. */
  memorized: string[];
  /** Pilar, lod och slungkulor (styck). */
  ammo: Record<string, number>;
  /** Doser av örter och droger. */
  herbs: HerbDose[];
  /** Kvarvarande BV för vapen, sköldar och rustningar som ligger i packningen. */
  itemBv?: Record<string, number>;
  /** Startkapitalet i silvermynt och vad som är kvar efter inköpen. */
  capital: number;
  silver: number;
  /** Ägda föremål (id ur regeldatan, ett per exemplar). */
  inventory: string[];
  equipped: { weapon?: string; offhand?: string; shield?: string; armor: string[] };
  appearance: string;
  /** Bonus-EP från uppdrag, att fördela fritt mellan färdigheterna vid träningen. */
  bonusEp?: number;
  /** Fobier från Skräcktabellen. */
  phobias?: { source: string; level: 'mild' | 'normal' | 'svår' }[];
  // ------------------------------------------------ utveckling mellan äventyren (steg 8)
  /** Hjältepoäng att spendera, och alla HP som rollpersonen har fått i livet (för att bli igenkänd). */
  heroPoints?: number;
  heroTotal?: number;
  /** Särskilda förmågor som köpts för hjältepoäng. */
  heroAbilities?: { id: string; total: number; choice?: AbilityChoice }[];
  /** En förmåga som har slagits fram men väntar på ett val. */
  heroPending?: { id: string; total: number };
  /** Medlem i en magiakademi: biblioteket är gratis. */
  academy?: boolean;
  /** EP som rollpersonen har fått ur varje bok (bokens id). */
  studied?: Record<string, number>;
  /** Veckor av deltidsträning per färdighet som ännu inte gett ett slag. */
  partTime?: Record<string, number>;
  /** Vunnen PSY-kamp under äventyret: som magiker eller genom att stå emot. */
  psyWin?: 'magiker' | 'motstånd';
  /** Gudarnas gunstling har räddat personen under det här äventyret. */
  favorUsed?: boolean;
  /** Oljan som är kvar i oljelyktan (sekunder). Utan värde är den full. */
  lanternOil?: number;
  /** LADDNING: föremål med lagrad PSY. Ett föremål kan bara laddas en gång, så tomma står kvar. */
  charges?: { item: string; psy: number }[];
  /** Hamnbytare som har fastnat i sin djurhamn för alltid. */
  stuckInShape?: boolean;
}

/** Valet till en särskild förmåga, som när rollpersonen skapas (engine/creation.ts). */
export interface AbilityChoice {
  /** Färdigheten (fvChoice, fixedChoice, halfCost). */
  skill?: string;
  /** Två sekundära färdigheter som blir yrkesfärdigheter (extraPicks). */
  skills?: string[];
  /** Språket (language). */
  language?: string;
  /** Yrket vars yrkesförmåga man får (extraProfessionAbility). */
  profession?: string;
  /** Folkslaget eller rasen (Baneman). */
  foe?: string;
  /** Djuret för Hamnbytare (1–6 i HAMN), slaget första gången förmågan används. */
  animal?: number;
  /** Höjd grundegenskap: +2 på en eller +1 på tre (inte STO). */
  attrs?: Partial<Record<AttrKey, number>>;
}