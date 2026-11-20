# AGENTS.md — Đảo Đèn Lồng (AI SDLC Harness)

## Project Overview
- **Game:** Đảo Đèn Lồng v1.0.0 (3D third-person game, TypeScript + Three.js + Vite) across 3 Nights (Đảo Bến, Đảo Cau, Đảo Chuông).
- **Architecture:** Strict separation between deterministic 60Hz core (`src/core/`), headless CLI (`src/headless/`), 3D browser renderer (`src/client/`), and Node.js runners (`scripts/run-app.mjs`, `scripts/bench.mjs`, `scripts/soak.mjs`).
- **Single Source of Truth:** `game.contract.json` (Contract v1.3) defines all standardized `tuning` values and CLI commands (`build_cmd`, `run_cmd`, `headless_cmd`, `bench_cmd`, `soak_cmd`). `src/core/config.ts` MUST stay 100% synced with `game.contract.json` (enforced by unit test).

## Commands
- Install & build: `npm install && npm run build`
- Run 3D game (with disk leaderboard): `npm run preview` (runs `node scripts/run-app.mjs`)
- Export leaderboard: `node scripts/run-app.mjs --export-leaderboard out.json`
- Run unit & contract tests: `npm test`
- Run soak test (10 nights): `node scripts/soak.mjs --seed 7 --nights 10 --out soak.json`
- Run 3D benchmark (1280×720, 200 shades, 100 motes): `node scripts/bench.mjs --seed 42 --duration 30 --out bench.json`
- Full verification: `npm run verify`
- On Windows PowerShell 5.1, chain commands with `; if ($LASTEXITCODE -eq 0) { ... }` instead of `&&`.

## Strict Rules
1. **Determinism & Fuel Precision:** Never use `Math.random()` or `Date.now()` inside `src/core/` or `src/headless/`. Always use `Mulberry32` PRNG (`src/core/rng.ts`). Track lantern fuel internally in integer `1/60` units (`0..6000`).
2. **Test Contract v1.3:** Strictly preserve 12-step tick order, pause freeze rules, Shade states (`spawning`, `wander`, `chase`, `recoil`, `stunned`, `drain`), exit codes (`0` ok, `2` malformed inputs/scenario, `1` other), headless full-night runtime ≤ 30s, soak test `crashes=0` & `mem_end <= 1.2 * mem_start`, and standard bench scene (no creative extras during bench/soak).
3. **Standardized Map & Rendering Perf:** Angles on XZ plane are CCW from `+X` (`x = r*cos(a), z = r*sin(a)`). Use `THREE.InstancedMesh` for Shades and Motes so the 200-shade/100-mote benchmark achieves ≥ 60 avg FPS and ≥ 30 p1_low FPS.
4. **Creativity & Accessibility Isolation:** Visual/audio enhancements, colorblind/reduced-motion/large-text modes, and custom keybinds in `src/client/` MUST NEVER alter headless simulation output.
5. **No Fake Evidence & Regression Discipline:** Never skip or weaken tests silently. Always run `npm run verify` before committing or tagging.
6. **Security:** Never commit `.env`, API keys, or secrets.
