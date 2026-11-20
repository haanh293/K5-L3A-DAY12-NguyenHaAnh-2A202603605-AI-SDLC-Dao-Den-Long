import * as fs from 'node:fs';
import * as path from 'node:path';
import { Mulberry32 } from '../dist-headless/core/rng.js';
import { GameSimulation, createDefaultInputState } from '../dist-headless/core/simulation.js';

function parseArgs(argv) {
  let seed = 7;
  let nights = 10;
  let outPath = 'soak.json';

  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const next = argv[i + 1];
    if (flag === '--seed' && next !== undefined) {
      seed = parseInt(next, 10);
      i++;
    } else if (flag === '--nights' && next !== undefined) {
      nights = parseInt(next, 10);
      i++;
    } else if (flag === '--out' && next !== undefined) {
      outPath = next;
      i++;
    }
  }
  return { seed, nights, outPath };
}

function round1(v) {
  return Math.round(v * 10) / 10;
}

function getRssMb() {
  return process.memoryUsage().rss / (1024 * 1024);
}

function main() {
  const { seed, nights, outPath } = parseArgs(process.argv.slice(2));
  const tStart = performance.now();

  // Warm up all JIT paths (spawns, drifters, wind, drain, fall) so V8 code-space is settled before Night 0
  for (const wn of [1, 2, 3]) {
    const warmSim = new GameSimulation({ seed: 100 + wn, night: wn });
    const inp = createDefaultInputState();
    const warmTicks = wn === 3 ? 1900 : 400;
    for (let t = 0; t < warmTicks && warmSim.state === 'playing'; t++) {
      inp.move[0] = Math.cos(t * 0.1);
      inp.move[1] = Math.sin(t * 0.1);
      inp.jump = t % 20 === 0;
      inp.dash = t % 45 === 0;
      inp.pulse = t % 90 === 0;
      inp.interact = t % 15 === 0;
      warmSim.step(inp);
    }
  }
  if (typeof globalThis.gc === 'function') {
    globalThis.gc();
  }

  let crashes = 0;
  const results = [];
  let memStartMb = 0;

  for (let i = 0; i < nights; i++) {
    const nightNum = (i % 3) + 1;
    const nightSeed = seed + i;

    try {
      let sim = new GameSimulation({ seed: nightSeed, night: nightNum });
      if (i === 0) {
        memStartMb = getRssMb();
      }

      const inputRng = new Mulberry32((nightSeed * 2654435761) >>> 0);
      const maxTicks = sim.initialDurationS * 60;
      const input = createDefaultInputState();
      let moveX = 0;
      let moveZ = 0;

      for (let tick = 0; tick < maxTicks && sim.state === 'playing'; tick++) {
        if (tick % 30 === 0) {
          const angle = inputRng.range(0, Math.PI * 2);
          moveX = Math.cos(angle);
          moveZ = Math.sin(angle);
        }
        input.move[0] = moveX;
        input.move[1] = moveZ;
        input.cam_yaw_deg = 0;
        input.jump = inputRng.next() < 0.05;
        input.dash = inputRng.next() < 0.03;
        input.pulse = inputRng.next() < 0.02;
        input.interact = inputRng.next() < 0.1;
        input.pause = false;

        sim.step(input);
      }

      results.push(sim.state === 'won' ? 'won' : 'lost');
      // Release night state cleanly
      sim = null;
    } catch (err) {
      crashes += 1;
      results.push('crash');
      process.stderr.write(`Soak crash on night index ${i}: ${err instanceof Error ? err.message : String(err)}\n`);
    }
  }

  if (typeof globalThis.gc === 'function') {
    globalThis.gc();
  }
  const memEndMb = getRssMb();
  const durationS = (performance.now() - tStart) / 1000;

  const report = {
    nights,
    crashes,
    results,
    mem_start_mb: round1(memStartMb),
    mem_end_mb: round1(memEndMb),
    duration_s: round1(durationS),
  };

  const resolvedOut = path.resolve(outPath);
  fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });
  fs.writeFileSync(resolvedOut, JSON.stringify(report, null, 2) + '\n', 'utf-8');

  const memRatio = memStartMb > 0 ? memEndMb / memStartMb : 1;
  console.log(
    `Soak test complete: nights=${nights}, crashes=${crashes}, ` +
      `mem=${report.mem_start_mb}MB -> ${report.mem_end_mb}MB (${memRatio.toFixed(2)}x, limit <= 1.20x), ` +
      `duration=${report.duration_s}s`
  );

  if (crashes > 0 || memEndMb > 1.2 * memStartMb) {
    process.stderr.write('Soak test threshold failed!\n');
    process.exit(1);
  }
  process.exit(0);
}

main();
