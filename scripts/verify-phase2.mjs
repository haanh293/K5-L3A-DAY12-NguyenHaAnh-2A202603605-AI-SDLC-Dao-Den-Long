import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const CLI = path.join(ROOT, 'dist-headless', 'headless', 'cli.js');
const PROOF_DIR = path.join(ROOT, 'docs', 'proof', 'phase-2');
fs.mkdirSync(PROOF_DIR, { recursive: true });

function runHeadless(args) {
  return execFileSync('node', [CLI, ...args], { encoding: 'utf-8' });
}

function readJsonl(filePath) {
  return fs
    .readFileSync(filePath, 'utf-8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
}

function writeJson(name, obj) {
  const p = path.join(PROOF_DIR, name);
  fs.writeFileSync(p, JSON.stringify(obj, null, 2));
  return p;
}

// 1. Dash scenario
const dashScen = writeJson('scenario-dash.json', {
  player: { pos: [0, 0, 0], carried: 0, flames: 3 },
  random_motes: false,
  random_shades: false,
  motes: [],
  shades: [],
});
const dashInp = writeJson('inputs-dash.json', {
  frames: [
    { tick: 0, move: [0, 1], dash: true },
    { tick: 1, dash: false },
  ],
});
const dashOut = path.join(PROOF_DIR, 'out-dash.jsonl');
runHeadless(['--seed', '1', '--night', '1', '--scenario', dashScen, '--inputs', dashInp, '--ticks', '20', '--snapshot-every', '10', '--out', dashOut]);
const dashLines = readJsonl(dashOut);
if (!dashLines.some((l) => l.type === 'event' && l.name === 'dash')) {
  throw new Error('Dash scenario failed');
}

// 2. Fall & respawn scenario
const fallScen = writeJson('scenario-fall.json', {
  player: { pos: [41, 0, 0], carried: 4, flames: 3 },
  random_motes: false,
  random_shades: false,
  motes: [],
  shades: [],
});
const fallOut = path.join(PROOF_DIR, 'out-fall.jsonl');
runHeadless(['--seed', '2', '--night', '1', '--scenario', fallScen, '--ticks', '150', '--snapshot-every', '30', '--out', fallOut]);
const fallLines = readJsonl(fallOut);
const fallEv = fallLines.find((l) => l.type === 'event' && l.name === 'player_hit' && l.data.by === 'fall');
if (!fallEv || fallEv.data.lost !== 4) {
  throw new Error('Fall scenario failed');
}

// 3. Pause / Resume scenario
const pauseScen = writeJson('scenario-pause.json', {
  random_motes: false,
  random_shades: false,
  motes: [],
  shades: [],
});
const pauseInp = writeJson('inputs-pause.json', {
  frames: [
    { tick: 5, pause: true },
    { tick: 6, pause: false },
    { tick: 25, pause: true },
    { tick: 26, pause: false },
  ],
});
const pauseOut = path.join(PROOF_DIR, 'out-pause.jsonl');
runHeadless(['--seed', '3', '--night', '1', '--scenario', pauseScen, '--inputs', pauseInp, '--ticks', '40', '--snapshot-every', '10', '--out', pauseOut]);
const pauseLines = readJsonl(pauseOut);
const pausedSnap = pauseLines.find((l) => l.type === 'snapshot' && l.tick === 10);
if (!pausedSnap || pausedSnap.state !== 'paused' || pausedSnap.sim_tick !== 5) {
  throw new Error('Pause scenario failed');
}

// 4. Night 2 Jump Pad scenario
const padScen = writeJson('scenario-jump-pad.json', {
  player: { pos: [20, 0, 18], carried: 0, flames: 3 },
  random_motes: false,
  random_shades: false,
  random_drifters: false,
  motes: [],
  shades: [],
});
const padOut = path.join(PROOF_DIR, 'out-jump-pad.jsonl');
runHeadless(['--seed', '4', '--night', '2', '--scenario', padScen, '--ticks', '100', '--snapshot-every', '20', '--out', padOut]);
const padLines = readJsonl(padOut);
const padFinalSnap = padLines.filter((l) => l.type === 'snapshot').pop();
if (!padFinalSnap || Math.hypot(padFinalSnap.player.pos[0] - 70, padFinalSnap.player.pos[2]) >= 28) {
  throw new Error('Night 2 jump pad scenario failed');
}

// 5. Night 2 Wind Charm scenario
const charmScen = writeJson('scenario-charm.json', {
  player: { pos: [35, 0, 0], carried: 0, flames: 3 },
  random_motes: false,
  random_shades: false,
  random_drifters: false,
  motes: [],
  shades: [],
});
const charmOut = path.join(PROOF_DIR, 'out-charm.jsonl');
runHeadless(['--seed', '5', '--night', '2', '--scenario', charmScen, '--ticks', '20', '--snapshot-every', '10', '--out', charmOut]);
const charmLines = readJsonl(charmOut);
if (!charmLines.some((l) => l.type === 'event' && l.name === 'charm_picked')) {
  throw new Error('Wind charm scenario failed');
}

// 6. Night 2 Drifter (Gió Lạc) steal & pulse-drop scenario
const drifterScen = writeJson('scenario-drifter.json', {
  player: { pos: [0, 0, 0], carried: 7, flames: 3 },
  random_motes: false,
  random_shades: false,
  random_drifters: false,
  motes: [],
  shades: [],
  drifters: [{ id: 'D1', pos: [0, 1.0, 1.0], state: 'idle' }],
});
const drifterInp = writeJson('inputs-drifter.json', {
  frames: [
    { tick: 2, pulse: true },
    { tick: 3, pulse: false },
  ],
});
const drifterOut = path.join(PROOF_DIR, 'out-drifter.jsonl');
runHeadless(['--seed', '6', '--night', '2', '--scenario', drifterScen, '--inputs', drifterInp, '--ticks', '20', '--snapshot-every', '10', '--out', drifterOut]);
const drifterLines = readJsonl(drifterOut);
if (
  !drifterLines.some((l) => l.type === 'event' && l.name === 'drifter_steal') ||
  !drifterLines.some((l) => l.type === 'event' && l.name === 'drifter_drop')
) {
  throw new Error('Drifter steal & drop scenario failed');
}

// 7. Night 3 Tiered Terrain, Jump Pad & Wind scenario
const n3Scen = writeJson('scenario-night3-wind.json', {
  player: { pos: [0, 3, 13], carried: 0, flames: 3 },
  random_motes: false,
  random_shades: false,
  random_drifters: false,
  wind_enabled: true,
  motes: [],
  shades: [],
});
const n3Out = path.join(PROOF_DIR, 'out-night3-wind.jsonl');
runHeadless(['--seed', '7', '--night', '3', '--scenario', n3Scen, '--ticks', '1860', '--snapshot-every', '60', '--out', n3Out]);
const n3Lines = readJsonl(n3Out);
const windSnap = n3Lines.find((l) => l.type === 'snapshot' && l.wind && l.wind.active === true);
const tier2Snap = n3Lines.find((l) => l.type === 'snapshot' && l.tick === 60);
if (!tier2Snap || tier2Snap.player.pos[1] < 5.9 || !windSnap) {
  throw new Error('Night 3 terrain & wind scenario failed');
}

// 8. Full Night 3 Performance Benchmark (21,600 ticks must finish in <= 30s) & Determinism
const perfOut1 = path.join(ROOT, 'tmp', 'perf-night3-run1.jsonl');
const perfOut2 = path.join(ROOT, 'tmp', 'perf-night3-run2.jsonl');
const t0 = performance.now();
runHeadless(['--seed', '999', '--night', '3', '--ticks', '21600', '--snapshot-every', '600', '--out', perfOut1]);
const elapsedMs = Math.round(performance.now() - t0);
runHeadless(['--seed', '999', '--night', '3', '--ticks', '21600', '--snapshot-every', '600', '--out', perfOut2]);

const raw1 = fs.readFileSync(perfOut1, 'utf-8');
const raw2 = fs.readFileSync(perfOut2, 'utf-8');
if (raw1 !== raw2) {
  throw new Error('Night 3 determinism check FAILED');
}
if (elapsedMs > 30000) {
  throw new Error(`Full-night headless exceeded 30s limit: ${elapsedMs}ms`);
}

console.log('Phase 2 headless verification PASSED:');
console.log('  - Dash, Fall/Respawn, Pause/Resume, Night 2 Jump Pad, Wind Charm, Drifter Steal/Drop, Night 3 Terrain/Wind: ALL PASS');
console.log(`  - Full Night 3 (21,600 ticks) runtime: ${elapsedMs} ms (limit <= 30,000 ms)`);
console.log(`  - Night 3 determinism (seed=999, 21,600 ticks): byte-for-byte identical (${raw1.length} bytes)`);
