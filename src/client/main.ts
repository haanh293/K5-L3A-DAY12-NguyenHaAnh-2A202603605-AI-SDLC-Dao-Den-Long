import { DT } from '../core/config.js';
import { GameSimulation, createDefaultInputState } from '../core/simulation.js';
import type { EventLine, TickInputState } from '../core/types.js';
import { SoundEffects } from './audio.js';
import { LanternIslandScene } from './scene.js';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const hudFlames = document.getElementById('hud-flames')!;
const hudCarried = document.getElementById('hud-carried')!;
const hudLanterns = document.getElementById('hud-lanterns')!;
const hudTime = document.getElementById('hud-time')!;
const hudScore = document.getElementById('hud-score')!;
const hudPulseStatus = document.getElementById('hud-pulse-status')!;
const hudToast = document.getElementById('hud-toast')!;
const btnMute = document.getElementById('btn-mute')!;
const overlay = document.getElementById('overlay')!;
const overlayTitle = document.getElementById('overlay-title')!;
const overlaySubtitle = document.getElementById('overlay-subtitle')!;
const overlayScore = document.getElementById('overlay-score')!;
const overlayDetails = document.getElementById('overlay-details')!;
const btnRestart = document.getElementById('btn-restart')!;

const scene = new LanternIslandScene(canvas);
const sfx = new SoundEffects();

let runCounter = 1;
let sim = new GameSimulation({ seed: 101, night: 1 });
let camYawDeg = 0;
let toastTimer = 0;

const keys = new Set<string>();
let dragging = false;
let lastMouseX = 0;

function showToast(msg: string, duration = 2.0): void {
  hudToast.textContent = msg;
  hudToast.classList.remove('hidden');
  toastTimer = duration;
}

function restartGame(): void {
  runCounter += 1;
  sim = new GameSimulation({ seed: 100 + runCounter, night: 1 });
  camYawDeg = 0;
  overlay.classList.add('hidden');
  showToast('Đêm 1 · Đảo Bến — Hãy gom đom đóm thắp sáng 5 Đèn Lồng Lớn!', 3.0);
}

window.addEventListener('keydown', (e) => {
  keys.add(e.code);
  if (e.code === 'KeyR' && sim.state !== 'playing') {
    restartGame();
  }
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
  if (!dragging) return;
  const dx = e.clientX - lastMouseX;
  lastMouseX = e.clientX;
  camYawDeg = (camYawDeg - dx * 0.35 + 360) % 360;
});

btnMute.addEventListener('click', () => {
  sfx.muted = !sfx.muted;
  btnMute.textContent = sfx.muted ? '🔇' : '🔊';
});

btnRestart.addEventListener('click', restartGame);

function readInput(): TickInputState {
  const input = createDefaultInputState();
  let x = 0;
  let z = 0;
  // With camYawDeg = 0, camera looks toward +Z: W = +Z, S = -Z, A = +X (left), D = -X (right)
  if (keys.has('KeyW') || keys.has('ArrowUp')) z += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) z -= 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x += 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x -= 1;

  input.move = [x, z];
  input.cam_yaw_deg = camYawDeg;
  input.jump = keys.has('Space');
  input.interact = keys.has('KeyE');
  input.pulse = keys.has('KeyF') || keys.has('ShiftLeft') || keys.has('ShiftRight');
  return input;
}

function handleEvents(events: EventLine[]): void {
  for (const ev of events) {
    switch (ev.name) {
      case 'mote_picked':
        sfx.motePicked(Number(ev.data.carried ?? 1));
        break;
      case 'deposit':
        sfx.deposit();
        showToast(
          `Đã nạp ${ev.data.amount} ánh sáng vào đèn ${ev.data.lantern_id} (${ev.data.deposited}/${sim.tuning.lantern_cost})`,
          1.6
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
          showToast(`🌟 Tỏa sáng đẩy lùi ${stunned.length} Bóng Mực!`, 1.8);
        }
        break;
      }
      case 'player_hit':
        sfx.playerHit();
        showToast(
          `Bị Bóng Mực chạm! Còn ${ev.data.flames} ngọn lửa (rơi ${ev.data.dropped} đom đóm)`,
          2.0
        );
        break;
      case 'game_over': {
        const won = ev.data.result === 'won';
        sfx.gameOver(won);
        overlay.classList.remove('hidden');
        overlayTitle.textContent = won ? '✨ Đảo Bến Đã Rực Sáng!' : '🌑 Sương Đen Bao Phủ...';
        overlaySubtitle.textContent = won
          ? 'Mây đã thắp sáng tất cả 5 Đèn Lồng Lớn trước bình minh!'
          : ev.data.reason === 'dawn'
            ? 'Bình minh đã tới trước khi mọi đèn lồng được thắp sáng.'
            : 'Mây đã mất hết ngọn lửa hộ mệnh.';
        overlayScore.textContent = `Điểm: ${sim.score}`;
        const litCount = sim.lanterns.filter((l) => l.lit).length;
        overlayDetails.innerHTML =
          `Đèn đã thắp: <strong>${litCount}/${sim.lanterns.length}</strong><br/>` +
          `Ngọn lửa còn lại: <strong>${sim.player.flames}</strong> · Thời gian còn: <strong>${Math.ceil(sim.timeLeftS)}s</strong>`;
        break;
      }
    }
  }
}

function updateHud(): void {
  hudFlames.textContent =
    sim.player.flames > 0 ? '🔥'.repeat(sim.player.flames) : '💨';
  hudCarried.textContent = `${sim.player.carried} / ${sim.tuning.carry_capacity}`;
  const lit = sim.lanterns.filter((l) => l.lit).length;
  hudLanterns.textContent = `${lit} / ${sim.lanterns.length}`;

  const totalSec = Math.ceil(sim.timeLeftS);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  hudTime.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  hudScore.textContent = String(sim.score);

  if (sim.player.pulseCooldown > 0) {
    hudPulseStatus.textContent = `(${sim.player.pulseCooldown.toFixed(1)}s)`;
  } else if (sim.player.carried < sim.tuning.pulse_cost) {
    hudPulseStatus.textContent = `(Cần ${sim.tuning.pulse_cost} đom đóm)`;
  } else {
    hudPulseStatus.textContent = '(Sẵn sàng)';
  }
}

let lastFrameTime = performance.now();
let accumulator = 0;

showToast('Đêm 1 · Đảo Bến — Gom đom đóm và nhấn E gần Đèn Lồng Lớn!', 3.2);

function loop(now: number): void {
  const frameDt = Math.min(0.1, (now - lastFrameTime) / 1000);
  lastFrameTime = now;

  // Keyboard camera rotation (J / L)
  if (keys.has('KeyJ')) camYawDeg = (camYawDeg + 110 * frameDt) % 360;
  if (keys.has('KeyL')) camYawDeg = (camYawDeg - 110 * frameDt + 360) % 360;

  if (toastTimer > 0) {
    toastTimer -= frameDt;
    if (toastTimer <= 0) {
      hudToast.classList.add('hidden');
    }
  }

  accumulator += frameDt;
  while (accumulator >= DT) {
    if (sim.state === 'playing') {
      const events = sim.step(readInput());
      handleEvents(events);
    }
    accumulator -= DT;
  }

  updateHud();
  scene.sync(sim, camYawDeg, frameDt);
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
