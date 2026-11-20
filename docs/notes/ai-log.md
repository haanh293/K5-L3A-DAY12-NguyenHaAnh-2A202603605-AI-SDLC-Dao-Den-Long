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
- **Cách tiết kiệm token:**
  - Dùng `edit_file` cục bộ trên `maps.ts`, `cli.ts`, `scene.ts`, `main.ts`, `index.html`, `style.css` thay vì viết lại toàn bộ file lớn.
  - Thiết kế đơn vị dầu nguyên `1/60` (`fuelSixtieths`) từ đầu nên 24/24 test (gồm regression Phase 1–2 + 6 test Phase 3) pass ngay lần chạy đầu tiên mà không phải debug sai số số thực!
- **Ước tính token Phase 3:** ~34,000 input / ~13,000 output tokens (hoàn thành trọn gọn trong khung 30 phút).
