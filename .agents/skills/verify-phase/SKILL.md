---
name: verify-phase
description: Run build, all unit/regression/v1.3 tests, Phase 3+4 headless scenarios, 10-night soak test, leaderboard export verification, and determinism checks.
---

# Verify Phase Skill (v1.3 — Release v1.0.0)

Use this skill before tagging `phase-4` / creating Release `v1.0.0` or after any code change.

## Steps
1. Run `npm run build` to verify TypeScript headless compilation (`dist-headless/`) and Vite production bundle (`dist/`).
2. Run `npm test` to execute all Vitest unit, Phase 1–3 regression, leaderboard, and Contract v1.3 tests.
3. Run `node scripts/verify-phase3.mjs` to verify Contract v1.2/v1.3 headless gameplay scenarios & determinism.
4. Run `node scripts/soak.mjs --seed 7 --nights 10 --out soak.json` and assert `crashes === 0` and `mem_end_mb <= 1.2 * mem_start_mb`.
5. Run `node scripts/run-app.mjs --export-leaderboard tmp/lb-export.json` and verify valid `{"entries":[...]}` schema.
6. Run `node scripts/bench.mjs --seed 42 --duration 30 --out bench.json` (on a machine with Chrome/Chromium/Edge + GPU) and verify `avg_fps >= 60`, `p1_low_fps >= 30`, `load_ms <= 10000`.
7. Do NOT tag or release if any step fails.
