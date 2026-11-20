---
title: Sprachen und Übersetzungen beitragen
description: Persönliche Spracheinstellungen, Sprachen für Benachrichtigungen und Übersetzungsbeiträge.
category: Konfiguration
audience: admin
order: 45
---

# Sprachen und Übersetzungen beitragen {#languages-and-translation-contributions}

## Deine Sprache wählen {#choosing-your-language}

Nutze auf jeder Seite die Sprachschaltfläche (ein 文A-Symbol mit dem aktuellen Sprachkürzel, z. B. DE) oben rechts direkt neben deinem Profil, auch beim Anmelden und auf den Zugangsseiten für Veranstaltungen. Deine Auswahl erhält die aktuelle URL und bereits ausgefüllte Formularfelder.

Wenn du angemeldet bist, wird die Einstellung in deinem Konto und diesem Browser gespeichert. Wenn du abgemeldet bist, wird sie nur im Cookie dieses Browsers gespeichert. Die Browserpräferenz gilt ein Jahr. Eine gespeicherte Kontopräferenz hat Vorrang vor der Browserpräferenz. Nach erfolgreichem Anmelden übernimmt ein Konto ohne gespeicherte Präferenz die ausdrücklich gewählte Browsersprache. Das Anfordern eines Anmeldelinks oder das Absenden einer Gastzusage ändert niemals die Sprache eines anderen Kontos.

Englisch ist die Standardsprache. Deutsch ist im Sprachmenü als **Deutsch** verfügbar. Nicht unterstützte oder entfernte Sprachen fallen auf Englisch zurück. Die Sprache wird nicht automatisch anhand der Sprachheader des Browsers gewählt. Veranstaltungstitel, Beschreibungen, Fragen, Gästenamen, Notizen und andere selbst verfasste Inhalte bleiben unverändert. Datumsangaben verwenden die Sprache der betrachtenden Person und die Zeitzone der Veranstaltung.

## Sprachen für E-Mail und SMS {#email-and-sms-languages}

Standardmäßige System-E-Mails und SMS verwenden die gespeicherte Kontosprache des Empfängers. Unbekannte Empfänger erhalten Englisch. Hat der Empfänger keine Sprache gespeichert, kann eine Anmeldenachricht die gewählte Sprache des anfragenden Browsers verwenden. Diese Auswahl wird erst nach dem verifizierten Anmelden gespeichert. Nachrichten zur Bestätigung von Kontaktdaten im Profil verwenden die Sprache des angemeldeten Nutzers. Vorschauen und Testnachrichten für Administratoren verwenden deren gewählte Sprache.

Nachrichten von Veranstaltern und angepasste E-Mail-Vorlagen von Administratoren bleiben in jeder Sprache wortgetreu erhalten. Die bestehende Ersetzung von Platzhaltern gilt weiterhin für angepasste Vorlagen. Eingehende SMS-Befehle bleiben in jeder Sprache `YES`, `NO` und `MAYBE`.

Erinnerungen behalten die bestehenden Abschlussmarkierungen je Veranstaltung und Typ sowie das bestehende Verhalten bei Versandergebnissen bei. Schlägt ein Sprachstapel fehl, nachdem ein anderer angenommen wurde, kann ein erneuter Versuch einen bereits angenommenen Stapel wiederholen. Die Lokalisierung garantiert keine genau einmalige Zustellung.

## Eine Sprache hinzufügen {#adding-a-language}

Übersetzungen werden über normale Pull Requests geprüft. Es gibt weder einen Übersetzungsupload zur Laufzeit noch einen externen Übersetzungsdienst.

1. Wähle eine BCP-47-Sprachkennung, zum Beispiel `fr-FR`.
2. Füge `messages/<locale>.json` hinzu. Folge den verschachtelten Schlüsseln in `messages/en-US.json`. Eine registrierte Sprache muss jeden Schlüssel übersetzen: Die Katalogtests schlagen bei einem fehlenden oder unbekannten Schlüssel fehl. Zur Laufzeit fällt ein dennoch fehlender Schlüssel auf Englisch zurück.
3. Registriere die Kennung in `messages/locales.json` mit `nativeName`, `dir` (`ltr` oder `rtl`) und dem `flag`-Pfad. Lege die SVG-Flagge unter `public/` ab und verwende ihre lokal bereitgestellte URL. Das Register steuert die Sprachauswahl und die Prüfung unterstützter Sprachen. Eine neue Sprache erfordert keine Änderung an Komponenten oder Datenbankschema. Die Reihenfolge der Einträge in der Datei spielt keine Rolle: Das Menü zeigt immer zuerst Englisch und danach die übrigen Sprachen alphabetisch nach `nativeName`.
4. Verwende ICU-Nachrichten. Behalte Parameter- und Rich-Text-Tagnamen exakt bei. Erhalte die Bedeutung, verwende vollständige Sätze und ICU-Pluralformen und füge den erforderlichen `other`-Zweig ein. Übersetze keine festen Enumwerte, Routenpfade, Umgebungsvariablen oder Befehle. Maskiere in ICU-Text einen wörtlichen Apostroph vor ICU-Syntax mit einem weiteren Apostroph.
5. Füge optional vollständige Hilfeartikel wie unten beschrieben hinzu.
6. Führe `npm test -- tests/lib/i18n* tests/lib/docs.test.ts tests/lib/docs-localization.test.tsx` und anschließend `npm run test:components -- tests/components/DocsPanel.test.tsx` aus. Für die integrierte Änderung bleibt der vollständige Repository-Preflight erforderlich.

Die Namensräume für E-Mail, SMS und Erinnerungen werden nur auf dem Server verwendet. Nur der ausgewählte UI-Katalog wird an den Browser übergeben. Jede Sprache in `messages/locales.json` wird mit einem vollständigen Katalog ausgeliefert. Eine Änderung, die englische Texte hinzufügt, muss dieselben Schlüssel deshalb jeder registrierten Sprache hinzufügen.

## Hilfeartikel übersetzen {#translating-help-articles}

Die englischen Artikel in `docs/admin/` und `docs/host/` legen die verbindlichen Dateinamen, die Reihenfolge und die Zielgruppe fest. Füge einen übersetzten Artikel unter `docs/locales/<locale>/<audience>/<same-slug>.md` hinzu. Übersetze Titel, Beschreibung, Kategorie und den gesamten Inhalt. Lass einen noch nicht fertigen Artikel weg, damit stattdessen der vollständige englische Artikel erscheint. Ersatzinhalte behalten ihre tatsächliche Sprache und Leserichtung.

Jede übersetzte Überschrift muss mit dem bestehenden Anker der entsprechenden englischen Überschrift enden, zum Beispiel `## Inloggen {#signing-in}`. Die Darstellung blendet die Markierung aus und erhält die verbindliche ID. Aktiviere kein rohes HTML. Behalte Markdown-Linkziele und Bildziele unverändert bei; übersetzte Links müssen auch funktionieren, wenn ihr Ziel auf Englisch zurückfällt. Behalte Codeblöcke, Umgebungsvariablennamen, Befehle, URLs und selbst verfasste Beispiele bei. Führe die Dokumentationstests aus, um verbindliche Überschriften, Querverweise, mitgelieferte Bilder und Artikelersatz zu prüfen.

Die Produktions-Dockerfile kopiert den vollständigen Verzeichnisbaum `docs/` einschließlich der Sprachvarianten. Für neue Sprachen ist keine Änderung an der Dockerfile nötig.
