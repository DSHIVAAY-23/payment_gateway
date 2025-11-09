#!/usr/bin/env bash
set -euo pipefail

# Usage: source scripts/load_env.sh env/.env.localhost
# This will export all variables from the given file into the current shell.

if [[ $# -ne 1 ]]; then
  echo "Usage: source scripts/load_env.sh <path-to-env-file>" >&2
  return 1 2>/dev/null || exit 1
fi

ENV_FILE="$1"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Env file not found: $ENV_FILE" >&2
  return 1 2>/dev/null || exit 1
fi

set -a
source "$ENV_FILE"
set +a

echo "Loaded environment from $ENV_FILE"



