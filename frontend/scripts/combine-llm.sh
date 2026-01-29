#!/usr/bin/env bash
set -euo pipefail

ROOT="${ROOT:-../packages/core/src}"
OUT="${OUT:-llm.md}"

EXCLUDE_DIRS=("node_modules" "dist" "build" ".turbo" ".git")
HEADER_MARK="<!-- LLM_HEADER_END -->"

is_excluded() {
  local p="$1"
  for ex in "${EXCLUDE_DIRS[@]}"; do
    case "$p" in
      */"$ex"/*) return 0 ;;
    esac
  done
  return 1
}

lang_for() {
  local f="$1"
  case "$f" in
    *.ts) echo "ts" ;;
    *.tsx) echo "tsx" ;;
    *.js) echo "js" ;;
    *.jsx) echo "jsx" ;;
    *.json) echo "json" ;;
    *.md) echo "md" ;;
    *) echo "" ;;
  esac
}

if [[ ! -d "$ROOT" ]]; then
  echo "[combine-llm] ROOT does not exist: $ROOT" >&2
  exit 1
fi

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

# --- 1) Write/preserve header ---
if [[ -f "$OUT" ]]; then
  if grep -qF "$HEADER_MARK" "$OUT"; then
    # Copy everything up through the marker
    awk -v MARK="$HEADER_MARK" '
      { print }
      index($0, MARK) { exit 0 }
    ' "$OUT" > "$tmp"
  else
    # Heuristic fallback: copy everything before the first REAL file section (# path.ext then ``` fence)
    # Also: DROP any stray "# something.ts" lines in this header region.
    awk '
      BEGIN { pending = 0; pending_buf = "" }

      function flush_pending() {
        if (!pending) return
        # If pending header looks like a file path, drop it from header
        if (pending_buf ~ /^# [^ \t\r\n]+\.[A-Za-z0-9]+(\r)?\n?$/) {
          pending = 0; pending_buf = ""; return
        }
        printf "%s", pending_buf
        pending = 0; pending_buf = ""
      }

      /^# / {
        pending = 1
        pending_buf = $0 "\n"
        next
      }

      pending && /^[[:space:]]*$/ {
        pending_buf = pending_buf $0 "\n"
        next
      }

      pending && /^```/ {
        # first real file section begins; stop before it
        exit 0
      }

      {
        flush_pending()
        print
      }

      END { flush_pending() }
    ' "$OUT" > "$tmp"

    # Ensure marker is present at end of preserved header
    printf "\n%s\n" "$HEADER_MARK" >> "$tmp"
  fi
else
  cat > "$tmp" <<EOF
# LLM Context Pack — @cleartify/core (Source of Truth)

This \`llm.md\` is a single-file mirror of \`packages/core/src\`.
Edit sections carefully and keep paths + triple-backtick fences intact so the source tree can be reconstructed.

$HEADER_MARK
EOF
fi

# Separator line after header
printf "\n" >> "$tmp"

# --- 2) Append regenerated file sections (deterministic order) ---
while IFS= read -r f; do
  if is_excluded "$f"; then
    continue
  fi

  rel="${f#"$ROOT"/}"
  lang="$(lang_for "$f")"

  echo "# ${rel}" >> "$tmp"
  echo >> "$tmp"

  if [[ -n "$lang" ]]; then
    printf '%s\n' '```'"$lang" >> "$tmp"
  else
    printf '%s\n' '```' >> "$tmp"
  fi

  cat "$f" >> "$tmp"
  # ensure newline before closing fence
  tail -c 1 "$f" | read -r _ || echo >> "$tmp"
  printf '%s\n\n' '```' >> "$tmp"

done < <(find "$ROOT" -type f \( -name "*.ts" -o -name "*.tsx" \) | LC_ALL=C sort)

mv "$tmp" "$OUT"
echo "[combine-llm] wrote $OUT from $ROOT (header preserved via marker)"
