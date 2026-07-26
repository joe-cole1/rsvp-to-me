"use strict";

// CommonJS is required to preserve the callable API consumed by minimatch 3.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const patched = require("brace-expansion-patched");

module.exports = Object.assign(patched.expand, patched);
