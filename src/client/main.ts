import { DT, TICK_RATE } from '../core/config.js';
import { getNightMap } from '../core/maps.js';
import { GameSimulation, createDefaultInputState } from '../core/simulation.js';
import type { EventLine, NightNumber, TickInputState } from '../core/types.js';
import { SoundEffects } from './audio.js';
import { LanternIslandScene } from './scene.js';

interface UserSettings {
  volume: number; // 0..100
  sensitivity: number; // 0.1..1.5
}

const SETTINGS_KEY = 'dao_den_long_settings_v1';

function loadSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<UserSettings>;
      return {
        volume: typeof parsed.volume === 'number' ? parsed.volume : 70,
        sensitivity: typeof parsed.sensitivity === 'number' ? parsed.sensitivity : 0.4,
      };
    }
  } catch {
    // Ignore storage errors
  }
  return { volume: 70, sensitivity: 0.4 };
}

function saveSettings(s: UserSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // Ignore storage errors
  }
}

// DOM refs
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const hud = document.getElementById('hud')!;
const hudFlames = document.getElementById('hud-flames')!;
const hudNightName = document.getElementById('hud-night-name')!;
const hudTime = document.getElementById('hud-time')!;
const hudWindAlert = document.getElementById('hud-wind-alert')!;
const hudLanterns = document.getElementById('hud-lanterns')!;
const hudScore = document.getElementById('hud-score')!;
const hudFps = document.getElementById('hud-fps')!;
const hudToast = document.getElementById('hud-toast')!;
const hudInteractPrompt = document.getElementById('hud-interact-prompt')!;
const hudCharmBadge = document.getElementById('hud-charm-badge')!;
const hudCharmTime = document.getElementById('hud-charm-time')!;
const hudCarriedText = document.getElementById('hud-carried-text')!;
const hudMoteSlots = document.getElementById('hud-mote-slots')!;
const skillDash = document.getElementById('skill-dash')!;
const skillDashCd = document.getElementById('skill-dash-cd')!;
const skillPulse = document.getElementById('skill-pulse')!;
const skillPulseCd = document.getElementById('skill-pulse-cd')!;
const lanternArrow = document.getElementById('lantern-arrow')!;
const lanternArrowIcon = lanternArrow.querySelector('.arrow-icon') as HTMLElement;
const lanternArrowDist = document.getElementById('lantern-arrow-dist')!;

const btnMute = document.getElementById('btn-mute')!;
const btnPause = document.getElementById('btn-pause')!;

const screenMenu = document.getElementById('screen-menu')!;
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
const btnResultPrimary = document.getElementById('btn-result-primary')!;
const btnResultRetry = document.getElementById('btn-result-retry')!;

const inputVolume = document.getElementById('input-volume') as HTMLInputElement;
const valVolume = document.getElementById('val-volume')!;
const inputSens = document.getElementById('input-sens') as HTMLInputElement;
const valSens = document.getElementById('val-sens')!;

// Build 10 firefly slots
const moteSlotEls: HTMLDivElement[] = [];
for (let i = 0; i < 10; i++) {
  const el = document.createElement('div');
  el.className = 'mote-slot';
  hudMoteSlots.appendChild(el);
  moteSlotEls.push(el);
}

const scene = new LanternIslandScene(canvas);
const sfx = new SoundEffects();
const settings = loadSettings();
sfx.volume = settings.volume / 100;
inputVolume.value = String(settings.volume);
valVolume.textContent = `${settings.volume}%`;
inputSens.value = String(Math.round(settings.sensitivity * 100));
valSens.textContent = settings.sensitivity.toFixed(2);

type UiMode = 'menu' | 'intro' | 'playing' | 'paused' | 'result';
let uiMode: UiMode = 'menu';
let settingsReturnMode: 'menu' | 'paused' = 'menu';

let currentNight: NightNumber = 1;
let campaignTotalScore = 0;
let runSeedCounter = 100;
let sim = new GameSimulation({ seed: 101, night: 1 });
let camYawDeg = 0;
let toastTimer = 0;
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

function hideAllScreens(): void {
  screenMenu.classList.add('hidden');
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
  screenMenu.classList.remove('hidden');
  sfx.stopBgm();
}

function openNightIntro(night: NightNumber, resetCampaignScore: boolean): void {
  currentNight = night;
  if (resetCampaignScore) campaignTotalScore = 0;
  const mapDef = getNightMap(night);
  uiMode = 'intro';
  hideAllScreens();
  hud.classList.add('hidden');
  lanternArrow.classList.add('hidden');

  introEyebrow.textContent = `ĐÊM ${night} / 3`;
  introTitle.textContent = mapDef.name;
  introQuote.textContent = mapDef.introQuote;
  introMeta.textContent =
    `Mục tiêu: Thắp ${mapDef.lanterns.length} Đèn Lồng Lớn · Thời gian: ${Math.floor(mapDef.durationS / 60)} phút ${mapDef.durationS % 60 ? `${mapDef.durationS % 60} giây` : ''}`;

  // Pre-build scene background for this night
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
  uiMode = 'playing';
  hideAllScreens();
  hud.classList.remove('hidden');
  hudNightName.textContent = sim.map.name;
  sfx.startBgm();
  showToast(`${sim.map.name} — Hãy thắp sáng ${sim.lanterns.length} Đèn Lồng!`, 2.8);
}

function openSettings(returnTo: 'menu' | 'paused'): void {
  settingsReturnMode = returnTo;
  hideAllScreens();
  screenSettings.classList.remove('hidden');
}

function closeSettings(): void {
  saveSettings(settings);
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

// Button bindings
document.getElementById('btn-start-campaign')!.addEventListener('click', () => {
  openNightIntro(1, true);
});
document.querySelectorAll<HTMLButtonElement>('.night-pick-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const n = Number(btn.dataset.night) as NightNumber;
    openNightIntro(n, true);
  });
});
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

btnResultPrimary.addEventListener('click', () => {
  if (sim.state === 'lost') {
    startActiveNight();
  } else if (sim.state === 'won' && currentNight < 3) {
    openNightIntro((currentNight + 1) as NightNumber, false);
  } else {
    openNightIntro(1, true);
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

window.addEventListener('keydown', (e) => {
  if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) {
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
  const input = createDefaultInputState();
  let x = 0;
  let z = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) z += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) z -= 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x += 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x -= 1;

  input.move = [x, z];
  input.cam_yaw_deg = camYawDeg;
  input.jump = keys.has('Space');
  input.interact = keys.has('KeyE');
  input.pulse = keys.has('KeyF');
  input.dash = keys.has('ShiftLeft') || keys.has('ShiftRight');
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
        showToast('🎐 Nhặt Bùa Gió! Tốc độ tăng & Lướt không hồi chiêu (10s)', 2.4);
        break;
      case 'deposit':
        sfx.deposit();
        showToast(
          `Nạp ${ev.data.amount} ánh sáng vào ${ev.data.lantern_id} (${ev.data.deposited}/10)`,
          1.5
        );
        break;
      case 'lantern_lit':
        sfx.lanternLit();
        showToast(`✨ Đèn Lồng ${ev.data.lantern_id} đã rực sáng!`, 2.2);
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
        break;
      case 'drifter_steal':
        sfx.playerHit();
        showToast(`💨 Gió Lạc cướp ${ev.data.amount} đom đóm! Tỏa Sáng để đòi lại!`, 2.4);
        break;
      case 'drifter_drop':
        sfx.motePicked(5);
        showToast(`✨ Gió Lạc làm rơi lại ${ev.data.amount} đom đóm!`, 2.0);
        break;
      case 'player_hit':
        sfx.playerHit();
        if (ev.data.by === 'fall') {
          showToast(`Rơi xuống biển mây! Còn ${ev.data.flames} Ngọn Lửa`, 2.2);
        } else {
          showToast(
            `Bị Bóng Mực chạm! Còn ${ev.data.flames} lửa (rơi ${ev.data.dropped} đom đóm)`,
            2.0
          );
        }
        break;
      case 'game_over': {
        const won = ev.data.result === 'won';
        sfx.gameOver(won);
        uiMode = 'result';
        hideAllScreens();
        lanternArrow.classList.add('hidden');
        screenResult.classList.remove('hidden');

        if (won) {
          campaignTotalScore += sim.score;
          if (currentNight === 3) {
            resultEyebrow.textContent = '🌅 BÌNH MINH TRỞ VỀ';
            resultTitle.textContent = 'Hoàn Thành Ba Hòn Đảo!';
            resultSubtitle.textContent =
              'Toàn bộ Đảo Bến, Đảo Cau và Đảo Chuông đã rực sáng. Sương đen tan biến trong ánh bình minh!';
            resultScore.textContent = `Tổng điểm: ${campaignTotalScore}`;
            btnResultPrimary.textContent = 'Chơi lại từ Đêm 1';
            btnResultRetry.classList.add('hidden');
          } else {
            resultEyebrow.textContent = `HOÀN THÀNH ĐÊM ${currentNight}`;
            resultTitle.textContent = `${sim.map.name} Rực Sáng!`;
            resultSubtitle.textContent = 'Mây sẵn sàng lên đường tới hòn đảo kế tiếp.';
            resultScore.textContent = `Điểm Đêm ${currentNight}: ${sim.score}`;
            btnResultPrimary.textContent = `Sang Đêm ${currentNight + 1}`;
            btnResultRetry.classList.remove('hidden');
          }
        } else {
          resultEyebrow.textContent = `THẤT BẠI · ĐÊM ${currentNight}`;
          resultTitle.textContent = 'Sương Đen Bao Phủ...';
          resultSubtitle.textContent =
            ev.data.reason === 'dawn'
              ? 'Bình minh đã tới trước khi mọi Đèn Lồng được thắp sáng.'
              : 'Mây đã mất hết Ngọn Lửa hộ mệnh.';
          resultScore.textContent = `Điểm: ${sim.score}`;
          btnResultPrimary.textContent = 'Chơi lại Đêm này';
          btnResultRetry.classList.add('hidden');
        }

        const lit = sim.lanterns.filter((l) => l.lit).length;
        resultDetails.innerHTML =
          `Đèn đã thắp: <strong>${lit}/${sim.lanterns.length}</strong> · ` +
          `Ngọn Lửa còn lại: <strong>${sim.player.flames}</strong> · ` +
          `Thời gian còn: <strong>${Math.ceil(sim.timeLeftS)}s</strong><br/>` +
          `Tổng điểm hành trình: <strong>${campaignTotalScore}</strong>`;
        break;
      }
    }
  }
}

function updateHud(): void {
  hudFlames.textContent = sim.player.flames > 0 ? '🔥'.repeat(sim.player.flames) : '💨';
  const lit = sim.lanterns.filter((l) => l.lit).length;
  hudLanterns.textContent = `${lit} / ${sim.lanterns.length}`;
  hudScore.textContent = String(sim.score);

  const secLeft = Math.ceil(sim.timeLeftS);
  const mins = Math.floor(secLeft / 60);
  const secs = secLeft % 60;
  hudTime.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  hudTime.classList.toggle('danger', secLeft <= 30);

  // Last 10s countdown tick SFX
  if (uiMode === 'playing' && secLeft <= 10 && secLeft > 0 && secLeft !== lastCountdownSecond) {
    lastCountdownSecond = secLeft;
    sfx.countdownTick();
  }

  // Wind alert (Night 3)
  if (sim.wind.warning && !wasWindWarning && uiMode === 'playing') {
    sfx.windWarning();
  }
  wasWindWarning = sim.wind.warning;
  if (sim.wind.active) {
    hudWindAlert.textContent = `🌪 Gió mạnh đang thổi (${Math.round(sim.wind.dirDeg)}°)`;
    hudWindAlert.classList.remove('hidden');
  } else if (sim.wind.warning) {
    hudWindAlert.textContent = '🍃 Gió mạnh sắp nổi trong 2 giây!';
    hudWindAlert.classList.remove('hidden');
  } else {
    hudWindAlert.classList.add('hidden');
  }

  // 10-slot Firefly bar
  hudCarriedText.textContent = `${sim.player.carried} / ${sim.tuning.carry_capacity}`;
  for (let i = 0; i < moteSlotEls.length; i++) {
    moteSlotEls[i].classList.toggle('filled', i < sim.player.carried);
  }

  // Wind Charm timer
  if (sim.player.charmTicks > 0) {
    hudCharmBadge.classList.remove('hidden');
    hudCharmTime.textContent = `${(sim.player.charmTicks / TICK_RATE).toFixed(1)}s`;
  } else {
    hudCharmBadge.classList.add('hidden');
  }

  // Dash & Pulse cooldown icons
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

  // Proximity prompt: "E — Nạp ánh sáng (x/10)"
  let nearLantern = null;
  let nearDist = Infinity;
  let nearestUnlit = null;
  let nearestUnlitDist = Infinity;

  for (const l of sim.lanterns) {
    if (l.lit) continue;
    const d = Math.hypot(sim.player.pos[0] - l.pos[0], sim.player.pos[2] - l.pos[2]);
    if (d < nearestUnlitDist) {
      nearestUnlitDist = d;
      nearestUnlit = l;
    }
    if (d <= sim.tuning.interact_radius && Math.abs(sim.player.pos[1] - l.pos[1]) <= 2.5 && d < nearDist) {
      nearDist = d;
      nearLantern = l;
    }
  }

  if (nearLantern && uiMode === 'playing') {
    hudInteractPrompt.textContent = `E — Nạp ánh sáng (${nearLantern.deposited}/${sim.tuning.lantern_cost})`;
    hudInteractPrompt.classList.remove('hidden');
  } else {
    hudInteractPrompt.classList.add('hidden');
  }

  // Off-screen arrow pointing to nearest unlit lantern
  if (nearestUnlit && uiMode === 'playing') {
    const proj = scene.projectToScreen(nearestUnlit.pos);
    if (!proj.onScreen) {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      let dx = proj.x - cx;
      let dy = proj.y - cy;
      if (!proj.inFront) {
        dx = -dx;
        dy = -dy;
      }
      const angle = Math.atan2(dy, dx);
      const pad = 48;
      const maxX = cx - pad;
      const maxY = cy - pad;
      const scale = Math.min(
        Math.abs(dx) > 1e-3 ? maxX / Math.abs(dx) : Infinity,
        Math.abs(dy) > 1e-3 ? maxY / Math.abs(dy) : Infinity
      );
      const ax = cx + dx * scale;
      const ay = cy + dy * scale;
      lanternArrow.style.left = `${ax}px`;
      lanternArrow.style.top = `${ay}px`;
      lanternArrowIcon.style.transform = `rotate(${angle}rad)`;
      lanternArrowDist.textContent = `${Math.round(nearestUnlitDist)}m`;
      lanternArrow.classList.remove('hidden');
    } else {
      lanternArrow.classList.add('hidden');
    }
  } else {
    lanternArrow.classList.add('hidden');
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
    const fps = Math.round(fpsFrames / fpsAccum);
    hudFps.textContent = `${fps} FPS`;
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

  if (uiMode === 'playing' || uiMode === 'paused') {
    accumulator += frameDt;
    while (accumulator >= DT) {
      const events = sim.step(readInput());
      handleEvents(events);
      accumulator -= DT;
    }
    updateHud();
  } else {
    // Gentle camera orbit on menus/intro
    camYawDeg = (camYawDeg + 8 * frameDt) % 360;
  }

  scene.sync(sim, camYawDeg, frameDt);
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
