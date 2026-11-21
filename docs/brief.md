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
Vidar ladda upp dem igen om en uppgift kräver texten, till exempel örter och gifter,
besvärjelsernas detaljer eller reglerna för infektioner och läkning.

## Byggordning

| Steg | Innehåll | Läge |
| --- | --- | --- |
| 1 | Regelkärnan: färdighetsslag med omslag, differensvärde, motståndsslag och alla tabeller | Klart (`src/engine/rules/`) |
| 2 | Regeldata: raser, yrken, färdigheter, vapen, rustningar, sköldar, varelser, besvärjelser, utrustning | Klart (`src/data/`) |
| 3 | Skapa rollperson med bakgrundspoäng, plus guiden i gränssnittet | Klart (`src/engine/creation.ts`, `src/ui/creation.ts`) |
| 4 | Detaljerad strid enligt husreglerna, och rollformuläret i originalets stil | Klart (`src/engine/combat.ts`, `src/ui/sheet.ts`) |
| 5 | Tid och utveckling: spelklocka, läkning, Läkekonst, infektioner, amputation, PSY-poäng, EP och träning | Klart (`src/engine/time.ts`, `src/ui/training.ts`) |
| 6 | Magi, avståndsstrid, örter och gifter, bärförmåga och handel | **Nästa** |

## Steg 6: magi, avståndsstrid, örter och gifter, bärförmåga och handel

- **Magi: fråga Vidar först.** Husreglerna som redan är kända står under Magi i `docs/regelbeslut.md`: S = FV i skolan − skolvärdet + baschansen för INT, och besvärjelser lärs utan EP när man hittar dem. Fråga om effektgrader, PSY-kostnad, snedtändning, startbesvärjelser och hur skapandet av magiker ska ändras (i dag köper guiden S med EP enligt grundreglerna).
- **Avståndsstrid:** avståndsavdrag, rörliga mål, söka skydd, laddningstider, kastvapen som kan pareras med sköld, miss som träffar annat mål, och fummeltabellen för avståndsvapen (finns redan som data).
- **Örter och gifter** (Bok II), **bärförmåga** (`encumbrance` och rustningsvikter finns i reglerna men räknas inte) och **handel** med priserna ur Bok III.

## Steg 5 i korthet

- `src/engine/time.ts`: `advanceTime` driver klockan, läkning (1 KP per dag, halvt utan vila), PSY-poäng, effekter i dagar och att sömn låser upp EP. `rollInfections` körs efter striden, `amputate` vid kallbrand och krossade ben, `medicine` är Läkekonst en gång per dag.
- EP samlas per färdighet i `Actor.ep` (`gainExperience` vid lyckade slag, även anfall, parering, Två vapen och Dra vapen). De växlas in i träningsvyn efter en veckas vila (`vila_vecka` på värdshuset). Bonus-EP från uppdraget ligger i `Character.bonusEp`.
- I gränssnittet finns klockan och PSY i statuspanelen, knapparna "Sov 8 timmar" och "Läkekonst", och gumman Asta vårdar med Läkekonst.
- Saknas: träning med lärare, PSY-höjning efter kamper PSY mot PSY (hör till magin), hjältepoäng, och att den som har feber egentligen inte ska kunna göra något aktivt (se frågan i regelbeslut).

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
- `GameState.dropped` är föremål som tappats på marken och `GameState.time` är speltiden i sekunder. Sparformatet är version 4; äldre sparningar läses inte.
- **Rollformuläret** (`src/ui/sheet.ts`, öppnas med R) följer originalformulärets uppställning: framsida med grundegenskaper och färdigheter, baksida med kroppsfiguren och träffområdena, vapen, pengar och utrustning. Förlorade KP kryssas över. Kroppsfiguren (`src/ui/figure.ts`) används också i statuspanelen, färgad efter skadorna.
- `src/content/` innehåller äventyret Gråvad. Varelserna har nu `humanoid`, `darkvision`, `leader`, `noMorale` och `fear`.
- **Spelarfigurer:** bara `krigare`, `jagare` och `tjuv` finns. `PROFESSION_SPRITES` ger alla elva yrken en av dem tills det finns egna.
- **Avståndsvapen** kan köpas men inte användas ännu.

## Saknas i striden

- **Följeslagare:** reglerna är förberedda för fler rollpersoner (`combat.party`). Med följeslagare ska fummel mot "närmsta vän" träffa dem, Dra vapen slås för alla, och en kamrat ska kunna hjälpa den som sväljer tungan.
- **Fler handlingar** på turen och gratisturen: hjälpa en kamrat, använda magiska föremål, dricka läkedrycker.
- **Stridskonster och Avväpna:** diskutera med Vidar innan de byggs.
- Anfall bakifrån mot en omedveten försvarare (Smyga mot Upptäcka fara), fasthållning, piskans avväpning, spjut mot en anstormande varelse och strid från hästryggen.

## Kontroll

```bash
npm test
```

```bash
npx tsc --noEmit
```

Det finns 81 tester. `tests/combat.test.ts` prövar stridens regler med styrda tärningar och spelar
30 hela strider i grottan. `tests/time.test.ts` prövar läkning, infektioner och EP. `tests/creation.test.ts` bygger bokens exempelrollperson Teval och
`tests/rules.test.ts` räknar om bokens exempel.

För att provköra gränssnittet: starta `npx vite` och styr sidan med Playwright. Ett snabbt sätt är
att skapa ett spel med `Game.create(testCharacter())`, lägga `JSON.stringify(g.state)` i
`localStorage` under nyckeln `dod-save-v4` och klicka på "Fortsätt äventyret".

## Öppna frågor till Vidar

- Feber vid infektion: boken säger att man inte kan göra något aktivt i 1T4 veckor. Nu ger den −5 på allt. Hur vill du ha det?
- Magins husregler som saknas (se steg 6).
- Ska spelaren få fler figurer, en per yrke eller ras?
