import {
  CHARM_DURATION_TICKS,
  CHARM_RESPAWN_TICKS,
  CHARM_SPEED,
  DASH_COOLDOWN_TICKS,
  DASH_TICKS,
  DEFAULT_TUNING,
  DRIFTER_CHASE_SPEED,
  DRIFTER_DETECT_RADIUS,
  DRIFTER_DROP_FLEE_TICKS,
  DRIFTER_FLEE_SPEED,
  DRIFTER_FLEE_TICKS,
  DRIFTER_IDLE_SPEED,
  DRIFTER_MAX_COUNT,
  DRIFTER_MAX_STEAL,
  DRIFTER_SPAWN_INTERVAL_TICKS,
  DRIFTER_STEAL_RADIUS,
  DRIFTER_TRIGGER_MIN_CARRIED,
  DROPPED_MOTE_TTL_TICKS,
  DT,
  FALL_RESPAWN_TICKS,
  FALL_Y_THRESHOLD,
  FUEL_DECAY_PER_TICK_60,
  FUEL_DRAIN_EVENT_INTERVAL,
  FUEL_DRAIN_PER_TICK_60,
  FUEL_LOW_THRESHOLD_60,
  FUEL_MAX_60,
  FUEL_PER_MOTE_60,
  GRAVITY,
  INITIAL_MOTE_COUNT,
  INVULN_TICKS,
  JUMP_SPEED,
  MAX_MOTE_COUNT,
  MOTE_SPAWN_INTERVAL_TICKS,
  PICKUP_HEIGHT_DIFF,
  PULSE_COOLDOWN_TICKS,
  PULSE_ORIGIN_Y_OFFSET,
  PULSE_PUSH_TICKS,
  PULSE_STUN_TICKS,
  SAFE_PUSH_MAX_TICKS,
  SCORE_DAWN_PER_LIT_BASE,
  SCORE_RELIGHT,
  SCORE_STUN_DRAINING,
  SHADE_DETECT_RADIUS,
  SHADE_DISENGAGE_RADIUS,
  SHADE_DRAIN_CHASE_RADIUS,
  SHADE_DRAIN_ENGAGE_RADIUS,
  SHADE_HIT_HEIGHT_DIFF,
  SHADE_RECOIL_DIST,
  SHADE_RECOIL_TICKS,
  SHADE_SPAWNING_TICKS,
  SHADE_SPAWN_MIN_PLAYER_DIST,
  TICK_RATE,
  WIND_CYCLE_TICKS,
  WIND_DURATION_TICKS,
  WIND_PUSH_SPEED,
  WIND_WARNING_TICKS,
  round1,
  round3,
  roundVec3,
} from './config.js';
import {
  getNightMap,
  getTerrainHeight,
  isBlockedByObstacle,
  resolveHorizontalMove,
  type NightMapDef,
} from './maps.js';
import { Mulberry32 } from './rng.js';
import type {
  CharmEntity,
  DrifterEntity,
  EndLine,
  EventLine,
  GameOverReason,
  GameState,
  GameTuning,
  LanternEntity,
  MoteEntity,
  NightNumber,
  PlayerEntity,
  ScenarioConfig,
  ShadeEntity,
  SnapshotLine,
  TickInputState,
  Vec3,
  WindState,
} from './types.js';

export interface SimulationOptions {
  seed: number;
  night?: NightNumber;
  scenario?: ScenarioConfig;
  tuning?: GameTuning;
}

export function createDefaultInputState(): TickInputState {
  return {
    move: [0, 0],
    cam_yaw_deg: 0,
    jump: false,
    interact: false,
    pulse: false,
    dash: false,
    pause: false,
  };
}

function distXZ(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

function dist3D(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function compareId(a: { id: string }, b: { id: string }): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export class GameSimulation {
  readonly tuning: GameTuning;
  readonly seed: number;
  readonly night: NightNumber;
  readonly map: NightMapDef;
  private rng: Mulberry32;

  tick = 0;
  simTick = 0;
  state: GameState = 'playing';
  score = 0;
  initialDurationS: number;
  timeLeftS: number;

  player: PlayerEntity;
  lanterns: LanternEntity[] = [];
  shades: ShadeEntity[] = [];
  motes: MoteEntity[] = [];
  drifters: DrifterEntity[] = [];
  charms: CharmEntity[] = [];
  wind: WindState;

  private randomMotes = true;
  private randomShades = true;
  private randomDrifters = false;
  private nextMoteId = 1;
  private nextShadeId = 1;
  private nextDrifterId = 1;
  private prevInput: TickInputState = createDefaultInputState();
  private lastGameOverReason: GameOverReason | null = null;
  private nightStartEmitted = false;
  private nextWindDirDeg = 0;

  constructor(options: SimulationOptions) {
    this.seed = options.seed;
    this.night = options.night ?? 1;
    this.tuning = options.tuning ?? DEFAULT_TUNING;
    this.map = getNightMap(this.night);
    this.rng = new Mulberry32(this.seed);

    const scenario = options.scenario;
    const defaultDuration =
      this.night === 1
        ? this.tuning.night1_duration_s
        : this.night === 2
          ? this.tuning.night2_duration_s
          : this.tuning.night3_duration_s;

    this.initialDurationS =
      scenario?.time_left_s !== undefined ? scenario.time_left_s : defaultDuration;
    this.timeLeftS = this.initialDurationS;

    this.randomMotes = scenario?.random_motes ?? true;
    this.randomShades = scenario?.random_shades ?? true;
    this.randomDrifters = scenario?.random_drifters ?? this.map.driftersEnabled;

    const windEnabled = scenario?.wind_enabled ?? this.map.windEnabled;
    this.nextWindDirDeg = Math.floor(this.rng.range(0, 360));
    this.wind = {
      enabled: windEnabled,
      active: false,
      warning: false,
      dirDeg: 0,
    };

    // Initialize player
    const spawnPos: Vec3 = scenario?.player?.pos
      ? [...scenario.player.pos]
      : [...this.map.spawnPos];
    const startGround = getTerrainHeight(this.night, spawnPos[0], spawnPos[2]);
    const isGrounded =
      startGround !== null && Math.abs(spawnPos[1] - startGround) <= 0.05;

    this.player = {
      pos: spawnPos,
      vel: [0, 0, 0],
      grounded: isGrounded,
      flames: scenario?.player?.flames ?? this.tuning.flames,
      carried: scenario?.player?.carried ?? 0,
      successfulLights: scenario?.player?.successful_lights ?? 0,
      invulnTicks: scenario?.player?.invuln_ticks ?? 0,
      dashTicksLeft: 0,
      dashDir: [0, 1],
      dashCdTicks: scenario?.player?.dash_cd_ticks ?? 0,
      pulseCdTicks: scenario?.player?.pulse_cd_ticks ?? 0,
      charmTicks: scenario?.player?.charm_ticks ?? 0,
      respawnTicks: 0,
      launchVel: null,
      facingYaw: this.map.spawnYaw,
    };

    // Initialize lanterns (with Phase 3 fuel, everLit, relitCount)
    this.lanterns = this.map.lanterns.map((l) => ({
      id: l.id,
      pos: [...l.pos],
      lit: false,
      deposited: 0,
      fuelSixtieths: 0,
      everLit: false,
      relitCount: 0,
    }));

    if (scenario?.lanterns) {
      for (const override of scenario.lanterns) {
        const existing = this.lanterns.find((l) => l.id === override.id);
        if (existing) {
          if (override.pos) existing.pos = [...override.pos];
          if (override.deposited !== undefined) existing.deposited = override.deposited;
          if (override.lit !== undefined) existing.lit = override.lit;
          if (override.ever_lit !== undefined) existing.everLit = override.ever_lit;
          if (existing.lit) {
            existing.everLit = true;
            const fuelVal =
              override.fuel !== undefined ? Math.max(0, Math.min(100, override.fuel)) : 100;
            existing.fuelSixtieths = Math.round(fuelVal * TICK_RATE);
            if (existing.deposited < this.tuning.lantern_cost && override.deposited === undefined) {
              existing.deposited = this.tuning.lantern_cost;
            }
          } else {
            existing.fuelSixtieths = 0;
          }
        } else {
          const lit = override.lit ?? false;
          const everLit = override.ever_lit ?? lit;
          const fuelVal = lit
            ? override.fuel !== undefined
              ? Math.max(0, Math.min(100, override.fuel))
              : 100
            : 0;
          const deposited = override.deposited ?? (lit ? this.tuning.lantern_cost : 0);
          this.lanterns.push({
            id: override.id,
            pos: override.pos ? [...override.pos] : [0, 0, 0],
            lit,
            deposited,
            fuelSixtieths: Math.round(fuelVal * TICK_RATE),
            everLit,
            relitCount: 0,
          });
        }
      }
    }

    // Initialize motes
    if (scenario?.motes !== undefined) {
      for (const m of scenario.motes) {
        if (Array.isArray(m)) {
          this.motes.push({
            id: `M${this.nextMoteId++}`,
            pos: [m[0], m[1], m[2]],
            kind: 'random',
            ttlTicks: null,
            spawnTick: -1,
          });
        } else {
          const id = m.id ?? `M${this.nextMoteId++}`;
          const match = /^M(\d+)$/.exec(id);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num >= this.nextMoteId) this.nextMoteId = num + 1;
          }
          const kind = m.kind ?? 'random';
          this.motes.push({
            id,
            pos: [...m.pos],
            kind,
            ttlTicks:
              m.ttl_ticks !== undefined
                ? m.ttl_ticks
                : kind === 'dropped'
                  ? DROPPED_MOTE_TTL_TICKS
                  : null,
            spawnTick: -1,
          });
        }
      }
    } else if (this.randomMotes) {
      this.spawnInitialMotes();
    }

    // Initialize shades
    if (scenario?.shades !== undefined) {
      for (const s of scenario.shades) {
        const id = s.id ?? `S${this.nextShadeId++}`;
        const match = /^S(\d+)$/.exec(id);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num >= this.nextShadeId) this.nextShadeId = num + 1;
        }
        const groundY = getTerrainHeight(this.night, s.pos[0], s.pos[2]) ?? 0;
        const hoverOffset = Math.max(0, s.pos[1] - groundY);
        const defaultState =
          dist3D(s.pos, this.player.pos) <= SHADE_DETECT_RADIUS ? 'chase' : 'wander';
        const state = s.state ?? defaultState;
        const defaultStateTicks =
          state === 'stunned'
            ? PULSE_STUN_TICKS
            : state === 'recoil'
              ? SHADE_RECOIL_TICKS
              : state === 'spawning'
                ? SHADE_SPAWNING_TICKS
                : 0;
        let targetLanternId: string | null = s.target_lantern_id ?? null;
        if (state === 'drain' && !targetLanternId) {
          const nearest = this.findNearestLantern(s.pos, (l) => l.lit);
          if (nearest) targetLanternId = nearest.id;
        }
        this.shades.push({
          id,
          pos: [...s.pos],
          hoverOffset,
          state,
          stateTicksLeft: s.state_ticks_left ?? defaultStateTicks,
          targetLanternId,
          drainTicks: 0,
          pulsePushTicksLeft: 0,
          pulsePushDir: [1, 0],
          recoilDir: [1, 0],
          safePushTicksLeft: 0,
          safePushLanternId: null,
          wanderAngle: this.rng.range(0, Math.PI * 2),
          wanderTicksLeft: 120,
          spawnTick: -1,
        });
      }
    }

    // Initialize drifters
    if (scenario?.drifters !== undefined) {
      for (const d of scenario.drifters) {
        const id = d.id ?? `D${this.nextDrifterId++}`;
        const match = /^D(\d+)$/.exec(id);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num >= this.nextDrifterId) this.nextDrifterId = num + 1;
        }
        const stolen = d.stolen ?? 0;
        const state = d.state ?? 'idle';
        this.drifters.push({
          id,
          pos: [...d.pos],
          state,
          stolen,
          hasStolen: stolen > 0 || state === 'flee',
          fleeTicksLeft: d.flee_ticks_left ?? (state === 'flee' ? DRIFTER_FLEE_TICKS : 0),
          orbitAngle: this.rng.range(0, Math.PI * 2),
          spawnTick: -1,
        });
      }
    }

    // Initialize charms
    if (scenario?.charms !== undefined) {
      for (let i = 0; i < scenario.charms.length; i++) {
        const c = scenario.charms[i];
        const fallback = this.map.charms[i];
        this.charms.push({
          id: c.id ?? fallback?.id ?? `C${i + 1}`,
          pos: c.pos ? [...c.pos] : fallback ? [...fallback.pos] : [0, 0, 0],
          available: c.available ?? true,
          respawnTicks: c.respawn_ticks ?? (c.available === false ? CHARM_RESPAWN_TICKS : 0),
        });
      }
    } else {
      this.charms = this.map.charms.map((c) => ({
        id: c.id,
        pos: [...c.pos],
        available: true,
        respawnTicks: 0,
      }));
    }
  }

  getPlayerCapacity(): number {
    return Math.min(
      this.tuning.capacity_max,
      this.tuning.carry_capacity + 2 * this.player.successfulLights
    );
  }

  getWinLanternThreshold(): number {
    return Math.ceil(this.tuning.win_ratio * this.lanterns.length);
  }

  private hasSafeZone(l: LanternEntity): boolean {
    return l.lit && l.fuelSixtieths >= FUEL_LOW_THRESHOLD_60;
  }

  private findNearestLantern(
    fromPos: Vec3,
    predicate: (l: LanternEntity) => boolean
  ): LanternEntity | null {
    const candidates = this.lanterns.filter(predicate).sort((a, b) => {
      const da = distXZ(fromPos, a.pos);
      const db = distXZ(fromPos, b.pos);
      if (Math.abs(da - db) > 1e-9) return da - db;
      return compareId(a, b);
    });
    return candidates[0] ?? null;
  }

  private triggerSafeZonePushout(lantern: LanternEntity): void {
    for (const shade of this.shades) {
      if (distXZ(shade.pos, lantern.pos) < this.tuning.safe_radius) {
        shade.safePushTicksLeft = SAFE_PUSH_MAX_TICKS;
        shade.safePushLanternId = lantern.id;
        if (shade.state === 'drain' && shade.targetLanternId === lantern.id) {
          shade.state = 'wander';
          shade.targetLanternId = null;
          shade.drainTicks = 0;
        }
      }
    }
  }

  private spawnInitialMotes(): void {
    const indices = this.map.moteSpawnPoints.map((_, idx) => idx);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng.next() * (i + 1));
      const tmp = indices[i];
      indices[i] = indices[j];
      indices[j] = tmp;
    }
    const count = Math.min(INITIAL_MOTE_COUNT, indices.length);
    for (let i = 0; i < count; i++) {
      const p = this.map.moteSpawnPoints[indices[i]];
      this.motes.push({
        id: `M${this.nextMoteId++}`,
        pos: [p[0], p[1], p[2]],
        kind: 'random',
        ttlTicks: null,
        spawnTick: -1,
      });
    }
  }

  private spawnOneRandomMote(): void {
    if (this.motes.length >= MAX_MOTE_COUNT) return;
    const emptyPoints = this.map.moteSpawnPoints.filter(
      (pt) => !this.motes.some((m) => distXZ(m.pos, pt) < 0.5 && Math.abs(m.pos[1] - pt[1]) < 0.5)
    );
    if (emptyPoints.length === 0) return;
    const chosen = emptyPoints[Math.floor(this.rng.next() * emptyPoints.length)];
    this.motes.push({
      id: `M${this.nextMoteId++}`,
      pos: [chosen[0], chosen[1], chosen[2]],
      kind: 'random',
      ttlTicks: null,
      spawnTick: this.simTick,
    });
  }

  private spawnOneRandomShade(events: EventLine[]): void {
    if (this.shades.length >= this.map.shadeMaxCount) return;
    const validPoints = this.map.shadeSpawnPoints.filter((pt) => {
      if (distXZ(pt, this.player.pos) < SHADE_SPAWN_MIN_PLAYER_DIST) return false;
      for (const l of this.lanterns) {
        if (this.hasSafeZone(l) && distXZ(pt, l.pos) <= this.tuning.safe_radius) return false;
      }
      return true;
    });
    if (validPoints.length === 0) return;
    const chosen = validPoints[Math.floor(this.rng.next() * validPoints.length)];
    const shade: ShadeEntity = {
      id: `S${this.nextShadeId++}`,
      pos: [chosen[0], round3(chosen[1] + PULSE_ORIGIN_Y_OFFSET), chosen[2]],
      hoverOffset: PULSE_ORIGIN_Y_OFFSET,
      state: 'spawning',
      stateTicksLeft: SHADE_SPAWNING_TICKS,
      targetLanternId: null,
      drainTicks: 0,
      pulsePushTicksLeft: 0,
      pulsePushDir: [1, 0],
      recoilDir: [1, 0],
      safePushTicksLeft: 0,
      safePushLanternId: null,
      wanderAngle: this.rng.range(0, Math.PI * 2),
      wanderTicksLeft: 120,
      spawnTick: this.simTick,
    };
    this.shades.push(shade);
    events.push({
      type: 'event',
      tick: this.tick,
      name: 'shade_spawned',
      data: { id: shade.id },
    });
  }

  private spawnOneRandomDrifter(): void {
    if (this.drifters.length >= DRIFTER_MAX_COUNT) return;
    const points = this.map.shadeSpawnPoints;
    if (points.length === 0) return;
    const chosen = points[Math.floor(this.rng.next() * points.length)];
    this.drifters.push({
      id: `D${this.nextDrifterId++}`,
      pos: [chosen[0], round3(chosen[1] + 1.4), chosen[2]],
      state: 'idle',
      stolen: 0,
      hasStolen: false,
      fleeTicksLeft: 0,
      orbitAngle: this.rng.range(0, Math.PI * 2),
      spawnTick: this.simTick,
    });
  }

  private spawnDroppedMotes(origin: Vec3, count: number, ringMin: number, ringMax: number): void {
    for (let i = 0; i < count; i++) {
      let placed: Vec3 | null = null;
      for (let attempt = 0; attempt < 8; attempt++) {
        const angle = this.rng.range(0, Math.PI * 2);
        const radius = ringMin === ringMax ? ringMin : this.rng.range(ringMin, ringMax);
        const tx = origin[0] + Math.cos(angle) * radius;
        const tz = origin[2] + Math.sin(angle) * radius;
        if (isBlockedByObstacle(this.night, tx, tz)) continue;
        const h = getTerrainHeight(this.night, tx, tz);
        if (h !== null) {
          placed = [round3(tx), round3(h), round3(tz)];
          break;
        }
      }
      if (!placed) {
        const fallbackH =
          getTerrainHeight(this.night, origin[0], origin[2]) ?? Math.max(0, origin[1]);
        placed = [round3(origin[0]), round3(fallbackH), round3(origin[2])];
      }
      this.motes.push({
        id: `M${this.nextMoteId++}`,
        pos: placed,
        kind: 'dropped',
        ttlTicks: DROPPED_MOTE_TTL_TICKS,
        spawnTick: this.simTick,
      });
    }
  }

  private clampShadeOutsideSafeZones(shade: ShadeEntity): void {
    const safeR = this.tuning.safe_radius;
    if (safeR <= 0) return;
    for (const l of this.lanterns) {
      if (!this.hasSafeZone(l)) continue;
      if (shade.safePushTicksLeft > 0 && shade.safePushLanternId === l.id) continue;
      const dx = shade.pos[0] - l.pos[0];
      const dz = shade.pos[2] - l.pos[2];
      const d = Math.hypot(dx, dz);
      if (d < safeR) {
        const targetR = safeR + 0.02;
        if (d < 1e-6) {
          shade.pos[0] = l.pos[0] + targetR;
        } else {
          shade.pos[0] = l.pos[0] + (dx / d) * targetR;
          shade.pos[2] = l.pos[2] + (dz / d) * targetR;
        }
      }
    }
  }

  private moveShadeXZ(shade: ShadeEntity, targetX: number, targetZ: number): boolean {
    const h = getTerrainHeight(this.night, targetX, targetZ);
    if (h === null || isBlockedByObstacle(this.night, targetX, targetZ)) {
      return false;
    }
    const baseY = shade.pos[1] - shade.hoverOffset;
    if (h > baseY + 0.65) {
      return false;
    }
    shade.pos[0] = targetX;
    shade.pos[2] = targetZ;
    shade.pos[1] = h + shade.hoverOffset;
    return true;
  }

  /**
   * Advances simulation by 1 tick (1/60s), strictly following the 12-step tick order
   * updated for Ticket-03 (Contract v1.2).
   */
  step(input: TickInputState): EventLine[] {
    if (this.state === 'won' || this.state === 'lost') {
      return [];
    }

    const events: EventLine[] = [];
    this.tick += 1;

    // 1. Read input (handle pause first)
    const pausePressed = input.pause && !this.prevInput.pause;
    const jumpPressed = input.jump && !this.prevInput.jump;
    const interactPressed = input.interact && !this.prevInput.interact;
    const pulsePressed = input.pulse && !this.prevInput.pulse;
    const dashPressed = input.dash && !this.prevInput.dash;

    this.prevInput = {
      move: [input.move[0], input.move[1]],
      cam_yaw_deg: input.cam_yaw_deg,
      jump: input.jump,
      interact: input.interact,
      pulse: input.pulse,
      dash: input.dash,
      pause: input.pause,
    };

    if (pausePressed) {
      if (this.state === 'playing') {
        this.state = 'paused';
        events.push({ type: 'event', tick: this.tick, name: 'paused', data: {} });
        return events;
      } else if (this.state === 'paused') {
        this.state = 'playing';
        events.push({ type: 'event', tick: this.tick, name: 'resumed', data: {} });
      }
    } else if (this.state === 'paused') {
      return events;
    }

    // Active gameplay step
    this.simTick += 1;
    if (!this.nightStartEmitted) {
      this.nightStartEmitted = true;
      events.push({
        type: 'event',
        tick: this.tick,
        name: 'night_start',
        data: { night: this.night },
      });
    }

    // 2. Decrement counters & lantern fuel (decay + drain), then extinguish fuel <= 0
    this.timeLeftS = Math.max(0, this.initialDurationS - this.simTick / TICK_RATE);
    if (this.player.dashCdTicks > 0) this.player.dashCdTicks -= 1;
    if (this.player.pulseCdTicks > 0) this.player.pulseCdTicks -= 1;
    if (this.player.invulnTicks > 0) this.player.invulnTicks -= 1;
    if (this.player.charmTicks > 0) this.player.charmTicks -= 1;

    if (this.player.respawnTicks > 0) {
      this.player.respawnTicks -= 1;
      if (this.player.respawnTicks === 0) {
        this.player.pos = [...this.map.spawnPos];
        this.player.vel = [0, 0, 0];
        this.player.grounded = true;
        this.player.launchVel = null;
        this.player.dashTicksLeft = 0;
        this.player.invulnTicks = INVULN_TICKS;
      }
    }

    for (const shade of this.shades) {
      if (shade.stateTicksLeft > 0) {
        shade.stateTicksLeft -= 1;
        if (shade.stateTicksLeft === 0) {
          if (
            shade.state === 'spawning' ||
            shade.state === 'stunned' ||
            shade.state === 'recoil'
          ) {
            shade.state = 'wander';
          }
        }
      }
    }

    for (let i = this.motes.length - 1; i >= 0; i--) {
      const m = this.motes[i];
      if (m.ttlTicks !== null) {
        m.ttlTicks -= 1;
        if (m.ttlTicks <= 0) {
          this.motes.splice(i, 1);
        }
      }
    }

    for (const charm of this.charms) {
      if (!charm.available && charm.respawnTicks > 0) {
        charm.respawnTicks -= 1;
        if (charm.respawnTicks <= 0) {
          charm.available = true;
          charm.respawnTicks = 0;
        }
      }
    }

    // Step 2 (Ticket-03): Lantern fuel decay (1/60) + shade drain (5/60 each), then extinguish <= 0
    const shadesByIdForDrain = [...this.shades].sort(compareId);
    for (const lantern of this.lanterns) {
      if (!lantern.lit) continue;
      lantern.fuelSixtieths -= FUEL_DECAY_PER_TICK_60;

      for (const shade of shadesByIdForDrain) {
        if (shade.state === 'drain' && shade.targetLanternId === lantern.id) {
          lantern.fuelSixtieths -= FUEL_DRAIN_PER_TICK_60;
          shade.drainTicks += 1;
          if (shade.drainTicks % FUEL_DRAIN_EVENT_INTERVAL === 0) {
            events.push({
              type: 'event',
              tick: this.tick,
              name: 'fuel_drain',
              data: {
                lantern_id: lantern.id,
                shade_id: shade.id,
                fuel: round1(Math.max(0, lantern.fuelSixtieths) / TICK_RATE),
              },
            });
          }
        }
      }

      if (lantern.fuelSixtieths <= 0) {
        lantern.fuelSixtieths = 0;
        lantern.lit = false;
        lantern.deposited = 0;
        lantern.everLit = true;
        events.push({
          type: 'event',
          tick: this.tick,
          name: 'lantern_out',
          data: { lantern_id: lantern.id },
        });
        for (const shade of this.shades) {
          if (shade.state === 'drain' && shade.targetLanternId === lantern.id) {
            shade.state = 'wander';
            shade.targetLanternId = null;
            shade.drainTicks = 0;
          }
        }
      }
    }

    // Wind schedule (Night 3 or wind_enabled)
    if (this.wind.enabled) {
      const cyclePos = this.simTick % WIND_CYCLE_TICKS;
      if (cyclePos === WIND_CYCLE_TICKS - WIND_WARNING_TICKS) {
        this.nextWindDirDeg = Math.floor(this.rng.range(0, 360));
        this.wind.warning = true;
        this.wind.dirDeg = this.nextWindDirDeg;
      }
      if (this.simTick >= WIND_CYCLE_TICKS && cyclePos < WIND_DURATION_TICKS) {
        if (cyclePos === 0) {
          this.wind.dirDeg = this.nextWindDirDeg;
        }
        this.wind.active = true;
        this.wind.warning = false;
      } else {
        this.wind.active = false;
        this.wind.warning = cyclePos >= WIND_CYCLE_TICKS - WIND_WARNING_TICKS;
      }
    } else {
      this.wind.active = false;
      this.wind.warning = false;
    }

    // 3. Move Mây (jump, dash, jump pads, wind) & check fall off island
    if (this.player.respawnTicks === 0) {
      let mx = Math.max(-1, Math.min(1, input.move[0]));
      let mz = Math.max(-1, Math.min(1, input.move[1]));
      const mag = Math.hypot(mx, mz);
      if (mag > 1) {
        mx /= mag;
        mz /= mag;
      }

      const theta = (input.cam_yaw_deg * Math.PI) / 180;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      const wx = mx * cosT + mz * sinT;
      const wz = -mx * sinT + mz * cosT;
      const moving = Math.hypot(wx, wz) > 1e-6;

      const canDash =
        dashPressed &&
        this.player.dashTicksLeft === 0 &&
        (this.player.charmTicks > 0 || this.player.dashCdTicks === 0);

      if (canDash) {
        let dx: number;
        let dz: number;
        if (moving) {
          const wLen = Math.hypot(wx, wz);
          dx = wx / wLen;
          dz = wz / wLen;
          this.player.facingYaw = Math.atan2(dx, dz);
        } else {
          dx = Math.sin(this.player.facingYaw);
          dz = Math.cos(this.player.facingYaw);
        }
        this.player.dashDir = [dx, dz];
        this.player.dashTicksLeft = DASH_TICKS;
        this.player.dashCdTicks = this.player.charmTicks > 0 ? 0 : DASH_COOLDOWN_TICKS;
        this.player.launchVel = null;
        this.player.vel[1] = 0;
        events.push({ type: 'event', tick: this.tick, name: 'dash', data: {} });
      }

      let vx = 0;
      let vz = 0;
      const isDashing = this.player.dashTicksLeft > 0;

      if (isDashing) {
        vx = this.player.dashDir[0] * this.tuning.dash_speed;
        vz = this.player.dashDir[1] * this.tuning.dash_speed;
        this.player.vel[1] = 0;
        this.player.dashTicksLeft -= 1;
      } else if (this.player.launchVel !== null) {
        vx = this.player.launchVel[0];
        vz = this.player.launchVel[1];
      } else {
        const speed = this.player.charmTicks > 0 ? CHARM_SPEED : this.tuning.player_speed;
        vx = wx * speed;
        vz = wz * speed;
        if (moving) {
          this.player.facingYaw = Math.atan2(wx, wz);
        }
      }

      if (this.wind.active) {
        const wRad = (this.wind.dirDeg * Math.PI) / 180;
        vx += Math.cos(wRad) * WIND_PUSH_SPEED;
        vz += Math.sin(wRad) * WIND_PUSH_SPEED;
      }

      if (!isDashing && jumpPressed && this.player.grounded) {
        this.player.vel[1] = JUMP_SPEED;
        this.player.grounded = false;
      }

      const prevX = this.player.pos[0];
      const prevY = this.player.pos[1];
      const prevZ = this.player.pos[2];
      const [newX, newZ] = resolveHorizontalMove(
        this.night,
        prevX,
        prevZ,
        prevX + vx * DT,
        prevZ + vz * DT,
        prevY
      );
      this.player.pos[0] = newX;
      this.player.pos[2] = newZ;
      this.player.vel[0] = (newX - prevX) / DT;
      this.player.vel[2] = (newZ - prevZ) / DT;

      if (!isDashing) {
        this.player.pos[1] += this.player.vel[1] * DT;
        this.player.vel[1] -= GRAVITY * DT;
      }

      const groundH = getTerrainHeight(this.night, this.player.pos[0], this.player.pos[2]);
      if (groundH !== null) {
        if (isDashing && !this.player.grounded) {
          if (this.player.pos[1] < groundH) {
            this.player.pos[1] = groundH;
            this.player.grounded = true;
          }
        } else if (
          this.player.vel[1] <= 0 &&
          this.player.pos[1] <= groundH + (this.player.grounded ? 0.35 : 0.01) &&
          prevY >= groundH - 0.65
        ) {
          this.player.pos[1] = groundH;
          this.player.vel[1] = 0;
          this.player.grounded = true;
          this.player.launchVel = null;
        } else if (this.player.pos[1] > groundH + 0.01) {
          this.player.grounded = false;
        }
      } else {
        this.player.grounded = false;
      }

      if (this.player.launchVel === null && this.player.dashTicksLeft === 0) {
        for (const pad of this.map.jumpPads) {
          if (
            distXZ(this.player.pos, pad.pos) <= pad.radius &&
            Math.abs(this.player.pos[1] - pad.pos[1]) <= 0.6
          ) {
            this.player.vel[1] = pad.vy;
            this.player.launchVel = [pad.horizVel[0], pad.horizVel[1]];
            this.player.vel[0] = pad.horizVel[0];
            this.player.vel[2] = pad.horizVel[1];
            this.player.grounded = false;
            break;
          }
        }
      }

      if (this.tuning.fall_enabled && this.player.pos[1] < FALL_Y_THRESHOLD) {
        this.player.flames = Math.max(0, this.player.flames - 1);
        const lost = this.player.carried;
        this.player.carried = 0;
        this.player.vel = [0, 0, 0];
        this.player.dashTicksLeft = 0;
        this.player.launchVel = null;
        events.push({
          type: 'event',
          tick: this.tick,
          name: 'player_hit',
          data: {
            by: 'fall',
            flames: this.player.flames,
            dropped: 0,
            lost,
          },
        });
        if (this.player.flames > 0) {
          this.player.respawnTicks = FALL_RESPAWN_TICKS;
        }
      }
    }

    // 4. Pick up motes (up to dynamic capacity) and charms
    if (this.player.respawnTicks === 0) {
      const capacity = this.getPlayerCapacity();
      if (this.player.carried < capacity) {
        for (let i = 0; i < this.motes.length; ) {
          if (this.player.carried >= capacity) break;
          const m = this.motes[i];
          const canPickDropped = m.kind !== 'dropped' || m.spawnTick < this.simTick;
          if (
            canPickDropped &&
            distXZ(this.player.pos, m.pos) <= this.tuning.pickup_radius &&
            Math.abs(this.player.pos[1] - m.pos[1]) <= PICKUP_HEIGHT_DIFF
          ) {
            this.motes.splice(i, 1);
            this.player.carried += 1;
            events.push({
              type: 'event',
              tick: this.tick,
              name: 'mote_picked',
              data: { carried: this.player.carried },
            });
          } else {
            i++;
          }
        }
      }

      for (const charm of this.charms) {
        if (!charm.available) continue;
        if (
          distXZ(this.player.pos, charm.pos) <= this.tuning.pickup_radius &&
          Math.abs(this.player.pos[1] - charm.pos[1]) <= PICKUP_HEIGHT_DIFF
        ) {
          charm.available = false;
          charm.respawnTicks = CHARM_RESPAWN_TICKS;
          this.player.charmTicks = CHARM_DURATION_TICKS;
          this.player.dashCdTicks = 0;
          events.push({
            type: 'event',
            tick: this.tick,
            name: 'charm_picked',
            data: { charm_id: charm.id, charm_ticks: CHARM_DURATION_TICKS },
          });
        }
      }
    }

    // 5. Interact with lanterns: unlit OR lit with fuel < 100 (nearest, tie-break smaller id)
    if (this.player.respawnTicks === 0 && interactPressed && this.player.carried > 0) {
      const target = this.findNearestLantern(
        this.player.pos,
        (l) =>
          distXZ(this.player.pos, l.pos) <= this.tuning.interact_radius &&
          Math.abs(this.player.pos[1] - l.pos[1]) <= 2.5 &&
          (!l.lit || l.fuelSixtieths < FUEL_MAX_60)
      );

      if (target) {
        if (!target.lit) {
          const cost = target.everLit ? this.tuning.relight_cost : this.tuning.lantern_cost;
          const needed = Math.max(0, cost - target.deposited);
          const amount = Math.min(this.player.carried, needed);
          if (amount > 0) {
            this.player.carried -= amount;
            target.deposited += amount;
            this.score += amount * this.tuning.score.per_mote;
            events.push({
              type: 'event',
              tick: this.tick,
              name: 'deposit',
              data: {
                lantern_id: target.id,
                amount,
                deposited: target.deposited,
              },
            });

            if (target.deposited >= cost) {
              const isRelight = target.everLit;
              target.lit = true;
              target.everLit = true;
              target.fuelSixtieths = FUEL_MAX_60;
              if (isRelight) {
                target.relitCount += 1;
                this.score += SCORE_RELIGHT;
              } else {
                this.score += this.tuning.score.per_lantern;
              }
              this.player.successfulLights += 1;

              events.push({
                type: 'event',
                tick: this.tick,
                name: 'lantern_lit',
                data: { lantern_id: target.id, relight: isRelight },
              });
              this.triggerSafeZonePushout(target);
            }
          }
        } else {
          // Refuel lit lantern (fuelSixtieths < 6000)
          const neededMotes = Math.ceil((FUEL_MAX_60 - target.fuelSixtieths) / FUEL_PER_MOTE_60);
          const used = Math.min(this.player.carried, neededMotes);
          if (used > 0) {
            const wasLow = target.fuelSixtieths < FUEL_LOW_THRESHOLD_60;
            this.player.carried -= used;
            target.fuelSixtieths = Math.min(
              FUEL_MAX_60,
              target.fuelSixtieths + used * FUEL_PER_MOTE_60
            );
            this.score += used * this.tuning.score.per_mote;
            events.push({
              type: 'event',
              tick: this.tick,
              name: 'refuel',
              data: {
                lantern_id: target.id,
                amount: used,
                fuel: round1(target.fuelSixtieths / TICK_RATE),
              },
            });
            if (wasLow && target.fuelSixtieths >= FUEL_LOW_THRESHOLD_60) {
              this.triggerSafeZonePushout(target);
            }
          }
        }
      }
    }

    // 6. Update safe zones (push out shades caught inside a lantern with fuel >= 30)
    for (const shade of this.shades) {
      if (shade.safePushTicksLeft > 0 && shade.safePushLanternId) {
        const lantern = this.lanterns.find((l) => l.id === shade.safePushLanternId);
        if (!lantern || !this.hasSafeZone(lantern)) {
          shade.safePushTicksLeft = 0;
          shade.safePushLanternId = null;
          continue;
        }
        const dx = shade.pos[0] - lantern.pos[0];
        const dz = shade.pos[2] - lantern.pos[2];
        const d = Math.hypot(dx, dz);
        const targetR = this.tuning.safe_radius + 0.05;
        if (d >= this.tuning.safe_radius) {
          shade.safePushTicksLeft = 0;
          shade.safePushLanternId = null;
        } else {
          const remaining = targetR - d;
          const stepDist = remaining / shade.safePushTicksLeft;
          const nx = d < 1e-6 ? 1 : dx / d;
          const nz = d < 1e-6 ? 0 : dz / d;
          shade.pos[0] += nx * stepDist;
          shade.pos[2] += nz * stepDist;
          shade.safePushTicksLeft -= 1;
          if (shade.safePushTicksLeft <= 0) {
            shade.safePushLanternId = null;
          }
        }
      }
    }

    // 7. Pulse (Tỏa Sáng) — +15 total if shade was draining, else +5
    if (
      this.player.respawnTicks === 0 &&
      pulsePressed &&
      this.player.pulseCdTicks === 0 &&
      this.player.carried >= this.tuning.pulse_cost
    ) {
      this.player.carried -= this.tuning.pulse_cost;
      this.player.pulseCdTicks = PULSE_COOLDOWN_TICKS;

      const pulseCenter: Vec3 = [
        this.player.pos[0],
        this.player.pos[1] + PULSE_ORIGIN_Y_OFFSET,
        this.player.pos[2],
      ];
      const stunnedIds: string[] = [];

      const sortedShades = [...this.shades].sort(compareId);
      for (const shade of sortedShades) {
        if (dist3D(pulseCenter, shade.pos) <= this.tuning.pulse_radius) {
          const wasDraining = shade.state === 'drain';
          shade.state = 'stunned';
          shade.stateTicksLeft = PULSE_STUN_TICKS;
          shade.targetLanternId = null;
          shade.drainTicks = 0;
          shade.pulsePushTicksLeft = PULSE_PUSH_TICKS;
          const dx = shade.pos[0] - this.player.pos[0];
          const dz = shade.pos[2] - this.player.pos[2];
          const d = Math.hypot(dx, dz);
          if (d < 1e-6) {
            shade.pulsePushDir = [1, 0];
          } else {
            shade.pulsePushDir = [dx / d, dz / d];
          }
          stunnedIds.push(shade.id);
          this.score += wasDraining ? SCORE_STUN_DRAINING : this.tuning.score.per_stun;
        }
      }

      const sortedDrifters = [...this.drifters].sort(compareId);
      for (const drifter of sortedDrifters) {
        if (dist3D(pulseCenter, drifter.pos) <= this.tuning.pulse_radius) {
          if (drifter.state === 'chase') {
            drifter.state = 'flee';
            drifter.fleeTicksLeft = DRIFTER_FLEE_TICKS;
          } else if (drifter.state === 'flee' && drifter.stolen > 0) {
            const amount = drifter.stolen;
            drifter.stolen = 0;
            drifter.fleeTicksLeft = DRIFTER_DROP_FLEE_TICKS;
            this.spawnDroppedMotes(drifter.pos, amount, 0.2, 0.8);
            events.push({
              type: 'event',
              tick: this.tick,
              name: 'drifter_drop',
              data: { drifter_id: drifter.id, amount },
            });
          }
        }
      }

      events.push({
        type: 'event',
        tick: this.tick,
        name: 'pulse',
        data: { stunned_ids: stunnedIds },
      });
    }

    // 8. Move Shades (with drain state & weak-lantern targeting) and Drifters
    const shadeSpeed = this.map.shadeSpeed;
    for (const shade of this.shades) {
      if (shade.safePushTicksLeft > 0) continue;
      if (shade.state === 'spawning') continue;

      if (shade.state === 'stunned') {
        if (shade.pulsePushTicksLeft > 0) {
          const stepDist = this.tuning.pulse_push_m / PULSE_PUSH_TICKS;
          const nextX = shade.pos[0] + shade.pulsePushDir[0] * stepDist;
          const nextZ = shade.pos[2] + shade.pulsePushDir[1] * stepDist;
          if (!this.moveShadeXZ(shade, nextX, nextZ)) {
            shade.pulsePushTicksLeft = 0;
          } else {
            shade.pulsePushTicksLeft -= 1;
          }
          this.clampShadeOutsideSafeZones(shade);
        }
        continue;
      }

      if (shade.state === 'recoil') {
        const stepDist = SHADE_RECOIL_DIST / SHADE_RECOIL_TICKS;
        const nextX = shade.pos[0] + shade.recoilDir[0] * stepDist;
        const nextZ = shade.pos[2] + shade.recoilDir[1] * stepDist;
        this.moveShadeXZ(shade, nextX, nextZ);
        this.clampShadeOutsideSafeZones(shade);
        continue;
      }

      const dToPlayer = dist3D(shade.pos, this.player.pos);

      // Handle drain state transitions
      if (shade.state === 'drain') {
        if (this.player.respawnTicks === 0 && dToPlayer <= SHADE_DRAIN_CHASE_RADIUS) {
          shade.state = 'chase';
          shade.targetLanternId = null;
          shade.drainTicks = 0;
        } else {
          const targetL = this.lanterns.find((l) => l.id === shade.targetLanternId);
          if (
            !targetL ||
            !targetL.lit ||
            targetL.fuelSixtieths >= FUEL_LOW_THRESHOLD_60 ||
            distXZ(shade.pos, targetL.pos) > SHADE_DRAIN_ENGAGE_RADIUS
          ) {
            shade.state = 'wander';
            shade.targetLanternId = null;
            shade.drainTicks = 0;
          } else {
            // Remain stationary while draining
            continue;
          }
        }
      }

      // Detection / Disengage (12m / 18m)
      if (this.player.respawnTicks > 0) {
        shade.state = 'wander';
      } else if (shade.state === 'wander' && dToPlayer <= SHADE_DETECT_RADIUS) {
        shade.state = 'chase';
        shade.targetLanternId = null;
      } else if (shade.state === 'chase' && dToPlayer > SHADE_DISENGAGE_RADIUS) {
        shade.state = 'wander';
      }

      if (shade.state === 'chase') {
        // Chase does NOT switch to weak lanterns
        const dx = this.player.pos[0] - shade.pos[0];
        const dz = this.player.pos[2] - shade.pos[2];
        const d = Math.hypot(dx, dz);
        if (d > 1e-6) {
          const stepDist = Math.min(d, shadeSpeed * DT);
          const nx = shade.pos[0] + (dx / d) * stepDist;
          const nz = shade.pos[2] + (dz / d) * stepDist;
          if (!this.moveShadeXZ(shade, nx, nz)) {
            if (!this.moveShadeXZ(shade, nx, shade.pos[2])) {
              this.moveShadeXZ(shade, shade.pos[0], nz);
            }
          }
        }
      } else {
        // Wander: prioritize nearest weak lit lantern (fuel < 30), else nearest unlit lantern
        const weakLantern = this.findNearestLantern(
          shade.pos,
          (l) => l.lit && l.fuelSixtieths < FUEL_LOW_THRESHOLD_60
        );
        if (weakLantern) {
          const dWeak = distXZ(shade.pos, weakLantern.pos);
          if (dWeak <= SHADE_DRAIN_ENGAGE_RADIUS) {
            shade.state = 'drain';
            shade.targetLanternId = weakLantern.id;
            shade.drainTicks = 0;
          } else {
            const dx = weakLantern.pos[0] - shade.pos[0];
            const dz = weakLantern.pos[2] - shade.pos[2];
            const stepDist = Math.min(dWeak, shadeSpeed * DT);
            const nx = shade.pos[0] + (dx / dWeak) * stepDist;
            const nz = shade.pos[2] + (dz / dWeak) * stepDist;
            if (!this.moveShadeXZ(shade, nx, nz)) {
              if (!this.moveShadeXZ(shade, nx, shade.pos[2])) {
                this.moveShadeXZ(shade, shade.pos[0], nz);
              }
            }
            if (distXZ(shade.pos, weakLantern.pos) <= SHADE_DRAIN_ENGAGE_RADIUS) {
              shade.state = 'drain';
              shade.targetLanternId = weakLantern.id;
              shade.drainTicks = 0;
            }
          }
        } else {
          const unlitLantern = this.findNearestLantern(shade.pos, (l) => !l.lit);
          if (unlitLantern && distXZ(shade.pos, unlitLantern.pos) > 2.5) {
            const dx = unlitLantern.pos[0] - shade.pos[0];
            const dz = unlitLantern.pos[2] - shade.pos[2];
            const d = Math.hypot(dx, dz);
            const wanderStep = Math.min(d, 1.8 * DT);
            const nx = shade.pos[0] + (dx / d) * wanderStep;
            const nz = shade.pos[2] + (dz / d) * wanderStep;
            if (!this.moveShadeXZ(shade, nx, nz)) {
              shade.wanderAngle += Math.PI * 0.5;
            }
          } else {
            shade.wanderTicksLeft -= 1;
            if (shade.wanderTicksLeft <= 0) {
              shade.wanderAngle = this.rng.range(0, Math.PI * 2);
              shade.wanderTicksLeft = 90 + Math.floor(this.rng.next() * 90);
            }
            const wanderStep = 1.6 * DT;
            const nx = shade.pos[0] + Math.cos(shade.wanderAngle) * wanderStep;
            const nz = shade.pos[2] + Math.sin(shade.wanderAngle) * wanderStep;
            if (!this.moveShadeXZ(shade, nx, nz)) {
              shade.wanderAngle += Math.PI * 0.75;
            }
          }
        }
      }

      this.clampShadeOutsideSafeZones(shade);
    }

    // Move Drifters
    for (let i = this.drifters.length - 1; i >= 0; i--) {
      const drifter = this.drifters[i];
      if (drifter.state === 'flee') {
        const dx = drifter.pos[0] - this.player.pos[0];
        const dz = drifter.pos[2] - this.player.pos[2];
        const d = Math.hypot(dx, dz);
        const nx = d < 1e-6 ? 1 : dx / d;
        const nz = d < 1e-6 ? 0 : dz / d;
        drifter.pos[0] += nx * DRIFTER_FLEE_SPEED * DT;
        drifter.pos[2] += nz * DRIFTER_FLEE_SPEED * DT;
        drifter.fleeTicksLeft -= 1;
        if (drifter.fleeTicksLeft <= 0) {
          this.drifters.splice(i, 1);
        }
        continue;
      }

      const dXZ = distXZ(drifter.pos, this.player.pos);
      const shouldChase =
        !drifter.hasStolen &&
        this.player.respawnTicks === 0 &&
        this.player.carried >= DRIFTER_TRIGGER_MIN_CARRIED &&
        dXZ <= DRIFTER_DETECT_RADIUS;

      if (drifter.state === 'idle' && shouldChase) {
        drifter.state = 'chase';
      } else if (drifter.state === 'chase' && !shouldChase) {
        drifter.state = 'idle';
      }

      if (drifter.state === 'chase') {
        const dx = this.player.pos[0] - drifter.pos[0];
        const dz = this.player.pos[2] - drifter.pos[2];
        const d = Math.hypot(dx, dz);
        if (d > 1e-6) {
          const stepDist = Math.min(d, DRIFTER_CHASE_SPEED * DT);
          drifter.pos[0] += (dx / d) * stepDist;
          drifter.pos[2] += (dz / d) * stepDist;
        }
        const targetY = this.player.pos[1] + 1.0;
        drifter.pos[1] += (targetY - drifter.pos[1]) * 0.12;
      } else {
        drifter.orbitAngle += 0.4 * DT;
        drifter.pos[0] += Math.cos(drifter.orbitAngle) * DRIFTER_IDLE_SPEED * DT;
        drifter.pos[2] += Math.sin(drifter.orbitAngle) * DRIFTER_IDLE_SPEED * DT;
      }
    }

    // 9. Collisions: Drifters steal FIRST, then Shades hit (sorted by ascending id)
    if (this.player.respawnTicks === 0) {
      const driftersById = [...this.drifters].sort(compareId);
      for (const drifter of driftersById) {
        if (drifter.spawnTick === this.simTick) continue;
        if (drifter.state !== 'chase' || drifter.hasStolen) continue;
        if (distXZ(drifter.pos, this.player.pos) <= DRIFTER_STEAL_RADIUS) {
          const amount = Math.min(DRIFTER_MAX_STEAL, this.player.carried);
          this.player.carried -= amount;
          drifter.stolen = amount;
          drifter.hasStolen = true;
          drifter.state = 'flee';
          drifter.fleeTicksLeft = DRIFTER_FLEE_TICKS;
          events.push({
            type: 'event',
            tick: this.tick,
            name: 'drifter_steal',
            data: {
              drifter_id: drifter.id,
              amount,
              carried: this.player.carried,
            },
          });
        }
      }

      if (this.player.invulnTicks === 0) {
        const shadesById = [...this.shades].sort(compareId);
        for (const shade of shadesById) {
          if (shade.spawnTick === this.simTick) continue;
          if (
            shade.state === 'stunned' ||
            shade.state === 'spawning' ||
            shade.state === 'recoil' ||
            shade.safePushTicksLeft > 0
          ) {
            continue;
          }
          if (
            distXZ(this.player.pos, shade.pos) <= this.tuning.shade_hit_radius &&
            Math.abs(this.player.pos[1] - shade.pos[1]) <= SHADE_HIT_HEIGHT_DIFF
          ) {
            this.player.flames = Math.max(0, this.player.flames - 1);
            this.player.invulnTicks = INVULN_TICKS;
            const dropped = Math.floor(this.player.carried * this.tuning.hit_drop_ratio);
            this.player.carried -= dropped;
            if (dropped > 0) {
              this.spawnDroppedMotes(this.player.pos, dropped, 1.5, 2.5);
            }

            const dx = shade.pos[0] - this.player.pos[0];
            const dz = shade.pos[2] - this.player.pos[2];
            const d = Math.hypot(dx, dz);
            shade.recoilDir = d < 1e-6 ? [1, 0] : [dx / d, dz / d];
            shade.state = 'recoil';
            shade.stateTicksLeft = SHADE_RECOIL_TICKS;
            shade.targetLanternId = null;
            shade.drainTicks = 0;

            events.push({
              type: 'event',
              tick: this.tick,
              name: 'player_hit',
              data: {
                by: 'shade',
                flames: this.player.flames,
                dropped,
              },
            });
            break;
          }
        }
      }
    }

    // 10. Scheduled spawns (interactable starting next tick)
    if (this.randomMotes && this.simTick > 0 && this.simTick % MOTE_SPAWN_INTERVAL_TICKS === 0) {
      this.spawnOneRandomMote();
    }

    if (this.randomShades) {
      if (this.simTick === 300) {
        this.spawnOneRandomShade(events);
        this.spawnOneRandomShade(events);
      } else if (
        this.simTick > 300 &&
        (this.simTick - 300) % this.map.shadeIntervalTicks === 0
      ) {
        this.spawnOneRandomShade(events);
      }
    }

    if (
      this.randomDrifters &&
      this.simTick > 0 &&
      this.simTick % DRIFTER_SPAWN_INTERVAL_TICKS === 0
    ) {
      this.spawnOneRandomDrifter();
    }

    // 11. Win / Loss check (Ticket-03: NO early all_lit win; no_flames checked first, then dawn)
    if (this.player.flames <= 0) {
      this.state = 'lost';
      this.lastGameOverReason = 'no_flames';
      events.push({
        type: 'event',
        tick: this.tick,
        name: 'game_over',
        data: { result: 'lost', reason: 'no_flames' },
      });
    } else if (this.timeLeftS <= 0) {
      const litLanterns = this.lanterns.filter((l) => l.lit);
      const threshold = this.getWinLanternThreshold();
      if (litLanterns.length >= threshold) {
        this.state = 'won';
        this.lastGameOverReason = 'dawn_survived';
        for (const l of litLanterns) {
          this.score += SCORE_DAWN_PER_LIT_BASE + Math.floor(l.fuelSixtieths / TICK_RATE);
        }
        this.score += this.player.flames * this.tuning.score.per_flame_left;
        events.push({
          type: 'event',
          tick: this.tick,
          name: 'game_over',
          data: { result: 'won', reason: 'dawn_survived' },
        });
      } else {
        this.state = 'lost';
        this.lastGameOverReason = 'dawn';
        events.push({
          type: 'event',
          tick: this.tick,
          name: 'game_over',
          data: { result: 'lost', reason: 'dawn' },
        });
      }
    }

    return events;
  }

  getGameOverReason(): GameOverReason | null {
    return this.lastGameOverReason;
  }

  getSnapshot(): SnapshotLine {
    return {
      type: 'snapshot',
      tick: this.tick,
      sim_tick: this.simTick,
      night: this.night,
      state: this.state,
      time_left_s: round3(this.timeLeftS),
      score: this.score,
      wind: {
        active: this.wind.active,
        dir_deg: round3(this.wind.dirDeg),
      },
      player: {
        pos: roundVec3(this.player.pos),
        vel: roundVec3(this.player.vel),
        grounded: this.player.grounded,
        flames: this.player.flames,
        carried: this.player.carried,
        capacity: this.getPlayerCapacity(),
        invuln: this.player.invulnTicks > 0,
        dash_cd_s: round3(this.player.dashCdTicks / TICK_RATE),
        pulse_cd_s: round3(this.player.pulseCdTicks / TICK_RATE),
        charm_s: round3(this.player.charmTicks / TICK_RATE),
      },
      lanterns: this.lanterns.map((l) => ({
        id: l.id,
        pos: roundVec3(l.pos),
        lit: l.lit,
        deposited: l.deposited,
        fuel: l.lit ? round1(l.fuelSixtieths / TICK_RATE) : 0,
        ever_lit: l.everLit,
        relit_count: l.relitCount,
      })),
      shades: this.shades.map((s) => ({
        id: s.id,
        pos: roundVec3(s.pos),
        state: s.state,
      })),
      motes_active: this.motes.length,
      motes: this.motes.map((m) => ({
        id: m.id,
        pos: roundVec3(m.pos),
        kind: m.kind,
        ttl_s: m.ttlTicks === null ? null : round3(m.ttlTicks / TICK_RATE),
      })),
      drifters: this.drifters.map((d) => ({
        id: d.id,
        pos: roundVec3(d.pos),
        state: d.state,
        stolen: d.stolen,
      })),
      charms: this.charms.map((c) => ({
        id: c.id,
        available: c.available,
        respawn_s: round3(c.respawnTicks / TICK_RATE),
      })),
    };
  }

  getEndLine(): EndLine {
    return {
      type: 'end',
      ticks: this.tick,
      state: this.state,
      score: this.score,
    };
  }
}
