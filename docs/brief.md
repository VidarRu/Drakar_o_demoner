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
| 8 | Ej bestämt | **Fråga Vidar**, se förslag nedan |

## Förslag till steg 8

Fråga Vidar vad som ska komma härnäst. Kandidater som har kommit upp:

- **Äventyrsmoduler:** att flytta gruppen mellan äventyr (gruppen och rollformulären finns redan i sparfilen), och att gå igenom vilka personer som kan värvas i varje modul.
- **Fler sätt att få erfarenhet** (Vidar ville gå igenom det).
- **Lärare och bibliotek:** träning med lärare och studier i ett magibibliotek, så att magiskolor kan höjas. Besvärjelser att hitta i äventyret (`learnSpell` finns).
- **Varelser som söker skydd och lägger besvärjelser**, och fiender som själva frammanar elementarer.
- **Fler handlingar:** använda magiska föremål, piskans avväpning, spjut mot anstormande varelser och strid från hästryggen.
- **Egna figurer för fler yrken och raser** (bara krigare, jägare och tjuv finns för rollpersonen).

## Steg 7 i korthet

- **Gruppen** (`src/engine/party.ts`): `GameState.party` är rollpersonen och upp till fem följeslagare, `GameState.companions` deras rollformulär per aktörs-id. `Game.leader` är rollpersonen, `Game.player` den som styrs (i strid den vars tur det är, annars den som valts med `setFocus`) och `Game.char` dess rollformulär. `charOf(a)` ger rollformuläret för vem som helst i gruppen. Allt som tidigare gällde rollpersonen (packning, magi, örter, träning, läkning, tid) gäller nu den som styrs eller var och en i gruppen.
- **Följeslagare** definieras i `src/content` som `RECRUITS` (skapade med `newDraft` och `finalize`, alltså samma regler som rollpersonen) och placeras på kartan med `recruit` i `spawns`. Samtalsvalet `folj_med` värvar, `Game.dismiss` låter dem gå. `payWages`, `shareLoot`, `leaveParty`, `fallenCompanion` och `aidAfterCombat` sköter lön, byte, avsked, död och förband efter striden. Gråvad har Hjalmar, Sigrid och Linnea.
- **Elementarer** (`src/engine/elementals.ts`): `ELEMENTALS` beskriver de åtta sorterna, `summonOrBanish` frammanar eller skickar bort, `elementalRound` räknar ned och verkar varje runda, `elementalTakes` avgör hur vapen biter, `actions` och `act` är de särskilda handlingarna. En elementar är en figur med `kind: 'player'` och `Actor.elemental`; magikern har effekten `styr`.
- **Fler handlingar** (`src/engine/maneuvers.ts`): `helpOptions` och `help` (hjälpa en kamrat), `attackModes`, `maneuverProblem` och `maneuver` (Avväpna, Fasthållning och stridskonsternas anfall), `keepHold`, `breakHold` och `release` (fasthållning och låsning), `roll5` (Rulla). `CombatState.attackMode` och `feint` väljs i stridspanelen.
- **Smygarläge** (`src/engine/stealth.ts`): `toggleSneak` och `sneakRound`. `Actor.sneaking` och `hidden`. Anfall från smygarläge (`ambush` i `combat.ts`) följer Bok II. `sneakMod` har modifikationerna. Facklor: `Actor.torchOut`, `torchLit`, och luminalens och umbrans glober i `lightMod`.
- **Stridskonster** i `combat.ts`: `martialOk`, obeväpnad parering och avväpning i `tryParry`, Stålsättning (`steel`), Vidvinkelsyn i `flankMod`, Blind strid och Liggande strid.
- **Gränssnittet:** gruppanelen ovanför stridspanelen (klicka för att välja vem som visas), elementarens status och handlingar, val av anfallssätt, Fint, Smyg, facklan, hjälp åt kamrater, Släpp taget och Rulla. Träningsvyn har en flik per gruppmedlem. Kameran följer den som har turen. Nya figurer: knekt, jagarinna, linnea och åtta elementarer (`src/game/art/sprites.ts`).
- Sparformatet är version 6 (`dod-save-v6`); äldre sparningar läses inte.

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
- Saknas: träning med lärare, PSY-höjning efter kamper PSY mot PSY (hör till magin), hjältepoäng, och fler sätt att få erfarenhet (Vidar vill gå igenom det senare). Feber ger −5 på allt (godkänd husregel).

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
- **Spelarfigurer:** bara `krigare`, `jagare` och `tjuv` finns. `PROFESSION_SPRITES` ger alla elva yrken en av dem tills det finns egna.

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

Det finns 133 tester. `tests/combat.test.ts` prövar stridens regler med styrda tärningar och spelar
30 hela strider i grottan. `tests/time.test.ts` prövar läkning, infektioner och EP. `tests/creation.test.ts` bygger bokens exempelrollperson Teval och
`tests/rules.test.ts` räknar om bokens exempel. `tests/step6.test.ts` prövar magin, avståndsstriden, bördan, handeln och gifterna, bland annat bokens giftexempel med Strahinya. `tests/step7.test.ts` prövar följeslagarna, smygarläget, Avväpna, Fasthållning, stridskonsterna och elementarerna, och spelar 20 hela strider med hela gruppen i grottan.

För att provköra gränssnittet: starta `npx vite` och styr sidan med Playwright. Ett snabbt sätt är
att skapa ett spel med `Game.create(testCharacter())`, lägga `JSON.stringify(g.state)` i
`localStorage` under nyckeln `dod-save-v6` och klicka på "Fortsätt äventyret". Från sidan går det att
importera moduler direkt, till exempel `await import('/src/engine/game.ts')` och `await import('/tests/helpers.ts')`.

## Öppna frågor till Vidar

- Fler sätt att få erfarenhet: Vidar vill gå igenom det i ett senare steg.
- Ska spelaren få fler figurer, en per yrke eller ras?
- Tolkningarna i steg 6 som Vidar inte uttryckligen har godkänt: säljpriset (halva listpriset), högsta rabatt 50 %, att hälften av pilarna hittas igen, vilka vapen som inte är av järn, och hur ELD, BLIXT och EXPLOSION träffar (se `docs/regelbeslut.md`).
- Tolkningarna i steg 7 som är markerade som tolkning i `docs/regelbeslut.md`, särskilt: att rollpersonens död avslutar äventyret även om följeslagare lever, att elementarer bara frammanas i strid, att magikern inte kan parera medan hen styr en elementar, CL 8 + E för salamandern och undinen, och att anfall från smygarläge hindrar parering från alla håll.
- Steg 8: vad ska komma härnäst?
