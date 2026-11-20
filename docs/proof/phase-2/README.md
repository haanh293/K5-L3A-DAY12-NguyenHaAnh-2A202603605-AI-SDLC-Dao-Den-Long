# Bằng chứng kiểm chứng — Phase 2 (Contract v1.1)

Mọi bằng chứng dưới đây được sinh tự động bằng lệnh `npm run build` và `npm run verify` (khớp mã tại tag `phase-2`, không sửa tay).

## Bảng truy vết Yêu cầu → Bằng chứng

| Mã | Yêu cầu (Ticket-02 / Contract v1.1) | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|---|
| REG-P1 | Regression Phase 1 với số liệu chuẩn (`game.contract.json` v1.1, di chuyển, nhặt/nạp/thắp đèn, pulse, safe zone 6m, thua hết giờ) | `tests/contract.test.ts` + `tests/simulation.test.ts` | 11/11 tests pass (`npm test`) | Đạt |
| AC-P2-1 | Lướt (`14 m/s`, `12 tick`, giữ độ cao trên không, hồi chiêu `1.5s`, sự kiện `dash`) | Unit test + Headless scenario | `out-dash.jsonl`, `tests/phase2.test.ts` | Đạt |
| AC-P2-2 | Rơi khỏi đảo (`Y < -10`, mất hết đom đóm, `player_hit {by:"fall", lost}`, hồi sinh sau `60 tick` kèm `90 tick` bất tử) | Unit test + Headless scenario | `out-fall.jsonl` (`lost: 4`), `tests/phase2.test.ts` | Đạt |
| AC-P2-3 | Tạm dừng (`Esc`/`P`: `tick` tăng, `sim_tick` & thời gian đứng yên, `paused`/`resumed`) | Unit test + Headless scenario | `out-pause.jsonl` (`tick=10, sim_tick=5, state="paused"`) | Đạt |
| AC-P2-4 | Đêm 2 — Đảo Cau (2 đảo, cầu tre, bục nhảy `(20,0,18)` đáp vào Đảo B) | Unit test + Headless scenario | `out-jump-pad.jsonl`, `tests/phase2.test.ts` | Đạt |
| AC-P2-5 | Đêm 3 — Đảo Chuông (3 tầng, 2 dốc 30°/150°, bục nhảy lên tầng 2 `Y=6`, gió mạnh tại tick `1800`) | Unit test + Headless scenario | `out-night3-wind.jsonl` (`Y=6` tại tick 60, `wind.active=true`), `tests/phase2.test.ts` | Đạt |
| AC-P2-6 | Gió Lạc (`idle → chase → flee`, cướp `min(3, carried)` phát `drifter_steal`, trúng Pulse lúc `flee` phát `drifter_drop` thả lại đom đóm rơi) | Unit test + Headless scenario | `out-drifter.jsonl`, `tests/phase2.test.ts` | Đạt |
| AC-P2-7 | Bùa Gió (`C1`/`C2`, tăng tốc `7.2 m/s`, Lướt `0s` hồi chiêu trong `600 tick`, phát `charm_picked`) | Unit test + Headless scenario | `out-charm.jsonl`, `tests/phase2.test.ts` | Đạt |
| AC-P2-8 | Chuỗi 3 Đêm, Cài đặt `localStorage`, BGM + 10 SFX, HUD đầy đủ + mũi tên ngoài màn hình, bảng màu chuẩn & ambient `0.15 + 0.55*(lit/total)` | Build web + rà soát mã `src/client/` & `index.html` | `dist/` build xanh (`0` lỗi), `PALETTE` khớp chính xác hex chuẩn | Đạt |
| AC-P2-9 | Hiệu năng headless trọn Đêm 3 (`21.600 tick ≤ 30s`) & Tính tất định 2 lần chạy | `scripts/verify-phase2.mjs` (`seed=999`) | **85 ms** (`≤ 30.000 ms`), giống từng byte (`21.422 bytes`) | Đạt |

## Lệnh tái lập

```bash
npm run build
npm run verify
```
