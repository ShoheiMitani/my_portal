#!/usr/bin/env bash
set -euo pipefail

# Usage: push-and-create-pr.sh --title <title> --body <body> [--base <base>] [--draft]
#
# 1. カレントブランチを origin に push (-u)
# 2. gh pr create で PR を作成

TITLE=""
BODY=""
BASE="main"
DRAFT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --title)  TITLE="$2";  shift 2 ;;
    --body)   BODY="$2";   shift 2 ;;
    --base)   BASE="$2";   shift 2 ;;
    --draft)  DRAFT="--draft"; shift ;;
    *)        echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$TITLE" || -z "$BODY" ]]; then
  echo "Error: --title and --body are required" >&2
  exit 1
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD)

if [[ "$BRANCH" == "main" || "$BRANCH" == "master" ]]; then
  echo "Error: Cannot create PR from $BRANCH branch" >&2
  exit 1
fi

echo "Pushing $BRANCH to origin..."
git push -u origin "$BRANCH"

echo ""
echo "Creating PR..."
gh pr create --title "$TITLE" --body "$BODY" --base "$BASE" $DRAFT
