# Đánh giá Phase 1 (Evaluation)

## 1. Kết quả so với yêu cầu PRD-0 & Test Contract v1.0
- **Đạt:** Toàn bộ 7 tiêu chí nghiệm thu AC-1..AC-7, build headless + web thành công, 10/10 unit & contract test xanh, 3 kịch bản headless (thắng, pulse, tất định) đạt 100%.
- **Chưa đạt / giới hạn hiện tại:** Chưa quay video demo (dự kiến thực hiện ở Phase 4 theo lịch lab); chưa kiểm thử trên máy macOS thật (đã cấu hình GitHub Actions CI chạy trên `ubuntu-latest` để đảm bảo tương thích Linux).

## 2. Phân tích lỗi AI & điều chỉnh Harness
- **Lỗi gặp phải trong Phase 1:** Khi chạy lệnh nối `&&` trên Windows PowerShell 5.1, lệnh bị lỗi cú pháp vì PowerShell 5.1 dùng `;` thay cho `&&`. Đã sửa cách chạy lệnh an toàn bằng kiểm tra `$LASTEXITCODE`.
- **Điểm làm tốt của Harness:**
  - `AGENTS.md` quy định rõ tách `src/core/` khỏi `src/client/`, cấm `Math.random()` trong core, và bắt buộc đồng bộ `game.contract.json`.
  - Tạo skill `.agents/skills/verify-phase/SKILL.md` và script `npm run verify` giúp kiểm chứng 1 lệnh (build + test + headless scenarios + determinism).
  - Thêm CI `.github/workflows/ci.yml` để tự động kiểm chứng trên Ubuntu mỗi lần push/tag.

## 3. Hành động cho Phase 2
- Giữ `AGENTS.md` ngắn gọn, chỉ bổ sung luật mới nếu phát sinh lỗi lặp lại ở Phase 2.
- Chạy hồi quy toàn bộ `tests/` của Phase 1 sau khi tích hợp Ticket-02.
