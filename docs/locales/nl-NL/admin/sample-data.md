---
title: Voorbeeldgegevens en schermafbeeldingen
description: Aangemaakte testaccounts, inloggen in ontwikkelmodus en checklist voor desktopschermafbeeldingen.
category: Aan de slag
audience: admin
order: 16
---

# Voorbeeldgegevens en schermafbeeldingen {#sample-data-and-screenshots}

Gebruik de bestaande voorbeeldgegevens om een lokale testinstallatie te verkennen en schermafbeeldingen van gevulde pagina’s te maken. Deze handleiding gaat uit van een bestaande testinstallatie. Gebruik de [installatiehandleiding](installation.md) voor een normale installatie.

## Voorbeeldgegevens laden {#load-the-sample-data}

Het seedscript maakt drie accounts voor organisatoren, 20 voorbeeldgasten en 10 evenementen met verschillende thema’s en scenario’s voor gastenbeheer. De gegevens bevatten aanmeldingen, vragenlijsten, peilingen, toezeggingen op de meeneemlijst, reacties en check-ins.

| Account           | Rol                                   | Gebruik                                                                                                                   |
| ----------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `host@test.com`   | Organisator, met de naam Primary Host | Beheert de voorbeeldactiviteiten; gebruik dit account voor schermafbeeldingen van het dashboard, gastenbeheer en thema’s. |
| `cohost@test.com` | Organisator                           | Mede-organisator van geselecteerde voorbeeldactiviteiten.                                                                 |
| `admin@test.com`  | Beheerder                             | Om de beheertools te verkennen.                                                                                           |

Zowel broncode- als release-installaties gebruiken `SEED_TEST_DATA` uit `.env`; de standaard is `false`. Met `false` of zonder deze instelling schrijft het seedcommando niets. Productie gebruikt `/setup` om het eerste beheerdersaccount te verifiëren, zonder voorbeeldgegevens of uitnodigingscode. Bestaande thema-aanpassingen blijven behouden. Voorbeeldgegevens worden alleen geladen als er nog geen evenementen zijn.

Voer het seedscript expliciet uit in een reeds draaiende testcontainer die vanuit de broncode is gebouwd met:

```bash
docker compose -f docker-compose.yml exec -e SEED_TEST_DATA=true app npm run db:seed
```

Gebruik de Compose-bestandskeuze die bij je daadwerkelijke testomgeving hoort. Een expliciete `-f docker-compose.yml` selecteert de containerstack zonder automatisch de WSL-override van de maintainer te laden. Gebruik je een native ontwikkelomgeving, voer dan `SEED_TEST_DATA=true npm run db:seed` uit vanuit de repository.

Als er al evenementen bestaan, slaat het script de voorbeeldgegevens over. Het opnieuw uitvoeren ververst geen evenementdatums en maakt ontbrekende voorbeeldaccounts niet opnieuw aan. Behoud bestaande gegevens en gebruik een aparte testdatabase als je een schone dataset nodig hebt.

## Inloggen op de testinstallatie {#sign-in-to-the-test-instance}

Logregistratie voor ontwikkeling vereist dat `NODE_ENV` niet op `production` staat. **De gepubliceerde image en de Dockerfile van de repository draaien in productiemodus**, ook als er voorbeeldgegevens zijn geladen. Deze containers vereisen werkende e-mailbezorging; `SEED_TEST_DATA=true` schakelt het loggen van inloglinks niet in. Gebruik een lokale ontwikkelapp voor de werkwijze met testaccounts en voorbeeldgegevens. Zie [E-mail instellen](email.md#what-happens-without-email-configured) voor het verschil.

Voor een **ontwikkelapp in Docker** vraag je een inloglink aan voor `host@test.com` en lees je vervolgens de logboeken van de app-container:

```bash
docker compose -f docker-compose.yml logs --since 10m app
```

Zoek naar `[auth:magic-link-fallback] Magic link for host@test.com is:` en open de link op een machine die het lokale app-adres kan bereiken. Links verlopen na 15 minuten en kunnen maar één keer worden gebruikt. De link wordt aangemaakt bij het inloggen; het is geen vaste inlogcode die in de seedgegevens staat.

Gebruik je de optionele [native WSL-werkwijze](local-development.md), lees dan de terminal waarin `npm run dev` draait in plaats van de Docker-logboeken.

## Checklist voor desktopschermafbeeldingen {#desktop-screenshot-checklist}

Gebruik `host@test.com` en de voorbeeldgegevens voor evenementen en gasten. Kies een gepubliceerd evenement met een starttijd in de toekomst en een open aanmeldvenster, zodat gasten de aanmeldknoppen zien. De voorbeelddatums zijn relatief aan het moment waarop de gegevens voor het eerst zijn aangemaakt; verplaats een voorbeeldactiviteit via de bediening voor organisatoren als dat nodig is. Voeg omslagafbeeldingen toe voordat je de gastenpagina en het dashboard vastlegt, omdat het seedscript geen omslagfoto’s uploadt.

Vervang `<slug>` hieronder door de slug van het evenement. De seed bevat bijvoorbeeld `/e/launch-party-celebration`.

| Schermafbeelding             | Pagina en toestand                                           | Wat erop moet staan                                                                                                                    | Locatie in de documentatie                                                                                                                                       |
| ---------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Evenementpagina voor gasten  | `/e/<slug>?preview=1`                                        | Omslagafbeelding, thema, titel, datum/locatie en aanmeldknoppen. De voorbeeldmodus verbergt de bewerkingsbediening voor organisatoren. | Hoofd-README, evenementpagina voor gasten                                                                                                                        |
| Dashboard voor organisatoren | `/dashboard`, ingelogd als organisator                       | Drie of vier voorbeeldkaarten met omslagafbeeldingen, aanwezigheidsaantallen en navigatie.                                             | Hoofd-README, dashboard voor organisatoren                                                                                                                       |
| Gastenbeheer                 | `/e/<slug>/guests`, ingelogd als organisator                 | Aanwezigheidsoverzicht, filters, meerdere voorbeeldgasten en check-inbediening.                                                        | [Handleiding voor gastenbeheer](https://github.com/joe-cole1/rsvp-to-me/blob/main/docs/host/guest-list.md#guest-management-preview)                              |
| Thema aanpassen              | `/e/<slug>/settings?section=theme`, ingelogd als organisator | Thema’s en aanpassingsbediening.                                                                                                       | [Handleiding voor het aanpassen van de pagina](https://github.com/joe-cole1/rsvp-to-me/blob/main/docs/host/customizing-your-page.md#theme-customization-preview) |

Maak PNG-bestanden op normale browserzoom, met menu’s gesloten en zonder de browserranden. Een desktopvenster van ongeveer 1440 × 1000 is een goed startpunt. Zorg dat de smalle inhoudskolom van het evenement leesbaar blijft in plaats van een lange schermopname helemaal te verkleinen. Alle vier documentatieschermafbeeldingen zijn desktopweergaven.

De huidige schermafbeeldingen staan in `public/docs/images/`: `event-guest-view.png`, `host-dashboard.png`, `guest-management.png` en `theme-customization.png`. Vervang bij het bijwerken de bijbehorende afbeelding en controleer de alternatieve tekst en het bijschrift. Houd Markdown-afbeeldingspaden relatief aan het document, zodat ze op GitHub werken. De documentatieweergave in de app zet paden onder `public/docs/images/` om naar de lokaal geserveerde URL’s onder `/docs/images/`. Controleer beide weergaven voordat je een update samenvoegt.
