// Regression (2026-10-23, fixed in cb58e723): preflight's unit stage ran 290 test
// files instead of 134 and failed. Root cause: Claude Code desktop sessions keep
// git worktrees under `.claude/worktrees/` inside the repo, and Vitest's default
// include scanned them, running another checkout's tests against this checkout's
// `@/` alias. The unit config now excludes `.claude/**`.
import { describe, expect, it } from "vitest";
import config from "@/vitest.config";

describe("unit test discovery", () => {
  it("skips agent worktrees nested under .claude/", () => {
    expect(config.test?.exclude).toContain("**/.claude/**");
  });
  it("skips generated test/build fixtures nested under .vitest/", () => {
    expect(config.test?.exclude).toContain("**/.vitest/**");
  });
});
