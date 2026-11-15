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
| `src/engine/` | Regelmotorn: tärningar, färdighetsslag, strid, karta, siktlinje, sparning. Ingen grafik. |
| `src/content/` | Allt spelinnehåll som data: vapen, rustningar, yrken, varelser, personer, kartor. |
| `src/game/` | Kartvyn (Phaser 3) och grafiken, som ritas i kod. |
| `src/ui/` | Rollformulär, logg, stridspanel och samtalsruta. |
| `src/ai/`, `api/` | Dialog via språkmodell, med förskriven reservdialog. |
| `tests/` | Tester för regelmotorn och innehållet. |

Nytt innehåll läggs till i `src/content/index.ts`. Regelvärden (skadebonus, förflyttning
m.m.) ligger samlade i `src/engine/rules.ts`.

**Obs:** regelvärdena och innehållet är provisoriska och ska stämmas av mot regelboken.
Lägg inte in text eller bilder ur regelboken i repot – den är upphovsrättsskyddad.

## Det här finns

- Rollperson med grundegenskaper (3T6), tre yrken, KP, skadebonus och färdigheter
- Utforskning med klick för att gå, stigfinnande och dimma över outforskat
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
