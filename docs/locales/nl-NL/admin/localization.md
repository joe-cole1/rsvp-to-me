---
title: Talen en vertalingen bijdragen
description: Persoonlijke taalkeuze, talen van meldingen en vertalingen bijdragen.
category: Configuratie
audience: admin
order: 45
---

# Talen en vertalingen bijdragen {#languages-and-translation-contributions}

## Je taal kiezen {#choosing-your-language}

Gebruik op elke pagina de taalknop (een 文A-pictogram met de code van de huidige taal, zoals NL) rechtsboven, direct naast je profiel. De knop staat ook op de inlogpagina en op toegangsschermen voor evenementen. Je keuze behoudt de huidige URL en ingevulde formuliervelden.

Als je bent ingelogd, wordt de keuze in je account en deze browser opgeslagen. Als je bent uitgelogd, wordt de keuze alleen in de cookie van deze browser bewaard. De browservoorkeur blijft een jaar geldig. Een opgeslagen accountvoorkeur heeft voorrang op de browservoorkeur. Na een geslaagde aanmelding neemt een account zonder opgeslagen voorkeur de uitdrukkelijke browserkeuze over. Een inloglink aanvragen of een aanmelding als gast versturen verandert nooit de taal van een ander account.

Engels is de standaard. Niet-ondersteunde of verwijderde talen vallen terug op Engels. De taalheaders van de browser bepalen de keuze niet automatisch. Titels, beschrijvingen, vragen, namen van gasten, notities en andere zelfgeschreven inhoud blijven ongewijzigd. Datums gebruiken de taal van de bezoeker en de tijdzone van het evenement.

## Talen van e-mail en sms {#email-and-sms-languages}

Standaard systeeme-mails en sms-berichten gebruiken de opgeslagen accounttaal van de ontvanger. Onbekende ontvangers krijgen Engels. Een inlogbericht kan de gekozen taal van de aanvragende browser gebruiken als de ontvanger nog geen taal heeft opgeslagen. Die keuze wordt pas na een geverifieerde aanmelding opgeslagen. Berichten voor het verifiëren van profielcontactgegevens gebruiken de taal van de ingelogde gebruiker. Voorbeelden en testberichten gebruiken de gekozen taal van de beheerder.

Zelfgeschreven berichten van organisatoren en aangepaste e-mailsjablonen van beheerders blijven in elke taal letterlijk behouden. Bestaande vervanging van tijdelijke aanduidingen blijft op aangepaste sjablonen van toepassing. Inkomende sms-opdrachten blijven in elke taal `YES`, `NO` en `MAYBE`.

Herinneringen behouden de bestaande voltooiingsmarkeringen per evenement en type en het bestaande resultaatgedrag van de verzender. Als één taalbatch mislukt nadat een andere is geaccepteerd, kan een nieuwe poging een al geaccepteerde batch herhalen. Lokalisatie garandeert niet dat een bericht precies één keer wordt bezorgd.

## Een taal toevoegen {#adding-a-language}

Vertalingen worden via gewone pull requests beoordeeld. Er is geen uploadfunctie voor vertalingen in de draaiende app en geen externe vertaaldienst.

1. Kies een BCP 47-taalcode, bijvoorbeeld `fr-FR`.
2. Voeg `messages/<locale>.json` toe. Volg de geneste sleutels van `messages/en-US.json`. Een geregistreerde taal moet elke sleutel vertalen: de catalogustests mislukken bij een ontbrekende of onbekende sleutel. Een sleutel die toch ontbreekt, valt tijdens gebruik terug op Engels.
3. Registreer de code in `messages/locales.json` met `nativeName`, `dir` (`ltr` of `rtl`) en een `flag`-pad. Voeg de SVG-vlag toe onder `public/` en gebruik de lokaal gehoste URL. Het register bepaalt de keuzelijst en validatie van ondersteunde talen. Voor een nieuwe taal zijn geen component- of databaseschemawijzigingen nodig. De volgorde van de items in het bestand maakt niet uit: het menu toont altijd eerst Engels en daarna de overige talen alfabetisch op `nativeName`.
4. Gebruik ICU-berichten. Behoud namen van parameters en rich-text-tags exact. Behoud de betekenis, schrijf volledige zinnen, gebruik ICU-meervoudsvormen en neem de verplichte `other`-tak op. Vertaal geen vaste enumwaarden, routepaden, omgevingsvariabelen of opdrachten. Schrijf vóór ICU-syntaxis twee apostroffen als je één letterlijke apostrof wilt tonen.
5. Voeg eventueel volledige hulpartikelen toe zoals hieronder beschreven.
6. Voer `npm test -- tests/lib/i18n* tests/lib/docs.test.ts tests/lib/docs-localization.test.tsx` uit, gevolgd door `npm run test:components -- tests/components/DocsPanel.test.tsx`. Voor de geïntegreerde wijziging blijft de volledige preflight van de repository verplicht.

De namespaces voor e-mail, sms en herinneringen worden alleen op de server gebruikt. Alleen de gekozen UI-catalogus wordt naar de browser gestuurd. Elke taal in `messages/locales.json` wordt met een volledige catalogus geleverd. Een wijziging die Engelse tekst toevoegt, moet dezelfde sleutels daarom aan elke geregistreerde taal toevoegen.

## Hulpartikelen vertalen {#translating-help-articles}

Engelse artikelen in `docs/admin/` en `docs/host/` bepalen de vaste bestandsnamen, volgorde en doelgroep. Voeg een vertaling toe onder `docs/locales/<locale>/<audience>/<same-slug>.md`. Vertaal de titel, beschrijving, categorie en volledige inhoud. Laat een onvoltooid artikel weg, zodat het volledige Engelse artikel verschijnt. Terugvalinhoud behoudt de eigen taal en leesrichting.

Elke vertaalde kop moet eindigen op het bestaande anker van de bijbehorende Engelse kop, bijvoorbeeld `## Inloggen {#signing-in}`. De weergave verbergt die markering en behoudt de vaste ID. Schakel geen ruwe HTML in. Behoud Markdown-linkdoelen en afbeeldingspaden. Vertaalde links moeten ook werken als hun doel terugvalt op Engels. Behoud codeblokken, namen van omgevingsvariabelen, opdrachten, URL’s en zelfgeschreven voorbeelden. Voer de documentatietests uit om vaste koppen, onderlinge links, meegeleverde afbeeldingen en artikelterugval te controleren.

De productie-Dockerfile kopieert de volledige map `docs/`, inclusief taalvarianten. Voor nieuwe talen hoeft de Dockerfile niet te veranderen.
