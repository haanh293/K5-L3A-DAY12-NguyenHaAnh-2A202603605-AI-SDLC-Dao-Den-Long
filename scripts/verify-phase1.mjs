import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const CLI = path.join(ROOT, 'dist-headless', 'headless', 'cli.js');
const PROOF_DIR = path.join(ROOT, 'docs', 'proof', 'phase-1');
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

// Scenario 1: Full win loop (pickup 3 motes -> deposit -> light L1 -> win)
const winScenarioPath = path.join(PROOF_DIR, 'scenario-win.json');
const winInputsPath = path.join(PROOF_DIR, 'inputs-win.json');
const winOutPath = path.join(PROOF_DIR, 'out-win.jsonl');

fs.writeFileSync(
  winScenarioPath,
  JSON.stringify(
    {
      player: { pos: [0, 0, 0], carried: 0, flames: 3 },
      random_motes: false,
      random_shades: false,
      motes: [
        [0, 0, 3],
        [0, 0, 6],
        [0, 0, 9],
      ],
      shades: [],
      lanterns: [
        { id: 'L1', pos: [0, 0, 12], deposited: 0, lit: false },
        { id: 'L2', lit: true },
        { id: 'L3', lit: true },
        { id: 'L4', lit: true },
        { id: 'L5', lit: true },
      ],
      time_left_s: 120,
    },
    null,
    2
  )
);

fs.writeFileSync(
  winInputsPath,
  JSON.stringify(
    {
      frames: [
        { tick: 0, move: [0, 1], cam_yaw_deg: 0 },
        { tick: 110, move: [0, 0], interact: true },
        { tick: 111, interact: false },
      ],
    },
    null,
    2
  )
);

runHeadless([
  '--seed', '101',
  '--night', '1',
  '--scenario', winScenarioPath,
  '--inputs', winInputsPath,
  '--ticks', '200',
  '--snapshot-every', '20',
  '--out', winOutPath,
]);

const winLines = readJsonl(winOutPath);
const winEnd = winLines[winLines.length - 1];
if (winEnd.type !== 'end' || winEnd.state !== 'won') {
  throw new Error(`Win scenario failed: ${JSON.stringify(winEnd)}`);
}

// Scenario 2: Pulse stun + push & Shade safe_radius
const pulseScenarioPath = path.join(PROOF_DIR, 'scenario-pulse.json');
const pulseInputsPath = path.join(PROOF_DIR, 'inputs-pulse.json');
const pulseOutPath = path.join(PROOF_DIR, 'out-pulse.jsonl');

fs.writeFileSync(
  pulseScenarioPath,
  JSON.stringify(
    {
      player: { pos: [0, 0, 0], carried: 2, flames: 3 },
      random_motes: false,
      random_shades: false,
      motes: [],
      shades: [{ id: 'S1', pos: [0, 0, 4] }],
      time_left_s: 60,
    },
    null,
    2
  )
);

fs.writeFileSync(
  pulseInputsPath,
  JSON.stringify(
    {
      frames: [
        { tick: 5, pulse: true },
        { tick: 6, pulse: false },
      ],
    },
    null,
    2
  )
);

runHeadless([
  '--seed', '202',
  '--night', '1',
  '--scenario', pulseScenarioPath,
  '--inputs', pulseInputsPath,
  '--ticks', '60',
  '--snapshot-every', '10',
  '--out', pulseOutPath,
]);

const pulseLines = readJsonl(pulseOutPath);
const pulseEv = pulseLines.find((l) => l.type === 'event' && l.name === 'pulse');
if (!pulseEv || !pulseEv.data.stunned_ids.includes('S1')) {
  throw new Error('Pulse scenario failed: S1 was not stunned');
}

// Scenario 3: Determinism check (2 identical runs with random spawns enabled)
const detOut1 = path.join(PROOF_DIR, 'out-determinism-run1.jsonl');
const detOut2 = path.join(PROOF_DIR, 'out-determinism-run2.jsonl');
runHeadless(['--seed', '777', '--night', '1', '--ticks', '600', '--snapshot-every', '60', '--out', detOut1]);
runHeadless(['--seed', '777', '--night', '1', '--ticks', '600', '--snapshot-every', '60', '--out', detOut2]);

const raw1 = fs.readFileSync(detOut1, 'utf-8');
const raw2 = fs.readFileSync(detOut2, 'utf-8');
if (raw1 !== raw2) {
  throw new Error('Determinism check FAILED: outputs differ');
}

console.log('Phase 1 headless verification PASSED:');
console.log(`  - Win scenario: ticks=${winEnd.ticks}, state=${winEnd.state}, score=${winEnd.score}`);
console.log(`  - Pulse scenario: stunned_ids=${JSON.stringify(pulseEv.data.stunned_ids)} at tick=${pulseEv.tick}`);
console.log(`  - Determinism (seed=777, 600 ticks): byte-for-byte identical (${raw1.length} bytes)`);
