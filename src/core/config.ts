import type { GameTuning, Vec3 } from './types.js';

export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
export const ISLAND_RADIUS = 32;
export const GRAVITY = 20;
export const JUMP_SPEED = 8;

/**
 * Default tuning values. Must match game.contract.json exactly
 * (enforced by tests/contract.test.ts).
 */
export const DEFAULT_TUNING: GameTuning = {
  player_speed: 6.0,
  carry_capacity: 5,
  lantern_cost: 3,
  lantern_count_night1: 5,
  pickup_radius: 1.5,
  interact_radius: 2.5,
  pulse_cost: 1,
  pulse_radius: 6.0,
  night1_duration_s: 180,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 3.0,
  pulse_push_m: 4.0,
  pulse_cooldown_s: 2.0,
  safe_radius: 5.0,
  shade_speed: 3.5,
  shade_hit_radius: 1.2,
  fall_enabled: false,
  score: {
    per_mote: 10,
    per_lantern: 100,
    per_stun: 25,
    per_second_left: 2,
    per_flame_left: 50,
  },
};

/**
 * Default 5 Great Lantern positions on Night 1 (Đảo Bến),
 * arranged evenly in a ring at radius 20m around origin (0, 0, 0).
 */
export function getNight1LanternPositions(): Array<{ id: string; pos: Vec3 }> {
  const radius = 20;
  const count = DEFAULT_TUNING.lantern_count_night1;
  const result: Array<{ id: string; pos: Vec3 }> = [];
  for (let i = 0; i < count; i++) {
    const angle = (i * 2 * Math.PI) / count;
    const x = round3(Math.sin(angle) * radius);
    const z = round3(Math.cos(angle) * radius);
    result.push({ id: `L${i + 1}`, pos: [x, 0, z] });
  }
  return result;
}

export function round3(v: number): number {
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
}

export function roundVec3(v: Vec3): Vec3 {
  return [round3(v[0]), round3(v[1]), round3(v[2])];
}
