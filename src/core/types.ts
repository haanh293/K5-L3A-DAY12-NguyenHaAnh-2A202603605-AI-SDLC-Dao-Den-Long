export type Vec3 = [number, number, number];

export interface ScoreTuning {
  per_mote: number;
  per_lantern: number;
  per_stun: number;
  per_second_left: number;
  per_flame_left: number;
}

export interface GameTuning {
  player_speed: number;
  carry_capacity: number;
  lantern_cost: number;
  lantern_count_night1: number;
  pickup_radius: number;
  interact_radius: number;
  pulse_cost: number;
  pulse_radius: number;
  night1_duration_s: number;
  flames: number;
  invuln_s: number;
  hit_drop_ratio: number;
  pulse_stun_s: number;
  pulse_push_m: number;
  pulse_cooldown_s: number;
  safe_radius: number;
  shade_speed: number;
  shade_hit_radius: number;
  fall_enabled: boolean;
  score: ScoreTuning;
}

export interface InputFrame {
  tick: number;
  move?: [number, number];
  cam_yaw_deg?: number;
  jump?: boolean;
  interact?: boolean;
  pulse?: boolean;
  dash?: boolean;
}

export interface InputsFile {
  frames: InputFrame[];
}

export interface TickInputState {
  move: [number, number];
  cam_yaw_deg: number;
  jump: boolean;
  interact: boolean;
  pulse: boolean;
  dash: boolean;
}

export interface ScenarioLantern {
  id: string;
  pos?: Vec3;
  deposited?: number;
  lit?: boolean;
}

export interface ScenarioShade {
  id?: string;
  pos: Vec3;
  state?: ShadeState;
}

export type ScenarioMote = Vec3 | { id?: string; pos: Vec3 };

export interface ScenarioConfig {
  player?: {
    pos?: Vec3;
    carried?: number;
    flames?: number;
  };
  random_motes?: boolean;
  random_shades?: boolean;
  motes?: ScenarioMote[];
  shades?: ScenarioShade[];
  lanterns?: ScenarioLantern[];
  time_left_s?: number;
}

export type GameState = 'playing' | 'won' | 'lost';
export type ShadeState = 'chase' | 'stunned';

export interface PlayerEntity {
  pos: Vec3;
  vy: number;
  grounded: boolean;
  flames: number;
  carried: number;
  invulnTimer: number;
  pulseCooldown: number;
  facingYaw: number;
}

export interface LanternEntity {
  id: string;
  pos: Vec3;
  lit: boolean;
  deposited: number;
}

export interface ShadeEntity {
  id: string;
  pos: Vec3;
  state: ShadeState;
  stunTimer: number;
}

export interface MoteEntity {
  id: string;
  pos: Vec3;
}

export interface SnapshotLine {
  type: 'snapshot';
  tick: number;
  sim_tick: number;
  state: GameState;
  time_left_s: number;
  score: number;
  player: {
    pos: Vec3;
    flames: number;
    carried: number;
  };
  lanterns: Array<{
    id: string;
    pos: Vec3;
    lit: boolean;
    deposited: number;
  }>;
  shades: Array<{
    id: string;
    pos: Vec3;
    state: ShadeState;
  }>;
  motes_active: number;
  motes: Array<{
    id: string;
    pos: Vec3;
  }>;
}

export interface EventLine {
  type: 'event';
  tick: number;
  name:
    | 'mote_picked'
    | 'deposit'
    | 'lantern_lit'
    | 'pulse'
    | 'player_hit'
    | 'shade_spawned'
    | 'game_over';
  data: Record<string, unknown>;
}

export interface EndLine {
  type: 'end';
  ticks: number;
  state: GameState;
  score: number;
}

export type JsonlRecord = SnapshotLine | EventLine | EndLine;
