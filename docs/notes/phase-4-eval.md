# Đánh giá Phase 4 (Evaluation — Release v1.0.0)

## 1. Kết quả so với Ticket-04 & DoD
- **Đạt:**
  - `game.contract.json` v1.3 đầy đủ `build_cmd`, `run_cmd`, `headless_cmd`, `bench_cmd`, `soak_cmd`.
  - Benchmark 30s chạy thật trên Chrome ở `1280×720` với `200` Bóng Mực + `100` Đom đóm: `avg_fps = 535.5` (≥ 60), `p1_low_fps = 236.9` (≥ 30), `load_ms = 829 ms` (≤ 10.000 ms), đã commit `bench.json`.
  - Soak test 10 Đêm liên tiếp: `crashes = 0`, `mem = 55.7 → 57.2 MB` (`1.03× ≤ 1.20×`), `0.2s`, đã commit `soak.json`.
  - Bảng xếp hạng cục bộ lưu đĩa (`data/leaderboard.json`) + fallback `localStorage`, hỗ trợ `--export-leaderboard`, đầy đủ tên tiếng Việt & sắp xếp chuẩn.
  - Đủ 4 nhóm Dễ tiếp cận: đổi phím 9 hành động có báo trùng & khôi phục mặc định, phụ đề/mũi tên cảnh báo, giảm chuyển động, cỡ chữ tối thiểu `18px` + tùy chọn chữ lớn `×1.25`.
  - Toàn bộ **28/28 tests** (Phase 1–4) xanh; đủ `README.md` (có ảnh chụp), `CHANGELOG.md` (4 phase), `CREDITS.md`, `LICENSE`, `RETRO.md`.
- **Việc hoàn thiện cuối cùng của tác giả trước giờ chốt:**
  - Quay video demo `.mp4` (< 5 phút) chơi trực tiếp + chạy `npm run verify` + `npm run bench` và đính kèm cùng gói `release/dao-den-long-v1.0.0.zip` lên GitHub Release `v1.0.0`.

## 2. Bài học kỹ thuật nổi bật ở Phase 4
- Dùng `THREE.InstancedMesh` cho Bóng Mực & Đom đóm giảm ~800 draw calls xuống ~12 draw calls, đẩy benchmark từ rủi ro tụt FPS lên **535.5 FPS** ngay trên GPU tích hợp.
- Soak Test bắt được lỗi cấp phát mảng tạm trong `findNearestLantern()` (`1.28×` → sửa thành vòng `for` zero-allocation → giảm còn `1.13×`).
