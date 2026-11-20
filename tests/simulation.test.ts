import { describe, expect, it } from 'vitest';
import { DEFAULT_TUNING } from '../src/core/config.js';
import { GameSimulation, createDefaultInputState } from '../src/core/simulation.js';

describe('GameSimulation core mechanics (Phase 1)', () => {
  it('moves player according to cam_yaw_deg formula and normalizes diagonal move', () => {
    const sim = new GameSimulation({
      seed: 1,
      night: 1,
      scenario: { random_motes: false, random_shades: false, motes: [], shades: [] },
    });

    // Move [0, 1] at yaw 0 => +Z at player_speed (6 m/s) for 60 ticks = 6.0m
    const inp = createDefaultInputState();
    inp.move = [0, 1];
    inp.cam_yaw_deg = 0;
    for (let i = 0; i < 60; i++) sim.step(inp);
    expect(sim.player.pos[0]).toBeCloseTo(0, 3);
    expect(sim.player.pos[2]).toBeCloseTo(DEFAULT_TUNING.player_speed, 3);

    // Move [1, 1] normalized => distance moved in 60 ticks equals player_speed
    const startX = sim.player.pos[0];
    const startZ = sim.player.pos[2];
    inp.move = [1, 1];
    inp.cam_yaw_deg = 90; // cos=0, sin=1 => x'=z, z'=-x
    for (let i = 0; i < 60; i++) sim.step(inp);
    const dist = Math.hypot(sim.player.pos[0] - startX, sim.player.pos[2] - startZ);
    expect(dist).toBeCloseTo(DEFAULT_TUNING.player_speed, 2);
  });

  it('picks up motes, deposits into lantern, lights lantern, and wins when all lit', () => {
    const sim = new GameSimulation({
      seed: 7,
      night: 1,
      scenario: {
        player: { pos: [0, 0, 0], carried: 0, flames: 3 },
        random_motes: false,
        random_shades: false,
        motes: [
          [0, 0, 1],
          [0, 0, 1.2],
          [0, 0, 1.4],
        ],
        shades: [],
        lanterns: [
          { id: 'L1', pos: [0, 0, 2], deposited: 0, lit: false },
          { id: 'L2', lit: true },
          { id: 'L3', lit: true },
          { id: 'L4', lit: true },
          { id: 'L5', lit: true },
        ],
        time_left_s: 100,
      },
    });

    // Scenario setup emits no score
    expect(sim.score).toBe(0);

    // Tick 1: standing at (0,0,0) picks up all 3 motes within pickup_radius=1.5
    const ev1 = sim.step(createDefaultInputState());
    const picked = ev1.filter((e) => e.name === 'mote_picked');
    expect(picked.length).toBe(3);
    expect(sim.player.carried).toBe(3);
    expect(sim.score).toBe(3 * DEFAULT_TUNING.score.per_mote);

    // Tick 2: interact rising edge deposits 3 motes into L1 (distance 2 <= 2.5), lighting it & winning
    const interactInput = createDefaultInputState();
    interactInput.interact = true;
    const ev2 = sim.step(interactInput);
    expect(ev2.some((e) => e.name === 'deposit')).toBe(true);
    expect(ev2.some((e) => e.name === 'lantern_lit')).toBe(true);
    expect(ev2.some((e) => e.name === 'game_over' && e.data.result === 'won')).toBe(true);
    expect(sim.state).toBe('won');
  });

  it('pulse stuns and pushes shades within pulse_radius and enforces cooldown', () => {
    const sim = new GameSimulation({
      seed: 3,
      night: 1,
      scenario: {
        player: { pos: [0, 0, 0], carried: 3, flames: 3 },
        random_motes: false,
        random_shades: false,
        motes: [],
        shades: [{ id: 'S1', pos: [0, 0, 4] }],
      },
    });

    const pulseIn = createDefaultInputState();
    pulseIn.pulse = true;
    const ev = sim.step(pulseIn);
    const pulseEv = ev.find((e) => e.name === 'pulse');
    expect(pulseEv).toBeDefined();
    expect(pulseEv?.data.stunned_ids).toEqual(['S1']);
    expect(sim.player.carried).toBe(3 - DEFAULT_TUNING.pulse_cost);
    expect(sim.shades[0].state).toBe('stunned');
    expect(sim.shades[0].pos[2]).toBeGreaterThanOrEqual(4 + DEFAULT_TUNING.pulse_push_m - 0.1);
  });

  it('shades respect safe_radius around lit lanterns and damage player on contact', () => {
    const sim = new GameSimulation({
      seed: 9,
      night: 1,
      scenario: {
        player: { pos: [0, 0, 0], carried: 2, flames: 1 },
        random_motes: false,
        random_shades: false,
        motes: [],
        shades: [{ id: 'S1', pos: [0, 0, 1.0] }],
      },
    });

    // Tick 1: shade is within shade_hit_radius=1.2 => player_hit => flames 0 => game_over lost
    const ev = sim.step(createDefaultInputState());
    const hit = ev.find((e) => e.name === 'player_hit');
    expect(hit).toBeDefined();
    expect(hit?.data.flames).toBe(0);
    expect(hit?.data.dropped).toBe(1);
    expect(sim.state).toBe('lost');
    expect(ev.some((e) => e.name === 'game_over' && e.data.reason === 'no_flames')).toBe(true);
  });

  it('keeps shades outside lit lantern safe_radius', () => {
    const sim = new GameSimulation({
      seed: 11,
      night: 1,
      scenario: {
        player: { pos: [0, 0, 20], carried: 0, flames: 3 },
        random_motes: false,
        random_shades: false,
        motes: [],
        lanterns: [{ id: 'L1', pos: [0, 0, 20], lit: true }],
        shades: [{ id: 'S1', pos: [0, 0, 26] }],
      },
    });

    for (let i = 0; i < 120; i++) {
      sim.step(createDefaultInputState());
    }
    const dist = Math.hypot(sim.shades[0].pos[0] - 0, sim.shades[0].pos[2] - 20);
    expect(dist).toBeGreaterThan(DEFAULT_TUNING.safe_radius);
    expect(sim.player.flames).toBe(3);
  });

  it('triggers dawn loss when time_left_s reaches 0', () => {
    const sim = new GameSimulation({
      seed: 12,
      night: 1,
      scenario: {
        random_motes: false,
        random_shades: false,
        motes: [],
        shades: [],
        time_left_s: 0.5,
      },
    });

    let lastEvents = [];
    for (let i = 0; i < 60 && sim.state === 'playing'; i++) {
      lastEvents = sim.step(createDefaultInputState());
    }
    expect(sim.state).toBe('lost');
    expect(sim.simTick).toBe(30);
    expect(lastEvents.some((e) => e.name === 'game_over' && e.data.reason === 'dawn')).toBe(true);
  });
});
