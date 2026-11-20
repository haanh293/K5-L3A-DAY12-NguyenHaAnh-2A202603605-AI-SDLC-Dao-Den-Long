import { DT, TICK_RATE, round1 } from '../core/config.js';
import {
  addLeaderboardEntry,
  formatIsoWithOffset,
  isValidLeaderboardName,
  sortAndTrimLeaderboard,
  type LeaderboardEntry,
} from '../core/leaderboard.js';
import { getNightMap } from '../core/maps.js';
import { Mulberry32 } from '../core/rng.js';
import { GameSimulation, createDefaultInputState } from '../core/simulation.js';
import type { EventLine, NightNumber, TickInputState } from '../core/types.js';
import { SoundEffects } from './audio.js';
import { LanternIslandScene } from './scene.js';

type ActionKey =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'jump'
  | 'dash'
  | 'interact'
  | 'pulse'
  | 'pause';

type KeyBindings = Record<ActionKey, string>;

const DEFAULT_KEYBINDS: KeyBindings = {
  up: 'KeyW',
  down: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  jump: 'Space',
  dash: 'ShiftLeft',
  interact: 'KeyE',
  pulse: 'KeyF',
  pause: 'Escape',
};

const ACTION_LABELS: Record<ActionKey, string> = {
  up: 'Tiến',
  down: 'Lùi',
  left: 'Trái',
  right: 'Phải',
  jump: 'Nhảy',
  dash: 'Lướt',
  interact: 'Tương tác',
  pulse: 'Tỏa Sáng',
  pause: 'Tạm dừng',
};

interface UserSettings {
  volume: number;
  sensitivity: number;
  colorblind: boolean;
  reducedMotion: boolean;
  largeText: boolean;
  keybinds: KeyBindings;
}

const SETTINGS_KEY = 'dao_den_long_settings_v2';
const LB_LOCAL_KEY = 'dao_den_long_leaderboard_v1';

function formatKeyCode(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'Shift';
  if (code === 'Escape') return 'Esc';
  return code;
}

function loadSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<UserSettings>;
      return {
        volume: typeof parsed.volume === 'number' ? parsed.volume : 70,
        sensitivity: typeof parsed.sensitivity === 'number' ? parsed.sensitivity : 0.4,
        colorblind: Boolean(parsed.colorblind),
        reducedMotion: Boolean(parsed.reducedMotion),
        largeText: Boolean(parsed.largeText),
        keybinds: { ...DEFAULT_KEYBINDS, ...(parsed.keybinds ?? {}) },
      };
    }
  } catch {
    // ignore
  }
  return {
    volume: 70,
    sensitivity: 0.4,
    colorblind: false,
    reducedMotion: false,
    largeText: false,
    keybinds: { ...DEFAULT_KEYBINDS },
  };
}

function saveSettings(s: UserSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const resp = await fetch('/api/leaderboard');
    if (resp.ok) {
      const data = (await resp.json()) as { entries: LeaderboardEntry[] };
      const sorted = sortAndTrimLeaderboard(data.entries ?? []);
      localStorage.setItem(LB_LOCAL_KEY, JSON.stringify(sorted));
      return sorted;
    }
  } catch {
    // Fallback to localStorage if static hosting without API server
  }
  try {
    const raw = localStorage.getItem(LB_LOCAL_KEY);
    if (raw) return sortAndTrimLeaderboard(JSON.parse(raw) as LeaderboardEntry[]);
  } catch {
    // ignore
  }
  return [];
}

async function saveLeaderboardScore(entry: LeaderboardEntry): Promise<LeaderboardEntry[]> {
  try {
    const resp = await fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    if (resp.ok) {
      const data = (await resp.json()) as { entries: LeaderboardEntry[] };
      const sorted = sortAndTrimLeaderboard(data.entries ?? []);
      localStorage.setItem(LB_LOCAL_KEY, JSON.stringify(sorted));
      return sorted;
    }
  } catch {
    // Fallback to localStorage
  }
  const current = await fetchLeaderboard();
  const updated = addLeaderboardEntry(current, entry);
  localStorage.setItem(LB_LOCAL_KEY, JSON.stringify(updated));
  return updated;
}

// =====================================================================
// BENCHMARK MODE (?bench=1&seed=42&duration=30&start=...)
// =====================================================================
function runBenchmarkMode(params: URLSearchParams): void {
  const seed = parseInt(params.get('seed') ?? '42', 10);
  const durationS = Math.max(1, parseFloat(params.get('duration') ?? '30'));
  const startEpoch = parseInt(params.get('start') ?? String(Date.now()), 10);

  // Hide all menus & HUD in standard bench scene
  document.getElementById('screen-menu')?.classList.add('hidden');
  document.getElementById('hud')?.classList.add('hidden');

  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const scene = new LanternIslandScene(canvas, { benchMode: true });
  const rng = new Mulberry32(seed);

  // Generate exact 200 wander Shades spread evenly on Night 1 island (r <= 38)
  const benchShades = [];
  for (let i = 0; i < 200; i++) {
    const angle = rng.range(0, Math.PI * 2);
    const radius = Math.sqrt(rng.next()) * 37;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    benchShades.push({ id: `S${i + 1}`, pos: [x, 0.8, z] as [number, number, number], state: 'wander' as const });
  }

  // Generate exact 100 motes spread on Night 1 island
  const benchMotes = [];
  for (let i = 0; i < 100; i++) {
    const angle = rng.range(0, Math.PI * 2);
    const radius = Math.sqrt(rng.next()) * 36;
    benchMotes.push([Math.cos(angle) * radius, 0, Math.sin(angle) * radius] as [number, number, number]);
  }

  // Night 1 with L1..L3 lit fuel 100; spawning, damage, pickup, fuel decay & night end disabled in bench loop
  const sim = new GameSimulation({
    seed,
    night: 1,
    scenario: {
      player: { pos: [0, 0, 0], carried: 0, flames: 3 },
      random_motes: false,
      random_shades: false,
      motes: benchMotes,
      shades: benchShades,
      lanterns: [
        { id: 'L1', lit: true, fuel: 100 },
        { id: 'L2', lit: true, fuel: 100 },
        { id: 'L3', lit: true, fuel: 100 },
        { id: 'L4', lit: false },
        { id: 'L5', lit: false },
      ],
      time_left_s: 9999,
    },
  });

  // Bench wander tick updater (moves 200 wander shades without decay/damage/pickup/end)
  function stepBenchShades(): void {
    const stepLen = 1.6 * DT;
    for (const s of sim.shades) {
      s.wanderTicksLeft -= 1;
      if (s.wanderTicksLeft <= 0) {
        s.wanderAngle = rng.range(0, Math.PI * 2);
        s.wanderTicksLeft = 90 + Math.floor(rng.next() * 90);
      }
      const nx = s.pos[0] + Math.cos(s.wanderAngle) * stepLen;
      const nz = s.pos[2] + Math.sin(s.wanderAngle) * stepLen;
      if (Math.hypot(nx, nz) <= 39) {
        s.pos[0] = nx;
        s.pos[2] = nz;
      } else {
        s.wanderAngle += Math.PI * 0.75;
      }
      // Keep outside lit L1-L3 safe radius (6m)
      for (let li = 0; li < 3; li++) {
        const l = sim.lanterns[li];
        const dx = s.pos[0] - l.pos[0];
        const dz = s.pos[2] - l.pos[2];
        const d = Math.hypot(dx, dz);
        if (d < 6.0 && d > 1e-6) {
          s.pos[0] = l.pos[0] + (dx / d) * 6.02;
          s.pos[2] = l.pos[2] + (dz / d) * 6.02;
        }
      }
    }
  }

  let firstFrameRecorded = false;
  let loadMs = 0;
  let startTime = 0;
  let lastFrame = 0;
  let accum = 0;
  let finished = false;
  const frameDts: number[] = [];
  const WARMUP_S = 3.0;

  function benchLoop(now: number): void {
    if (finished) return;
    if (!firstFrameRecorded) {
      firstFrameRecorded = true;
      loadMs = Math.max(1, Date.now() - startEpoch);
      startTime = now;
      lastFrame = now;
      scene.syncBench(sim, 0, 0);
      requestAnimationFrame(benchLoop);
      return;
    }

    const dtMs = Math.max(0.05, now - lastFrame);
    lastFrame = now;
    const dtSec = Math.min(0.1, dtMs / 1000);
    const elapsedS = (now - startTime) / 1000;

    accum += dtSec;
    while (accum >= DT) {
      stepBenchShades();
      accum -= DT;
    }

    // Camera orbit: starts at 0 deg (30,15,0), 15s per CCW revolution
    const orbitAngle = (elapsedS / 15.0) * Math.PI * 2;
    scene.syncBench(sim, orbitAngle, dtSec);

    if (elapsedS >= WARMUP_S) {
      frameDts.push(dtMs);
    }

    if (elapsedS >= WARMUP_S + durationS) {
      finished = true;
      const n = frameDts.length;
      const sumDt = frameDts.reduce((acc, v) => acc + v, 0);
      const avgFps = sumDt > 0 ? (1000 * n) / sumDt : 0;

      const sortedDesc = [...frameDts].sort((a, b) => b - a);
      const k = Math.max(1, Math.ceil(0.01 * n));
      const worstMean = sortedDesc.slice(0, k).reduce((acc, v) => acc + v, 0) / k;
      const p1LowFps = worstMean > 0 ? 1000 / worstMean : 0;

      const sortedAsc = [...frameDts].sort((a, b) => a - b);
      const p95Idx = Math.min(n - 1, Math.floor(0.95 * (n - 1)));
      const p95Ms = sortedAsc[p95Idx] ?? 0;

      const payload = {
        avg_fps: round1(avgFps),
        p1_low_fps: round1(p1LowFps),
        frame_ms_p95: round1(p95Ms),
        frames: n,
        load_ms: loadMs,
        renderer: scene.getRendererInfo(),
      };

      void fetch('/api/bench-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      return;
    }

    requestAnimationFrame(benchLoop);
  }

  requestAnimationFrame(benchLoop);
}

// Check if launched in Benchmark Mode
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('bench') === '1') {
  runBenchmarkMode(urlParams);
} else {
  runNormalGame();
}

// =====================================================================
// NORMAL GAMEPLAY MODE
// =====================================================================
function runNormalGame(): void {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const hitFlash = document.getElementById('hit-flash')!;
  const hud = document.getElementById('hud')!;
  const hudFlames = document.getElementById('hud-flames')!;
  const hudNightName = document.getElementById('hud-night-name')!;
  const hudTime = document.getElementById('hud-time')!;
  const hudWindAlert = document.getElementById('hud-wind-alert')!;
  const hudLowFuelAlert = document.getElementById('hud-lowfuel-alert')!;
  const hudSubtitle = document.getElementById('hud-subtitle')!;
  const hudLanterns = document.getElementById('hud-lanterns')!;
  const hudScore = document.getElementById('hud-score')!;
  const hudFps = document.getElementById('hud-fps')!;
  const hudToast = document.getElementById('hud-toast')!;
  const hudInteractPrompt = document.getElementById('hud-interact-prompt')!;
  const hudControlsMini = document.getElementById('hud-controls-mini')!;
  const hudCharmBadge = document.getElementById('hud-charm-badge')!;
  const hudCharmTime = document.getElementById('hud-charm-time')!;
  const hudCarriedText = document.getElementById('hud-carried-text')!;
  const hudMoteSlots = document.getElementById('hud-mote-slots')!;
  const skillDash = document.getElementById('skill-dash')!;
  const skillDashKey = document.getElementById('skill-dash-key')!;
  const skillDashCd = document.getElementById('skill-dash-cd')!;
  const skillPulse = document.getElementById('skill-pulse')!;
  const skillPulseKey = document.getElementById('skill-pulse-key')!;
  const skillPulseCd = document.getElementById('skill-pulse-cd')!;

  const lanternArrow = document.getElementById('lantern-arrow')!;
  const lanternArrowIcon = lanternArrow.querySelector('.arrow-icon') as HTMLElement;
  const lanternArrowDist = document.getElementById('lantern-arrow-dist')!;

  const shadeArrow = document.getElementById('shade-arrow')!;
  const shadeArrowIcon = shadeArrow.querySelector('.arrow-icon') as HTMLElement;
  const shadeArrowLabel = document.getElementById('shade-arrow-label')!;

  const btnMute = document.getElementById('btn-mute')!;
  const btnPause = document.getElementById('btn-pause')!;

  const screenMenu = document.getElementById('screen-menu')!;
  const screenLeaderboard = document.getElementById('screen-leaderboard')!;
  const lbTableWrap = document.getElementById('leaderboard-table-wrap')!;
  const screenIntro = document.getElementById('screen-intro')!;
  const screenPause = document.getElementById('screen-pause')!;
  const screenSettings = document.getElementById('screen-settings')!;
  const screenResult = document.getElementById('screen-result')!;

  const introEyebrow = document.getElementById('intro-eyebrow')!;
  const introTitle = document.getElementById('intro-title')!;
  const introQuote = document.getElementById('intro-quote')!;
  const introMeta = document.getElementById('intro-meta')!;

  const resultEyebrow = document.getElementById('result-eyebrow')!;
  const resultTitle = document.getElementById('result-title')!;
  const resultSubtitle = document.getElementById('result-subtitle')!;
  const resultScore = document.getElementById('result-score')!;
  const resultDetails = document.getElementById('result-details')!;
  const lbSaveBox = document.getElementById('lb-save-box')!;
  const inputPlayerName = document.getElementById('input-player-name') as HTMLInputElement;
  const btnSaveScore = document.getElementById('btn-save-score') as HTMLButtonElement;
  const lbSaveStatus = document.getElementById('lb-save-status')!;
  const btnResultPrimary = document.getElementById('btn-result-primary')!;
  const btnResultRetry = document.getElementById('btn-result-retry')!;

  const inputVolume = document.getElementById('input-volume') as HTMLInputElement;
  const valVolume = document.getElementById('val-volume')!;
  const inputSens = document.getElementById('input-sens') as HTMLInputElement;
  const valSens = document.getElementById('val-sens')!;
  const inputColorblind = document.getElementById('input-colorblind') as HTMLInputElement;
  const inputReducedMotion = document.getElementById('input-reduced-motion') as HTMLInputElement;
  const inputLargeText = document.getElementById('input-large-text') as HTMLInputElement;
  const keybindsList = document.getElementById('keybinds-list')!;
  const keybindConflictMsg = document.getElementById('keybind-conflict-msg')!;
  const btnResetKeys = document.getElementById('btn-reset-keys')!;

  let currentRenderedSlots = 0;
  let moteSlotEls: HTMLDivElement[] = [];
  function ensureMoteSlots(capacity: number): void {
    if (currentRenderedSlots === capacity) return;
    currentRenderedSlots = capacity;
    hudMoteSlots.innerHTML = '';
    hudMoteSlots.style.gridTemplateColumns = `repeat(${Math.min(10, capacity)}, 1fr)`;
    moteSlotEls = [];
    for (let i = 0; i < capacity; i++) {
      const el = document.createElement('div');
      el.className = 'mote-slot';
      hudMoteSlots.appendChild(el);
      moteSlotEls.push(el);
    }
  }
  ensureMoteSlots(10);

  const scene = new LanternIslandScene(canvas);
  const sfx = new SoundEffects();
  const settings = loadSettings();

  function applySettingsToDom(): void {
    sfx.volume = settings.volume / 100;
    inputVolume.value = String(settings.volume);
    valVolume.textContent = `${settings.volume}%`;
    inputSens.value = String(Math.round(settings.sensitivity * 100));
    valSens.textContent = settings.sensitivity.toFixed(2);
    inputColorblind.checked = settings.colorblind;
    inputReducedMotion.checked = settings.reducedMotion;
    inputLargeText.checked = settings.largeText;
    document.body.classList.toggle('colorblind', settings.colorblind);
    document.body.classList.toggle('reduced-motion', settings.reducedMotion);
    document.body.classList.toggle('large-text', settings.largeText);

    const kb = settings.keybinds;
    skillDashKey.textContent = formatKeyCode(kb.dash);
    skillPulseKey.textContent = formatKeyCode(kb.pulse);
    hudControlsMini.innerHTML =
      `<span><kbd>${formatKeyCode(kb.up)}${formatKeyCode(kb.left)}${formatKeyCode(kb.down)}${formatKeyCode(kb.right)}</kbd> Đi · ` +
      `<kbd>${formatKeyCode(kb.jump)}</kbd> Nhảy · <kbd>${formatKeyCode(kb.dash)}</kbd> Lướt</span>` +
      `<span><kbd>${formatKeyCode(kb.interact)}</kbd> Nạp · <kbd>${formatKeyCode(kb.pulse)}</kbd> Tỏa Sáng · <kbd>${formatKeyCode(kb.pause)}</kbd> Tạm dừng</span>`;
  }

  let listeningAction: ActionKey | null = null;

  function renderKeybindsUI(): void {
    const codeCounts = new Map<string, ActionKey[]>();
    for (const act of Object.keys(ACTION_LABELS) as ActionKey[]) {
      const code = settings.keybinds[act];
      const list = codeCounts.get(code) ?? [];
      list.push(act);
      codeCounts.set(code, list);
    }

    const conflicts: string[] = [];
    for (const [code, acts] of codeCounts) {
      if (acts.length > 1) {
        conflicts.push(`${formatKeyCode(code)} (${acts.map((a) => ACTION_LABELS[a]).join(', ')})`);
      }
    }

    if (conflicts.length > 0) {
      keybindConflictMsg.textContent = `⚠ Trùng phím: ${conflicts.join(' · ')}`;
      keybindConflictMsg.classList.remove('hidden');
    } else {
      keybindConflictMsg.classList.add('hidden');
    }

    keybindsList.innerHTML = '';
    for (const act of Object.keys(ACTION_LABELS) as ActionKey[]) {
      const code = settings.keybinds[act];
      const isConflict = (codeCounts.get(code)?.length ?? 0) > 1;
      const btn = document.createElement('button');
      btn.className = `keybind-btn${listeningAction === act ? ' listening' : ''}${isConflict ? ' conflict' : ''}`;
      btn.innerHTML = `<span>${ACTION_LABELS[act]}</span><span class="keybind-code">${listeningAction === act ? 'Nhấn phím...' : formatKeyCode(code)}</span>`;
      btn.addEventListener('click', () => {
        listeningAction = act;
        renderKeybindsUI();
      });
      keybindsList.appendChild(btn);
    }
  }

  applySettingsToDom();
  renderKeybindsUI();

  type UiMode = 'menu' | 'leaderboard' | 'intro' | 'playing' | 'paused' | 'result';
  let uiMode: UiMode = 'menu';
  let settingsReturnMode: 'menu' | 'paused' = 'menu';

  let currentNight: NightNumber = 1;
  let campaignTotalScore = 0;
  let campaignNightsWon = 0;
  let runSeedCounter = 100;
  let sim = new GameSimulation({ seed: 101, night: 1 });
  let camYawDeg = 0;
  let toastTimer = 0;
  let subtitleTimer = 0;
  let hitFlashTimer = 0;
  let shadeAlertId: string | null = null;
  let shadeAlertTimer = 0;
  let lastCountdownSecond = -1;
  let wasWindWarning = false;
  let pendingPauseToggle = false;
  let prevJumpKey = false;

  const keys = new Set<string>();
  let dragging = false;
  let lastMouseX = 0;

  function showToast(msg: string, duration = 2.2): void {
    hudToast.textContent = msg;
    hudToast.classList.remove('hidden');
    toastTimer = duration;
  }

  function showSubtitle(msg: string, duration = 2.6): void {
    hudSubtitle.textContent = settings.colorblind ? `⚠ ${msg}` : msg;
    hudSubtitle.classList.remove('hidden');
    subtitleTimer = duration;
  }

  function hideAllScreens(): void {
    screenMenu.classList.add('hidden');
    screenLeaderboard.classList.add('hidden');
    screenIntro.classList.add('hidden');
    screenPause.classList.add('hidden');
    screenSettings.classList.add('hidden');
    screenResult.classList.add('hidden');
  }

  function showMainMenu(): void {
    uiMode = 'menu';
    hideAllScreens();
    hud.classList.add('hidden');
    lanternArrow.classList.add('hidden');
    shadeArrow.classList.add('hidden');
    screenMenu.classList.remove('hidden');
    sfx.stopBgm();
  }

  async function openLeaderboard(): Promise<void> {
    uiMode = 'leaderboard';
    hideAllScreens();
    screenLeaderboard.classList.remove('hidden');
    const entries = await fetchLeaderboard();
    if (entries.length === 0) {
      lbTableWrap.innerHTML = '<p class="modal-desc">Chưa có điểm nào được lưu. Hãy chơi và lưu kỷ lục của bạn!</p>';
      return;
    }
    const rows = entries
      .map(
        (e, i) =>
          `<tr><td>#${i + 1}</td><td><strong>${e.name}</strong></td><td class="gold-val">${e.score}</td><td>${e.nights_won}/3</td><td>${e.seed}</td></tr>`
      )
      .join('');
    lbTableWrap.innerHTML = `<table class="lb-table"><thead><tr><th>Hạng</th><th>Tên</th><th>Điểm</th><th>Đêm thắng</th><th>Seed</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function openNightIntro(night: NightNumber, resetCampaign: boolean): void {
    currentNight = night;
    if (resetCampaign) {
      campaignTotalScore = 0;
      campaignNightsWon = 0;
    }
    const mapDef = getNightMap(night);
    uiMode = 'intro';
    hideAllScreens();
    hud.classList.add('hidden');
    lanternArrow.classList.add('hidden');
    shadeArrow.classList.add('hidden');

    introEyebrow.textContent = `ĐÊM ${night} / 3`;
    introTitle.textContent = mapDef.name;
    introQuote.textContent = mapDef.introQuote;
    const threshold = Math.ceil(0.6 * mapDef.lanterns.length);
    introMeta.textContent =
      `Mục tiêu: Giữ sáng ≥ ${threshold}/${mapDef.lanterns.length} Đèn Lồng tới bình minh · Thời gian: ${Math.floor(mapDef.durationS / 60)} phút ${mapDef.durationS % 60 ? `${mapDef.durationS % 60} giây` : ''}`;

    runSeedCounter += 1;
    sim = new GameSimulation({ seed: runSeedCounter, night });
    camYawDeg = 0;
    screenIntro.classList.remove('hidden');
  }

  function startActiveNight(): void {
    runSeedCounter += 1;
    sim = new GameSimulation({ seed: runSeedCounter, night: currentNight });
    camYawDeg = 0;
    lastCountdownSecond = -1;
    wasWindWarning = false;
    pendingPauseToggle = false;
    shadeAlertId = null;
    shadeAlertTimer = 0;
    uiMode = 'playing';
    hideAllScreens();
    hud.classList.remove('hidden');
    hudNightName.textContent = sim.map.name;
    sfx.startBgm();
    showToast(`${sim.map.name} — Giữ sáng ≥ ${sim.getWinLanternThreshold()}/${sim.lanterns.length} đèn tới bình minh!`, 2.8);
  }

  function openSettings(returnTo: 'menu' | 'paused'): void {
    settingsReturnMode = returnTo;
    listeningAction = null;
    renderKeybindsUI();
    hideAllScreens();
    screenSettings.classList.remove('hidden');
  }

  function closeSettings(): void {
    listeningAction = null;
    saveSettings(settings);
    applySettingsToDom();
    hideAllScreens();
    if (settingsReturnMode === 'menu') {
      screenMenu.classList.remove('hidden');
    } else {
      screenPause.classList.remove('hidden');
    }
  }

  function requestPauseToggle(): void {
    if (uiMode === 'playing' || uiMode === 'paused') {
      pendingPauseToggle = true;
    }
  }

  // Event listeners
  document.getElementById('btn-start-campaign')!.addEventListener('click', () => {
    openNightIntro(1, true);
  });
  document.querySelectorAll<HTMLButtonElement>('.night-pick-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      openNightIntro(Number(btn.dataset.night) as NightNumber, true);
    });
  });
  document.getElementById('btn-open-leaderboard')!.addEventListener('click', () => {
    void openLeaderboard();
  });
  document.getElementById('btn-close-leaderboard')!.addEventListener('click', showMainMenu);
  document.getElementById('btn-open-settings-menu')!.addEventListener('click', () => {
    openSettings('menu');
  });
  document.getElementById('btn-begin-night')!.addEventListener('click', startActiveNight);
  document.getElementById('btn-resume')!.addEventListener('click', requestPauseToggle);
  document.getElementById('btn-restart-pause')!.addEventListener('click', startActiveNight);
  document.getElementById('btn-settings-pause')!.addEventListener('click', () => {
    openSettings('paused');
  });
  document.getElementById('btn-menu-pause')!.addEventListener('click', showMainMenu);
  document.getElementById('btn-close-settings')!.addEventListener('click', closeSettings);
  document.getElementById('btn-result-menu')!.addEventListener('click', showMainMenu);
  btnResultRetry.addEventListener('click', startActiveNight);
  btnPause.addEventListener('click', requestPauseToggle);

  btnResetKeys.addEventListener('click', () => {
    settings.keybinds = { ...DEFAULT_KEYBINDS };
    listeningAction = null;
    saveSettings(settings);
    applySettingsToDom();
    renderKeybindsUI();
  });

  btnResultPrimary.addEventListener('click', () => {
    if (sim.state === 'lost') {
      startActiveNight();
    } else if (sim.state === 'won' && currentNight < 3) {
      openNightIntro((currentNight + 1) as NightNumber, false);
    } else {
      openNightIntro(1, true);
    }
  });

  btnSaveScore.addEventListener('click', async () => {
    const rawName = inputPlayerName.value.trim();
    if (!isValidLeaderboardName(rawName)) {
      lbSaveStatus.textContent = '⚠ Tên phải dài 3–12 ký tự (chữ cái, số, dấu _).';
      return;
    }
    try {
      await saveLeaderboardScore({
        name: rawName,
        score: campaignTotalScore,
        nights_won: campaignNightsWon,
        achieved_at: formatIsoWithOffset(new Date()),
        seed: sim.seed,
      });
      lbSaveStatus.textContent = `✅ Đã lưu "${rawName}" (${campaignTotalScore} điểm) vào Bảng xếp hạng!`;
      btnSaveScore.disabled = true;
    } catch (err) {
      lbSaveStatus.textContent = `⚠ ${err instanceof Error ? err.message : 'Lỗi lưu điểm'}`;
    }
  });

  btnMute.addEventListener('click', () => {
    sfx.muted = !sfx.muted;
    btnMute.textContent = sfx.muted ? '🔇' : '🔊';
  });

  inputVolume.addEventListener('input', () => {
    settings.volume = Number(inputVolume.value);
    valVolume.textContent = `${settings.volume}%`;
    sfx.volume = settings.volume / 100;
  });
  inputSens.addEventListener('input', () => {
    settings.sensitivity = Number(inputSens.value) / 100;
    valSens.textContent = settings.sensitivity.toFixed(2);
  });
  inputColorblind.addEventListener('change', () => {
    settings.colorblind = inputColorblind.checked;
    applySettingsToDom();
    saveSettings(settings);
  });
  inputReducedMotion.addEventListener('change', () => {
    settings.reducedMotion = inputReducedMotion.checked;
    applySettingsToDom();
    saveSettings(settings);
  });
  inputLargeText.addEventListener('change', () => {
    settings.largeText = inputLargeText.checked;
    applySettingsToDom();
    saveSettings(settings);
  });

  window.addEventListener('keydown', (e) => {
    // Capture key rebinding inside Settings modal
    if (listeningAction !== null) {
      e.preventDefault();
      settings.keybinds[listeningAction] = e.code;
      listeningAction = null;
      saveSettings(settings);
      applySettingsToDom();
      renderKeybindsUI();
      return;
    }

    // Ignore hotkeys while typing player name
    if (document.activeElement === inputPlayerName) return;

    if ((e.code === settings.keybinds.pause || e.code === 'KeyP') && !e.repeat) {
      if (uiMode === 'playing' || uiMode === 'paused') {
        requestPauseToggle();
      }
    }
    keys.add(e.code);
  });

  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
  });

  canvas.addEventListener('mousedown', (e) => {
    dragging = true;
    lastMouseX = e.clientX;
  });
  window.addEventListener('mouseup', () => {
    dragging = false;
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging || uiMode !== 'playing') return;
    const dx = e.clientX - lastMouseX;
    lastMouseX = e.clientX;
    camYawDeg = (camYawDeg - dx * settings.sensitivity + 360) % 360;
  });

  function readInput(): TickInputState {
    const kb = settings.keybinds;
    const input = createDefaultInputState();
    let x = 0;
    let z = 0;
    if (keys.has(kb.up) || keys.has('ArrowUp')) z += 1;
    if (keys.has(kb.down) || keys.has('ArrowDown')) z -= 1;
    if (keys.has(kb.left) || keys.has('ArrowLeft')) x += 1;
    if (keys.has(kb.right) || keys.has('ArrowRight')) x -= 1;

    input.move = [x, z];
    input.cam_yaw_deg = camYawDeg;
    input.jump = keys.has(kb.jump);
    input.interact = keys.has(kb.interact);
    input.pulse = keys.has(kb.pulse);
    input.dash =
      keys.has(kb.dash) || (kb.dash === 'ShiftLeft' && keys.has('ShiftRight'));
    input.pause = pendingPauseToggle;
    pendingPauseToggle = false;

    if (uiMode === 'playing' && input.jump && !prevJumpKey && sim.player.grounded) {
      sfx.jump();
    }
    prevJumpKey = input.jump;
    return input;
  }

  function handleEvents(events: EventLine[]): void {
    for (const ev of events) {
      switch (ev.name) {
        case 'paused':
          uiMode = 'paused';
          hideAllScreens();
          screenPause.classList.remove('hidden');
          break;
        case 'resumed':
          uiMode = 'playing';
          hideAllScreens();
          break;
        case 'dash':
          sfx.dash();
          break;
        case 'mote_picked':
          sfx.motePicked(Number(ev.data.carried ?? 1));
          break;
        case 'charm_picked':
          sfx.charmPicked();
          showToast('🎐 Nhặt Bùa Gió! Tốc độ 7.2 m/s & Lướt không hồi chiêu (10s)', 2.4);
          break;
        case 'deposit':
          sfx.deposit();
          showToast(`Nạp ${ev.data.amount} ánh sáng vào ${ev.data.lantern_id} (${ev.data.deposited})`, 1.5);
          break;
        case 'refuel':
          sfx.deposit();
          showToast(`⛽ Châm ${ev.data.amount} đom đóm vào ${ev.data.lantern_id} (Dầu: ${ev.data.fuel}%)`, 1.6);
          break;
        case 'lantern_lit':
          sfx.lanternLit();
          showToast(
            ev.data.relight
              ? `🔥 Thắp lại ${ev.data.lantern_id}! Sức chứa: ${sim.getPlayerCapacity()}`
              : `✨ Đèn Lồng ${ev.data.lantern_id} đã sáng! Sức chứa: ${sim.getPlayerCapacity()}`,
            2.3
          );
          break;
        case 'lantern_out':
          sfx.playerHit();
          showSubtitle(`Đèn ${ev.data.lantern_id} đã cạn dầu và tắt!`, 2.8);
          break;
        case 'fuel_drain':
          showSubtitle(`Bóng Mực ${ev.data.shade_id} đang hút dầu ${ev.data.lantern_id} (${ev.data.fuel}%)!`, 2.4);
          break;
        case 'pulse': {
          sfx.pulse();
          scene.spawnPulseEffect(sim.player.pos, sim.tuning.pulse_radius);
          const stunned = (ev.data.stunned_ids as string[]) ?? [];
          if (stunned.length > 0) {
            showToast(`🌟 Tỏa Sáng làm choáng ${stunned.length} Bóng Mực!`, 1.8);
          }
          break;
        }
        case 'shade_spawned':
          sfx.shadeSpawned();
          shadeAlertId = String(ev.data.id ?? '');
          shadeAlertTimer = 4.0;
          showSubtitle(`Bóng Mực ${shadeAlertId} xuất hiện!`, 2.8);
          break;
        case 'drifter_steal':
          sfx.playerHit();
          showSubtitle(`Gió Lạc cướp ${ev.data.amount} đom đóm! Tỏa Sáng để đòi lại!`, 2.6);
          break;
        case 'drifter_drop':
          sfx.motePicked(5);
          showToast(`✨ Gió Lạc thả lại ${ev.data.amount} đom đóm!`, 2.0);
          break;
        case 'player_hit':
          sfx.playerHit();
          if (!settings.reducedMotion) {
            scene.triggerCameraShake(0.28);
            hitFlash.classList.remove('hidden');
            hitFlashTimer = 0.22;
          }
          if (ev.data.by === 'fall') {
            showSubtitle(`Rơi xuống biển mây! Còn ${ev.data.flames} Ngọn Lửa`, 2.4);
          } else {
            showSubtitle(`Bị Bóng Mực chạm! Còn ${ev.data.flames} lửa (rơi ${ev.data.dropped})`, 2.2);
          }
          break;
        case 'game_over': {
          const won = ev.data.result === 'won';
          sfx.gameOver(won);
          uiMode = 'result';
          hideAllScreens();
          lanternArrow.classList.add('hidden');
          shadeArrow.classList.add('hidden');
          screenResult.classList.remove('hidden');

          // Reset leaderboard form state
          inputPlayerName.value = '';
          lbSaveStatus.textContent = '';
          btnSaveScore.disabled = false;

          if (won) {
            campaignTotalScore += sim.score;
            campaignNightsWon = Math.min(3, campaignNightsWon + 1);
            if (currentNight === 3) {
              resultEyebrow.textContent = '🌅 BÌNH MINH TRỞ VỀ';
              resultTitle.textContent = 'Hoàn Thành Ba Hòn Đảo!';
              resultSubtitle.textContent =
                'Toàn bộ Đảo Bến, Đảo Cau và Đảo Chuông đã vượt qua đêm tối!';
              resultScore.textContent = `Tổng điểm: ${campaignTotalScore}`;
              btnResultPrimary.textContent = 'Chơi lại từ Đêm 1';
              btnResultRetry.classList.add('hidden');
              lbSaveBox.classList.remove('hidden');
            } else {
              resultEyebrow.textContent = `HOÀN THÀNH ĐÊM ${currentNight}`;
              resultTitle.textContent = `${sim.map.name} Vượt Qua Đêm Tối!`;
              resultSubtitle.textContent = 'Mây sẵn sàng lên đường tới hòn đảo kế tiếp.';
              resultScore.textContent = `Điểm Đêm ${currentNight}: ${sim.score}`;
              btnResultPrimary.textContent = `Sang Đêm ${currentNight + 1}`;
              btnResultRetry.classList.remove('hidden');
              lbSaveBox.classList.add('hidden');
            }
          } else {
            resultEyebrow.textContent = `THẤT BẠI · ĐÊM ${currentNight}`;
            resultTitle.textContent = 'Sương Đen Bao Phủ...';
            resultSubtitle.textContent =
              ev.data.reason === 'dawn'
                ? 'Bình minh tới nhưng số Đèn Lồng sáng dưới ngưỡng 60%.'
                : 'Mây đã mất hết Ngọn Lửa hộ mệnh.';
            resultScore.textContent = `Tổng điểm đã thắng: ${campaignTotalScore}`;
            btnResultPrimary.textContent = 'Chơi lại Đêm này';
            btnResultRetry.classList.add('hidden');
            lbSaveBox.classList.remove('hidden');
          }

          const lit = sim.lanterns.filter((l) => l.lit).length;
          resultDetails.innerHTML =
            `Đèn đang sáng: <strong>${lit}/${sim.lanterns.length}</strong> · ` +
            `Ngọn Lửa: <strong>${sim.player.flames}</strong> · ` +
            `Đêm thắng: <strong>${campaignNightsWon}/3</strong>`;
          break;
        }
      }
    }
  }

  function positionEdgeArrow(
    el: HTMLElement,
    iconEl: HTMLElement,
    worldPos: [number, number, number]
  ): boolean {
    const proj = scene.projectToScreen(worldPos);
    if (proj.onScreen) {
      el.classList.add('hidden');
      return false;
    }
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    let dx = proj.x - cx;
    let dy = proj.y - cy;
    if (!proj.inFront) {
      dx = -dx;
      dy = -dy;
    }
    const angle = Math.atan2(dy, dx);
    const pad = 54;
    const scale = Math.min(
      Math.abs(dx) > 1e-3 ? (cx - pad) / Math.abs(dx) : Infinity,
      Math.abs(dy) > 1e-3 ? (cy - pad) / Math.abs(dy) : Infinity
    );
    el.style.left = `${cx + dx * scale}px`;
    el.style.top = `${cy + dy * scale}px`;
    iconEl.style.transform = `rotate(${angle}rad)`;
    el.classList.remove('hidden');
    return true;
  }

  function updateHud(): void {
    hudFlames.textContent = sim.player.flames > 0 ? '🔥'.repeat(sim.player.flames) : '💨';
    const lit = sim.lanterns.filter((l) => l.lit).length;
    const threshold = sim.getWinLanternThreshold();
    hudLanterns.textContent = `${lit}/${sim.lanterns.length} (≥${threshold})`;
    hudScore.textContent = String(sim.score);

    const secLeft = Math.ceil(sim.timeLeftS);
    const mins = Math.floor(secLeft / 60);
    const secs = secLeft % 60;
    const clockStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    const isDangerTime = secLeft <= 30;
    hudTime.textContent = isDangerTime && settings.colorblind ? `⚠ ${clockStr}` : clockStr;
    hudTime.classList.toggle('danger', isDangerTime);

    // Visual subtitle + SFX for last 10s
    if (uiMode === 'playing' && secLeft <= 10 && secLeft > 0 && secLeft !== lastCountdownSecond) {
      lastCountdownSecond = secLeft;
      sfx.countdownTick();
      showSubtitle(`Còn ${secLeft} giây tới bình minh!`, 1.1);
    }

    // Wind indicator
    if (sim.wind.warning && !wasWindWarning && uiMode === 'playing') {
      sfx.windWarning();
    }
    wasWindWarning = sim.wind.warning;
    if (sim.wind.active) {
      hudWindAlert.textContent = `${settings.colorblind ? '⚠ ' : '🌪 '}Gió mạnh đang thổi (${Math.round(sim.wind.dirDeg)}°)`;
      hudWindAlert.classList.remove('hidden');
    } else if (sim.wind.warning) {
      hudWindAlert.textContent = `${settings.colorblind ? '⚠ ' : '🍃 '}Gió mạnh sắp thổi trong 2s!`;
      hudWindAlert.classList.remove('hidden');
    } else {
      hudWindAlert.classList.add('hidden');
    }

    // Low fuel (< 30) persistent visual alert
    const lowFuelLanterns = sim.lanterns.filter((l) => l.lit && l.fuelSixtieths < 1800);
    if (lowFuelLanterns.length > 0 && uiMode === 'playing') {
      hudLowFuelAlert.textContent = `⚠ Đèn sắp cạn dầu (<30%): ${lowFuelLanterns.map((l) => l.id).join(', ')}`;
      hudLowFuelAlert.classList.remove('hidden');
    } else {
      hudLowFuelAlert.classList.add('hidden');
    }

    // Dynamic firefly bar (10..20)
    const capacity = sim.getPlayerCapacity();
    ensureMoteSlots(capacity);
    hudCarriedText.textContent = `${sim.player.carried} / ${capacity}`;
    for (let i = 0; i < moteSlotEls.length; i++) {
      moteSlotEls[i].classList.toggle('filled', i < sim.player.carried);
    }

    // Charm timer
    if (sim.player.charmTicks > 0) {
      hudCharmBadge.classList.remove('hidden');
      hudCharmTime.textContent = `${(sim.player.charmTicks / TICK_RATE).toFixed(1)}s`;
    } else {
      hudCharmBadge.classList.add('hidden');
    }

    // Skills cooldowns
    if (sim.player.charmTicks > 0) {
      skillDash.className = 'skill-box ready';
      skillDashCd.textContent = 'Không CD!';
    } else if (sim.player.dashCdTicks > 0) {
      skillDash.className = 'skill-box cooldown';
      skillDashCd.textContent = `${(sim.player.dashCdTicks / TICK_RATE).toFixed(1)}s`;
    } else {
      skillDash.className = 'skill-box ready';
      skillDashCd.textContent = 'Sẵn sàng';
    }

    if (sim.player.pulseCdTicks > 0) {
      skillPulse.className = 'skill-box cooldown';
      skillPulseCd.textContent = `${(sim.player.pulseCdTicks / TICK_RATE).toFixed(1)}s`;
    } else if (sim.player.carried < sim.tuning.pulse_cost) {
      skillPulse.className = 'skill-box cooldown';
      skillPulseCd.textContent = `Cần ${sim.tuning.pulse_cost}`;
    } else {
      skillPulse.className = 'skill-box ready';
      skillPulseCd.textContent = 'Sẵn sàng';
    }

    // Lantern interact prompt & off-screen indicator
    let nearLantern = null;
    let nearDist = Infinity;
    let nearestPriority = null;
    let nearestPriorityDist = Infinity;
    const interactKeyLabel = formatKeyCode(settings.keybinds.interact);

    for (const l of sim.lanterns) {
      const d = Math.hypot(sim.player.pos[0] - l.pos[0], sim.player.pos[2] - l.pos[2]);
      const needsAttention = !l.lit || l.fuelSixtieths < 1800;
      if (needsAttention && d < nearestPriorityDist) {
        nearestPriorityDist = d;
        nearestPriority = l;
      }
      const interactable = !l.lit || l.fuelSixtieths < 6000;
      if (
        interactable &&
        d <= sim.tuning.interact_radius &&
        Math.abs(sim.player.pos[1] - l.pos[1]) <= 2.5 &&
        d < nearDist
      ) {
        nearDist = d;
        nearLantern = l;
      }
    }

    if (nearLantern && uiMode === 'playing') {
      if (!nearLantern.lit) {
        const cost = nearLantern.everLit ? sim.tuning.relight_cost : sim.tuning.lantern_cost;
        hudInteractPrompt.textContent = nearLantern.everLit
          ? `${interactKeyLabel} — Thắp lại (${nearLantern.deposited}/${cost})`
          : `${interactKeyLabel} — Nạp ánh sáng (${nearLantern.deposited}/${cost})`;
      } else {
        const fuelPct = Math.round(nearLantern.fuelSixtieths / TICK_RATE);
        hudInteractPrompt.textContent = `${interactKeyLabel} — Châm dầu (${fuelPct}%)`;
      }
      hudInteractPrompt.classList.remove('hidden');
    } else {
      hudInteractPrompt.classList.add('hidden');
    }

    if (nearestPriority && uiMode === 'playing') {
      lanternArrowDist.textContent = `${Math.round(nearestPriorityDist)}m`;
      positionEdgeArrow(lanternArrow, lanternArrowIcon, nearestPriority.pos);
    } else {
      lanternArrow.classList.add('hidden');
    }

    // Shade spawn / danger edge indicator
    if (uiMode === 'playing' && shadeAlertTimer > 0 && shadeAlertId) {
      const targetShade = sim.shades.find((s) => s.id === shadeAlertId);
      if (targetShade) {
        const d = Math.round(
          Math.hypot(sim.player.pos[0] - targetShade.pos[0], sim.player.pos[2] - targetShade.pos[2])
        );
        shadeArrowLabel.textContent = `⚠ ${targetShade.id} (${d}m)`;
        positionEdgeArrow(shadeArrow, shadeArrowIcon, targetShade.pos);
      } else {
        shadeArrow.classList.add('hidden');
      }
    } else {
      shadeArrow.classList.add('hidden');
    }
  }

  let lastFrameTime = performance.now();
  let accumulator = 0;
  let fpsFrames = 0;
  let fpsAccum = 0;

  function loop(now: number): void {
    const frameDt = Math.min(0.1, (now - lastFrameTime) / 1000);
    lastFrameTime = now;

    fpsFrames++;
    fpsAccum += frameDt;
    if (fpsAccum >= 0.5) {
      hudFps.textContent = `${Math.round(fpsFrames / fpsAccum)} FPS`;
      fpsFrames = 0;
      fpsAccum = 0;
    }

    if (uiMode === 'playing') {
      if (keys.has('KeyJ')) camYawDeg = (camYawDeg + 110 * frameDt) % 360;
      if (keys.has('KeyL')) camYawDeg = (camYawDeg - 110 * frameDt + 360) % 360;
    }

    if (toastTimer > 0) {
      toastTimer -= frameDt;
      if (toastTimer <= 0) hudToast.classList.add('hidden');
    }
    if (subtitleTimer > 0) {
      subtitleTimer -= frameDt;
      if (subtitleTimer <= 0) hudSubtitle.classList.add('hidden');
    }
    if (shadeAlertTimer > 0) {
      shadeAlertTimer -= frameDt;
    }
    if (hitFlashTimer > 0) {
      hitFlashTimer -= frameDt;
      if (hitFlashTimer <= 0) hitFlash.classList.add('hidden');
    }

    if (uiMode === 'playing' || uiMode === 'paused') {
      accumulator += frameDt;
      while (accumulator >= DT) {
        const events = sim.step(readInput());
        handleEvents(events);
        accumulator -= DT;
      }
      updateHud();
    } else if (!settings.reducedMotion) {
      camYawDeg = (camYawDeg + 8 * frameDt) % 360;
    }

    scene.sync(sim, camYawDeg, frameDt, settings.colorblind, settings.reducedMotion);
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}
