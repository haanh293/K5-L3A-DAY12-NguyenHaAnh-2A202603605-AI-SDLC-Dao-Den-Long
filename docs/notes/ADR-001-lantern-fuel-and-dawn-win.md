# ADR-001: Chuyển đổi mô hình trạng thái Đèn Lồng (Nhiên liệu số nguyên 1/60) & Luật thắng Bình Minh

- **Trạng thái:** Accepted (Phase 3 — Ticket-03 · Contract v1.2)
- **Ngày:** 2026-11-20
- **Bối cảnh:** Sau playtest Phase 2, người chơi thắp hết đèn quá nhanh (trong ~2 phút) khiến cuối Đêm thiếu cao trào. Ticket-03 yêu cầu đèn thắp rồi vẫn cạn dầu (`1.0/s`), Bóng Mực có thể hút dầu đèn yếu (`fuel < 30`, `-5.0/s`), có thể châm dầu/thắp lại, và mục tiêu đổi từ "thắp hết thắng ngay" (`all_lit`) sang "giữ sáng ≥ 60% đèn tới bình minh" (`dawn_survived`).

## Quyết định thiết kế

### 1. Biểu diễn nhiên liệu bằng số nguyên đơn vị `1/60` (`fuelSixtieths: 0..6000`)
- **Vấn đề:** Nếu lưu `fuel` bằng số thực IEEE-754 và trừ `1/60` (`0.016666...`) hoặc `5/60` mỗi tick, sau vài nghìn tick sẽ phát sinh sai số tích lũy làm lệch ngưỡng `fuel == 30.0` (vùng an toàn) hoặc `fuel <= 0` (tắt đèn) hoặc công thức `ceil((100 - fuel) / 10)`.
- **Giải pháp:** Lưu trường nội bộ `fuelSixtieths: number` (số nguyên trong `[0, 6000]`):
  - Đầy dầu: `6000`; ngưỡng yếu: `< 1800` (`1800` tương ứng đúng `30.0` → vẫn giữ vùng an toàn).
  - Tự hao: `-1`/tick; mỗi Bóng Mực `drain`: `-5`/tick (cộng dồn).
  - Châm dầu: `used = Math.min(carried, Math.ceil((6000 - fuelSixtieths) / 600))`, cộng `used * 600` (chặn trên `6000`).
  - Chỉ chia `60` và làm tròn 1 chữ số thập phân khi xuất snapshot/event (`round1(fuelSixtieths / 60)`).
- **Hệ quả:** Tuyệt đối không trôi số thực, đảm bảo tính tất định 100% giữa mọi nền tảng (Windows/Linux/macOS).

### 2. Mở rộng máy trạng thái Đèn Lồng & Bóng Mực
- **Đèn Lồng:** `unlit (everLit=false, cost=10)` → `lit (fuel=6000, safe_zone=true)` → `lit_weak (fuel<1800, safe_zone=false)` → `unlit (everLit=true, cost=5, relitCount++)`. Châm dầu từ `< 1800` lên `≥ 1800` tái kích hoạt đẩy Bóng Mực ra khỏi mép `6m` trong tối đa `30 tick`.
- **Bóng Mực:** Thêm trạng thái thứ 6 là `drain` (kèm `targetLanternId`, `drainTicks`). Ở bước 2 (trước khi di chuyển), trừ nhiên liệu từ mọi Bóng Mực đang `drain`, phát `fuel_drain` mỗi `60 tick`, và tắt ngay đèn có `fuelSixtieths ≤ 0` (`lantern_out`). Ở bước 8, chỉ `wander` tìm đèn sáng `fuel < 30` gần nhất; `chase` không đổi mục tiêu; `drain` chuyển `chase` khi Mây vào `≤ 6m`, chuyển `stunned` (+15 điểm) nếu trúng Pulse, hoặc về `wander` nếu đèn tắt/được châm `≥ 30`/cách `> 2m`.

### 3. Thay thế luật thắng ở Bước 11
- Loại bỏ nhánh thắng sớm `all_lit`.
- Thứ tự ưu tiên cuối mỗi tick (kể cả tick bình minh):
  1. `flames <= 0` → thua `no_flames`.
  2. `timeLeftS <= 0` → nếu `litCount >= ceil(0.6 * totalLanterns)` thì thắng `dawn_survived` (cộng `50 + floor(fuel)` mỗi đèn sáng + `50 * flames`, bỏ thưởng thời gian), ngược lại thua `dawn`.

### 4. Ảnh hưởng lên Test cũ & Cách xử lý
- Test Phase 1 `picks up motes, deposits into lantern... and wins` trong `tests/simulation.test.ts` trước đây kiểm tra thắng sớm `all_lit` và điểm `+10/mote`. Đã **cập nhật có ghi chú rõ lý do** (không skip âm thầm) để xác nhận đèn sáng không thắng sớm, nhận `+5/mote` + `+100` thắp lần đầu và tăng sức chứa `10 → 12`.
- Toàn bộ các test không bị thay thế (di chuyển, cam_yaw, nhảy, Lướt, Rơi/Hồi sinh, Tạm dừng, Bục nhảy Đêm 2, Bùa Gió, Gió Lạc, Địa hình/Dốc/Gió Đêm 3) giữ nguyên 100% và tiếp tục PASS.
