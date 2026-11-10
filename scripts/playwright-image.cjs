// Resolve the browser environment from the package installed by npm ci. There is
// no second version pin to maintain when Dependabot updates Playwright.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Plain Node CLI, matching the other CJS scripts.
const { version } = require("@playwright/test/package.json");

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  throw new Error(`Cannot select a stable Playwright Docker image for ${version}`);
}

process.stdout.write(`mcr.microsoft.com/playwright:v${version}-noble\n`);
