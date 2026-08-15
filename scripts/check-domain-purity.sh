#!/usr/bin/env bash
# CI belt-and-suspenders check alongside the ESLint boundaries rule (T-02): grep
# packages/domain for IO/non-determinism that must never appear there.
set -euo pipefail

cd "$(dirname "$0")/.."

PATTERN='fetch\(|require\(.fs.\)|new Date\(\)|Date\.now\(\)|Math\.random\(\)'

matches=$(grep -rnE "$PATTERN" packages/domain/src --include='*.ts' \
  | grep -v '\.test\.ts:' \
  | grep -v '\.lint\.test\.ts:' || true)

if [ -n "$matches" ]; then
  echo "packages/domain must not perform IO or read non-deterministic state:" >&2
  echo "$matches" >&2
  exit 1
fi

echo "packages/domain purity grep check passed."
