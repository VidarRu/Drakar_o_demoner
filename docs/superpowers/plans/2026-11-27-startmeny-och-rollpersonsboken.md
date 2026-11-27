# Startmenyn och rollpersonsboken: implementationsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En huvudmeny på bokomslaget, undermenyer på grindbilden, karuseller för folk och yrke och ett uppslag där rollformuläret fylls i kapitel för kapitel.

**Architecture:** Allt byggs i HTML och CSS ovanpå Phaser, som startskärmen och guiden redan är. Regellogiken i `src/engine/creation.ts` ändras inte. Den får bara en förhandsvisning av ett halvfärdigt utkast, så att rollformuläret (`src/ui/sheet.ts`) kan ritas från både spelet och utkastet.

**Tech Stack:** TypeScript, Vite, Vitest (node-miljö utan DOM: bara rena funktioner testas), Phaser, `@fontsource` för typsnitten, Python med Pillow för bildomräkningen.

**Spec:** `docs/superpowers/specs/2026-11-27-startmeny-och-rollpersonsboken-design.md`

## Global Constraints

- All text i spelet och koden är på svenska. Ingen text ur regelböckerna, bara egna korta beskrivningar (`CLAUDE.md`).
- Regelvärden ändras inte. Tärningsslagen är `rollAbility`, `rollSwordHand`, `rollSocial` och `rollCapital` som i dag.
- Spelet hämtar inget från andra webbplatser: typsnitten kommer från `@fontsource` i `node_modules`.
- Sidvändningen tar under en sekund och skrivandet under en halv. Ett klick under en animation hoppar till slutet, och med `prefers-reduced-motion` blir allt direkt.
- Skärmarna fungerar ned till 1024 × 640. Smalare än så läggs uppslagets sidor under varandra.
- Sparnyckeln är fortfarande `dod-save-v7`, och sparformatet ändras inte.
- Färgerna följer rollformuläret: rött `#d8341f`, mörkrött `#9e1f10`, papper `#fbf9f5`, bläck `#141010` och blyerts `#2b2e45`.
- Kör `npm test` och `npx tsc --noEmit` före varje commit.

## Review Focus

1. **En färdig rollperson eller "Börja äventyret" när en sparning redan finns:** spelet frågar först, och "Avbryt" lämnar sparningen orörd. Test i Task 8.
2. **Byta folk eller yrke efter att siffrorna är ifyllda:** utkastet nollställs som i dag (`setRace` och `setProfession`), och rollformuläret visar de nya värdena utan fel. Test i Task 2 (`previewCharacter` på ett utkast med byte) och kontroll i Task 8.
3. **En bild som saknas eller inte laddar:** kortet visar ersättningen med begynnelsebokstaven, och karusellen fortsätter att fungera. Kontroll i Task 6.
4. **Dubbelklick eller klick under sidvändningen:** man hamnar ett kapitel fram, inte två, och animationen hoppar till slutet. Test i Task 7 (`Turn`).
5. **Ett halvfärdigt utkast i rollformuläret** (inga slag, ingen utrustning, magiker utan skola): rutorna är tomma, och inget kastar fel. Test i Task 2.

---

## Filkarta

| Fil | Ansvar |
| --- | --- |
| `tools/book_art.py` (ny) | Räknar om bokens bilder till WebP, 700 punkter höga |
| `public/art/bok/**` | Bilderna, `<id>.webp` |
| `src/data/types.ts`, `src/data/races.ts` | `RaceDef.desc`: egen kort beskrivning |
| `src/engine/creation.ts` | `previewCharacter`: ett utkast som rollperson, utan fel |
| `src/engine/combat.ts`, `src/engine/game.ts` | `skillFvOf`: FV med vapengrupper, som en ren funktion |
| `src/engine/save.ts` | `saveSummary`: det som listan över sparningar visar |
| `src/content/forgenererade.ts` (ny) | De tre färdiga rollpersonerna |
| `src/ui/sheet.ts` | Rollformuläret från en `SheetSource` (spelet eller utkastet) |
| `src/ui/ink.ts` (ny) | Vilka handskrivna värden som ändrades (blyertsanimationen) |
| `src/ui/chapters.ts` (ny) | Kapitlen och deras fel (ingen DOM) |
| `src/ui/carousel.ts` (ny) | Karusellen och `bookArt` |
| `src/ui/book.ts` (ny) | Uppslaget: kapitelremsan, sidvändningen och rollformuläret med vändning |
| `src/ui/creation.ts` | Guiden som kapitel i uppslaget |
| `src/ui/menu.ts` (ny) | Huvudmenyn och undermenyerna |
| `src/ui/book.css` (ny) | Stilen för menyn, karusellen och uppslaget |
| `src/audio/index.ts` | `audioSliders()` för både ♪-panelen och Inställningar |
| `index.html`, `src/main.ts` | Den nya startskärmen och hur spelet startas |
| `public/art/CREDITS.md`, `docs/brief.md` | Bildernas ursprung och läget i arbetet |

---

### Task 1: Bilderna i WebP och folkens beskrivningar

**Files:**
- Create: `tools/book_art.py`
- Modify: `public/art/bok/raser/*`, `public/art/bok/yrken/*` (PNG blir WebP)
- Modify: `src/data/types.ts` (`RaceDef`), `src/data/races.ts`
- Test: `tests/data.test.ts`

**Interfaces:**
- Produces: `RaceDef.desc: string`. Filerna `public/art/bok/raser/<ras-id>.webp` och `public/art/bok/yrken/<yrkes-id>.webp`.

- [ ] **Step 1: Skriv testet** i `describe('raser')`: `it('har en egen kort beskrivning', …)`. Varje ras i `RACE_LIST` har `desc.length` mellan 20 och 160. Lägg till `it('har en bild för varje ras och yrke', …)`, som med `fs.existsSync` kontrollerar `public/art/bok/raser/${r.id}.webp` för varje ras och `public/art/bok/yrken/${p.id}.webp` för varje yrke i `PROFESSION_LIST`.
- [ ] **Step 2: Kör testet.** Kommando: `npx vitest run tests/data.test.ts`. Det ska falla, eftersom `desc` och webp-filerna saknas.
- [ ] **Step 3: Skriv `tools/book_art.py`.**
  - Pillow skalar alla `*.png` i `public/art/bok/raser` och `public/art/bok/yrken` till 700 punkters höjd (aldrig uppåt).
  - Bilden sparas som WebP med kvalitet 82 och alfakanalen kvar. Därefter tas PNG-filen bort.
  - Kör skriptet med `python3 -I tools/book_art.py`.
- [ ] **Step 4: Lägg till `desc` i `RaceDef` och i alla sju raser.** Texterna står i skissen, som Vidar har godkänt:
  - alv: "Långlivat folk från skogarna. Smidiga och kloka, men inte särskilt starka."
  - anka: "Små, envisa och stridslystna. Tåliga och snabba i vattnet, men sällan omtyckta."
  - dvarg: "Bergens folk: smeder och gruvbrytare, starka och sega."
  - halvalv: "Både alv och människa. Smidigare än människor och med skarpare sinnen."
  - halvlangdsman: "Små och seglivade, med lätta fötter och god aptit."
  - halvorch: "Starka och tåliga, men kantiga i umgänget."
  - manniska: "Det vanligaste folket. Inga för- eller nackdelar, och de passar till alla yrken."
- [ ] **Step 5: Kör testet.** Kommando: `npx vitest run tests/data.test.ts`. Det ska gå igenom.
- [ ] **Step 6: Commit** med meddelandet "Bokens bilder i WebP och folkens beskrivningar".

### Task 2: Förhandsvisa ett halvfärdigt utkast

**Files:**
- Modify: `src/engine/creation.ts`, `src/engine/combat.ts`, `src/engine/game.ts:854-865`
- Test: `tests/creation.test.ts`

**Interfaces:**
- Produces:
  - `previewCharacter(d: Draft): Character` i `creation.ts`. Den ger samma resultat som `finalize` när utkastet är komplett och kastar aldrig fel. Det som saknas blir tomt:
    - `swordHand: ''`, `social: ''`, `ability: null` utan slag,
    - `capital: 0` och `silver: 0` utan kapitalslag,
    - `name` får vara tomt,
    - för en magiker utan magiskola hoppas skolans FV över.
  - `finalize` blir `allErrors`-kontrollen följd av `previewCharacter(d)`.
  - `skillFvOf(a: Actor, skill: string): number` i `combat.ts`. Det är kroppen ur `Game.skillFv`, som delegerar till den.

- [ ] **Step 1: Skriv testerna.**
  - `previewCharacter(teval())` är lika med `finalize(teval())` (`toEqual`).
  - `previewCharacter(newDraft())` kastar inte och har `social === ''`, `swordHand === ''`, `ability === null` och `silver === 0`.
  - En magiker utan yrkesfärdigheter (`d.profession = 'magiker'`) kastar inte.
  - Byte av ras efter köp: `d.bought.STY = 14` och `d.race = 'anka'` ger `attrs.STY === 10` (14 − 4).
- [ ] **Step 2: Kör testerna.** Kommando: `npx vitest run tests/creation.test.ts`. De ska falla, eftersom `previewCharacter` inte finns.
- [ ] **Step 3: Implementera `previewCharacter` och `skillFvOf`.** Flytta kroppen i `finalize` hit, och skydda de ställen som använder `!` (`school`, `startCapital`, `swordHand`, `socialClass` och `abilityDice`).
- [ ] **Step 4: Kör `npm test` och `npx tsc --noEmit`.** Allt ska gå igenom.
- [ ] **Step 5: Commit** med meddelandet "Förhandsvisning av ett utkast som rollperson".

### Task 3: De färdiga rollpersonerna

**Files:**
- Create: `src/content/forgenererade.ts`
- Test: `tests/creation.test.ts`

**Interfaces:**
- Produces: `interface Pregen { id: string; title: string; blurb: string; draft: () => Draft }` och `PREGENS: Pregen[]`, med id:na `krigare`, `tjuv` och `magiker` i den ordningen.
  - `title` är till exempel "Krigaren Halvar".
  - `blurb` är en egen mening om rollpersonen.

- [ ] **Step 1: Skriv testerna.**
  - `PREGENS.map(p => p.id)` är `['krigare', 'tjuv', 'magiker']`.
  - Varje `p.draft()` har `allErrors(d)` lika med `[]`, och `finalize(d)` lyckas.
  - Raserna är `manniska`, `halvlangdsman` och `alv`.
  - Slagen är medelvärden: `abilityDice` är `undefined` eller 21, `swordDice`, `socialDice` och `capitalDice` är 7, och `abilityBp`, `swordBp`, `socialBp` och `capitalBp` är 0 eller 1.
  - `draft()` ger ett nytt objekt varje gång. Två anrop är inte `===`, och en ändring i det ena syns inte i det andra.
- [ ] **Step 2: Kör testerna.** Kommando: `npx vitest run tests/creation.test.ts`. De ska falla, eftersom modulen saknas.
- [ ] **Step 3: Skriv `src/content/forgenererade.ts`** i samma stil som `recruitChar` i `src/content/speltest/index.ts`. Fyll i köp, yrkesfärdigheter, mål-FV, besvärjelser (magikern), utrustning och utseende tills `allErrors` är tom. Namnen och värdena bestämmer du, rimligt för yrket.
- [ ] **Step 4: Kör testerna.** Kommando: `npx vitest run tests/creation.test.ts`. De ska gå igenom.
- [ ] **Step 5: Commit** med meddelandet "Tre färdiga rollpersoner: krigare, tjuv och magiker".

### Task 4: Sammanfattningen av en sparning

**Files:**
- Modify: `src/engine/save.ts`
- Test: `tests/engine.test.ts`

**Interfaces:**
- Produces:
  - `interface SaveSummary { name: string; race: string; profession: string; module: string; clock: string }`. Fälten är rasens och yrkets namn, modulens `name` och `clockText(state.time)`.
  - `saveSummary(state: GameState): SaveSummary`.
  - `listSaves(): { key: string; summary: SaveSummary }[]` läser `dod-save-v7` och ger en tom lista när ingen sparning finns eller den inte går att läsa. Listan är förberedd för flera sparplatser.

- [ ] **Step 1: Skriv testet.** `saveSummary(Game.create(testCharacter()).state)` ger rollpersonens namn, `race: 'Människa'` (eller testrollpersonens ras), modulens namn och en `clock` som börjar med `Dag `.
- [ ] **Step 2: Kör testet.** Kommando: `npx vitest run tests/engine.test.ts`. Det ska falla.
- [ ] **Step 3: Implementera `saveSummary` och `listSaves`** i `save.ts`. `listSaves` använder `loadGame()`.
- [ ] **Step 4: Kör testet.** Det ska gå igenom.
- [ ] **Step 5: Commit** med meddelandet "Sammanfattning av sparningen till menyn".

### Task 5: Rollformuläret från spelet eller ett utkast

**Files:**
- Modify: `src/ui/sheet.ts`
- Create: `src/ui/ink.ts`
- Test: `tests/ink.test.ts`

**Interfaces:**
- Consumes: `previewCharacter` och `skillFvOf` (Task 2), `actorFromCharacter` och `weaponInfo` (befintliga).
- Produces:
  - `interface SheetSource { actor: Actor; char: Character; fv: (skill: string) => number; weapon: (slot: 'weapon' | 'offhand') => WeaponInfo; move: number }`
  - `sheetFromGame(g: Game): SheetSource`
  - `sheetFromDraft(d: Draft): SheetSource`. Den bygger en aktör med `actorFromCharacter(previewCharacter(d), 'player', 0, 0)`, `fv` med `skillFvOf` och `move` med `effectiveMove(actor)` utan spel.
  - `renderSide(src: SheetSource, side: 'front' | 'back'): HTMLElement`
  - `renderSheet(g)` behåller sin signatur och visar båda sidorna som i dag.
  - Varje handskrivet värde (`hand(...)`) får `data-ink`, en nyckel som är stabil mellan ritningar: radens etikett och kolumnens nummer, till exempel `Styrka (STY)|1` eller `Ras`.
  - I `src/ui/ink.ts`:
    - `changedInk(prev: Map<string, string>, next: Map<string, string>): string[]` ger nycklarna där texten är ny eller ändrad, utom där `next` är tom.
    - `readInk(root: HTMLElement): Map<string, string>` läser alla `[data-ink]`.

- [ ] **Step 1: Skriv testerna** i `tests/ink.test.ts`.
  - `changedInk(new Map([['Ras','']]), new Map([['Ras','Alv']]))` ger `['Ras']`.
  - Samma text ger `[]`.
  - En nyckel som försvinner eller blir tom ger `[]`.
- [ ] **Step 2: Kör testerna.** Kommando: `npx vitest run tests/ink.test.ts`. De ska falla.
- [ ] **Step 3: Implementera `ink.ts` och gör om `front(g)` och `back(g)` till `front(src)` och `back(src)`.** `g.player` blir `src.actor`, `g.char` blir `src.char`, `g.skillFv(p, k)` blir `src.fv(k)`, `g.weaponOf(p, slot)` blir `src.weapon(slot)` och `effectiveMove(p, g)` blir `src.move`. Fältet Ålder är tomt när utkastet saknar `years` och rasen saknar åldrar.
- [ ] **Step 4: Kör `npm test` och `npx tsc --noEmit`.** Allt ska gå igenom.
- [ ] **Step 5: Kontrollera i webbläsaren.**
  - Starta `npx vite` och använd ett Playwright-skript i arbetskatalogen (inte i repot).
  - Starta spelet (`Game.create`), tryck R och ta en skärmbild.
  - Rollformuläret ska se ut som före ändringen.
- [ ] **Step 6: Commit** med meddelandet "Rollformuläret ritas från spelet eller ett utkast".

### Task 6: Huvudmenyn, undermenyerna och karusellen

**Files:**
- Create: `src/ui/menu.ts`, `src/ui/carousel.ts`, `src/ui/book.css`
- Modify: `index.html` (`#start` blir `#menu`, och en länk till `book.css` läggs till), `src/main.ts`, `src/audio/index.ts`, `package.json` (`@fontsource/grenze-gotisch`, `@fontsource/archivo-narrow` och `@fontsource/kalam`)

**Interfaces:**
- Consumes: `listSaves` (Task 4), `PREGENS` (Task 3), `RaceDef.desc` och bilderna (Task 1).
- Produces:
  - `bookArt(kind: 'raser' | 'yrken', id: string): string` ger `art/bok/${kind}/${id}.webp`.
  - `class Carousel<T> { constructor(root: HTMLElement, items: T[], opts: { start: number; card(item: T): { name: string; img?: string; badge?: string }; info(item: T, choose: () => void): HTMLElement[]; onChoose(item: T): void }); go(i: number): void }`
  - `mountMenu(handlers: { continueGame(): void; newCharacter(): void; pregen(p: Pregen): void; load(key: string): void }): { show(view?: MenuView): void; hide(): void }`
  - `type MenuView = 'huvud' | 'nytt' | 'ladda' | 'installningar' | 'om'`
  - `audioSliders(): HTMLElement` i `src/audio/index.ts`. ♪-panelen och Inställningar använder samma funktion.

- [ ] **Step 1: Lägg till typsnitten.** Kör `npm install @fontsource/grenze-gotisch @fontsource/archivo-narrow @fontsource/kalam` och importera dem i `src/main.ts`. Lägg tokens i `book.css`: färgerna från Global Constraints och `--f-display` (Grenze Gotisch), `--f-form` (Archivo Narrow) och `--f-hand` (Kalam). Byt handstilen i `.rf .hand` till `var(--f-hand)`.
- [ ] **Step 2: Bygg huvudmenyn** i `menu.ts`.
  - Bakgrunden är `art/bok/omslag.webp`, som täcker skärmen med mörka kanter.
  - Menyn har knapparna Fortsätt äventyret (bara när `listSaves()` inte är tom), Nytt äventyr, Ladda sparat spel, Inställningar och Om spelet. De är röda band med svart kant, som i skissen.
- [ ] **Step 3: Bygg undermenyerna.** Bakgrunden är `art/bok/grind.webp` och dämpad. Varje undermeny har knappen "← Tillbaka".
  - *Nytt äventyr:* "Skapa ny rollperson" och ett kort per `PREGENS` med `title` och `blurb`.
  - *Ladda sparat spel:* en rad per `listSaves()` med namn, ras, yrke, modul och tid, och knappen Ladda. Utan sparningar visas "Inga sparade spel än."
  - *Inställningar:* `audioSliders()` och AI-koden (`#in-code`, flyttad från startskärmen).
  - *Om spelet:* texten från designens avsnitt Upphovsrätt, med länkar till `art/CREDITS.md` och `audio/CREDITS.md` och typsnittens licens (SIL Open Font License).
- [ ] **Step 4: Bygg `Carousel`.**
  - Den följer skissen (`https://claude.ai/artifact/GrT91zrxaPqgfpPJoYaYnt`): kortet i mitten är större, och korten vid sidan är mindre och mörkare.
  - Man bläddrar med pilknappar, piltangenter när scenen har fokus, ett svep över 40 punkter eller ett klick på ett kort vid sidan. Enter väljer.
  - När en bild inte laddar (`img.onerror`) visas ersättningen med begynnelsebokstaven.
  - Rutan under bilden ritas av `opts.info`.
- [ ] **Step 5: Koppla in i `main.ts`.**
  - `mountMenu` ersätter `mountCreator` på startsidan.
  - "Skapa ny rollperson" öppnar tills vidare den gamla guiden.
  - `btn-restart` på "Du har stupat" laddar om sidan utan `clearSave()`.
  - `autostart` och "Fortsätt äventyret" fungerar som förut.
- [ ] **Step 6: Kör `npm test` och `npx tsc --noEmit`.** Allt ska gå igenom.
- [ ] **Step 7: Kontrollera med Playwright i 1280 × 800 och 1024 × 640.** Ta skärmbilder av huvudmenyn och alla fyra undermenyerna.
  - Fortsätt äventyret syns bara med en sparning i `localStorage`.
  - Byt namn på en bild under kontrollen. Kortet ska då visa en bokstav, och karusellen ska fortfarande gå att bläddra i (Review Focus 3). Återställ bilden efteråt.
- [ ] **Step 8: Commit** med meddelandet "Huvudmenyn på omslaget och undermenyerna på grindbilden".

### Task 7: Uppslaget och kapitlen

**Files:**
- Create: `src/ui/chapters.ts`, `src/ui/book.ts`
- Test: `tests/chapters.test.ts`

**Interfaces:**
- Consumes: `renderSide`, `sheetFromDraft`, `readInk` och `changedInk` (Task 5), `stepErrors` (befintlig).
- Produces:
  - `type Chapter = 'folk' | 'yrke' | 'namn' | 'egenskaper' | 'bakgrund' | 'yrkesfardigheter' | 'fardigheter' | 'utrustning'`
  - `CHAPTERS: Chapter[]` i den ordningen.
  - `CHAPTER_NAMES: Record<Chapter, string>`: Folk, Yrke, Namn och figur, Grundegenskaper, Bakgrund, Yrkesfärdigheter, Startfärdigheter och Utrustning.
  - `chapterErrors(d: Draft, c: Chapter): string[]`:
    - `folk` och `yrke` ger `[]`,
    - `namn` ger `stepErrors(d, 'grund')`,
    - de andra ger `stepErrors` för steget med samma namn,
    - `utrustning` ger `allErrors(d)`.
  - `class Turn { start(): void; skip(): void; get busy(): boolean }`: en ren tillståndsmaskin för sidvändningen. `start` medan `busy` är sant gör ingenting. Tiden styrs med `setTimeout`, och `skip` avslutar direkt.
  - `class BookUi { constructor(root: HTMLElement); show(opts: { chapter: Chapter; left: HTMLElement; sheet: SheetSource; side?: 'front' | 'back' }): void; flipSheet(): void; close(): Promise<void> }`
    - När sidan byts vänds den med animationen. Formuläret jämförs med `readInk` före och efter, och nycklarna från `changedInk` får klasserna `ink-new` (skrivs fram) och `ink-hot` (lyser upp).
    - `close()` stänger boken och löser löftet när animationen är klar.

- [ ] **Step 1: Skriv testerna** i `tests/chapters.test.ts`.
  - `CHAPTERS.length === 8`.
  - `chapterErrors(newDraft(), 'folk')` ger `[]`.
  - Ett utkast utan namn ger ett fel i `namn`.
  - `chapterErrors(d, 'egenskaper')` är lika med `stepErrors(d, 'egenskaper')`.
  - `Turn`: `start()` två gånger direkt efter varandra räknar en vändning (en räknare i en callback), och `skip()` gör `busy` falskt. Använd `vi.useFakeTimers()`.
- [ ] **Step 2: Kör testerna.** Kommando: `npx vitest run tests/chapters.test.ts`. De ska falla.
- [ ] **Step 3: Implementera `chapters.ts`** utan DOM-importer, och **`book.ts`**.
  - Uppslaget (upplägg A i skissen) har vänster sida som vitt papper med kapitelrubriken i `--f-display` och höger sida som rollformuläret på rött. Kapitelremsan ligger överst.
  - Under 1024 punkter läggs sidorna under varandra.
  - Knappen "Vänd formuläret" byter mellan framsidan och baksidan.
- [ ] **Step 4: Kör testerna.** De ska gå igenom.
- [ ] **Step 5: Commit** med meddelandet "Uppslaget, kapitlen och sidvändningen".

### Task 8: Guiden som kapitel i boken

**Files:**
- Modify: `src/ui/creation.ts`, `src/main.ts`, `src/ui/menu.ts`

**Interfaces:**
- Consumes: `Carousel` och `bookArt` (Task 6), `BookUi`, `CHAPTERS` och `chapterErrors` (Task 7), `PREGENS` (Task 3), `sheetFromDraft` (Task 5), `listSaves` (Task 4).
- Produces: `class CreatorUi { constructor(root: HTMLElement, onDone: (c: Character) => void, opts?: { draft?: Draft; chapter?: Chapter; preview?: boolean }) }`
  - `preview: true` visar en färdig rollperson i uppslaget med knapparna "Börja äventyret" och "Ändra". "Ändra" går till kapitlet `namn` med samma utkast.
  - `mountCreator` ersätts av att menyn skapar en `CreatorUi`.

- [ ] **Step 1: Folk och yrke.**
  - Kapitlen `folk` och `yrke` visar en `Carousel` över hela skärmen med grindbilden dämpad bakom. Hörnet av rollformuläret uppe till höger visar Namn, Kön, Ras och Yrke med `data-ink`.
  - Rutan visar för folket `desc`, `traits`, `mods`, STO och BP, och för yrket `desc`, `requirements` och `ability`.
  - Valet anropar de befintliga `setRace` och `setProfession`.
  - Efter yrket slås boken upp på kapitlet `namn`.
- [ ] **Step 2: Kapitlen i uppslaget.**
  - Dela upp `grund` i kapitlet `namn` (namn, kön och figur). Folk och yrke har nu egna kapitel.
  - Kapitlen `egenskaper`, `bakgrund`, `yrkesfardigheter`, `fardigheter` och `utrustning` ritar sitt innehåll på vänster sida med de befintliga metoderna.
  - "Nästa" är spärrad så länge `chapterErrors` inte är tom, och felen visas under knappen.
  - Kapitlet `utrustning` visar baksidan av formuläret.
  - Man kan gå tillbaka till alla kapitel man har klarat, folk och yrke också.
- [ ] **Step 3: De färdiga rollpersonerna och överskrivningen.**
  - Ett kort under *Nytt äventyr* öppnar `CreatorUi` med `preview: true` och `draft: p.draft()`.
  - "Börja äventyret" frågar i boken, utan `confirm()`, om sparningen ska skrivas över när `listSaves()` inte är tom. Valen är "Skriv över" och "Avbryt".
  - "Avbryt" stänger frågan och rör inte sparningen.
  - Annars stängs boken (`close()`), och `onDone(finalize(d))` startar spelet som `mountCreator` gjorde (`setAccessCode`, `clearSave` och `launch`).
- [ ] **Step 4: Kör `npm test` och `npx tsc --noEmit`.** Allt ska gå igenom.
- [ ] **Step 5: Kontrollera med Playwright i 1280 × 800.**
  - Hela vägen från huvudmenyn till ett startat spel med en egen rollperson. Ta en skärmbild per kapitel.
  - Samma väg med magikern via "Ändra".
  - Med en sparning i `localStorage`: frågan visas, "Avbryt" lämnar `localStorage['dod-save-v7']` orörd (Review Focus 1), och "Skriv över" startar spelet.
  - Byt folk från kapitlet Grundegenskaper. Värdena i formuläret ska ändras, och inga fel ska komma i konsolen (Review Focus 2).
  - Dubbelklicka på "Nästa". Du ska hamna ett kapitel fram (Review Focus 4).
- [ ] **Step 6: Commit** med meddelandet "Guiden som kapitel i rollpersonsboken".

### Task 9: Credits och briefen

**Files:**
- Modify: `public/art/CREDITS.md`, `docs/brief.md`

- [ ] **Step 1: CREDITS.md.** Lägg till avsnittet "Bokens bilder": omslaget, grindbilden och bilderna på folken och yrkena kommer ur Drakar och Demoner (1991). De tillhör sina upphovspersoner och används i ett privat fanprojekt. Lämna en rad där Vidar kan fylla i tecknarens namn. Ta också med typsnitten (SIL Open Font License).
- [ ] **Step 2: docs/brief.md.**
  - Under "Plan för grafik och ljud" markeras punkt 4 som klar.
  - Ange filerna (`menu.ts`, `carousel.ts`, `book.ts`, `chapters.ts`, `ink.ts`, `forgenererade.ts` och `previewCharacter`).
  - Skriv vad som är kvar: flera sparplatser, en knapp "Spara spel" i spelet och den nya stilen på "Mellan äventyren" och "Du har stupat".
- [ ] **Step 3: Kör `npm test` och `npx tsc --noEmit`.** Allt ska gå igenom.
- [ ] **Step 4: Commit** med meddelandet "Credits och briefen efter rollpersonsboken", och pusha till `claude/loving-shannon-n76dmw`.
