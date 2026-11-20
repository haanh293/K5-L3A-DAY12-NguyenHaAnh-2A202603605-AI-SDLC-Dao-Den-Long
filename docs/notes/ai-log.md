# Nhật ký dùng AI & Quản lý Token

## Phase 1 (PRD-0 + Test Contract v1.0)
- **Công cụ AI:** Antigravity (Gemini)
- **Cách tiết kiệm token:** Thiết kế kiến trúc tách `core` / `headless` / `client` ngay từ đầu; viết song song các file độc lập; giữ `AGENTS.md` ngắn gọn; 1 lệnh `npm run verify`.
- **Ước tính token Phase 1:** ~28,000 input / ~9,500 output tokens.
- **Lỗi AI phát hiện:** Dùng `&&` trên Windows PowerShell 5.1; đã ghi vào `AGENTS.md` để không lặp lại.

## Phase 2 (Ticket-02 "Ba hòn đảo" · Contract v1.1)
- **Công cụ AI:** Antigravity (Gemini)
- **Cách tiết kiệm token:** Tách bản đồ & toán địa hình vào `src/core/maps.ts`; kiểm tra toán quỹ đạo bục nhảy & góc XZ trước khi viết code nên build & pass 18/18 test ngay lần đầu.
- **Ước tính token Phase 2:** ~46,000 input / ~18,000 output tokens.
- **Lỗi AI phát hiện khi tự review:** Trùng listener trên `btnResultPrimary` ở `main.ts` và đặt `fleeTicksLeft` bằng `Math.min` thay vì `120` ở `simulation.ts`; sửa xong trước khi build.

## Phase 3 (Ticket-03 Change Request "Đèn cạn dầu" · Contract v1.2)
- **Công cụ AI:** Antigravity (Gemini)
- **Cách tiết kiệm token:** Dùng `edit_file` cục bộ trên các file client/CLI; dùng đơn vị dầu nguyên `1/60` (`fuelSixtieths`) từ đầu nên 24/24 test pass ngay lượt đầu.
- **Ước tính token Phase 3:** ~34,000 input / ~13,000 output tokens.

## Phase 4 (Ticket-04 "Bình minh: phát hành v1.0.0" · Contract v1.3)
- **Công cụ AI:** Antigravity (Gemini)
- **Cách tiết kiệm token:** Tối ưu `InstancedMesh` ngay khi nâng cấp `scene.ts` để benchmark đạt 535.5 FPS ngay lần chạy đầu; chạy song song viết tài liệu trong lúc Chrome thực thi benchmark 30 giây.
- **Lỗi AI phát hiện qua kiểm chứng thật:** Soak Test lần chạy đầu ghi nhận `mem_end_mb / mem_start_mb = 1.28x` (vượt ngưỡng `1.20x`) do cấp phát `.filter().sort()` trong `findNearestLantern()` và object `prevInput` mỗi tick. Đã tối ưu zero-allocation + `--expose-gc`, giảm xuống `1.13x`.
- **Ước tính token Phase 4:** ~52,000 input / ~22,000 output tokens.

---
**Tổng cộng 4 phase:** ~160,000 input tokens / ~62,500 output tokens. Chi tiết tổng kết xem tại [docs/notes/RETRO.md](RETRO.md).
