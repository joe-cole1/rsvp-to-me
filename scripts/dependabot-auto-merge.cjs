// Runs only from trusted base-branch code in dependabot-auto-merge.yml.
// No npm install or PR-controlled code is needed to make this decision.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Standalone Node CLI, matching the repository's CJS scripts.
const { readFileSync } = require("node:fs");

const BOT = "dependabot[bot]";
const AUTOMATION = "github-actions[bot]";
const UPDATE_TYPES = new Set(["version-update:semver-patch", "version-update:semver-minor"]);
const REQUIRED_CHECKS = ["ci", "Container (amd64)", "Container (arm64)"];

function hasMergeGates(rules) {
  if (!Array.isArray(rules)) return false;
  const statusRules = rules.filter((rule) => rule.type === "required_status_checks");
  const checks = statusRules.flatMap((rule) => rule.parameters?.required_status_checks ?? []);
  return (
    statusRules.some((rule) => rule.parameters?.strict_required_status_checks_policy === true) &&
    REQUIRED_CHECKS.every((name) => checks.some((check) => check.context === name)) &&
    rules.some((rule) => rule.type === "pull_request") &&
    rules.some(
      (rule) =>
        rule.type === "code_scanning" &&
        rule.parameters?.code_scanning_tools?.some(
          (tool) =>
            tool.tool === "CodeQL" &&
            ["all", "low_or_higher", "medium_or_higher", "high_or_higher"].includes(
              tool.security_alerts_threshold
            )
        )
    )
  );
}

function ineligibleReason({ repository, expectedHead, pr, commits, files, dependencies, rules }) {
  if (
    pr?.user?.login !== BOT ||
    pr.user.type !== "Bot" ||
    pr.base?.repo?.full_name !== repository ||
    pr.head?.repo?.full_name !== repository ||
    pr.base.ref !== "main"
  ) {
    return "Only same-repository Dependabot PRs targeting main qualify.";
  }
  if (pr.state !== "open" || pr.draft || pr.merged || pr.head.sha !== expectedHead) {
    return "The PR must be open, ready for review, and at the event head SHA.";
  }
  if (
    pr.commits !== 1 ||
    !Array.isArray(commits) ||
    commits.length !== 1 ||
    commits[0].sha !== expectedHead ||
    commits[0].author?.login !== BOT ||
    commits[0].commit?.verification?.verified !== true
  ) {
    return "A single verified Dependabot commit is required; edited PRs need manual review.";
  }
  if (!Array.isArray(dependencies) || dependencies.length === 0) {
    return "Verified per-dependency metadata is missing.";
  }
  const directory = dependencies[0]?.directory;
  if (
    !["/", "/worker"].includes(directory) ||
    !dependencies.every(
      (dependency) =>
        dependency &&
        typeof dependency.dependencyName === "string" &&
        dependency.dependencyName.length > 0 &&
        dependency.packageEcosystem === "npm_and_yarn" &&
        dependency.targetBranch === "main" &&
        dependency.directory === directory &&
        UPDATE_TYPES.has(dependency.updateType)
    )
  ) {
    return "Every update must be an npm patch/minor in the application or worker.";
  }
  const prefix = directory === "/" ? "" : "worker/";
  const allowedFiles = new Set([`${prefix}package.json`, `${prefix}package-lock.json`]);
  if (
    !Array.isArray(files) ||
    files.length === 0 ||
    files.length > allowedFiles.size ||
    pr.changed_files !== files.length ||
    !files.every(
      (file) =>
        allowedFiles.has(file.filename) && file.status === "modified" && !file.previous_filename
    )
  ) {
    return "Only the selected project's existing package manifest and lockfile may change.";
  }
  if (!hasMergeGates(rules)) {
    return "Required CI, container, CodeQL, or up-to-date branch protections are missing.";
  }
  return null;
}

async function applyPolicy({ event, repository, metadata, request, log = console.log }) {
  const number = event.pull_request?.number;
  const expectedHead = event.pull_request?.head?.sha;
  if (
    !/^[\w.-]+\/[\w.-]+$/.test(repository ?? "") ||
    event.repository?.full_name !== repository ||
    !Number.isSafeInteger(number) ||
    number <= 0 ||
    !/^[a-f0-9]{40}$/.test(expectedHead ?? "")
  ) {
    throw new Error("Invalid pull-request event context.");
  }
  const path = `/repos/${repository}/pulls/${number}`;
  const pr = await request(path);
  // An older run must neither enroll an unseen head nor revoke a newer run.
  if (pr.head?.sha !== expectedHead || pr.state !== "open") {
    log("Skipped superseded or closed PR event.");
    return;
  }
  const [commits, files, rules] = await Promise.all([
    request(`${path}/commits?per_page=2`),
    request(`${path}/files?per_page=100`),
    request(`/repos/${repository}/rules/branches/main`),
  ]);
  let dependencies;
  try {
    dependencies = JSON.parse(metadata);
  } catch {
    dependencies = [];
  }
  const reason = ineligibleReason({
    repository,
    expectedHead,
    pr,
    commits,
    files,
    dependencies,
    rules,
  });
  if (reason) {
    // Preserve a maintainer's independently enabled auto-merge setting.
    if (pr.user?.login === BOT && pr.auto_merge?.enabled_by?.login === AUTOMATION) {
      await request("/graphql", {
        query:
          "mutation($id: ID!) { disablePullRequestAutoMerge(input: {pullRequestId: $id}) { clientMutationId } }",
        variables: { id: pr.node_id },
      });
      log("Revoked workflow auto-merge enrollment.");
    }
    log(`Manual review: ${reason}`);
    return;
  }
  if (pr.auto_merge) {
    log("Auto-merge is already enabled; required merge gates still apply.");
    return;
  }
  try {
    await request("/graphql", {
      query: `mutation($id: ID!, $head: GitObjectID!) {
        enablePullRequestAutoMerge(input: {
          pullRequestId: $id, expectedHeadOid: $head, mergeMethod: SQUASH
        }) { clientMutationId }
      }`,
      variables: { id: pr.node_id, head: expectedHead },
    });
  } catch (error) {
    // Enrollment can be rejected when all gates have already passed. Inspect
    // structured readiness instead of matching GitHub's error message prose.
    const readiness = await request("/graphql", {
      query: `query($id: ID!) {
        node(id: $id) { ... on PullRequest { headRefOid mergeStateStatus } }
      }`,
      variables: { id: pr.node_id },
    });
    if (
      readiness.data?.node?.headRefOid !== expectedHead ||
      readiness.data.node.mergeStateStatus !== "CLEAN"
    ) {
      throw error;
    }
    // This is a normal protected merge, with no administrator bypass. The API
    // checks the same expected head atomically and still enforces merge rules.
    await request("/graphql", {
      query: `mutation($id: ID!, $head: GitObjectID!) {
        mergePullRequest(input: {
          pullRequestId: $id, expectedHeadOid: $head, mergeMethod: SQUASH
        }) { clientMutationId }
      }`,
      variables: { id: pr.node_id, head: expectedHead },
    });
    log("Squash-merged the verified ready head through GitHub's required merge gates.");
    return;
  }
  log("Enabled squash auto-merge for the verified head; GitHub enforces required merge gates.");
}

function githubRequest(token, fetchImpl = fetch) {
  if (!token) throw new Error("GitHub workflow token is missing.");
  return async (path, body) => {
    const response = await fetchImpl(`https://api.github.com${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error(`GitHub API request failed (HTTP ${response.status}).`);
    const result = await response.json();
    if (result.errors?.length) throw new Error("GitHub rejected the auto-merge request.");
    return result;
  };
}

module.exports = { hasMergeGates, ineligibleReason, applyPolicy, githubRequest };

if (require.main === module) {
  Promise.resolve()
    .then(() =>
      applyPolicy({
        event: JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8")),
        repository: process.env.GITHUB_REPOSITORY,
        metadata: process.env.DEPENDABOT_METADATA,
        request: githubRequest(process.env.GH_TOKEN),
      })
    )
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
