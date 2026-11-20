# Retrospective — Đảo Đèn Lồng (Day 12 AI SDLC · Phases 1–4)

## 1. Tổng hợp Evaluation qua 4 Phase

| Phase | Mục tiêu & Contract | Kết quả kiểm chứng | Điểm nổi bật / Thay đổi lớn |
|---|---|---|---|
| **Phase 1** (`phase-1`) | PRD-0 + Contract v1.0 (Đêm 1 Đảo Bến + Headless 60Hz) | 10/10 unit & contract tests xanh; 3 headless scenarios pass; determinism 600 ticks giống từng byte (`10.566 bytes`). | Tách chặt `src/core/` (không dùng `Math.random`/`Date.now`) khỏi `src/client/` ngay từ ngày đầu. |
| **Phase 2** (`phase-2`) | Ticket-02 "Ba hòn đảo" + Contract v1.1 (Chuẩn hóa + 3 Đêm) | 18/18 tests xanh; 7 headless scenarios (Dash, Fall, Pause, Jump Pad, Charm, Drifter, Night 3 Wind); 21.600 ticks chạy **93 ms** (`≤ 30s`). | Chuẩn hóa 12 bước mỗi tick, tách `src/core/maps.ts` cho địa hình 3 tầng + dốc 30°/150° + bục nhảy + bảng màu hex chuẩn. |
| **Phase 3** (`phase-3`) | Ticket-03 Change Request "Đèn cạn dầu" + Contract v1.2 | 24/24 tests xanh (cập nhật test `all_lit` cũ có lý do, 0 test skip); 4 kịch bản v1.2 pass; 18.000 ticks chạy **179 ms**. | Viết [ADR-001](ADR-001-lantern-fuel-and-dawn-win.md) & [CHANGELOG.md](../../CHANGELOG.md); lưu nhiên liệu bằng số nguyên `1/60` (`0..6000`) chống trôi số thực; thêm chế độ mù màu. |
| **Phase 4** (`phase-4` / `v1.0.0`) | Ticket-04 "Bình minh: phát hành v1.0.0" + Contract v1.3 | 28/28 tests xanh; Soak 10 Đêm (`crashes=0`, `mem 1.03x ≤ 1.20x`); Bench 1280×720 (`535.5 avg FPS`, `236.9 p1_low FPS`); Leaderboard cục bộ + Accessibility đầy đủ. | Tối ưu `THREE.InstancedMesh` giảm từ ~800 xuống ~12 draw calls; tối ưu zero-allocation cho `findNearestLantern` giúp Soak Test ổn định bộ nhớ. |

---

## 2. Điều gì hiệu quả & chưa hiệu quả khi làm việc với AI

### Hiệu quả
- **Tách kiến trúc Core vs Client trước khi code:** Vì `src/core/simulation.ts` thuần TypeScript không phụ thuộc Three.js hay DOM, mọi thay đổi lớn ở Phase 2 (3 bản đồ) và Phase 3 (Change Request nhiên liệu + `dawn_survived`) đều được kiểm chứng tự động bằng Vitest & Headless CLI chỉ trong chưa đầy 1 giây.
- **Định nghĩa tiêu chí nghiệm thu & tính toán toán học trước khi viết code:** Rà soát trước quy ước góc XZ (`x = r·cos(a), z = r·sin(a)`), quỹ đạo parabol của 3 bục nhảy (Đêm 2 & 3), và đơn vị dầu nguyên `1/60` giúp 3/4 phase build và pass test ngay ở lần chạy đầu tiên.
- **Tận dụng công cụ chỉnh sửa cục bộ & kiểm chứng 1 lệnh (`npm run verify`):** Giảm mạnh vòng lặp sửa lỗi và giữ ngữ cảnh sạch.

### Chưa hiệu quả / bài học thực tế
- **Chi phí cấp phát bộ nhớ tạm trong vòng lặp 60Hz:** Ở Phase 4, khi chạy Soak Test 10 Đêm liên tiếp (~150.000 tick trong 0.2s), lần chạy đầu tiên ghi nhận RSS tăng `1.28x` (vượt ngưỡng `1.20x`) do `findNearestLantern` dùng `.filter().sort()` và `step()` cấp phát object mới mỗi tick. Chỉ khi chạy đo thật mới phát hiện — chứng minh nguyên tắc *"không đo thật thì chưa biết đạt"*.
- **Khác biệt shell trên Windows PowerShell 5.1:** Toán tử `&&` không chạy được trực tiếp trên PowerShell 5.1, cần chuẩn hóa quy ước `; if ($LASTEXITCODE -eq 0)` ngay trong `AGENTS.md`.

---

## 3. Các lỗi của AI đã phát hiện & cách khắc phục

| Phase | Lỗi AI mắc phải | Cách phát hiện | Cách sửa & cập nhật Harness |
|---|---|---|---|
| Phase 1 | Chạy `npm run build && npm run verify` trên Windows PowerShell 5.1 gây `ParserError`. | Lệnh trả mã lỗi `1` ngay khi thực thi. | Đổi sang `; if ($LASTEXITCODE -eq 0) { ... }` và thêm quy tắc vào `AGENTS.md`. |
| Phase 2 | Tự tạo 2 click listener trên nút `btnResultPrimary` (vừa `addEventListener` vừa gán `.onclick` khi thua) và đặt `drifter.fleeTicksLeft` bằng `Math.min` thay vì `120`. | Review diff code trước khi build. | Gộp thành 1 listener duy nhất phân nhánh rõ `lost`/`won`; gán trực tiếp `DRIFTER_DROP_FLEE_TICKS`. |
| Phase 4 | Soak Test lần đầu có tỉ lệ RSS `1.28x > 1.20x` do cấp phát mảng `.filter().sort()` trong `findNearestLantern` và tạo object `prevInput` mới mỗi tick. | Script `scripts/soak.mjs` tự kiểm tra ngưỡng `1.20x` và trả exit code `1`. | Viết lại `findNearestLantern` bằng vòng `for` zero-allocation, mutate `prevInput` tại chỗ, bỏ qua sort khi danh sách rỗng/1 phần tử, thêm `--expose-gc` → RSS giảm xuống `1.13x`. |

---

## 4. Thành phần Harness AI giúp ích nhiều nhất

1. **`game.contract.json` + unit test đồng bộ (`tests/contract.test.ts`):** Biến các hằng số chuẩn thành ràng buộc tự động không thể vi phạm âm thầm — hiệu quả hơn rất nhiều so với nhắc bằng lời.
2. **Skill `.agents/skills/verify-phase/SKILL.md` + lệnh `npm run verify`:** Ép quy trình kiểm chứng 1 lệnh (build + Vitest + headless scenarios + soak + determinism) trước mọi lần commit/tag.
3. **`AGENTS.md` ngắn gọn (cập nhật dần qua 4 phase):** Giữ thông tin cốt lõi (lệnh build/test, cấm `Math.random`, dầu nguyên `1/60`, thứ tự 12 bước tick, `InstancedMesh`) chỉ trong ~30 dòng, không làm phình ngữ cảnh.
4. **GitHub Actions CI (`.github/workflows/ci.yml`):** Tự động kiểm chứng trên `ubuntu-latest` mỗi lần push/tag, đảm bảo tương thích Linux.

---

## 5. Tổng hợp Token / Chi phí AI & Cách tiết kiệm

| Phase | Ước tính Input Tokens | Ước tính Output Tokens | Ghi chú tối ưu |
|---|---:|---:|---|
| Phase 1 | ~28,000 | ~9,500 | Kiến trúc tách lớp gọn ngay từ đầu, pass lượt 1 |
| Phase 2 | ~46,000 | ~18,000 | Tách `maps.ts`, tính toán quỹ đạo trước khi code |
| Phase 3 | ~34,000 | ~13,000 | Dùng `edit_file` cục bộ, dầu nguyên `1/60` pass lượt 1 |
| Phase 4 | ~52,000 | ~22,000 | Tối ưu `InstancedMesh`, bench/soak/leaderboard/a11y trọn gói |
| **Tổng cộng** | **~160,000** | **~62,500** | **Chi phí ước tính tương đương ~\$0.35–\$0.70** |

**Các chiến lược tiết kiệm token đã áp dụng:**
- Giữ `AGENTS.md` ngắn gọn (~30 dòng) thay vì chép lại toàn bộ đề bài vào ngữ cảnh.
- Dùng model nhẹ (Low) cho hỏi đáp nhanh, model mạnh (High) cho các phase thiết kế/cài đặt lớn.
- Ghi nhiều file độc lập song song trong cùng 1 lượt gọi tool và dùng `edit_file` thay vì ghi đè toàn file khi chỉ sửa 1 khối nhỏ.
- Chạy kiểm chứng theo cụm bằng `npm run verify` thay vì chạy lẻ tẻ nhiều lần.

---

## 6. Nếu làm lại từ đầu sẽ đổi gì?

1. **Thiết kế `InstancedMesh` và zero-allocation cho `step()` ngay từ Phase 1:** Thay vì viết mesh rời cho từng Bóng Mực/Đom đóm rồi refactor ở Phase 4, áp dụng instancing và tránh cấp phát trong vòng lặp 60Hz ngay từ đầu sẽ tiết kiệm thời gian tối ưu hiệu năng.
2. **Dùng Node static server (`scripts/run-app.mjs`) ngay từ Phase 1:** Giúp dễ tích hợp lưu đĩa cục bộ (leaderboard, config) và chụp ảnh tự động sớm hơn.
3. **Chuẩn hóa sẵn cấu trúc snapshot mở rộng:** Tách rõ nhóm trường `world`, `player`, `entities` ngay từ đầu giúp chuyển đổi Contract v1.0 → v1.3 mượt hơn nữa.
