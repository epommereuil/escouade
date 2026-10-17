#!/usr/bin/env bash
# Puts Microsoft's ONNX Runtime where the bundles take it, for the systems where the conversation's voice (ESC-97)
# loads it at run time: Intel Macs (pyke builds no static library for them) and Linux (pyke's needs glibc 2.38; this
# one, 2.28). Its SHA-256 is that of the release's asset (GitHub's digest). Bundled by src-tauri/tauri.ort-<os>.conf.json.
#   scripts/onnxruntime.sh macos → src-tauri/macos/onnxruntime/libonnxruntime.1.23.2.dylib
#   scripts/onnxruntime.sh linux → src-tauri/linux/onnxruntime/libonnxruntime.so.1.23.2
set -euo pipefail

VERSION=1.23.2
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
case "${1:-}" in
  macos)
    NAME="onnxruntime-osx-x86_64-${VERSION}"
    SHA256=d10359e16347b57d9959f7e80a225a5b4a66ed7d7e007274a15cae86836485a6
    LIB="libonnxruntime.${VERSION}.dylib"
    ;;
  linux)
    NAME="onnxruntime-linux-x64-${VERSION}"
    SHA256=1fa4dcaef22f6f7d5cd81b28c2800414350c10116f5fdd46a2160082551c5f9b
    LIB="libonnxruntime.so.${VERSION}"
    ;;
  *)
    echo "usage: $0 macos|linux" >&2
    exit 2
    ;;
esac
DEST="$ROOT/src-tauri/$1/onnxruntime"

if [ -f "$DEST/$LIB" ]; then
  echo "$DEST/$LIB is there"
  exit 0
fi
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
curl -fsSL -o "$TMP/$NAME.tgz" "https://github.com/microsoft/onnxruntime/releases/download/v${VERSION}/${NAME}.tgz"
if command -v shasum >/dev/null; then sum="shasum -a 256"; else sum=sha256sum; fi
echo "$SHA256  $TMP/$NAME.tgz" | $sum -c -
# Its symbolic links may not be made (Git Bash under Windows): only the library itself is needed.
tar -xzf "$TMP/$NAME.tgz" -C "$TMP" 2>/dev/null || true
[ -f "$TMP/$NAME/lib/$LIB" ] || { echo "$LIB not in $NAME.tgz" >&2; exit 1; }
mkdir -p "$DEST"
cp "$TMP/$NAME/lib/$LIB" "$TMP/$NAME/LICENSE" "$DEST/"
echo "$DEST/$LIB"
