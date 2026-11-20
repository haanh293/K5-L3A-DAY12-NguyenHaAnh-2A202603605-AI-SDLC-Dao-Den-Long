# CHANGELOG

Tất cả các thay đổi quan trọng của **Đảo Đèn Lồng** qua các Phase.

## [v1.0.0 / Phase 4] — Contract v1.3 ("Bình minh: phát hành v1.0.0")
### Added
- **Contract v1.3:** Bổ sung `bench_cmd` (`node scripts/bench.mjs`) và `soak_cmd` (`node --expose-gc scripts/soak.mjs`) vào `game.contract.json`; cập nhật `run_cmd` sang `node scripts/run-app.mjs` hỗ trợ lưu đĩa cục bộ & xuất bảng xếp hạng (`--export-leaderboard`).
- **Chế độ Benchmark chuẩn (`?bench=1`):** Cửa sổ `1280×720`, tắt vsync (`--disable-frame-rate-limit --disable-gpu-vsync`), Đêm 1 với đúng `200` Bóng Mực `wander` (seed 42), `100` đom đóm, `L1–L3` sáng fuel 100, tắt sáng tạo thêm, camera quỹ đạo `r=30m, Y=15m` (`15s`/vòng), `3s` khởi động + đo `--duration` giây, xuất `bench.json`.
- **Soak Test 10 Đêm liên tiếp (`scripts/soak.mjs`):** Chạy xoay vòng Đêm `1 → 2 → 3` (`seed = 7 + i`), input ngẫu nhiên theo seed (30 tick đổi hướng, 5% nhảy, 3% lướt, 2% tỏa sáng, 10% tương tác), đo RSS trước/sau, xuất `soak.json`.
- **Bảng xếp hạng cục bộ:** Lưu top 10 trên đĩa (`data/leaderboard.json`, kèm fallback `localStorage`), nhập tên `3–12` ký tự `[A-Za-z0-9_]` (hỗ trợ tiếng Việt có dấu) sau màn Bình Minh hoặc khi thua, xem từ menu chính, xuất JSON qua `<run_cmd> --export-leaderboard out.json`.
- **Dễ tiếp cận (Accessibility):**
  - Đổi phím cho tất cả 9 hành động, phát hiện trùng phím và có nút *Khôi phục mặc định* (lưu `localStorage`).
  - Phụ đề & chỉ báo hình ảnh cho: Bóng Mực xuất hiện (kèm mũi tên mép màn hình), gió sắp thổi, 10 giây cuối, đèn `fuel < 30`.
  - Tùy chọn *Giảm chuyển động* (tắt rung camera, chớp màn hình, nhấp nháy đồng hồ).
  - Cỡ chữ UI tối thiểu `18px` ở `1280×720` kèm tùy chọn *Chữ lớn (×1.25)*.
- **Retro tổng kết 4 phase:** [docs/notes/RETRO.md](docs/notes/RETRO.md).

### Performance
- Chuyển render Bóng Mực & Đom đóm sang `THREE.InstancedMesh` (giảm từ ~800 xuống ~12 draw calls trong cảnh bench 200 Shades + 100 Motes).
- Loại bỏ cấp phát mảng `.filter().sort()` trong `findNearestLantern()` và object `prevInput` mỗi tick, giữ mức tăng bộ nhớ Soak Test ổn định (`≤ 1.2×`).

## [Phase 3] — Contract v1.2 ("Đèn cạn dầu" — Change Request)
### Breaking Changes (Thay đổi phá vỡ tương thích so với v1.1)
- **Contract version:** `1.1` → `1.2` (`game.contract.json` thêm `fuel_max`, `fuel_decay_per_s`, `fuel_per_mote`, `relight_cost`, `win_ratio`, `drain_per_s`, `low_fuel_threshold`, `capacity_max`).
- **Thời lượng 3 Đêm rút ngắn:** Đêm 1 `300 → 240s`, Đêm 2 `330 → 270s`, Đêm 3 `360 → 300s`.
- **Luật thắng thay thế hoàn toàn (`all_lit` → `dawn_survived`):**
  - Thắp đủ toàn bộ đèn **không còn kết thúc Đêm sớm**.
  - Người chơi thắng khi sống sót tới lúc hết giờ (`time_left_s === 0`) và số đèn đang sáng `≥ ceil(0.6 × tổng đèn)` (Đêm 1: `3/5`, Đêm 2: `4/6`, Đêm 3: `5/7`).
  - `game_over.reason` dùng `dawn_survived` (thắng), `dawn` hoặc `no_flames` (thua); lý do `all_lit` bị loại bỏ.
- **Mô hình nhiên liệu đèn & Châm dầu:**
  - Đèn đang sáng hao dầu `1.0/giây` (`1/60` mỗi tick); cạn (`fuel ≤ 0`) thì tắt (`lantern_out`, `deposited = 0`, `ever_lit = true`), thắp lại chỉ cần `5` đom đóm.
  - Bấm Tương tác ở đèn đang sáng chưa đầy dầu sẽ **châm dầu** (`used = min(carried, ceil((100 - fuel)/10))`, phát `refuel`).
- **Bóng Mực hút dầu (`drain`):**
  - Đèn có `fuel < 30` mất vùng an toàn `6m` (đúng `30.0` vẫn còn).
  - Bóng Mực ở `wander` ưu tiên đi tới đèn sáng có `fuel < 30` gần nhất, cách `≤ 2m` chuyển sang trạng thái mới `drain` hút `5 fuel/giây` (cộng dồn, phát `fuel_drain` mỗi 60 tick).
- **Công thức điểm thay thế hoàn toàn:**
  - Nạp đom đóm (thắp mới / thắp lại / châm dầu): `+10 → +5`.
  - Thắp lần đầu: `+100`; thắp lại: `+40` (`lantern_lit.relight: true`).
  - Tỏa Sáng trúng Bóng Mực: `+5`, hoặc **tổng `+15`** nếu Bóng Mực đang ở trạng thái `drain`.
  - Khi thắng lúc bình minh: `+(50 + floor(fuel))` cho mỗi đèn đang sáng + `+50` cho mỗi Ngọn Lửa còn lại. **Bỏ thưởng thời gian (`per_second_left: 0`)**.
- **Snapshot / Scenario v1.2:** `player` thêm `capacity` (và `successful_lights` trong scenario); `lanterns[]` thêm `fuel` (1 chữ số thập phân), `ever_lit`, `relit_count`; `shades[]` thêm trạng thái `drain` & `target_lantern_id`.

### Added (Tính năng mới)
- **Sức chứa tăng dần:** `capacity = min(20, 10 + 2 × successful_lights)` (reset đầu mỗi Đêm).
- **Chế độ mù màu ("Bảng màu dễ phân biệt"):** lưu `localStorage`; viền & mắt Bóng Mực `#7A3CFF → #00B3FF`, cảnh báo UI `#FF5A5F → #FFFFFF` kèm `⚠`.
- **Phân biệt đèn không cần màu:** đèn tắt xẹp `20%` kèm vết rách trên thân giấy; đèn sáng có thanh dầu 3D nổi phía trên và nhấp nháy chậm `1 Hz` khi `fuel < 30`.

---

## [Phase 2] — Contract v1.1 ("Ba hòn đảo")
- Đồng bộ toàn bộ thông số chuẩn (`game.contract.json` v1.1) & thứ tự 12 bước mỗi tick.
- Mở rộng thành 3 Đêm chuẩn: Đảo Bến (`r=40`), Đảo Cau (2 đảo + cầu tre + 2 bục nhảy), Đảo Chuông (3 tầng + 2 dốc + bục nhảy + Tháp Chuông + gió mạnh).
- Thêm Lướt (Dash), Rơi/Hồi sinh (`fall_enabled: true`), Tạm dừng (`Esc`/`P`), Gió Lạc (Drifters), Bùa Gió (Charms), Chuỗi 3 Đêm (lời Ông Đăng + Bình Minh), Cài đặt `localStorage`, BGM + 10 SFX, HUD đầy đủ + mũi tên ngoài màn hình, bảng màu hex chuẩn.

## [Phase 1] — Contract v1.0 (PRD-0)
- Bản chơi được 3D đầu tiên Đêm 1 (Đảo Bến), chế độ headless tất định 60Hz, Harness AI (`AGENTS.md`, skill, CI).
