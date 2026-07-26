# brace-expansion compatibility adapter

This temporary package preserves both supported module interfaces while the
ESLint 9 dependency tree still resolves `minimatch` 3:

- legacy CommonJS consumers can call the package directly;
- modern ESM and CommonJS consumers can call its named `expand` export.

Both interfaces delegate to the official patched `brace-expansion` 5.0.8
package. The adapter contains no expansion algorithm and does not patch
`node_modules`.

The root `.npmrc` sets `install-links=true` so npm installs this local package
as a regular dependency instead of creating depth-relative symlinks.

Removal is tracked by
[issue #546](https://github.com/joe-cole1/rsvp-to-me/issues/546). Remove this
directory, its scoped override, and the npm setting once supported upstream
ESLint packages no longer resolve the vulnerable legacy API. Follow the issue's
removal checklist and run the full `scripts/preflight.sh`.
