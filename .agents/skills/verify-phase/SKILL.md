---
name: verify-phase
description: Run build, unit/regression tests, Contract v1.2 headless scenarios (fuel decay, refuel, lantern_out, relight, shade drain, dawn_survived, progressive capacity), performance benchmark, and determinism checks.
---

# Verify Phase Skill (v1.2)

Use this skill before tagging any phase (`phase-3` .. `phase-4`) or after any change to `src/core/`, `src/headless/`, or `game.contract.json`.

## Steps
1. Run `npm run build` to verify TypeScript headless compilation (`dist-headless/`) and Vite production bundle (`dist/`).
2. Run `npm test` to execute all Vitest unit, Phase 1–2 regression, and Phase 3 Contract v1.2 tests.
3. Run `node scripts/verify-phase3.mjs` to execute headless scenarios for:
   - Fuel decay (1/s), `lantern_out`, relight cost (5 motes, `+40` pts, `relight: true`), and progressive capacity (`10 + 2 * successful_lights`, max 20)
   - Refuel (`ceil((100-fuel)/10)` motes, `+5`/mote, full lantern ignored)
   - Shade `drain` on weak lantern (`fuel < 30`, `-5/s`, `fuel_drain` every 60 ticks, `+15` pulse bonus on draining shade)
   - Dawn win rule (`dawn_survived` when `lit >= ceil(0.6*total)` at end of night, NO early `all_lit` win, dawn score `50 + floor(fuel)` per lit lantern + `50` per flame)
   - Phase 2 regression (Dash, Fall, Pause, Jump Pad, Wind Charm, Drifter, Night 3 Wind)
   - Full Night 3 (18,000 ticks) speed (≤ 30s) & byte-for-byte determinism
4. Save real JSONL outputs to `docs/proof/phase-3/`. Do NOT tag if any step exits non-zero.
