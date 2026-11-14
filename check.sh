#!/usr/bin/env bash
# The one command that checks the site: lint, unit tests, a production build (which also
# type-checks), tests of the pages the build wrote, and HTML validation of those pages.
set -euo pipefail
cd "$(dirname "$0")"

echo "== lint"
npx eslint

echo "== unit tests"
npm test

echo "== build"
npx next build

echo "== built pages"
node --test scripts/built/*.test.ts

echo "== html"
pages=(.next/server/app/index.html .next/server/app/three-months.html .next/server/app/reading.html .next/server/app/conferences.html)
pages+=(.next/server/app/data/topics.html .next/server/app/data/topics/*.html)
npx html-validate "${pages[@]}"

echo "all checks passed"
