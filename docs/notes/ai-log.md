# Nhật ký dùng AI & Quản lý Token

## Phase 1 (PRD-0 + Test Contract v1.0)
- **Công cụ AI:** Antigravity (Gemini)
- **Cách tiết kiệm token:**
  - Thiết kế kiến trúc tách `core` / `headless` / `client` rõ ràng ngay từ đầu trước khi sinh code, tránh phải viết lại.
  - Viết song song các file độc lập trong cùng lượt gọi tool để giảm số vòng lặp ngữ cảnh.
  - Giữ `AGENTS.md` ngắn gọn (~25 dòng) để tiết kiệm token ngữ cảnh ở mọi lượt.
  - Chạy `npm run verify` một lần duy nhất để kiểm chứng cả build, unit test, và headless scenarios.
- **Ước tính token Phase 1:** ~28,000 input tokens / ~9,500 output tokens.
- **Lỗi AI phát hiện:** Dùng toán tử `&&` trên Windows PowerShell 5.1 ở bước chạy lệnh kiểm chứng; đã khắc phục ngay bằng cú pháp PowerShell chuẩn (`; if ($LASTEXITCODE -eq 0)`).

## Phase 2 (Ticket-02 "Ba hòn đảo" · Contract v1.1)
- **Công cụ AI:** Antigravity (Gemini)
- **Cách tiết kiệm token:**
  - Tách riêng phần bản đồ chuẩn và toán học địa hình (dốc 30°/150°, tầng 0/1/2, bục nhảy, cầu tre) vào `src/core/maps.ts` giúp code gọn, dễ kiểm chứng ngay bằng unit test.
  - Rà soát toán học góc tọa độ XZ (`cos/sin`) và quỹ đạo bục nhảy (Đêm 2 & Đêm 3) **trước** khi viết code nên build và pass 18/18 test + 7 kịch bản headless ngay lần chạy đầu tiên (0 vòng debug tốn token).
  - Tự review code sau khi viết phát hiện kịp 2 lỗi logic nhỏ (`btnResultPrimary` duplicate handler, `drifter.fleeTicksLeft = 120`) trước khi build.
- **Ước tính token Phase 2:** ~46,000 input tokens / ~18,000 output tokens (toàn bộ 3 Đêm, HUD, audio, 18 unit tests, 7 headless scenarios và benchmark 21.600 ticks đạt xanh ngay lượt 1).
