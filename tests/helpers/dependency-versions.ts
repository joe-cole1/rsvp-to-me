import { expect } from "vitest";

export type LockedPackages = Record<string, { version?: string; dev?: boolean }>;

// Security floors describe the first supported patched release, never the
// release currently selected in a manifest. Prereleases need a separate review.
export function atLeast(version: string, floor: string): boolean {
  const stable = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\+[\w.-]+)?$/;
  const actual = stable.exec(version)?.slice(1, 4).map(Number);
  const minimum = stable.exec(floor)?.slice(1, 4).map(Number);
  if (!actual || !minimum) return false;
  for (let index = 0; index < 3; index++) {
    if (actual[index] !== minimum[index]) return actual[index] > minimum[index];
  }
  return true;
}

export function resolutions(packages: LockedPackages, name: string) {
  return Object.entries(packages).filter(
    ([path]) => path === `node_modules/${name}` || path.endsWith(`/node_modules/${name}`)
  );
}

export function assertDependencyFloor(path: string, actual: string | undefined, floor: string) {
  expect(
    atLeast(actual ?? "", floor),
    `${path}: expected stable version at least ${floor}; received ${actual ?? "<missing>"}`
  ).toBe(true);
}

export function assertResolvedFloor(
  packages: LockedPackages,
  name: string,
  floor: string,
  required = false
) {
  // A transitive package disappearing is a valid remediation. Direct packages
  // still have to exist at the root, and every nested resolution is checked.
  if (required) expect(packages[`node_modules/${name}`], `${name} is required`).toBeDefined();
  for (const [path, entry] of resolutions(packages, name)) {
    assertDependencyFloor(path, entry.version, floor);
  }
}

// An advisory may affect one band of majors while older lines stay unaffected
// (minimatch 3 is outside GHSA-g3hv-75wg-m249). `fixed` is the first patched
// release after the affected band; prereleases and malformed versions fail.
export function outsideAffectedRange(version: string, introduced: string, fixed: string): boolean {
  if (!atLeast(version, "0.0.0")) return false;
  return !atLeast(version, introduced) || atLeast(version, fixed);
}

export function assertResolvedOutsideRange(
  packages: LockedPackages,
  name: string,
  introduced: string,
  fixed: string
) {
  // As with floors, upstream removing the transitive package is a valid fix.
  for (const [path, entry] of resolutions(packages, name)) {
    expect(
      outsideAffectedRange(entry.version ?? "", introduced, fixed),
      `${path}: expected a stable version below ${introduced} or at least ${fixed}; received ${entry.version ?? "<missing>"}`
    ).toBe(true);
  }
}
