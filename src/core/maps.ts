import { round3 } from './config.js';
import type { NightNumber, Vec3 } from './types.js';

export interface JumpPadDef {
  pos: Vec3;
  radius: number;
  vy: number;
  horizVel: [number, number];
}

export interface RampDef {
  angleDeg: number;
  rStart: number; // outer foot (Y=0)
  rEnd: number; // inner top (Y=3)
  yStart: number;
  yEnd: number;
  halfWidth: number;
}

export interface NightMapDef {
  night: NightNumber;
  name: string;
  introQuote: string;
  durationS: number;
  spawnPos: Vec3;
  spawnYaw: number;
  lanterns: Array<{ id: string; pos: Vec3 }>;
  moteSpawnPoints: Vec3[];
  shadeSpawnPoints: Vec3[];
  shadeIntervalTicks: number;
  shadeMaxCount: number;
  shadeSpeed: number;
  charms: Array<{ id: string; pos: Vec3 }>;
  jumpPads: JumpPadDef[];
  driftersEnabled: boolean;
  windEnabled: boolean;
  ramps: RampDef[];
}

function polarXZ(
  cx: number,
  cz: number,
  radius: number,
  deg: number,
  y = 0
): Vec3 {
  const rad = (deg * Math.PI) / 180;
  return [round3(cx + Math.cos(rad) * radius), y, round3(cz + Math.sin(rad) * radius)];
}

function buildNight1Map(): NightMapDef {
  const moteSpawnPoints: Vec3[] = [];
  for (let i = 0; i < 8; i++) moteSpawnPoints.push(polarXZ(0, 0, 12, i * 45, 0));
  for (let i = 0; i < 16; i++) moteSpawnPoints.push(polarXZ(0, 0, 33, i * 22.5, 0));

  const shadeSpawnPoints: Vec3[] = [];
  for (let i = 0; i < 12; i++) shadeSpawnPoints.push(polarXZ(0, 0, 37, 15 + i * 30, 0));

  return {
    night: 1,
    name: 'Đêm 1 — Đảo Bến',
    introQuote:
      'Ông Đăng dặn: "Đảo Bến là cửa ngõ biển mây. Hãy thắp lại 5 Đèn Lồng Lớn, sương đen sẽ tự lùi bước."',
    durationS: 300,
    spawnPos: [0, 0, 0],
    spawnYaw: 0, // facing +Z
    lanterns: [
      { id: 'L1', pos: [0, 0, 25] },
      { id: 'L2', pos: [23.8, 0, 7.7] },
      { id: 'L3', pos: [14.7, 0, -20.2] },
      { id: 'L4', pos: [-14.7, 0, -20.2] },
      { id: 'L5', pos: [-23.8, 0, 7.7] },
    ],
    moteSpawnPoints,
    shadeSpawnPoints,
    shadeIntervalTicks: 480, // 8s
    shadeMaxCount: 6,
    shadeSpeed: 4.0,
    charms: [],
    jumpPads: [],
    driftersEnabled: false,
    windEnabled: false,
    ramps: [],
  };
}

function buildNight2Map(): NightMapDef {
  const moteSpawnPoints: Vec3[] = [];
  for (const cx of [0, 70]) {
    for (let i = 0; i < 4; i++) moteSpawnPoints.push(polarXZ(cx, 0, 10, i * 90, 0));
    for (let i = 0; i < 8; i++) moteSpawnPoints.push(polarXZ(cx, 0, 22, i * 45, 0));
  }

  const shadeSpawnPoints: Vec3[] = [];
  for (const cx of [0, 70]) {
    for (let i = 0; i < 8; i++) shadeSpawnPoints.push(polarXZ(cx, 0, 26, 22.5 + i * 45, 0));
  }

  // Jump pad A (20,0,18) -> island B center (70,0,0), speed 24 m/s, vy 14 m/s
  const dxAB = 70 - 20;
  const dzAB = 0 - 18;
  const lenAB = Math.hypot(dxAB, dzAB);

  // Jump pad B (50,0,-18) -> island A center (0,0,0), speed 24 m/s, vy 14 m/s
  const dxBA = 0 - 50;
  const dzBA = 0 - -18;
  const lenBA = Math.hypot(dxBA, dzBA);

  return {
    night: 2,
    name: 'Đêm 2 — Đảo Cau',
    introQuote:
      'Ông Đăng nói: "Cầu tre Đảo Cau không có lan can, lại có Gió Lạc rình cướp ánh sáng. Hãy tận dụng Bùa Gió và bục nhảy nhé Mây!"',
    durationS: 330,
    spawnPos: [0, 0, 0],
    spawnYaw: 0,
    lanterns: [
      { id: 'L1', pos: [0, 0, 20] },
      { id: 'L2', pos: [17, 0, -10] },
      { id: 'L3', pos: [-17, 0, -10] },
      { id: 'L4', pos: [70, 0, 20] },
      { id: 'L5', pos: [87, 0, -10] },
      { id: 'L6', pos: [53, 0, -10] },
    ],
    moteSpawnPoints,
    shadeSpawnPoints,
    shadeIntervalTicks: 420, // 7s
    shadeMaxCount: 8,
    shadeSpeed: 4.0,
    charms: [{ id: 'C1', pos: [35, 0, 0] }],
    jumpPads: [
      {
        pos: [20, 0, 18],
        radius: 1.0,
        vy: 14.0,
        horizVel: [(dxAB / lenAB) * 24.0, (dzAB / lenAB) * 24.0],
      },
      {
        pos: [50, 0, -18],
        radius: 1.0,
        vy: 14.0,
        horizVel: [(dxBA / lenBA) * 24.0, (dzBA / lenBA) * 24.0],
      },
    ],
    driftersEnabled: true,
    windEnabled: false,
    ramps: [],
  };
}

function buildNight3Map(): NightMapDef {
  const moteSpawnPoints: Vec3[] = [];
  // Tier 0 (Y=0): 18 points on r=34 every 20 deg from 0
  for (let i = 0; i < 18; i++) moteSpawnPoints.push(polarXZ(0, 0, 34, i * 20, 0));
  // Tier 1 (Y=3): 8 points on r=18 at 20, 40, ..., 160 deg
  for (let i = 1; i <= 8; i++) moteSpawnPoints.push(polarXZ(0, 0, 18, i * 20, 3));
  // Tier 2 (Y=6): 4 points on r=5 at 45, 135, 225, 315 deg
  for (const deg of [45, 135, 225, 315]) moteSpawnPoints.push(polarXZ(0, 0, 5, deg, 6));

  const shadeSpawnPoints: Vec3[] = [];
  for (let i = 0; i < 16; i++) shadeSpawnPoints.push(polarXZ(0, 0, 43, i * 22.5, 0));

  return {
    night: 3,
    name: 'Đêm 3 — Đảo Chuông',
    introQuote:
      'Ông Đăng khẽ bảo: "Trên đỉnh Đảo Chuông gió thổi rất mạnh và Bóng Mực nhanh hơn. Thắp đủ 7 Đèn Lồng, bình minh sẽ trở về!"',
    durationS: 360,
    spawnPos: [0, 0, -15], // Open Tier 0 ground facing +Z toward Tier 2/1 & Bell Tower
    spawnYaw: 0,
    lanterns: [
      { id: 'L1', pos: [0, 6, 6] },
      { id: 'L2', pos: [18, 3, 10] },
      { id: 'L3', pos: [-18, 3, 10] },
      { id: 'L4', pos: [35, 0, -10] },
      { id: 'L5', pos: [-35, 0, -10] },
      { id: 'L6', pos: [20, 0, -35] },
      { id: 'L7', pos: [-20, 0, -35] },
    ],
    moteSpawnPoints,
    shadeSpawnPoints,
    shadeIntervalTicks: 360, // 6s
    shadeMaxCount: 10,
    shadeSpeed: 4.5,
    charms: [
      { id: 'C1', pos: [30, 0, 25] },
      { id: 'C2', pos: [-30, 0, 25] },
    ],
    jumpPads: [
      {
        pos: [0, 3, 13],
        radius: 1.0,
        vy: 12.0,
        horizVel: [0, -8.0],
      },
    ],
    driftersEnabled: true,
    windEnabled: true,
    ramps: [
      { angleDeg: 30, rStart: 30, rEnd: 24, yStart: 0, yEnd: 3, halfWidth: 1.5 },
      { angleDeg: 150, rStart: 30, rEnd: 24, yStart: 0, yEnd: 3, halfWidth: 1.5 },
    ],
  };
}

const MAPS: Record<NightNumber, NightMapDef> = {
  1: buildNight1Map(),
  2: buildNight2Map(),
  3: buildNight3Map(),
};

export function getNightMap(night: NightNumber): NightMapDef {
  return MAPS[night];
}

export function getRampHeightAt(x: number, z: number, ramps: RampDef[]): number | null {
  for (const ramp of ramps) {
    const rad = (ramp.angleDeg * Math.PI) / 180;
    const ux = Math.cos(rad);
    const uz = Math.sin(rad);
    const tx = -uz;
    const tz = ux;
    const s = x * ux + z * uz;
    const p = Math.abs(x * tx + z * tz);
    if (s >= ramp.rEnd && s <= ramp.rStart && p <= ramp.halfWidth) {
      const t = (ramp.rStart - s) / (ramp.rStart - ramp.rEnd);
      return ramp.yStart + t * (ramp.yEnd - ramp.yStart);
    }
  }
  return null;
}

/**
 * Returns the solid terrain surface elevation Y at horizontal (x, z),
 * or null if (x, z) is over the cloud sea void.
 */
export function getTerrainHeight(night: NightNumber, x: number, z: number): number | null {
  if (night === 1) {
    return Math.hypot(x, z) <= 40 ? 0 : null;
  }

  if (night === 2) {
    const onA = Math.hypot(x, z) <= 28;
    const onB = Math.hypot(x - 70, z) <= 28;
    const onBridge = x >= 26 && x <= 44 && z >= -2 && z <= 2;
    return onA || onB || onBridge ? 0 : null;
  }

  // Night 3: Đảo Chuông
  const r = Math.hypot(x, z);
  if (r > 45) return null;

  // Tier 2 disc: r <= 8, Y = 6
  if (r <= 8) return 6;

  // Tier 1 annulus: 12 <= r <= 24, z > 0, Y = 3
  if (r >= 12 && r <= 24 && z > 0) return 3;

  // Ramps connecting r=30 (Y=0) to r=24 (Y=3) at 30 deg & 150 deg
  const rampY = getRampHeightAt(x, z, MAPS[3].ramps);
  if (rampY !== null) return rampY;

  // Tier 0: full island r <= 45, Y = 0
  return 0;
}

/**
 * Checks whether horizontal position (x, z) is inside an impassable solid obstacle
 * (Bell Tower on Night 3: cylinder radius 2m at center of Tier 2).
 */
export function isBlockedByObstacle(night: NightNumber, x: number, z: number): boolean {
  if (night === 3) {
    return Math.hypot(x, z) < 2.0;
  }
  return false;
}

/**
 * Resolves horizontal movement against vertical cliff walls and solid obstacles.
 * Entities can walk up gentle slopes (stepHeight <= 0.65m per tick) and step off cliffs,
 * but cannot walk horizontally into vertical walls higher than currentY + 0.65m.
 */
export function resolveHorizontalMove(
  night: NightNumber,
  prevX: number,
  prevZ: number,
  nextX: number,
  nextZ: number,
  currentY: number
): [number, number] {
  const canOccupy = (x: number, z: number): boolean => {
    if (isBlockedByObstacle(night, x, z)) return false;
    const h = getTerrainHeight(night, x, z);
    if (h === null) return true; // Walking off edge into void is allowed (player falls)
    return h <= currentY + 0.65;
  };

  if (canOccupy(nextX, nextZ)) {
    return [nextX, nextZ];
  }
  // Wall slide fallback
  if (canOccupy(nextX, prevZ)) {
    return [nextX, prevZ];
  }
  if (canOccupy(prevX, nextZ)) {
    return [prevX, nextZ];
  }
  return [prevX, prevZ];
}
