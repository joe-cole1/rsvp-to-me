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
   Hint text is at least `textSecondary`. On event themes `textMuted` also reaches 4.5:1 and is
   for lesser details (timestamps, notes); fainter grays are decoration only.
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

| Role                                     | `ResolvedTheme` fields                                                                                                                                      |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Page ground                              | `pageBg`, plus `pageDecoration` with `pageDecorationBg1`/`2`                                                                                                |
| Card surface                             | `cardBg`, `cardBorder`, `cardRadius`, `cardShadow`; `cardBgAlpha` = glass                                                                                   |
| Titles and values                        | `textPrimary`                                                                                                                                               |
| Body copy, row labels, hints             | `textSecondary`                                                                                                                                             |
| Lesser details (timestamps, notes)       | `textMuted`                                                                                                                                                 |
| Text placed straight on the page ground  | `heroText` (title, date), `heroTextSecondary` (byline, time), `heroTextMuted` (icons), `heroTextShadow` when set; `heroScrim` behind the hero band when set |
| Inputs, selects, switch Off track        | `inputBg`, `inputBorder`, `inputText`, `inputPlaceholder`                                                                                                   |
| Primary action                           | `accent` fill, `accentFg` text, `btnRadius`, `btnFontWeight`, `btnTransform`                                                                                |
| Accent-colored text (links, text button) | `accentText`; `accent` stays for fills, borders and icons                                                                                                   |
| Selected state, accent wash              | `accentBg`, `accentBorder`; glow `accentShadow`                                                                                                             |
| Chips and pills                          | `pillBg`/`pillBorder` (neutral), `badgeBg`/`badgeText` (accent), `accentBg` with `accentText`                                                               |
| Status lines and chips                   | `status.success`, `status.warning`, `status.error`, `status.info`, each with `text`, `bg` and `border`                                                      |
| Avatars and placeholders                 | `avatarGradient` (the event's own from → to)                                                                                                                |
| Event title                              | `headingFont`                                                                                                                                               |

Per base theme:

- **DARK:** dark tinted page with glowing orbs; translucent dark cards with no shadow.
- **SOFT:** near-white tinted page with pastel blobs; white glass cards with a soft shadow and
  24px radius; serif heading default.
- **BOLD:** the event gradient fills the whole page; white glass cards with a strong shadow;
  hero text is chosen against the gradient (white with a shadow, a soft `heroScrim` where white
  needs help, or a dark stone ink on light gradients); buttons are uppercase and heavier.

Never write a literal color where a field exists. In particular: use `accentFg` (not white) on
an accent fill, `accentText` (not `accent`) for accent-colored text, `status` (not literal
greens and reds) for status, use `avatarGradient` (not a fixed second color) for placeholders,
and build tints from `accentBg` or `accentRgb`, never from `rgba(${accent}, …)`, because
`accent` is hex.

### Contrast contract

Every text field passes principle 6 on its own surface for every base theme, preset and custom
color, at the theme's default card opacity and at the lowest opacity hosts can choose
(`MIN_CARD_OPACITY`, 0.40). Admin-created presets and custom colors can produce any
combination, so readable values are computed in `resolveTheme()` (helpers in
`lib/theme-contrast.ts`), never curated by hand.

How `resolveTheme()` derives them:

- **Surfaces.** The card is composited over the page ground at the theme's actual card opacity:
  the BOLD gradient sampled from end to end, or each DARK and SOFT page stop alone and under
  the centers of the orbs or blobs. Inputs, washes and status backgrounds are composited over
  that card. Text must pass on the worst point.
- **Text colors move only in lightness.** A color that already passes is kept. One that doesn't
  is shifted toward black or white, keeping its hue and saturation, until it reads at 4.5:1.
  Fills, gradients, fonts, decoration and effects never change.
- **Card text:** `textPrimary`, `textSecondary` and `textMuted` reach 4.5:1, and `textMuted` is
  never stronger than `textSecondary`. `inputPlaceholder` reaches 4.5:1 on the input.
- **`accentText`** is the accent made readable on the card and on `accentBg`; `badgeText` is
  made readable on `badgeBg`. `accentFg` stays black or white, whichever reads on the fill.
- **`status`:** DARK keeps the app shell's colors (success #4ade80, warning #fbbf24, error
  #fca5a5, info #c084fc on their own washes). SOFT and BOLD start from darker inks (#15803d,
  #b45309, #b91c1c, #7e22ce) that suit white glass, then pass through the same check.
- **Hero text** (title, byline, date) is chosen against the page ground: 3:1 for `heroText`
  (large text) and `heroTextMuted` (icons), 4.5:1 for `heroTextSecondary`. DARK and SOFT use
  their own text colors. On BOLD:
  1. White, with `heroTextShadow`, when it already reads at 4.5:1 on the whole gradient.
  2. Otherwise white with `heroScrim`, a 0.35 black wash behind the hero band, when that is
     enough (Sunset: about 5.9:1).
  3. Otherwise the stone ink (#1c1917 title, a #44403c byline darkened if needed) with no
     shadow, when it reads (Summer Vibes: 10.4:1).
  4. Otherwise white with a stronger scrim.
- **Last resort.** If no ink can reach 4.5:1 on a see-through card (only extreme custom
  gradients that span mid-tones), `resolveTheme()` raises that theme's card opacity just far
  enough. Built-in presets never need it.

`tests/lib/theme-contrast-sweep.test.ts` enforces all of this for every base default and preset
(and a few extreme custom colors) at both opacities, the way
`tests/lib/email-preset-sweep.test.tsx` does for email.

## Tokens

Colors, radii and surfaces come from `lib/theme.ts`, as described above. Don't hard-code colors
in components. Status colors come from the theme's `status` field; on app pages that is
`APP_SHELL_THEME.status` (success #4ade80 on rgba(34,197,94,0.12), error #fca5a5 on
rgba(239,68,68,0.15), info #c084fc on rgba(168,85,247,0.1)). The shared components in
`components/ui` read these fields; nothing else picks a status color.

**Type.** Body text is Arial/Helvetica on every page. The event title uses the theme's
`headingFont` (see Fonts and effects). Card titles are 15px bold, body text 14px, hints 13px
with 19px line height, labels and column headers 12px bold. Nothing people read is smaller than
12px.

**Spacing** uses 4, 6, 8, 10, 12, 14, 16, 20, 24 and 32px: 16px page gutter and gap between
cards, 20px settings-card padding, 24px event-card padding, 32px between hero blocks. Pages
run in one column, 600px wide at most.

**Radii** come from the theme (`cardRadius`, `btnRadius`). Inputs and alerts use 10px on every
page, and chips, pills and switches are fully rounded.

**Focus.** Every interactive element shows a visible focus ring in `accent`. The shared
controls draw it, and their hover wash, through the `.rsvp-control`, `.rsvp-press` and
`.rsvp-field` classes in `app/globals.css`, so never set `outline: none` inline.

## Components

Every control comes from `components/ui` and takes a `theme` prop: the event's
`ResolvedTheme` on event pages, `APP_SHELL_THEME` on app pages, and `chromeTheme(t)` in app
chrome over an event (the host bar, its dialogs and sheets: the dark shell carrying the
event's accent). Two controls that look alike are always the same component. Never hand-build
a button, field, switch, chip, alert or toast; if a screen needs a look the set doesn't have,
add it to the set and to this page. `style` on a shared control is for layout only (width,
flex, margins), never for colors or sizes. `tests/components/UiPrimitives.test.tsx` fails if
a native button or link outside `components/ui` paints an accent fill.

- **Card:** `Section` in `components/event/settings-page/ui.tsx` (an `EventCard` with a title)
  for settings; `EventCard` for event-page sections; `AppCard` only for app-shell layouts.
  Put a header action such as **+ Add** in `Section`'s `action` slot, at the right of the
  title. Don't put a card inside a card. Inside an existing card, use a plain heading instead.
- **Buttons:** `Button` in `components/ui/Button.tsx`, or `buttonProps(theme, look)` to give
  a `<Link>` or `<a>` the same look:
  - Primary: `accent` fill with `accentFg` text, the theme's button radius, weight and case,
    44px tall, one per form.
  - Secondary: `inputBg` fill with an `inputBorder` border and `textPrimary` text, 40px tall.
    Everything that isn't the form's main action, including Cancel, Back and Copy.
  - Destructive: the secondary shape in the theme's `status.error` colors, always behind a
    confirm dialog.
  - Add: "+ Add …" where something can be added (a dashed `accentBorder` outline on the
    `cardBg` surface, `accentText` and a Plus icon), such as Add location, Add poll or the
    info-section chips. The card surface keeps it readable when it sits on the page ground.
  - Link: an inline, underlined action in `accentText`, such as Change, Verify or Back.
  - Icon: a 40px square with an accessible name (Close, Remove, Edit). On the page ground
    (outside any card) pass `onGround`, so the icon reads `heroTextMuted` like the other
    hero icons; `onGround` on a Link reads `heroTextSecondary`.
  - Overlay: a control laid on a photo (the cover image, an event card): dark glass with
    white text, because the photo, not the theme, is underneath. Labels laid on a photo
    (a dashboard card's date and status) use the same `PHOTO_OVERLAY` glass.
  - Toolbar: an item in a bar of actions (the host bar): an icon over a 12px label in
    `textSecondary`, no fill until hovered, at least 44px tall. Give it the chrome theme.

  `size="sm"` (32px, 13px text) is only for actions inside a list or table row, or on a photo.
  Disabled is 0.45 opacity with a not-allowed cursor. A copied or saved state changes the
  label (and adds a check icon), never the button's color.

- **Choices:** in `components/ui/Choice.tsx`, all buttons with `aria-pressed`:
  - Chip: a pill for filters and short either/or choices (Theme · Effects · Font, effect amount,
    size, speed and movement, guest-list filters, recipients). It sits on the `cardBg` surface, so it reads on
    the page ground too; selected lays `accentBg` over it with `accentText`.
  - Choice tile: a tile in a picker grid (presets, base themes, fonts, effects, icons).
    Selected reads `accentBg` with a 2px `accent` border.
  - Swatch and custom swatch: round color samples named by the color; the custom swatch opens
    the native color picker.
- **Section list:** `NavItem` in `components/ui/NavItem.tsx` for a vertical list of sections
  (the admin sidebar and drawer, the docs index). The current entry is an `accent` fill.
- **Switch:** `Toggle` in `components/ui/Toggle.tsx`, for one on/off choice that applies at
  once. The whole row is the 40px hit area, it has a name and an on/off state for assistive
  technology, and when disabled it shows 0.45 opacity and a not-allowed cursor. Without a
  description its label is a row label (`textSecondary`); with one, the label is the
  setting's name (`textPrimary`) and the description sits under it.
- **Fields:** `Field` in `components/ui/Field.tsx` wraps a label, the control, an optional
  hint and an error, and ties them together. Labels are 12px bold in `textSecondary`; `Label`
  alone is a group heading. Controls are `Input`, `Textarea`, `Select`, `Check` (checkbox or
  radio), `Range`, `SecretInput` (a password-style field with a show/hide button) and
  `ColorInput`, all in the theme's input colors with `inputPlaceholder` placeholders.
- **Selects and date inputs:** native controls styled like inputs, always with a visible
  label. Never rely on the selected option or a placeholder as the name.
- **Alerts:** `InlineAlert` in `components/ui/Feedback.tsx` for status lines (saving, saved,
  warnings, errors), next to the control that caused them, in the theme's `status` colors.
  Errors use `role="alert"`, everything else `role="status"`.
- **Toast:** `Toast`, only for a page-level result that has no control to sit next to (for
  example, after navigation or a save from a switch far up the page). It sits on the theme's
  card over its page ground, may carry one action (Undo) and a dismiss button, and renders
  nothing when there is no message. One toast component; no hand-built toasts.
- **Dialog:** `components/ui/Dialog.tsx` for every modal, with a labeled title, focus moved in
  and returned on close. Never use the browser's `confirm()`, `alert()` or `prompt()`.
- **Confirm dialog:** `useConfirm(theme)` in `components/ui/ConfirmDialog.tsx`, for every
  action that deletes or overwrites. Render its `dialog`, then
  `if (!(await confirm({ title, message, confirmLabel }))) return;`. The title asks the
  question ("Remove this guest?"), the message is one sentence on what will happen (it is the
  dialog's description), and the action button is a verb ("Remove"), destructive by default
  or `tone: "primary"` for an overwrite that isn't a loss. Cancel comes first and takes the
  focus. The panel is the card over the page ground, so card text stays readable. A failed
  action reports in an `InlineAlert` next to its control, never in an alert box.
- **Status chip:** `StatusChip`, a small pill. Good states use `status.success` (`text` on
  `bg`), everything else `inputBg` with `textSecondary`.
- **Upload:** a secondary or icon button (40px) that opens the file picker through
  `/api/upload`, with progress as text ("Compressing…", "Uploading…").
- **State page:** `StatePage` in `components/ui/StatePage.tsx`, for missing pages and
  errors: the app shell's ground and card with an `h1` title, one sentence and one or two
  buttons (the way back first, a retry where one makes sense). No emoji.

## Patterns

**Choice table.** `components/notifications/NotificationPreferences.tsx`. A `role="table"`
with a header row, one row per item (a name plus a one-line description) and one checkbox per
column. Each checkbox's accessible name is "Row: Column". Layout lives in the
`.rsvp-pref-*` classes in `app/globals.css`. Under 480px of card width each row stacks: the
description, then one labeled checkbox per column, with a little more space above the
checkboxes than between them.

When a column has more than two answers, its cells are `Select` menus instead of checkboxes
(Display options' guest RSVP display: Names and Count per response). Add `rsvp-pref-cell-menu`
to each cell and set `--rsvp-pref-col` to the menu width and `--rsvp-pref-gap` to 8px; each
menu's accessible name is still "Row: Column", and under 480px the column name sits above its
menu. One hint line under the table explains any answer that needs it. A table whose
choices change what guests see may end with one live "What guests see" preview, set off by a
`cardBorder` divider (not a box) and drawn with the same components guests get. Never put a
preview in each row.

**Grouped list with plus and minus.** Items are grouped under small headings (Email, Text).
Each row shows the item, a status chip and a 40px minus button with an accessible name
("Remove …"). **+ Add** sits at the top of the card and offers only the kinds that can still be
added. An empty group says "None yet." Adding opens an inline form in the card: pick the kind
if there's a choice, enter the value, then confirm (for contacts, with an 8-digit code).

**Pointers.** A card with a title and one sentence that names where to go.

**Event hero.** The event title (an `h1` in `headingFont`), the host byline, the cover image
or an `avatarGradient` placeholder, the date and the location. Text outside a card uses the
"text on the page ground" fields. The title, byline, cover and date sit in one `HeroScrim`
(`components/event/event-page/HeroScrim.tsx`): when the theme sets `heroScrim`, it draws one
soft wash behind that band, reaching past the text and feathered at the edges, without creating
a stacking context. Nothing else goes on the ground. Routes that repeat the title (the guest
list) use `EventTitleBlock` (`components/event/event-page/EventTitleBlock.tsx`), which shares
the hero's title style, so the event reads the same on every route. Host edit controls are Icon buttons ("Edit
title", with `onGround` in the hero), never clickable icons, and the inline field they open is
named ("Event title"). Triggers such as "2 others" are buttons that report `aria-expanded`.

**Step flow.** Multi-step forms such as the RSVP flow show "Step 1 of 2" as text, mark the
current step with `aria-current="step"`, keep Back and Next in the same place, and show errors
in an `InlineAlert` at the step.

**List row.** Guest and admin lists: avatar, name, a one-line detail, a status chip, one
primary action, and an overflow menu for the rest (Edit, Remove). Rows don't stack three
buttons.

**Data table.** Admin tables keep a header row on wide screens. Under 480px of card width
each row stacks into label and value pairs, like the choice table, so the page never scrolls
sideways. Use the `.rsvp-table` classes in `app/globals.css`: wrap the table in
`.rsvp-table-wrap`, name each cell's column in `data-label`, mark the end column
`.rsvp-table-end`, and set `--rsvp-table-label` (`textSecondary`) and `--rsvp-table-rule`.
Give the table explicit table roles so it stays a table when its rows stack.

**Filter chips.** One row of `Chip`s that scrolls sideways inside its own container when it
overflows. Give that container 3px of padding (and a matching negative margin) so focus rings
aren't clipped. Counts are in `textSecondary`; a capped count such as "3+" is read as
"3 or more". Hide chips that would show zero results.

**Stat tile.** A small card with a 12px bold label and one large number. Two per row on phones.

**Empty, loading and error states.** An empty list says what will appear and offers the one
action that fills it. App pages have a `loading.tsx` skeleton in card shapes
(`app/(app)/loading.tsx`) that names itself "Loading…" to assistive technology and holds
still under reduced motion. Event routes have none: their look comes from the event's
theme, which isn't known until the event loads, and an app-shell skeleton would flash dark
before a light theme. Errors and missing pages (`error.tsx`, `app/not-found.tsx`) use
`StatePage`.

**Theme picker.** Preset tiles are buttons with `aria-pressed` for the applied preset, in a
grid that grows with the page (no scrolling box inside the page). Switching between Theme,
Effects and Font uses buttons with `aria-pressed`, or real tabs. Restoring preset defaults is a
secondary button.

**Effect picker.** `components/event/settings-page/EffectsPanel.tsx` (#825). One labeled
search field ("Search icons") sits above the grid. With no query the grid shows None and the
built-in sets, seasonal ones first; with a query it shows None and the matching library icons
instead, in the same growing grid (no scrolling box), with **Load more** under it. Each icon
tile shows the art and its label in the interface language. The library has one style (Noto
Emoji), so each emoji appears once and tiles carry no style caption. A host picks one
built-in set or mixes up to three icons: the mixture shows as a "Your mix" row of small
items, each with a named remove button ("Remove Cat"); clicking a selected tile removes it;
a fourth pick shows a short info line instead of adding. Loading, no results, too many
searches and a failed search are one status line or `InlineAlert` under the grid, and none
of them change the effect. Under the grid, for an active effect, four independent controls
stack in one column: **Amount** (Less, Some, More: how many), **Size** (Small 3×, Medium 5×,
Large 7× chips, then a 1–10× slider in 0.5 steps with the actual value beside it), **Speed**
and **Movement** (Up, Down, Random). A size that isn't 3, 5 or 7 selects no chip. Every
choice saves at once; the slider previews while it moves and saves when released, by
pointer, touch, key or blur.

**Header and host bar.** The global header (`components/ui/AppNav.tsx`), the settings bar,
and the host's floating bar (`components/event/HostBar.tsx`) with its dialogs and sheets are
app chrome. Over event pages app chrome stays on the dark app shell on every theme (#812):
surfaces are `APP_SHELL.chromeSurface` with an `APP_SHELL.navBorder` edge (floating chrome
adds `chromeShadow`, modals sit on `chromeBackdrop`), and every control reads `chromeTheme(t)`
(the dark shell with the event's accent). The header over every event route is the same
fixed `chrome` bar. Never a translucent wash over the page, never a literal color, and never
hover colors set in JS: chrome controls are shared components (the host bar's items are
Toolbar buttons).

## Fonts and effects

Fonts and effects are theme inputs, not app tokens.

- **Heading fonts.** `lib/fonts.ts` is the registry and `app/fonts.ts` loads each family at
  build time (Roboto from the local licensed file in `app/font-files/`). `resolveTheme()`
  returns `headingFont` as `var(--font-…), <fallback>`. It applies to the event title on every
  event route, never to body text, labels or controls. Script fonts (Pacifico, Dancing Script,
  Caveat) are only used at 28px and up.
- **Effects.** `lib/effects.ts` defines the built-in sets and the effect model; a host can
  also mix up to three icons from the local Noto Emoji library, which keep their own colors (only built-in tinted sets take theme colors). `EventAtmosphere`
  renders every effect behind all content (`ParticleLayer`, `aria-hidden`, no pointer
  events, hidden under `prefers-reduced-motion` and by the viewer's Hide effects choice).
  Random movement sends each particle across on its own path, sideways and diagonal too.
  Sprites pass under the hero band's `heroScrim` and under cards; keep any other text in a
  card so sprites never reduce its contrast.
- **Email** never receives web fonts or effects (see Email).

## Email

`resolveEmailTheme()` in `lib/email-theme.ts` is the only web-to-email boundary. It derives
everything from `resolveTheme()`, so new presets reach email with no email-code change.

- **Inherited:** `accent` (fills, borders, and link underlines where visible) and `accentFg`, the hero gradient
  with a solid `heroFallback` for Outlook, the web's hero ink choice and shadow, the heading
  font's `emailStack`, button radius, weight and case, and the avatar gradient.
- **Fixed:** a light canvas (#f4f4f7), white body and #f8f8fa details card (`EMAIL_SURFACES`),
  body inks #18181b, #52525b and muted #6b6b75, 12px card radius, and a
  `prefers-color-scheme: dark` variant (`EMAIL_DARK_MODE`, muted #9a9aa3) applied by
  `emails/components/EmailLayout.tsx`.
- **Dropped:** glass, blur, orbs, blobs, shadows, animation, effects, web fonts and `heroScrim`.

Email text follows principle 6 on email surfaces, never web ones. `resolveEmailTheme()` derives
these with the `lib/theme-contrast.ts` helpers, moving colors only in lightness:

- **`linkColor`** is the accent made readable (4.5:1) on the body, card and canvas, and
  `linkColorDark` the same on the dark-mode surfaces (the `.dm-link` class). Every
  accent-colored text link uses `linkStyle()` from `emails/components/linkStyle.ts`: text in
  `linkColor`, underline in `linkUnderline` (the `accent` where it reads 3:1 on the body and
  card, else `linkColor`), since the underline is what tells a link from body text. Footer
  links on the canvas underline in `linkColor`. Accent buttons keep the `accent` fill with
  `accentFg`.
- **`heroText`** (title, 3:1) and **`heroTextSecondary`** (kicker and subtitle, 4.5:1, a solid
  color with no opacity) are measured on the gradient sampled stop to stop plus `heroFallback`.
  The web's choice goes first, then the other ink; a dark ink may deepen toward black. When no
  ink reaches both everywhere (a few mid-tone BOLD gradients such as Tropical Punch), the ink
  that reads best is used and the gradient is left alone: no panel, wash or lift.
- **`avatarText`** reaches 3:1 on the avatar gradient where an ink can.

`tests/lib/email-preset-sweep.test.tsx` enforces this for every base default and preset, plus a
few extreme custom colors.

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

- Whether the private guest notifications page keeps the app-shell look.
- Whether Geist (loaded in `app/layout.tsx` but unused) is removed or becomes the body face.

Decided:

- **Display options** (#811, 2026-11-07): one choice table with a row per response (Going,
  Maybe, Can't make it, Invited) and two menus, Names (Shown, Collapsed, Hidden) and Count
  (Exact, 3+, Hidden). Count is independent of names, every row may use 3+, and Invited
  (host-added guests with no reply yet) starts hidden.
- **Effect controls** (#811, 2026-11-07): density and size merge into one Amount (Less, Some,
  More); Speed stays. _Superseded for size by #825._
- **Effect controls, revisited** (#825, 2026-11-07): #811's Amount also set the size and the
  size slider was removed; hosts lost a control they used. Amount now sets only how many
  motifs drift (Less, Some, More), Size is its own control again (Small 3×, Medium 5×,
  Large 7× plus the 1–10× slider), and Movement (Up, Down, Random) is new. All four are
  independent of each other and of the motif. Stored sizes, including ones an #811 Amount
  wrote, are kept as they are. The lowest card opacity stays 0.40 (#807): text colors are derived from
  each theme's actual opacity; see the contrast contract.
- **App chrome on event routes** (#812, 2026-11-12): the header, settings bar, host bar and
  their dialogs stay on the dark app shell, one solid surface on every theme, carrying the
  event's accent through `chromeTheme(t)`. They take no tint from the event theme; see
  Header and host bar.

## Preset defaults and soft motion

Soft & Dreamy uses two broad translucent color fields with independent slow transform
animations. Reduced motion keeps the same enlarged fields static. Decorations never
capture input. Contrast includes the overlapping fields.

Preset tiles use local Noto artwork. Occasions groups life-event presets separately
from Seasonal and General; light/dark filters still describe the base style.
A preset includes a tile icon, category and optional complete effect defaults.
Applying or restoring it loads the effects into the normal editable Your mix controls.
"Customized" means different from the applied preset's current settings, the same values
its tile applies, so a freshly applied preset never shows Restore. Replacing customization
asks first, with Cancel before the verb: selecting a preset asks "Replace customized
settings?" with Apply; Restore asks "Restore “name” defaults?" with Restore. With no
applied preset, selecting a preset applies directly.

Dialogs mount through a portal directly under the document body. Their fixed backdrop
covers the viewport, including navigation, and centers the panel independently of blurred
cards, scrolling containers and transformed ancestors. Existing focus and dismissal
behavior applies equally on desktop and phone layouts.

A preset's category is its stored one, or Seasonal when a preset saved before categories
existed has its seasonal flag set; filters, badges and the administrator editor share that
rule. The administrator's Reset to default and Reset to original snapshots inherit fields
they omit from the current preset; explicit saved values, including null, remain
authoritative.
