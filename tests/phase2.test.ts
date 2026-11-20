import { describe, expect, it } from 'vitest';
import { getTerrainHeight } from '../src/core/maps.js';
import { GameSimulation, createDefaultInputState } from '../src/core/simulation.js';

describe('Phase 2 features (Ticket-02)', () => {
  it('Dash moves 14 m/s for 12 ticks (2.8m), holds altitude in air, and enforces 1.5s cooldown', () => {
    const sim = new GameSimulation({
      seed: 10,
      night: 1,
      scenario: { random_motes: false, random_shades: false, motes: [], shades: [] },
    });

    // Jump then dash at peak-ish height
    const jumpIn = createDefaultInputState();
    jumpIn.jump = true;
    sim.step(jumpIn);
    for (let i = 0; i < 10; i++) sim.step(createDefaultInputState());
    const airY = sim.player.pos[1];
    expect(airY).toBeGreaterThan(0.5);

    const dashIn = createDefaultInputState();
    dashIn.move = [0, 1];
    dashIn.dash = true;
    const ev = sim.step(dashIn);
    expect(ev.some((e) => e.name === 'dash')).toBe(true);

    const hold = createDefaultInputState();
    hold.move = [0, 1];
    for (let i = 1; i < 12; i++) {
      sim.step(hold);
      expect(sim.player.pos[1]).toBeCloseTo(airY, 4); // Holds altitude during airborne dash
    }
    expect(sim.player.pos[2]).toBeCloseTo(2.8, 2);

    // Dash again immediately should fail (cooldown active)
    const retryDash = createDefaultInputState();
    retryDash.dash = true;
    const evRetry = sim.step(retryDash);
    expect(evRetry.some((e) => e.name === 'dash')).toBe(false);
  });

  it('Fall off island (Y < -10) costs 1 flame, loses all motes, and respawns after 60 ticks with invuln', () => {
    const sim = new GameSimulation({
      seed: 20,
      night: 1,
      scenario: {
        player: { pos: [41, 0, 0], carried: 6, flames: 3 },
        random_motes: false,
        random_shades: false,
        motes: [],
        shades: [],
      },
    });

    let fallEvent = null;
    for (let i = 0; i < 120; i++) {
      const evs = sim.step(createDefaultInputState());
      const f = evs.find((e) => e.name === 'player_hit' && e.data.by === 'fall');
      if (f) {
        fallEvent = f;
        break;
      }
    }
    expect(fallEvent).not.toBeNull();
    expect(fallEvent?.data.flames).toBe(2);
    expect(fallEvent?.data.lost).toBe(6);
    expect(sim.player.carried).toBe(0);

    // Wait 60 ticks to respawn at origin with invuln
    for (let i = 0; i < 60; i++) sim.step(createDefaultInputState());
    expect(sim.player.pos).toEqual([0, 0, 0]);
    expect(sim.player.invulnTicks).toBeGreaterThan(0);
  });

  it('Pause freezes sim_tick, time_left_s, and timers while tick advances', () => {
    const sim = new GameSimulation({
      seed: 30,
      night: 1,
      scenario: { random_motes: false, random_shades: false, motes: [], shades: [] },
    });

    sim.step(createDefaultInputState());
    expect(sim.tick).toBe(1);
    expect(sim.simTick).toBe(1);

    const pauseOn = createDefaultInputState();
    pauseOn.pause = true;
    const evP = sim.step(pauseOn);
    expect(evP.some((e) => e.name === 'paused')).toBe(true);
    expect(sim.state).toBe('paused');
    const frozenTime = sim.timeLeftS;

    // 10 paused ticks
    for (let i = 0; i < 10; i++) sim.step(createDefaultInputState());
    expect(sim.tick).toBe(12);
    expect(sim.simTick).toBe(1);
    expect(sim.timeLeftS).toBe(frozenTime);

    // Resume
    const evR = sim.step(pauseOn);
    expect(evR.some((e) => e.name === 'resumed')).toBe(true);
    expect(sim.state).toBe('playing');
    expect(sim.simTick).toBe(2);
  });

  it('Night 2 Jump Pad launches player from Island A (20,0,18) onto Island B', () => {
    const sim = new GameSimulation({
      seed: 40,
      night: 2,
      scenario: {
        player: { pos: [20, 0, 18], carried: 0, flames: 3 },
        random_motes: false,
        random_shades: false,
        random_drifters: false,
        motes: [],
        shades: [],
      },
    });

    // Trigger pad & let physics run for 100 ticks (~1.67s)
    for (let i = 0; i < 100; i++) sim.step(createDefaultInputState());
    expect(sim.player.grounded).toBe(true);
    expect(sim.player.pos[1]).toBeCloseTo(0, 3);
    // Should land inside Island B (center 70,0,0 radius 28)
    const distToB = Math.hypot(sim.player.pos[0] - 70, sim.player.pos[2]);
    expect(distToB).toBeLessThan(28);
  });

  it('Wind Charm increases speed to 7.2 m/s and removes dash cooldown for 600 ticks', () => {
    const sim = new GameSimulation({
      seed: 50,
      night: 2,
      scenario: {
        player: { pos: [35, 0, 0], carried: 0, flames: 3 },
        random_motes: false,
        random_shades: false,
        random_drifters: false,
        motes: [],
        shades: [],
      },
    });

    const ev = sim.step(createDefaultInputState());
    expect(ev.some((e) => e.name === 'charm_picked' && e.data.charm_id === 'C1')).toBe(true);
    expect(sim.player.charmTicks).toBe(600);

    // Dash twice back-to-back with 0 cooldown
    const dashIn = createDefaultInputState();
    dashIn.dash = true;
    expect(sim.step(dashIn).some((e) => e.name === 'dash')).toBe(true);
    for (let i = 0; i < 12; i++) sim.step(createDefaultInputState());
    expect(sim.player.dashCdTicks).toBe(0);
    expect(sim.step(dashIn).some((e) => e.name === 'dash')).toBe(true);
  });

  it('Drifter (Gió Lạc) steals up to 3 motes when carried >= 5 and drops them when hit by Pulse while fleeing', () => {
    const sim = new GameSimulation({
      seed: 60,
      night: 2,
      scenario: {
        player: { pos: [0, 0, 0], carried: 7, flames: 3 },
        random_motes: false,
        random_shades: false,
        random_drifters: false,
        motes: [],
        shades: [],
        drifters: [{ id: 'D1', pos: [0, 1.0, 1.0], state: 'idle' }],
      },
    });

    // Tick 1: D1 detects player (carried >= 5, dist <= 15), switches to chase, steals 3 motes -> flee
    const ev1 = sim.step(createDefaultInputState());
    const steal = ev1.find((e) => e.name === 'drifter_steal');
    expect(steal).toBeDefined();
    expect(steal?.data.amount).toBe(3);
    expect(sim.player.carried).toBe(4);
    expect(sim.drifters[0].state).toBe('flee');
    expect(sim.drifters[0].stolen).toBe(3);

    // Tick 2: Pulse hits fleeing D1 -> drops 3 motes
    const pulseIn = createDefaultInputState();
    pulseIn.pulse = true;
    const ev2 = sim.step(pulseIn);
    const drop = ev2.find((e) => e.name === 'drifter_drop');
    expect(drop).toBeDefined();
    expect(drop?.data.amount).toBe(3);
    expect(sim.motes.filter((m) => m.kind === 'dropped').length).toBe(3);
  });

  it('Night 3 ramps connect Tier 0 to Tier 1, jump pad reaches Tier 2, and wind activates at tick 1800', () => {
    // Verify ramp height along 30 deg from r=30 (Y=0) to r=24 (Y=3)
    const rad30 = (30 * Math.PI) / 180;
    expect(getTerrainHeight(3, Math.cos(rad30) * 30, Math.sin(rad30) * 30)).toBeCloseTo(0, 2);
    expect(getTerrainHeight(3, Math.cos(rad30) * 27, Math.sin(rad30) * 27)).toBeCloseTo(1.5, 2);
    expect(getTerrainHeight(3, Math.cos(rad30) * 24, Math.sin(rad30) * 24)).toBeCloseTo(3, 2);

    // Verify Night 3 jump pad (0,3,13) lands on Tier 2 (Y=6)
    const simPad = new GameSimulation({
      seed: 70,
      night: 3,
      scenario: {
        player: { pos: [0, 3, 13], carried: 0, flames: 3 },
        random_motes: false,
        random_shades: false,
        random_drifters: false,
        wind_enabled: false,
        motes: [],
        shades: [],
      },
    });
    for (let i = 0; i < 80; i++) simPad.step(createDefaultInputState());
    expect(simPad.player.grounded).toBe(true);
    expect(simPad.player.pos[1]).toBeCloseTo(6, 2);

    // Verify Night 3 wind activates at simTick 1800
    const simWind = new GameSimulation({
      seed: 71,
      night: 3,
      scenario: {
        player: { pos: [0, 0, -20] },
        random_motes: false,
        random_shades: false,
        random_drifters: false,
        wind_enabled: true,
        motes: [],
        shades: [],
      },
    });
    for (let i = 0; i < 1805; i++) simWind.step(createDefaultInputState());
    expect(simWind.wind.active).toBe(true);
    expect(Math.hypot(simWind.player.pos[0], simWind.player.pos[2] - -20)).toBeGreaterThan(0.1);
  });
});
