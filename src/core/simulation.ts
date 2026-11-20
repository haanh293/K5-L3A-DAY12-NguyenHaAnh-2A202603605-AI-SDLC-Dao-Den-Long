import {
  DEFAULT_TUNING,
  DT,
  GRAVITY,
  ISLAND_RADIUS,
  JUMP_SPEED,
  TICK_RATE,
  getNight1LanternPositions,
  round3,
  roundVec3,
} from './config.js';
import { Mulberry32 } from './rng.js';
import type {
  EndLine,
  EventLine,
  GameState,
  GameTuning,
  LanternEntity,
  MoteEntity,
  PlayerEntity,
  ScenarioConfig,
  ShadeEntity,
  SnapshotLine,
  TickInputState,
  Vec3,
} from './types.js';

export interface SimulationOptions {
  seed: number;
  night?: number;
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
  };
}

function distXZ(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

export class GameSimulation {
  readonly tuning: GameTuning;
  readonly seed: number;
  readonly night: number;
  private rng: Mulberry32;

  tick = 0;
  simTick = 0;
  state: GameState = 'playing';
  score = 0;
  initialDurationS: number;
  timeLeftS: number;
  worldRadius: number = ISLAND_RADIUS;

  player: PlayerEntity;
  lanterns: LanternEntity[] = [];
  shades: ShadeEntity[] = [];
  motes: MoteEntity[] = [];

  private randomMotes = true;
  private randomShades = true;
  private nextMoteId = 1;
  private nextShadeId = 1;
  private prevInput: TickInputState = createDefaultInputState();
  private lastGameOverReason: 'all_lit' | 'dawn' | 'no_flames' | null = null;

  constructor(options: SimulationOptions) {
    this.seed = options.seed;
    this.night = options.night ?? 1;
    this.tuning = options.tuning ?? DEFAULT_TUNING;
    this.rng = new Mulberry32(this.seed);

    const scenario = options.scenario;
    this.initialDurationS =
      scenario?.time_left_s !== undefined
        ? scenario.time_left_s
        : this.tuning.night1_duration_s;
    this.timeLeftS = this.initialDurationS;

    this.randomMotes = scenario?.random_motes ?? true;
    this.randomShades = scenario?.random_shades ?? true;

    // Initialize player
    this.player = {
      pos: scenario?.player?.pos ? [...scenario.player.pos] : [0, 0, 0],
      vy: 0,
      grounded: (scenario?.player?.pos?.[1] ?? 0) <= 0,
      flames: scenario?.player?.flames ?? this.tuning.flames,
      carried: scenario?.player?.carried ?? 0,
      invulnTimer: 0,
      pulseCooldown: 0,
      facingYaw: 0,
    };

    // Initialize Night 1 lanterns
    this.lanterns = getNight1LanternPositions().map((l) => ({
      id: l.id,
      pos: [...l.pos],
      lit: false,
      deposited: 0,
    }));

    // Apply scenario lantern overrides (no events, no score)
    if (scenario?.lanterns) {
      for (const override of scenario.lanterns) {
        const existing = this.lanterns.find((l) => l.id === override.id);
        if (existing) {
          if (override.pos) existing.pos = [...override.pos];
          if (override.deposited !== undefined) existing.deposited = override.deposited;
          if (override.lit !== undefined) existing.lit = override.lit;
          if (existing.lit && existing.deposited < this.tuning.lantern_cost) {
            existing.deposited = this.tuning.lantern_cost;
          }
        } else {
          const lit = override.lit ?? false;
          const deposited =
            override.deposited ?? (lit ? this.tuning.lantern_cost : 0);
          this.lanterns.push({
            id: override.id,
            pos: override.pos ? [...override.pos] : [0, 0, 0],
            lit,
            deposited,
          });
        }
      }
    }

    // Apply scenario motes or spawn initial random motes
    if (scenario?.motes !== undefined) {
      for (const m of scenario.motes) {
        if (Array.isArray(m)) {
          this.motes.push({
            id: `M${this.nextMoteId++}`,
            pos: [m[0], m[1], m[2]],
          });
        } else {
          this.motes.push({
            id: m.id ?? `M${this.nextMoteId++}`,
            pos: [...m.pos],
          });
        }
      }
    } else if (this.randomMotes) {
      for (let i = 0; i < 10; i++) {
        this.spawnRandomMote();
      }
    }

    // Apply scenario shades or spawn initial random shade
    if (scenario?.shades !== undefined) {
      for (const s of scenario.shades) {
        const id = s.id ?? `S${this.nextShadeId++}`;
        // Ensure nextShadeId stays above numeric S<n> ids
        const match = /^S(\d+)$/.exec(id);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num >= this.nextShadeId) this.nextShadeId = num + 1;
        }
        this.shades.push({
          id,
          pos: [...s.pos],
          state: s.state ?? 'chase',
          stunTimer: 0,
        });
      }
    } else if (this.randomShades) {
      this.spawnRandomShade(false);
    }

    // Expand world boundary if scenario places entities beyond default island radius
    let maxDist = ISLAND_RADIUS;
    const checkPos = (p: Vec3) => {
      const d = Math.hypot(p[0], p[2]);
      if (d + 10 > maxDist) maxDist = d + 10;
    };
    checkPos(this.player.pos);
    for (const l of this.lanterns) checkPos(l.pos);
    for (const m of this.motes) checkPos(m.pos);
    for (const s of this.shades) checkPos(s.pos);
    this.worldRadius = maxDist;
  }

  private spawnRandomMote(): void {
    const angle = this.rng.range(0, Math.PI * 2);
    const radius = Math.sqrt(this.rng.next()) * (ISLAND_RADIUS - 4);
    const x = round3(Math.cos(angle) * radius);
    const z = round3(Math.sin(angle) * radius);
    this.motes.push({
      id: `M${this.nextMoteId++}`,
      pos: [x, 0, z],
    });
  }

  private spawnRandomShade(emitEvent: boolean, events?: EventLine[]): void {
    const angle = this.rng.range(0, Math.PI * 2);
    const radius = ISLAND_RADIUS - 3;
    const x = round3(Math.cos(angle) * radius);
    const z = round3(Math.sin(angle) * radius);
    const shade: ShadeEntity = {
      id: `S${this.nextShadeId++}`,
      pos: [x, 0, z],
      state: 'chase',
      stunTimer: 0,
    };
    this.enforceSafeRadius(shade);
    this.shades.push(shade);
    if (emitEvent && events) {
      events.push({
        type: 'event',
        tick: this.tick,
        name: 'shade_spawned',
        data: { id: shade.id },
      });
    }
  }

  private enforceSafeRadius(shade: ShadeEntity): void {
    const safeR = this.tuning.safe_radius;
    if (safeR <= 0) return;
    for (const lantern of this.lanterns) {
      if (!lantern.lit) continue;
      const dx = shade.pos[0] - lantern.pos[0];
      const dz = shade.pos[2] - lantern.pos[2];
      const d = Math.hypot(dx, dz);
      if (d <= safeR) {
        const pushTarget = safeR + 0.05;
        if (d < 1e-6) {
          shade.pos[0] = lantern.pos[0] + pushTarget;
        } else {
          const scale = pushTarget / d;
          shade.pos[0] = lantern.pos[0] + dx * scale;
          shade.pos[2] = lantern.pos[2] + dz * scale;
        }
      }
    }
  }

  /**
   * Advances simulation by exactly 1 tick (1/60 s).
   * Returns all events emitted during this step (with tick = this.tick).
   */
  step(input: TickInputState): EventLine[] {
    if (this.state !== 'playing') {
      return [];
    }

    const events: EventLine[] = [];

    this.tick += 1;
    this.simTick += 1;
    this.timeLeftS = Math.max(0, this.initialDurationS - this.simTick / TICK_RATE);

    // Rising edge button detection
    const jumpPressed = input.jump && !this.prevInput.jump;
    const interactPressed = input.interact && !this.prevInput.interact;
    const pulsePressed = input.pulse && !this.prevInput.pulse;
    this.prevInput = {
      move: [input.move[0], input.move[1]],
      cam_yaw_deg: input.cam_yaw_deg,
      jump: input.jump,
      interact: input.interact,
      pulse: input.pulse,
      dash: input.dash,
    };

    // Decrement cooldowns/timers
    if (this.player.invulnTimer > 0) {
      this.player.invulnTimer = Math.max(0, this.player.invulnTimer - DT);
    }
    if (this.player.pulseCooldown > 0) {
      this.player.pulseCooldown = Math.max(0, this.player.pulseCooldown - DT);
    }

    // 1. Player horizontal movement (camera-relative XZ)
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

    if (Math.hypot(wx, wz) > 1e-6) {
      this.player.pos[0] += wx * this.tuning.player_speed * DT;
      this.player.pos[2] += wz * this.tuning.player_speed * DT;
      this.player.facingYaw = Math.atan2(wx, wz);
    }

    // Clamp to island boundary (fall_enabled is false)
    if (!this.tuning.fall_enabled) {
      const pDist = Math.hypot(this.player.pos[0], this.player.pos[2]);
      if (pDist > this.worldRadius) {
        const s = this.worldRadius / pDist;
        this.player.pos[0] *= s;
        this.player.pos[2] *= s;
      }
    }

    // 2. Player vertical movement (jump & gravity)
    if (jumpPressed && this.player.grounded) {
      this.player.vy = JUMP_SPEED;
      this.player.grounded = false;
    }
    if (!this.player.grounded || this.player.vy !== 0) {
      this.player.pos[1] += this.player.vy * DT;
      this.player.vy -= GRAVITY * DT;
      if (this.player.pos[1] <= 0) {
        this.player.pos[1] = 0;
        this.player.vy = 0;
        this.player.grounded = true;
      }
    }

    // 3. Auto-pickup motes (XZ distance <= pickup_radius)
    if (this.player.carried < this.tuning.carry_capacity) {
      for (let i = 0; i < this.motes.length; ) {
        if (this.player.carried >= this.tuning.carry_capacity) break;
        const m = this.motes[i];
        if (distXZ(this.player.pos, m.pos) <= this.tuning.pickup_radius) {
          this.motes.splice(i, 1);
          this.player.carried += 1;
          this.score += this.tuning.score.per_mote;
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

    // 4. Interact: deposit carried motes into nearest unlit lantern within interact_radius
    if (interactPressed && this.player.carried > 0) {
      let bestLantern: LanternEntity | null = null;
      let bestDist = Infinity;
      for (const lantern of this.lanterns) {
        if (lantern.lit) continue;
        const d = distXZ(this.player.pos, lantern.pos);
        if (d <= this.tuning.interact_radius && d < bestDist) {
          bestDist = d;
          bestLantern = lantern;
        }
      }

      if (bestLantern) {
        const needed = Math.max(0, this.tuning.lantern_cost - bestLantern.deposited);
        const amount = Math.min(this.player.carried, needed);
        if (amount > 0) {
          this.player.carried -= amount;
          bestLantern.deposited += amount;
          events.push({
            type: 'event',
            tick: this.tick,
            name: 'deposit',
            data: {
              lantern_id: bestLantern.id,
              amount,
              deposited: bestLantern.deposited,
            },
          });

          if (bestLantern.deposited >= this.tuning.lantern_cost) {
            bestLantern.lit = true;
            this.score += this.tuning.score.per_lantern;
            events.push({
              type: 'event',
              tick: this.tick,
              name: 'lantern_lit',
              data: { lantern_id: bestLantern.id },
            });
            // Push any shades out of the newly lit lantern's safe radius
            for (const shade of this.shades) {
              this.enforceSafeRadius(shade);
            }
          }
        }
      }
    }

    // 5. Pulse: spend pulse_cost motes to stun & push shades within pulse_radius
    if (
      pulsePressed &&
      this.player.pulseCooldown <= 0 &&
      this.player.carried >= this.tuning.pulse_cost
    ) {
      this.player.carried -= this.tuning.pulse_cost;
      this.player.pulseCooldown = this.tuning.pulse_cooldown_s;
      const stunnedIds: string[] = [];

      for (const shade of this.shades) {
        const dx = shade.pos[0] - this.player.pos[0];
        const dz = shade.pos[2] - this.player.pos[2];
        const d = Math.hypot(dx, dz);
        if (d <= this.tuning.pulse_radius) {
          shade.state = 'stunned';
          shade.stunTimer = this.tuning.pulse_stun_s;
          if (d < 1e-6) {
            shade.pos[0] += this.tuning.pulse_push_m;
          } else {
            shade.pos[0] += (dx / d) * this.tuning.pulse_push_m;
            shade.pos[2] += (dz / d) * this.tuning.pulse_push_m;
          }
          this.enforceSafeRadius(shade);
          stunnedIds.push(shade.id);
          this.score += this.tuning.score.per_stun;
        }
      }

      events.push({
        type: 'event',
        tick: this.tick,
        name: 'pulse',
        data: { stunned_ids: stunnedIds },
      });
    }

    // 6. Update shades (stun timers, chase player, respect safe_radius, hit player)
    for (const shade of this.shades) {
      if (shade.state === 'stunned') {
        shade.stunTimer = Math.max(0, shade.stunTimer - DT);
        if (shade.stunTimer <= 0) {
          shade.state = 'chase';
        }
        continue;
      }

      const dx = this.player.pos[0] - shade.pos[0];
      const dz = this.player.pos[2] - shade.pos[2];
      const d = Math.hypot(dx, dz);
      if (d > 1e-6) {
        const stepDist = Math.min(d, this.tuning.shade_speed * DT);
        shade.pos[0] += (dx / d) * stepDist;
        shade.pos[2] += (dz / d) * stepDist;
      }

      this.enforceSafeRadius(shade);

      // Check hit against player (horizontal XZ distance <= shade_hit_radius)
      if (
        this.player.invulnTimer <= 0 &&
        distXZ(this.player.pos, shade.pos) <= this.tuning.shade_hit_radius
      ) {
        this.player.flames = Math.max(0, this.player.flames - 1);
        this.player.invulnTimer = this.tuning.invuln_s;
        const dropped =
          this.player.carried > 0 && this.tuning.hit_drop_ratio > 0
            ? Math.min(
                this.player.carried,
                Math.round(this.player.carried * this.tuning.hit_drop_ratio)
              )
            : 0;
        this.player.carried -= dropped;

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
      }
    }

    // 7. Deterministic random spawns (when enabled)
    if (this.randomMotes && this.simTick % 240 === 0 && this.motes.length < 14) {
      this.spawnRandomMote();
    }
    if (this.randomShades && this.simTick % 1200 === 0 && this.shades.length < 3) {
      this.spawnRandomShade(true, events);
    }

    // 8. Check win / loss conditions
    const allLit = this.lanterns.length > 0 && this.lanterns.every((l) => l.lit);
    if (allLit) {
      this.state = 'won';
      this.lastGameOverReason = 'all_lit';
      const timeBonus = Math.floor(this.timeLeftS) * this.tuning.score.per_second_left;
      const flameBonus = this.player.flames * this.tuning.score.per_flame_left;
      this.score += timeBonus + flameBonus;
      events.push({
        type: 'event',
        tick: this.tick,
        name: 'game_over',
        data: { result: 'won', reason: 'all_lit' },
      });
    } else if (this.player.flames <= 0) {
      this.state = 'lost';
      this.lastGameOverReason = 'no_flames';
      events.push({
        type: 'event',
        tick: this.tick,
        name: 'game_over',
        data: { result: 'lost', reason: 'no_flames' },
      });
    } else if (this.timeLeftS <= 0) {
      this.state = 'lost';
      this.lastGameOverReason = 'dawn';
      events.push({
        type: 'event',
        tick: this.tick,
        name: 'game_over',
        data: { result: 'lost', reason: 'dawn' },
      });
    }

    return events;
  }

  getGameOverReason(): 'all_lit' | 'dawn' | 'no_flames' | null {
    return this.lastGameOverReason;
  }

  getSnapshot(): SnapshotLine {
    return {
      type: 'snapshot',
      tick: this.tick,
      sim_tick: this.simTick,
      state: this.state,
      time_left_s: round3(this.timeLeftS),
      score: this.score,
      player: {
        pos: roundVec3(this.player.pos),
        flames: this.player.flames,
        carried: this.player.carried,
      },
      lanterns: this.lanterns.map((l) => ({
        id: l.id,
        pos: roundVec3(l.pos),
        lit: l.lit,
        deposited: l.deposited,
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
      })),
    };
  }

  getEndLine(): EndLine {
    return {
      type: 'end',
      ticks: this.simTick,
      state: this.state,
      score: this.score,
    };
  }
}
