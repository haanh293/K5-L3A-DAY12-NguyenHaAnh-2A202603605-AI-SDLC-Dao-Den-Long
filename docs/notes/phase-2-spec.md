# Phase 2 — Đặc tả, Thay đổi từ Phase 1 & Tiêu chí nghiệm thu (Ticket-02 · Contract v1.1)

## 1. Thay đổi so với Phase 1 (Cập nhật giả định & test cũ)

| Hạng mục | Phase 1 (tự chọn) | Phase 2 (Chuẩn Ticket-02) | Lý do cập nhật |
|---|---|---|---|
| `contract_version` | `1.0` | `1.1` | Mở rộng 3 Đêm, Lướt, Bùa Gió, Gió Lạc, Tạm dừng |
| Đảo Đêm 1 & Rơi | `r = 32m`, `fall_enabled: false` | `r = 40m`, `fall_enabled: true` (`Y < -10` rơi, mất hết đom đóm, hồi sinh sau 60 tick) | Đồng bộ bản đồ chuẩn |
| Đom đóm & Đèn | `carry = 5`, `cost = 3`, `pickup = 1.5m`, `interact = 2.5m` | `carry = 10`, `cost = 10`, `pickup = 1.0m` (`ΔY ≤ 1.5m`), `interact = 2.0m`, 20 ban đầu / trần 30 | Đồng bộ cảm giác chơi |
| Tỏa Sáng (Pulse) | `cost = 1`, `r = 6m` (XZ), `stun = 3s`, `cd = 2s`, đẩy tức thì | `cost = 3`, `r = 5m` (3D từ `y + 0.8`), `stun = 120 tick`, `cd = 3s`, đẩy `4m` trong 15 tick | Đồng bộ chuẩn & hỗ trợ nhiều tầng Đêm 3 |
| Điểm số | `+10` lúc nhặt, `+25/stun` | `+10` lúc **nạp vào đèn**, `+5/stun`, `+100/đèn`, thưởng thời gian & lửa | Tránh farm điểm vô hạn khi đánh rơi/cướp đom đóm |
| Rơi đom đóm khi bị đánh | `Math.round(carried * 0.5)` | `Math.floor(carried / 2)` rơi ra vành `1.5–2.5m`, TTL `480 tick`, nhặt từ tick sau | Khớp chính xác Ticket-02 |
| Trạng thái Bóng Mực | `chase`, `stunned` | `spawning`, `wander`, `chase`, `recoil`, `stunned` (phát hiện `12m`, bỏ đuổi `18m`, tốc độ `4.0` / Đêm 3 `4.5`) | Bắt buộc bởi Contract v1.1 |

> **Giả định bổ sung ở Phase 2:**
> - **Điểm xuất phát Đêm 3 (Đảo Chuông):** Vì tâm `(0,0)` là Tầng 2 (`Y=6`) có Tháp Chuông bán kính `2m`, Mây xuất phát tại `(0, 0, -15)` trên Tầng 0 (`Y=0`), quay mặt về `+Z` (nếu scenario truyền `player.pos` thì ưu tiên scenario).
> - **Bóng Mực spawn theo lịch (`tick 300`):** Bắt đầu ở trạng thái `spawning` trong `30 tick` (`0.5s`) rồi chuyển `wander`, đảm bảo không tương tác ngay tick sinh ra.

---

## 2. Tiêu chí nghiệm thu (Acceptance Criteria — Phần 3 & 4)

| Mã | Tính năng | Tiêu chí kiểm chứng được |
|---|---|---|
| AC-P2-1 | **Lướt (Dash)** | Nhấn `Shift` (rising edge `dash`) lướt `14 m/s` trong `12 tick` (`2.8m`), giữ độ cao khi trên không, hồi chiêu `1.5s` (`90 tick`) từ lúc bắt đầu, phát sự kiện `dash {}`. |
| AC-P2-2 | **Rơi & Hồi sinh** | Ra khỏi mặt đất (`Y < -10`) trừ `1` Ngọn Lửa (bỏ qua bất tử), mất hết đom đóm, phát `player_hit {by:"fall", lost}`, chờ `60 tick` rồi hồi sinh tại điểm xuất phát với `90 tick` bất tử; hết lửa thì thua ngay (`no_flames`). |
| AC-P2-3 | **Tạm dừng (`Esc`/`P`)** | Bấm `pause` phát `paused {}`, `state: "paused"`, `sim_tick` và mọi đồng hồ/TTL/cooldown đứng yên trong khi `tick` vẫn tăng; bấm lại phát `resumed {}` và chạy tiếp. UI có Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu. |
| AC-P2-4 | **Đêm 2 — Đảo Cau & Bục nhảy** | Hai đảo `r=28m` tại `(0,0,0)` và `(70,0,0)`, cầu tre `x∈[26,44], z∈[-2,2]`; 2 bục nhảy `(20,0,18)` và `(50,0,-18)` bắn `vy=14, vh=24` đáp an toàn vào đảo đích; 6 đèn `L1..L6`. |
| AC-P2-5 | **Đêm 3 — Đảo Chuông, Dốc, Tầng & Gió** | 3 tầng (`Y=0/3/6`), 2 dốc rộng `3m` ở `30°/150°` (`r=30→24`), bục nhảy `(0,3,13)` lên Tầng 2 (`Y=6`), Tháp Chuông `r=2m` chặn va chạm, 7 đèn `L1..L7`; gió mạnh mỗi `30s` kéo dài `5s` đẩy `2 m/s` báo trước `2s`. |
| AC-P2-6 | **Gió Lạc (Drifters)** | Sinh tại tick `1200, 2400…` tối đa `2` con trên Đêm 2 & 3; `idle (2 m/s) → chase (7 m/s)` khi `carried ≥ 5` và `dist ≤ 15m`; chạm (`≤ 1.2m`) cướp `min(3, carried)` phát `drifter_steal` rồi `flee`; trúng Pulse lúc `chase` → `flee`, lúc `flee` có đồ → thả lại (`drifter_drop`) và biến mất sau `120 tick`. |
| AC-P2-7 | **Bùa Gió (Charms)** | Đêm 2 `(35,0,0)`, Đêm 3 `(±30,0,25)`; nhặt phát `charm_picked`, tăng tốc `7.2 m/s` và Lướt `0s` hồi chiêu trong `600 tick`, xuất hiện lại sau `2700 tick`. |
| AC-P2-8 | **Chuỗi 3 Đêm, Cài đặt, Âm thanh, HUD & Bảng màu** | Menu chính → Giới thiệu Đêm (lời Ông Đăng) → Chơi → Kết quả → Đêm tiếp / Bình Minh (tổng điểm). Lưu âm lượng & độ nhạy chuột trong `localStorage`. Đủ BGM + 10 SFX. Đủ HUD (lửa, đồng hồ đỏ nhấp nháy `≤30s`, đèn & điểm, thanh 10 ô, cooldown Lướt/Tỏa Sáng, nhắc phím `E`, mũi tên chỉ đèn ngoài màn hình). Đúng bảng màu hex chuẩn & ánh sáng môi trường `0.15 + 0.55 × (lit/total)`. |
| AC-P2-9 | **Hiệu năng & Tất định (Contract v1.1)** | Headless chạy trọn Đêm 3 (`21.600 tick`) xong trong `≤ 30s` và 2 lần chạy giống nhau từng byte; bản thường đạt `≥ 30 FPS` ở `1280×720`. |
