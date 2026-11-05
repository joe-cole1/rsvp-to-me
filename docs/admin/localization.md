---
title: Languages and Translation Contributions
description: Personal language settings, notification languages, and contributing translations.
category: Configuration
audience: admin
order: 45
---

# Languages and Translation Contributions

## Choosing Your Language

Use the language button (a 文A icon with the current language code, such as EN) in the upper-right header, immediately beside your profile, on any page, including sign-in and event access screens. A selection keeps the current URL and entered form values.

When signed in, the setting is saved to your account and this browser. When signed out, it is saved only in this browser's cookie. The browser preference lasts one year. A saved account preference takes priority over the browser preference. After a successful sign-in, an account without a saved preference adopts the browser's explicit choice. Requesting a sign-in link or submitting a guest RSVP never changes another account's language.

English is the default. German is available as **Deutsch**, Spanish as **Español**, and Dutch as **Nederlands** in the language menu, which lists English first and the other languages alphabetically by native name. A long menu scrolls and opens at the current language. Unsupported or removed language selections fall back to English. There is no automatic selection from browser language headers. Event titles, descriptions, questions, guest names, notes, and other user-written content stay exactly as written. Dates use the viewer's language and the event's timezone.

Event-update notification counts and the processing, acceptance, and uncertainty feedback use the host's selected interface language, including Dutch.

## Email and SMS Languages

Default system emails and text messages use the recipient's saved account language. Unknown recipients receive English. A sign-in message can use the requesting browser's selected language if the recipient has no saved language; it does not save that choice before verified sign-in. Profile contact-verification messages use the signed-in user's language. Administrator previews and test messages use the administrator's selected language.

Host-written messages and administrator email template overrides stay verbatim in every language. Existing placeholder substitution still applies to custom templates. Incoming SMS commands remain `YES`, `NO`, and `MAYBE` in every language.

Reminders retain the existing event/type completion markers and sender-result behavior. If one language batch fails after another was accepted, a retry may repeat an accepted batch. Localization does not provide exactly-once delivery.

## Adding a Language

Translations are reviewed through normal pull requests. There is no runtime translation upload or external translation service.

1. Choose a BCP 47 locale ID, such as `fr-FR`.
2. Add `messages/<locale>.json`. Follow the nested keys in `messages/en-US.json`. Missing keys fall back to English; unknown keys are rejected.
3. Register the ID in `messages/locales.json` with its `nativeName`, `dir` (`ltr` or `rtl`), and `flag` path. Add the flag SVG under `public/` and use its locally hosted URL. The registry drives the selector and supported-language validation; adding a language needs no component or database schema change. The order of entries in the file does not matter: the menu always lists English first, then the rest alphabetically by `nativeName`.
4. Use ICU messages. Preserve parameter and rich-text tag names exactly. Preserve message meaning, use complete sentences and ICU plurals, and include the required `other` branch. Do not translate stable enum values, route paths, environment variables, or commands. In ICU text, escape a literal apostrophe before ICU syntax with another apostrophe.
5. Optionally add complete help articles as described below.
6. Run `npm test -- tests/lib/i18n* tests/lib/docs.test.ts tests/lib/docs-localization.test.tsx`, then `npm run test:components -- tests/components/DocsPanel.test.tsx`. The full repository preflight is still required for the integrated change.

Email, SMS, and reminder namespaces are used only on the server. Only the selected UI catalog is passed to the browser. Partial catalogs are welcome; untranslated UI messages fall back to English.

## Translating Help Articles

English articles in `docs/admin/` and `docs/host/` define the canonical filenames, order, and audience. Add a translated article at `docs/locales/<locale>/<audience>/<same-slug>.md`. Translate its title, description, category, and complete body. If an article is not ready, leave it absent so the whole English article appears instead. Fallback content retains its actual language and text direction.

Every translated heading must end with the corresponding English heading's existing anchor, for example `## Inloggen {#signing-in}`. The renderer hides that marker and keeps the canonical ID. Do not enable raw HTML. Keep Markdown link targets and image targets unchanged; translated links must also work when their destination falls back to English. Preserve code blocks, environment-variable names, commands, URLs, and user-written examples. Run the documentation tests to check canonical headings, crosslinks, bundled images, and article fallback.

The production Dockerfile copies the complete `docs/` tree, including locale overlays. New languages do not need a Dockerfile edit.
