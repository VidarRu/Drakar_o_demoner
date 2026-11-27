# Ljud och musik: design

Punkt 1 i Vidars plan för grafik och ljud (`docs/brief.md`). Godkänd väg: en egen ljudmodul
vid sidan av Phaser (alternativ 2 nedan).

## Varför

Spelet ska kännas som ett riktigt fantasyrollspel, inte bara läsas. Ljudeffekter ger tyngd åt
striden och magin, och musik i slingor ger varje plats en stämning. Vidar har en egen ljudvision
på sikt, så det som byggs nu är en ram där ljuden går att byta utan att röra koden.

## Mål

- Ljudeffekter för anfall (närstrid och skott), träff, parering och död, besvärjelser efter sort,
  förmågor, steg, att tända en fackla, att sova och slå läger, dörrar och kistor, packningen och
  handeln, och en signal när en strid börjar.
- Bakgrundsmusik i slingor som byter med platsen och läget (titel, världskarta, by, grotta,
  strid med flera) och tonar över mjukt.
- Musiken börjar redan på startskärmen och när man skapar rollperson.
- Egen volym för ljud och musik, och en knapp som stänger av allt. Inställningarna sparas i
  webbläsaren.
- Alla ljud och all musik är omkodade till ett mindre format som fungerar i alla vanliga
  webbläsare, Safari också.
- Upphovspersoner och licens står i `public/audio/CREDITS.md`.

## Inte nu

- Miljöslingor (fåglar, flod, eld, vind, grottdropp). Flare har dem, och de är ett enkelt nästa
  steg, men Vidar har inte bett om dem.
- Ljud för underlaget (gräs, grus, trä, vatten). Stegen följer utrustningen tills vidare (Vidar).
- Nya ljud från Kenney, OpenGameArt eller Freesound. Det som saknas fylls med det närmaste i
  Flare och står i en lista över luckor (nedan). De hittas senare.
- Röster för personerna (Flares `npcs/`).
- Ljud i den gamla planvyn (`?vy=plan`) utöver det som kommer av sig självt från motorns händelser.

## Det får inte bli

- **Tjatigt.** Hela gruppen får inte låta varje steg, och samma ljud får inte upprepas exakt
  likadant. Bara den som styrs låter när den går, och ljuden varieras (flera filer, lite olika
  tonhöjd och volym).
- **Ett hinder.** Om ett ljud inte går att ladda, eller webbläsaren inte tillåter ljud, ska spelet
  fungera precis som förut, utan felmeddelanden.
- **Ljud i motorn.** `src/engine/` får inte känna till ljud. Motorn säger vad som händer; ljudmodulen
  bestämmer hur det låter. Testerna körs utan ljud.
- **Tung att ladda.** Musiken laddas ett stycke i taget när det behövs, inte allt vid start.

## Begränsningar

- Flare är CC BY-SA 3.0 (`LICENSE.txt` i flare-game gäller allt innehåll). Omkodade filer delas
  under samma licens. Musiken är av Brandon Morris ("Augmentality"). Ljuden bygger enligt Flares
  `CREDITS.txt` bland annat på Ljudbank och Mike Koenig.
- Webbläsare tillåter inte ljud förrän användaren har klickat eller tryckt på en tangent. Ljudet
  låses upp vid första klicket på startskärmen.
- Ingen text ur regelböckerna. Namnen i ljudtabellen är egna.

## Alternativ som vägdes

1. **Ljudet i Phaser** (`this.sound` i `IsoScene`). Minst kod, men Phaser startar först i
   äventyret, så startskärmen och rollpersonsskapandet blir tysta, och fönstren vid sidan av kartan
   (packning, magi, handel) når inte ljudet utan omvägar.
2. **En egen ljudmodul med webbläsarens eget ljudstöd (valt).** Fungerar på alla skärmar,
   oberoende av Phaser. Lite mer kod än nummer 1.
3. **Howler.js.** Samma som nummer 2 men med ett beroende som inte ger något webbläsaren inte redan
   har.

Vidar valde nummer 2.

## Hur det byggs

### Händelser från motorn

Motorn får en ny sorts händelse, en ljudsignal (`Cue`), bredvid de befintliga `Fx`. `Game` får
`onCue(fn)` och `cue(c)`, på samma sätt som `onFx` och `emit`. En `Cue` beskriver vad som hände,
inte vilket ljud som ska spelas:

- `anfall`: vem, vapengrupp (`svärd`, `yxa`, `kross`, `dolkar`, `stickvapen`, obeväpnad, naturligt
  vapen för varelser) och utfall (`träff`, `miss`, `parerad`, `fummel`).
- `skott`: vem, vapengrupp (båge, armborst, kastvapen) och utfall.
- `skada`: vem som träffades, och om det var en person (efter kön) eller en varelse (efter sort).
- `död`: vem.
- `besvärjelse`: vem, skola och effektens sort (`kind` i `src/data/spells.ts`, för skada även
  eld, blixt eller köld om det går att avgöra), och om den lyckades. Misslyckad besvärjelse eller
  för lite PSY är ett eget utfall.
- `förmåga`: vilken (Turgubbe, Handpåläggning, Meditera, Framträd, Kroppskontroll, Riddarslag med
  flera).
- `steg`: vem, rustningens material (tyg, läder, metall; ringbrynja räknas som metall), och om
  kartan är en grotta (eko).
- `ljus`: tänt eller släckt.
- `vila`: sova eller slå läger.
- `striden börjar` och `striden slutar` (vunnen, flykt).
- `dörr` och `kista` (öppnad, dyrkad, bruten, låst).
- `packning`: utrustat, lagt undan, köpt, sålt, med föremålets sort (vapen, rustning, mynt, dryck,
  bok, ört).
- `träning`: en färdighet eller PSY höjs.

Signalerna skickas där motorn redan gör det som händer (`combat.ts`, `magic.ts`, `light.ts`,
`locks.ts`, `inventory.ts`, `trade.ts`, `time.ts`, `talents.ts`, `game.ts`). Kartvyns
hugg-animation behålls som i dag; ljudet kommer från motorns signal, inte från animationen.

### Ljudmodulen (`src/audio/`)

- **`sounds.ts`: tabellen.** Kopplar varje signal till en eller flera filer, med volym och om
  tonhöjden får variera. Det är den enda fil som behöver ändras när nya ljud kommer. Musiken
  kopplas här till platser och lägen.
- **`player.ts`: uppspelningen.** Korta ljud spelas med Web Audio (`AudioContext`), avkodas en gång
  och sparas. Flera ljud kan spelas samtidigt, med ett tak så att det inte blir gröt. Musiken spelas
  med ett `<audio>`-element per stycke (laddas när det behövs, strömmas) och tonas över på ungefär
  två sekunder när stycket byts. Ljudet låses upp vid första klicket eller tangenttrycket.
- **`index.ts`: kopplingen.** Lyssnar på `game.onCue` och `game.onChange` (för att byta musik när
  kartan eller läget ändras) och på startskärmen.
- **Inställningarna:** ljudvolym, musikvolym och av/på sparas i `localStorage` (läsningen och
  skrivningen ligger i `try`, som i `save.ts`). Gränssnittet är en liten ljudknapp i hörnet på
  startskärmen och i spelet, med två reglage och en knapp för av/på.

### Musiken

Kartorna får ett valfritt fält `music` i `MapDef` (`src/engine/map.ts`), till exempel `'by'`,
`'skog'`, `'grotta'`, `'fängelsehåla'`, `'trygg'`. Utan fältet väljs musiken efter kartans slag.
Fiendegrupper kan markeras som `boss` och får då bossmusiken.

| Läge | Flare-stycke |
| --- | --- |
| Startskärmen, skapa rollperson | `title_theme` |
| Världskartan (förval för `värld`) | `overworld_theme` |
| By (`music: 'by'`, Hagby, Gråvad) | `town_theme` |
| Skog | `forest_theme` |
| Grotta (Varggrottan, Gråvads grotta) | `cave_theme` |
| Fängelsehåla | `dungeon_theme` |
| Värdshus, Mellan äventyren | `safe_room_theme` |
| Strid | `battle_theme` |
| Strid mot boss (Grukk) | `boss_theme` |
| Förval för mötesplatser utan `music` | `magical_theme` |
| Oroligt, till exempel efter en död | `unrest_theme` (sparas till senare) |

Den som modulerna inte nämner får förvalet. `wind_ambient` används inte nu.

### Ljudeffekterna (första kopplingen)

| Signal | Flare-ljud |
| --- | --- |
| Anfall i närstrid | `melee_attack`, `_2`, `_3` (slumpas, tonhöjden efter vapengrupp: kross och yxa lägre, dolkar högre) |
| Parerad | `powers/block` |
| Skott | `powers/shoot` |
| Person träffad, dör | `male_hit`, `female_hit`, `male_die`, `female_die` |
| Varelse träffad, dör | `enemies/` efter sort: svartalfer `goblin_`, skelett `skeleton_`, odöda `zombie_`, stora varelser `minotaur_`; annars `goblin_` med lägre tonhöjd |
| Besvärjelse: eld | `powers/fireball`, `burn` |
| Besvärjelse: blixt | `powers/shock`, `thunder` |
| Besvärjelse: köld | `powers/freeze` |
| Besvärjelse: läkning, motgift | `powers/heal` |
| Besvärjelse: skydd (sköldar, ANTIMAGI, BESKYDDARE) | `powers/shield` |
| Besvärjelse: förflyttning (TELEPORTERA, SPRÅNG, FLYGA) | `powers/teleport` |
| Besvärjelse: jord och växter (ÖRTRANKOR) | `powers/spikes`, `quake` |
| Besvärjelse: mentalism och övrigt | `powers/timestop` (förval per skola) |
| Misslyckad besvärjelse, för lite PSY | `no_mana` |
| Förmågor (Riddarslag, Kroppskontroll) | `powers/warcry` |
| Handpåläggning | `powers/heal` |
| Steg | `steps/step_cloth`, `_leather`, `_metal`, `_echo` 1–4 |
| Facklan tänds | `environment/open_fire` |
| Dörr | `door_open`, `environment/stone_open` |
| Kista | `wood_open` |
| Packning | `inventory/` efter sort (`metal`, `leather`, `cloth`, `potion`, `book`, `coins` med flera) |
| Träning | `level_up` |
| Striden börjar | `powers/warcry` och `inventory/inventory_metal` tillsammans, sedan stridsmusiken |
| Knappar | `widget_activate` |

### Luckor (fylls senare)

| Behövs | I stället tills vidare |
| --- | --- |
| Vapenskrammel när striden börjar | stridsropet och metallklirr ihop |
| Att tända en fackla (tändstål, låga som tar sig) | lägereldens knaster |
| Att sova och slå läger | musiken tonar ned och lägereldens knaster spelas kort |
| Olika ljud för svärd, yxa och klubba | samma tre hugg med olika tonhöjd |
| Steg på gräs, grus, trä, vatten | stegen efter utrustningen |
| Varg, björn, elementarer | närmaste varelseljud med annan tonhöjd |
| Båge och armborst var för sig | samma skott |

### Omkodningen (`tools/flare_audio.py`)

Som `tools/flare_art.py`: läser en utcheckning av flare-game och skriver till `public/audio/flare/`.

- Format: MP3, som spelas i alla vanliga webbläsare. Ljudeffekterna i mono, cirka 64 kbit/s.
  Musiken i stereo, cirka 96 kbit/s. Ljudeffekternas tystnad i början och slutet klipps bort.
- Bara filer som används i tabellen kodas om.
- Kräver `ffmpeg`.
- MP3 lägger till en kort tystnad i början. Musikslingorna tonas därför in och ut vid varje varv i
  stället för att skarvas exakt.

## Prövning

- Vitest: motorn skickar rätt signaler i de viktiga fallen (anfall med träff, miss och parering,
  besvärjelse, steg med rätt material, facklan, sömnen, striden börjar och slutar). Inga tester
  för själva uppspelningen.
- Ett test som kontrollerar att varje fil i `sounds.ts` finns i `public/audio/`.
- Provkörning i webbläsaren med Playwright: att ljudet låses upp utan fel i konsolen, och att
  musiken byter vid strid. Hur det faktiskt låter måste Vidar lyssna på själv.

## Mina val (Vidar kan ändra)

- MP3 som format och bithastigheterna ovan.
- Bara den som styrs låter när den går.
- Musiken efter kartans slag med ett valfritt fält per karta, och vilket Flare-stycke som hör till vilket läge.
- Kopplingen mellan signaler och ljud i tabellerna ovan.
- Ljudknappen i hörnet i stället för en snabbtangent (de flesta bokstäverna är redan tagna).
- Ljudet och musiken på 70 % och 50 % från början.

## Kvar åt den som bygger

- Exakt var i motorn varje signal skickas, och fälten i `Cue`.
- Taket för hur många ljud som spelas samtidigt, och hur mycket tonhöjden varierar.
- Hur ljudknappen ser ut, i samma stil som resten av gränssnittet.
