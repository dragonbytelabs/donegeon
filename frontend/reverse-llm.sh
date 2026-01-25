#!/usr/bin/env bash
set -euo pipefail

IN="${IN:-llm.md}"
OUTDIR="${OUTDIR:-packages/core/src}"
HEADER_MARK="<!-- LLM_HEADER_END -->"

if [[ ! -f "$IN" ]]; then
  echo "[reverse-llm] IN not found: $IN" >&2
  exit 1
fi

mkdir -p "$OUTDIR"

awk -v OUTDIR="$OUTDIR" -v MARK="$HEADER_MARK" '
  function trim(s){ sub(/^[ \t\r\n]+/, "", s); sub(/[ \t\r\n]+$/, "", s); return s }

  function shquote(s,    t) {
    t = s
    gsub(/\047/, "\047\\\047\047", t)
    return "\047" t "\047"
  }

  BEGIN {
    started = 0
    in_code = 0
    have_path = 0
    path = ""
    buf = ""
  }

  # Wait until after header marker (if present)
  !started {
    if (index($0, MARK)) started = 1
    next
  }

  /^# / && !in_code {
    candidate = trim(substr($0, 3))
    if (candidate ~ /\.[A-Za-z0-9]+$/) {
      path = candidate
      have_path = 1
    } else {
      have_path = 0
      path = ""
    }
    next
  }

  /^```/ && have_path && !in_code {
    in_code = 1
    buf = ""
    next
  }

  /^```/ && in_code {
    full = OUTDIR "/" path
    parent = full
    sub(/\/[^\/]+$/, "", parent)
    system("mkdir -p " shquote(parent))

    print buf > full
    close(full)

    in_code = 0
    have_path = 0
    path = ""
    buf = ""
    next
  }

  in_code {
    buf = buf $0 "\n"
    next
  }

  { next }
' "$IN"

echo "[reverse-llm] reconstructed files into: $OUTDIR"
