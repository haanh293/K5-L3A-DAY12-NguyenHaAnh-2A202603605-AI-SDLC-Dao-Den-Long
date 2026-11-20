import * as fs from 'node:fs';
import * as path from 'node:path';
import { GameSimulation, createDefaultInputState } from '../core/simulation.js';
import type {
  InputFrame,
  InputsFile,
  NightNumber,
  ScenarioConfig,
  TickInputState,
} from '../core/types.js';

interface CliArgs {
  seed: number;
  night: NightNumber;
  scenarioPath?: string;
  inputsPath?: string;
  ticks: number;
  outPath: string;
  snapshotEvery: number;
}

class FormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FormatError';
  }
}

const VALID_SHADE_STATES = new Set(['spawning', 'wander', 'chase', 'recoil', 'stunned']);
const VALID_DRIFTER_STATES = new Set(['idle', 'chase', 'flee']);

function parseArgs(argv: string[]): CliArgs {
  let seed: number | undefined;
  let night: number | undefined;
  let scenarioPath: string | undefined;
  let inputsPath: string | undefined;
  let ticks: number | undefined;
  let outPath: string | undefined;
  let snapshotEvery = 10;

  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const next = argv[i + 1];
    switch (flag) {
      case '--seed':
        if (next === undefined || !/^-?\d+$/.test(next)) {
          throw new Error('--seed requires an integer');
        }
        seed = parseInt(next, 10);
        i++;
        break;
      case '--night':
        if (next === undefined || !/^\d+$/.test(next)) {
          throw new Error('--night requires an integer (1, 2, or 3)');
        }
        night = parseInt(next, 10);
        i++;
        break;
      case '--scenario':
        if (next === undefined) throw new Error('--scenario requires a file path');
        scenarioPath = next;
        i++;
        break;
      case '--inputs':
        if (next === undefined) throw new Error('--inputs requires a file path');
        inputsPath = next;
        i++;
        break;
      case '--ticks':
        if (next === undefined || !/^\d+$/.test(next)) {
          throw new Error('--ticks requires a non-negative integer');
        }
        ticks = parseInt(next, 10);
        i++;
        break;
      case '--out':
        if (next === undefined) throw new Error('--out requires a file path');
        outPath = next;
        i++;
        break;
      case '--snapshot-every':
        if (next === undefined || !/^\d+$/.test(next) || parseInt(next, 10) <= 0) {
          throw new Error('--snapshot-every requires a positive integer');
        }
        snapshotEvery = parseInt(next, 10);
        i++;
        break;
      default:
        throw new Error(`Unknown argument: ${flag}`);
    }
  }

  if (seed === undefined) throw new Error('Missing required --seed');
  if (night === undefined) throw new Error('Missing required --night');
  if (night !== 1 && night !== 2 && night !== 3) {
    throw new Error(`Unsupported --night ${night} (Contract v1.1 supports 1, 2, or 3)`);
  }
  if (ticks === undefined) throw new Error('Missing required --ticks');
  if (outPath === undefined) throw new Error('Missing required --out');

  return {
    seed,
    night,
    scenarioPath,
    inputsPath,
    ticks,
    outPath,
    snapshotEvery,
  };
}

function isVec3(v: unknown): v is [number, number, number] {
  return (
    Array.isArray(v) &&
    v.length === 3 &&
    v.every((n) => typeof n === 'number' && Number.isFinite(n))
  );
}

function loadAndValidateScenario(filePath: string): ScenarioConfig {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    throw new Error(`Failed to read scenario file: ${filePath}: ${(err as Error).message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new FormatError(`Invalid JSON in scenario file: ${(err as Error).message}`);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new FormatError('Scenario root must be a JSON object');
  }

  const obj = parsed as Record<string, unknown>;

  if (obj.player !== undefined) {
    if (typeof obj.player !== 'object' || obj.player === null || Array.isArray(obj.player)) {
      throw new FormatError('scenario.player must be an object');
    }
    const p = obj.player as Record<string, unknown>;
    if (p.pos !== undefined && !isVec3(p.pos)) {
      throw new FormatError('scenario.player.pos must be [x, y, z]');
    }
    for (const numKey of [
      'carried',
      'flames',
      'invuln_ticks',
      'dash_cd_ticks',
      'pulse_cd_ticks',
      'charm_ticks',
    ]) {
      if (p[numKey] !== undefined && (typeof p[numKey] !== 'number' || (p[numKey] as number) < 0)) {
        throw new FormatError(`scenario.player.${numKey} must be a non-negative number`);
      }
    }
  }

  for (const boolKey of ['random_motes', 'random_shades', 'random_drifters', 'wind_enabled']) {
    if (obj[boolKey] !== undefined && typeof obj[boolKey] !== 'boolean') {
      throw new FormatError(`scenario.${boolKey} must be a boolean`);
    }
  }

  if (obj.time_left_s !== undefined && (typeof obj.time_left_s !== 'number' || obj.time_left_s < 0)) {
    throw new FormatError('scenario.time_left_s must be a non-negative number');
  }

  if (obj.motes !== undefined) {
    if (!Array.isArray(obj.motes)) {
      throw new FormatError('scenario.motes must be an array');
    }
    for (const m of obj.motes) {
      if (isVec3(m)) continue;
      if (typeof m === 'object' && m !== null && isVec3((m as Record<string, unknown>).pos)) {
        continue;
      }
      throw new FormatError('Each mote in scenario.motes must be [x,y,z] or {pos:[x,y,z]}');
    }
  }

  if (obj.shades !== undefined) {
    if (!Array.isArray(obj.shades)) {
      throw new FormatError('scenario.shades must be an array');
    }
    for (const s of obj.shades) {
      if (typeof s !== 'object' || s === null || !isVec3((s as Record<string, unknown>).pos)) {
        throw new FormatError('Each shade in scenario.shades must have pos:[x,y,z]');
      }
      const sObj = s as Record<string, unknown>;
      if (sObj.state !== undefined && (typeof sObj.state !== 'string' || !VALID_SHADE_STATES.has(sObj.state))) {
        throw new FormatError(`Invalid shade state: ${String(sObj.state)}`);
      }
    }
  }

  if (obj.drifters !== undefined) {
    if (!Array.isArray(obj.drifters)) {
      throw new FormatError('scenario.drifters must be an array');
    }
    for (const d of obj.drifters) {
      if (typeof d !== 'object' || d === null || !isVec3((d as Record<string, unknown>).pos)) {
        throw new FormatError('Each drifter in scenario.drifters must have pos:[x,y,z]');
      }
      const dObj = d as Record<string, unknown>;
      if (dObj.state !== undefined && (typeof dObj.state !== 'string' || !VALID_DRIFTER_STATES.has(dObj.state))) {
        throw new FormatError(`Invalid drifter state: ${String(dObj.state)}`);
      }
    }
  }

  if (obj.charms !== undefined) {
    if (!Array.isArray(obj.charms)) {
      throw new FormatError('scenario.charms must be an array');
    }
    for (const c of obj.charms) {
      if (typeof c !== 'object' || c === null) {
        throw new FormatError('Each charm in scenario.charms must be an object');
      }
      const cObj = c as Record<string, unknown>;
      if (cObj.pos !== undefined && !isVec3(cObj.pos)) {
        throw new FormatError('scenario.charms[].pos must be [x,y,z]');
      }
    }
  }

  if (obj.lanterns !== undefined) {
    if (!Array.isArray(obj.lanterns)) {
      throw new FormatError('scenario.lanterns must be an array');
    }
    for (const l of obj.lanterns) {
      if (typeof l !== 'object' || l === null || typeof (l as Record<string, unknown>).id !== 'string') {
        throw new FormatError('Each lantern in scenario.lanterns must have a string id');
      }
      const lObj = l as Record<string, unknown>;
      if (lObj.pos !== undefined && !isVec3(lObj.pos)) {
        throw new FormatError('scenario.lanterns[].pos must be [x,y,z]');
      }
    }
  }

  return obj as ScenarioConfig;
}

function loadAndValidateInputs(filePath: string): InputFrame[] {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    throw new Error(`Failed to read inputs file: ${filePath}: ${(err as Error).message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new FormatError(`Invalid JSON in inputs file: ${(err as Error).message}`);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new FormatError('Inputs root must be a JSON object');
  }

  const frames = (parsed as InputsFile).frames;
  if (!Array.isArray(frames)) {
    throw new FormatError('inputs.frames must be an array');
  }

  let prevTick = -1;
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i] as unknown;
    if (typeof f !== 'object' || f === null || Array.isArray(f)) {
      throw new FormatError(`inputs.frames[${i}] must be an object`);
    }
    const frame = f as Record<string, unknown>;
    if (typeof frame.tick !== 'number' || !Number.isInteger(frame.tick) || frame.tick < 0) {
      throw new FormatError(`inputs.frames[${i}].tick must be a non-negative integer`);
    }
    if (frame.tick <= prevTick) {
      throw new FormatError(
        `inputs.frames[${i}].tick (${frame.tick}) must be strictly increasing (prev=${prevTick})`
      );
    }
    prevTick = frame.tick;

    if (frame.move !== undefined) {
      if (
        !Array.isArray(frame.move) ||
        frame.move.length !== 2 ||
        typeof frame.move[0] !== 'number' ||
        typeof frame.move[1] !== 'number' ||
        !Number.isFinite(frame.move[0]) ||
        !Number.isFinite(frame.move[1])
      ) {
        throw new FormatError(`inputs.frames[${i}].move must be [x, z] numbers`);
      }
    }
    if (
      frame.cam_yaw_deg !== undefined &&
      (typeof frame.cam_yaw_deg !== 'number' || !Number.isFinite(frame.cam_yaw_deg))
    ) {
      throw new FormatError(`inputs.frames[${i}].cam_yaw_deg must be a finite number`);
    }
    for (const key of ['jump', 'interact', 'pulse', 'dash', 'pause'] as const) {
      if (frame[key] !== undefined && typeof frame[key] !== 'boolean') {
        throw new FormatError(`inputs.frames[${i}].${key} must be a boolean`);
      }
    }
  }

  return frames;
}

function main(): void {
  try {
    const args = parseArgs(process.argv.slice(2));
    const scenario = args.scenarioPath ? loadAndValidateScenario(args.scenarioPath) : undefined;
    const frames = args.inputsPath ? loadAndValidateInputs(args.inputsPath) : [];

    const sim = new GameSimulation({
      seed: args.seed,
      night: args.night,
      scenario,
    });

    const lines: string[] = [];

    // Tick 0 snapshot (before applying any input)
    lines.push(JSON.stringify(sim.getSnapshot()));

    const currentInput: TickInputState = createDefaultInputState();
    let frameIdx = 0;

    for (let k = 0; k < args.ticks; k++) {
      if (sim.state === 'won' || sim.state === 'lost') break;

      while (frameIdx < frames.length && frames[frameIdx].tick === k) {
        const f = frames[frameIdx];
        if (f.move !== undefined) currentInput.move = [f.move[0], f.move[1]];
        if (f.cam_yaw_deg !== undefined) currentInput.cam_yaw_deg = f.cam_yaw_deg;
        if (f.jump !== undefined) currentInput.jump = f.jump;
        if (f.interact !== undefined) currentInput.interact = f.interact;
        if (f.pulse !== undefined) currentInput.pulse = f.pulse;
        if (f.dash !== undefined) currentInput.dash = f.dash;
        if (f.pause !== undefined) currentInput.pause = f.pause;
        frameIdx++;
      }

      const events = sim.step(currentInput);
      for (const ev of events) {
        lines.push(JSON.stringify(ev));
      }

      if (sim.tick % args.snapshotEvery === 0) {
        lines.push(JSON.stringify(sim.getSnapshot()));
      }
    }

    // Mandatory end line
    lines.push(JSON.stringify(sim.getEndLine()));

    const outDir = path.dirname(path.resolve(args.outPath));
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(args.outPath, lines.join('\n') + '\n', 'utf-8');
    process.exit(0);
  } catch (err) {
    if (err instanceof FormatError) {
      process.stderr.write(`Format error: ${err.message}\n`);
      process.exit(2);
    }
    process.stderr.write(`Error: ${(err as Error).message}\n`);
    process.exit(1);
  }
}

main();
