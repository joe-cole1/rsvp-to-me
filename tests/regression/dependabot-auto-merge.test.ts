// Task 42bb7798: auto-merge must inspect every dependency and the exact signed
// PR head. A patch summary, a bot-authored PR, or green tests alone must not
// authorize mixed-major batches, edited commits, source changes, or bypasses.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";

const requireScript = createRequire(import.meta.url);
type Mutation = { query: string; variables: { id: string; head?: string } };
type Request = (path: string, body?: Mutation) => Promise<unknown>;
const { ineligibleReason, applyPolicy, githubRequest } = requireScript(
  "../../scripts/dependabot-auto-merge.cjs"
) as {
  ineligibleReason: (input: unknown) => string | null;
  applyPolicy: (options: {
    event: unknown;
    repository: string;
    metadata: string;
    request: Request;
    log: (message: string) => void;
  }) => Promise<void>;
  githubRequest: (token: string, fetchImpl: typeof fetch) => Request;
};

function fixture(directory = "/") {
  const repository = "joe-cole1/rsvp-to-me";
  const head = "a".repeat(40);
  const prefix = directory === "/" ? "" : "worker/";
  const pr = {
    number: 1000,
    node_id: "PR_fixture",
    state: "open",
    draft: false,
    merged: false,
    user: { login: "dependabot[bot]", type: "Bot" },
    base: { ref: "main", repo: { full_name: repository } },
    head: { sha: head, repo: { full_name: repository } },
    commits: 1,
    changed_files: 2,
    auto_merge: null as { enabled_by: { login: string } } | null,
  };
  return {
    repository,
    expectedHead: head,
    pr,
    commits: [
      {
        sha: head,
        author: { login: "dependabot[bot]" },
        commit: { verification: { verified: true } },
      },
    ],
    files: [
      {
        filename: `${prefix}package.json`,
        status: "modified",
        previous_filename: undefined as string | undefined,
      },
      {
        filename: `${prefix}package-lock.json`,
        status: "modified",
        previous_filename: undefined as string | undefined,
      },
    ],
    dependencies: [
      {
        dependencyName: "fixture-package",
        updateType: "version-update:semver-patch",
        packageEcosystem: "npm_and_yarn",
        directory,
        targetBranch: "main",
      },
    ],
    rules: [
      {
        type: "required_status_checks",
        parameters: {
          strict_required_status_checks_policy: true,
          required_status_checks: ["ci", "Container (amd64)", "Container (arm64)"].map(
            (context) => ({ context })
          ),
        },
      },
      { type: "pull_request" },
      {
        type: "code_scanning",
        parameters: {
          code_scanning_tools: [{ tool: "CodeQL", security_alerts_threshold: "high_or_higher" }],
        },
      },
    ],
  };
}

type Fixture = ReturnType<typeof fixture>;

function harness(data = fixture(), metadata = JSON.stringify(data.dependencies)) {
  const logs: string[] = [];
  const request = vi.fn(async (path: string, body?: Mutation) => {
    if (body) return { data: {} };
    if (path.includes("/commits?")) return data.commits;
    if (path.includes("/files?")) return data.files;
    if (path.endsWith("/rules/branches/main")) return data.rules;
    return data.pr;
  });
  const run = () =>
    applyPolicy({
      event: {
        repository: { full_name: data.repository },
        pull_request: { number: data.pr.number, head: { sha: data.expectedHead } },
      },
      repository: data.repository,
      metadata,
      request,
      log: (message) => logs.push(message),
    });
  return { run, request, logs };
}

describe("Dependabot auto-merge eligibility", () => {
  it.each(["/", "/worker"])("accepts a patch/minor batch in %s", async (directory) => {
    const data = fixture(directory);
    data.dependencies.push({
      ...data.dependencies[0],
      dependencyName: "another-package",
      updateType: "version-update:semver-minor",
    });
    expect(ineligibleReason(data)).toBeNull();
    const { run, request } = harness(data);
    await run();
    const mutations = request.mock.calls.filter(([, body]) => body);
    expect(mutations).toHaveLength(1);
    expect(mutations[0][0]).toBe("/graphql");
    expect(mutations[0][1]?.query).toContain("enablePullRequestAutoMerge");
    expect(mutations[0][1]?.query).toContain("expectedHeadOid: $head");
    expect(mutations[0][1]?.query).toContain("mergeMethod: SQUASH");
    expect(mutations[0][1]?.query).not.toContain("mergePullRequest(");
    expect(mutations[0][1]?.variables).toEqual({ id: data.pr.node_id, head: data.expectedHead });
  });

  const denied: [string, (data: Fixture) => void][] = [
    [
      "a human-authored PR",
      (data) => {
        data.pr.user.login = "maintainer";
      },
    ],
    [
      "a non-bot identity",
      (data) => {
        data.pr.user.type = "User";
      },
    ],
    [
      "a fork",
      (data) => {
        data.pr.head.repo.full_name = "someone/fork";
      },
    ],
    [
      "another base repository",
      (data) => {
        data.pr.base.repo.full_name = "someone/fork";
      },
    ],
    [
      "another target branch",
      (data) => {
        data.pr.base.ref = "release";
      },
    ],
    [
      "a draft",
      (data) => {
        data.pr.draft = true;
      },
    ],
    [
      "a closed PR",
      (data) => {
        data.pr.state = "closed";
      },
    ],
    [
      "an already merged PR",
      (data) => {
        data.pr.merged = true;
      },
    ],
    [
      "a different head",
      (data) => {
        data.pr.head.sha = "b".repeat(40);
      },
    ],
    [
      "additional commits",
      (data) => {
        data.pr.commits = 2;
      },
    ],
    [
      "an incomplete commit listing",
      (data) => {
        data.commits = [];
      },
    ],
    [
      "a mismatched commit",
      (data) => {
        data.commits[0].sha = "b".repeat(40);
      },
    ],
    [
      "a human commit",
      (data) => {
        data.commits[0].author.login = "maintainer";
      },
    ],
    [
      "an unverified signature",
      (data) => {
        data.commits[0].commit.verification.verified = false;
      },
    ],
    [
      "missing dependency metadata",
      (data) => {
        data.dependencies = [];
      },
    ],
    [
      "a major among patch updates",
      (data) => {
        data.dependencies.push({
          ...data.dependencies[0],
          updateType: "version-update:semver-major",
        });
      },
    ],
    [
      "an unknown update among patches",
      (data) => {
        data.dependencies.push({ ...data.dependencies[0], updateType: "" });
      },
    ],
    [
      "Actions updates",
      (data) => {
        data.dependencies[0].packageEcosystem = "github_actions";
      },
    ],
    [
      "another npm project",
      (data) => {
        data.dependencies[0].directory = "/other";
      },
    ],
    [
      "mixed npm projects",
      (data) => {
        data.dependencies.push({ ...data.dependencies[0], directory: "/worker" });
      },
    ],
    [
      "metadata for another target",
      (data) => {
        data.dependencies[0].targetBranch = "release";
      },
    ],
    [
      "a source change",
      (data) => {
        data.files[0].filename = "app/actions/auth.ts";
      },
    ],
    [
      "a workflow change",
      (data) => {
        data.files[0].filename = ".github/workflows/ci.yml";
      },
    ],
    [
      "the other project's lockfile",
      (data) => {
        data.files[0].filename = "worker/package-lock.json";
      },
    ],
    [
      "a deleted lockfile",
      (data) => {
        data.files[0].status = "removed";
      },
    ],
    [
      "a renamed manifest",
      (data) => {
        data.files[0].previous_filename = "another-file";
      },
    ],
    [
      "a truncated file list",
      (data) => {
        data.pr.changed_files = 3;
      },
    ],
    [
      "an empty file list",
      (data) => {
        data.files = [];
        data.pr.changed_files = 0;
      },
    ],
    [
      "missing status gates",
      (data) => {
        data.rules = data.rules.filter((rule) => rule.type !== "required_status_checks");
      },
    ],
    [
      "missing CodeQL protection",
      (data) => {
        data.rules = data.rules.filter((rule) => rule.type !== "code_scanning");
      },
    ],
    [
      "missing pull-request protection",
      (data) => {
        data.rules = data.rules.filter((rule) => rule.type !== "pull_request");
      },
    ],
  ];
  it.each(denied)("leaves %s for manual review", async (_, change) => {
    const data = fixture();
    change(data);
    expect(ineligibleReason(data)).toBeTypeOf("string");
    const { run, request } = harness(data);
    await run();
    expect(request.mock.calls.filter(([, body]) => body)).toEqual([]);
  });

  it("accepts an eligible transitive security fix that changes only the lockfile", () => {
    const data = fixture();
    data.files = [data.files[1]];
    data.pr.changed_files = 1;
    expect(ineligibleReason(data)).toBeNull();
  });

  it("requires all three checks and the up-to-date branch rule", () => {
    const data = fixture();
    data.rules[0].parameters!.strict_required_status_checks_policy = false;
    expect(ineligibleReason(data)).not.toBeNull();
    data.rules[0].parameters!.strict_required_status_checks_policy = true;
    data.rules[0].parameters!.required_status_checks = [{ context: "ci" }];
    expect(ineligibleReason(data)).not.toBeNull();
  });

  it("revokes its own enrollment when the PR becomes a draft", async () => {
    const data = fixture();
    data.pr.draft = true;
    data.pr.auto_merge = { enabled_by: { login: "github-actions[bot]" } };
    const { run, request } = harness(data);
    await run();
    const mutations = request.mock.calls.filter(([, body]) => body);
    expect(mutations).toHaveLength(1);
    expect(mutations[0][1]?.query).toContain("disablePullRequestAutoMerge");
  });

  it("revokes its own enrollment for missing or malformed metadata", async () => {
    for (const metadata of ["", "not-json", "null", "{}", "[]"]) {
      const data = fixture();
      data.pr.auto_merge = { enabled_by: { login: "github-actions[bot]" } };
      const { run, request } = harness(data, metadata);
      await run();
      expect(request.mock.calls.filter(([, body]) => body)[0]?.[1]?.query).toContain(
        "disablePullRequestAutoMerge"
      );
    }
  });

  it("preserves independently enabled maintainer auto-merge", async () => {
    const data = fixture();
    data.pr.draft = true;
    data.pr.auto_merge = { enabled_by: { login: "maintainer" } };
    const { run, request } = harness(data);
    await run();
    expect(request.mock.calls.filter(([, body]) => body)).toEqual([]);
  });

  it("does not revoke a newer head's enrollment from an old event", async () => {
    const data = fixture();
    data.pr.head.sha = "b".repeat(40);
    data.pr.auto_merge = { enabled_by: { login: "github-actions[bot]" } };
    const { run, request } = harness(data);
    await run();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("is idempotent when an eligible PR is already enrolled", async () => {
    const data = fixture();
    data.pr.auto_merge = { enabled_by: { login: "github-actions[bot]" } };
    const { run, request } = harness(data);
    await run();
    expect(request.mock.calls.filter(([, body]) => body)).toEqual([]);
  });

  it("stops without a mutation when eligibility API reads fail", async () => {
    const data = fixture();
    const { run, request } = harness(data);
    request.mockRejectedValueOnce(new Error("unavailable"));
    await expect(run()).rejects.toThrow("unavailable");
    expect(request.mock.calls.filter(([, body]) => body)).toEqual([]);
  });

  it("preserves an atomic head-mismatch rejection instead of retrying another head", async () => {
    const { run, request } = harness();
    request.mockImplementation(async (path, body) => {
      if (body) throw new Error("head changed");
      const data = fixture();
      if (path.includes("/commits?")) return data.commits;
      if (path.includes("/files?")) return data.files;
      if (path.endsWith("/rules/branches/main")) return data.rules;
      return data.pr;
    });
    await expect(run()).rejects.toThrow("head changed");
    expect(
      request.mock.calls.filter(([, body]) => body?.query.startsWith("mutation"))
    ).toHaveLength(1);
  });

  it("uses a protected head-bound squash merge if enrollment finds an already-green PR", async () => {
    const data = fixture();
    const { run, request } = harness(data);
    const normal = request.getMockImplementation()!;
    request.mockImplementation(async (path, body) => {
      if (body?.query.includes("enablePullRequestAutoMerge"))
        throw new Error("enrollment rejected");
      if (body?.query.startsWith("query")) {
        return { data: { node: { headRefOid: data.expectedHead, mergeStateStatus: "CLEAN" } } };
      }
      return normal(path, body);
    });
    await run();
    const merge = request.mock.calls.find(([, body]) =>
      body?.query.includes("mergePullRequest(")
    )?.[1];
    expect(merge?.query).toContain("expectedHeadOid: $head");
    expect(merge?.query).toContain("mergeMethod: SQUASH");
    expect(merge?.variables).toEqual({ id: data.pr.node_id, head: data.expectedHead });
  });

  it.each([
    ["CLEAN", "b".repeat(40)],
    ["BLOCKED", "a".repeat(40)],
    ["UNKNOWN", "a".repeat(40)],
  ])("does not merge with readiness %s at another or unready head", async (status, head) => {
    const { run, request } = harness();
    const normal = request.getMockImplementation()!;
    request.mockImplementation(async (path, body) => {
      if (body?.query.includes("enablePullRequestAutoMerge"))
        throw new Error("enrollment rejected");
      if (body?.query.startsWith("query")) {
        return { data: { node: { headRefOid: head, mergeStateStatus: status } } };
      }
      return normal(path, body);
    });
    await expect(run()).rejects.toThrow("enrollment rejected");
    expect(request.mock.calls.some(([, body]) => body?.query.includes("mergePullRequest("))).toBe(
      false
    );
  });
});

describe("auto-merge API errors", () => {
  it("does not surface tokens or response bodies on HTTP failures", async () => {
    const token = "fixture-private-token";
    const fetchImpl = vi.fn().mockResolvedValue(new Response(token, { status: 403 }));
    await expect(
      githubRequest(token, fetchImpl)("/graphql", { query: "mutation", variables: { id: "PR" } })
    ).rejects.toThrow("GitHub API request failed (HTTP 403).");
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${token}`);
  });

  it("fails on GraphQL errors even when HTTP succeeded", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ errors: [{ message: "fixture-private-detail" }] }))
      );
    await expect(
      githubRequest("fixture-token", fetchImpl)("/graphql", {
        query: "mutation",
        variables: { id: "PR" },
      })
    ).rejects.toThrow("GitHub rejected the auto-merge request.");
  });
});

describe("privileged Dependabot workflow boundary", () => {
  it("uses pinned trusted-base actions and the repository runtime without installing PR code", () => {
    const { load } = requireScript("js-yaml") as { load: (source: string) => unknown };
    const workflow = load(readFileSync(".github/workflows/dependabot-auto-merge.yml", "utf8")) as {
      on: Record<string, { branches: string[]; types: string[] }>;
      permissions: Record<string, string>;
      jobs: Record<
        string,
        {
          if: string;
          permissions: Record<string, string>;
          steps: {
            id?: string;
            uses?: string;
            run?: string;
            if?: string;
            with?: Record<string, unknown>;
            env?: Record<string, string>;
          }[];
        }
      >;
    };
    expect(Object.keys(workflow.on)).toEqual(["pull_request_target"]);
    expect(workflow.on.pull_request_target.branches).toEqual(["main"]);
    expect(workflow.on.pull_request_target.types).toEqual(
      expect.arrayContaining([
        "opened",
        "reopened",
        "synchronize",
        "ready_for_review",
        "converted_to_draft",
      ])
    );
    expect(workflow.permissions).toEqual({ contents: "read" });
    const job = workflow.jobs.enroll;
    expect(job.if).toContain("github.repository == 'joe-cole1/rsvp-to-me'");
    expect(job.if).toContain("github.event.pull_request.user.login == 'dependabot[bot]'");
    expect(job.if).toContain("github.event.pull_request.head.repo.full_name == github.repository");
    expect(job.permissions).toEqual({ contents: "write", "pull-requests": "write" });
    const checkout = job.steps.find((step) => step.uses?.startsWith("actions/checkout@"))!;
    expect(checkout.with?.ref).toBeUndefined();
    expect(checkout.with?.["persist-credentials"]).toBe(false);
    const node = job.steps.find((step) => step.uses?.startsWith("actions/setup-node@"))!;
    expect(node.with?.["node-version-file"]).toBe(".nvmrc");
    for (const step of job.steps.filter((step) => step.uses)) {
      expect(step.uses).toMatch(/@[a-f0-9]{40}$/);
    }
    const metadata = job.steps.find((step) => step.id === "metadata")!;
    expect(metadata.with?.["skip-verification"]).not.toBe(true);
    expect(metadata.with?.["skip-commit-verification"]).not.toBe(true);
    const apply = job.steps.find((step) => step.run?.includes("dependabot-auto-merge.cjs"))!;
    expect(apply.if).toContain("!cancelled()");
    expect(apply.env?.GH_TOKEN).toBe("${{ github.token }}");
    expect(apply.env?.DEPENDABOT_METADATA).toBe(
      "${{ steps.metadata.outputs.updated-dependencies-json }}"
    );
    const commands = job.steps.map((step) => step.run ?? "").join("\n");
    expect(commands).not.toMatch(/\bnpm\b|\bnpx\b|gh pr checkout|--admin|--force|git push/);
  });
});
