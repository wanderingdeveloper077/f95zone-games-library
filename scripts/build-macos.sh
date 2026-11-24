#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "[build:mac] This script must run on macOS (Darwin)." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "[build:mac] Node.js 26+ (or 25.5+ with --build-sea) is required." >&2
  exit 1
fi

if ! node --help | grep -q -- '--build-sea'; then
  echo "[build:mac] Node $(node -v) does not support --build-sea. Install Node.js 26+ (e.g. brew install node)." >&2
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "[build:mac] pnpm is required (npm install -g pnpm or corepack enable)." >&2
  exit 1
fi

BUILD_DMG=true
TARGET_ARCH=""
for arg in "$@"; do
  case "$arg" in
    --no-dmg)
      BUILD_DMG=false
      ;;
    --arch=*)
      TARGET_ARCH="${arg#--arch=}"
      if [[ "$TARGET_ARCH" != "arm64" && "$TARGET_ARCH" != "x64" ]]; then
        echo "[build:mac] Unsupported --arch '$TARGET_ARCH'. Use arm64 or x64." >&2
        exit 1
      fi
      ;;
    *)
      echo "Usage: $0 [--no-dmg] [--arch=arm64|x64]" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$TARGET_ARCH" ]]; then
  if [[ "$(sysctl -n hw.optional.arm64 2>/dev/null || echo 0)" == "1" ]]; then
    TARGET_ARCH="arm64"
  elif [[ "$(uname -m)" == "arm64" ]]; then
    TARGET_ARCH="arm64"
  else
    TARGET_ARCH="x64"
  fi
fi

NODE_ARCH="$(node -p "process.arch")"
if [[ "$NODE_ARCH" != "$TARGET_ARCH" ]]; then
  echo "[build:mac] Target arch is '$TARGET_ARCH', but active Node.js binary is '$NODE_ARCH' ($(command -v node))." >&2
  if [[ "$TARGET_ARCH" == "arm64" ]]; then
    echo "[build:mac] Install/select native Apple Silicon arm64 Node (e.g. /opt/homebrew/bin/node) rather than Rosetta x64." >&2
  fi
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

pnpm install

ARGS=(scripts/build-app.mjs --target=mac "--arch=$TARGET_ARCH")
if [[ "$BUILD_DMG" == "true" ]]; then
  ARGS+=(--dmg)
fi

node "${ARGS[@]}"
