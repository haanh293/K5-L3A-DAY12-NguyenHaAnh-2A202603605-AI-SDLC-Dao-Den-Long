# AGENTS.md — Đảo Đèn Lồng (AI SDLC Harness)

## Project Overview
- **Game:** Đảo Đèn Lồng (3D third-person game, TypeScript + Three.js + Vite).
- **Architecture:** Strict separation between deterministic 60Hz core (`src/core/`), headless CLI (`src/headless/`), and 3D browser renderer (`src/client/`).
- **Single Source of Truth:** `game.contract.json` defines all `tuning` values. `src/core/config.ts` MUST stay 100% synced with `game.contract.json` (enforced by unit test).

## Commands
- Install & build: `npm install && npm run build`
- Build headless only: `npm run build:headless`
- Run unit & contract tests: `npm test`
- Full phase verification (build + tests + headless scenarios + determinism): `npm run verify`
- Run 3D game locally: `npm run dev` (or `npm run preview` after build)

## Strict Rules
1. **Determinism:** Never use `Math.random()` or `Date.now()` inside `src/core/` or `src/headless/`. Always use `Mulberry32` PRNG from `src/core/rng.ts`.
2. **Test Contract:** Never break Test Contract v1.0 JSONL schema, tick model (tick 0 snapshot before inputs; step `k` reads input `k`, emits events at `tick = k+1`), XZ horizontal distance checks (`<= r`), or exit codes (`0` ok, `2` malformed inputs/scenario, `1` other error).
3. **Creativity isolation:** Visual/audio enhancements in `src/client/` MUST NEVER alter headless simulation output.
4. **No fake evidence:** Never hardcode test outputs or weaken assertions to make tests pass. Run `npm run verify` before finishing any phase or commit.
5. **Security:** Never commit `.env`, API keys, or secrets.
