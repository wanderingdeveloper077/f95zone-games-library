import { execFile } from "node:child_process";
import type { FilePicker } from "../contracts/ports.js";

function runPickerProcess(
  command: string,
  args: string[],
  env?: NodeJS.ProcessEnv
): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      {
        env,
        windowsHide: true,
        timeout: 120_000,
      },
      (err, stdout) => {
        if (err) {
          resolve(null);
          return;
        }
        const trimmed = stdout.trim();
        resolve(trimmed.length > 0 ? trimmed : null);
      }
    );
  });
}

/**
 * Builds the PowerShell script for the Windows picker.
 *
 * The dialog is owned by a real, visible (but fully transparent 1x1) TopMost form.
 * Win32 keeps owned windows above their owner, so the dialog inherits the TopMost
 * z-order and renders above the browser even when the server process does not hold
 * foreground focus. An owner form that is never shown has no effect on z-order.
 */
export function buildWindowsPickerScript(mode: "file" | "folder"): string {
  const dialogSetup =
    mode === "folder"
      ? [
          "$d = New-Object System.Windows.Forms.FolderBrowserDialog",
          "$d.Description = $env:GLM_PICKER_TITLE",
          "$d.ShowNewFolderButton = $false",
        ]
      : [
          "$d = New-Object System.Windows.Forms.OpenFileDialog",
          "$d.Title = $env:GLM_PICKER_TITLE",
          "$d.Filter = 'All files (*.*)|*.*|Executables (*.exe;*.bat;*.cmd;*.html)|*.exe;*.bat;*.cmd;*.html'",
        ];

  const selectedExpr = mode === "folder" ? "$d.SelectedPath" : "$d.FileName";

  return [
    "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
    "Add-Type -AssemblyName System.Windows.Forms",
    "Add-Type -Namespace GLM -Name Win32 -MemberDefinition '[DllImport(\"user32.dll\")] public static extern bool SetForegroundWindow(IntPtr hWnd);'",
    "[System.Windows.Forms.Application]::EnableVisualStyles()",
    "$owner = New-Object System.Windows.Forms.Form",
    "$owner.TopMost = $true",
    "$owner.ShowInTaskbar = $false",
    "$owner.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::None",
    "$owner.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen",
    "$owner.Width = 1",
    "$owner.Height = 1",
    "$owner.Opacity = 0",
    "$owner.Show()",
    "$owner.Activate()",
    "[void][GLM.Win32]::SetForegroundWindow($owner.Handle)",
    ...dialogSetup,
    `try { if ($d.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output (${selectedExpr}) } } finally { $d.Dispose(); $owner.Close(); $owner.Dispose() }`,
  ].join("; ");
}

export class OsNativeFilePicker implements FilePicker {
  async pickPath(
    mode: "file" | "folder",
    title?: string
  ): Promise<string | null> {
    const dialogTitle =
      title?.trim() ||
      (mode === "folder" ? "Select game folder" : "Select game executable");

    if (process.platform === "win32") {
      const script = buildWindowsPickerScript(mode);

      return runPickerProcess(
        "powershell.exe",
        ["-NoProfile", "-STA", "-Command", script],
        {
          ...process.env,
          GLM_PICKER_TITLE: dialogTitle,
        }
      );
    }

    if (process.platform === "darwin") {
      const chooseExpr =
        mode === "folder"
          ? 'POSIX path of (choose folder with prompt (system attribute "GLM_PICKER_TITLE"))'
          : 'POSIX path of (choose file with prompt (system attribute "GLM_PICKER_TITLE"))';
      return runPickerProcess(
        "osascript",
        [
          "-e",
          'tell application "System Events"',
          "-e",
          "activate",
          "-e",
          `set picked to ${chooseExpr}`,
          "-e",
          "end tell",
          "-e",
          "picked",
        ],
        {
          ...process.env,
          GLM_PICKER_TITLE: dialogTitle,
        }
      );
    }

    const zenityArgs = [
      "--file-selection",
      `--title=${dialogTitle}`,
      ...(mode === "folder" ? ["--directory"] : []),
    ];
    return runPickerProcess("zenity", zenityArgs);
  }
}
