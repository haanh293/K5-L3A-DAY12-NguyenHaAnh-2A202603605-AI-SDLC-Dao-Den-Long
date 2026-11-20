# AGENTS.md — Đảo Đèn Lồng (AI SDLC Harness)

## Project Overview
- **Game:** Đảo Đèn Lồng (3D third-person game, TypeScript + Three.js + Vite) across 3 Nights (Đảo Bến, Đảo Cau, Đảo Chuông).
- **Architecture:** Strict separation between deterministic 60Hz core (`src/core/`), headless CLI (`src/headless/`), and 3D browser renderer (`src/client/`).
- **Single Source of Truth:** `game.contract.json` (Contract v1.1) defines all standardized `tuning` values. `src/core/config.ts` MUST stay 100% synced with `game.contract.json` (enforced by unit test).

## Commands
- Install & build: `npm install && npm run build`
- Build headless only: `npm run build:headless`
- Run unit & contract tests: `npm test`
- Full verification (build + tests + headless scenarios + performance + determinism): `npm run verify`
- Run 3D game locally: `npm run dev` (or `npm run preview` after build)
- On Windows PowerShell 5.1, chain commands with `; if ($LASTEXITCODE -eq 0) { ... }` instead of `&&`.

## Strict Rules
1. **Determinism:** Never use `Math.random()` or `Date.now()` inside `src/core/` or `src/headless/`. Always use `Mulberry32` PRNG from `src/core/rng.ts`.
2. **Test Contract v1.1:** Strictly follow the 12-step tick order, pause freeze rules (`tick` increments, `sim_tick` and timers freeze), Shade state names (`spawning`, `wander`, `chase`, `recoil`, `stunned`), XZ/3D distance rules, exit codes (`0` ok, `2` malformed inputs/scenario, `1` other error), and ≤ 30s runtime for a full 21,600-tick night.
3. **Standardized Map & Angles:** Angles on XZ plane are measured CCW from `+X` (`x = r*cos(a), z = r*sin(a)`). Never alter standardized coordinates or tuning constants.
4. **Creativity Isolation:** Visual/audio enhancements in `src/client/` MUST NEVER alter headless simulation output.
5. **No Fake Evidence & Regression Discipline:** Never weaken tests silently. When a new ticket supersedes an old rule (e.g., Phase 2 scoring on deposit instead of pickup), update the test and record the reason in `docs/notes/`. Always run `npm run verify` before committing or tagging.
6. **Security:** Never commit `.env`, API keys, or secrets.
