export type Vec3 = [number, number, number];
export type NightNumber = 1 | 2 | 3;

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
  capacity_max: number;
  lantern_cost: number;
  relight_cost: number;
  lantern_count_night1: number;
  pickup_radius: number;
  interact_radius: number;
  pulse_cost: number;
  pulse_radius: number;
  night1_duration_s: number;
  night2_duration_s: number;
  night3_duration_s: number;
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
  dash_speed: number;
  dash_duration_s: number;
  dash_cooldown_s: number;
  fuel_max: number;
  fuel_decay_per_s: number;
  fuel_per_mote: number;
  win_ratio: number;
  drain_per_s: number;
  low_fuel_threshold: number;
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
  pause?: boolean;
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
  pause: boolean;
}

export type GameState = 'playing' | 'paused' | 'won' | 'lost';
export type ShadeState = 'spawning' | 'wander' | 'chase' | 'recoil' | 'stunned' | 'drain';
export type DrifterState = 'idle' | 'chase' | 'flee';
export type MoteKind = 'random' | 'dropped';
export type GameOverReason = 'dawn_survived' | 'dawn' | 'no_flames';

export interface ScenarioLantern {
  id: string;
  pos?: Vec3;
  deposited?: number;
  lit?: boolean;
  fuel?: number;
  ever_lit?: boolean;
}

export interface ScenarioShade {
  id?: string;
  pos: Vec3;
  state?: ShadeState;
  state_ticks_left?: number;
  target_lantern_id?: string;
}

export interface ScenarioDrifter {
  id?: string;
  pos: Vec3;
  state?: DrifterState;
  stolen?: number;
  flee_ticks_left?: number;
}

export interface ScenarioCharm {
  id?: string;
  pos?: Vec3;
  available?: boolean;
  respawn_ticks?: number;
}

export type ScenarioMote =
  | Vec3
  | { id?: string; pos: Vec3; kind?: MoteKind; ttl_ticks?: number | null };

export interface ScenarioConfig {
  player?: {
    pos?: Vec3;
    carried?: number;
    flames?: number;
    invuln_ticks?: number;
    dash_cd_ticks?: number;
    pulse_cd_ticks?: number;
    charm_ticks?: number;
    successful_lights?: number;
  };
  random_motes?: boolean;
  random_shades?: boolean;
  random_drifters?: boolean;
  wind_enabled?: boolean;
  motes?: ScenarioMote[];
  shades?: ScenarioShade[];
  drifters?: ScenarioDrifter[];
  charms?: ScenarioCharm[];
  lanterns?: ScenarioLantern[];
  time_left_s?: number;
}

export interface PlayerEntity {
  pos: Vec3;
  vel: Vec3;
  grounded: boolean;
  flames: number;
  carried: number;
  successfulLights: number;
  invulnTicks: number;
  dashTicksLeft: number;
  dashDir: [number, number];
  dashCdTicks: number;
  pulseCdTicks: number;
  charmTicks: number;
  respawnTicks: number;
  launchVel: [number, number] | null;
  facingYaw: number;
}

export interface LanternEntity {
  id: string;
  pos: Vec3;
  lit: boolean;
  deposited: number;
  fuelSixtieths: number; // Integer 0..6000 (1/60 fuel units)
  everLit: boolean;
  relitCount: number;
}

export interface ShadeEntity {
  id: string;
  pos: Vec3;
  hoverOffset: number;
  state: ShadeState;
  stateTicksLeft: number;
  targetLanternId: string | null;
  drainTicks: number;
  pulsePushTicksLeft: number;
  pulsePushDir: [number, number];
  recoilDir: [number, number];
  safePushTicksLeft: number;
  safePushLanternId: string | null;
  wanderAngle: number;
  wanderTicksLeft: number;
  spawnTick: number;
}

export interface MoteEntity {
  id: string;
  pos: Vec3;
  kind: MoteKind;
  ttlTicks: number | null;
  spawnTick: number;
}

export interface DrifterEntity {
  id: string;
  pos: Vec3;
  state: DrifterState;
  stolen: number;
  hasStolen: boolean;
  fleeTicksLeft: number;
  orbitAngle: number;
  spawnTick: number;
}

export interface CharmEntity {
  id: string;
  pos: Vec3;
  available: boolean;
  respawnTicks: number;
}

export interface WindState {
  enabled: boolean;
  active: boolean;
  warning: boolean;
  dirDeg: number;
}

export interface SnapshotLine {
  type: 'snapshot';
  tick: number;
  sim_tick: number;
  night: NightNumber;
  state: GameState;
  time_left_s: number;
  score: number;
  wind: {
    active: boolean;
    dir_deg: number;
  };
  player: {
    pos: Vec3;
    vel: Vec3;
    grounded: boolean;
    flames: number;
    carried: number;
    capacity: number;
    invuln: boolean;
    dash_cd_s: number;
    pulse_cd_s: number;
    charm_s: number;
  };
  lanterns: Array<{
    id: string;
    pos: Vec3;
    lit: boolean;
    deposited: number;
    fuel: number;
    ever_lit: boolean;
    relit_count: number;
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
    kind: MoteKind;
    ttl_s: number | null;
  }>;
  drifters: Array<{
    id: string;
    pos: Vec3;
    state: DrifterState;
    stolen: number;
  }>;
  charms: Array<{
    id: string;
    available: boolean;
    respawn_s: number;
  }>;
}

export interface EventLine {
  type: 'event';
  tick: number;
  name:
    | 'mote_picked'
    | 'deposit'
    | 'lantern_lit'
    | 'refuel'
    | 'lantern_out'
    | 'fuel_drain'
    | 'pulse'
    | 'player_hit'
    | 'shade_spawned'
    | 'game_over'
    | 'dash'
    | 'charm_picked'
    | 'drifter_steal'
    | 'drifter_drop'
    | 'night_start'
    | 'paused'
    | 'resumed';
  data: Record<string, unknown>;
}

export interface EndLine {
  type: 'end';
  ticks: number;
  state: GameState;
  score: number;
}

export type JsonlRecord = SnapshotLine | EventLine | EndLine;
