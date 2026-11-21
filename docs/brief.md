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
som Markdown-filer. De finns **inte** i repot. Be Vidar ladda upp dem igen om en uppgift kräver
texten. Det gäller till exempel fummeltabellerna, Skräcktabellen, tabellen för kritiska skador,
örter och gifter, och besvärjelsernas detaljer.

## Byggordning

| Steg | Innehåll | Läge |
| --- | --- | --- |
| 1 | Regelkärnan: färdighetsslag med omslag, differensvärde, motståndsslag och alla tabeller | Klart (`src/engine/rules/`) |
| 2 | Regeldata: raser, yrken, färdigheter, vapen, rustningar, sköldar, varelser, besvärjelser, utrustning | Klart (`src/data/`) |
| 3 | Skapa rollperson med bakgrundspoäng, plus guiden i gränssnittet | Klart (`src/engine/creation.ts`, `src/ui/creation.ts`) |
| 4 | Detaljerad strid enligt husreglerna | **Nästa** |
| 5 | Tid och utveckling: spelklocka, läkning per dag, PSY-återhämtning, EP och träning mellan äventyr | Ej påbörjat |
| 6 | Magi, avståndsstrid, örter och gifter, bärförmåga och handel | Ej påbörjat |

## Steg 4: detaljerad strid

Husreglerna står under "Strid" i `docs/regelbeslut.md`. Kortfattat:

- **Start:** striden börjar av sig själv inom ett visst avstånd från fiender som ser rollpersonen, eller med en knapp.
- **Turordning:** alla som deltar, även neutrala, slår initiativ 1T10 + SMI (plus modifikationer) varje runda.
  - Krigare får +5, Blixtrande reflexer +3 och tekniken Initiativbonus +5 på SMI.
  - Hoppspark och rundspark ger −2. Snabbslående slår alltid först.
- **Turen:** man flyttar högst sin förflyttning och gör sedan en attack.
- **Två vapen:** ett lyckat slag i Två vapen ger anfall med båda vapnen, annars bara med svärdshanden.
- **Parering:**
  - Varje attack kan pareras, men efter den första pareringen i rundan blir avdraget −5, −10 och så vidare.
  - En sköld ger en extra parering utan avdrag.
  - Med både vapen och sköld används det som ger högst CL.
- **Anfall mot parering** avgörs enligt bokens resultattabell (Bok II s. 17). Både vapen och sköldar slits på BV.
  - Därtill är det 2 % chans per användning att vapnet tappar 1 BV.
  - Rustningsdelar har BV = 2 × abs och förlorar 1 BV varje gång skadan överstiger abs. Vid BV 0 är delen sönder.
  - Reparation hos smed kostar 5 % av priset per BV-poäng.
- **Träffområden:** KP per kroppsdel (`locationKp`) och träfftabellen (`HIT_TABLE`).
  - Skadeeffekter: −2 på CL per förlorad KP i kroppsdelen, och halv förflyttning vid halva KP i ett ben.
  - Blödning ger −1 KP var sjätte runda tills någon lägger förband.
  - Vid 2 KP halveras CL och vid 1 KP kan man inte använda färdigheter.
  - Vid 0 KP blir man medvetslös, och vid −FYS dör man.
  - Kritiska skador uppstår vid dubbla kroppsdelens KP.
- **Perfekt anfall:** maximal skada och maximal SB, rustningen hjälper inte, och anfallet går inte att parera. Det finns redan i `game.ts`.
- **Fummel:** slå på rätt fummeltabell (Bok III s. 39–41). Om resultatet träffar "närmsta vän" tar det en följeslagare, och finns ingen slås det om. Tabellerna behöver skrivas in som data med egna ord.
- **Moral** gäller bara SLP och fiender: 1T20 mot PSY + modifikationer.
- **Skräck:** varelser med Skräckslå (`fear` i datan) och Skräcktabellen (Bok III s. 9–10).
- **Vanlig strid** utan träffområden och parering gäller djur och monster.
- **Läge, ljus och vapen:** anfall från sidan +3, bakifrån +7, mörker −15 och fackelsken −5 (mörkersyn i datan). Vapnens längd och STY-krav (`grip`) ska också räknas in.

## Hur koden hänger ihop

- `src/engine/game.ts` är spelmotorn. Strid och utforskning är fortfarande den gamla enkla varianten, men använder nu regeldatan:
  - vapengrupper och halva FV inom samma familj (`skillFv`),
  - rustningsdelar per kroppsdel (`armorAt`),
  - perfekt anfall som ger maximal skada.
- `GameState.character` innehåller hela rollformuläret. `Actor` är figuren på kartan.
- `src/content/` innehåller äventyret Gråvad. Varelserna följer Bok II och KP räknas med formeln.
- **Spelarfigurer:** bara `krigare`, `jagare` och `tjuv` finns. `PROFESSION_SPRITES` ger alla elva yrken en av dem tills det finns egna.
- **Utveckling:** erfarenhetskryssen (`marks`, `improvementRoll`) är tillfälliga och ersätts av EP i steg 5.
- **Avståndsvapen** kan köpas men inte användas ännu.

## Kontroll

```bash
npm test
```

```bash
npx tsc --noEmit
```

Det finns 50 tester. Bland dem bygger `tests/creation.test.ts` bokens exempelrollperson Teval
och jämför med hans rollformulär, och `tests/rules.test.ts` räknar om bokens exempel.

För att provköra gränssnittet: starta `npx vite` och styr sidan med Playwright. Det var så
guiden för att skapa rollpersoner testades.

## Öppna frågor till Vidar

- Ska spelaren få fler figurer, en per yrke eller ras?
- Rustningens vikt och bärförmågan finns som regler men räknas inte i spelet ännu (steg 6).
