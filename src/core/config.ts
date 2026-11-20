import type { GameTuning, Vec3 } from './types.js';

export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
export const GRAVITY = 20;
export const JUMP_SPEED = 7.0;

// Standardized Phase 2 constants (ticks & gameplay rules)
export const DASH_TICKS = 12; // 0.2s * 60
export const DASH_COOLDOWN_TICKS = 90; // 1.5s * 60
export const PULSE_COOLDOWN_TICKS = 180; // 3.0s * 60
export const PULSE_STUN_TICKS = 120; // 2.0s * 60
export const PULSE_PUSH_TICKS = 15;
export const PULSE_ORIGIN_Y_OFFSET = 0.8;
export const INVULN_TICKS = 90; // 1.5s * 60
export const FALL_Y_THRESHOLD = -10;
export const FALL_RESPAWN_TICKS = 60; // 1.0s
export const DROPPED_MOTE_TTL_TICKS = 480; // 8.0s
export const SAFE_PUSH_MAX_TICKS = 30;
export const SHADE_RECOIL_TICKS = 60;
export const SHADE_RECOIL_DIST = 2.0;
export const SHADE_DETECT_RADIUS = 12.0;
export const SHADE_DISENGAGE_RADIUS = 18.0;
export const SHADE_SPAWN_MIN_PLAYER_DIST = 15.0;
export const SHADE_SPAWNING_TICKS = 30;
export const SHADE_NIGHT3_SPEED = 4.5;
export const PICKUP_HEIGHT_DIFF = 1.5;
export const SHADE_HIT_HEIGHT_DIFF = 1.5;
export const INITIAL_MOTE_COUNT = 20;
export const MAX_MOTE_COUNT = 30;
export const MOTE_SPAWN_INTERVAL_TICKS = 240;

export const CHARM_SPEED = 7.2;
export const CHARM_DURATION_TICKS = 600;
export const CHARM_RESPAWN_TICKS = 2700;

export const DRIFTER_IDLE_SPEED = 2.0;
export const DRIFTER_CHASE_SPEED = 7.0;
export const DRIFTER_FLEE_SPEED = 7.0;
export const DRIFTER_TRIGGER_MIN_CARRIED = 5;
export const DRIFTER_DETECT_RADIUS = 15.0;
export const DRIFTER_STEAL_RADIUS = 1.2;
export const DRIFTER_MAX_STEAL = 3;
export const DRIFTER_FLEE_TICKS = 240;
export const DRIFTER_DROP_FLEE_TICKS = 120;
export const DRIFTER_MAX_COUNT = 2;
export const DRIFTER_SPAWN_INTERVAL_TICKS = 1200;

export const WIND_CYCLE_TICKS = 1800; // every 30s
export const WIND_DURATION_TICKS = 300; // lasts 5s
export const WIND_WARNING_TICKS = 120; // warned 2s before
export const WIND_PUSH_SPEED = 2.0;

/**
 * Standardized Phase 2 tuning values.
 * Must match game.contract.json (Contract v1.1) 100%.
 */
export const DEFAULT_TUNING: GameTuning = {
  player_speed: 6.0,
  carry_capacity: 10,
  lantern_cost: 10,
  lantern_count_night1: 5,
  pickup_radius: 1.0,
  interact_radius: 2.0,
  pulse_cost: 3,
  pulse_radius: 5.0,
  night1_duration_s: 300,
  night2_duration_s: 330,
  night3_duration_s: 360,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 2.0,
  pulse_push_m: 4.0,
  pulse_cooldown_s: 3.0,
  safe_radius: 6.0,
  shade_speed: 4.0,
  shade_hit_radius: 1.0,
  fall_enabled: true,
  dash_speed: 14.0,
  dash_duration_s: 0.2,
  dash_cooldown_s: 1.5,
  score: {
    per_mote: 10,
    per_lantern: 100,
    per_stun: 5,
    per_second_left: 2,
    per_flame_left: 50,
  },
};

/**
 * Standardized Phase 2 Color Palette (exact hexes from Ticket-02).
 */
export const PALETTE = {
  sky: 0x0e1430,
  fog: 0x1b2350,
  grass: 0x2f5d50,
  sand: 0xc9b48a,
  wood: 0x6b4a2f,
  cloudSea: 0x12384a,
  lanternLit: 0xffb347,
  lanternCore: 0xffe9b0,
  lanternUnlit: 0x5b5f6e,
  moteCore: 0xfff6c2,
  moteHalo: 0xffe58a,
  shadeBody: 0x120a1a,
  shadeRim: 0x7a3cff,
  shadeStunned: 0x3a3450,
  mayCloak: 0xe8e2d0,
  mayScarfAndCharm: 0xc8102e,
  goldTrim: 0xf2c14e,
  drifter: 0x8fa3b8,
  uiDanger: 0xff5a5f,
  uiText: 0xf5f1e6,
} as const;

export function round3(v: number): number {
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
}

export function roundVec3(v: Vec3): Vec3 {
  return [round3(v[0]), round3(v[1]), round3(v[2])];
}
