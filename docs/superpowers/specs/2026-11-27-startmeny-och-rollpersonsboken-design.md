# Startmenyn och rollpersonsboken: design

Punkt 4 i Vidars plan för grafik och ljud (`docs/brief.md`): skapa rollperson och rollformuläret
som i böckerna. Skisserna Vidar har sett och godkänt ligger som en privat sida
(https://claude.ai/artifact/GrT91zrxaPqgfpPJoYaYnt). Han valde upplägg A, uppslaget.

## Varför

Spelet ska kännas som Drakar och Demoner från 1991, för nostalgin. Det första man ser ska vara
boken, och man ska få känslan av att fylla i ett riktigt rollformulär med blyerts. I dag är
startskärmen en mörk ruta med flikar, och rollformuläret syns först när spelet har börjat.

## Mål

1. **Huvudmenyn.** Bokomslaget (`public/art/bok/omslag.webp`) täcker skärmen, och menyn ligger
   ovanpå. Titelmusiken spelar redan i dag (`audio.playMusic('titel')` i `mountAudio`) och
   börjar vid första klicket.
   - Valen: *Fortsätt äventyret* (bara när en sparning finns), *Nytt äventyr*,
     *Ladda sparat spel*, *Inställningar* och *Om spelet*.
   - *Inställningar* och placeringen av *Fortsätt äventyret* är mitt förslag. *Inställningar*
     har ljudreglagen och AI-spelledarens åtkomstkod, som i dag ligger under "AI-inställningar"
     på startskärmen.
2. **Undermenyerna** har grindbilden (`public/art/bok/grind.webp`) som bakgrund, vilket val man
   än gör, och en knapp tillbaka till huvudmenyn.
   - **Nytt äventyr:** "Skapa ny rollperson" och tre färdiga rollpersoner. Väljer man en färdig
     rollperson öppnas uppslaget direkt med det ifyllda rollformuläret och knapparna
     "Börja äventyret" och "Ändra". "Ändra" lägger in den färdiga rollpersonen som utkast i
     skapandet, så att man kan ändra det man vill.
   - **Ladda sparat spel:** en lista med sparningarna. I dag finns bara den automatiska
     sparningen (`dod-save-v7`). Den visas med rollpersonens namn, ras och yrke, modulen och
     speltiden. Flera sparplatser kommer senare.
   - **Om spelet:** varifrån materialet kommer och vad som gäller för upphovsrätten (se
     Upphovsrätt nedan).
3. **Folk och yrke** väljs i en karusell över hela skärmen, med grindbilden dämpad bakom.
   - Bilden i mitten är större. Man bläddrar med pilar, piltangenter, ett svep eller ett klick
     på ett kort vid sidan.
   - Under bilden står en ruta i rollformulärets stil. För folket visas en kort beskrivning,
     särdragen, modifikationerna, STO och kostnaden i BP. För yrket visas en kort beskrivning,
     kraven och yrkesförmågan. Beskrivningarna är egna, korta och skrivna med egna ord. Vidar
     har godkänt texterna i skissen.
   - Uppe till höger ligger ett hörn av rollformuläret där folket och yrket skrivs in när man
     väljer.
   - Bilderna ligger i `public/art/bok/raser/<id>.png` och `public/art/bok/yrken/<id>.png`
     (sorterade). Saknas en bild visas en ersättning med namnets första bokstav.
4. **Uppslaget.** När yrket är valt slås boken upp. Vänster sida är kapitlet, och höger sida är
   rollformuläret. Kapitlen är:
   1. Folk (karusell)
   2. Yrke (karusell)
   3. Namn, kön och figur
   4. Grundegenskaper
   5. Bakgrund: särskild förmåga, svärdshand, socialt stånd, startkapital, ålder och modersmål
   6. Yrkesfärdigheter
   7. Startfärdigheter, och besvärjelser för magiker
   8. Utrustning

   En remsa med kapitlen visar var man är. Man kan gå tillbaka till kapitel man redan har
   klarat. Nästa kapitel går inte att nå förrän felen i det nuvarande är rättade, och felen
   står under knappen, som i dag.
5. **Rollformuläret fylls i** medan man väljer. Allt skrivs med blyertsstilen som formuläret
   redan har. Det som just ändrades skrivs fram från vänster till höger och lyser upp en kort
   stund. I kapitlet Utrustning vänds formuläret till baksidan, och det går också att vända
   det själv. Det är samma formulär som spelet visar med tangenten R.
6. **Tärningsslagen** i Bakgrund slås med en knapp, och resultatet skrivs in i formuläret.
   Reglerna och slagen är desamma som i dag (`rollAbility`, `rollSwordHand`, `rollSocial` och
   `rollCapital`).
7. **Sidan vänds** med en animation mellan kapitlen. Med "Börja äventyret" stängs boken, och
   titelmusiken tonar över i spelets musik (det sköter `attachAudio`).
8. **Stilen** följer rollformuläret från 1991: rött, vitt och svart, smala rubriker i röda
   band och tunna svarta linjer. Det är samma stil som `src/ui/sheet.ts` redan har.

## De färdiga rollpersonerna (mitt förslag, Vidar godkände flödet)

| Yrke | Folk | Varför |
| --- | --- | --- |
| Krigare | Människa | Det enklaste valet för den som är ny |
| Tjuv | Halvlängdsman | SMI +3 når tjuvens krav på SMI 16 |
| Magiker | Alv | INT +3 hjälper mot magikerns krav |

De byggs med samma regler som allt annat (`newDraft`, köp och slag med fasta värden och
`finalize`), precis som följeslagarna i `RECRUITS`. Utkasten ligger i `src/content/`, eftersom
de är innehåll. Ett test kontrollerar att `allErrors` är tom för vart och ett. Namnen,
värdena och utrustningen väljer byggaren, rimligt för yrket.

## Inte nu

- Flera sparplatser, en knapp "Spara spel" i spelet och sparning på server. Listan i "Ladda
  sparat spel" byggs så att fler sparningar kan läggas till utan att menyn görs om.
- Nya regler eller ändrade värden. Bara gränssnittet ändras.
- Fler bilder än de som finns: figurer, porträtt och kartor.
- Telefoner i stående format. Skärmarna ska fungera ned till ungefär 1024 × 640, och smalare
  än så får uppslaget läggas med sidorna under varandra.
- Skärmarna "Mellan äventyren" och "Du har stupat" får inte den nya stilen nu. Knappen
  "Ny rollperson" på "Du har stupat" leder däremot till huvudmenyn och lämnar sparningen kvar.
  Där finns sparningen från före döden under *Fortsätt äventyret*, precis som med "Ladda senaste
  sparningen". "Mellan äventyren" får ingen ny knapp.

## Det får inte bli

- **Långsamt eller segt.** Animationerna är korta: sidvändningen under en sekund och
  skrivandet under en halv. Ett klick under en animation hoppar till slutet, och med
  `prefers-reduced-motion` blir allt direkt.
- **Text ur böckerna.** Beskrivningarna är egna (`CLAUDE.md`).
- **Sämre än i dag.** Allt som guiden kan i dag ska gå att göra även i den nya, med samma
  felmeddelanden.

## Upphovsrätt

Repot är privat (Vidar, 27 november 2026), så bokens bilder kan ligga i `public/art/bok/`.

- **Om spelet** säger att spelet är ett fritt fanprojekt som följer reglerna i Drakar och
  Demoner (Äventyrsspel, 1991), att bilderna kommer ur böckerna och tillhör sina upphovspersoner,
  och att grafiken och ljudet från Flare har licensen CC BY-SA 3.0. Sidan länkar till
  `public/art/CREDITS.md` och `public/audio/CREDITS.md`.
- **CREDITS.md** får ett avsnitt om bokens bilder. Vidar fyller i tecknarens namn om han vill.

## Vägar att bygga det

1. **HTML och CSS ovanpå Phaser, som i dag (vald).** Startskärmen, guiden och rollformuläret
   är redan HTML (`index.html`, `src/ui/creation.ts`, `src/ui/sheet.ts`). Den nya menyn och
   uppslaget byggs om där, och logiken i `src/engine/creation.ts` blir orörd. Textfält, listor
   och tabeller fungerar som vanligt.
2. **En Phaser-scen för menyn och skapandet.** Den avfärdas, eftersom formulären, textfälten och
   tabellerna skulle behöva byggas om från början i en canvas. Rollformuläret i HTML skulle då
   finnas i två versioner.
3. **Ett ramverk som React.** Det avfärdas, eftersom projektet inte har något ramverk och resten
   av gränssnittet är skrivet med `el` och `$` från `src/ui/hud.ts`. Ett ramverk bara för den här
   delen ger två sätt att skriva gränssnitt.

## Mina beslut (Vidar kan ändra dem)

- **Rollformuläret** ritas i dag direkt från `Game` (`renderSheet(g)`). Det delas upp så att
  framsidan och baksidan ritas från en vy med det som formuläret visar (namn, fält,
  grundegenskaper, färdigheter med FV och erf, förmågor, KP per kroppsdel, vapen, pengar och
  utrustning). Två funktioner fyller vyn: en från spelet och en från ett utkast (`Draft`). Ett
  utkast som inte är färdigt ger tomma rutor i stället för fel. Rollformuläret ser då likadant
  ut i skapandet och i spelet.
- **Typsnitten** finns i webbläsaren eller läggs i repot, så att spelet inte behöver hämta något
  från andra webbplatser. Rubrikerna i bokstil (som "Grundegenskaper" och "Ny rollperson") får
  ett frakturliknande typsnitt med fri licens. Licensen nämns i Om spelet.
- **Bilderna** räknas om till WebP i en rimlig storlek, ungefär 700 punkter höga. PNG-filerna
  är 300–420 kB styck, och 18 bilder i karusellen blir annars över 6 MB.
- **"Ändra" på en färdig rollperson** behåller dess tärningsslag. De är slagna och låsta, som
  när man själv har slagit, och BP som ligger på slagen går inte att flytta. Allt annat går att
  ändra. Slagen har därför medelvärden, så att de färdiga rollpersonerna inte blir ett sätt att
  få bra slag gratis.
- **Ett nytt äventyr skriver över sparningen.** Finns det en sparning frågar spelet först, när
  "Börja äventyret" trycks, om den ska skrivas över.
- **I spelet (tangenten R)** visas fram- och baksidan bredvid varandra som i dag. I uppslaget
  visas en sida i taget och går att vända. Båda använder samma kod för sidorna.
- **Kapitelremsan** visar alla åtta kapitlen. Motorns sex steg (`STEPS`) ligger kvar. De tre
  första kapitlen tillsammans motsvarar steget `grund`. Folk och yrke har alltid ett giltigt
  val, så felen i `grund` (namn och figur) visas i kapitel 3.

## Kvar åt byggaren

- Exakt utseende, mått och tider för animationerna, inom ramarna ovan.
- Hur sidvändningen görs (CSS 3D eller en enklare övertoning) och hur karusellen räknar ut
  lägena.
- Namnen, värdena och utrustningen för de färdiga rollpersonerna.
- Hur koden delas upp i filer under `src/ui/`.

## Test

- Motorn: de färdiga rollpersonerna är giltiga (`allErrors` är tom, och `finalize` lyckas), och
  vyn för rollformuläret fylls rätt både från spelet och från ett halvfärdigt utkast.
- Sammanfattningen av en sparning (namn, ras, yrke, modul och speltid) testas med ett
  speltillstånd.
- Gränssnittet kontrolleras under bygget med skärmbilder i Playwright (ett skript i
  arbetskatalogen, inte en testsvit i repot): huvudmenyn, undermenyerna, båda
  karusellerna, varje kapitel och baksidan. Hela vägen ska gå från huvudmenyn till ett
  startat spel, både med en egen och med en färdig rollperson.
- `npm test` och `npx tsc --noEmit` före varje commit (`CLAUDE.md`).
