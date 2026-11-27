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
| 8 | Äventyrsmoduler och utveckling mellan äventyren, plus beslutade ändringar | **Pågår**: dödsregeln, elementarerna, modulformatet, utvecklingen mellan äventyren och världskartan är klara; se nedan |

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

### Världskartan (klar, Vidar)

Besluten står i `docs/regelbeslut.md` under Världskartan.

- **Regelvärden:** `src/engine/rules/travel.ts`.
  - `TERRAIN_COST`: en kvart per ruta, dubbelt i tät skog, kullar och vadställe, fyra gånger i berg.
  - `BATTLE_TERRAIN`: stridskartan för varje terräng.
  - `TRAVEL`: synhåll, snabba fiender, börda, läger, vandring och slumpmöten.
- **Kartformatet** (`src/engine/map.ts`):
  - `MapDef.kind` är `värld`, `plats` eller `strid`.
  - Nya rutor: `f` öppen skog, `F` tät skog, `h` kullar, `M` berg, `=` bro och `v` vadställe. `TileDef.terrain` anger terrängen.
  - `MapDef.places` är mötesplatserna. En utgång med `to` leder till en annan karta i modulen, och `to: 'tillbaka'` tar gruppen från en stridskarta till världskartan.
  - `MapDef.foes` är fiendernas platser på stridskartan, och `spawns` med `band` placerar ut fiendegrupper.
  - `cheapestPath` väljer den väg som tar kortast tid.
- **Byta karta:**
  - `swapMap` i `modules.ts` byter karta i speltillståndet och används också av `startModule`. Stridskartor sparas inte.
  - `Game.map` går att ändra. `Game.enterMap` byter karta, och `onMapChange` får `WorldScene` att byggas om (`scene.restart()`) och minikartan att byta storlek.
- **Motorn** (`src/engine/worldmap.ts`):
  - `travelStep`: ett steg, där tiden går efter terrängen.
  - `look`: det passiva Smyga-slaget, `worstSneaker` mot `bandSpot`.
  - `bandsAct` och `moveBand`: fiendegrupperna vandrar, jagar och går undan. Snabba grupper (`bandFast`) går dubbelt så fort. `loseSight` sköter Spåra och SPÅRLÖS.
  - Vidars ändringar efter första versionen:
    - `partyTrackless`: SPÅRLÖS på en räcker för hela gruppen.
    - `partyDarkvision`: mörkersyn hos en gäller hela gruppen utanför strid, och `WorldScene` lyser upp grottan.
    - `loadFactor`: halv fart över STY × 5.
    - `makeCamp`: läger mellan 22 och 6.
  - `randomEncounters`: slumpmötena.
  - `startEncounter`, `leaveBattle` och `battleOverHint`: stridsmötena.
  - `takeExit`: utgångarna mellan kartorna. `Game.attackBand` anfaller en fiendegrupp.
- **Speltillståndet:** `GameState.bands` (`BandState`), `GameState.encounter` och `GameState.travel`. `PlaceState.bands` sparar grupperna när gruppen går in på en mötesplats. Fälten är valfria, så sparformatet är fortfarande version 7.
- **Innehållet:**
  - `src/content/vildmark.ts` har de generiska varelserna (`vild_varg`, `vild_bjorn`, `stratrovare`, `vild_svartalf`), slumptabellerna (`ENCOUNTER_TABLES`) och fem stridskartor (`BATTLE_MAPS`).
  - Registret `BANDS` samlar fiendegrupperna.
  - Gråvads fiender har fått Finna dolda ting (6–12).
  - **Provfärden** (`src/content/provfard/`) är en provmodul utanför kampanjen. Den har en världskarta med alla terränger, Hagby, Varggrottan och tre fiendegrupper. Man når den från skärmen "Mellan äventyren", eller med `Game.create(char, rng, 'provfard')`.
- **Gränssnittet:**
  - Terrängen ritas med träd, kullar, bergstoppar och stenar i vadstället (`objects.ts`), och mötesplatserna har egna ikoner (`src/game/art/places.ts`).
  - Fiendegrupperna har en ikon med antalet. Muspekaren visar terrängen och tiden per ruta.
  - Ett klick på en fiendegrupp anfaller den.
  - Minikartan visar mötesplatser och fiender.
  - "Mellan äventyren" har en enkel resekarta (`ModuleDef.travel`).
- **Testerna** står i `tests/worldmap.test.ts`.
- **Kvar:** se Kvar under Världskartan i `docs/regelbeslut.md`. Det gäller färdtiden med skador, fiender och slumpmöten under natten, att fly från stridskartan och överraskning.

### Nästa i steg 8

1. **Grafikmotorn (klar, sammanslagen i PR #13; speltestas nu):** Vidar vill ha Avernums stil: samma rutnät men sett snett ovanifrån, rik natur, gruppens porträtt i en kolumn, en utrustningsdocka och många snabbtangenter. Han godkände fria bildpaket (med upphovspersoner i en fil om grafiken) och kan koppla in OpenRouter-krediter för bildmodeller till det som inte går att lösa så.
   - Vyn: `src/game/IsoScene.ts` och `src/game/iso/` ritar samma motor snett ovanifrån. Det är förval; `?vy=plan` visar den gamla vyn.
   - Grafiken: Flare (CC BY-SA 3.0) för gräs, träd, föremål, figurer i åtta riktningar, utrustningslager och porträtt, plockad och nedskalad med `tools/flare_art.py` till `public/art/flare/`. Upphovspersonerna står i `public/art/CREDITS.md`.
   - Kodritat: vägar, vatten och stränder med mjuka kanter, kullarnas skuggning, murar, berg och dörrar som block.
   - Gränssnittet: porträttkolumnen, minikartan uppe till höger, loggen och knapparna centrerade längst ned, statuspanelen bakom ☰ eller I, och utrustningsdockan i packningen (`src/ui/doll.ts`).
   - Tangenterna går längs rutnätet (Vidar): W/↑ norrut, S/↓ söderut, A/← västerut, D/→ österut och Q, E, Z, C snett. B börjar strid, G smyger, T tänder eller släcker facklan, V sover, L lägger förband och mellanslag avslutar turen.
   - Genomskinlig bubbla (Vidar): träd, murar och berg framför gruppens figurer tonas ut, mest närmast figuren (`bubble` i `IsoScene.ts`).
   - Dialogvalen väljs med siffertangenterna 1–9 (Vidar), utom när man skriver i textfältet.
   - Gå igenom varandra (husregel, Vidar): man byter plats med en kamrat (`blockedFor` och `swapWith` i `game.ts`, `tests/passthrough.test.ts`).
   - Vidar har bestämt att det är den här stilen spelet ska ha. Speltestarna ger återkoppling; den tas om hand innan planen nedan.
   - Kända brister: vargar, björnar och elementarer är de gamla pixelfigurerna förstorade, bergen är enkla block, svartalferna är Flares goblins med en färgton, och AI-samtalen saknar `OPENROUTER_API_KEY` i Vercel.
2. **Vidars första äventyr:** han laddar upp ett äldre äventyr, och det byggs om till en modul med egna ord. Modulen får en världskarta som Provfärdens.
3. **Resekartan** för kampanjen: platshållaren finns, och restiden bestäms senare.
4. **Utvecklingen mellan äventyren:** klar (se ovan). Kvar är stadskartan i stället för menyn, att bestämma per modul vilka dåd som ger hjältepoäng och bonus-EP, en lista över vilka språk böckerna är skrivna på, och unika lärare i modulerna som kan flytta till staden (med kampanjspelet).
5. **Riktiga tabeller för slumpmöten** i stället för de generiska.
6. **Sparning på server** (till exempel Supabase), senare.

### Plan för grafik och ljud (Vidar, efter grafikmotorn)

Ordningen är Vidars. Varje punkt brainstormas när den är på tur.

1. **Ljud och musik (klart, Vidar behöver lyssna).** Design: `docs/superpowers/specs/2026-11-27-ljud-och-musik-design.md`.
   - Motorn skickar ljudsignaler (`Cue` i `src/engine/game.ts`, `Game.onCue` och `Game.cue`). De säger vad som hände: anfall, skott, skada, död, besvärjelse, förmåga, steg, ljus, vila, att striden börjar och slutar, lås, packning och träning. Motorn känner inte till ljud.
   - `src/audio/sounds.ts` är ljudtabellen: vilket Flare-ljud som hör till vilken signal. Det är den fil som ändras när nya ljud kommer. `src/audio/music.ts` väljer musiken efter läget (strid, boss, död, mellan äventyren), rutan där ledaren står (grottgolv, trägolv) och kartan (`MapDef.music`). Bossar har `CreatureDef.boss` (Grukk).
   - `src/audio/player.ts` spelar upp: ljudeffekter med Web Audio (högst 8 samtidigt), musik som tonar över på två sekunder och byter först när valet har varit detsamma en sekund. `src/audio/index.ts` kopplar ihop allt, och ljudknappen ♪ har reglage för ljud och musik och Tyst (sparas under `dod-ljud`).
   - Ljuden är främst Flares, omkodade till MP3 av `tools/flare_audio.py` (`public/audio/flare/`). Upphovspersonerna för allt ljud står i `public/audio/CREDITS.md`.
   - Stegen följer marken: gräs, löv i tät skog, grus på stigar, trä, sten, sten med eko i grottor och vatten i vadställen (Vidar: inte rustningen). När striden börjar hörs ett svärd som dras och ringbrynja, och en fackla som tänds låter som en låga som tar sig. De ljuden kommer från OpenGameArt (`tools/oga_audio.py`, `public/audio/oga/`, design i `docs/superpowers/specs/2026-11-27-steg-och-vapenskrammel-design.md`).
   - **Vidar behöver lyssna** och säga vad som ska bytas. Kopplingen är gjord efter filnamnen.
   - **Kvar (luckorna):** att sova och slå läger (nu kort knaster), olika ljud för svärd, yxa och klubba (nu samma hugg med olika tonhöjd), djurljud för varg, björn och elementarer, båge och armborst var för sig, och miljöslingor (fåglar, flod, vind; Flare har dem). Källor: OpenGameArt och Kenney (CC0), Freesound (kontrollera licensen per ljud).
2. **Fler figurer i samma stil som Flares.**
   - **Blender först (Vidar):** börja figurarbetet med att få tillgång till Blender, så att egna figurer och animationer kan renderas i samma stil som Flares. Pröva först om Blender går att köra utan skärm i molnmiljön (till exempel `apt-get install blender` eller Python-paketet `bpy`). Annars kan Vidar koppla in sin egen dator, där Blender är installerat.
   - **Monstren:** en figur för varje varelse i monsterlistan i Bok II. Flare har goblin, skelett (även skytt och magiker), zombie, minotaur, myrlejon, wyvern, eld- och ismyror och en förbannad grav. Resten byggs. Flares figurer är renderade i Blender (`art_src/` har .blend-filerna), så nya figurer kan renderas med samma kamera och ljus, till exempel från fria 3D-modeller (CC0). Bildmodeller via OpenRouter är ett alternativ, men det är svårt att få åtta riktningar som hänger ihop.
   - **Spelarfigurerna:** en figur per ras och yrke, både man och kvinna (sju raser, elva yrken). Figurerna byggs av lager som i dag:
     - kropp efter kön och ras (dvärg och halvlängdsman kortare och bredare),
     - huvud efter ras (alvöron, dvärgskägg, halvorchens betar),
     - utrustning och vapen efter yrke.
     - Bara huvuden och kroppsformer behöver göras nya. Ankan behöver en helt egen figur.
     - Porträtten följer samma uppdelning.
   - **Anfall:** Flares figurer har redan en hugg-animation (`swing`), och den spelas vid anfall i närstrid. Flare har också `cast` (besvärjelse), `shoot` (båge), `hit`, `block` och `die`. Dem plockar vi ut och använder vid besvärjelser, skott, träffar och död.
3. **Animationer för besvärjelser.** I dag visas bara text (skada, miss, läkning) och zonerna (MÖRKER, DIMMA, BESKYDDARE). Varje besvärjelse behöver en egen effekt. Vidar vill pröva att göra dem i Blender, renderade till bildserier som figurerna; partiklar i Phaser och Flares effektbilder är alternativ.
4. **Skapa rollperson och rollformuläret som i böckerna.** Vidar tar med skärmdumpar. Rollformuläret ska gå att ta fram i spelet och likna originalet, för nostalgin.

### Förmågor, besvärjelser och väder (pågår)

Vidar har godkänt förslaget i `docs/forslag-magi-och-formagor.md`: fiender som lägger besvärjelser,
en verkan för alla besvärjelser, alla förmågor och ett väder med två mätare. Svaren på frågorna och
vädret står i `docs/regelbeslut.md` under Förmågor, besvärjelser och väder. Byggordningen står i
förslagets avsnitt 5.

- **Klart (steg 1 i ordningen):** förmågorna som redan hade regelvärden används nu i spelet. `passivesOf`, `passive`, `passiveCl`, `weaponCl`, `professionsOf`, `folkOf` och `banemanCl` i `src/engine/hero.ts`. Yrkesförmågorna har `passive` i `src/data/professions.ts` (Stridsvana, Snusförnuft och Härdad av havet), och `INITIATIVE_MODS.stridsvana` är borttagen. Baneman väljs ur `FOLK_LIST` (`src/data/creatures.ts`), och varelserna anger `CreatureDef.folk`. Testerna står i `tests/abilities.test.ts`.
- **Klart (steg 2):** de enkla förmågorna. God bågskytt, Järnnäve, Snabb uppfattning, Djurvän, Gott läkekött, God mental kontroll, Turgubbe, Tjuvtur, Gudarnas gunstling, Riddarslag, Anfall bakifrån, Handpåläggning, Meditation och God kroppskontroll verkar i spelet (se `docs/regelbeslut.md`).
  - `src/engine/talents.ts` har turen (`cycleLuck`, `applyLuck`), `godsFavor`, `backstabs`, `layOnHands`, `meditate` och `bodyControl`. Regelvärdena står i `ABILITY_RULES`.
  - `heroic` lägger på turen före hjältepoängen, och `raiseTarget` (`rules/check.ts`) räknar om slaget. Riddarslaget är anfallssättet `riddarslag` i `maneuvers.ts`, och Handpåläggning finns bland hjälphandlingarna.
  - STY räknas med `strength(a)` i striden, så att God kroppskontroll (effekten `styrka`) ger SB. Effekter kan gälla en enda färdighet (`scope: 'färdighet'` och `ActiveEffect.skill`), och `consumeSkillEffects` förbrukar dem efter `playerCheck`.
  - Gränssnittet har knappar för Turgubbe, Tjuvtur, Kroppskontroll och Meditera (med val av färdighet) i båda panelerna. Testerna står i `tests/talents.test.ts`.
- **Klart (barden och munken, Vidar):** bardens Förtrollande framträdande och munkens nya Meditation är en husregel. En minut och ett lyckat slag (Sjunga eller Spela instrument för barden, Normalt PSY-slag för munken) ger +5 på KAR- respektive INT-färdigheter i en timme, utanför strid. `perform` i `talents.ts`, effekterna har `scope: 'kar'` och `'int'`, och AI-spelledaren får veta när barden har förtrollat åhörarna. Knapparna Framträd och Meditera finns i panelerna. Vidar godkände samtidigt de andra tolkningarna för de enkla förmågorna.
- **Klart (steg 3 och 4):** magi för alla och fiender som lägger besvärjelser.
  - `castSpell`, `castProblem` och `spellTargets` tar magikern (`CastOptions.caster`). `spellbook` ger formelsamlingen och minnet för vem som helst.
  - Varelser får magi med `CreatureDef.magic`, och besvärjelserna står i `Actor.spells`.
  - `enemyCast` i `magic.ts` är fiendens val (HELA, skydd, skada) och anropas från `autoTurn`. `CombatState.cast` håller reda på vad varje fiende har lagt.
  - Den svartalfiska häxkonstnären står i Gråvads grotta (BLIXT, SKÖLD, HELA, figuren `haxkonstnar`).
- **Pågår (steg 5):** besvärjelserna i strid. ÖKA, MINSKA, FLAMMANDE HAND, VIRVELSKÖLD, MOTSTÅNDSKRAFT, ANTIMAGI, LJUS, MÖRKER, MAGISK SYN, OSYNLIGHET, KAMOUFLAGE, VINDPIL (1T10) och ASTRALVAPEN (1T10 eller 2T10, `ASTRAL_WEAPON` i `rules/magic.ts`) verkar nu. Det gör också SPRÅNG, LEVITATION, FLYGA, LYFT, TELEPORTERA, DIMMA, BESKYDDARE, KONTROLLERA PERSON och KONTROLLERA VARELSE (ointelligenta djur, `isCommonAnimal`).
  - Skada utan kroppsdel fördelas jämnt över kroppsdelarna (Vidar, `spreadDamage` i `combat.ts`), utom blödningen.
  - Verkan står i `apply` i `magic.ts`. Det som striden behöver står i `src/engine/spelleffects.ts`: zonerna (`GameState.zones`), `attrShift`, `flamingHand`, `inVortex`, `heatColdResist`, `unseen` och `breakHiding`.
  - `changeAttribute` och `endSpellEffect` i `combat.ts` ändrar och återställer grundegenskaper.
  - Magi-fönstret har ett val av grundegenskap för ÖKA och MINSKA, av en eller två händer för ASTRALVAPEN, och av riktning och avstånd för SPRÅNG, LYFT och TELEPORTERA (`moveReach`).
  - Den som svävar har effekten `svävar`: `airborne`, `flightSpeed` och `passable` i `spelleffects.ts`. `findPath` och `reachable` i `map.ts` tar en egen `canPass`. Knappen Landa (`Game.land`).
  - DIMMA och BESKYDDARE är zoner med `map`. `fogBlocks` styr `Game.canSee` och skotten. `wardCheck` i `magic.ts` slår till mot den som går in i BESKYDDARE.
  - KONTROLLERA PERSON ger effekten `kontrollerad` (`by`, `was`). `autoTurn` låter den kontrollerade anfalla, och `revertSpell` i `combat.ts` återställer den och landar den som svävar.
  - Testerna står i `tests/spells.test.ts`.
- **Klart (steg 6):** besvärjelserna utanför strid och låsta dörrar och kistor.
  - Låsen: `src/engine/locks.ts` (`lockAt`, `lockBlocks`, `pickLock`, `forceLock`, `lootChest`, `magicOpen` och `magicSeal`). Kartorna anger dem i `MapDef.locks`, och `GameState.locks` sparar läget. `Game.blocked` och `occupied` räknar med dem. Knapparna finns i panelen när man står intill, och kistorna, förseglingarna och zonerna ritas i `WorldScene`.
  - Besvärjelserna: `src/engine/worldspells.ts` (`worldProblem` och `applyWorld`). `apply` i `magic.ts` lämnar över allt den inte känner till.
  - Samtal: `dialogDef` i `dialogClient.ts` ger djuren en persona, `Game.canTalk` avgör vem man kan tala med, och `openUi('talk')` öppnar ett samtal på avstånd.
  - Djur som magin styr går efter gruppen i `stepPlayer`.
  - Scener för besvärjelser: `ModuleDef.spellScenes` och `showScenes` i `worldspells.ts`. Gråvad har en syn av Grukk.
- **Klart (steg 7, vädret):** `src/engine/weather.ts`. `GameState.weather` har himlen och vinden (`WeatherState`). `updateWeather` körs i `advanceTime` och i början av varje stridsrunda. `torchBurns` ersätter `!torchOut` där ljuset räknas, och `weatherRanged` ger avdragen på skott. `holdWeather` används av VINDKONTROLL och REGNKONTROLL. NEDKALLA ÅSKVIGG är BLIXT med `needsRain`. Testerna står i `tests/weather.test.ts`.
- **Klart (ljus):** facklor brinner en timme och oljelyktan sex timmar (`src/engine/light.ts`, `Actor.light`, `Character.lanternOil`). `burnLight` körs i `passTime` och i början av varje stridsrunda, och `ensureLight` när spelet laddas. `torchBurns` kräver ett ljus som brinner. I testerna tänder `lit` i `tests/helpers.ts` en fackla.
- **Klart (TELEPATI och TANKEÖVERFÖRING, Vidar):** rollspel i modulernas scener, och TANKEÖVERFÖRING kan få en fiende att slå moral. Hela VIGGFÅNGARE blir PSY.
- **Klart (ritualerna och FÖRÄNDRA):** `src/engine/rituals.ts`. En ritual tar lika många timmar som effektgraden (Vidar, `ritualHours` i `magic.ts`). LADDNING sparas i `Character.charges`, och `CastOptions.useCharge` drar PSY ur dem. FÖRYNGRA ändrar de kroppsliga grundegenskaperna efter ålderstabellen. FÖRÄNDRA byter vapnet i handen (effekten `förändrad`). Besvärjelser på figurer utanför gruppen räknas ned med `expireSpells` i `time.ts`.
- **Alla besvärjelser verkar nu**, utom att förvandla djur med FÖRÄNDRA. Där väntar SYN på magiska föremål och FINNA VATTEN på reglerna för mat och dryck. SPÅRLÖS verkar på världskartan.
- **Klart (Hamnbytare):** `src/engine/shapeshift.ts` (`shapeOf`, `shapeshift`, `shapeTime`), `Actor.shape` med den mänskliga kroppen, och knappen i panelerna. Djuren står i `HAMN`, och hök och svan har egna värden i `src/data/creatures.ts`. Testerna står i `tests/shapeshift.test.ts`.
- **Klart (magiska föremål):** `src/engine/magicitems.ts` (`senseMagic`, `empathy`, `seekMagic`, `seeMagic`, `useItem`, `syncItemEffects`, `itemCharges`). `castFromItem` i `magic.ts` lägger en besvärjelse ur ett föremål. `MAGIC_ITEMS` i `src/content/index.ts` registrerar föremålen i regeldatan. Packningen visar analysen och knapparna. Testerna står i `tests/magicitems.test.ts`.
- **Klart (Vidars sista beslut i sessionen):**
  - Magisk kanalisering (`src/engine/channel.ts`): ett lyckat slag ger magikern ett villigt mediums PSY, och Mottagligt medium ger +5.
  - Vänster hand ger motståndaren −2 på parering (`LEFT_HAND_PARRY`).
  - Absolut ögonmått och God tidskänsla är borttagna (`REMOVED_ABILITIES`).
  - Den nya besvärjelsen HAMNSKIFTARE (animism) ger Hamnbytares förvandling.
- **Kvar av förmågorna** är bara Gott balanssinne vid fall, som väntar på fallskador.

Vidar vill också göra en genomgång av hela regelsystemet när det är klart, för att se att det är konsekvent.

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
- **Ljudet** (`src/audio/`) lyssnar på motorns ljudsignaler (`Game.onCue`) och på `onChange` för musiken. Se Plan för grafik och ljud.
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

Det finns 326 tester. `tests/combat.test.ts` prövar stridens regler med styrda tärningar och spelar
30 hela strider i grottan. `tests/time.test.ts` prövar läkning, infektioner och EP. `tests/creation.test.ts` bygger bokens exempelrollperson Teval och
`tests/rules.test.ts` räknar om bokens exempel. `tests/step6.test.ts` prövar magin, avståndsstriden, bördan, handeln och gifterna, bland annat bokens giftexempel med Strahinya. `tests/step7.test.ts` prövar följeslagarna, smygarläget, Avväpna, Fasthållning, stridskonsterna och elementarerna, och spelar 20 hela strider med hela gruppen i grottan. `tests/step8.test.ts` prövar dödsregeln och äventyrsmodulerna. `tests/abilities.test.ts` prövar förmågornas regelvärden och `tests/talents.test.ts` förmågorna som används i spel. `tests/spells.test.ts` prövar fiendernas magi och besvärjelserna i strid. `tests/progress.test.ts` prövar lärarna, biblioteket, böckerna, arbetet, belöningarna, hjältepoängen, PSY-höjningen och igenkänningen. `tests/cues.test.ts` prövar motorns ljudsignaler, `tests/audio.test.ts` musikvalet och ljudtabellen och `tests/audioplayer.test.ts` uppspelningen och inställningarna. `tests/worldmap.test.ts` prövar världskartans tider, bördan, lägret, mörkersynen, det passiva smygandet, snabba fiender, jakten, Spåra och SPÅRLÖS, stridsmötena, mötesplatserna och slumpmötena.

För att provköra gränssnittet: starta `npx vite` och styr sidan med Playwright. Ett snabbt sätt är
att skapa ett spel med `Game.create(testCharacter())`, lägga `JSON.stringify(g.state)` i
`localStorage` under nyckeln `dod-save-v7` och klicka på "Fortsätt äventyret". Från sidan går det att
importera moduler direkt, till exempel `await import('/src/engine/game.ts')` och `await import('/tests/helpers.ts')`.

## Öppna frågor till Vidar

- Magisk kanalisering och HAMNSKIFTARE: tolkningarna i `docs/regelbeslut.md`.
- Magiska föremål: tolkningarna i `docs/regelbeslut.md` under Magiska föremål (S 10 för räckvidd, tiden för Känna magi och Magisk empati, vad VARSEBLIVNING och SYN ger), och Gråvads tre föremål.
- Hamnbytare: värdena för hök och svan, och storleken på björnen, katten och hjorten (`docs/regelbeslut.md` under Hamnbytare).
- Vädret (`docs/regelbeslut.md` under Vädret): chanserna, att det ändras klockan sex och arton, vindens avdrag på skott, VINDKONTROLL och VIGGFÅNGARE är tolkningar. Tolkningarna för ljuset (se Ljus).
- Tolkningarna för låsen och besvärjelserna utanför strid (`docs/regelbeslut.md` under Lås och besvärjelser utanför strid).
- Tolkningarna för besvärjelserna i strid och fiendens val av effektgrad (`docs/regelbeslut.md` under Fiendernas magi och Besvärjelser i strid).
- Världskartan: tolkningarna i `docs/regelbeslut.md` under Världskartan. Det gäller synhållet (4 rutor på dagen, 2 på natten), att fiender med förflyttning 15 eller mer räknas som snabba, lägrets klockslag (22–6), Spåra en gång per steg, att stråtrövare och svartalfer får 9 i Finna dolda ting, och de generiska slumptabellerna.
