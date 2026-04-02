#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
EXT_DIR="$ROOT_DIR/extension"
DIST_DIR="$ROOT_DIR/dist"
TMP_DIR="$(mktemp -d)"
TMP_EXT_DIR="$TMP_DIR/extension"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

if [[ ! -f "$EXT_DIR/manifest.json" ]]; then
  echo "Error: extension/manifest.json not found."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Error: node is required."
  exit 1
fi

VERSION="$(node -e "console.log(require('$EXT_DIR/manifest.json').version || '0.0.0')")"
ZIP_NAME="mail-assistant-lite-extension-v${VERSION}.zip"
ZIP_PATH="$DIST_DIR/$ZIP_NAME"

mkdir -p "$DIST_DIR" "$TMP_EXT_DIR"

cp -R "$EXT_DIR/." "$TMP_EXT_DIR/"
find "$TMP_EXT_DIR" -name ".DS_Store" -delete

# Fast sanity checks for JS syntax before packaging.
while IFS= read -r js_file; do
  node --check "$js_file" >/dev/null
done < <(find "$TMP_EXT_DIR" -type f -name "*.js" | sort)

(
  cd "$TMP_EXT_DIR"
  zip -qr "$ZIP_PATH" .
)

echo "Package created:"
echo "  $ZIP_PATH"
echo "SHA256:"
shasum -a 256 "$ZIP_PATH"

