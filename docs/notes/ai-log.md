# Nhật ký dùng AI & Quản lý Token

## Phase 1 (PRD-0 + Test Contract v1.0)
- **Công cụ AI:** Antigravity (Gemini)
- **Cách tiết kiệm token:**
  - Thiết kế kiến trúc tách `core` / `headless` / `client` rõ ràng ngay từ đầu trước khi sinh code, tránh phải viết lại.
  - Viết song song các file độc lập trong cùng lượt gọi tool để giảm số vòng lặp ngữ cảnh.
  - Giữ `AGENTS.md` ngắn gọn (~25 dòng) để tiết kiệm token ngữ cảnh ở mọi lượt.
  - Chạy `npm run verify` một lần duy nhất để kiểm chứng cả build, unit test, và headless scenarios.
- **Ước tính token Phase 1:** ~28,000 input tokens / ~9,500 output tokens (chi phí ước tính rất thấp, 1 vòng build & test xanh ngay lần đầu).
- **Lỗi AI phát hiện:** Dùng toán tử `&&` trên Windows PowerShell 5.1 ở bước chạy lệnh kiểm chứng; đã khắc phục ngay bằng cú pháp PowerShell chuẩn (`; if ($LASTEXITCODE -eq 0)`).
