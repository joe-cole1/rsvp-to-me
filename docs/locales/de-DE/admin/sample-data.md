---
title: Beispieldaten und Screenshots
description: Vorbereitete Testkonten, Anmelden in der Entwicklung und eine Checkliste für Desktop-Screenshots.
category: Erste Schritte
audience: admin
order: 16
---

# Beispieldaten und Screenshots {#sample-data-and-screenshots}

Nutze die vorhandenen Beispieldaten, um eine lokale Testinstallation zu erkunden und Screenshots gefüllter Seiten aufzunehmen. Dieser Leitfaden setzt eine bestehende Testumgebung voraus; für eine normale Bereitstellung nutze die [Installationsanleitung](installation.md).

## Beispieldaten laden {#load-the-sample-data}

Das Seed-Skript erstellt drei Veranstalterkonten, 20 Beispielgäste und 10 Veranstaltungen mit unterschiedlichen Designs und Szenarien zur Gästeverwaltung. Enthalten sind Zusagen, Fragebögen, Umfragen, Einträge in Mitbringlisten, Kommentare und Check-ins.

| Konto             | Rolle                                   | Verwendung                                                                                                          |
| ----------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `host@test.com`   | Veranstalter mit dem Namen Primary Host | Besitzt die Beispielveranstaltungen; nutze dieses Konto für Screenshots von Dashboard, Gästeverwaltung und Designs. |
| `cohost@test.com` | Veranstalter                            | Mitveranstalter ausgewählter Beispielveranstaltungen.                                                               |
| `admin@test.com`  | Administrator                           | Zum Erkunden der Administrationswerkzeuge.                                                                          |

Sowohl Quellcode- als auch Release-Installationen übernehmen `SEED_TEST_DATA` aus `.env`; der Standard ist `false`. Mit `false` oder ohne diese Einstellung schreibt der Seed-Befehl nichts. Die Produktion verwendet `/setup`, um das erste Administratorkonto ohne Beispieldaten oder Einladungscode zu bestätigen. Vorhandene Theme-Anpassungen bleiben erhalten. Beispieldaten werden nur geladen, wenn noch keine Veranstaltungen vorhanden sind.

So führst du das Seed-Skript ausdrücklich in einem bereits laufenden, aus dem Quellcode gebauten Testcontainer aus:

```bash
docker compose -f docker-compose.yml exec -e SEED_TEST_DATA=true app npm run db:seed
```

Verwende die Compose-Dateiauswahl für deine tatsächliche Testumgebung. Ein ausdrückliches `-f docker-compose.yml` wählt den Container-Stack, ohne automatisch die WSL-Überlagerung des Maintainers zu laden. Führe in einer nativen Entwicklungsumgebung stattdessen `SEED_TEST_DATA=true npm run db:seed` im Repository aus.

Falls bereits Veranstaltungen existieren, überspringt das Skript die Beispieldaten. Erneutes Ausführen aktualisiert weder Veranstaltungsdaten noch erstellt es fehlende Beispielkonten neu. Behalte vorhandene Daten und nutze eine separate Testdatenbank, wenn du einen frischen Datensatz brauchst.

## Bei der Testinstallation anmelden {#sign-in-to-the-test-instance}

Die Protokollierung für die Entwicklung setzt voraus, dass `NODE_ENV` einen anderen Wert als `production` hat. **Das veröffentlichte Image und die Dockerfile des Repositorys laufen im Produktionsmodus**, auch mit geladenen Beispieldaten. Diese Container benötigen eine funktionierende E-Mail-Zustellung; `SEED_TEST_DATA=true` aktiviert keine Protokollierung von Anmeldelinks. Nutze für den Ablauf mit vorbereiteten Testkonten eine lokale Entwicklungs-App. Den Unterschied erklärt [E-Mail einrichten](email.md#what-happens-without-email-configured).

Fordere für eine **Entwicklungs-App in Docker** einen Anmeldelink für `host@test.com` an und lies anschließend die Protokolle des App-Containers:

```bash
docker compose -f docker-compose.yml logs --since 10m app
```

Suche nach `[auth:magic-link-fallback] Magic link for host@test.com is:` und öffne den Link auf einem Rechner, der die URL deiner lokalen App erreichen kann. Links laufen nach 15 Minuten ab und können einmal verwendet werden. Der Link wird beim Anmelden erzeugt; er ist keine feste Zugangsinformation in den Beispieldaten.

Lies beim optionalen [nativen WSL-Ablauf](local-development.md) statt der Docker-Protokolle das Terminal, in dem `npm run dev` läuft.

## Checkliste für Desktop-Screenshots {#desktop-screenshot-checklist}

Nutze `host@test.com` und die Beispielangaben zu Veranstaltungen und Gästen. Wähle eine veröffentlichte Veranstaltung mit zukünftigem Beginn und offenem Zusagezeitraum, damit Gäste die Antwortmöglichkeiten sehen. Die Beispieldaten richten sich nach dem Zeitpunkt ihrer ersten Erstellung; verschiebe eine Beispielveranstaltung bei Bedarf über ihre Veranstalter-Steuerelemente. Füge vor Aufnahmen der Gästeseite und des Dashboards Titelbilder hinzu, da das Seed-Skript keine Titelbilder hochlädt.

Ersetze unten `<slug>` durch den URL-Slug der Veranstaltung. Die Beispieldaten enthalten etwa `/e/launch-party-celebration`.

| Screenshot                    | Seite und Zustand                                               | Sichtbarer Inhalt                                                                                                                         | Dokumentationsstelle                                                                                                                               |
| ----------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Veranstaltungsseite für Gäste | `/e/<slug>?preview=1`                                           | Titelbild, Design, Titel, Datum/Ort und Antwortmöglichkeiten. Der Vorschaumodus blendet die Bearbeitungsfunktionen des Veranstalters aus. | Haupt-README, Veranstaltungsseite für Gäste                                                                                                        |
| Veranstalter-Dashboard        | `/dashboard`, als Veranstalter angemeldet                       | Drei oder vier Beispielveranstaltungskarten mit Titelbildern, Teilnehmerzahlen und Navigation.                                            | Haupt-README, Veranstalter-Dashboard                                                                                                               |
| Gästeverwaltung               | `/e/<slug>/guests`, als Veranstalter angemeldet                 | Teilnahmeübersicht, Filter, mehrere Beispielgäste und Check-in-Funktionen.                                                                | [Leitfaden zur Gästeliste](https://github.com/joe-cole1/rsvp-to-me/blob/main/docs/host/guest-list.md#guest-management-preview)                     |
| Design anpassen               | `/e/<slug>/settings?section=theme`, als Veranstalter angemeldet | Designvorlagen und Anpassungsfunktionen.                                                                                                  | [Leitfaden zur Seitengestaltung](https://github.com/joe-cole1/rsvp-to-me/blob/main/docs/host/customizing-your-page.md#theme-customization-preview) |

Erstelle PNGs mit normalem Browserzoom, geschlossenen Menüs und ohne Browserrahmen. Ein Desktop-Ansichtsbereich von etwa 1440 × 1000 ist ein guter Ausgangspunkt. Halte die schmale Inhaltsspalte der Veranstaltung lesbar, statt eine lange Ganzseitenaufnahme zu verkleinern. Alle vier Dokumentations-Screenshots zeigen Desktopansichten.

Die aktuellen Screenshots liegen in `public/docs/images/`: `event-guest-view.png`, `host-dashboard.png`, `guest-management.png` und `theme-customization.png`. Ersetze beim Aktualisieren das passende Bild und prüfe Alternativtext und Bildunterschrift. Halte Markdown-Bildpfade relativ zum Dokument, damit sie auf GitHub funktionieren. Die Leitfadenanzeige in der App ordnet Pfade unter `public/docs/images/` den lokal bereitgestellten URLs unter `/docs/images/` zu. Prüfe beide Ansichten, bevor du eine Aktualisierung zusammenführst.
