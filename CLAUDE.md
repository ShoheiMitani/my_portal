# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal website built with Hono on Cloudflare Workers.

## Commands

```bash
pnpm run dev          # Start local dev server (wrangler)
pnpm run deploy       # Deploy to Cloudflare Workers
pnpm run lint         # Lint with Biome
pnpm run format:check # Format check with Biome
pnpm run typecheck    # TypeScript type check
pnpm run test         # Run tests (vitest)
pnpm run test:watch   # Run tests in watch mode
pnpm run knip         # Dead code check
```

To run a single test file:
```bash
pnpm exec vitest run src/__tests__/index.test.ts
```

## Architecture

- **Runtime**: Cloudflare Workers
- **Framework**: Hono
- **Entry point**: `src/index.ts` — Hono app exported as default
- **Config**: `wrangler.jsonc` for Workers, `biome.json` for linting/formatting
- **Tests**: Vitest, located in `src/__tests__/`, using Hono's `app.request()` for handler testing

## Conventions

- **Formatter**: Biome (tab indentation)
- **TDD**: Write tests first, then implement
- **Package manager**: pnpm (not npm)

## Self Review

実装タスクが完了したら、最後に以下のスキルを順番に実行してセルフレビューを行うこと。

1. `/simplify` — 変更したコードの再利用性・品質・効率性をレビューし、問題があれば修正する
2. `/code-review` — コードレビューを実施し、問題があれば修正する
