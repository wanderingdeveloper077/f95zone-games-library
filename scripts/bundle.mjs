import fs from "node:fs";
import fsp from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");
const outDir = path.join(repoRoot, "release", "game-library-win");
const serverOutDir = path.join(outDir, "server");

async function isFileLocked(filePath) {
  if (!fs.existsSync(filePath)) return false;
  try {
    const handle = await fsp.open(filePath, "r+");
    await handle.close();
    return false;
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? err.code : "";
    return code === "EBUSY" || code === "EPERM" || code === "EACCES";
  }
}

async function hasLockedNativeAddon(dir) {
  if (!fs.existsSync(dir)) return false;
  for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (await hasLockedNativeAddon(fullPath)) return true;
    } else if (entry.name.endsWith(".node") && (await isFileLocked(fullPath))) {
      return true;
    }
  }
  return false;
}

async function copyDirPreservingLocked(srcDir, destDir) {
  await fsp.mkdir(destDir, { recursive: true });
  for (const entry of await fsp.readdir(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      await copyDirPreservingLocked(srcPath, destPath);
    } else if (entry.name.endsWith(".node") && (await isFileLocked(destPath))) {
      console.log(
        `[bundle] Skipping locked native binary: ${path.relative(outDir, destPath)}`
      );
    } else {
      await fsp.copyFile(srcPath, destPath);
    }
  }
}

async function copyPackageWithDeps(
  pkgName,
  fromDir,
  nodeModulesDest,
  visited = new Set()
) {
  if (visited.has(pkgName)) return;
  visited.add(pkgName);

  const pkgRequire = createRequire(path.join(fromDir, "package.json"));
  const pkgJsonPath = pkgRequire.resolve(`${pkgName}/package.json`);
  const pkgRoot = path.dirname(pkgJsonPath);
  const destRoot = path.join(nodeModulesDest, ...pkgName.split("/"));

  await copyDirPreservingLocked(pkgRoot, destRoot);

  const pkgJson = JSON.parse(await fsp.readFile(pkgJsonPath, "utf8"));
  for (const dep of Object.keys(pkgJson.dependencies ?? {})) {
    await copyPackageWithDeps(dep, pkgRoot, nodeModulesDest, visited);
  }
}

async function main() {
  const serverDist = path.join(repoRoot, "apps", "server", "dist");
  const webDist = path.join(repoRoot, "apps", "web", "dist");
  const drizzleDir = path.join(repoRoot, "apps", "server", "drizzle");
  const extOutputDir = path.join(repoRoot, "apps", "extension", ".output");

  if (!fs.existsSync(path.join(serverDist, "index.js"))) {
    throw new Error("apps/server/dist/index.js not found. Run pnpm build first.");
  }
  if (!fs.existsSync(path.join(webDist, "index.html"))) {
    throw new Error("apps/web/dist/index.html not found. Run pnpm build first.");
  }
  if (!fs.existsSync(drizzleDir)) {
    throw new Error("apps/server/drizzle not found. Run db:generate first.");
  }

  const nodeModulesOutDir = path.join(outDir, "node_modules");
  const preserveNodeModules = await hasLockedNativeAddon(nodeModulesOutDir);

  if (fs.existsSync(outDir)) {
    for (const entry of await fsp.readdir(outDir)) {
      if (entry === "data") continue;
      if (entry === "node_modules" && preserveNodeModules) {
        console.log(
          "[bundle] Preserving locked native addons in node_modules while refreshing package files."
        );
        continue;
      }
      await fsp.rm(path.join(outDir, entry), {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 200,
      });
    }
  }
  await fsp.mkdir(serverOutDir, { recursive: true });
  await fsp.mkdir(path.join(outDir, "data", "covers"), { recursive: true });

  const bannerJs = [
    'import { createRequire as __bundleCreateRequire } from "node:module";',
    "const require = __bundleCreateRequire(import.meta.url);",
  ].join("\n");

  const commonEsbuildOptions = {
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    external: ["better-sqlite3"],
    banner: { js: bannerJs },
    sourcemap: false,
    logLevel: "info",
  };

  await esbuild.build({
    ...commonEsbuildOptions,
    entryPoints: [path.join(serverDist, "index.js")],
    outfile: path.join(serverOutDir, "index.mjs"),
  });

  await esbuild.build({
    ...commonEsbuildOptions,
    entryPoints: [path.join(serverDist, "worker", "indexer.worker.js")],
    outfile: path.join(serverOutDir, "indexer.worker.mjs"),
  });

  const serverDir = path.join(repoRoot, "apps", "server");
  await copyPackageWithDeps("better-sqlite3", serverDir, nodeModulesOutDir);

  await fsp.cp(webDist, path.join(outDir, "web"), { recursive: true });
  await fsp.cp(drizzleDir, path.join(outDir, "drizzle"), { recursive: true });

  if (fs.existsSync(extOutputDir)) {
    const extDest = path.join(outDir, "extensions");
    for (const entry of await fsp.readdir(extOutputDir, { withFileTypes: true })) {
      if (entry.isDirectory() && !entry.name.endsWith("-sources")) {
        await fsp.cp(
          path.join(extOutputDir, entry.name),
          path.join(extDest, entry.name),
          { recursive: true }
        );
      }
    }
  }

  const startBat = [
    "@echo off",
    "setlocal",
    'set "ROOT=%~dp0"',
    'if "%PORT%"=="" set "PORT=57095"',
    'set "NODE_ENV=production"',
    'set "DATA_DIR=%ROOT%data"',
    'set "WEB_DIST_DIR=%ROOT%web"',
    'set "MIGRATIONS_DIR=%ROOT%drizzle"',
    "echo Starting Game Library Manager on http://127.0.0.1:%PORT% ...",
    'start "" "http://127.0.0.1:%PORT%"',
    'node "%ROOT%server\\index.mjs"',
    "endlocal",
  ].join("\r\n");

  const startPs1 = [
    "$ErrorActionPreference = 'Stop'",
    "$root = $PSScriptRoot",
    "if (-not $env:PORT) { $env:PORT = '57095' }",
    "$env:NODE_ENV = 'production'",
    "$env:DATA_DIR = Join-Path $root 'data'",
    "$env:WEB_DIST_DIR = Join-Path $root 'web'",
    "$env:MIGRATIONS_DIR = Join-Path $root 'drizzle'",
    'Write-Host "Starting Game Library Manager on http://127.0.0.1:$($env:PORT) ..."',
    'Start-Process "http://127.0.0.1:$($env:PORT)"',
    "& node (Join-Path (Join-Path $root 'server') 'index.mjs')",
  ].join("\r\n");

  const readmeTxt = [
    "Game Library Manager — Standalone Windows Bundle",
    "================================================",
    "",
    "Prerequisites: Node.js 22+ (tested on Node v26) installed on Windows.",
    "",
    "Quick Start:",
    "1. Double-click start.bat (or run powershell -File start.ps1).",
    "2. Your browser opens http://127.0.0.1:57095 automatically.",
    "3. Load the unpacked browser extension from extensions\\chrome-mv3 (or extensions\\firefox-mv2)",
    "   and pair it using Settings & Pairing in the web UI.",
    "",
    "Runtime Data:",
    "- SQLite database (WAL mode), encryption keyfile, pairing token, and cached covers",
    "  are stored inside the ./data directory next to this bundle.",
  ].join("\r\n");

  await fsp.writeFile(path.join(outDir, "start.bat"), startBat, "utf8");
  await fsp.writeFile(path.join(outDir, "start.ps1"), startPs1, "utf8");
  await fsp.writeFile(path.join(outDir, "README.txt"), readmeTxt, "utf8");

  console.log(`[bundle] Standalone Windows package created at: ${outDir}`);
}

main().catch((err) => {
  console.error("[bundle] Failed:", err);
  process.exit(1);
});
