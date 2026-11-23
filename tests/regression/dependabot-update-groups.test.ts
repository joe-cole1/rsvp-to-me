// November 2026, task 42bb7798, follow-up to #938: package-specific groups
// without update-types captured minor/patch updates before the routine batch.
// Live Dependabot jobs prioritize more-specific patterns, so declaration order
// alone cannot keep those groups major-only. Assert complementary version scopes
// directly rather than simulating first-match routing.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const { load } = createRequire(import.meta.url)("js-yaml") as {
  load: (source: string) => unknown;
};

type UpdateType = "major" | "minor" | "patch";
type Group = {
  patterns: string[];
  "applies-to"?: "version-updates" | "security-updates";
  "update-types"?: UpdateType[];
};
type UpdateJob = {
  "package-ecosystem": string;
  directory: string;
  groups: Record<string, Group>;
};

const config = load(
  readFileSync(new URL("../../.github/dependabot.yml", import.meta.url), "utf8")
) as { updates: UpdateJob[] };
const app = config.updates.find(
  (job) => job["package-ecosystem"] === "npm" && job.directory === "/"
)!;

function updateTypes(group: Group): UpdateType[] {
  // Dependabot includes all semantic version levels when the rule is omitted.
  return group["update-types"] ?? ["major", "minor", "patch"];
}

describe("Dependabot routine batches and coordinated major upgrades", () => {
  it.each(["next-toolchain", "radix-ui", "prisma", "react", "vitest", "react-email"])(
    "%s cannot compete with the routine batch for patch/minor updates",
    (name) => {
      const family = app.groups[name];
      const routine = app.groups["app-routine"];
      expect(family).toBeDefined();
      expect(family["applies-to"] ?? "version-updates").toBe("version-updates");
      expect(updateTypes(family)).toContain("major");
      expect(updateTypes(family).filter((level) => updateTypes(routine).includes(level))).toEqual(
        []
      );
    }
  );

  it.each(
    config.updates.map((job) => ({
      label: `${job["package-ecosystem"]} in ${job.directory}`,
      job,
    }))
  )("$label keeps routine and security scopes separate", ({ job }) => {
    const groups = Object.values(job.groups);
    const routine = groups.filter(
      (group) =>
        (group["applies-to"] ?? "version-updates") === "version-updates" &&
        group.patterns.includes("*")
    );
    expect(routine).toHaveLength(1);
    expect(updateTypes(routine[0])).toEqual(expect.arrayContaining(["minor", "patch"]));
    expect(updateTypes(routine[0])).not.toContain("major");

    const security = groups.filter(
      (group) => group["applies-to"] === "security-updates" && group.patterns.includes("*")
    );
    expect(security).toHaveLength(1);
    expect(updateTypes(security[0])).toEqual(expect.arrayContaining(["major", "minor", "patch"]));
  });
});
