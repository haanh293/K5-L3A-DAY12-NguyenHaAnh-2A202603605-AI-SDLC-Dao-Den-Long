# Bằng chứng kiểm chứng — Phase 1

Mọi bằng chứng dưới đây được sinh tự động bằng lệnh `npm run verify` (khớp mã tại tag `phase-1`, không sửa tay).

## Bảng truy vết Yêu cầu → Bằng chứng

| Mã | Yêu cầu (PRD-0 / Contract v1.0) | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|---|
| AC-1 | Di chuyển theo `cam_yaw_deg`, chuẩn hóa vector, nhảy | Unit test `tests/simulation.test.ts` | `tests/simulation.test.ts` (pass) | Đạt |
| AC-2 | Nhặt đom đóm trong `pickup_radius`, giới hạn sức chứa, cộng điểm | Unit test + Headless win scenario | `out-win.jsonl` (`mote_picked` x3) | Đạt |
| AC-3 | Nạp & thắp đèn bằng rising-edge `interact`, phát `deposit` & `lantern_lit` | Unit test + Headless win scenario | `out-win.jsonl` (`deposit`, `lantern_lit` L1) | Đạt |
| AC-4 | Tỏa sáng `pulse` làm choáng & đẩy lùi Bóng Mực, cooldown | Unit test + Headless pulse scenario | `out-pulse.jsonl` (`stunned_ids: ["S1"]` tại tick 6) | Đạt |
| AC-5 | Bóng Mực đuổi, tránh `safe_radius` quanh đèn sáng, gây sát thương & rơi đom đóm | Unit test `tests/simulation.test.ts` | `tests/simulation.test.ts` (2 tests pass) | Đạt |
| AC-6 | Thắng (`all_lit`), thua (`no_flames`, `dawn`), chơi lại | Unit test + Headless win scenario + Client HUD | `out-win.jsonl` (`state: "won"`, `score: 516`) | Đạt |
| AC-7 | `game.contract.json` khớp code, tính tất định, mã thoát `2` khi sai định dạng | `tests/contract.test.ts` + 2 lần chạy `seed=777` | `out-determinism-run1.jsonl` === `out-determinism-run2.jsonl` (`10566 bytes`) | Đạt |
| BUILD | Biên dịch bản web 3D & headless không lỗi | `npm run build` | `dist/` & `dist-headless/` build xanh (`0` lỗi) | Đạt |

## Lệnh tái lập

```bash
npm run build
npm run verify
```
