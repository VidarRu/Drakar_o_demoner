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
| 7 | Följeslagare och elementarer, och fler handlingar i strid | **Förslag på nästa**, se nedan |

## Förslag till steg 7: följeslagare och elementarer

Mycket i reglerna väntar på att rollpersonen kan ha sällskap. Fråga Vidar om upplägget först.

- **Följeslagare:** `combat.party` finns. Fummel mot "närmsta vän" ska träffa dem, Dra vapen slås för alla, en kamrat ska kunna hjälpa den som sväljer tungan, och projektiler i skottlinjen kan träffa dem.
- **Elementarer:** FRAMMANA ELEMENTAR (Bok III s. 21–22) ger en tillfällig följeslagare som magikern måste styra med full uppmärksamhet.
- **Fler handlingar:** hjälpa en kamrat, använda magiska föremål, Avväpna och stridskonster (diskutera med Vidar), anfall bakifrån mot en omedveten försvarare, fasthållning, piskans avväpning, spjut mot anstormande varelser och strid från hästryggen.
- **Varelser som söker skydd** och varelser som lägger besvärjelser.
- **Lärare och bibliotek:** träning med lärare och studier i ett magibibliotek, så att magiskolor kan höjas. Besvärjelser att hitta i äventyret (`learnSpell` finns).

## Steg 6 i korthet

- **Magi** (`src/engine/magic.ts`, regler i `rules/magic.ts`): `castSpell` lägger en besvärjelse med E, extra E för räckvidd och varaktighet och ett mål. Kvicka verkar direkt, andra via `combat.pending` i början av nästa runda (`resolvePending`), och en träff bryter koncentrationen. `memorize`, `forget` och `learnSpell` sköter minnet och formelsamlingen (`Character.spells` och `Character.memorized`). Besvärjelsernas verkan står som `effect` och `aim` i `src/data/spells.ts`; 21 besvärjelser verkar i spelet.
- **Avståndsstrid** (`combat.ts`, sist i filen): `rangedInfo`, `shootProblem`, `shoot`, `reloadStep` och `takeCover`. Rollpersonen skjuter genom att klicka på en fiende med ett avståndsvapen i handen. Varelser får ett avståndsvapen med `CreatureDef.ranged`; svartalfsskytten i grottan är den första.
- **Bärförmåga och packning** (`src/engine/inventory.ts`): `carriedWeight`, `loadMod`, `equip`, `stow`, `wearArmor` och `ironProblem`. Bördan dras från förflyttning, initiativ och SMI-färdigheter i strid och i `skillMod`, som nu används för alla färdighetsslag utanför anfall och parering.
- **Handel** (`src/engine/trade.ts`): `wares`, `buy`, `sell`, `haggle`. Handlarna anges med `NpcDef.shop`, och samtalsvalet "Handla" öppnar boden.
- **Örter och gifter** (`src/data/herbs.ts`, `src/engine/poison.ts`, regler i `rules/poison.ts`): `useHerb`, `searchHerb`, `poisonActor`, `updatePoisons`, `advancePoisons` och `neutralize`. Gifter på vapnet ligger i `Actor.weaponPoison`, gifter i kroppen i `Actor.poisons`.
- **Gränssnittet** (`src/ui/panels.ts`): fönstren Packning (P), Magi (M) och handlarens bod. Stridspanelen har knappar för Packning, Magi, Ladda om och Sök skydd, och statuspanelen visar avståndsvapen, börda och gifter.
- **Effekter** som ska överleva striden har `persist`. Örter som läker efter en stund använder effekten `läkning`, som läker när den tar slut (`combat.onExpire`).
- Sparformatet är version 5 (`dod-save-v5`); äldre sparningar läses inte.

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
- `GameState.dropped` är föremål som tappats på marken och `GameState.time` är speltiden i sekunder. Sparformatet är version 5; äldre sparningar läses inte.
- **Rollformuläret** (`src/ui/sheet.ts`, öppnas med R) följer originalformulärets uppställning: framsida med grundegenskaper och färdigheter, baksida med kroppsfiguren och träffområdena, vapen, pengar och utrustning. Förlorade KP kryssas över. Kroppsfiguren (`src/ui/figure.ts`) används också i statuspanelen, färgad efter skadorna.
- `src/content/` innehåller äventyret Gråvad. Varelserna har `humanoid`, `darkvision`, `leader`, `noMorale`, `fear` och `ranged`, personerna `shop`, och kartan `habitats` (växtplatser för örter).
- **Spelarfigurer:** bara `krigare`, `jagare` och `tjuv` finns. `PROFESSION_SPRITES` ger alla elva yrken en av dem tills det finns egna.

## Saknas i striden

- **Följeslagare:** reglerna är förberedda för fler rollpersoner (`combat.party`). Med följeslagare ska fummel mot "närmsta vän" träffa dem, Dra vapen slås för alla, och en kamrat ska kunna hjälpa den som sväljer tungan.
- **Fler handlingar** på turen och gratisturen: hjälpa en kamrat och använda magiska föremål. Att byta vapen, använda örter, lägga besvärjelser, skjuta, ladda om och söka skydd finns.
- **Stridskonster och Avväpna:** diskutera med Vidar innan de byggs.
- Anfall bakifrån mot en omedveten försvarare (Smyga mot Upptäcka fara), fasthållning, piskans avväpning, spjut mot en anstormande varelse och strid från hästryggen.

## Kontroll

```bash
npm test
```

```bash
npx tsc --noEmit
```

Det finns 105 tester. `tests/combat.test.ts` prövar stridens regler med styrda tärningar och spelar
30 hela strider i grottan. `tests/time.test.ts` prövar läkning, infektioner och EP. `tests/creation.test.ts` bygger bokens exempelrollperson Teval och
`tests/rules.test.ts` räknar om bokens exempel. `tests/step6.test.ts` prövar magin, avståndsstriden, bördan, handeln och gifterna, bland annat bokens giftexempel med Strahinya.

För att provköra gränssnittet: starta `npx vite` och styr sidan med Playwright. Ett snabbt sätt är
att skapa ett spel med `Game.create(testCharacter())`, lägga `JSON.stringify(g.state)` i
`localStorage` under nyckeln `dod-save-v5` och klicka på "Fortsätt äventyret". Från sidan går det att
importera moduler direkt, till exempel `await import('/src/engine/game.ts')` och `await import('/tests/helpers.ts')`.

## Öppna frågor till Vidar

- Fler sätt att få erfarenhet: Vidar vill gå igenom det i ett senare steg.
- Ska spelaren få fler figurer, en per yrke eller ras?
- Tolkningarna i steg 6 som Vidar inte uttryckligen har godkänt: säljpriset (halva listpriset), högsta rabatt 50 %, att hälften av pilarna hittas igen, vilka vapen som inte är av järn, och hur ELD, BLIXT och EXPLOSION träffar (se `docs/regelbeslut.md`).
- Steg 7: följeslagare och elementarer, eller något annat först?
