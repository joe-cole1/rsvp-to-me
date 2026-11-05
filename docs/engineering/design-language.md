# Design language

Every screen in RSVP to Me follows one design language. New UI uses it, changed UI moves
toward it, and a site-wide review checks existing screens against this page. When this page
and an older screen disagree, this page wins.

The visual references live in Claude Design:

- **Design system:** tokens, the Card, Toggle, Button, TextField and InlineAlert components,
  and the style guide: <https://claude.ai/artifact/6Z1gqY8KCZgPXPMtPYenan>
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
   says what happened.
5. **Never claim what won't happen.** If a choice can't take effect (a missing contact, a
   service the site doesn't offer), say so next to it.
6. **Readable first.** Hint text is at least `textSecondary` (#a1a1aa on the dark shell). Don't
   use `textMuted` or fainter grays for anything people need to read.

## Tokens

Colors, radii and surfaces come from `lib/theme.ts`:

- `APP_SHELL` and `APP_SHELL_THEME` for app pages (profile, dashboard, admin).
- `resolveTheme()` for event pages. Components take a `ResolvedTheme` and use its fields
  (`textPrimary`, `textSecondary`, `accent`, `cardBg`, `cardBorder`, `inputBg`, `inputBorder`,
  and so on), so the same component works on every event theme.

Don't hard-code colors in components, except the shared status colors: success #4ade80 on
rgba(34,197,94,0.12), error #fca5a5.

Type is Arial/Helvetica. Card titles are 15px bold, body text 14px, hints 13px with 19px line
height, labels and column headers 12px bold. Spacing uses 4, 6, 8, 10, 12, 14, 16 and 20px.

## Components

- **Card:** `Section` in `components/event/settings-page/ui.tsx` (an `EventCard` with a title).
  Put a header action such as **+ Add** in its `action` slot, at the right of the title. Don't
  put a card inside a card. Inside an existing card, use a plain heading instead.
- **Switch:** `Toggle`, for one on/off choice that applies at once. It has a name and an
  on/off state for assistive technology.
- **Buttons:** `buttonStyle` (secondary), `primary()` (one main action per form) and
  `linkButtonStyle` (inline actions such as Change or Verify), all from
  `components/event/invitations/styles.ts`. Buttons and checkboxes are at least 40px tall and
  44px where they stand alone on phones.
- **Fields:** `FormField` + `AppInput` from `components/ui/AppPrimitives`.
- **Alerts:** `InlineAlert` for status lines (saving, saved, errors).

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

**Status chips.** Small pills: success colors for good states (Verified), neutral `inputBg`
with `textSecondary` for everything else (On file, Paused, Not verified).

**Pointers.** A card with a title and one sentence that names where to go.

## Checking a screen

When building or reviewing a screen, check that:

- it uses theme tokens and the shared components above;
- it offers no option the principles would leave out;
- every control has an accessible name, and switches and checkboxes expose their state;
- hint text is readable (`textSecondary` or brighter);
- it works at 390px wide with no sideways scrolling;
- it has no card inside a card and no duplicated settings from another page.
