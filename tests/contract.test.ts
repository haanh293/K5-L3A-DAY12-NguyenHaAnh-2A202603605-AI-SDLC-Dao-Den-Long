import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { DEFAULT_TUNING } from '../src/core/config.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const CONTRACT_PATH = path.join(ROOT, 'game.contract.json');
const CLI_PATH = path.join(ROOT, 'dist-headless', 'headless', 'cli.js');

describe('Test Contract v1.0 compliance', () => {
  it('game.contract.json exists and matches DEFAULT_TUNING exactly', () => {
    const raw = fs.readFileSync(CONTRACT_PATH, 'utf-8');
    const contract = JSON.parse(raw);

    expect(contract.contract_version).toBe('1.0');
    expect(contract.team).toBe('2A202603605-NguyenHaAnh');
    expect(contract.build_cmd).toBeTruthy();
    expect(contract.run_cmd).toBeTruthy();
    expect(contract.headless_cmd).toBeTruthy();
    expect(contract.tuning).toEqual(DEFAULT_TUNING);
  });

  it('headless CLI produces identical byte-for-byte JSONL across two runs (determinism)', () => {
    const tmpDir = path.join(ROOT, 'tmp', 'test-det');
    fs.mkdirSync(tmpDir, { recursive: true });
    const out1 = path.join(tmpDir, 'run1.jsonl');
    const out2 = path.join(tmpDir, 'run2.jsonl');

    execFileSync('node', [
      CLI_PATH,
      '--seed', '42',
      '--night', '1',
      '--ticks', '300',
      '--snapshot-every', '30',
      '--out', out1,
    ]);
    execFileSync('node', [
      CLI_PATH,
      '--seed', '42',
      '--night', '1',
      '--ticks', '300',
      '--snapshot-every', '30',
      '--out', out2,
    ]);

    const content1 = fs.readFileSync(out1, 'utf-8');
    const content2 = fs.readFileSync(out2, 'utf-8');
    expect(content1).toBe(content2);

    const lines = content1.trim().split('\n').map((l) => JSON.parse(l));
    expect(lines[0].type).toBe('snapshot');
    expect(lines[0].tick).toBe(0);
    expect(lines[0].sim_tick).toBe(0);
    expect(lines[lines.length - 1].type).toBe('end');
    expect(lines[lines.length - 1].ticks).toBe(300);
  });

  it('headless CLI exits with code 2 on non-strictly increasing input ticks', () => {
    const tmpDir = path.join(ROOT, 'tmp', 'test-err');
    fs.mkdirSync(tmpDir, { recursive: true });
    const badInputs = path.join(tmpDir, 'bad-inputs.json');
    const out = path.join(tmpDir, 'out.jsonl');
    fs.writeFileSync(
      badInputs,
      JSON.stringify({
        frames: [
          { tick: 10, move: [0, 1] },
          { tick: 10, move: [0, 0] },
        ],
      })
    );

    let exitCode = 0;
    try {
      execFileSync('node', [
        CLI_PATH,
        '--seed', '1',
        '--night', '1',
        '--inputs', badInputs,
        '--ticks', '60',
        '--out', out,
      ], { stdio: 'pipe' });
    } catch (err: unknown) {
      exitCode = (err as { status?: number }).status ?? -1;
    }
    expect(exitCode).toBe(2);
  });

  it('headless CLI exits with code 2 on malformed scenario JSON', () => {
    const tmpDir = path.join(ROOT, 'tmp', 'test-err');
    fs.mkdirSync(tmpDir, { recursive: true });
    const badScenario = path.join(tmpDir, 'bad-scenario.json');
    const out = path.join(tmpDir, 'out2.jsonl');
    fs.writeFileSync(badScenario, '{ invalid json');

    let exitCode = 0;
    try {
      execFileSync('node', [
        CLI_PATH,
        '--seed', '1',
        '--night', '1',
        '--scenario', badScenario,
        '--ticks', '10',
        '--out', out,
      ], { stdio: 'pipe' });
    } catch (err: unknown) {
      exitCode = (err as { status?: number }).status ?? -1;
    }
    expect(exitCode).toBe(2);
  });
});
