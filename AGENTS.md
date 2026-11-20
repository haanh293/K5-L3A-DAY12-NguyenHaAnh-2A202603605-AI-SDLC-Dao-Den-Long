# AGENTS.md — Đảo Đèn Lồng (AI SDLC Harness)

## Project Overview
- **Game:** Đảo Đèn Lồng (3D third-person game, TypeScript + Three.js + Vite) across 3 Nights (Đảo Bến, Đảo Cau, Đảo Chuông).
- **Architecture:** Strict separation between deterministic 60Hz core (`src/core/`), headless CLI (`src/headless/`), and 3D browser renderer (`src/client/`).
- **Single Source of Truth:** `game.contract.json` (Contract v1.2) defines all standardized `tuning` values. `src/core/config.ts` MUST stay 100% synced with `game.contract.json` (enforced by unit test).

## Commands
- Install & build: `npm install && npm run build`
- Build headless only: `npm run build:headless`
- Run unit & contract tests: `npm test`
- Full verification (build + tests + headless scenarios + performance + determinism): `npm run verify`
- Run 3D game locally: `npm run dev` (or `npm run preview` after build)
- On Windows PowerShell 5.1, chain commands with `; if ($LASTEXITCODE -eq 0) { ... }` instead of `&&`.

## Strict Rules
1. **Determinism & Fuel Precision:** Never use `Math.random()` or `Date.now()` inside `src/core/` or `src/headless/`. Always use `Mulberry32` PRNG (`src/core/rng.ts`). Track lantern fuel internally in integer `1/60` units (`0..6000`) to avoid floating-point drift; round to 1 decimal only in snapshots/events.
2. **Test Contract v1.2:** Strictly follow the 12-step tick order (step 2 decrements fuel & extinguishes lanterns with `fuel <= 0`; step 11 checks `no_flames` before `dawn_survived`/`dawn`; NO early `all_lit` win), pause freeze rules, Shade states (`spawning`, `wander`, `chase`, `recoil`, `stunned`, `drain`), exit codes (`0` ok, `2` malformed inputs/scenario, `1` other), and ≤ 30s runtime for a full night.
3. **Standardized Map & Angles:** Angles on XZ plane are measured CCW from `+X` (`x = r*cos(a), z = r*sin(a)`). Never alter standardized coordinates or tuning constants.
4. **Creativity & Accessibility Isolation:** Visual/audio enhancements and colorblind palette overrides in `src/client/` MUST NEVER alter headless simulation output.
5. **No Fake Evidence & Regression Discipline:** Never skip or weaken tests silently. When a Change Request supersedes an old rule (e.g., Phase 3 fuel/dawn-survived replacing `all_lit`), record an ADR + CHANGELOG entry and update affected tests with explicit reasons. Always run `npm run verify` before committing or tagging.
6. **Security:** Never commit `.env`, API keys, or secrets.
