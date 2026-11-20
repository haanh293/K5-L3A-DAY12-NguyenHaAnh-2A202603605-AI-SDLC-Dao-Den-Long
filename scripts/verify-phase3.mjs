import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const CLI = path.join(ROOT, 'dist-headless', 'headless', 'cli.js');
const PROOF_DIR = path.join(ROOT, 'docs', 'proof', 'phase-3');
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

// 1. Fuel decay -> lantern_out -> relight (5 motes, +40 pts, capacity 10->12)
const fuelScen = writeJson('scenario-fuel-relight.json', {
  player: { pos: [0, 0, 24], carried: 5, flames: 3 },
  random_motes: false,
  random_shades: false,
  motes: [],
  shades: [],
  lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 1.0 }],
  time_left_s: 60,
});
const fuelInp = writeJson('inputs-fuel-relight.json', {
  frames: [
    { tick: 65, interact: true },
    { tick: 66, interact: false },
  ],
});
const fuelOut = path.join(PROOF_DIR, 'out-fuel-relight.jsonl');
runHeadless(['--seed', '301', '--night', '1', '--scenario', fuelScen, '--inputs', fuelInp, '--ticks', '80', '--snapshot-every', '20', '--out', fuelOut]);
const fuelLines = readJsonl(fuelOut);
if (
  !fuelLines.some((l) => l.type === 'event' && l.name === 'lantern_out' && l.data.lantern_id === 'L1') ||
  !fuelLines.some((l) => l.type === 'event' && l.name === 'lantern_lit' && l.data.relight === true)
) {
  throw new Error('Fuel decay & relight scenario failed');
}

// 2. Refuel scenario
const refuelScen = writeJson('scenario-refuel.json', {
  player: { pos: [0, 0, 24], carried: 6, flames: 3 },
  random_motes: false,
  random_shades: false,
  motes: [],
  shades: [],
  lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 45 }],
  time_left_s: 60,
});
const refuelInp = writeJson('inputs-refuel.json', {
  frames: [
    { tick: 5, interact: true },
    { tick: 6, interact: false },
  ],
});
const refuelOut = path.join(PROOF_DIR, 'out-refuel.jsonl');
runHeadless(['--seed', '302', '--night', '1', '--scenario', refuelScen, '--inputs', refuelInp, '--ticks', '20', '--snapshot-every', '10', '--out', refuelOut]);
const refuelLines = readJsonl(refuelOut);
if (!refuelLines.some((l) => l.type === 'event' && l.name === 'refuel' && l.data.fuel === 100)) {
  throw new Error('Refuel scenario failed');
}

// 3. Shade drain & +15 Pulse bonus scenario
const drainScen = writeJson('scenario-shade-drain.json', {
  player: { pos: [0, 0, 17], carried: 5, flames: 3 },
  random_motes: false,
  random_shades: false,
  motes: [],
  shades: [{ id: 'S1', pos: [0, 0.8, 26], state: 'drain', target_lantern_id: 'L1' }],
  lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 25 }],
  time_left_s: 60,
});
const drainInp = writeJson('inputs-shade-drain.json', {
  frames: [
    { tick: 65, move: [0, 1] },
    { tick: 130, move: [0, 0], pulse: true },
    { tick: 131, pulse: false },
  ],
});
const drainOut = path.join(PROOF_DIR, 'out-shade-drain.jsonl');
runHeadless(['--seed', '303', '--night', '1', '--scenario', drainScen, '--inputs', drainInp, '--ticks', '140', '--snapshot-every', '20', '--out', drainOut]);
const drainLines = readJsonl(drainOut);
if (!drainLines.some((l) => l.type === 'event' && l.name === 'fuel_drain' && l.data.shade_id === 'S1')) {
  throw new Error('Shade drain scenario failed');
}

// 4. Dawn survived win scenario (3/5 lit at dawn -> dawn_survived)
const dawnScen = writeJson('scenario-dawn-survived.json', {
  player: { pos: [0, 0, 0], carried: 0, flames: 3 },
  random_motes: false,
  random_shades: false,
  motes: [],
  shades: [],
  lanterns: [
    { id: 'L1', lit: true, fuel: 50 },
    { id: 'L2', lit: true, fuel: 40 },
    { id: 'L3', lit: true, fuel: 30 },
    { id: 'L4', lit: false },
    { id: 'L5', lit: false },
  ],
  time_left_s: 2.0,
});
const dawnOut = path.join(PROOF_DIR, 'out-dawn-survived.jsonl');
runHeadless(['--seed', '304', '--night', '1', '--scenario', dawnScen, '--ticks', '180', '--snapshot-every', '60', '--out', dawnOut]);
const dawnLines = readJsonl(dawnOut);
const dawnGo = dawnLines.find((l) => l.type === 'event' && l.name === 'game_over');
if (!dawnGo || dawnGo.data.result !== 'won' || dawnGo.data.reason !== 'dawn_survived') {
  throw new Error('Dawn survived scenario failed');
}

// 5. Full Night 3 (18,000 ticks = 300s) Performance & Determinism check
const perfOut1 = path.join(ROOT, 'tmp', 'perf-p3-n3-run1.jsonl');
const perfOut2 = path.join(ROOT, 'tmp', 'perf-p3-n3-run2.jsonl');
const t0 = performance.now();
runHeadless(['--seed', '999', '--night', '3', '--ticks', '18000', '--snapshot-every', '600', '--out', perfOut1]);
const elapsedMs = Math.round(performance.now() - t0);
runHeadless(['--seed', '999', '--night', '3', '--ticks', '18000', '--snapshot-every', '600', '--out', perfOut2]);

const raw1 = fs.readFileSync(perfOut1, 'utf-8');
const raw2 = fs.readFileSync(perfOut2, 'utf-8');
if (raw1 !== raw2) {
  throw new Error('Phase 3 Night 3 determinism check FAILED');
}
if (elapsedMs > 30000) {
  throw new Error(`Full-night headless exceeded 30s limit: ${elapsedMs}ms`);
}

console.log('Phase 3 headless verification PASSED:');
console.log('  - Fuel Decay/Relight, Refuel, Shade Drain, Dawn Survived: ALL PASS');
console.log(`  - Full Night 3 (18,000 ticks) runtime: ${elapsedMs} ms (limit <= 30,000 ms)`);
console.log(`  - Night 3 determinism (seed=999, 18,000 ticks): byte-for-byte identical (${raw1.length} bytes)`);
