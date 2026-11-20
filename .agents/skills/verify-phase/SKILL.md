---
name: verify-phase
description: Run build, unit tests, headless contract scenarios (Phase 1 regression + Phase 2 features), full-night performance benchmark, and determinism checks, saving real verification evidence.
---

# Verify Phase Skill (v1.1)

Use this skill before tagging any phase (`phase-1` .. `phase-4`) or after any change to `src/core/`, `src/headless/`, or `game.contract.json`.

## Steps
1. Run `npm run build` to verify TypeScript headless compilation (`dist-headless/`) and Vite production bundle (`dist/`).
2. Run `npm test` to execute all Vitest unit, regression, and Contract v1.1 tests.
3. Run `node scripts/verify-phase2.mjs` to execute headless scenarios for:
   - Phase 1 regression with standardized tuning
   - Dash, Fall & Respawn, Pause/Resume
   - Night 2 Jump Pad, Wind Charm, Drifter (Gió Lạc) steal & pulse-drop
   - Night 3 Tiered Terrain, Ramps, Wind gust
   - Full-night 21,600-tick headless speed check (must complete in ≤ 30s)
   - Byte-for-byte determinism check across 2 identical runs
4. Save real JSONL outputs to `docs/proof/phase-2/`. Do NOT finish or tag the phase if any step exits non-zero.
