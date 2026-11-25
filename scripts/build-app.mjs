import { spawn } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import * as ResEdit from "resedit";
import { buildWindowsIcons, encodeIcns } from "./icons.mjs";
import { createMacDmg } from "./macos-dmg.mjs";
import { decodePng, scalePng } from "./png.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "release", "standalone");
const stagingDir = path.join(root, "release", ".sea-tmp");

const APP_NAME = "Game Library Manager";
const APP_ID = "com.gamelibrary.manager";
const APP_VERSION = "1.0.0";

function run(command, args, cwd, useShell = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      shell: useShell,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else
        reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}

function runPnpm(args, cwd) {
  if (process.platform === "win32") {
    const comspec = process.env.ComSpec || "cmd.exe";
    return run(comspec, ["/d", "/s", "/c", ["pnpm", ...args].join(" ")], cwd);
  }
  return run("pnpm", args, cwd);
}

function runCapture(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve(stdout.trim());
      else
        reject(
          new Error(
            `${command} ${args.join(" ")} exited with ${code}${stderr ? `: ${stderr.trim()}` : ""}`
          )
        );
    });
  });
}

function requestedMacArch() {
  const arg = process.argv.find((value) => value.startsWith("--arch="));
  if (arg !== undefined) {
    const arch = arg.slice("--arch=".length);
    if (arch !== "arm64" && arch !== "x64") {
      throw new Error(`Unknown --arch ${arch}. Use arm64 or x64.`);
    }
    return arch;
  }
  return process.platform === "darwin" ? process.arch : "arm64";
}

const wantDmg = process.argv.includes("--dmg");

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Windows antivirus scanners often lock newly created executables briefly after --build-sea.
async function withRetry(action, attempts = 12) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await action();
    } catch (err) {
      const retryable = ["EBUSY", "EPERM", "EACCES"].includes(err?.code);
      if (attempt >= attempts || !retryable) throw err;
      await delay(300);
    }
  }
}

function resolveBaseIconPath() {
  const candidates = [
    path.join(root, "apps", "web", "public", "icons", "128.png"),
    path.join(root, "apps", "extension", "public", "icon", "128.png"),
  ];
  const found = candidates.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error("Source 128x128 PNG icon not found.");
  }
  return found;
}

function writeWebIcons() {
  const source = decodePng(fs.readFileSync(resolveBaseIconPath()));
  const directory = path.join(root, "apps", "web", "public", "icons");
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "icon-192.png"), scalePng(source, 192));
  fs.writeFileSync(path.join(directory, "icon-512.png"), scalePng(source, 512));
}

function appIconSource() {
  return decodePng(
    fs.readFileSync(
      path.join(root, "apps", "web", "public", "icons", "icon-512.png")
    )
  );
}

function listFiles(dir, base = dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(full, base));
    } else {
      files.push(path.relative(base, full).split(path.sep).join("/"));
    }
  }
  return files;
}

async function bundleCjsEntrypoints() {
  fs.mkdirSync(stagingDir, { recursive: true });
  const serverOut = path.join(stagingDir, "server.cjs");
  const workerOut = path.join(stagingDir, "indexer.worker.cjs");

  const commonOptions = {
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node22",
    sourcemap: false,
    logLevel: "warning",
    define: {
      "import.meta.url": "undefined",
    },
  };

  await esbuild.build({
    ...commonOptions,
    entryPoints: [path.join(root, "apps", "server", "dist", "index.js")],
    outfile: serverOut,
  });

  await esbuild.build({
    ...commonOptions,
    entryPoints: [
      path.join(root, "apps", "server", "dist", "worker", "indexer.worker.js"),
    ],
    outfile: workerOut,
  });

  return { serverOut, workerOut };
}

function resolveBetterSqliteAddon() {
  const prebuildName = `${process.platform}-${process.arch}.node`;
  const nativeCandidates = [
    path.join(
      root,
      "apps",
      "server",
      "node_modules",
      "better-sqlite3",
      "build",
      "Release",
      "better_sqlite3.node"
    ),
    path.join(
      root,
      "apps",
      "server",
      "node_modules",
      "better-sqlite3",
      "prebuilds",
      prebuildName
    ),
  ];
  const nativeAddon = nativeCandidates.find((p) => fs.existsSync(p));
  if (!nativeAddon) {
    throw new Error(
      `better-sqlite3 native binary not found for ${process.platform}-${process.arch}.`
    );
  }
  return nativeAddon;
}

function collectSeaAssets(workerOut) {
  const assets = {};

  const webDist = path.join(root, "apps", "web", "dist");
  if (!fs.existsSync(path.join(webDist, "index.html"))) {
    throw new Error("apps/web/dist/index.html not found.");
  }
  for (const file of listFiles(webDist)) {
    assets[`web/${file}`] = path.join(webDist, file);
  }

  const drizzleDir = path.join(root, "apps", "server", "drizzle");
  if (!fs.existsSync(drizzleDir)) {
    throw new Error("apps/server/drizzle not found.");
  }
  for (const file of listFiles(drizzleDir)) {
    assets[`drizzle/${file}`] = path.join(drizzleDir, file);
  }

  assets["native/better_sqlite3.node"] = resolveBetterSqliteAddon();
  assets["worker/indexer.worker.cjs"] = workerOut;

  return assets;
}

function hideConsole(exePath) {
  const fd = fs.openSync(exePath, "r+");
  try {
    const peOffset = Buffer.alloc(4);
    fs.readSync(fd, peOffset, 0, 4, 0x3c);
    const subsystem = peOffset.readUInt32LE(0) + 24 + 68;
    const gui = Buffer.alloc(2);
    gui.writeUInt16LE(2);
    fs.writeSync(fd, gui, 0, 2, subsystem);
  } finally {
    fs.closeSync(fd);
  }
}

function embedWindowsIcon(exePath, source) {
  const exe = ResEdit.NtExecutable.from(fs.readFileSync(exePath), {
    ignoreCert: true,
  });
  const resource = ResEdit.NtExecutableResource.from(exe);
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(resource.entries);
  if (groups.length === 0) {
    throw new Error("The Node binary has no icon group to replace.");
  }
  const icons = buildWindowsIcons(source).map(({ size, dib, png }) =>
    png
      ? ResEdit.Data.RawIconItem.from(png, size, size, 32)
      : ResEdit.Data.IconItem.from(dib)
  );
  for (const group of groups) {
    ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
      resource.entries,
      group.id,
      group.lang,
      icons
    );
  }
  resource.outputResource(exe);
  fs.writeFileSync(exePath, Buffer.from(exe.generate()));
}

async function buildSeaExecutable(mainScript, outputBinary, workerOut) {
  const seaConfigPath = path.join(stagingDir, "sea-config.json");
  const seaConfig = {
    main: mainScript,
    mainFormat: "commonjs",
    output: outputBinary,
    disableExperimentalSEAWarning: true,
    assets: collectSeaAssets(workerOut),
  };
  fs.writeFileSync(seaConfigPath, JSON.stringify(seaConfig, null, 2));
  await run(process.execPath, ["--build-sea", seaConfigPath], stagingDir);
}

async function buildWindowsApp(serverOut, workerOut, iconSource) {
  if (process.platform !== "win32") {
    console.warn(
      "Skipping the Windows executable: it must be built on Windows against node.exe."
    );
    return;
  }
  const binary = path.join(outDir, `${APP_NAME}.exe`);
  await buildSeaExecutable(serverOut, binary, workerOut);
  await withRetry(() => {
    embedWindowsIcon(binary, iconSource);
    hideConsole(binary);
  });
  console.log(`[build:app] Windows standalone executable: ${binary}`);
}

function macInfoPlist() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>CFBundleDevelopmentRegion</key>
\t<string>en</string>
\t<key>CFBundleDisplayName</key>
\t<string>${APP_NAME}</string>
\t<key>CFBundleExecutable</key>
\t<string>${APP_NAME}</string>
\t<key>CFBundleIconFile</key>
\t<string>AppIcon</string>
\t<key>CFBundleIdentifier</key>
\t<string>${APP_ID}</string>
\t<key>CFBundleInfoDictionaryVersion</key>
\t<string>6.0</string>
\t<key>CFBundleName</key>
\t<string>${APP_NAME}</string>
\t<key>CFBundlePackageType</key>
\t<string>APPL</string>
\t<key>CFBundleShortVersionString</key>
\t<string>${APP_VERSION}</string>
\t<key>CFBundleVersion</key>
\t<string>${APP_VERSION}</string>
\t<key>LSArchitecturePriority</key>
\t<array>
\t\t<string>arm64</string>
\t\t<string>x86_64</string>
\t</array>
\t<key>LSApplicationCategoryType</key>
\t<string>public.app-category.utilities</string>
\t<key>LSMinimumSystemVersion</key>
\t<string>12.0</string>
\t<key>NSHighResolutionCapable</key>
\t<true/>
</dict>
</plist>
`;
}

async function copyProductionExtensions(destDir) {
  const extOutputDir = path.join(root, "apps", "extension", ".output");
  if (!fs.existsSync(extOutputDir)) return null;
  await fsp.mkdir(destDir, { recursive: true });
  for (const entry of await fsp.readdir(extOutputDir, {
    withFileTypes: true,
  })) {
    if (
      entry.isDirectory() &&
      !entry.name.endsWith("-sources") &&
      !entry.name.endsWith("-dev")
    ) {
      await fsp.cp(
        path.join(extOutputDir, entry.name),
        path.join(destDir, entry.name),
        { recursive: true }
      );
    }
  }
  return destDir;
}

async function buildMacBundle(serverOut, workerOut, iconSource) {
  const bundle = path.join(outDir, `${APP_NAME}.app`);
  const contents = path.join(bundle, "Contents");
  const macos = path.join(contents, "MacOS");
  const resources = path.join(contents, "Resources");
  fs.mkdirSync(macos, { recursive: true });
  fs.mkdirSync(resources, { recursive: true });
  fs.writeFileSync(path.join(contents, "Info.plist"), macInfoPlist());
  fs.writeFileSync(path.join(contents, "PkgInfo"), "APPL????");
  fs.writeFileSync(path.join(resources, "AppIcon.icns"), encodeIcns(iconSource));
  await copyProductionExtensions(path.join(resources, "extensions"));

  const extensionsDir = path.join(outDir, "extensions");
  const readmePath = path.join(outDir, "README.txt");
  const targetArch = requestedMacArch();

  if (process.platform !== "darwin") {
    console.warn(
      "Wrote the macOS bundle layout, but its executable needs a Mach-O build on macOS."
    );
    if (wantDmg) {
      await createMacDmg({
        appBundlePath: bundle,
        extensionsDir,
        readmePath,
        outDir,
        appName: APP_NAME,
        version: APP_VERSION,
        arch: targetArch,
        run,
      });
    }
    return;
  }

  if (process.arch !== targetArch) {
    throw new Error(
      `Requested macOS ${targetArch} build, but Node.js is running as ${process.arch}. ` +
        `Run native Apple Silicon Node (e.g. /opt/homebrew/bin/node) rather than Rosetta x64.`
    );
  }

  const nativeAddon = resolveBetterSqliteAddon();
  try {
    process.dlopen({ exports: {} }, path.resolve(nativeAddon));
  } catch (err) {
    throw new Error(
      `Failed to verify native better_sqlite3.node (${nativeAddon}) on darwin-${targetArch}: ${err?.message ?? err}`
    );
  }

  const frameworks = path.join(contents, "Frameworks");
  fs.mkdirSync(frameworks, { recursive: true });
  const bundledAddon = path.join(frameworks, "better_sqlite3.node");
  fs.copyFileSync(nativeAddon, bundledAddon);
  fs.chmodSync(bundledAddon, 0o755);

  const binary = path.join(macos, APP_NAME);
  await buildSeaExecutable(serverOut, binary, workerOut);
  fs.chmodSync(binary, 0o755);

  for (const machBinary of [binary, bundledAddon]) {
    const archsRaw = await runCapture("lipo", ["-archs", machBinary], outDir);
    if (!archsRaw.split(/\s+/).includes(targetArch)) {
      throw new Error(
        `Mach-O architecture mismatch for ${machBinary}: expected ${targetArch}, got "${archsRaw}".`
      );
    }
  }

  try {
    await run("codesign", ["--remove-signature", binary], outDir);
  } catch {
    // Binary may be unsigned before injection or signature removal unnecessary.
  }

  const entitlementsPath = path.join(
    root,
    "scripts",
    "macos-entitlements.plist"
  );
  const identity = process.env.CODESIGN_IDENTITY || "-";
  const timestampFlag = identity !== "-" ? ["--timestamp"] : [];
  const runtimeFlags =
    identity !== "-" ? ["--options", "runtime", "--timestamp"] : [];

  await run(
    "codesign",
    ["--force", "--sign", identity, ...timestampFlag, bundledAddon],
    outDir
  );
  await run(
    "codesign",
    [
      "--force",
      "--sign",
      identity,
      "--entitlements",
      entitlementsPath,
      ...runtimeFlags,
      binary,
    ],
    outDir
  );
  await run(
    "codesign",
    [
      "--force",
      "--sign",
      identity,
      "--entitlements",
      entitlementsPath,
      ...runtimeFlags,
      bundle,
    ],
    outDir
  );
  await run("codesign", ["--verify", "--deep", "--strict", bundle], outDir);

  console.log(`[build:app] macOS (${targetArch}) bundle: ${bundle}`);

  if (wantDmg) {
    await createMacDmg({
      appBundlePath: bundle,
      extensionsDir,
      readmePath,
      outDir,
      appName: APP_NAME,
      version: APP_VERSION,
      arch: targetArch,
      run,
    });
  }
}

function targetList() {
  const arg = process.argv.find((value) => value.startsWith("--target="));
  const requested =
    arg !== undefined
      ? arg.slice("--target=".length)
      : process.platform === "win32"
        ? "win"
        : process.platform === "darwin"
          ? "mac"
          : "all";
  if (requested === "all") return ["win", "mac"];
  if (requested !== "win" && requested !== "mac") {
    throw new Error(`Unknown --target ${requested}. Use win, mac, or all.`);
  }
  return [requested];
}

async function copyExtensionsAndDocs() {
  await copyProductionExtensions(path.join(outDir, "extensions"));

  const readme = [
    "Game Library Manager — Standalone Desktop Application",
    "=====================================================",
    "",
    "No Node.js installation or node_modules folder is required to run this app.",
    "",
    "Quick Start (Windows):",
    `1. Double-click "${APP_NAME}.exe".`,
    "2. Your default browser opens http://127.0.0.1:57095 automatically.",
    "3. Load the companion extension from extensions\\chrome-mv3 (or extensions\\firefox-mv2)",
    "   and pair it under Settings & Pairing in the web UI.",
    "",
    "Quick Start (macOS — Apple Silicon arm64 / Intel x64):",
    `1. Drag "${APP_NAME}.app" to Applications (or open it directly from the .dmg).`,
    "   Note: For ad-hoc signed builds, right-click -> Open the first time if Gatekeeper",
    `   prompts, or run: xattr -dr com.apple.quarantine "/Applications/${APP_NAME}.app"`,
    "2. Your default browser opens http://127.0.0.1:57095 automatically.",
    "3. Companion extensions are included in both ./extensions and",
    `   ${APP_NAME}.app/Contents/Resources/extensions.`,
    "",
    "Runtime Data:",
    "- Windows: SQLite database (WAL mode), encryption keyfile, pairing token, and cached",
    "  covers are saved in the ./data directory next to the executable.",
    "- macOS: Runtime data is saved in",
    `  ~/Library/Application Support/${APP_NAME}`,
    "- Extracted Games: Extract game folders into ./games next to the executable",
    `  (macOS: ~/Library/Application Support/${APP_NAME}/games) to auto-register their Play path.`,
  ].join("\r\n");

  await fsp.writeFile(path.join(outDir, "README.txt"), readme, "utf8");
}

async function cleanTargetsPreservingData(targets) {
  const rmOpts = {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  };
  if (fs.existsSync(outDir)) {
    for (const entry of await fsp.readdir(outDir)) {
      if (entry === "data" || entry === "games") continue;
      const removeWin =
        targets.includes("win") && entry === `${APP_NAME}.exe`;
      const removeMac =
        targets.includes("mac") &&
        (entry === `${APP_NAME}.app` ||
          entry.endsWith(".dmg") ||
          entry === ".dmg-stage");
      const removeShared = entry === "extensions" || entry === "README.txt";
      if (removeWin || removeMac || removeShared) {
        const targetPath = path.join(outDir, entry);
        try {
          await fsp.rm(targetPath, rmOpts);
        } catch (err) {
          if (
            entry === `${APP_NAME}.exe` &&
            (err?.code === "EPERM" || err?.code === "EBUSY")
          ) {
            throw new Error(
              `Cannot replace "${targetPath}" because "${APP_NAME}.exe" is currently running. ` +
                `Stop it first (e.g. PowerShell: Stop-Process -Name "${APP_NAME}") and re-run pnpm build:app.`
            );
          }
          throw err;
        }
      }
    }
  }
  await fsp.mkdir(path.join(outDir, "data", "covers"), { recursive: true });
  await fsp.mkdir(path.join(outDir, "games"), { recursive: true });
}

async function main() {
  const targets = targetList();
  writeWebIcons();

  await runPnpm(["build"], root);
  await runPnpm(
    ["--filter", "@game-library/extension", "build:firefox"],
    root
  );

  await cleanTargetsPreservingData(targets);
  fs.rmSync(stagingDir, { recursive: true, force: true });

  try {
    await copyExtensionsAndDocs();
    const { serverOut, workerOut } = await bundleCjsEntrypoints();
    const iconSource = appIconSource();

    if (targets.includes("win")) {
      await buildWindowsApp(serverOut, workerOut, iconSource);
    }
    if (targets.includes("mac")) {
      await buildMacBundle(serverOut, workerOut, iconSource);
    }
  } finally {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  }

  console.log(`[build:app] Standalone app folder: ${outDir}`);
}

main().catch((err) => {
  console.error("[build:app] Failed:", err);
  process.exit(1);
});
