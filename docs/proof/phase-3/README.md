# Bằng chứng kiểm chứng — Phase 3 (Contract v1.2 · Change Request "Đèn cạn dầu")

Mọi bằng chứng dưới đây được sinh tự động bằng lệnh `npm run build` và `npm run verify` (khớp mã tại tag `phase-3`, không sửa tay).

## Bảng truy vết Yêu cầu → Bằng chứng

| Mã | Yêu cầu (Ticket-03 / Contract v1.2) | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|---|
| REG-P12 | Regression Phase 1–2 không bị thay thế (di chuyển, Dash, Rơi/Hồi sinh, Tạm dừng, Bục nhảy Đêm 2, Bùa Gió, Gió Lạc, Địa hình/Gió Đêm 3) | `tests/contract.test.ts`, `tests/simulation.test.ts`, `tests/phase2.test.ts` | 18/18 tests pass (`npm test`) | Đạt |
| CR-1 | Nhiên liệu đèn (`1/60` mỗi tick), `lantern_out`, `ever_lit`, thắp lại `5` đom đóm (`+40`, `relight: true`) | Unit test + Headless scenario | `out-fuel-relight.jsonl`, `tests/phase3.test.ts` | Đạt |
| CR-2 | Châm dầu `ceil((100-fuel)/10)`, `+5/mote`, đèn đầy bỏ qua, đẩy Bóng Mực ra khỏi vùng `6m` khi châm `≥ 30` | Unit test + Headless scenario | `out-refuel.jsonl`, `tests/phase3.test.ts` | Đạt |
| CR-3 | Bóng Mực `drain` trên đèn `fuel < 30` (`-5/s`, `fuel_drain` mỗi `60 tick`), Pulse lúc đang `drain` thưởng `+15` | Unit test + Headless scenario | `out-shade-drain.jsonl`, `tests/phase3.test.ts` | Đạt |
| CR-4 | Luật thắng `dawn_survived` (`≥ 60%` đèn sáng lúc hết giờ, không thắng sớm `all_lit`, điểm bình minh `50+floor(fuel)` + `50*flames`, `no_flames` ưu tiên trước) | Unit test + Headless scenario | `out-dawn-survived.jsonl`, `tests/phase3.test.ts` | Đạt |
| CR-5 | Sức chứa tăng dần (`10 + 2×successful_lights`, tối đa `20`), HUD mở rộng động | Unit test + Snapshot `player.capacity` | `tests/phase3.test.ts`, `out-fuel-relight.jsonl` | Đạt |
| CR-6 | Chế độ mù màu (lưu `localStorage`, Bóng Mực `#00B3FF`, cảnh báo `#FFFFFF` + `⚠`) & phân biệt đèn không cần màu (xẹp 20%, vết rách, thanh dầu 3D, nhấp nháy `1 Hz`) | Build web + rà soát `src/client/scene.ts`, `main.ts`, `style.css` | `dist/` build xanh (`0` lỗi) | Đạt |
| PERF | Hiệu năng & Tất định trọn Đêm 3 (`18.000 ticks`, `≤ 30s`) | `scripts/verify-phase3.mjs` (`seed=999`) | **179 ms** (`≤ 30.000 ms`), giống từng byte (`57.375 bytes`) | Đạt |

## Lệnh tái lập

```bash
npm run build
npm run verify
```
