# Design language

Every screen in RSVP to Me follows one design language. New UI uses it, changed UI moves
toward it, and a site-wide review checks existing screens against this page. When this page
and an older screen disagree, this page wins.

The visual references live in Claude Design:

- **Design system:** tokens for the app shell and the three event base themes, the theme
  mapping, components and the style guide: <https://claude.ai/artifact/6Z1gqY8KCZgPXPMtPYenan>
- **Reference screens:** the notification settings canvas (profile table, phone layout,
  contact info and the add-an-address flow): <https://claude.ai/artifact/K6hrsx1LoFfMHDeDBD2AeM>.
  The table direction (A) is the chosen one; direction B is kept only for comparison.

The code is the source of truth for values. The artifacts are pictures of it.

## Principles

1. **Fewer choices beat more configurability.** Offer the one behavior most people want and
   leave out modes, orderings and per-item overrides unless people clearly need them. "Send to
   every place I check" replaced an ordered fallback list and a delivery-mode switch.
2. **Show the whole decision at once.** When people choose _what_ and _where_, use a compact
   table (rows are what, columns are where) instead of nested switches and disclosures.
3. **Point, don't nest.** Settings that belong to another page get one line that says where to
   go, not an embedded copy of that page.
4. **Changes save immediately.** Switches and checkboxes save when changed and confirm with a
   short status line. No Save button to forget. A failed save restores the confirmed state and
   says what happened. Forms with free text (names, addresses, email copy) are the exception:
   they keep one explicit Save button.
5. **Never claim what won't happen.** If a choice can't take effect (a missing contact, a
   service the site doesn't offer), say so next to it.
6. **Readable first.** Anything people need to read passes WCAG AA on its own surface: 4.5:1
   for text, 3:1 for text 24px and up (or 18.66px bold) and for icons and control borders.
   Hint text is at least `textSecondary`. `textMuted` and fainter grays are decoration only.
7. **The event theme owns the look.** On event pages, color, surfaces, the heading font,
   decoration and effects come from the event's theme. This page governs structure. A theme's
   expressive choices are never design-language findings.

## Event themes

Hosts choose a base theme (DARK, SOFT or BOLD), a preset or custom colors, a heading font, a
card opacity and an optional effect. `resolveTheme()` in `lib/theme.ts` turns those inputs into
a `ResolvedTheme`. The split is:

- **This page owns structure:** principles, layout, spacing, the type scale, shared components,
  patterns, accessibility, phone behavior and copy.
- **`ResolvedTheme` owns appearance:** colors, surfaces, the heading font, page decoration and
  effects, for every base theme, preset, custom accent and gradient.

A screen is off-design only when its structure or component use is wrong, or when it bypasses a
theme field with a hard-coded value. Fixes make components read more `ResolvedTheme` fields.
They never replace the theme or flatten event pages into the app-shell look.

App pages (dashboard, profile, help, admin, sign-in) use `APP_SHELL_THEME`, the app shell
expressed as a `ResolvedTheme`, so one component serves both. `APP_SHELL` holds the shell's
page gradient and the few values `APP_SHELL_THEME` doesn't carry.

### Which field each role uses

| Role                                      | `ResolvedTheme` fields                                                       |
| ----------------------------------------- | ---------------------------------------------------------------------------- |
| Page ground                               | `pageBg`, plus `pageDecoration` with `pageDecorationBg1`/`2`                 |
| Card surface                              | `cardBg`, `cardBorder`, `cardRadius`, `cardShadow`; `cardBgAlpha` = glass    |
| Titles and values                         | `textPrimary`                                                                |
| Body copy, row labels, hints              | `textSecondary`                                                              |
| Decoration only (dividers, inactive dots) | `textMuted`                                                                  |
| Text placed straight on the page ground   | `heroText` and `heroTextShadow` when set (BOLD), else `textPrimary`          |
| Inputs, selects, switch Off track         | `inputBg`, `inputBorder`, `inputText`, `inputPlaceholder`                    |
| Primary action                            | `accent` fill, `accentFg` text, `btnRadius`, `btnFontWeight`, `btnTransform` |
| Selected state, accent wash               | `accentBg`, `accentBorder`; glow `accentShadow`                              |
| Chips and pills                           | `pillBg`/`pillBorder` (neutral), `badgeBg`/`badgeText` (accent)              |
| Avatars and placeholders                  | `avatarGradient` (the event's own from → to)                                 |
| Event title                               | `headingFont`                                                                |

Per base theme:

- **DARK:** dark tinted page with glowing orbs; translucent dark cards with no shadow.
- **SOFT:** near-white tinted page with pastel blobs; white glass cards with a soft shadow and
  24px radius; serif heading default.
- **BOLD:** the event gradient fills the whole page; white glass cards with a strong shadow;
  `heroText` and `heroTextShadow` are set because text outside cards sits on the vivid
  gradient; buttons are uppercase and heavier.

Never write a literal color where a field exists. In particular: use `accentFg` (not white) on
an accent fill, use `avatarGradient` (not a fixed second color) for placeholders, and build
tints from `accentBg` or `accentRgb`, never from `rgba(${accent}, …)`, because `accent` is hex.

### Contrast contract

Every text field must pass principle 6 on its own surface for every built-in preset, at the
theme's default card opacity and at the lowest opacity hosts can choose. Admin-created presets
and custom colors can produce any combination, so readable values are computed in
`resolveTheme()`, not curated by hand. A preset-sweep unit test enforces this, the way
`tests/lib/email-preset-sweep.test.tsx` does for email.

The engine doesn't meet this contract yet. The 2026-11-05 review (task `d0d5fb15`) measured:

- `textMuted` is about 3.6–3.9:1 on every DARK and SOFT theme. BOLD's `textMuted` is darker than
  its `textSecondary`, so their order is inverted.
- `inputPlaceholder` fails on all three bases (2.1–3.8:1).
- `accent` and `badgeText` used as text fail on most SOFT and BOLD themes (down to 1.9:1).
- On BOLD, white hero text fails 3:1 on 9 of 13 themes, and the white-alpha byline and icons
  fail on all 13.

Planned `ResolvedTheme` additions, all derived from the event's own colors:

- `accentText`: the accent shifted in lightness until it reads at 4.5:1 on the card, for links
  and accent-colored text.
- `heroTextSecondary` and `heroTextMuted`: chosen against the darkest and lightest gradient
  stops.
- `heroScrim`: a soft dark wash behind text placed on the BOLD gradient, used only when white
  can't reach 3:1.
- `status`: `success`, `warning`, `error` and `info`, each with `text`, `bg` and `border`, per
  base theme.
- Raised `textMuted` and `inputPlaceholder`, and BOLD's order fixed.

Until they land:

- Use `textSecondary` for anything people read, including field labels and hints.
- Don't use `accent` as text on SOFT or BOLD; underline links in `textPrimary` instead.
- Status text on SOFT and BOLD uses `textPrimary` with a status icon; the dark-shell status
  colors below fail there.
- Put text on the BOLD gradient only when it's large (the event title), and prefer a card.

## Tokens

Colors, radii and surfaces come from `lib/theme.ts`, as described above. Don't hard-code colors
in components. The only shared literals are the dark-surface status colors used on the app
shell and DARK events: success #4ade80 on rgba(34,197,94,0.12), error #fca5a5 on
rgba(239,68,68,0.15), info #c084fc on rgba(168,85,247,0.1). They are not readable on SOFT or
BOLD cards; see the contract above.

**Type.** Body text is Arial/Helvetica on every page. The event title uses the theme's
`headingFont` (see Fonts and effects). Card titles are 15px bold, body text 14px, hints 13px
with 19px line height, labels and column headers 12px bold. Nothing people read is smaller than
12px.

**Spacing** uses 4, 6, 8, 10, 12, 14, 16, 20, 24 and 32px: 16px page gutter and gap between
cards, 20px settings-card padding, 24px event-card padding, 32px between hero blocks. Pages
run in one column, 600px wide at most.

**Radii** come from the theme (`cardRadius`, `btnRadius`). Event-page inputs and alerts use
10px, app-shell inputs 12px, and pills and switches are fully rounded.

**Focus.** Every interactive element shows a visible focus ring in `accent`.

## Components

- **Card:** `Section` in `components/event/settings-page/ui.tsx` (an `EventCard` with a title)
  for settings; `EventCard` for event-page sections; `AppCard` only for app-shell layouts.
  Put a header action such as **+ Add** in `Section`'s `action` slot, at the right of the
  title. Don't put a card inside a card. Inside an existing card, use a plain heading instead.
- **Switch:** `Toggle`, for one on/off choice that applies at once. It has a name and an
  on/off state for assistive technology. Its hit area is at least 40px tall, and when disabled
  it shows 0.45 opacity and a not-allowed cursor.
- **Buttons:** one set, all reading `ResolvedTheme`:
  - Primary: `accent` fill with `accentFg` text, 44px tall, one per form.
  - Secondary: `inputBg` fill with an `inputBorder` border, 40px tall.
  - Link: inline actions such as Change or Verify.
  - Icon: 40px square with an accessible name.
  - Destructive: secondary styling with error text, always behind a confirm dialog.

  Disabled is 0.45 opacity with a not-allowed cursor. Today the set lives in
  `components/event/invitations/styles.ts` (`buttonStyle`, `primary()`, `linkButtonStyle`),
  which needs the `inviteVars(theme)` CSS variables on an ancestor. `AppButton` (white text on
  the accent) and the settings `smallBtn` are older variants to migrate. The set is planned to
  move to `components/ui`.

- **Fields:** a label, the control, an optional hint and an error, with the label tied to the
  control. Labels are 12px bold in `textSecondary`. On app pages use `FormField` + `AppInput`
  from `components/ui/AppPrimitives`. On event pages use the settings `S.inp` style with a real
  `<label>`. The shared `Label` and `FormField` label colors still use the muted gray and are
  due to move to `textSecondary`.
- **Selects and date inputs:** native controls styled like inputs, always with a visible
  label. Never rely on the selected option or a placeholder as the name.
- **Alerts:** `InlineAlert` for status lines (saving, saved, errors), next to the control
  that caused them. Errors use `role="alert"`, everything else `role="status"`.
- **Toast:** `FeedbackToast`, only for a page-level result that has no control to sit next to
  (for example, after navigation). One toast component; no hand-built toasts.
- **Dialog:** `components/ui/Dialog.tsx` for every modal, with a labeled title, focus moved in
  and returned on close. Destructive actions use a confirm dialog built on it that says what
  will happen. Never use the browser's `confirm()`, `alert()` or `prompt()`.
- **Status chip:** a small pill. Good states use the success colors, everything else
  `inputBg` with `textSecondary`.
- **Upload:** a secondary or icon button (40px) that opens the file picker through
  `/api/upload`, with progress as text ("Compressing…", "Uploading…").

## Patterns

**Choice table.** `components/notifications/NotificationPreferences.tsx`. A `role="table"`
with a header row, one row per item (a name plus a one-line description) and one checkbox per
column. Each checkbox's accessible name is "Row: Column". Layout lives in the
`.rsvp-pref-*` classes in `app/globals.css`. Under 480px of card width each row stacks: the
description, then one labeled checkbox per column, with a little more space above the
checkboxes than between them.

**Grouped list with plus and minus.** Items are grouped under small headings (Email, Text).
Each row shows the item, a status chip and a 40px minus button with an accessible name
("Remove …"). **+ Add** sits at the top of the card and offers only the kinds that can still be
added. An empty group says "None yet." Adding opens an inline form in the card: pick the kind
if there's a choice, enter the value, then confirm (for contacts, with an 8-digit code).

**Pointers.** A card with a title and one sentence that names where to go.

**Event hero.** The event title (an `h1` in `headingFont`), the host byline, the cover image
or an `avatarGradient` placeholder, the date and the location. Text outside a card uses the
"text on the page ground" fields. The guest list and RSVP pages repeat the same title block,
so the event reads the same on every route. Host edit controls are Icon buttons ("Edit
title"), never clickable icons.

**Step flow.** Multi-step forms such as the RSVP flow show "Step 1 of 2" as text, mark the
current step with `aria-current="step"`, keep Back and Next in the same place, and show errors
in an `InlineAlert` at the step.

**List row.** Guest and admin lists: avatar, name, a one-line detail, a status chip, one
primary action, and an overflow menu for the rest (Edit, Remove). Rows don't stack three
buttons.

**Data table.** Admin tables keep a header row on wide screens. Under 480px each row stacks
into label and value pairs, like the choice table, so the page never scrolls sideways.

**Filter chips.** One row of chips that scrolls sideways inside its own container when it
overflows. Counts are in `textSecondary`. Hide chips that would show zero results.

**Stat tile.** A small card with a 12px bold label and one large number. Two per row on phones.

**Empty, loading and error states.** An empty list says what will appear and offers the one
action that fills it. Route segments that fetch data have a `loading.tsx` skeleton in card
shapes. Errors and missing pages (`error.tsx`, `not-found.tsx`) use the app shell with a title,
one sentence and a way back.

**Theme picker.** Preset tiles are buttons with `aria-pressed` for the applied preset, in a
grid that grows with the page (no scrolling box inside the page). Switching between Theme,
Effects and Font uses buttons with `aria-pressed`, or real tabs. Restoring preset defaults is a
secondary button.

**Header and host bar.** The global header (`components/ui/AppNav.tsx`) and the host's
floating bar (`components/event/HostBar.tsx`) are app chrome. Whether app chrome stays on the
dark app shell over event pages or takes a tint from the event theme is an open decision (see
below). Until it's settled, don't add new chrome surfaces.

## Fonts and effects

Fonts and effects are theme inputs, not app tokens.

- **Heading fonts.** `lib/fonts.ts` is the registry and `app/fonts.ts` loads each family at
  build time (Roboto from the local licensed file in `app/font-files/`). `resolveTheme()`
  returns `headingFont` as `var(--font-…), <fallback>`. It applies to the event title on every
  event route, never to body text, labels or controls. Script fonts (Pacifico, Dancing Script,
  Caveat) are only used at 28px and up.
- **Effects.** `lib/effects.ts` defines the sets; `EventAtmosphere` renders them behind all
  content (`ParticleLayer`, `aria-hidden`, hidden under `prefers-reduced-motion`). Text placed
  straight on the page ground needs a card or the planned `heroScrim` behind it when an effect
  runs, so sprites never reduce its contrast.
- **Email** never receives web fonts or effects (see Email).

## Email

`resolveEmailTheme()` in `lib/email-theme.ts` is the only web-to-email boundary. It derives
everything from `resolveTheme()`, so new presets reach email with no email-code change.

- **Inherited:** `accent` and `accentFg`, the hero gradient with a solid `heroFallback` for
  Outlook, hero text and shadow, the heading font's `emailStack`, button radius, weight and
  case, and the avatar gradient.
- **Fixed:** a light canvas (#f4f4f7) and white body with readable body inks, 12px card radius,
  and a `prefers-color-scheme: dark` variant in `emails/components/EmailLayout.tsx`.
- **Dropped:** glass, blur, orbs, blobs, shadows, animation, effects and web fonts.

Email text follows principle 6 on the white body. Today, accent-colored links and BOLD hero
text fail on many presets, and the email muted gray reads at 3.2:1. Planned: a derived
`linkColor`, hero text chosen against the worst gradient stop and the fallback, and a readable
muted gray, all inside `resolveEmailTheme()` and covered by the preset-sweep test.

## Copy

- **Voice:** plain and reassuring. "We" for the app, "you" for the reader.
- **Sentence case** for titles, buttons, labels and menu items: "Display options", "Save
  settings".
- **Switch labels name what is received**, not a command: "Event updates", "Host alerts".
- **Status lines are complete sentences** that confirm the result.
- **Say what stays the same** when a control could alarm: "Sign-in links still arrive."
- **No emoji** in headings, settings, admin labels or buttons. Emoji stay in theme preset
  names and the RSVP answer choices.
- **Contacts are masked:** `r•••s@example.test`, `•••• 2222`.
- **Document titles** read "Page · Event | RSVP to Me" on event routes and "Page | RSVP to Me"
  elsewhere, without repeating the brand.

## Checking a screen

When building or reviewing a screen, check that:

- it uses `ResolvedTheme` fields and the shared components above, with no literal colors;
- event pages work on one DARK, one SOFT and one BOLD preset, including a light-gradient BOLD
  preset such as Summer Vibes, and expressive theme choices are left alone;
- it offers no option the principles would leave out;
- every control has an accessible name, and switches and checkboxes expose their state;
- every control works by keyboard and shows a visible focus ring;
- text, hints and placeholders meet principle 6 on their own surface;
- it works at 390px wide with no sideways scrolling;
- it has empty, loading and error states where data can be missing;
- it has no card inside a card and no duplicated settings from another page;
- it uses the shared dialog, never the browser's `confirm()` or `alert()`;
- its copy follows the Copy section and its document title is correct.

## Open decisions

These are undecided. Until they are, follow current behavior and don't extend it.

- Whether app chrome (header, host bar, dialogs) on event routes stays on the dark app shell or
  takes a tint from the event theme.
- Whether Display Options keeps the "show names after a click" mode or reduces each response
  to two checkboxes (names, count).
- The lowest card opacity hosts can choose, and whether effect density and size merge into
  one "Amount" control.
- Whether the private guest notifications page keeps the app-shell look.
- Whether Geist (loaded in `app/layout.tsx` but unused) is removed or becomes the body face.
