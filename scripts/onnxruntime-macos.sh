#!/usr/bin/env bash
# Puts Microsoft's ONNX Runtime for Intel Macs where the macOS bundle takes it (`bundle.macOS.frameworks` of
# src-tauri/tauri.macos.conf.json): the conversation's voice (ESC-97) loads it at run time on Intel Macs, for which pyke
# builds no static library. Its SHA-256 is that of the release's asset (GitHub's digest).
#   scripts/onnxruntime-macos.sh → src-tauri/macos/onnxruntime/libonnxruntime.1.23.2.dylib
set -euo pipefail

VERSION=1.23.2
SHA256=d10359e16347b57d9959f7e80a225a5b4a66ed7d7e007274a15cae86836485a6
NAME="onnxruntime-osx-x86_64-${VERSION}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/src-tauri/macos/onnxruntime"
LIB="libonnxruntime.${VERSION}.dylib"

if [ -f "$DEST/$LIB" ]; then
  echo "$DEST/$LIB is there"
  exit 0
fi
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
curl -fsSL -o "$TMP/$NAME.tgz" "https://github.com/microsoft/onnxruntime/releases/download/v${VERSION}/${NAME}.tgz"
if command -v shasum >/dev/null; then sum="shasum -a 256"; else sum=sha256sum; fi
echo "$SHA256  $TMP/$NAME.tgz" | $sum -c -
tar -xzf "$TMP/$NAME.tgz" -C "$TMP" "./$NAME/lib/$LIB" "./$NAME/LICENSE"
mkdir -p "$DEST"
cp "$TMP/$NAME/lib/$LIB" "$TMP/$NAME/LICENSE" "$DEST/"
echo "$DEST/$LIB"
