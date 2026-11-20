---
name: verify-phase
description: Run build, unit tests, headless contract scenarios, and determinism checks, saving real verification evidence for the current phase.
---

# Verify Phase Skill

Use this skill before tagging any phase (`phase-1` .. `phase-4`) or after any change to `src/core/` or `src/headless/`.

## Steps
1. Run `npm run build` to verify both TypeScript headless compilation (`dist-headless/`) and Vite production bundle (`dist/`).
2. Run `npm test` to execute all Vitest unit and contract tests.
3. Run `node scripts/verify-phase1.mjs` (or current phase verifier) to execute headless scenarios against `dist-headless/headless/cli.js`, check byte-for-byte determinism across 2 runs, verify exit code 2 on malformed inputs, and save outputs to `docs/proof/phase-1/`.
4. Do NOT finish or tag the phase if any step exits with a non-zero code.
