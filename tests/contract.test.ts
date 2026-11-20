import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { DEFAULT_TUNING } from '../src/core/config.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const CONTRACT_PATH = path.join(ROOT, 'game.contract.json');
const CLI_PATH = path.join(ROOT, 'dist-headless', 'headless', 'cli.js');

describe('Test Contract v1.1 compliance', () => {
  it('game.contract.json exists and matches DEFAULT_TUNING (Contract v1.1)', () => {
    const raw = fs.readFileSync(CONTRACT_PATH, 'utf-8');
    const contract = JSON.parse(raw);

    expect(contract.contract_version).toBe('1.1');
    expect(contract.team).toBe('2A202603605-NguyenHaAnh');
    expect(contract.build_cmd).toBeTruthy();
    expect(contract.run_cmd).toBeTruthy();
    expect(contract.headless_cmd).toBeTruthy();
    expect(contract.tuning).toEqual(DEFAULT_TUNING);
  });

  it('headless CLI produces identical byte-for-byte JSONL across two runs (determinism)', () => {
    const tmpDir = path.join(ROOT, 'tmp', 'test-det-v11');
    fs.mkdirSync(tmpDir, { recursive: true });
    const out1 = path.join(tmpDir, 'run1.jsonl');
    const out2 = path.join(tmpDir, 'run2.jsonl');

    for (const out of [out1, out2]) {
      execFileSync('node', [
        CLI_PATH,
        '--seed', '42',
        '--night', '1',
        '--ticks', '360',
        '--snapshot-every', '60',
        '--out', out,
      ]);
    }

    const content1 = fs.readFileSync(out1, 'utf-8');
    const content2 = fs.readFileSync(out2, 'utf-8');
    expect(content1).toBe(content2);

    const lines = content1.trim().split('\n').map((l) => JSON.parse(l));
    const snap0 = lines[0];
    expect(snap0.type).toBe('snapshot');
    expect(snap0.tick).toBe(0);
    expect(snap0.sim_tick).toBe(0);
    expect(snap0.night).toBe(1);
    expect(snap0.wind).toEqual({ active: false, dir_deg: 0 });
    expect(Array.isArray(snap0.motes)).toBe(true);
    expect(snap0.motes.length).toBe(20);
    expect(Array.isArray(snap0.drifters)).toBe(true);
    expect(Array.isArray(snap0.charms)).toBe(true);
    expect(typeof snap0.player.grounded).toBe('boolean');
    expect(typeof snap0.player.invuln).toBe('boolean');
    expect(Array.isArray(snap0.player.vel)).toBe(true);

    // Verify 2 shades spawned at tick 300
    const spawnEvents = lines.filter((l) => l.type === 'event' && l.name === 'shade_spawned');
    expect(spawnEvents.length).toBe(2);
    expect(spawnEvents[0].tick).toBe(300);

    expect(lines[lines.length - 1].type).toBe('end');
    expect(lines[lines.length - 1].ticks).toBe(360);
  });

  it('headless CLI supports --night 1, 2, 3 and rejects invalid night', () => {
    const tmpDir = path.join(ROOT, 'tmp', 'test-nights');
    fs.mkdirSync(tmpDir, { recursive: true });
    for (const n of ['1', '2', '3']) {
      const out = path.join(tmpDir, `night-${n}.jsonl`);
      execFileSync('node', [CLI_PATH, '--seed', '7', '--night', n, '--ticks', '10', '--out', out]);
      const snap0 = JSON.parse(fs.readFileSync(out, 'utf-8').trim().split('\n')[0]);
      expect(snap0.night).toBe(Number(n));
    }
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
      execFileSync(
        'node',
        [CLI_PATH, '--seed', '1', '--night', '1', '--inputs', badInputs, '--ticks', '60', '--out', out],
        { stdio: 'pipe' }
      );
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
      execFileSync(
        'node',
        [CLI_PATH, '--seed', '1', '--night', '1', '--scenario', badScenario, '--ticks', '10', '--out', out],
        { stdio: 'pipe' }
      );
    } catch (err: unknown) {
      exitCode = (err as { status?: number }).status ?? -1;
    }
    expect(exitCode).toBe(2);
  });
});
