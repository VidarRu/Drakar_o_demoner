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
- **Skada utan kroppsdel fördelas (Vidar):** skada som bara drabbar totala KP, till exempel BLIXT, ELD, EXPLOSION, fall, gift och snedtändning, fördelas jämnt över alla kroppsdelar i detaljerad strid (`spreadDamage` i `combat.ts`). Det som inte går jämnt ut går till de kroppsdelar som har flest KP kvar (Vidar), och förlorade kroppsdelar räknas inte. En kroppsdel som når 0 går inte att använda som vid en träff, men den blöder inte (Vidar). Blödningen fördelas inte heller (Vidar), eftersom den redan kommer från en kroppsdel. Skadan står alltså kvar tills kroppsdelarna har läkt.

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
- **Fummel som träffar "närmsta vän"** träffar en följeslagare (för en fiende: en annan fiende) inom vapnets räckhåll, intill för sköld och nävar, och i skottlinjen för avståndsvapen. Finns ingen sådan slås det om.
- **Besegrade fiender dör.** Fångar tas bara om en spelledarperson eller ett uppdrag kräver det.
- **Moral** gäller bara SLP, fiender och följeslagare (se steg 7), aldrig rollpersonen. Slaget är 1T20 mot PSY + modifikationerna, där fler kamrater är bra och fler fiender dåligt. Ett lyckat slag betyder att varelsen står kvar, ett misslyckat att den flyr eller ger upp. En etta lyckas alltid och en tjugo misslyckas alltid.
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
  - 2 KP kvar halverar CL, 1 KP kvar gör att man inte kan använda färdigheter och går i halv fart (Vidar, steg 8).
- **Kritisk skada** (dubbla kroppsdelens KP): huvudet dödar direkt, bål och mage ger medvetslöshet och död inom FYS rundor, och armar och ben slår på tabellen för kritiska skador (1T10). Bestående skador sparas på rollpersonen.
- **Blödning:** varje kroppsdel på 0 KP blöder 1 KP var sjätte runda tills någon lägger förband (Första hjälpen, en kroppsdel per lyckat slag, kräver två hela armar). Utanför strid räknas varje steg som en runda.
- **Besegrade fiender:** en fiende på 0 KP eller lägre, eller som bara kan krypa, är ur striden. När striden är slut dör de besegrade av sina sår.
- **Döden (husregel, byggd i steg 8):** gäller rollpersonen och följeslagarna; fiender på 0 KP är ur striden som förut. Kritiska skador fungerar som tidigare.
  - Den som hamnar på 0 KP faller medvetslös och är **döende**: hen förlorar 1 KP per stridsrunda (varje steg utanför strid) och dör vid minus lika mycket som FYS.
  - Blödningen (1 KP var sjätte runda per kroppsdel) räknas inte medan man är döende; förlusten på 1 KP per runda ersätter den.
  - Förlusten upphör när den döende stabiliseras: ett lyckat slag i Första hjälpen från en kamrat intill (det tar handlingen i strid), HELA, en läkeört eller Läkekonst.
  - **Stabilisera sig själv (husregel):** i strid, medan kamraterna är upptagna, slår den döende ett Normalt FYS-slag var tionde runda. Lyckas det är hen stabiliserad.
  - **Stabiliserad, oavsett hur:** all minusskada försvinner och totala KP blir 1. Kroppsdelar under 0 höjs till 0 (de går fortfarande inte att använda), huvudet till minst 1, och all blödning stannar. Hen vaknar direkt, men med 1 KP kan hen inte använda färdigheter och går i halv fart.
  - **Ensam:** står ingen annan i gruppen upp (alla är medvetslösa, utslagna, flydda eller döda) hinner ingen fram, och den döende dör direkt. Inga stabiliseringsslag slås.
  - **Efter striden** försöker kamraterna rädda den döende med Första hjälpen varje runda så länge hen lever. Kan ingen hjälpa dör hen.
- **Rollpersonen medvetslös utan att vara döende** (till exempel av en huvudträff med positiva KP): fienderna fortsätter att anfalla (+10 mot orörligt mål). Tar striden slut medan hen blöder och ingen kan hjälpa förblöder hen. Annars vaknar hen efter 1T4 timmar och ligger sedan så många dygn som behövs för att få positiva KP (1 KP per dygn).
- **Rollpersonens död** avslutar kampanjen. Spelaren får ladda den senaste sparningen.
- **Moralslag** slås vid rundans början av varje fiende, en gång per orsak: ledaren har fallit, hälften av gruppen är borta, eller varelsen har förlorat mer än halva sina KP. Hövdingen Grukk lyder inte under moralen (en sådan ledare slåss till slutet). En flyende varelse som försvinner ur sikte lämnar platsen. Blir en humanoid trängd ger den upp och släpper vapnet; ett trängt djur vänder sig till motanfall.
- **Skräck:** bara rollpersonen och följeslagarna slår på Skräcktabellen (fiender slår moral), en gång per varelse när hen först ser den, och en gång till om varelsen aktivt försöker skrämma. Har rollpersonen mött samma sorts varelse förut gäller −2. Bara den högsta modifikationen räknas. Effekter som varar "tills skräckkällan försvinner" upphör när den dör, flyr eller kommer ur sikte.
- **Fummeltabellerna** är skrivna som data med egna ord. Effekter som varar i dagar räknas ned för varje natts vila. "Tills någon masserar dig" upphör vid nästa vila. Kläder som måste rättas till kostar en hel runda (knappen "Rätta till").
- **Kvävning efter fummel:** fummel 19 på närstridstabellen ("sväljer tungan") är en klassiker och står kvar. Man kvävs om ingen hjälper till inom 15 rundor. En kamrat intill kan lägga sin handling på att hjälpa; ett lyckat slag i Första hjälpen får tungan på plats (tolkning). Den som är ensam dör.
- **Tappade föremål** hamnar på marken och plockas upp genom att gå dit. I strid kostar det handlingen. Fiender som dör släpper sina vapen och sköldar.
- **Smeden Ylva** har FV 16 i Smide.
- **Specialregler** för vapen och situationer läggs till efter hand.

## Tid, läkning och utveckling (byggt i steg 5)

- **Speltid:** klockan börjar dag 1 klockan 08:00. En stridsrunda är fem sekunder, och varje steg utanför strid räknas också som en runda (för blödning och effekter).
- **Naturlig läkning:** 1 KP per dag i varje skadad kroppsdel och i totala KP, i halv takt om man inte vilar. När alla kroppsdelar har läkt återställs totala KP helt, som i Bok II.
- **Läkekonst** kan slås en gång per dag och patient. Lyckas slaget läks 1 KP extra, och en infektion hävs. Gumman Asta har FV 17 i Läkekonst och INT 13, så hon kan undervisa (Vidar, steg 8).
- **Medvetslöshet:** den som faller på 0 KP är medvetslös i 1T4 timmar och kan sedan inte göra något förrän totala KP (och huvudets KP) är positiva igen. Det sker genom läkningen ovan.
- **Infektioner** (Bok II): efter en strid slås för varje skadad kroppsdel, 1 % per skadepoäng från eggvapen och 3 % från smutsiga och naturliga vapen. Trubbiga vapen och nävar infekterar inte. Sår under ringbrynja infekteras inte, och alver är immuna. Infektionen varar 1T4 veckor, och kroppsdelen läker inte under tiden. Med 5 % chans blir den kallbrand: en arm eller ett ben amputeras, i huvud, bröstkorg eller mage dör man.
- **Feber (husregel):** medan infektionen varar är man matt och febrig och får −5 på alla färdighetsslag. (Boken säger att man inte kan göra något aktivt.)
- **Amputation:** FYS sjunker för alltid med kroppsdelens KP, KP räknas om, och det tar fyra veckor att hämta sig. Ett krossat ben (kritisk skada 10) amputeras efter striden.
- **PSY-poäng** återfås med 1 per timmes vila, eller 1 per tre timmar under aktivitet.
- **Erfarenhetspoäng** (Bok I): den första lyckade användningen av en färdighet efter en sömn på minst sex timmar (två för alver) ger 1 EP, ett perfekt slag 1T3+1. Färdigheter i kategori B ger inga EP genom erfarenhet. EP samlas per färdighet.
- **Inväxling:** EP kan bara växlas in efter en sammanhängande vila på minst sju dagar (en veckas vila på värdshuset). Kostnaden följer kostnadstabellen med grundkostnad 2 för primära färdigheter, 3 för yrkesfärdigheter och 5 för sekundära. Sekundära färdigheter och B-färdigheter kan inte bli högre än sin grundegenskap.
- **Bonus-EP:** ett lyckat uppdrag ger bonus-EP som fördelas fritt vid träningen. Modulen bestämmer hur många; Gråvads uppdrag ger 3 (steg 8).
- **Fler sätt att få erfarenhet:** böcker, arbete, lärare och modulernas belöningar (beslutat i steg 8, se Utveckling mellan äventyren).
- **Ensamträning:** en vecka i taget; ett Normalt grundegenskapsslag ger 1 EP. Kost och logi kostar 70 sm i veckan. Träning med lärare byggdes i steg 8.
- **Fobier:** efter en veckas vila slås ett Normalt PSY-slag för varje fobi. Lyckas det blir den ett steg lindrigare.

## Magi (byggt i steg 6)

Vidar svarade på frågorna om magin i steg 6. Husreglerna markeras som husregel; resten följer Bok III.

- **Att lägga en besvärjelse:** man väljer besvärjelse och effektgrad (E) och slår sedan mot sin chans att lyckas. Alla besvärjelser bygger på PSY.
- **Skicklighetsvärde (husregel):** S i en besvärjelse är FV i magiskolan minus besvärjelsens skolvärde, plus baschansen för INT (samma som vanliga färdigheter får av sin grundegenskap). Exempel: Elementarmagi 15 och Eld (skolvärde 6) ger 15 − 6 = 9, och med INT 15 tillkommer +3, alltså S 12. Allmänna besvärjelser räknas mot den skola man har högst FV i.
- **Effektgrad (husregel):** högsta E är FV i skolan. CL minskar med 1 (inte 2 som i boken) för varje E utöver den första. Extra E kan läggas på räckvidd eller varaktighet; de räknas in i CL, PSY och högsta E.
- **PSY:** varje E kostar 1 PSY. Misslyckas besvärjelsen går 1 PSY åt; ett perfekt slag kostar hälften (avrundat nedåt, minst 1); ett fummel kostar allt. Når PSY 0 dör magikern, som i boken. Spelet låter inte magikern lägga en besvärjelse som skulle ta hen till 0, utom som självmordsattack.
- **Självmordsattack:** som i boken. Magikern kan spendera sina kvarvarande PSY plus halva sin PSY, CL blir S oavsett E, och magikern dör efteråt.
- **Snedtändning (husregel):** ett fummel slår 1T20 på Snedtändningstabellen utan att lägga till E. Tabellen står med egna ord i `src/engine/rules/magic.ts`. Tolkningar: vid hjärnskada faller lika många besvärjelser ur minnet (de finns kvar i formelsamlingen); vid total minnesförlust kan man inte använda färdigheter eller magi under tiden.
- **Startbesvärjelser (husregel):** en ny magiker väljer (INT + PSY) / 4 besvärjelser, avrundat nedåt, ur sin skola och de allmänna, med skolvärde högst FV i skolan. De kostar inga EP. Guiden köper inte längre S med EP.
- **Att lära sig besvärjelser (husregel):** det kostar inga EP. Man hittar en besvärjelse i spelet och skriver in den i formelsamlingen (`learnSpell`). Det kräver FV i skolan minst skolvärdet. S växer när FV i skolan stiger.
- **Minnet och formelsamlingen:** som i boken. Man har högst (INT + PSY) / 4 besvärjelser i minnet, och högst FV i skolan från varje skola; en ritual tar tre platser. Att memorera tar 20 minuter per skolvärdespoäng (en timme för ritualer) och kräver lugn och ro. Startbesvärjelserna ligger i minnet. Besvärjelser som inte är i minnet läses ur formelsamlingen: en kvick tar 1T6 SR och en vanlig 1T6 minuter, så i strid går bara kvicka. Blir magikern medvetslös glömmer hen allt i minnet om ett Normalt PSY-slag misslyckas.
- **Tid i strid:** att lägga en besvärjelse tar hela turen, och man får inte ha flyttat sig. Kvicka besvärjelser verkar direkt. Andra verkar i början av nästa runda (magi går före slagväxling). Blir magikern skadad innan dess bryts koncentrationen: 1 PSY går åt och inget händer.
- **Järn:** som i boken. Metallrustning, ett vapen av järn i handen eller mer än 0,5 kg järn i packningen hindrar magin. Vidar har godkänt att trästav, klubbor, piska, slungor, blåsrör och bågar inte är av järn. **Alla sköldar har metallbeslag och räknas som järn (Vidar):** en sköld i handen hindrar magin, och en sköld i packningen räknas in i järnets vikt. Järnföremålen i utrustningslistan står i `IRON_ITEMS`.
- **Magiskt motstånd:** besvärjelser som påverkar psyket (KÄNNA FIENDSKAP, KÄNSLOLÄSNING) måste övervinna målets PSY med magikerns kvarvarande PSY på motståndstabellen. Fysiska besvärjelser (F) och besvärjelser på föremål gör inte det.
- **Besvärjelser som verkar i spelet:** BLIXT, ELD, FROST, ENERGISTRÅLE, EXPLOSION, ELCHOCK, KALLA HANDEN, KNÄCKA, SKÖLD, FÖRTROLLA VAPEN, FÖRBANNA VAPEN, ÖRTRANKOR, HELA, NEUTRALISERA GIFT, SKYDD, LÄDERHUD, MÖRKERSYN, ORÄDD, SKINGRA, KÄNNA FIENDSKAP och KÄNSLOLÄSNING. De andra kan läras men inte läggas än. Vidar har godkänt tolkningarna nedan:
  - BLIXT träffar ett mål som magikern väljer (Vidar), som andra besvärjelser.
  - ELD och FROST drar skadan från totala KP, och rustningen på bröstkorgen tar emot den som i boken. Bara en sfär används. Skadan fördelas sedan över kroppsdelarna (se Strid).
  - EXPLOSION gör full skada inom E meter (E / 1,5 rutor, avrundat nedåt; E1 träffar bara mittrutan) och 1 mindre per ruta längre bort, även på magikern. Alla som ser den bländas nästa runda (räknas som mörker).
  - SKÖLD parerar nästa fysiska anfall, även en pil, fram till slutet av nästa runda.
  - KNÄCKA tar skölden om målet har en, annars vapnet.
  - LÄDERHUD ger +2 i absorbering; KAR −2 räknas inte än.
- **Magiskolans FV** höjs bara genom träning med lärare eller egna studier i ett magibibliotek (se Utveckling mellan äventyren). EP i skolan växlas in som andra EP.

## Avståndsstrid (byggt i steg 6)

Reglerna följer Bok II s. 16–17 och Bok III s. 33 och 38.

- **Att skjuta eller kasta** tar hela turen, och man måste stå still. Det måste finnas minst en ruta mellan skytten och målet. En ruta är 1,5 meter, så räckvidden i rutor är meter / 1,5; kastvapen når STY rutor.
- **Modifikationer:** −5 mellan halva och tre fjärdedels räckvidd, −10 längre bort; +10 mot orörligt mål; −5 för att sikta på en kroppsdel; ljus och mörker som i närstrid. Ett mål som springer halverar CL (avrundat uppåt) före de andra modifikationerna. Tolkning: målet springer om det flyttade mer än halva sin förflyttning under sin senaste tur.
- **Träffområde** slås på avståndstabellen.
- **Parering:** projektiler kan inte pareras. Kastvapen kan pareras med sköld av den som ser kastet (inte bakifrån).
- **Sköldar och projektiler:** träffar projektilen en kroppsdel som skölden täcker, och skytten inte står bakom, tar skölden träffen. Skölden tappar BV om skadan är högre än dess BV.
- **Skada:** kastvapen får skadebonus, projektilvapen inte.
- **Laddning:** stavslungan, armborsten och arbalesten måste laddas om efter varje skott (1, 3, 6 och 12 SR). Att ladda tar hela turen. Efter striden är vapnet laddat.
- **Ammunition:** pilar, armborstlod och arbalestlod förbrukas och köps tio i taget. Slungan klarar sig med stenar men får +2 med slungkulor. Hälften av det som sköts hittas igen efter striden (Vidar har godkänt).
- **Någon i vägen:** står någon i skottlinjen träffas hen i stället med 50 % chans (bokens riktvärde).
- **Miss:** projektilen fortsätter 50 % längre än avståndet till målet (inom räckvidden) och kan träffa någon i banan, 1 % per STO-poäng. Kastvapen hamnar där de landar och plockas upp genom att gå dit.
- **Söka skydd:** rollpersonen kan lägga sin tur på att söka skydd när en fiende med avståndsvapen deltar. Normalt SMI-slag. Med ett hinder intill dras differensvärdet från skyttarnas CL resten av rundan; annars kastar hen sig ned och får −1 per ruta till skytten. Varelserna söker inte skydd än.
- **Blåsrör** gör ingen skada. Pilen tränger in om 1T8 är högre än rustningens abs, och då verkar giftet på den.
- **Fummel** slås på fummeltabellen för avståndsvapen. "Närmsta vän" slås om så länge det inte finns följeslagare.
- **Varelser med avståndsvapen** skjuter på håll så länge de har ammunition och slåss med sitt närstridsvapen när man är intill dem. Svartalfsskytten i grottan har en kortbåge och åtta pilar.

## Bärförmåga och handel (byggt i steg 6)

- **Bördan** räknas som i Bok III: allt i packningen, halva vikten för rustning man bär, inga kläder, och 200 mynt per kg. Rustningsvikterna justeras efter kroppsbyggnaden. Avdraget gäller förflyttning, SMI (och därmed initiativet) och SMI-baserade färdigheter, men aldrig under 1. Över STY × 5 går inga SMI-färdigheter, och över STY × 6 kan man inte röra sig.
- **Byta vapen** i strid tar handlingen men inte förflyttningen. Rustning byts bara utanför strid. Ett projektilvapen kräver båda händerna, så skölden läggs undan. Slitage (BV) följer med föremålet när det läggs i packningen.
- **Handlare:** Bertil säljer mat, kläder och utrustning, Ylva vapen, ammunition, rustningar och sköldar, och Asta läkeörter och allmänna droger. Priserna följer Bok III.
- **Köpslå** (Bok I): en gång per handlare och dag, FV mot handlarens FV på motståndstabellen. Vinner rollpersonen blir priserna differensvärdet × 5 % bättre den dagen. Rabatten blir högst 50 % (Vidar har godkänt).
- **Sälja (Vidar):** handlaren köper det hen själv säljer, för en fjärdedel av listpriset, och Köpslå höjer det med samma procent.

## Örter och gifter (byggt i steg 6)

Alla droger i Bok II finns som data i `src/data/herbs.ts`, med egna beskrivningar.

- **Pris och lager:** priset är vanligheten upphöjd till tre. En handlare har drogen inne om 1T10 blir högre än vanligheten; lagret slås om varje dag.
- **Beredning:** är 2 × vanligheten högre än FV hos den som bereder drogen slås ett dolt slag. Misslyckat ger en verkningslös drog, fummel en skadlig (gifter blir verkningslösa) och perfekt en dubbelt så bra. Asta bereder det hon säljer med Örtkunskap 15. Tolkning: en skadlig läkedrog gör 1T6 i skada.
- **Leta örter:** en dag (tio timmar) med Örtkunskap, CL = FV − vanligheten men minst 1. Lyckat ger 1T4 doser och perfekt 4T4; ett "särskilt slag" finns inte i spelet. Bara läkeörter som växer i trakten går att hitta; allmänna droger och gifter kräver ett laboratorium. Lönnmördare drar 10 från vanligheten för extremt okända droger.
- **Använda en drog** tar handlingen i strid. Läkedroger som läker efter en stund verkar när tiden har gått. Droger vars verkan spelet inte känner till (t.ex. benbrott, sträckningar, brännskador) beskrivs men gör inget än.
- **Gifter genom sår** stryks på vapnet, vilket tar en timme, och verkar vid nästa träff som ger skada.
- **Gifternas verkan** följer Bok II: FYS mot giftets STY på motståndstabellen ger lindrig, måttlig, allvarlig eller dödlig verkan, och stadierna kommer efter (20 − STY) SR, minuter, timmar och dygn. Varje dygn slås FYS mot STY igen, och lyckas det sjunker STY med 1. Vid 0 är giftet borta och dess tillfälliga verkan försvinner. Tolkningar:
  - Avdragen på SMI, INT, PSY och STY gäller färdigheter som bygger på grundegenskapen.
  - Muskelgiftets timslag (spasmer) slås inte.
  - Blodgiftets "1 KP per minut tills koma" räknas som medvetslöshet direkt.
  - Medvetslös av gift ligger rollpersonen tills giftet är borta, och tiden går under tiden.
  - Gifter med egen verkan (t.ex. jägarbane, kråkmossa, krigarfasa) verkar om motståndsslaget misslyckas, när den lindriga verkan skulle ha börjat.
- **Motgift och NEUTRALISERA GIFT** sänker giftets STY; örtugsblomma häver ismossans gift helt.

## Följeslagare (byggt i steg 7)

Vidar bestämde upplägget i steg 7 och godkände efteråt tolkningarna i avsnitten om följeslagare, smygarläge, Avväpna, Fasthållning, stridskonster och elementarer (de är markerade som tolkning för att visa att de inte står i böckerna). Undantagen är elementarernas styrning och döden, som han ändrade i steg 8; se respektive punkt.

- **Gruppen** är rollpersonen och upp till fem följeslagare, alltså högst sex. Följeslagarna har ett eget rollformulär med samma regler som rollpersonen (skapade med Bok I:s regler), och de följer med mellan äventyren. Varje äventyrsmodul har egna personer som kan värvas.
- **Spelaren styr varje följeslagare** på dennes tur i strid, precis som rollpersonen. Utanför strid går de i ett led efter rollpersonen; den som inte kan gå bärs av de andra (tolkning).
- **I Gråvad** finns tre som kan följa med:
  - Legoknekten Hjalmar (krigare) tar 20 silvermynt om dagen. Lönen för den första dagen betalas när han går med, och sedan dras den från rollpersonens silver varje ny dag. Kan rollpersonen inte betala går han.
  - Jägarinnan Sigrid (utbygdsjägare) tar en lika stor del av silvret som hittas hos besegrade fiender. Belöningar från uppdrag delas inte (tolkning).
  - Bybon Linnea (helare, Astas lärling) följer med gratis för att hämnas sin far.
- **Moral:** Sigrid och Linnea slår moralslag som fiender gör (när rollpersonen faller, när hälften av gruppen är borta och när de förlorat mer än halva KP). Hjalmar slår bara när rollpersonen faller. Den som flyr vägrar fortsätta och går hem när striden är slut. Den som lämnat gruppen vill inte gå med igen samma dag (tolkning).
- **Rollpersonens död** avslutar äventyret, även om följeslagare lever (Vidar har godkänt det). En fallen följeslagares ägodelar blir kvar på platsen, och rollpersonen tar hand om hens silver.
- **Följeslagarna är rollpersoner** i reglerna (tolkning): de slår Dra vapen och på Skräcktabellen, får EP, läker, får infektioner och tränar för sig. Bonus-EP från uppdraget ges till var och en. Sovsalen kostar en säng per person.
- **Hjälpa en kamrat:** den som står intill kan lägga förband (Första hjälpen), hjälpa den som kvävs, resa upp den som ligger, ge en läkeört och utanför strid använda Läkekonst. I strid tar det handlingen.
- **Efter striden** lägger kamraterna förband på dem som ligger medvetslösa och blöder: ett slag i Första hjälpen per runda och hjälpare, i högst 20 rundor, medan blödningen fortsätter (tolkning). Den som blöder när ingen kan hjälpa dör, som tidigare.
- **Samtal** förs av rollpersonen, och det är rollpersonen som betalar (tolkning).

## Smygarläge och anfall bakifrån (byggt i steg 7)

- **Smygarläge (husregel):** den som smyger slår Smyga varje runda (varje steg utanför strid) som en fiende skulle kunna se hen. Lyckas slaget förblir hen oupptäckt, och fienderna ser hen inte. Misslyckas det är hen upptäckt och slutar smyga. Var och en i gruppen slår för sig; den som inte smyger syns som vanligt.
- **Modifikationer:** tänd fackla i mörker −10, dagsljus inom halva fiendens synhåll −5. Rustning som klirrar halverar Smyga (regeln från steg 4); inget annat avdrag för rustning. Man smyger i halv fart i strid (Bok I). Den som redan är upptäckt i strid kan inte börja smyga så länge en fiende ser hen (tolkning).
- **Facklan** kan släckas och tändas. Den som släcker sin fackla strider själv i mörker (−15) om ingen annans fackla lyser på målet och hen saknar mörkersyn.
- **Anfall från smygarläge** följer Bok II s. 21: anfallaren slår Smyga, och lyckas det slår försvararen Upptäcka fara med anfallarens differensvärde som avdrag. Misslyckas försvararen får hen inte parera. Det gäller från alla håll, inte bara bakifrån (tolkning), och +7 bakifrån och +3 från sidan gäller som vanligt. Anfallet avslöjar den som smög.

## Avväpna, Fasthållning och stridskonster (byggt i steg 7)

- **Avväpna (husregel):** anfallet kan inte pareras och gör ingen skada. Går det in slår man Avväpna, och lyckas det ställs STY + FV i Avväpna mot försvararens STY på motståndstabellen. Vapnet hamnar 1T3+1 meter bort, i spelet 1–3 rutor (1T3). Det krävs ett vapen eller en käpp i handen.
- **Fasthållning** (Bok II s. 21): ett anfall med CL (STO + SMI + STY) / 3 som kan pareras. Går det in ställs STY mot STY. Varje runda slår den som håller ett nytt motståndsslag på sin tur; misslyckas det kommer den andra loss. Ingen av dem kan göra något annat (den som håller kan släppa taget), och den som hålls fast räknas som orörligt mål för andra (+10) (tolkning).
- **Stridskonster:** alla tekniker som går att använda i strid finns. De kräver tomma händer, ingen sköld och högst läderrustning (tyg eller läder). Normalt slag och normal spark använder det bästa av Stridskonster och Slagsmål. Tolkningar:
  - Hoppspark och dubbelspark kräver att man flyttat minst en ruta först (ansatsen), når två rutor och träffar huvud eller bröst. Går sparken inte in slår man ett Normalt SMI-slag: lyckat ger en förlorad nästa runda, misslyckat att man ligger. Båda ger −2 på nästa initiativ, liksom rundsparken.
  - Rundspark som missar: ingen handling eller parering nästa runda.
  - Dubbelslag och dubbelspark tar den andra motståndaren automatiskt (närmast intill), om det finns någon.
  - Bakåtspark når bara rutan rakt bakom.
  - Bedövningsslag: gör det skada slår offret ett Svårt FYS-slag eller misslyckas med sin nästa attack eller parering.
  - Lågt kast fäller offret i sin ruta i 1T2 SR. Högt kast kastar offret 1T3 rutor och det slår ett Svårt SMI-slag eller tar 1T3 i skada. Båda kan pareras. Högt kast görs direkt, inte sist i rundan.
  - Låsning drar ned och låser offret. Offret tar sig loss på sin tur med halva SMI mot anfallarens FV på motståndstabellen.
  - Fint slås samtidigt som anfallet; lyckas den halveras motståndarens parering.
  - Avväpning är en obeväpnad parering mot vapen. Lyckas den parerar anfallaren avväpningen med sitt vapen, och misslyckas det flyger vapnet 1T3 rutor. Vid ett perfekt slag (och inget perfekt anfall) tar försvararen vapnet.
  - Obeväpnad parering av vapen, Liggande strid, Blind strid, Initiativbonus och Stålsättning är alltid påkopplade (Stålsättning slås automatiskt vid skada utom mot huvudet). Vidvinkelsyn (270°) flyttar varje riktning ett steg framåt: anfall från sidan ger inget, och anfall bakifrån och snett bakifrån ger bara +3.
  - Uppresning slås automatiskt när man fällts. Fallteknik är en handling, Rulla: lyckas slaget får man rulla upp till 5 rutor och kan inte huggas med närstridsvapen förrän sin nästa tur; misslyckas det blir man liggande. Fallskada finns inte i spelet.

## Elementarer (byggt i steg 7)

Reglerna följer Bok III s. 21–22 och 27. Alla åtta sorterna finns, var och en som en egen besvärjelse (FRAMMANA SYLF och så vidare) med skolvärde 9.

- **Att frammana:** man väljer sig själv som mål. Att välja en elementar av samma sort skickar bort den (E mot elementarens grad på motståndstabellen). SKINGRA kan också förstöra en elementar.
- **Grundegenskaper** som i boken: PSY 3T6, SMI 3T6, STO 1T6, och +1T6 STO och +1T6 PSY för varje E utöver den första. KP och STY är STO. Elementaren saknar FYS och INT och är immun mot gift. Den varar S × 1 SR.
- **Att styra elementaren (Vidar, byggt i steg 8):** att styra elementaren kostar ingen handling. Magikern kan agera som vanligt medan elementaren finns, till exempel parera och lägga nya besvärjelser. Spelaren styr elementaren på dess egen tur. Effekten `styr` finns kvar bara som markering. Magikern kan bara styra en åt gången. Blir magikern medvetslös eller dör försvinner elementaren. Den kan också släppas.
- **Bara i strid:** elementarer frammanas i strid och återvänder till sitt element när striden är slut (Vidar har godkänt det).
- **Elementet (tolkning):** luft finns överallt, jord under bar mark, eld och värme ur en tänd fackla intill magikern, vatten ur dammen inom tio rutor, mörker i grottan eller på natten, ljus i dagsljus eller ur en fackla. Fruset finns inte i Gråvad, så glacialen kan inte frammanas där.
- **Anfall:** gnomen 1T4 per grad med CL 6 + 2 per grad, glacialen och thermen 1T4 per grad med CL 8 + E. Boken anger ingen CL för salamandern (1T6 per grad) och undinen (1T8 per SR); de får 8 + E (tolkning). Alla anfall har vapenlängd 0 och strider som djur, utan träffområden.
- **Materiella vapen:** sylf, umbra och luminal skadas inte; thermen bara av magiska vapen (FÖRTROLLA VAPEN), och vanliga vapen tappar 1 BV; undinen tar halv skada. Vapen som träffar salamandern tar 1T6 per grad, och de som träffar gnomen tar lika mycket skada som de gjorde om anfallaren inte klarar PSY × 5 på 1T100. Skada på vapen räknas som vid parering: överstiger den BV tappar vapnet 1 BV (tolkning). Järnvapen som träffar glacialen rostar och tappar 1 BV.
- **Eld och köld:** umbran och glacialen tar dubbel skada av ELD, luminalen och thermen är immuna mot den. Glacialen är immun mot FROST och KALLA HANDEN, och thermen tar dubbel skada av dem.
- **Särskilda handlingar** (tar elementarens tur):
  - Sylfen blåser omkull någon intill (STO mot STO) och styr nästa skott åt en kamrat: +1 på CL och +1T3 i skada per grad.
  - Salamandern hettar upp en kamrats metallvapen (+1T6 i lika många SR som graden, men vapnet tar 1T6 per grad) och läker sig ur en tänd fackla (1T6 per grad).
  - Umbran sveper in någon i skräck: PSY mot PSY. En rollperson slår på Skräcktabellen med graden som skräckvärde; en fiende slår moral (tolkning). Inom fem rutor per grad slutar facklorna lysa och mörkersyn fungerar inte.
  - Luminalen lyser upp fem rutor per grad och kan blända fienderna som ser den (Normalt PSY-slag, Svårt för varelser med mörkersyn), i 2T6 SR. Gruppen vet vad som kommer och bländas inte (tolkning).
  - Glacialen och thermen kyler eller värmer ett metallvapen: +1T4 per grad i 1T4+5 SR, och 5 % per grad att vapnet splittras eller smälter vid första träffen. Alla levande inom två rutor slår ett Svårt FYS-slag varje runda eller står och flämtar, även gruppen.
  - Elementarer kan förinta varandra enligt listorna i boken (grad mot grad).
- **Undinen** rör sig tio rutor per SR i vatten, men vattnet går inte att beträda i spelet, så den rör sig en ruta per SR på land (tolkning). Gnomens malmsökande, sylfens bärförmåga och glacialens och thermens tunnlar används inte än.

## Äventyrsmoduler (beslutat i steg 8)

Byggt: modulformatet, uppdragsloggen, epilogen, utgångarna och skärmen mellan äventyren. Inte byggt än: världskartan, stridskartorna, resekartan och slumpmötena.


- **En modul per mapp:** varje äventyrsmodul ligger i en egen mapp under `src/content/` och innehåller allt om äventyret: kartor, personer, varelser, uppdrag, de som kan värvas och anteckningarna till språkmodellen.
- **Gråvad blir speltestmodulen,** en övningsmodul som inte behöver ingå i kampanjen. Den har bara en mötesplatskarta och ingen världskarta; alla andra moduler har samma upplägg med världskarta. Vägen vid västra kanten blir modulens utgång.
- **Kartor:** varje modul har en världskarta och flera mötesplatskartor (till exempel en by eller en grotta). Båda är rutnät ovanifrån.
  - På världskartan rör sig gruppen mellan områden, och en ruta motsvarar normalt en timme (modulen kan ange något annat). Gruppen syns som en figur.
  - Fiender syns där som en ikon. De vandrar runt och jagar gruppen när de ser den. Gruppen kan smyga även på världskartan för att försöka ta sig förbi.
  - Går gruppen ihop med en fiende börjar ett stridsmöte på en färdig stridskarta som väljs efter terrängen (till exempel skog, slätt eller väg). Stridskartan är tillfällig och bara för striden. När striden är slut kommer gruppen tillbaka ut på världskartan.
  - På en mötesplats går man in genom att kliva på dess ikon på världskartan och ut genom en utgång. Det man har gjort där ligger kvar: döda fiender är borta och plockade föremål är tagna.
  - Det skiljer sig från att gå in på en mötesplatskarta, som en grotta, där man rör sig och strider som i Gråvad i dag.
- **Uppdrag:** varje modul har ett huvuduppdrag och kan ha flera sidouppdrag. Gränssnittet har en uppdragslogg.
- **Slutet på en modul:** när huvuduppdraget är klart visas en kort epilog med knapparna "Avsluta äventyret" och "Stanna kvar". Den som stannar kan göra klart sidouppdrag och lämna senare genom en utgång. Världskartan har en eller flera utgångar där man kan lämna modulen. Är huvuduppdraget inte klart frågar spelet om man verkligen vill lämna; det är också ett sätt att fly när det går illa.
- **Fristående eller kampanj:** modulerna ska kunna spelas fristående. I kampanjen finns en resekarta utan rutnät, där varje modul är en klickbar ikon (till exempel en stads siluett) som förstoras när man klickar, så att man kan välja äventyret. Kampanjen har en övergripande berättelse, men man väljer själv i vilken ordning modulerna spelas. Man kan återvända till en modul, men det som redan är spelat finns inte kvar att göra.
- **Det som följer med mellan modulerna:** gruppen och rollformulären, packningen, pengarna, speltiden och skadorna. Val i en modul ska kunna märkas längre fram, till exempel ryktet.
- **Svårighetsgrad:** systemet har inga nivåer, så varje modul får en rekommenderad svårighetsgrad: lätt, medel eller svår. Den är bara en rekommendation; fienderna anpassas inte efter gruppen.
- **Gruppen följer med:** man tar med sin rollperson och grupp från modul till modul, så att det blir ett sammanhängande spel.
- **Resor mellan modulerna** tar tid. Det bestäms senare, tillsammans med en stor världskarta där modulerna ligger.
- **Sparning:** i dag finns en sparplats i webbläsaren. Senare kan kampanjen sparas på en server (till exempel Supabase).
- **Innehållet:** Vidar laddar upp äldre äventyr som skrevs till rollspelet, och modulerna byggs utifrån dem (med egna ord, som allt annat).
- **Slumpmöten i vildmarken** ska finnas. Tabellerna saknas och tas fram senare.

## Utveckling mellan äventyren (beslutat i steg 8)

Vidar bestämde upplägget i steg 8 efter Bok I s. 62–64 (Hur man blir bättre) och Bok III s. 7
(Att bli bättre i magi). Det som står som tolkning har Vidar godkänt i efterhand.

### Erfarenhetspoäng

- **Alla EP är lika värda (Vidar):** EP från träning och från erfarenhet blandas, och alla växlas in efter en sammanhängande vila på sju dagar. Bok I:s tak (träning når inte över grundegenskapen för primära färdigheter och yrkesfärdigheter) används inte.
- **Bonus-EP sätts per modul (Vidar):** varje uppdrag ger 1–4 bonus-EP, varje ovanligt svår gärning 1–2, och modulen kan ge rollspelsbonus för val i spelet, till exempel en särskilt bra lösning på ett uppdrag. Bokens bonus för gott rollspel (1–4 som spelledaren bedömer) används inte, och det finns ingen övre gräns per äventyr. Alla i gruppen får hela summan när flaggan sätts. Gråvads uppdrag ger 3 bonus-EP som förut.
- **Böcker (Vidar):** böcker hittas ganska ofta i modulerna. En bok har ett ämne (en färdighet) och ett tak, oftast 5 eller 10 EP per läsare. En veckas studier med boken är ensamträning i ämnet.
  - **Läsnivå (Vidar):** en bok kräver B1–B5 i Läsa/Skriva efter hur mycket den kan ge: högst 3 EP B1, högst 5 EP B2, högst 10 EP B3, högst 15 EP B4 och mer B5. En modul kan ange en annan nivå för en bok. Magiska skrifter (bibliotekets skrifter och alla kodexar) kräver B4, som magiska pergament i Bok III.
  - **Språk:** en bok kan vara skriven på ett visst språk, och då krävs läsnivån i det språket. Utan angivet språk räcker modersmålet. Vilka språk böckerna har bestäms senare.
- **Arbete (Vidar):** mellan äventyren kan man arbeta i sitt yrke en vecka i taget. Man får lön och deltidstränar fyra timmar om dagen i en av sina yrkesfärdigheter. Det ger ett träningsslag varannan vecka (Bok I: halva tiden tar dubbelt så lång tid). Dagslönerna utgår från Bok III (arbetare 10 sm, skrivare 50 sm, lärare 150 sm) och står i `WORK_WAGES` i `src/engine/rules/tables.ts` (Vidar har godkänt dem). Man arbetar sex dagar i veckan.

### Veckorna

- **Veckoplanen (Vidar):** mellan äventyren, och i en modul efter en veckas vila på värdshuset, planeras en vecka i taget. Var och en i gruppen väljer en sysselsättning: vila, ensamträning, träning med lärare, studier i biblioteket, läsa en bok eller arbeta. Stadens lärare och biblioteket finns i en meny tills det blir en stadskarta.
- **Kostnaderna (tolkning):** kost och logi kostar 70 sm i veckan per person, som tidigare. Rollpersonen betalar för hela gruppen och får lönen från arbetet, som en gemensam kassa, på samma sätt som rollpersonen betalar i samtal.
- **Veckan räknas som vila:** den läker och fyller på PSY som vila, och den räknas in i de sju dagarna som krävs för att växla in EP (tolkning).

### Träning med lärare

- **Läraren** behöver FV 17 eller mer i färdigheten och INT 13 eller mer. FV måste vara mer än 3 högre än elevens (Bok I).
- **Slagen:** eleven slår två Normala grundegenskapsslag i veckan för färdighetens grundegenskap, och varje lyckat slag ger 1 EP. Varje FV som läraren har över 18 ger +1. En ensam elev får +5 (Vidar: boken skriver CL −5, men ensamundervisningen kostar tre gånger så mycket).
- **Kostnaden** är 150 sm i veckan. Undervisning i magi (magiskolor och besvärjelser) kostar 300 sm. Det blir 1,5 gånger så mycket om eleven är av en annan ras än läraren, och tre gånger så mycket för en ensam elev. Flera i gruppen som tränar samma färdighet för samma lärare samma vecka är inte ensamma elever, och var och en betalar sin del (tolkning).
- **Följeslagare som lärare (Vidar):** den i gruppen som uppfyller lärarkraven kan lära de andra, utan kostnad. Läraren hinner också med en egen sysselsättning samma vecka (Vidar).
- **Lärare i modulerna (Vidar):** personer i modulerna kan undervisa i det de kan (`NpcDef.teaches`). Deras FV och INT kommer från varelsedefinitionen, så kraven gäller också dem.
- **Stadens lärare (Vidar):** mellan äventyren finns lärare med FV 18 och INT 14 i alla färdigheter, och en magiker med FV 18 i alla magiskolor. I kampanjen ska det gå att hitta unika, mycket skickliga lärare i modulerna och locka dem att flytta till staden; det byggs med kampanjspelet.

### Magi

- **Magiskolor (Vidar, Bok III):** de höjs bara genom träning med lärare eller genom ensamstudier i en magiakademis bibliotek, aldrig genom erfarenhet eller vanlig ensamträning. I biblioteket ger ett Normalt INT-slag i veckan 1 EP i skolan.
- **Medlemskap i akademin (Vidar):** biblioteket är gratis för medlemmar. Man blir medlem genom ett uppdrag i en modul eller för 1 000 sm. Tolkning: medlemskapet gäller en person.
- **Läsa i biblioteket (Vidar):** bibliotekets skrifter kräver B4 i Läsa/Skriva, både för studier i magiskolan och för kodexarna.
- **Nya besvärjelser (Vidar):** husregeln från steg 6 står kvar, så besvärjelser kostar inga EP och S följer FV i skolan. Man lär sig en besvärjelse på tre sätt:
  - Man hittar den i spelet och skriver in den som förut.
  - Man studerar den ur en magisk kodex. Ett Normalt INT-slag i veckan med −1 för varje poäng INT under 19 (Bok III); lyckas det skrivs besvärjelsen in. Tolkning: biblioteket har en kodex för varje besvärjelse, och en kodex som man hittar kan studeras var som helst.
  - En lärare lär ut den på en vecka. Läraren måste ha FV i skolan minst lika med besvärjelsens skolvärde.
  - I alla tre fallen måste eleven ha FV i skolan minst lika med skolvärdet.

### Hjältepoäng

- **Dåd (Vidar):** modulerna bestämmer vilka dåd som ger hjältepoäng. Vidar vill hellre ge små belöningar ofta än stora sällan. Dåliga handlingar kan ge minuspoäng (Bok I). Bokens tabell är en riktlinje.
- **FV 21, 41, 61 (Bok I):** att nå ett sådant värde i en färdighet ger 1T4 HP.
- **Gruppen (Vidar):** alla i gruppen som är med får hela summan var.
- **Höja CL (Bok I):** knappen "Hjältepoäng" laddar nästa egna slag (färdighetsslag, anfall, parering, skott eller besvärjelse). Ett fummel blir misslyckat, ett misslyckat slag lyckat, ett lyckat perfekt, och ett perfekt slag ger tillbaka hjältepoängen. Poängen dras när slaget slås.
- **Särskild förmåga (husregel):** mellan äventyren köper man ett slag på tabellen över särskilda förmågor: 3 HP för 2T20 + 20, 6 HP för 2T20 + 30 och 10 HP för 2T20 + 40. Får man en förmåga man redan har, tar man närmaste rad uppåt som man inte har. Höjd grundegenskap (81+) kan tas flera gånger. Förmågor som bara passar magiker byts som när rollpersonen skapas.
- **Grundegenskaper (Bok I):** mellan äventyren höjer 5 HP en grundegenskap med 1, men inte STO. Tolkning: om baschansen ändras läggs ändringen på primära färdigheter och yrkesfärdigheter som bygger på grundegenskapen. KP, förflyttning och skadebonus räknas om.
- **Igenkänd (Vidar):** första gången rollpersonen talar med en person slås 1T100 mot summan av alla HP hen har fått. Är slaget lika med eller under summan känner personen igen hjälten. Då sätts modulens flagga `igenkand_<person>`, och AI-spelledaren får veta det. Modulerna kan använda flaggan till särskilda möten.

### PSY-höjning (Bok I)

- **Vunnen PSY-kamp (Vidar):** man har vunnit en PSY-kamp om man motstår en fientlig magikers besvärjelse, eller om man slår på Skräcktabellen och blir oberörd eller helt oberörd. En magiker vinner också när hen övervinner en fiendes motstånd mot en besvärjelse (Bok I).
- **Slaget** slås när äventyret är slut (när modulen lämnas), ett slag per person och äventyr, för den som har vunnit en kamp:
  - För en magiker lyckas 1T20 på 25 − PSY eller lägre och ger +1 PSY. En etta ger 1T3+1. Över PSY 24 krävs en etta för +1, och två ettor i rad ger 1T3+1.
  - För de andra lyckas 1T20 på 20 − PSY eller lägre och ger +1. En etta ger 1T3+1, och över PSY 19 ger bara en etta +1.
  - **Vilken regel (Vidar):** den som kan magi (har FV i en magiskola) slår med 25 − PSY, och den som inte kan magi med 20 − PSY. Det spelar ingen roll hur kampen vanns.
- God PSY-potential ger −5 på slaget, och ett resultat på 0 eller lägre räknas som 1.

## Förmågor, besvärjelser och väder (beslutat efter steg 8)

Vidar godkände förslagen i `docs/forslag-magi-och-formagor.md` den 23 november 2026. Där står vad
varje besvärjelse och förmåga ska göra. Besluten flyttas hit allteftersom de byggs.

### Beslut

- **Fiendernas magi (Vidar):** fienderna följer exakt samma magiregler som gruppen. En svartalfisk häxkonstnär kommer in i Gråvads grotta som provfiende.
- **Alla besvärjelser ska verka (Vidar),** enligt förslaget och i den ordning som står där.
- **ÖKA och MINSKA (Vidar):** STO och FYS ändrar KP medan besvärjelsen varar. Förlorade KP står kvar när den tar slut.
- **Turgubbe (Vidar):** högst +3 på ett och samma slag, för 1 PSY per poäng.
- **Gudarnas gunstling (Vidar):** gäller en gång per äventyr.
- **Den andra handen (Vidar):** ger avdrag för den som inte är dubbelhänt eller ambidextriös. Avdraget hämtas ur Bok I när det byggs.
- **FÖRÄNDRA (Vidar):** ett järnvapen kan förvandlas till ett trävapen.

### Förmågor med regelvärden (byggt)

- **Passiva värden:** de särskilda förmågorna och yrkesförmågorna har sina regelvärden som `passive` i `src/data/abilities.ts` och `src/data/professions.ts`. `passivesOf`, `passive`, `passiveCl` och `weaponCl` i `src/engine/hero.ts` räknar ihop dem. Varelser utan rollformulär har inga förmågor.
- **Tillägg på CL i färdigheter** (Starka nypor, Övertygande tonfall, Stirrande blick, Magikänsla, Mycket uppmärksam) räknas in i `skillMod`, alltså i alla färdighetsslag utanför anfall och parering. Mycket uppmärksam gäller också Upptäcka fara när någon smyger fram till anfall. Magikänsla gäller Känna magi i alla skolor.
- **Precisionssinne (tolkning):** +1 på CL vid anfall med vapen, i närstrid och på avstånd. Inte på parering och inte med naturliga vapen.
- **Baneman:** +5 på CL vid anfall mot det valda folkslaget. Valet görs ur en lista med raserna och de legendariska varelserna (`FOLK_LIST`). Varelserna i modulerna anger sitt folkslag med `CreatureDef.folk` (svartalfsskytten och Grukk är svartalfer); utan det används varelsens id om det finns i regeldatan, och personer räknas som människor. Äldre val i fritext jämförs med början av ordet, så "orcher" träffar orcher.
- **Extremt orädd och Snusförnuft (tolkning):** −5 på slaget på Skräcktabellen. Förmågan hör till personen och räknas utöver den högsta modifikationen, som annars är den enda som gäller.
- **Orubblig vilja:** +5 på PSY när någon gör motstånd mot en besvärjelse och mot umbrans skräck.
- **Härdig mot element och Härdad av havet:** +5 på FYS mot KALLA HANDEN och mot glacialens och thermens köld och hetta. Härdad av havet gäller också STO och STY, men inget sådant slag finns i spelet än.
- **Kluven personlighet** ger den andra yrkesförmågans värden (`professionsOf`), till exempel krigarens Stridsvana.

### Förmågor som används i spel (byggt)

Regelvärdena står i `ABILITY_RULES` i `src/engine/rules/tables.ts`, och det mesta av koden i
`src/engine/talents.ts`. Vidar godkände tolkningarna den 26 november 2026.

- **God bågskytt:** räckvidden för projektilvapen (bågar, armborst, slungor och blåsrör) gångras med 1,25 och avrundas nedåt till hela rutor. Kastvapen räknas inte.
- **Järnnäve:** obeväpnade anfall gör alltid högsta skada, med SB.
- **Snabb uppfattning:** +5 på CL vid parering i närstrid, med vapen och sköld. Den som ser skytten kan parera pilar och lod med ett närstridsvapen (inte med skölden), och kastvapen med vapnet eller skölden. Ett perfekt skott kan inte pareras.
- **Djurvän:** vanliga djur (gruppen djur i regeldatan, inte de legendariska varelserna) väljer inte personen som mål och upptäcker inte gruppen för hens skull. Den som anfaller djuret, med vapen, skott eller skadlig magi, är inte fredad av det djuret längre (`Actor.provokedBy`).
- **Gott läkekött (Vidar):** all naturlig läkning går dubbelt så fort. Spelet skiljer inte på skador av våld och av annat, och nästan alla skador kommer från vapen eller elementarbesvärjelser.
- **God mental kontroll:** PSY-poängen kommer tillbaka dubbelt så fort.
- **Turgubbe (Vidar):** knappen köper +1 på CL för 1 PSY på nästa egna slag, högst +3. Ett tryck till efter taket stänger av den. PSY dras när slaget slås.
- **Tjuvtur:** samma knapp, 1–3 PSY, två gånger mellan varje sömn (fyra för alver). Sömnen återställer den.
- **Turen läggs på efter tärningen (Vidar):** tillägget räknas in i `heroic`, som alla slag går igenom. Bara slag 2–19 kan gå från misslyckat till lyckat; omslagen för perfekt och fummel räknas inte om. Turen kan inte ta PSY till 0, och den läggs på före en hjältepoäng.
- **Gudarnas gunstling (Vidar):** när KP når 0 slås 1T100, och på 25 eller lägre kommer alla KP tillbaka (också i kroppsdelarna). Kritiska skador, förlorade kroppsdelar och blödningar står kvar. Det slås varje gång KP når 0, tills guden har räddat personen en gång under äventyret; det börjar om när modulen lämnas.
- **Riddarslag:** ett anfallssätt för riddare med ett närstridsvapen, för 5 PSY. Med sikte på en kroppsdel blir det inget avdrag för siktet; utan sikte gör anfallet högsta skada med högsta SB. Rustning och parering gäller som vanligt. PSY dras även om anfallet missar (Vidar).
- **Anfall bakifrån (lönnmördare):** gäller när offret inte märker anfallaren som smyger fram (Smyga lyckas och Upptäcka fara misslyckas). Ett misslyckat anfall gör normal skada, ett lyckat dubbel och ett perfekt fyrdubbel, alltid utan SB. Ett fummel är ett fummel. Bara mot humanoider och inte med stridskonsternas slag och grepp. **Storleken (Vidar):** "högst 2 m längre" blir att offret har högst 10 STO mer än lönnmördaren.
- **Handpåläggning (helare):** en hjälphandling på den som helaren kan röra vid, också på sig själv.
  - Läka: 1 KP för 1 PSY. I strid läker varje tur 1 KP; utanför strid läker helaren så mycket som PSY räcker till, och lika många rundor går.
  - Bota gift: PSY/2 mot det starkaste giftets STY på motståndstabellen, för lika många PSY som STY.
  - Bota en infektion (Vidar): infektionerna och deras feber räknas som sjukdom med svårighetsgraden 10, och det kostar 10 PSY.
  - PSY dras också när det misslyckas (Vidar), och får inte gå ned till 0.
- **Meditation (munk, husregel av Vidar):** bokens Meditation används inte. Munken mediterar i en minut och slår ett Normalt PSY-slag. Lyckas det får munken +5 på INT-baserade färdigheter i en timme. Bara utanför strid.
- **Förtrollande framträdande (bard, Vidar):** barden sjunger eller spelar i en minut och slår i Sjunga eller Spela instrument. Lyckas det får barden +5 på KAR-baserade färdigheter (Övertala, Muta, Bluffa, Köpslå och de andra) i en timme, och AI-spelledaren får veta att åhörarna är förtrollade. Bara utanför strid. Ett misslyckat försök kostar minuten, och det går att försöka igen.
- **God kroppskontroll:** en handling med ett Normalt FYS-slag. Lyckas det får personen +5 STY i tre rundor, och det räknas in i skadebonusen, i greppet om tunga vapen och i STY mot STY. Två försök om dagen; ett misslyckat försök räknas också (Vidar).

### Fiendernas magi (byggt)

- **Bara med FV i skolan (Vidar):** ingen kan lära sig en besvärjelse utan FV i magiskolan, varken rollpersonen, följeslagare eller personer i modulerna. Alla sätt att lära sig (när rollpersonen skapas, lärare, bibliotek, kodex och `learnSpell`) kräver FV i skolan minst lika högt som besvärjelsens skolvärde, och `tests/data.test.ts` prövar att varelser och följeslagare i modulerna följer det.
- **Samma regler för alla (Vidar):** `castSpell`, `castProblem` och `spellTargets` i `src/engine/magic.ts` tar magikern som argument (`CastOptions.caster`). Fienden har FV i sina skolor, S per besvärjelse, PSY-poäng, högsta E, järnregeln, snedtändning och bruten koncentration som gruppen.
- **Data:** en varelse får magi med `CreatureDef.magic` (FV per skola och besvärjelserna). Besvärjelserna står i `Actor.spells` och räknas alla som memorerade. PSY-poängen är varelsens PSY.
- **Fiendens val** (`enemyCast`), i den här ordningen:
  1. HELA på en vän med hälften av KP eller mindre, också sig själv.
  2. Skydd: SKYDD, LÄDERHUD och FÖRTROLLA VAPEN när de inte redan verkar, och SKÖLD en gång per strid när någon står intill.
  3. En skadebesvärjelse (skada, köld, rankor) mot den närmaste som syns, när ingen står intill.
  4. Annars närstrid eller skott som förut.
- **Effektgraden (tolkning):** fienden väljer så hög E att CL blir minst 8, högst E3 för skada och E2 för skydd, och alltid med 2 PSY kvar efteråt (en E1 och aldrig PSY 0).
- **Fienderna går bara på gruppen** med magi, som i närstrid. Den som är osynlig eller smyger oupptäckt kan de inte välja.
- **Spelaren ser det komma:** en besvärjelse som inte är kvick står i loggen som "börjar mana … mot …" och verkar i början av nästa runda, om ingen hinner skada magikern innan.
- **Häxkonstnären i Gråvad:** en svartalfisk häxkonstnär (INT 14, PSY 16, Elementarmagi 14, Animism 16) med BLIXT, SKÖLD och HELA och en trästav står vid Grukk i grottan.

### Besvärjelser i strid (byggt)

Koden står i `apply` i `src/engine/magic.ts`, och det som striden behöver i `src/engine/spelleffects.ts`.

- **ÖKA och MINSKA (Vidar och tolkning):**
  - Magikern väljer grundegenskap (STY, FYS, STO, KAR eller SMI), och den ändras med 1 per E så länge besvärjelsen varar. MINSKA sänker inte under 1.
  - STO och FYS ändrar KP (Vidar): KP och KP i kroppsdelarna ändras lika mycket som maxvärdet, så förlorade KP står kvar när besvärjelsen tar slut.
  - SB följer STY, och förflyttningen räknas om.
  - Tolkning: baschansen ändras för alla färdigheter som bygger på grundegenskapen.
  - Tolkning: ovilliga mål gör inte motstånd, eftersom besvärjelsen inte påverkar psyket. Samma besvärjelse på samma grundegenskap ersätter den gamla.
- **FLAMMANDE HAND:** 1T3 per E i extra skada med händerna och med vapen som hålls i handen, inte med skott och naturliga vapen.
- **VIRVELSKÖLD:** alla skott och kast till och från magikern missar. Ammunitionen går åt.
- **MOTSTÅNDSKRAFT:** 1 mindre skada per E och angrepp från ELD, FROST, salamandern, thermen och glacialen, och från vapen som en elementar har hettat upp eller kylt ned.
- **ANTIMAGI:**
  - En besvärjelse som riktas mot någon annan med ANTIMAGI slår sin E mot ANTIMAGIs E på motståndstabellen. Misslyckas det studsar den tillbaka på magikern.
  - Tolkning: EXPLOSION, MÖRKER och elementarerna påverkas inte, eftersom de inte riktas mot målet.
- **LJUS:** målet lyser som en fackla, två rutor (tre meter) per E. Det räknas som fackelsken.
- **MÖRKER:**
  - En sfär med två rutors radie kring målets ruta (`GameState.zones`). Rutorna räknas som mörker också utomhus, och facklor där inne lyser inte.
  - Tolkning: mörkersyn fungerar, eftersom den ser värme. I umbrans mörker fungerar den inte.
- **MAGISK SYN:** ser den som är osynlig (men inte den som smyger) och bländas inte av EXPLOSION eller luminalen.
- **OSYNLIGHET:**
  - Kräver 1 E per 6 STO. Den osynlige räknas som oupptäckt: fienderna kan inte välja hen som mål.
  - Den bryts när hen anfaller, skjuter, lägger magi, springer (mer än halva förflyttningen) eller skadas.
  - Tolkning: den som anfaller osynlig behöver inte slå Smyga, men försvararen slår Upptäcka fara. Misslyckas det är försvararen omedveten, som vid anfall från smygarläge.
- **KAMOUFLAGE:** bara utomhus (gräs och stig). Magikern är oupptäckt tills hen lämnar rutan, anfaller, skjuter, lägger magi eller skadas.
- **VINDPIL (Vidar):** 1T10 + 1 per E i skada. Pilen skjuts direkt när besvärjelsen lyckas och träffar en kroppsdel efter avståndstabellen. Rustningen skyddar, och VIRVELSKÖLD stöter bort den.
- **ASTRALVAPEN (Vidar):**
  - Ett eggvapen av magisk energi i magikerns hand: 1T10 som enhandsvapen och 2T10 som tvåhandsvapen (Vidar).
  - FV är magikerns S när besvärjelsen läggs, och skadebonus läggs till.
  - "En E per kg": ett enhandsvapen kräver E2 och ett tvåhandsvapen E4.
  - Vapnet tar platsen av det magikern håller i handen så länge det varar, går inte sönder och räknas som magiskt vapen, så det biter på elementarer som bara skadas av magi. Det räknas inte som järn.
- **Kvar:**
  - NEDKALLA ÅSKVIGG behöver vädret.
  - KONTROLLERA PERSON, KONTROLLERA VARELSE, SPRÅNG, LEVITATION, FLYGA, LYFT, TELEPORTERA, DIMMA och BESKYDDARE väntar på att byggas.

### Vädret (Vidar)

Vädret byggs i steg 7 i förslagets ordning. Upplägget:

- **Två mätare** med fem steg var:
  - Himlen: klart, halvklart, mulet, regn, åska.
  - Vinden: stiltje, svag vind, frisk vind, hård vind, storm.
- **Ändras en gång per halvdygn** (tolkning: klockan sex och arton). Varje mätare kan gå ett steg upp, ett steg ned eller stå kvar.
- **Ytterlägena är mindre sannolika.** Förslag på chanser (tolkning, 1T6 för varje mätare):
  - På mittsteget (mulet, frisk vind): ned på 1–2, kvar på 3–4, upp på 5–6.
  - Ett steg från ytterläget (halvklart, regn, svag vind, hård vind): mot ytterläget bara på 6, mot mitten på 1–2, kvar på 3–5.
  - I ytterläget (klart, åska, stiltje, storm): tillbaka på 1–3, kvar på 4–6.
- **Modulerna** kan ange vädret vid start eller låsa det. Inomhus och i grottor märks det inte.
- **Verkan:** regn släcker facklor utomhus, ger −2 på avståndsstrid och gör att FINNA VATTEN inte fungerar. Vinden påverkar skott och båtar; värdena bestäms när det byggs. Väderbesvärjelserna (VINDKONTROLL, REGNKONTROLL, NEDKALLA ÅSKVIGG och VIGGFÅNGARE) flyttar mätarna eller kräver ett visst väder.

