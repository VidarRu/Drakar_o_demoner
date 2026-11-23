# Överlämning: regelverket enligt Drakar och Demoner 1991

Det här är läget i arbetet och planen för nästa session. Läs också `docs/regelbeslut.md`,
som samlar alla tolkningar och husregler som Vidar har godkänt.

## Mål

Spelet ska följa originalreglerna i Drakar och Demoner (tredje upplagan, 1991) så troget som
möjligt, för en autentisk känsla. Undantagen är husreglerna i `docs/regelbeslut.md`.
Regelböckerna är upphovsrättsskyddade: lägg aldrig in text ur dem i repot, bara regelvärden och
egna korta beskrivningar.

## Källor

Vidar har avskrifter av Bok I (Rollpersonen), Bok II (Spelledarboken) och Bok III (Spelarboken)
som Markdown-filer, och en skanning av originalrollformuläret. De finns **inte** i repot. Be
Vidar ladda upp dem igen om en uppgift kräver texten, till exempel elementarerna (Bok III s. 21–22),
stridskonsterna eller varelsernas detaljer.

## Byggordning

| Steg | Innehåll | Läge |
| --- | --- | --- |
| 1 | Regelkärnan: färdighetsslag med omslag, differensvärde, motståndsslag och alla tabeller | Klart (`src/engine/rules/`) |
| 2 | Regeldata: raser, yrken, färdigheter, vapen, rustningar, sköldar, varelser, besvärjelser, utrustning | Klart (`src/data/`) |
| 3 | Skapa rollperson med bakgrundspoäng, plus guiden i gränssnittet | Klart (`src/engine/creation.ts`, `src/ui/creation.ts`) |
| 4 | Detaljerad strid enligt husreglerna, och rollformuläret i originalets stil | Klart (`src/engine/combat.ts`, `src/ui/sheet.ts`) |
| 5 | Tid och utveckling: spelklocka, läkning, Läkekonst, infektioner, amputation, PSY-poäng, EP och träning | Klart (`src/engine/time.ts`, `src/ui/training.ts`) |
| 6 | Magi, avståndsstrid, örter och gifter, bärförmåga och handel | Klart (`src/engine/magic.ts`, `combat.ts`, `poison.ts`, `inventory.ts`, `trade.ts`, `src/ui/panels.ts`) |
| 7 | Följeslagare, elementarer, smygarläge, Avväpna, Fasthållning och stridskonster | Klart (`src/engine/party.ts`, `elementals.ts`, `maneuvers.ts`, `stealth.ts`) |
| 8 | Äventyrsmoduler och utveckling mellan äventyren, plus beslutade ändringar | **Pågår**: dödsregeln, elementarerna, modulformatet och utvecklingen mellan äventyren är klara; se nedan |

## Steg 8: äventyrsmoduler och utveckling mellan äventyren

Vidar har bestämt dödsregeln och hur modulerna byggs upp (avsnitten Strid och Äventyrsmoduler i
`docs/regelbeslut.md`).

### Klart i steg 8

- **Döden** (`combat.ts`): `checkTotal` gör rollpersonen och följeslagarna döende (`Actor.dying`) på 0 KP. `dyingRound` tar 1 KP per runda och slår FYS-slaget var tionde runda i strid (`DYING` i `rules/tables.ts`), `stabilize` sätter KP 1. Första hjälpen (`bandageOnce`), `Game.heal` (HELA och läkeörter) och Läkekonst (`medicine`) stabiliserar. Den som är ensam dör (`someoneStanding`). `aidAfterCombat` räddar döende efter striden. Med 1 KP går man i halv fart.
- **Elementarer:** effekten `styr` spärrar inte längre magikern.
- **Modulformatet** (`src/content/`): varje modul är en `ModuleDef` (`src/content/types.ts`) i en egen mapp. Gråvad är speltestmodulen (`src/content/speltest/`). `src/content/index.ts` slår ihop modulernas varelser, personer, följeslagare, kartor och samtalsval i gemensamma register (`CREATURES`, `NPCS`, `RECRUITS`, `MAPS`, `MODULE_INTENTS`), så id:n måste vara unika över alla moduler. Gråvads egna samtalsval (uppdraget, ringbrynjan) ligger nu i modulen.
- **Uppdrag, epilog och utgångar** (`src/engine/modules.ts`): `questLog` räknar fram uppdragsloggen ur modulens flaggor (`QuestDef.start`, `done`, `failed`, `steps`). `pendingEpilogue`, `stayAfterEpilogue` och `leaveModule` sköter slutet. Kartor kan ha utgångar (`MapDef.exits`); `Game.stepPlayer` öppnar frågan (`openUi('exit')`). Gråvads utgång är vägen vid västra kanten.
- **Mellan modulerna:** `startModule` tar gruppen (med skador, packning, pengar och tid) till nästa moduls startkarta. Kartan som lämnas sparas i `GameState.places` och modulens flaggor i `GameState.moduleFlags`; `GameState.flags` är alltid den nuvarande modulens. `spawnActors` placerar inte ut personer som redan följer med eller varelser vars dödsflagga är satt. En följeslagare som lämnar gruppen på en annan karta går hem till sin (`CompanionInfo.homeMap`).
- **Gränssnittet** (`src/ui/module.ts`): uppdragsloggen (knappen Uppdrag, tangenten U), epilogen med "Avsluta äventyret" och "Stanna kvar", frågan vid utgången och skärmen "Mellan äventyren" där nästa modul väljs. När rollpersonen dör finns den senaste sparningen kvar ("Ladda senaste sparningen").
- Sparformatet är version 7 (`dod-save-v7`); äldre sparningar läses inte. De nya fälten från utvecklingen är valfria, så sparningar från tidigare i steg 8 går att läsa.
- **Utvecklingen mellan äventyren** (Bok I s. 62–65 och Bok III s. 7; alla beslut i `docs/regelbeslut.md` under Utveckling mellan äventyren):
  - **Veckoplanen** (`src/engine/progress.ts`): `runWeek` låter en vecka gå för hela gruppen med en `WeekActivity` per person: vila, ensamträning, lärare, bibliotek, bok eller arbete. `teachers`, `teachProblem`, `teacherCost`, `teacherBonus`, `activityProblem`, `planProblem` och `weekCost` står för reglerna. `joinAcademy` gör någon till medlem i magiakademin.
  - **Lärare:** stadens lärare och akademins magister finns i `src/content/mellanspel.ts` (`CITY`). Personer i modulerna undervisar med `NpcDef.teaches`, och följeslagare som uppfyller kraven undervisar gratis.
  - **Böcker:** `BookDef` och `ModuleDef.books` och registret `BOOKS`. Böckerna ligger i packningen under sitt id. En bok med `spell` är en magisk kodex. Varelser kan bära föremål med `CreatureDef.loot`, och Grukk bär *Krönika över Gråvadsbygden* (Historia, högst 5 EP).
  - **Belöningar och hjältepoäng** (`src/engine/hero.ts`):
    - `grantRewards` körs i `Game.changed()` och ger var och en i gruppen `QuestDef.bonusEp`, `QuestDef.heroPoints` och `ModuleDef.deeds` (`DeedDef`) en gång, när flaggan sätts. Det som redan har delats ut står i `GameState.rewarded`.
    - `heroic` uppgraderar nästa slag när `Actor.heroArmed` är satt, vid anfall, parering, skott, besvärjelser och `playerCheck`.
    - `setFv` ger 1T4 HP vid FV 21, 41 och 61.
    - `rollHeroAbility` och `chooseHeroAbility` köper särskilda förmågor (`Character.heroAbilities`), och `raiseAttribute` höjer grundegenskaper. `abilitiesOf` ger alla förmågor, och `recompute` räknar om KP, förflyttning och initiativ.
  - **PSY-kamp:** `markPsyWin` sätts vid skräckslag (oberörd) och magiskt motstånd. `psyRaiseAfterAdventure` körs i `leaveModule`.
  - **Igenkänd:** `meet` slår när samtalet öppnas (`GameState.met`, flaggan `igenkand_<npc>`), och `dialogClient` berättar det för AI-spelledaren.
  - **Gränssnittet:**
    - Träningsvyn har veckoplanen (`src/ui/week.ts`) ovanför inväxlingen av EP.
    - Skärmen "Mellan äventyren" har knappen "Vila, träning och EP", magiakademin och hjältepoängen.
    - Knappen "Hjältepoäng" finns i stridspanelen och i panelen när man utforskar.
    - Rollformuläret visar alla förmågor och hjältepoäng.
  - **Rättat på vägen:** taket för Historia, Alkemi och Kunskap om … räknades mot en Läsa/Skriva-nyckel som inte fanns (FV sparas per språk), så taket blev 0. `bestFv` i `time.ts` letar nu upp språket. Extremt smärttålig gav inte heller fler KP i spelet; `recompute` gör det nu.
  - **Läsnivå:** `readLevel` ger B1–B5 efter bokens tak i EP, och magiska skrifter kräver B4. En bok kan ha ett eget `readLevel` och ett `language`.
  - **Gråvads exempel (Vidar har godkänt):** Grukk ger 2 HP till var och en, uppdraget ger 3 bonus-EP som förut, och Grukk bär krönikan (B2). Asta har Läkekonst 17 och INT 13 och undervisar i Läkekonst (`NpcDef.teaches`).
- **Besluten om de öppna frågorna** (Vidar gick igenom dem; se `docs/regelbeslut.md`):
  - Handlare köper för en fjärdedel av listpriset (`TRADE.sellShare`).
  - Alla sköldar räknas som järn för magin (`ironProblem`).
  - Magikern väljer målet för BLIXT (`aim: 'fiende'`, och `aim: 'närmast'` är borttaget).
  - En följeslagare som undervisar hinner också med en egen sysselsättning (`activityProblem` och `runWeek`).
  - PSY-slaget efter äventyret följer magikerns regel för den som kan magi (`knowsMagic` i `hero.ts`), annars den vanliga.
  - De andra tolkningarna i steg 6 och i utvecklingen mellan äventyren är godkända som de är.
  - **Figurval:** spelaren väljer figur i första steget när rollpersonen skapas (`Draft.sprite` och `Character.sprite`, listan `PLAYER_SPRITES` i `src/content/index.ts`). Fyra nya figurer finns: magiker, krigarinna, alv och dvärg. Utan eget val används yrkets figur (`PROFESSION_SPRITES`, där magiker nu får magikerfiguren).

### Nästa i steg 8

1. **Vidars första äventyr:** han laddar upp ett äldre äventyr, och det byggs om till en modul med egna ord.
2. **Världskartan** för modulen: rutnät ovanifrån, en ruta per timme, gruppen som en figur, fiender som ikoner som vandrar och jagar, smyga förbi, stridsmöten på färdiga stridskartor efter terrängen, och mötesplatser som man går in i och ut ur. `GameState.places` är redan byggt för att spara kartor man lämnar. `Game.map` är i dag `readonly` och byggs när spelet startar; att byta karta inom en modul kräver att kartvyn (`WorldScene`) byggs om.
3. **Resekartan** för kampanjen, med modulerna som klickbara ikoner. Restid bestäms senare.
4. **Utvecklingen mellan äventyren:** klar (se ovan). Kvar är stadskartan i stället för menyn, att bestämma per modul vilka dåd som ger hjältepoäng och bonus-EP, en lista över vilka språk böckerna är skrivna på, och unika lärare i modulerna som kan flytta till staden (med kampanjspelet).
5. **Slumpmöten** i vildmarken: Vidar vill ha dem, men tabellerna saknas.
6. **Sparning på server** (till exempel Supabase), senare.

### Senare: förmågor och besvärjelser utan verkan

Vidar vill gå igenom tre listor och bestämma vad var och en gör i spelet:

1. **Särskilda förmågor** som inte gör något än, till exempel Gudarnas gunstling, Turgubbe, Djurvän, Hamnbytare, God tidskänsla och Absolut ögonmått. De kan köpas för hjältepoäng.
2. **Yrkesförmågor** som inte gör något än.
3. **Besvärjelser** som saknar `effect` i `src/data/spells.ts` (se nedan).

Vidar vill också göra en genomgång av hela regelsystemet när det är klart, för att se att det är konsekvent.

### Senare: besvärjelser

Vid något tillfälle ska vi diskutera fiender som lägger besvärjelser, och vad alla besvärjelser gör. Vidar vill att **alla besvärjelser i regelboken ska ha en verkan** i spelet. I dag verkar 21 plus de åtta elementarerna.

### Andra kandidater

- Varelser som söker skydd, och fiender som frammanar elementarer.
- Fler handlingar: använda magiska föremål, piskans avväpning, spjut mot anstormande varelser och strid från hästryggen.
- Fler figurer att välja bland, till exempel för halvlängdsman, anka och halvorch.

## Steg 7 i korthet

- **Gruppen** (`src/engine/party.ts`): `GameState.party` är rollpersonen och upp till fem följeslagare, `GameState.companions` deras rollformulär per aktörs-id. `Game.leader` är rollpersonen, `Game.player` den som styrs (i strid den vars tur det är, annars den som valts med `setFocus`) och `Game.char` dess rollformulär. `charOf(a)` ger rollformuläret för vem som helst i gruppen. Allt som tidigare gällde rollpersonen (packning, magi, örter, träning, läkning, tid) gäller nu den som styrs eller var och en i gruppen.
- **Följeslagare** definieras i `src/content` som `RECRUITS` (skapade med `newDraft` och `finalize`, alltså samma regler som rollpersonen) och placeras på kartan med `recruit` i `spawns`. Samtalsvalet `folj_med` värvar, `Game.dismiss` låter dem gå. `payWages`, `shareLoot`, `leaveParty`, `fallenCompanion` och `aidAfterCombat` sköter lön, byte, avsked, död och förband efter striden. Gråvad har Hjalmar, Sigrid och Linnea.
- **Elementarer** (`src/engine/elementals.ts`): `ELEMENTALS` beskriver de åtta sorterna, `summonOrBanish` frammanar eller skickar bort, `elementalRound` räknar ned och verkar varje runda, `elementalTakes` avgör hur vapen biter, `actions` och `act` är de särskilda handlingarna. En elementar är en figur med `kind: 'player'` och `Actor.elemental`; magikern har effekten `styr`.
- **Fler handlingar** (`src/engine/maneuvers.ts`): `helpOptions` och `help` (hjälpa en kamrat), `attackModes`, `maneuverProblem` och `maneuver` (Avväpna, Fasthållning och stridskonsternas anfall), `keepHold`, `breakHold` och `release` (fasthållning och låsning), `roll5` (Rulla). `CombatState.attackMode` och `feint` väljs i stridspanelen.
- **Smygarläge** (`src/engine/stealth.ts`): `toggleSneak` och `sneakRound`. `Actor.sneaking` och `hidden`. Anfall från smygarläge (`ambush` i `combat.ts`) följer Bok II. `sneakMod` har modifikationerna. Facklor: `Actor.torchOut`, `torchLit`, och luminalens och umbrans glober i `lightMod`.
- **Stridskonster** i `combat.ts`: `martialOk`, obeväpnad parering och avväpning i `tryParry`, Stålsättning (`steel`), Vidvinkelsyn i `flankMod`, Blind strid och Liggande strid.
- **Gränssnittet:** gruppanelen ovanför stridspanelen (klicka för att välja vem som visas), elementarens status och handlingar, val av anfallssätt, Fint, Smyg, facklan, hjälp åt kamrater, Släpp taget och Rulla. Träningsvyn har en flik per gruppmedlem. Kameran följer den som har turen. Nya figurer: knekt, jagarinna, linnea och åtta elementarer (`src/game/art/sprites.ts`).

## Steg 6 i korthet

- **Magi** (`src/engine/magic.ts`, regler i `rules/magic.ts`): `castSpell` lägger en besvärjelse med E, extra E för räckvidd och varaktighet och ett mål. Kvicka verkar direkt, andra via `combat.pending` i början av nästa runda (`resolvePending`), och en träff bryter koncentrationen. `memorize`, `forget` och `learnSpell` sköter minnet och formelsamlingen (`Character.spells` och `Character.memorized`). Besvärjelsernas verkan står som `effect` och `aim` i `src/data/spells.ts`; 21 besvärjelser verkar i spelet.
- **Avståndsstrid** (`combat.ts`, sist i filen): `rangedInfo`, `shootProblem`, `shoot`, `reloadStep` och `takeCover`. Rollpersonen skjuter genom att klicka på en fiende med ett avståndsvapen i handen. Varelser får ett avståndsvapen med `CreatureDef.ranged`; svartalfsskytten i grottan är den första.
- **Bärförmåga och packning** (`src/engine/inventory.ts`): `carriedWeight`, `loadMod`, `equip`, `stow`, `wearArmor` och `ironProblem`. Bördan dras från förflyttning, initiativ och SMI-färdigheter i strid och i `skillMod`, som nu används för alla färdighetsslag utanför anfall och parering.
- **Handel** (`src/engine/trade.ts`): `wares`, `buy`, `sell`, `haggle`. Handlarna anges med `NpcDef.shop`, och samtalsvalet "Handla" öppnar boden.
- **Örter och gifter** (`src/data/herbs.ts`, `src/engine/poison.ts`, regler i `rules/poison.ts`): `useHerb`, `searchHerb`, `poisonActor`, `updatePoisons`, `advancePoisons` och `neutralize`. Gifter på vapnet ligger i `Actor.weaponPoison`, gifter i kroppen i `Actor.poisons`.
- **Gränssnittet** (`src/ui/panels.ts`): fönstren Packning (P), Magi (M) och handlarens bod. Stridspanelen har knappar för Packning, Magi, Ladda om och Sök skydd, och statuspanelen visar avståndsvapen, börda och gifter.
- **Effekter** som ska överleva striden har `persist`. Örter som läker efter en stund använder effekten `läkning`, som läker när den tar slut (`combat.onExpire`).
## Steg 5 i korthet

- `src/engine/time.ts`: `advanceTime` driver klockan, läkning (1 KP per dag, halvt utan vila), PSY-poäng, effekter i dagar och att sömn låser upp EP. `rollInfections` körs efter striden, `amputate` vid kallbrand och krossade ben, `medicine` är Läkekonst en gång per dag.
- EP samlas per färdighet i `Actor.ep` (`gainExperience` vid lyckade slag, även anfall, parering, Två vapen och Dra vapen). De växlas in i träningsvyn efter en veckas vila (`vila_vecka` på värdshuset). Bonus-EP från uppdraget ligger i `Character.bonusEp`.
- I gränssnittet finns klockan och PSY i statuspanelen, knapparna "Sov 8 timmar" och "Läkekonst", och gumman Asta vårdar med Läkekonst.
- Träning med lärare, PSY-höjning, hjältepoäng och fler sätt att få erfarenhet byggdes i steg 8. Feber ger −5 på allt (godkänd husregel).

## Hur koden hänger ihop

- `src/engine/game.ts` är spelmotorn och fasaden mot gränssnittet. `makeActor` skapar figurer med KP per kroppsdel och BV på utrustningen.
- `src/engine/combat.ts` innehåller hela striden (gratisrundan med Dra vapen finns i `startCombat`):
  - turordning med initiativ varje runda, rundans början med blödning, effekter, moral och skräck,
  - anfall och parering enligt resultattabellen, pareringsavdrag och sköldens fria parering,
  - träffområden, rustning per kroppsdel, sårverkan, kritiska skador och blödning,
  - fummeltabellerna, Skräcktabellen och moralslag,
  - varelsernas turer (`autoTurn`), även för rollpersonen när skräcken tar över.
- `src/engine/rules/fumble.ts`, `fear.ts` och `outcomes.ts` innehåller fummeltabellerna och Skräcktabellen som data med egna ord. Tabellen för kritiska skador och stridens konstanter ligger i `tables.ts`.
- `Actor` har `locKp`, `bleeding`, `effects`, `bv` och `injuries`. Effekterna (`ActiveEffect`) varar i rundor, dagar, ett antal slag eller tills något händer.
- `GameState.dropped` är föremål som tappats på marken och `GameState.time` är speltiden i sekunder. Sparformatet är version 6; äldre sparningar läses inte.
- **Rollformuläret** (`src/ui/sheet.ts`, öppnas med R) följer originalformulärets uppställning: framsida med grundegenskaper och färdigheter, baksida med kroppsfiguren och träffområdena, vapen, pengar och utrustning. Förlorade KP kryssas över. Kroppsfiguren (`src/ui/figure.ts`) används också i statuspanelen, färgad efter skadorna.
- `src/content/` innehåller äventyret Gråvad. Varelserna har `humanoid`, `darkvision`, `leader`, `noMorale`, `fear` och `ranged`, personerna `shop`, och kartan `habitats` (växtplatser för örter).
- **Spelarfigurer:** spelaren väljer bland `PLAYER_SPRITES` (krigare, krigarinna, jägare, tjuv, magiker, alv och dvärg). `PROFESSION_SPRITES` ger förvalet för varje yrke.

## Saknas i striden

- **Magiska föremål** att använda på turen.
- Piskans avväpning, spjut mot en anstormande varelse och strid från hästryggen.
- Varelser som söker skydd, lägger besvärjelser eller värvar egna elementarer.

## Kontroll

```bash
npm test
```

```bash
npx tsc --noEmit
```

Det finns 179 tester. `tests/combat.test.ts` prövar stridens regler med styrda tärningar och spelar
30 hela strider i grottan. `tests/time.test.ts` prövar läkning, infektioner och EP. `tests/creation.test.ts` bygger bokens exempelrollperson Teval och
`tests/rules.test.ts` räknar om bokens exempel. `tests/step6.test.ts` prövar magin, avståndsstriden, bördan, handeln och gifterna, bland annat bokens giftexempel med Strahinya. `tests/step7.test.ts` prövar följeslagarna, smygarläget, Avväpna, Fasthållning, stridskonsterna och elementarerna, och spelar 20 hela strider med hela gruppen i grottan. `tests/step8.test.ts` prövar dödsregeln och äventyrsmodulerna. `tests/progress.test.ts` prövar lärarna, biblioteket, böckerna, arbetet, belöningarna, hjältepoängen, PSY-höjningen och igenkänningen.

För att provköra gränssnittet: starta `npx vite` och styr sidan med Playwright. Ett snabbt sätt är
att skapa ett spel med `Game.create(testCharacter())`, lägga `JSON.stringify(g.state)` i
`localStorage` under nyckeln `dod-save-v7` och klicka på "Fortsätt äventyret". Från sidan går det att
importera moduler direkt, till exempel `await import('/src/engine/game.ts')` och `await import('/tests/helpers.ts')`.

## Öppna frågor till Vidar

- Fiender som lägger besvärjelser, och verkan för alla besvärjelser i regelboken.
- Vad de särskilda förmågorna, yrkesförmågorna och besvärjelserna utan verkan ska göra (se Senare ovan).
- Alla tolkningar i steg 6, 7 och i utvecklingen mellan äventyren är nu avgjorda.
