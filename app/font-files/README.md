# Bundled Roboto

`roboto-normal.woff2` is Roboto 3.015 from the official Google Fonts repository,
licensed under the adjacent `OFL-Roboto.txt`. It includes the source font's full
glyph set and variable weight/width axes. `app/fonts.ts` uses the normal-width
default and exposes weights 400–700 through the existing `--font-roboto`
variable, with `display: swap`, Arial fallback adjustment, and no preload.

- Source commit: `6183fc0d26361f6ddfd6f6b7a736e1467c6d8a43`
- Source file: [Roboto\[wdth,wght\].ttf](https://github.com/google/fonts/blob/6183fc0d26361f6ddfd6f6b7a736e1467c6d8a43/ofl/roboto/Roboto%5Bwdth%2Cwght%5D.ttf)
- Source SHA-256: `d7598e12c5dbef095ff8272cfc55da0250bd07fbdecbac8a530b9b277872a134`
- WOFF2 SHA-256: `f2c9dbf532e554141e3940e974a90cc07f931e20ece062882ae1eb5358f19b94`
- Conversion: FontTools 4.66.1 and Brotli 1.2.0; set `TTFont(source).flavor`
  to `"woff2"` and save. No glyphs were subset or outlines modified.

## Why it is local

PR #699's AMD64 build failed in Roboto's generated CSS with
`next/font/google queries have exactly one entry`. Google sometimes returns
valid WOFF2 files through extensionless `/l/font?kit=...&skey=...&v=...` URLs.
Next.js 16.3.8's Rust font loader parses its JSON options as a query string,
splitting the embedded `&` characters into multiple entries. It also requires
a filename extension. This is the upstream defect in
[Next.js #99114](https://github.com/vercel/next.js/issues/99114).

The upstream offline reproduction was run against 16.3.8 and produced the same
Turbopack error. The architecture split comes from independent Google responses,
not a missing AMD64 npm package. Bundling the affected font removes that input
from the parser while retaining Next's supported font optimization and the
production Turbopack build. The other theme fonts retain their existing loaders.

`tests/regression/roboto-font-build.test.ts` builds the actual `app/fonts.ts`
in an isolated Next.js fixture. Google responses are mocked offline, including
the broken Roboto response shape. It verifies that the local WOFF2 is emitted,
the CSS variable and weights survive, and fonts are not preloaded. Restoring
the Google Roboto loader makes the fixture fail with the original parser error.

For future asset updates, obtain the font and license together from a pinned
official source commit, retain the glyph set, update both checksums, and run
the font regression, full CI, and both container architectures.
