# Đánh giá Phase 2 (Evaluation)

## 1. Kết quả so với Ticket-02 & DoD
- **Đạt:**
  - Chuẩn hóa toàn bộ thông số `game.contract.json` v1.1 & thứ tự 12 bước mỗi tick.
  - Hoàn thiện đủ 3 bản đồ chuẩn (Đảo Bến, Đảo Cau, Đảo Chuông) gồm cầu tre, 3 tầng địa hình, 2 dốc thẳng, 3 bục nhảy, Tháp Chuông, gió mạnh.
  - Hoàn thiện toàn bộ tính năng mới: Lướt, Rơi/Hồi sinh, Tạm dừng, Gió Lạc, Bùa Gió, Chuỗi 3 Đêm (lời Ông Đăng + màn Bình Minh), Cài đặt lưu `localStorage`, BGM + 10 SFX, HUD đầy đủ + mũi tên ngoài màn hình, bảng màu hex chuẩn.
  - Regression Phase 1 (đã cập nhật test kèm lý do cho các luật bị Ticket-02 thay đổi): **18/18 tests xanh**.
  - Headless scenarios: 7 kịch bản riêng cho từng tính năng mới + benchmark trọn Đêm 3 (`21.600 tick` chạy trong **85 ms**, ngưỡng `≤ 30.000 ms`) + determinism giống hệt từng byte (`21.422 bytes`).
- **Điểm cần lưu ý / theo dõi ở Phase sau:**
  - Tiếp tục đo FPS thực tế bản 3D ở độ phân giải `1280×720` kèm cấu hình máy ở Phase 4 khi làm báo cáo hiệu năng cuối cùng.

## 2. Phân tích lỗi AI & cập nhật Harness
- **Lỗi AI phát hiện trong quá trình review trước khi build:**
  1. Ở `src/client/main.ts`, nút `btnResultPrimary` ban đầu vừa có `addEventListener('click', ...)` vừa bị gán thêm `.onclick = startActiveNight` khi thua → sẽ kích hoạt 2 lần nếu không rà soát. Đã gom về 1 listener duy nhất xử lý rõ nhánh `lost` / `won`.
  2. Ở `src/core/simulation.ts`, khi Pulse trúng Gió Lạc đang `flee` có mang đồ, cần đặt `fleeTicksLeft = 120` đúng theo spec thay vì `Math.min`. Đã sửa chính xác.
- **Cập nhật Harness:**
  - Cập nhật [AGENTS.md](../../AGENTS.md) bổ sung quy ước góc XZ (`x = r*cos(a), z = r*sin(a)`), thứ tự 12 bước tick Contract v1.1, danh sách 5 trạng thái Bóng Mực chuẩn, quy tắc PowerShell 5.1, và kỷ luật cập nhật test hồi quy có lý do.
  - Cập nhật [.agents/skills/verify-phase/SKILL.md](../../.agents/skills/verify-phase/SKILL.md) và `.github/workflows/ci.yml` chạy `scripts/verify-phase2.mjs`.
