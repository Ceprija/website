#!/usr/bin/env bash
# Compress PNG/JPEG assets under public/images to WebP.
# Requires: cwebp (brew install webp)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PUBLIC_IMAGES="$ROOT/public/images"
QUALITY=85
MIN_BYTES=80000

if ! command -v cwebp >/dev/null 2>&1; then
  echo "cwebp not found. Install: brew install webp" >&2
  exit 1
fi

max_width_for() {
  local rel="$1"
  case "$rel" in
    */faculty/*) echo 512 ;;
    */programs/*/gallery/*|*/gallery/*) echo 1600 ;;
    */revista/*) echo 1600 ;;
    */programs/*) echo 1920 ;;
    */hero/*) echo 2560 ;;
    *) echo 1200 ;;
  esac
}

converted=0
skipped=0
failed=0

while IFS= read -r -d '' src; do
  rel="${src#"$ROOT/public/"}"
  base="${src%.*}"
  ext="${src##*.}"
  ext_lower="$(printf '%s' "$ext" | tr '[:upper:]' '[:lower:]')"
  case "$ext_lower" in
    png|jpg|jpeg) ;;
    *) continue ;;
  esac

  size=$(stat -f%z "$src" 2>/dev/null || stat -c%s "$src")
  if [[ "$size" -lt "$MIN_BYTES" ]]; then
    ((skipped++)) || true
    continue
  fi

  dst="${base}.webp"
  width="$(max_width_for "$rel")"

  if [[ -f "$dst" ]] && [[ "$dst" -nt "$src" ]]; then
    ((skipped++)) || true
    continue
  fi

  if cwebp -quiet -q "$QUALITY" -resize "$width" 0 "$src" -o "$dst"; then
    ((converted++)) || true
    rm -f "$src"
  else
    echo "FAILED: $src" >&2
    ((failed++)) || true
  fi
done < <(find "$PUBLIC_IMAGES" -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' \) -print0)

echo "Done. converted=$converted skipped=$skipped failed=$failed"
