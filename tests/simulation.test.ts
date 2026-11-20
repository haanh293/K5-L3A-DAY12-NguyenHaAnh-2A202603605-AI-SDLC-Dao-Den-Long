import { describe, expect, it } from 'vitest';
import { DEFAULT_TUNING, PULSE_PUSH_TICKS } from '../src/core/config.js';
import { GameSimulation, createDefaultInputState } from '../src/core/simulation.js';

/**
 * Phase 1 regression tests updated for Ticket-03 (Contract v1.2):
 * - Ticket-03 [THAY THẾ] replaced early `all_lit` win with `dawn_survived` at time_left_s === 0
 *   (requiring >= ceil(0.6 * total) lit lanterns) and changed deposit score to +5/mote,
 *   removed time bonus, and added dawn bonus (50 + floor(fuel)) per lit lantern + 50 per flame.
 * - All unaffected Phase 1 rules (movement, pickup, deposit, pulse, safe zone >= 30 fuel, dawn loss)
 *   continue to pass unchanged.
 */
describe('Phase 1 core mechanics regression (updated for Ticket-03 Contract v1.2)', () => {
  it('moves player according to cam_yaw_deg formula and normalizes diagonal move', () => {
    const sim = new GameSimulation({
      seed: 1,
      night: 1,
      scenario: { random_motes: false, random_shades: false, motes: [], shades: [] },
    });

    const inp = createDefaultInputState();
    inp.move = [0, 1];
    inp.cam_yaw_deg = 0;
    for (let i = 0; i < 60; i++) sim.step(inp);
    expect(sim.player.pos[0]).toBeCloseTo(0, 3);
    expect(sim.player.pos[2]).toBeCloseTo(DEFAULT_TUNING.player_speed, 3);

    const startX = sim.player.pos[0];
    const startZ = sim.player.pos[2];
    inp.move = [1, 1];
    inp.cam_yaw_deg = 90;
    for (let i = 0; i < 60; i++) sim.step(inp);
    const dist = Math.hypot(sim.player.pos[0] - startX, sim.player.pos[2] - startZ);
    expect(dist).toBeCloseTo(DEFAULT_TUNING.player_speed, 2);
  });

  it('picks up motes, lights lantern (+5/mote, +100 first light, relight:false) and does NOT end early when all lit', () => {
    const sim = new GameSimulation({
      seed: 7,
      night: 1,
      scenario: {
        player: { pos: [0, 0, 0], carried: 7, flames: 3 },
        random_motes: false,
        random_shades: false,
        motes: [
          [0, 0, 0.5],
          [0, 0, 0.7],
          [0, 0, 0.9],
        ],
        shades: [],
        lanterns: [
          { id: 'L1', pos: [0, 0, 1.8], deposited: 0, lit: false },
          { id: 'L2', lit: true, fuel: 100 },
          { id: 'L3', lit: true, fuel: 100 },
          { id: 'L4', lit: true, fuel: 100 },
          { id: 'L5', lit: true, fuel: 100 },
        ],
        time_left_s: 10,
      },
    });

    expect(sim.score).toBe(0);

    const ev1 = sim.step(createDefaultInputState());
    expect(ev1.filter((e) => e.name === 'mote_picked').length).toBe(3);
    expect(sim.player.carried).toBe(10);

    const interactInput = createDefaultInputState();
    interactInput.interact = true;
    const ev2 = sim.step(interactInput);
    expect(ev2.some((e) => e.name === 'deposit')).toBe(true);
    const litEv = ev2.find((e) => e.name === 'lantern_lit');
    expect(litEv?.data).toEqual({ lantern_id: 'L1', relight: false });
    // Ticket-03: lighting all 5 does NOT trigger early win
    expect(sim.state).toBe('playing');
    expect(sim.score).toBe(10 * 5 + 100);
    expect(sim.getPlayerCapacity()).toBe(12);
  });

  it('pulse costs 3 motes, stuns for 120 ticks, pushes 4m over 15 ticks, and awards +5/shade', () => {
    const sim = new GameSimulation({
      seed: 3,
      night: 1,
      scenario: {
        player: { pos: [0, 0, 0], carried: 5, flames: 3 },
        random_motes: false,
        random_shades: false,
        motes: [],
        shades: [{ id: 'S1', pos: [0, 0.8, 4] }],
      },
    });

    const pulseIn = createDefaultInputState();
    pulseIn.pulse = true;
    const ev = sim.step(pulseIn);
    const pulseEv = ev.find((e) => e.name === 'pulse');
    expect(pulseEv).toBeDefined();
    expect(pulseEv?.data.stunned_ids).toEqual(['S1']);
    expect(sim.player.carried).toBe(5 - DEFAULT_TUNING.pulse_cost);
    expect(sim.score).toBe(DEFAULT_TUNING.score.per_stun);
    expect(sim.shades[0].state).toBe('stunned');

    const idle = createDefaultInputState();
    for (let i = 1; i < PULSE_PUSH_TICKS; i++) sim.step(idle);
    expect(sim.shades[0].pos[2]).toBeCloseTo(4 + DEFAULT_TUNING.pulse_push_m, 2);
  });

  it('shades damage player on contact (<= 1.0m), drop floor(carried/2), and recoil', () => {
    const sim = new GameSimulation({
      seed: 9,
      night: 1,
      scenario: {
        player: { pos: [0, 0, 0], carried: 5, flames: 2 },
        random_motes: false,
        random_shades: false,
        motes: [],
        shades: [{ id: 'S1', pos: [0, 0.8, 0.9], state: 'chase' }],
      },
    });

    const ev = sim.step(createDefaultInputState());
    const hit = ev.find((e) => e.name === 'player_hit');
    expect(hit).toBeDefined();
    expect(hit?.data.flames).toBe(1);
    expect(hit?.data.dropped).toBe(2);
    expect(sim.player.carried).toBe(3);
    expect(sim.shades[0].state).toBe('recoil');
    expect(sim.motes.filter((m) => m.kind === 'dropped').length).toBe(2);
  });

  it('keeps shades outside lit lantern safe_radius (6m) when fuel >= 30', () => {
    const sim = new GameSimulation({
      seed: 11,
      night: 1,
      scenario: {
        player: { pos: [0, 0, 25], carried: 0, flames: 3 },
        random_motes: false,
        random_shades: false,
        motes: [],
        lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 80 }],
        shades: [{ id: 'S1', pos: [0, 0.8, 32], state: 'chase' }],
      },
    });

    for (let i = 0; i < 120; i++) sim.step(createDefaultInputState());
    const dist = Math.hypot(sim.shades[0].pos[0], sim.shades[0].pos[2] - 25);
    expect(dist).toBeGreaterThanOrEqual(DEFAULT_TUNING.safe_radius);
    expect(sim.player.flames).toBe(3);
  });

  it('triggers dawn loss when time_left_s reaches 0 with < 60% lanterns lit', () => {
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
