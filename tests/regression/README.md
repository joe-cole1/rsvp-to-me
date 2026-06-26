# Regression Tests

Tests that reproduce specific bugs found in production or staging. Each file corresponds to a specific bug fix.

## Convention

For every bug fix merged to main:

1. Create a test file named after the bug: `tests/regression/issue-123-slug-collision.test.ts`
2. The test must **fail** before the fix is applied and **pass** after
3. Add a comment at the top explaining the original bug, when it was found, and what caused it
4. Update the index table below
5. These run as part of `npm test` — use the standard Vitest unit test setup (mocking, factories)

## Index

| File | Bug description | Fixed in |
|------|----------------|----------|
| (none yet) | | |
