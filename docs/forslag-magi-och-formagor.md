# Förslag: fiendernas magi, alla besvärjelser och förmågorna utan verkan

**Vidar godkände förslagen den 23 november 2026.** Svaren på frågorna i avsnitt 6 och upplägget
för vädret står i `docs/regelbeslut.md` under Förmågor, besvärjelser och väder. Avsnitt 0 och steg 2–4 i byggordningen är byggda: de enkla förmågorna, magi för alla och fiender som lägger besvärjelser. Steg 5 är klart utom NEDKALLA ÅSKVIGG, som väntar på vädret (se `docs/regelbeslut.md` under Besvärjelser i strid). Barden och munken har fått en husregel i stället för förslaget i avsnitt 4.
Besluten för varje besvärjelse och förmåga flyttas till `docs/regelbeslut.md` när de byggs. Texten är egen och återger inte böckerna. Där boken anger ett värde som
inte finns i `src/data/` står det **(Bok III)** eller **(Bok I)**, och då behövs avskriften när
det byggs.

## 0. Det här hittade jag på vägen

Flera förmågor har regelvärden i `src/data/abilities.ts` men **används inte av motorn**. Rollformuläret
visar dem, men de gör ingenting i spelet:

| Förmåga | Värde i datan | Används |
| --- | --- | --- |
| Starka nypor | +3 CL i Klättra | nej |
| Övertygande tonfall | +3 CL i Övertala och Muta | nej (Gråvad slår Övertala) |
| Stirrande blick | +5 CL i Hypnotisera | nej |
| Magikänsla | +5 CL i Känna magi | nej |
| Precisionssinne | +1 CL med alla vapen | nej |
| Mycket uppmärksam | +2 CL i Finna dolda ting och Upptäcka fara | nej (Upptäcka fara slås vid anfall bakifrån) |
| Extremt orädd | −5 på Skräcktabellen | nej |
| Orubblig vilja | +5 PSY i kamp PSY mot PSY | nej |
| Härdig mot element | +5 FYS mot elementen | nej |
| Baneman | +5 CL mot ett valt folkslag | valet sparas, men tillägget saknas |

Av yrkesförmågorna verkar bara krigarens Stridsvana och utbygdsjägarens Animism. Lärd mans
Snusförnuft (−5 på Skräcktabellen) har samma värde som Extremt orädd men används inte heller.

**Förslag:** koppla in allt i tabellen och Snusförnuft direkt. Det kräver inga nya beslut, bara att
värdena används där slagen slås (`skillMod`, anfallets CL, `scare`, `resists` och FYS-slagen mot
köld).

## 1. Fiender som lägger besvärjelser

I dag lägger bara gruppen besvärjelser, och `castSpell` utgår från `g.player`. Förslaget:

1. **Samma regler som för gruppen.** Fienden har FV i en skola, S per besvärjelse, PSY-poäng, högsta
   E, järnregeln, snedtändning vid fummel och bruten koncentration vid träff. Inga genvägar för
   fienderna.
2. **Data:** en varelse eller person får `magic: { schools: { elementarmagi: 12 }, spells: ['blixt', 'skold', …] }`.
   PSY-poängen är varelsens PSY. Alla besvärjelser räknas som memorerade.
3. **Vilka:** de varelser som boken säger kan använda magi (svartalfer kan lära sig det, drakarna
   har sin drakmagi) och personer i modulerna. Svartfolk, orcher och de andra som "aldrig kan lära
   sig magi" får ingen.
4. **Fiendens val varje tur** (enkel prioritetslista, i ordning):
   1. Läka en svårt skadad vän (HELA) om den finns.
   2. Skydda sig själv i början av striden (SKÖLD, SKYDD, LÄDERHUD, FÖRTROLLA VAPEN).
   3. Skadebesvärjelse mot den närmaste som syns, när ingen står intill.
   4. Annars närstrid eller avstånd som i dag.

   Fienden lägger inte en besvärjelse som tar PSY till 0, och sparar alltid PSY för en E1.
5. **Spelaren ser det komma.** En besvärjelse som inte är kvick verkar först i början av nästa runda,
   och loggen säger "Svartalfen börjar mana …". Gruppen kan då bryta koncentrationen genom att
   skada magikern. Det ger magikerfienderna en naturlig motåtgärd.
6. **Motstånd:** gruppen gör motstånd med PSY mot besvärjelser som påverkar psyket, och en lyckad
   kamp räknas som vunnen PSY-kamp (redan byggt i `markPsyWin`).
7. **Elementarer:** fiender som frammanar elementarer kommer i ett senare steg, när besvärjelserna
   fungerar för alla.
8. **Gråvad:** en svartalfisk häxkonstnär i grottan att prova mot, med BLIXT, SKÖLD och HELA.

## 2. Besvärjelserna utan verkan (44 st.)

Grupperade efter vad som behövs för att bygga dem. Varje rad är ett förslag.

### 2a. I strid, med det som redan finns

| Besvärjelse | Förslag |
| --- | --- |
| ÖKA / MINSKA | Höjer eller sänker en grundegenskap med 1 per E så länge den varar. Härledda värden (SB, baschans, KP) räknas om under tiden. Fråga: ska STO och FYS ändra KP? Förslag: ja, och förlorade KP står kvar när den tar slut. |
| FLAMMANDE HAND | +1T3 per E i skada på obeväpnade anfall och på anfall med vapen som hålls i handen. |
| KALLA HANDEN, BLIXT … | (verkar redan) |
| VINDPIL | Ett skott med S som CL och skada som en pil **(Bok III)**. Ingen järnspets, så magikern kan skjuta. |
| NEDKALLA ÅSKVIGG | Som BLIXT, men bara utomhus när det regnar, och magikern blir också blöt. Behöver vädret (2c). |
| ASTRALVAPEN | Ett eggvapen i handen så länge det varar. Magikern väljer vapen efter vikt (E per kg). Räknas som magiskt vapen och som trä för järnregeln. FV: S **(Bok III)**. |
| VIRVELSKÖLD | Alla projektiler till och från magikern missar automatiskt. |
| MOTSTÅNDSKRAFT | −1 per E på all skada av eld och köld: ELD, FROST, KALLA HANDEN, salamandern, thermen, glacialen och drakens eld. |
| ANTIMAGI | En effekt på målet. Inkommande besvärjelser slår E mot ANTIMAGIs E på motståndstabellen; misslyckas de studsar de tillbaka på magikern. |
| MÖRKER | Rutorna i sfären (fyra rutor tvärs över) räknas som mörker. Facklor där lyser inte. |
| LJUS | Ett föremål eller en person lyser som en fackla, tre meter till per extra E. |
| OSYNLIGHET | Som oupptäckt i smygarläget: fienderna kan inte välja målet. Bryts om den osynlige anfaller, springer, lägger magi eller skadas. |
| KAMOUFLAGE | Som OSYNLIGHET, men bara utomhus och bara så länge magikern inte flyttar sig. |
| MAGISK SYN | Ser osynliga och skyddar mot bländning (EXPLOSION, luminalen). |
| KONTROLLERA PERSON | En humanoid byter sida så länge det varar, PSY mot PSY. Magikern styr den på dess tur. |
| KONTROLLERA VARELSE | Som KONTROLLERA PERSON för alla ointelligenta djur, 20 STO per E (Vidar: inga grupper). |
| SPRÅNG | Ett hopp till en ruta inom 4 m per E (2–3 rutor), över fiender och vatten, med ett Normalt SMI-slag vid landningen. |
| LEVITATION | Magikern svävar ovanför marken. Närstridsanfall når bara med långa vapen, och skott går som vanligt. |
| FLYGA | Flyger E × 5 rutor per runda och över vatten och hinder. Närstrid som för LEVITATION. |
| LYFT | Flyttar ett föremål eller en varelse (3 STO per E) två rutor per runda. En ovillig varelse gör motstånd med STY. |
| TELEPORTERA | Gruppen eller magikern flyttas till en plats man har varit på inom 100 m. I strid en ruta man har sett. |
| DIMMA | Sikten blir 10 rutor för alla inom området. Kräver vatten inom räckvidd. |
| BESKYDDARE | En ruta eller ett rum blir skyddat: den som går in träffas av ENERGISTRÅLE E1, och magi in i den måste övervinna ANTIMAGI E1. Bra för lägret. |

### 2b. Utanför strid: kartan, samtal och föremål

| Besvärjelse | Förslag |
| --- | --- |
| FINNA VATTEN | Loggen ger riktning och avstånd till närmaste vatten. |
| VARSEBLIVNING | Spelaren väljer slag (fiende, en viss varelse, en ört, en utgång, ett föremål), och loggen ger riktning och avstånd. En sak per E. |
| VÄXTKUNSKAP | Identifierar en ört man har hittat eller bär på, och nästa sökning efter den örten lyckas automatiskt. |
| TRÄELD / LÅGA | Tänder facklan utan elddon. LÅGA lyser också i 1T3 SR. |
| ÖPPNA / FÖRSEGLA | Kräver låsta dörrar och kistor i modulerna (`MapDef.locks`). FÖRSEGLA stänger en dörr så att fienderna måste slå sönder den (20 KP). |
| SPÅRLÖS | Fiender på världskartan kan inte följa spåret. Har verkan först med världskartan. |
| VATTENANDNING | Vattenrutorna går att beträda så länge den varar. |
| TALA MED VARELSE | Öppnar ett samtal med ett djur ur gruppen via AI-spelledaren. |
| TANKEÖVERFÖRING / TELEPATI | AI-spelledaren förmedlar tysta meddelanden. I spelet: gruppen kan tala i smygarläget utan att höras. |
| TANKELÄSNING | I samtal får AI-spelledaren avslöja vad personen tänker och döljer, om personen inte märker det. |
| SYN | Visar en plats man känner till på kartan, med dem som är där nu. Identifierar magiska föremål när de finns. |
| TILLKALLA VARELSE | Djur ur gruppen kommer inom 1T10 minuter och följer med som tillfälliga följeslagare tills magin bryts eller striden är slut. |

### 2c. Vädret

VINDKONTROLL, REGNKONTROLL, NEDKALLA ÅSKVIGG och VIGGFÅNGARE kräver väder, och det finns inte i
spelet. **Beslutat:** ett väder i `GameState` med två mätare, himlen och vinden, som ändras ett steg
i taget varje halvdygn (se `docs/regelbeslut.md`). Modulerna kan låsa det. Regn släcker facklor, ger −2 på avståndsstrid och gör att FINNA
VATTEN inte fungerar. Vind påverkar skott och båtar.

### 2d. Ritualer

| Besvärjelse | Förslag |
| --- | --- |
| LADDNING | Ett föremål lagrar 5 PSY per E. Magikern kan dra PSY ur det när hen lägger en besvärjelse. |
| FÖRYNGRA | Spelet har ingen ålder än. Förslag: rollpersonen får en ålder, och FÖRYNGRA blir verklig när åldrandet byggs. Till dess bara en anteckning. |
| FÖRÄNDRA | Förvandlar ett djur till ett annat djur, eller ett föremål till ett av samma slag (STO-gränsen gäller). Fråga: ska ett järnvapen kunna bli ett trävapen? |

## 3. Särskilda förmågor utan verkan

| Förmåga | Förslag |
| --- | --- |
| Mottagligt medium | +5 när någon kanaliserar magi genom personen. Har verkan när Magisk kanalisering byggs. |
| God bågskytt | +25 % på räckvidderna i `rangedInfo`. |
| God tidskänsla | Klockan i statuspanelen visar bara tid på dygnet (gryning, förmiddag …) för andra, och klockslag för den med förmågan. |
| Absolut ögonmått | Visar avståndet i meter till den man pekar på, och ger +1 på skott på lång räckvidd (tolkning). |
| Gott balanssinne | +5 på SMI vid landning (SPRÅNG, fall) och vid STO mot STO när någon försöker fälla personen (sylfen, Fasthållning). |
| Djurvän | Vanliga djur väljer aldrig personen som mål och anfaller bara om personen anfaller först. |
| Turgubbe | En knapp som köper +1 på nästa CL för 1 PSY. Fråga: hur många gånger per slag? Förslag: högst +3. |
| Magisk empati | Har verkan när magiska föremål finns. |
| Gudarnas gunstling | När KP når 0 slås 1T100; på 25 eller lägre återställs alla KP (kritiska skador står kvar). Fråga: varje gång eller en gång per äventyr? Förslag: en gång per äventyr. |
| God kroppskontroll | En handling: Normalt FYS-slag ger +5 STY (och SB) i tre rundor, två gånger om dagen. |
| Järnnäve | Obeväpnade anfall gör alltid högsta skada. |
| Gott läkekött | Dubbel läkning per dag i `advanceTime` för skador av vapen och elementarbesvärjelser. |
| God mental kontroll | Dubbelt så snabb återhämtning av PSY. |
| Hamnbytare | Den största. En handling som byter figur och värden mot djurets (1T6 när förmågan fås). PSY-slag när man byter tillbaka; misslyckas det fastnar man i hamnen för alltid. Djurens värden finns i `src/data/creatures.ts`. Förslag: bygg sist. |
| Snabb uppfattning | +5 på CL vid parering i närstrid, och man kan parera pilar med ett närstridsvapen. |
| Dubbelhänt / Ambidextriös | Värdet sparas som svärdshand men spelet straffar inte den andra handen. Fråga: ska vänster hand ge avdrag för de andra? |
| Kluven personlighet | Fungerar när yrkesförmågorna fungerar (avsnitt 4). |

## 4. Yrkesförmågor

| Yrke | Förmåga | Förslag |
| --- | --- | --- |
| Bard | Förtrollande framträdande | En handling utanför strid: en minuts spel eller sång och ett lyckat slag. I en timme får barden +5 på KAR-färdigheter (Övertala, Muta, Bluffa och handeln), och AI-spelledaren får veta det. |
| Helare | Handpåläggning | En handling: läker 1 KP per runda för 1 PSY per KP, fram tills helaren slutar. Mot gift: PSY/2 mot giftets STY på motståndstabellen, och det kostar lika många PSY som STY. Infektionerna och febern räknas som sjukdom. |
| Krigare | Stridsvana | (verkar redan) |
| Lärd man | Snusförnuft | −5 på Skräcktabellen (se avsnitt 0). |
| Lönnmördare | Anfall bakifrån | Byggs in i `ambush`: när Smyga lyckas och offret missar Upptäcka fara ger ett misslyckat anfall normal skada, ett lyckat dubbel och ett perfekt fyrdubbel, utan SB. Bara mot humanoider som inte är för stora. |
| Magiker | Ingen | — |
| Munk | Meditation | En handling: varje hel runda ger +1 FV i en vald färdighet, högst dubbla FV. Gäller nästa slag inom en minut (12 rundor). |
| Sjöfarare | Härdad av havet | +5 på FYS, STO eller STY mot elementens besvärjelser och mot eld och köld (som Härdig mot element). |
| Riddare | Riddarslag | Ett anfallssätt i stridspanelen för 5 PSY: välj kroppsdel utan avdrag, eller högsta skada med högsta SB. |
| Tjuv | Tjuvtur | En knapp som Turgubbe: 1–3 PSY för lika mycket på CL. Två gånger mellan varje sömn, fyra för alver. |
| Utbygdsjägare | Animism | (verkar redan) |

## 5. Ordning att bygga i

1. **Avsnitt 0:** koppla in värdena som redan finns. Inga nya beslut behövs.
2. **Förmågorna** i avsnitt 3 och 4 som är enkla: God bågskytt, Järnnäve, Gott läkekött, God mental
   kontroll, Snabb uppfattning, Djurvän, Turgubbe, Tjuvtur, Riddarslag, Anfall bakifrån, Härdad av
   havet, Handpåläggning, Meditation, God kroppskontroll och Gudarnas gunstling.
3. **Magi för alla:** `castSpell` och `resolve` tar magikern som argument i stället för `g.player`.
   Det behövs både för fienderna och för att ANTIMAGI ska kunna studsa tillbaka.
4. **Fiender som lägger besvärjelser** (avsnitt 1), med häxkonstnären i Gråvad.
5. **Besvärjelserna i strid** (2a).
6. **Besvärjelserna utanför strid** (2b) och låsta dörrar i modulformatet.
7. **Vädret** (2c) och ritualerna (2d).
8. **Hamnbytare** och det som väntar på magiska föremål och världskartan.

## 6. Frågor till Vidar

1. Ska fienderna följa exakt samma magiregler som gruppen (avsnitt 1.1)? Förslag: ja.
2. Ska fiendens magiker få komma in i Gråvad som provfiende? Förslag: ja, i grottan.
3. ÖKA och MINSKA: ska STO och FYS ändra KP medan besvärjelsen varar?
4. Ska vi bygga ett enkelt väder (2c), eller ska väderbesvärjelserna bara verka i moduler som anger väder?
5. Turgubbe: högst hur mycket per slag?
6. Gudarnas gunstling: varje gång KP når 0, eller en gång per äventyr?
7. Ska den andra handen ge avdrag för dem som inte är dubbelhänta eller ambidextriösa?
8. FÖRÄNDRA: får ett järnvapen bli ett trävapen?
9. Godkänner du ordningen i avsnitt 5, och att avsnitt 0 byggs direkt?
