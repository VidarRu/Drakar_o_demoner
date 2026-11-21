# Drakar och Demoner – soloäventyr

Turbaserat rollspel i webbläsaren (TypeScript, Vite, Phaser) som följer reglerna i
Drakar och Demoner, tredje upplagan från 1991. All text i spelet och koden är på svenska.

Läs först:
- `docs/brief.md`: läget i arbetet och nästa steg.
- `docs/regelbeslut.md`: tolkningar och husregler som Vidar har godkänt. Följ dem och lägg till nya beslut där.

Regler för arbetet:
- Lägg aldrig in text ur regelböckerna i repot. De är upphovsrättsskyddade. Bara regelvärden och egna korta beskrivningar.
- Regelvärden hör hemma i `src/engine/rules/` (kärnan och tabellerna) och `src/data/` (regeldata). Äventyret ligger i `src/content/`.
- Kör `npm test` och `npx tsc --noEmit` innan du committar.
