/* eslint-disable @typescript-eslint/no-require-imports */
// Release tags must never let a prerelease move the stable image aliases.
const fs = require("node:fs");

function releaseImageTags(release) {
  if (!release || release.draft !== false || typeof release.prerelease !== "boolean") {
    throw new Error("Expected a published GitHub release with an explicit prerelease flag");
  }
  // Docker tags cannot contain SemVer's +build metadata. Reject unsupported
  // names instead of silently normalizing two release names to the same tag.
  const match =
    /^v((0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?)$/.exec(
      release.tag_name
    );
  if (!match || match[1].length > 128 || match[5]?.split(".").some((part) => /^0\d+$/.test(part))) {
    throw new Error("Release tag must be vMAJOR.MINOR.PATCH with an optional SemVer prerelease");
  }
  const [, version, major, minor, , suffix] = match;
  // Either signal is sufficient: an rc tag remains isolated even if someone
  // forgets the GitHub prerelease checkbox; that checkbox also protects a bare version.
  return release.prerelease || suffix ? [version] : [version, `${major}.${minor}`, "latest"];
}

if (require.main === module) {
  const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
  const rules = releaseImageTags(event.release).map((tag) => `type=raw,value=${tag}`);
  fs.appendFileSync(
    process.env.GITHUB_OUTPUT,
    `tags<<RSVP_RELEASE_TAGS\n${rules.join("\n")}\nRSVP_RELEASE_TAGS\n`
  );
}

module.exports = { releaseImageTags };
