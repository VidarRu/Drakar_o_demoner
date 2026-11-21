# Regelbeslut

Spelet följer reglerna i *Drakar och Demoner* från 1991 (Bok I Rollpersonen, Bok II Spelledarboken
och Bok III Spelarboken) så långt det går. Den här filen samlar alla tolkningar, val mellan
motsägelser och husregler, så att motorn och AI-spelledaren gör likadant. Texten är egen och
återger inte böckerna.

Regelvärdena finns i koden:

| Var | Vad |
| --- | --- |
| `src/engine/rules/` | Regelkärnan: tärningsslag, färdighetsslag, motståndsslag, alla tabeller och härledda värden. |
| `src/data/` | Regeldata: raser, yrken, färdigheter, vapen, rustningar, sköldar, varelser, besvärjelser och utrustning. |

## Allmänt

- **Tabeller går före exempel.** Exemplen i böckerna innehåller räknefel. Exempel: ringbrynja har abs 5 och stridsyxa 1T8+2.
- **Formler går före tryckta värden.** Varelsers KP räknas som (STO+FYS)/2 avrundat uppåt, och SB tas ur skadebonustabellen. Det gäller också när den tryckta raden avviker, till exempel för jätte, kentaur, mantikora, liten björn och zombie. Undantag är varelser där boken anger en egen regel med flit: gasten har KP = PSY och spöket saknar kropp.
- **Bok III gäller för vapen.** STY-kraven för skjut- och kastvapen tas från Bok III.
- **Yrkeslistorna gäller.** När yrkesbeskrivningarna och färdighetstabellen säger olika gäller listan vid yrket. Helaren har Dolk men inte Språkkunskap, och tjuven har Drogkunskap men inte Hasardspel eller Hantera fällor. Trästav står inte som egen post för utbygdsjägaren, men den kan väljas som en av hens tre vapenfärdigheter eftersom den är en vapengrupp.
- **Dvärgen får PSY +2.** Det står tryckt som "±2".
- **Magisk kanalisering bygger på PSY och Två vapen på SMI**, som i Bok III.
- **Rustningar** räknas per kroppsdel med vikter och priser ur rustningstabellen. Tabellen för hela rustningar används inte.
- **Metallrustning:** all ringbrynja och alla metallplåtar räknas som metall. Då går det inte att simma, Klättra halveras, och Akrobatik, Hoppa och Stavhopp kan inte användas. Fjällpansar, lamellerad, laminerad och hel metall klirrar dessutom, så att Smyga halveras. Ringbrynja klirrar inte.
- **Pegasens "kritiska" PSY-slag** tolkas som Extremt svårt (SG 25).
- **Tabeller som tar slut fortsätter efter sitt mönster:**
  - Skadebonus: +1T6 för varje 40 poäng över 180, så att draken med STY+STO 200 får +6T6 som i boken.
  - Förflyttning: +1 per 8 poäng över 92.
  - Kroppspoäng per kroppsdel: +1 per 5 KP över 40.
  - EP-kostnadstabellen: varje steg över FV 21 kostar 5, sedan 6 från FV 24, och så vidare var tredje nivå.
- **Varelser under 5 KP** får kolumnen för 5–7 KP minus ett, men minst 1 per kroppsdel.

## Färdighetsslag

- **Slaget:** man lyckas om 1T20 är lika med eller under CL. Med FV 1 eller mer lyckas en etta alltid och en tjugo misslyckas alltid.
- **Perfekt och fummel kräver ett andra slag.** Det andra slaget jämförs med FV, inte med CL, som boken säger. Med CL 20 eller mer blir en etta alltid perfekt, och en tvåa ger ett nytt slag mot FV. Fummel kräver då två tjugor i rad, och en tjugo följd av något annat blir misslyckat. Med CL under 1 kan man inte slå perfekt, och en tjugo blir fummel direkt.
- **FV 0 och CL 0 eller lägre:** man måste slå två ettor i rad för att lyckas.
- **Differensvärde** = CL − tärningsslaget.
- **Motståndsslag och grundegenskapsslag** använder formeln 10 + värde − motvärde (svårighetsgrad eller motståndarens värde). Är resultatet 20 eller mer lyckas man automatiskt, är det 0 eller mindre misslyckas man automatiskt. Däremellan räknas perfekt och fummel som för färdighetsslag.
- **Tala modersmål räknas som en B-färdighet**, liksom Läsa/Skriva modersmål. Båda skrivs ofta som B-värden i böckerna.

## Skapa rollperson (byggt i steg 3)

- **Bakgrundspoängen** följer Bok I strikt. Det gäller ras, grundegenskaper (krav räknas efter rasmodifikationen), STO, särskild förmåga, svärdshand, socialt stånd, startkapital, ålder och överblivna BP till EP.
- **BP låses när man slagit.** Bakgrundspoängen för ett slag kan inte ändras efter slaget.
- **Särskild förmåga får slås om en gång.** Boken låter spelledaren tillåta omslag om resultatet inte passar.
- **Förmågor som gäller en sekundär färdighet** som inte är yrkesfärdighet ger ett fast FV, som inte kan höjas från start.
- **Tillägg från ras och förmåga** läggs på före köpet och får gå över ålderns högsta FV. Själva köpen får inte gå över det.
- **Tak för köpta värden:**
  - Färdigheter i kategori B kan inte köpas högre än sin grundegenskap. Modersmålen är undantagna.
  - Historia, Alkemi och Kunskap om … kan inte bli högre än Läsa/Skriva.
  - Hypnotisera kan inte bli högre än PSY.
  - Två vapen kan inte bli högre än det lägsta av de två vapnens FV.
- **Magiker får automatiskt** Känna magi (som primär färdighet) och Kunskap om magi med samma FV som magiskolan.
- **Utrustning köps för startkapitalet** till Bok III:s priser. Äventyrets priser och belöningar följer samma nivå: sovsal 10 sm, ringbrynjeskjorta 1 500 sm och uppdraget 500 sm (750 om man prutar upp det).
- **Rustningens abs gäller kroppsdelen som träffas.** Skadan dras både från kroppsdelens KP och från totala KP (steg 4).

## Vapenfärdigheter (husregel)

- **Varje vapengrupp är en färdighet**, inte varje vapen. Exempel på grupper är Enhandssvärd, Enhandsyxor, Bågar och Sköldar.
- **Gruppen avgörs av rollpersonens STY:** svärd, yxor och krossvapen som rollpersonen kan föra med en hand hör till enhandsgruppen, annars till Tvåhandsvapen.
- **Trästav är en egen grupp** (SMI), eftersom den står som en egen färdighet i yrkeslistorna. Dolk i yrkeslistorna betyder gruppen Dolkar.
- **Halva FV i närliggande grupper.** I andra grupper av samma slag får man minst halva FV, avrundat uppåt, från sin bästa grupp. Exempel: Enhandssvärd 15 ger CL 8 med en handyxa. Grupperna är indelade så här:
  - **Enhandsvapen:** Dolkar, Enhandssvärd, Enhands krossvapen, Enhandsyxor och Kättingvapen.
  - **Tvåhands- och stångvapen:** Tvåhandsvapen, Stickvapen, Stångvapen och Trästav.
  - **Avståndsvapen:** Bågar, Armborst, Slunga, Kastvapen och Blåsrör.
  - Sköldar och Piska saknar närliggande grupper.

## Strid (husregler, byggt i steg 4)

- **Start:** striden börjar av sig själv när rollpersonen kommer inom synhåll för en fientlig varelse som ser hen. Den kan också startas med knappen "Till strid" mot fiender som rollpersonen ser.
- **Dra vapen:** när striden börjar slår varje rollperson (huvudpersonen och senare följeslagarna) ett slag i Dra vapen. De som lyckas får en gratis tur innan den första vanliga rundan; är de flera slår de initiativ sinsemellan för den. Därefter slår alla initiativ som vanligt. På sin gratistur kan man göra det man gör på en vanlig tur. Senare ska fler handlingar finnas, till exempel hjälpa en kamrat, använda ett magiskt föremål eller dricka en läkedryck.
- **Initiativ:** alla som deltar, även neutrala, slår 1T10 + SMI (plus modifikationer) varje runda och agerar i den ordningen.
  - Krigare får +5 (Stridsvana), Blixtrande reflexer +3 och tekniken Initiativbonus +5. Snabbslående agerar alltid först.
  - Lika resultat ordnas slumpvis, vilket är detsamma som att slå om.
  - Neutrala står i turordningen men gör ingenting.
- **Turen:** man flyttar högst sin förflyttning och gör sedan en attack.
- **Två vapen:** man slår först ett slag i Två vapen. Lyckas det attackerar man med båda vapnen, annars bara med svärdshanden.
- **Parering:**
  - Man får försvara sig mot varje attack som lyckas. Ett misslyckat anfall behöver inte pareras.
  - En lyckad parering stoppar all skada. Det parerande föremålet kan ändå tappa BV om skadan är högre än dess BV.
  - Efter den första pareringen i en runda får varje ytterligare parering −5, och avdraget växer för varje gång (−5, −10 och så vidare).
  - Har man sköld får man en extra parering med skölden utan avdrag.
  - Med både vapen och sköld används det som ger högst CL.
- **Brytvärde (BV):**
  - Bokens regler gäller: BV kan sjunka när ett anfall pareras.
  - Dessutom är det 2 % chans att vapnet tappar 1 BV varje gång det används.
  - Slitna vapen och sköldar repareras hos en smed för 5 % av priset per återställd BV-poäng. Ett vapen kan bara lagas upp till sitt ursprungliga BV, och aldrig högre än smedens FV i Smide.
- **Rustningens BV** är dubbla abs. Varje träff vars skada överstiger abs drar 1 BV från den träffade delen. Vid BV 0 är delen sönder och skyddar inte förrän den lagas.
- **Skador i kroppsdelar:** för varje kroppsdel utom huvudet som står på 0 KP eller lägre får man −2 på alla färdighetsslag. Mindre skador ger inget avdrag. (Huvudet på 0 KP gör en medvetslös.)
- **Fummel som träffar "närmsta vän"** träffar en följeslagare. Finns ingen följeslagare slås det om.
- **Besegrade fiender dör.** Fångar tas bara om en spelledarperson eller ett uppdrag kräver det.
- **Moral** gäller bara SLP och fiender, aldrig rollpersonen. Slaget är 1T20 mot PSY + modifikationerna, där fler kamrater är bra och fler fiender dåligt. Ett lyckat slag betyder att varelsen står kvar, ett misslyckat att den flyr eller ger upp. En etta lyckas alltid och en tjugo misslyckas alltid.
- **Vanlig strid** (bara totala KP, utan parering) används för djur och monster. Humanoider strider detaljerat med träffområden.

### Tolkningar i striden (steg 4)

Dessa val gjordes när striden byggdes. Vidar har godkänt dem eller ändrat dem till husreglerna ovan.

- **Försvararen parerar automatiskt** med det alternativ som ger högst CL.
- **Djur och monster parerar inte**, men en humanoid får parera deras anfall. Naturliga vapen skadar inte det parerande föremålet.
- **Obeväpnad** kan bara parera obeväpnade anfall (och naturliga vapen). Den som ligger ner kan bara parera med dolk, parerdolk, kortsvärd eller obeväpnad.
- **Räckvidd:** ett närstridsvapen når 1 + vapnets längd rutor.
- **Tvåhandsgrepp:** rollpersonen håller automatiskt ett enhandsvapen med båda händerna när den andra handen är fri, och får då +1T2 i skada. Varelserna gör det inte.
- **Ljus:** rollpersonen bär en fackla. I mörker (grottor) gäller fackelsken −5 för mål inom 4 rutor från rollpersonen och mörker −15 längre bort. Varelser och raser med mörkersyn (dvärg, halvalv, svartalf) får inga avdrag. I mörker är CL alltid minst 1.
- **Riktning:** en figur vänder sig åt det håll den går eller anfaller, och efter sin tur mot närmsta motståndare. Anfall rakt från sidan ger +3 och snett bakifrån eller bakifrån +7.
- **Skador på kroppsdelar:**
  - Bestående skador (brutet ben, förstörd led, avslitna senor) ger sitt avdrag på det som kräver kroppsdelen.
  - Halv förflyttning när ett ben har förlorat hälften av sina KP. Ett ben på 0 KP gör att man står på knä och inte kan förflytta sig.
  - En arm eller ett ben på 0 KP går inte att använda. Ett Svårt PSY-slag avgör om man strider vidare med resten av kroppen; misslyckas det kan man bara krypa resten av striden.
  - Bröstkorg eller mage på 0 KP: man faller ihop och kan bara krypa. Huvudet på 0 KP: medvetslös.
  - 2 KP kvar halverar CL, 1 KP kvar gör att man inte kan använda färdigheter.
- **Kritisk skada** (dubbla kroppsdelens KP): huvudet dödar direkt, bål och mage ger medvetslöshet och död inom FYS rundor, och armar och ben slår på tabellen för kritiska skador (1T10). Bestående skador sparas på rollpersonen.
- **Blödning:** varje kroppsdel på 0 KP blöder 1 KP var sjätte runda tills någon lägger förband (Första hjälpen, en kroppsdel per lyckat slag, kräver två hela armar). Utanför strid räknas varje steg som en runda.
- **Besegrade fiender:** en fiende på 0 KP eller lägre, eller som bara kan krypa, är ur striden. När striden är slut dör de besegrade av sina sår.
- **Rollpersonen medvetslös:** fienderna fortsätter att anfalla (+10 mot orörligt mål). Tar striden slut medan rollpersonen är medvetslös förblöder hen om något blöder, eftersom ingen kan hjälpa. Annars vaknar hen efter 1T4 timmar och ligger sedan så många dygn som behövs för att få positiva KP (1 KP per dygn).
- **Moralslag** slås vid rundans början av varje fiende, en gång per orsak: ledaren har fallit, hälften av gruppen är borta, eller varelsen har förlorat mer än halva sina KP. Hövdingen Grukk lyder inte under moralen (en sådan ledare slåss till slutet). En flyende varelse som försvinner ur sikte lämnar platsen. Blir en humanoid trängd ger den upp och släpper vapnet; ett trängt djur vänder sig till motanfall.
- **Skräck:** bara rollpersonen slår på Skräcktabellen, en gång per varelse när hen först ser den, och en gång till om varelsen aktivt försöker skrämma. Har rollpersonen mött samma sorts varelse förut gäller −2. Bara den högsta modifikationen räknas. Effekter som varar "tills skräckkällan försvinner" upphör när den dör, flyr eller kommer ur sikte.
- **Fummeltabellerna** är skrivna som data med egna ord. Effekter som varar i dagar räknas ned för varje natts vila. "Tills någon masserar dig" upphör vid nästa vila. Kläder som måste rättas till kostar en hel runda (knappen "Rätta till").
- **Kvävning efter fummel:** fummel 19 på närstridstabellen ("sväljer tungan") är en klassiker och står kvar. Man kvävs om ingen hjälper till inom 15 rundor. När det finns följeslagare ska en av dem kunna lägga sin handling på att hjälpa; så länge rollpersonen är ensam dör hen.
- **Tappade föremål** hamnar på marken och plockas upp genom att gå dit. I strid kostar det handlingen. Fiender som dör släpper sina vapen och sköldar.
- **Smeden Ylva** har FV 16 i Smide.
- **Stridskonster och Avväpna** ska diskuteras med Vidar längre fram, innan de byggs.
- **Specialregler** för vapen och situationer läggs till efter hand.

## Tid, läkning och utveckling (byggt i steg 5)

- **Speltid:** klockan börjar dag 1 klockan 08:00. En stridsrunda är fem sekunder, och varje steg utanför strid räknas också som en runda (för blödning och effekter).
- **Naturlig läkning:** 1 KP per dag i varje skadad kroppsdel och i totala KP, i halv takt om man inte vilar. När alla kroppsdelar har läkt återställs totala KP helt, som i Bok II.
- **Läkekonst** kan slås en gång per dag och patient. Lyckas slaget läks 1 KP extra, och en infektion hävs. Gumman Asta har FV 15 i Läkekonst.
- **Medvetslöshet:** den som faller på 0 KP är medvetslös i 1T4 timmar och kan sedan inte göra något förrän totala KP (och huvudets KP) är positiva igen. Det sker genom läkningen ovan.
- **Infektioner** (Bok II): efter en strid slås för varje skadad kroppsdel, 1 % per skadepoäng från eggvapen och 3 % från smutsiga och naturliga vapen. Trubbiga vapen och nävar infekterar inte. Sår under ringbrynja infekteras inte, och alver är immuna. Infektionen varar 1T4 veckor, och kroppsdelen läker inte under tiden. Med 5 % chans blir den kallbrand: en arm eller ett ben amputeras, i huvud, bröstkorg eller mage dör man.
- **Feber (fråga):** boken säger att den infekterade inte kan göra något aktivt. Tills vidare ger infektionen −5 på alla färdighetsslag.
- **Amputation:** FYS sjunker för alltid med kroppsdelens KP, KP räknas om, och det tar fyra veckor att hämta sig. Ett krossat ben (kritisk skada 10) amputeras efter striden.
- **PSY-poäng** återfås med 1 per timmes vila, eller 1 per tre timmar under aktivitet.
- **Erfarenhetspoäng** (Bok I): den första lyckade användningen av en färdighet efter en sömn på minst sex timmar (två för alver) ger 1 EP, ett perfekt slag 1T3+1. Färdigheter i kategori B ger inga EP genom erfarenhet. EP samlas per färdighet.
- **Inväxling:** EP kan bara växlas in efter en sammanhängande vila på minst sju dagar (en veckas vila på värdshuset). Kostnaden följer kostnadstabellen med grundkostnad 2 för primära färdigheter, 3 för yrkesfärdigheter och 5 för sekundära. Sekundära färdigheter och B-färdigheter kan inte bli högre än sin grundegenskap.
- **Bonus-EP:** ett lyckat uppdrag ger 3 bonus-EP som fördelas fritt vid träningen.
- **Ensamträning:** en vecka i taget; ett Normalt grundegenskapsslag ger 1 EP. Kost och logi kostar 70 sm i veckan. Träning med lärare finns inte än.
- **Fobier:** efter en veckas vila slås ett Normalt PSY-slag för varje fobi. Lyckas det blir den ett steg lindrigare.

## Magi

- **Fråga Vidar först.** Vidar har egna husregler för magi som gör att den fungerar rimligare. De som är kända står nedan. Innan resten av magin byggs (steg 6) ska Vidar tillfrågas om det som saknas, till exempel effektgrader, PSY-kostnad och antalet startbesvärjelser, och svaren föras in här.
- **Att lägga en besvärjelse:** man väljer besvärjelse och effektgrad och slår sedan mot sin chans att lyckas i besvärjelsen.
- **Skicklighetsvärde (husregel):** S i en besvärjelse är FV i magiskolan minus besvärjelsens skolvärde, plus baschansen för INT (samma som vanliga färdigheter får av sin grundegenskap). Exempel: Elementarmagi 15 och Eld (skolvärde 6) ger 15 − 6 = 9, och med INT 15 tillkommer +3, alltså S 12.
- **Att lära sig besvärjelser (husregel):** det kostar inga EP. Man hittar en besvärjelse i spelet, memorerar den och kan den sedan. S följer av formeln ovan och växer när FV i skolan stiger.
- **Startbesvärjelser:** en magiker väljer ett antal besvärjelser från början. Antalet bestäms när magin byggs.
- **Magiskolans FV** höjs genom träning med lärare eller genom egna studier i ett magibibliotek.
- **Elementarerna** följer i steg 6 tillsammans med resten av magin.
