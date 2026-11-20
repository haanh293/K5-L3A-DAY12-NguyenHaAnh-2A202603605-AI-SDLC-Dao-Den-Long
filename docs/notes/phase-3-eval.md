# Đánh giá Phase 3 (Evaluation)

## 1. Kết quả so với Ticket-03 (Change Request · Contract v1.2) & DoD
- **Đạt 100% DoD:**
  - Hoàn thiện mô hình nhiên liệu nguyên `1/60` (`fuelSixtieths`), hao hụt `1/s`, châm dầu, tắt đèn (`lantern_out`), thắp lại `5` đom đóm (`+40` điểm, `relight: true`).
  - Hoàn thiện Bóng Mực trạng thái `drain` (hút `5/s` trên đèn `fuel < 30`, phát `fuel_drain` mỗi `60 tick`, thưởng `+15` khi trúng Tỏa Sáng lúc đang `drain`, đẩy ra khỏi vùng an toàn khi đèn được châm lên `≥ 30`).
  - Thay thế hoàn toàn luật thắng sang `dawn_survived` (`≥ 60%` đèn sáng lúc hết giờ, không thắng sớm, ưu tiên `no_flames` trên cả tick bình minh) & công thức điểm mới.
  - Sức chứa tăng dần (`10 + 2 × successful_lights`, tối đa `20`), HUD tự mở rộng thanh ô đom đóm theo `capacity`.
  - Chế độ mù màu ("Bảng màu dễ phân biệt", lưu `localStorage`): Bóng Mực `#00B3FF`, cảnh báo `#FFFFFF` kèm `⚠`, đèn tắt xẹp `20%` kèm vết rách, đèn yếu nhấp nháy `1 Hz` + thanh dầu 3D nổi.
  - Có [ADR-001](ADR-001-lantern-fuel-and-dawn-win.md) và [CHANGELOG.md](../../CHANGELOG.md) liệt kê rõ mọi breaking changes.
  - Test cũ bị luật mới thay thế đã được cập nhật rõ lý do (0 test bị skip).
  - **24/24 unit & regression tests xanh** + 4 kịch bản headless Phase 3 + benchmark Đêm 3 & determinism PASS.

## 2. Cập nhật Harness AI
- Cập nhật [AGENTS.md](../../AGENTS.md) lên Contract v1.2, thêm quy tắc bắt buộc tính dầu bằng số nguyên `1/60` và ghi ADR + CHANGELOG khi gặp Change Request.
- Cập nhật [.agents/skills/verify-phase/SKILL.md](../../.agents/skills/verify-phase/SKILL.md) và `.github/workflows/ci.yml` chạy `scripts/verify-phase3.mjs`.
