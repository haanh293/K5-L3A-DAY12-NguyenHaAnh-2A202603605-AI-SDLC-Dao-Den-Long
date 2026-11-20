# Phase 1 — Giả định & Tiêu chí nghiệm thu (PRD-0)

## 1. Giả định cho các điểm mơ hồ trong PRD-0

| Hạng mục mơ hồ | Giả định đã chọn | Lý do |
|---|---|---|
| Kích thước đảo & rơi khỏi đảo | Đảo tròn bán kính `32m`, `fall_enabled: false` (giữ nhân vật trong đảo; nếu scenario đặt thực thể xa hơn thì tự mở rộng biên để không cản test). | Đơn giản, tránh chết oan ở Phase 1, khớp contract `fall_enabled: false`. |
| Vị trí 5 Đèn Lồng Lớn (Đêm 1) | `L1..L5` xếp đều theo vòng tròn bán kính `20m` quanh gốc `(0,0,0)`. | Dễ định hướng 360° quanh quảng trường trung tâm. |
| Số đom đóm cần thắp 1 đèn & sức chứa | `lantern_cost = 3`, `carry_capacity = 5`. | Người chơi có thể đi 3–4 chuyến là thắp hết 5 đèn trong `180s`. |
| Rơi đom đóm khi bị Bóng Mực chạm | `hit_drop_ratio = 0.5`, số rơi = `Math.round(carried * 0.5)`. | Rõ ràng, nếu mang `1` đom đóm thì rơi `1`, mang `2` rơi `1`, mang `4` rơi `2`. |
| Vùng an toàn quanh đèn (`safe_radius`) | Chỉ áp dụng cho đèn **đã thắp sáng (`lit: true`)**, bán kính `5.0m`. Bóng Mực bị đẩy ra ngoài `5.05m`. | Khớp mô tả "Bóng Mực sợ những chiếc đèn" và tạo động lực thắp đèn sớm. |
| Điều kiện thắng/thua theo thời gian | Đêm 1 dài `180s`. Hết thời gian mà chưa thắp đủ 5 đèn → `game_over` (`lost`, `reason: "dawn"`). | Khớp trường `dawn` trong Test Contract v1.0. |
| Thưởng điểm khi thắng | `Math.floor(time_left_s) * 2 + flames * 50`. | Rõ ràng, hoàn toàn tất định. |

## 2. Tiêu chí nghiệm thu (Acceptance Criteria)

1. **AC-1 (Di chuyển & camera):** Nhận input `move` và `cam_yaw_deg`, di chuyển đúng công thức xoay XZ, chuẩn hóa vector dài hơn 1, nhảy theo trọng lực.
2. **AC-2 (Nhặt đom đóm):** Đi vào bán kính `1.5m` quanh đom đóm tự động nhặt nếu `carried < 5`, phát sự kiện `mote_picked`, cộng `10` điểm.
3. **AC-3 (Nạp & thắp đèn):** Nhấn `interact` (rising edge `false -> true`) trong bán kính `2.5m` quanh đèn chưa sáng để nạp; đủ `3` thì đèn sáng, phát `deposit` & `lantern_lit`, cộng `100` điểm.
4. **AC-4 (Tỏa sáng Pulse):** Nhấn `pulse` (rising edge) khi đủ `1` đom đóm và hết cooldown `2.0s` làm choáng `3.0s` và đẩy lùi `4.0m` Bóng Mực trong `6.0m`, phát `pulse`, cộng `25` điểm/con.
5. **AC-5 (Bóng Mực & sát thương):** Bóng Mực đuổi người chơi ở `3.5 m/s`, không đi vào `safe_radius = 5.0m` quanh đèn đã thắp; chạm trong `1.2m` gây `player_hit`, mất `1` lửa, bất tử `1.5s`, rơi đom đóm.
6. **AC-6 (Thắng / Thua / Chơi lại):** Đủ 5 đèn sáng → `won` (`all_lit`); `flames == 0` → `lost` (`no_flames`); `time_left_s == 0` → `lost` (`dawn`). Có nút/phím chơi lại trên giao diện.
7. **AC-7 (Headless & Tính tất định):** Chạy 60 tick/s không cần GPU, thoát mã `0` (hoặc `2` nếu sai định dạng inputs/scenario), 2 lần chạy cùng seed cho output giống hệt từng byte.
