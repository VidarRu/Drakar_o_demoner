# Drakar och Demoner – soloäventyr

Ett turbaserat rollspel för en spelare i webbläsaren, i klassisk svensk rollspelsanda.
Spelmotorn sköter regler, strid och karta. En språkmodell (via OpenRouter) kan spela
personerna du möter, men den avgör aldrig några utfall – det gör motorn.

## Kom igång

```bash
npm install
```

```bash
npm run dev
```

Övriga kommandon: `npm test` (regelmotorns tester) och `npm run build` (produktionsbygge).

Utan AI-nyckel används förskriven dialog, så spelet går att spela helt gratis och lokalt.

## Publicering på Vercel

1. Importera GitHub-repot som nytt projekt i Vercel (Vite känns igen automatiskt).
2. Lägg till miljövariabler under *Settings → Environment Variables*:
   - `OPENROUTER_API_KEY` – din nyckel från OpenRouter (krävs för AI-dialog)
   - `OPENROUTER_MODEL` – valfri modell, t.ex. `anthropic/claude-haiku-4.5`
   - `GAME_ACCESS_CODE` – valfri kod som måste anges under "AI-inställningar" på
     startskärmen, så att ingen annan kan förbruka dina krediter
3. Publicera. Serverfunktionen `api/dialog.ts` håller nyckeln hemlig på servern.

## Så är koden upplagd

| Mapp | Innehåll |
| --- | --- |
| `src/engine/` | Spelmotorn: strid, karta, siktlinje, sparning. Ingen grafik. |
| `src/engine/rules/` | Regelkärnan enligt Drakar och Demoner (1991): färdighetsslag, motståndsslag och alla tabeller. |
| `src/data/` | Regeldata: raser, yrken, färdigheter, vapen, rustningar, sköldar, varelser, besvärjelser, utrustning. |
| `src/content/` | Äventyrsinnehåll: kartor, personer, uppdrag och de varelser och vapen som äventyret använder. |
| `docs/regelbeslut.md` | Tolkningar, val mellan motsägelser i böckerna och husregler. |
| `docs/brief.md` | Läget i arbetet och nästa steg, för den som tar vid. |
| `src/game/` | Kartvyn (Phaser 3). Grafiken ritas i kod i `src/game/art/`: marken som en bild per karta, väggar, berg och träd radvis snett uppifrån. |
| `src/ui/` | Rollformulär, logg, stridspanel och samtalsruta. |
| `src/ai/`, `api/` | Dialog via språkmodell, med förskriven reservdialog. |
| `tests/` | Tester för regelmotorn och innehållet. |

Nytt äventyrsinnehåll läggs till i `src/content/index.ts`. Regelvärden ligger i
`src/engine/rules/` och `src/data/`, och alla tolkningar och husregler står i
`docs/regelbeslut.md`.

**Obs:** lägg inte in text eller bilder ur regelböckerna i repot – de är upphovsrättsskyddade.
Datan innehåller bara regelvärden och egna korta beskrivningar.

## Det här finns

- Rollperson skapad med bakgrundspoäng enligt Bok I: sju raser, elva yrken, särskilda förmågor,
  socialt stånd, startkapital, ålder, yrkesfärdigheter, startfärdigheter, besvärjelser och utrustning
- Utforskning med klick för att gå, stigfinnande, dimma över outforskat och en minikarta
- Grottor är mörka utanför skenet från rollpersonens fackla
- Turbaserad strid på rutnät: turordning efter SMI, förflyttning, anfall, parering,
  sköld, rustning, perfekta slag och fummel
- Erfarenhetskryss och förbättringsslag vid vila
- Samtal med svarsval, fri text (med AI) och spelmekaniska handlingar
- Ett litet äventyr: byn Gråvad, skogen och svartalfernas grotta
- Automatisk sparning i webbläsaren

## Tänkbara nästa steg

- Avståndsvapen och magi
- Föremål, ryggsäck och handel
- Flera kartor och övergångar mellan dem
- Fler yrken, färdigheter och varelser enligt regelboken
- Följeslagare
