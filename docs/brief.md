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
| 5 | Tid och utveckling: spelklocka, läkning per dag, infektioner, PSY-återhämtning, EP och träning mellan äventyr | **Nästa** |
| 6 | Magi, avståndsstrid, örter och gifter, bärförmåga och handel | Ej påbörjat |

**Magi (steg 6):** Vidar har husregler för magi. Ställ frågor till honom innan magireglerna
diskuteras eller byggs, och för in svaren i `docs/regelbeslut.md`.

## Steg 5: tid och utveckling

- **Spelklocka:** i dag räknas ett steg utanför strid som en stridsrunda (för blödning och effekter), och vilan på värdshuset som en natt. Det behövs en riktig klocka med timmar och dygn.
- **Läkning:** husregeln är 1 KP per dag i varje skadad kroppsdel och i totala KP, halv takt utan vila. `Game.passDays` gör en enkel variant; `Game.rest` läker fortfarande allt på en natt och bör ersättas.
- **Läkekonst** en gång per dag, **infektioner** efter strid (1 % per skadepoäng för eggvapen, 3 % för smutsiga och naturliga vapen, kallbrand) och **amputation** (FYS sjunker) finns inte än. Bestående skador från tabellen för kritiska skador sparas i `Actor.injuries`.
- **PSY-poäng** återfås med 1 per timmes vila (rutorna finns på rollformuläret men används inte förrän magin byggs).
- **Erfarenhet:** erfarenhetskryssen (`marks`, `improvementRoll`) är tillfälliga och ska ersättas av EP som växlas in mellan äventyr.
- **Fobier** sparas i `Character.phobias`; enligt husregeln mildras de med ett PSY-slag mellan äventyren.
- **Effekter som räknas i dagar** (vrickad fot, sträckt muskel) räknas i dag ned vid varje vila.

## Hur koden hänger ihop

- `src/engine/game.ts` är spelmotorn och fasaden mot gränssnittet. `makeActor` skapar figurer med KP per kroppsdel och BV på utrustningen.
- `src/engine/combat.ts` innehåller hela striden:
  - turordning med initiativ varje runda, rundans början med blödning, effekter, moral och skräck,
  - anfall och parering enligt resultattabellen, pareringsavdrag och sköldens fria parering,
  - träffområden, rustning per kroppsdel, sårverkan, kritiska skador och blödning,
  - fummeltabellerna, Skräcktabellen och moralslag,
  - varelsernas turer (`autoTurn`), även för rollpersonen när skräcken tar över.
- `src/engine/rules/fumble.ts`, `fear.ts` och `outcomes.ts` innehåller fummeltabellerna och Skräcktabellen som data med egna ord. Tabellen för kritiska skador och stridens konstanter ligger i `tables.ts`.
- `Actor` har `locKp`, `bleeding`, `effects`, `bv` och `injuries`. Effekterna (`ActiveEffect`) varar i rundor, dagar, ett antal slag eller tills något händer.
- `GameState.dropped` är föremål som tappats på marken. Sparformatet är version 3; äldre sparningar läses inte.
- **Rollformuläret** (`src/ui/sheet.ts`, öppnas med R) följer originalformulärets uppställning: framsida med grundegenskaper och färdigheter, baksida med kroppsfiguren och träffområdena, vapen, pengar och utrustning. Förlorade KP kryssas över. Kroppsfiguren (`src/ui/figure.ts`) används också i statuspanelen, färgad efter skadorna.
- `src/content/` innehåller äventyret Gråvad. Varelserna har nu `humanoid`, `darkvision`, `leader`, `noMorale` och `fear`.
- **Spelarfigurer:** bara `krigare`, `jagare` och `tjuv` finns. `PROFESSION_SPRITES` ger alla elva yrken en av dem tills det finns egna.
- **Avståndsvapen** kan köpas men inte användas ännu.

## Saknas i striden

Det här från Bok II och III är inte byggt än:

- Anfall bakifrån mot en omedveten försvarare (Smyga mot Upptäcka fara), och att söka skydd.
- Sparkar och stridskonsternas tekniker (Hoppspark och Rundspark ger −2 på initiativet när de används).
- Fasthållning, piskans avväpning, spjut mot en anstormande varelse och strid från hästryggen.
- Att välja tvåhandsgrepp eller avstå från att parera.

## Kontroll

```bash
npm test
```

```bash
npx tsc --noEmit
```

Det finns 67 tester. `tests/combat.test.ts` prövar stridens regler med styrda tärningar och spelar
30 hela strider i grottan. `tests/creation.test.ts` bygger bokens exempelrollperson Teval och
`tests/rules.test.ts` räknar om bokens exempel.

För att provköra gränssnittet: starta `npx vite` och styr sidan med Playwright. Ett snabbt sätt är
att skapa ett spel med `Game.create(testCharacter())`, lägga `JSON.stringify(g.state)` i
`localStorage` under nyckeln `dod-save-v3` och klicka på "Fortsätt äventyret".

## Öppna frågor till Vidar

- Lyckat anfall mot lyckad parering: Bok II säger att pareringen stoppar skadan, Bok III att skadan går igenom minus 1. Vi följer Bok II tills vidare (se regelbeslut).
- Fummel 19 (sväljer tungan) dödar en ensam rollperson efter 15 rundor. Ska det mildras så länge det inte finns följeslagare?
- Besegrade fiender dör efter striden. Ska rollpersonen kunna ta fångar eller förhöra dem?
- Ska spelaren få fler figurer, en per yrke eller ras?
- Rustningens vikt och bärförmågan finns som regler men räknas inte i spelet ännu (steg 6).
