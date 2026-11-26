import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SEMVER_RE =
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

const MANIFEST_PATHS = [
  "package.json",
  "packages/shared/package.json",
  "apps/server/package.json",
  "apps/web/package.json",
  "apps/extension/package.json",
];

function validateVersion(version) {
  if (!version || !SEMVER_RE.test(version)) {
    throw new Error(
      `Invalid semver version "${version ?? ""}". Expected X.Y.Z format.`
    );
  }
}

function writeNextVersionMarker(version) {
  validateVersion(version);
  const releaseDir = path.join(repoRoot, "release");
  fs.mkdirSync(releaseDir, { recursive: true });
  const markerPath = path.join(releaseDir, ".next-version");
  fs.writeFileSync(markerPath, `${version}\n`, "utf8");
  console.log(`[sync-version] Wrote next-version marker ${version}`);
}

function syncAllVersions(version) {
  validateVersion(version);

  for (const relPath of MANIFEST_PATHS) {
    const absPath = path.join(repoRoot, ...relPath.split("/"));
    const pkg = JSON.parse(fs.readFileSync(absPath, "utf8"));
    pkg.version = version;
    fs.writeFileSync(absPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  }

  const versionTsPath = path.join(
    repoRoot,
    "packages",
    "shared",
    "src",
    "version.ts"
  );
  fs.writeFileSync(
    versionTsPath,
    `export const APP_VERSION = ${JSON.stringify(version)};\n`,
    "utf8"
  );

  console.log(
    `[sync-version] Synced version ${version} across ${MANIFEST_PATHS.length} manifests and packages/shared/src/version.ts`
  );
}

const args = process.argv.slice(2);
if (args[0] === "--write-marker") {
  writeNextVersionMarker(args[1]);
} else {
  syncAllVersions(args[0]);
}
