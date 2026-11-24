import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

/**
 * Stages and builds a compressed macOS `.dmg` disk image containing the `.app`
 * bundle, `/Applications` drag-install symlink, extension folder, and README.
 * Gracefully skips when executed on a non-macOS host (`hdiutil` unavailable).
 */
export async function createMacDmg({
  appBundlePath,
  extensionsDir,
  readmePath,
  outDir,
  appName,
  version,
  arch = process.arch,
  run,
}) {
  if (process.platform !== "darwin") {
    console.warn(
      `[build:mac] Skipping .dmg creation (hdiutil requires macOS); .app bundle is at ${appBundlePath}`
    );
    return null;
  }

  const dmgName = `${appName}-${version}-${arch}.dmg`;
  const dmgPath = path.join(outDir, dmgName);
  const dmgStage = path.join(outDir, ".dmg-stage");

  await fsp.rm(dmgStage, { recursive: true, force: true });
  await fsp.rm(dmgPath, { force: true });
  await fsp.mkdir(dmgStage, { recursive: true });

  try {
    const stagedAppPath = path.join(dmgStage, path.basename(appBundlePath));
    // `ditto` preserves executable permissions, symlinks, and codesign signatures on macOS.
    await run("ditto", [appBundlePath, stagedAppPath], outDir);
    await fsp.symlink("/Applications", path.join(dmgStage, "Applications"));

    if (extensionsDir && fs.existsSync(extensionsDir)) {
      await fsp.cp(extensionsDir, path.join(dmgStage, "extensions"), {
        recursive: true,
      });
    }
    if (readmePath && fs.existsSync(readmePath)) {
      await fsp.copyFile(readmePath, path.join(dmgStage, "README.txt"));
    }

    await fsp.mkdir(outDir, { recursive: true });
    await run(
      "hdiutil",
      [
        "create",
        "-volname",
        appName,
        "-srcfolder",
        dmgStage,
        "-ov",
        "-format",
        "UDZO",
        dmgPath,
      ],
      outDir
    );
    await run("hdiutil", ["verify", dmgPath], outDir);

    const identity = process.env.CODESIGN_IDENTITY;
    if (identity && identity !== "-") {
      await run(
        "codesign",
        ["--force", "--sign", identity, "--timestamp", dmgPath],
        outDir
      );
    }

    console.log(`[build:mac] Disk image: ${dmgPath}`);
    return dmgPath;
  } finally {
    await fsp.rm(dmgStage, { recursive: true, force: true });
  }
}
