# Đảo Đèn Lồng (Lantern Island) — Ba Hòn Đảo

> **Video demo:** *(Sẽ cập nhật link video `.mp4` tại Release `v1.0.0` ở Phase 4)*
>
> Game 3D góc nhìn thứ ba qua **3 Đêm (Đảo Bến · Đảo Cau · Đảo Chuông)**. Người chơi điều khiển **Mây**, người giữ đèn đội nón lá treo đèn lồng nhỏ, thu thập đom đóm để thắp sáng, châm dầu và **giữ đảo sáng (`≥ 60%` đèn)** trước Bóng Mực hút dầu và Gió Lạc cho tới bình minh.

---

## Cài đặt & Chạy (tối đa 3 lệnh)

Yêu cầu: **Node.js ≥ 20** (tương thích macOS, Linux, Windows).

```bash
npm install
npm run build
npm run preview
```

Mở trình duyệt tại địa chỉ hiển thị trên terminal (mặc định `http://localhost:4173`).

---

## Điều khiển

| Phím / Thao tác | Hành động |
|---|---|
| `W` `A` `S` `D` hoặc `↑` `↓` `←` `→` | Di chuyển theo góc nhìn camera (`6.0 m/s`; `7.2 m/s` khi có Bùa Gió) |
| `Space` | Nhảy (`7.0 m/s`, trọng lực `-20 m/s²`) |
| `Shift` | **Lướt (Dash)** (`14 m/s` trong `0.2s`, hồi chiêu `1.5s`, giữ độ cao khi trên không) |
| `E` | Nạp ánh sáng (10 đom đóm thắp mới / 5 thắp lại) hoặc **châm dầu** đèn đang sáng (`+10` dầu/đom đóm) |
| `F` | **Tỏa Sáng (Pulse)** (tốn `3` đom đóm, bán kính 3D `5m`, hồi `3s`, choáng `120 tick`, đẩy `4m`) |
| Kéo chuột trái hoặc `J` / `L` | Xoay camera quanh Mây (độ nhạy chỉnh được trong Cài đặt) |
| `Esc` hoặc `P` | Tạm dừng (dừng hoàn toàn logic, mở menu Tạm dừng / Cài đặt / Chế độ mù màu) |

---

## Luật chơi & Cách tính điểm (`game.contract.json` v1.2)

- **Mục tiêu sống sót tới bình minh (`dawn_survived`):** Đêm 1 (`240s`, cần `≥ 3/5` đèn sáng), Đêm 2 (`270s`, cần `≥ 4/6`), Đêm 3 (`300s`, cần `≥ 5/7`).
- **Nhiên liệu đèn:** Tối đa `100`, tự hao `1.0/giây`. Khi `fuel < 30`, đèn mất vùng an toàn `6m`, nhấp nháy `1 Hz`, và Bóng Mực ở `wander` sẽ tiến lại **hút dầu (`drain`, `-5/giây`)**. Hết dầu đèn tắt (`ever_lit = true`), thắp lại chỉ cần `5` đom đóm.
- **Sức chứa tăng dần:** `10 + 2 × số lần thắp thành công trong Đêm` (tối đa `20`).

| Sự kiện | Điểm |
|---|---:|
| Mỗi đom đóm nạp vào đèn (thắp mới / thắp lại / châm dầu) | `+5` |
| Thắp đèn lần đầu (`relight: false`) | `+100` |
| Thắp lại đèn đã từng sáng (`relight: true`) | `+40` |
| Bóng Mực trúng Tỏa Sáng (`pulse`) | `+5` (hoặc **`+15`** nếu đang `drain`) |
| Bình minh (chỉ khi thắng): mỗi đèn đang sáng | `+50 + floor(fuel)` |
| Bình minh (chỉ khi thắng): mỗi Ngọn Lửa còn lại | `+50` |

---

## Kiểm thử & Chế độ Headless (Test Contract v1.2)

```bash
# Chạy build + 24 unit/regression/v1.2 tests + kịch bản headless Phase 3 + benchmark 18.000 ticks + determinism
npm run verify

# Chạy trực tiếp chế độ headless cho Đêm 1, 2 hoặc 3
node dist-headless/headless/cli.js --seed 42 --night 3 --ticks 1800 --snapshot-every 60 --out tmp/out.jsonl
```

- Hợp đồng chuẩn: [game.contract.json](game.contract.json) (`contract_version: "1.2"`)
- Quyết định thiết kế (ADR) & Breaking Changes: [docs/notes/ADR-001-lantern-fuel-and-dawn-win.md](docs/notes/ADR-001-lantern-fuel-and-dawn-win.md) · [CHANGELOG.md](CHANGELOG.md)
- Bằng chứng từng phase: [Phase 1](docs/proof/phase-1/README.md) · [Phase 2](docs/proof/phase-2/README.md) · [Phase 3](docs/proof/phase-3/README.md)
- Đánh giá & Nhật ký AI: [docs/notes/phase-3-eval.md](docs/notes/phase-3-eval.md) · [docs/notes/ai-log.md](docs/notes/ai-log.md)

---

## Sáng tạo của tôi

Mọi yếu tố sáng tạo được cô lập hoàn toàn trong `src/client/`, **không** ảnh hưởng tới `src/core/` hay đầu ra headless:

1. **Mây với nón lá, đèn lồng vành nón & đom đóm bay quanh người**, kết hợp **bến gỗ/thuyền Đảo Bến**, **chuông vàng Tháp Chuông Đảo Chuông** và **lá bay theo hướng gió mạnh**.
2. **Trực quan hóa nhiên liệu & Hỗ trợ mù màu:** Đèn tắt xẹp 20% kèm vết rách giấy, đèn sáng có thanh dầu 3D xoay theo camera, nhấp nháy 1 Hz khi yếu, và cài đặt *"Bảng màu dễ phân biệt"* (`#00B3FF` cho Bóng Mực, `#FFFFFF` + `⚠` cho cảnh báo UI).
3. **Âm thanh Web Audio tự sinh hoàn toàn:** Nhạc nền đêm ngũ cung + đủ bộ hiệu ứng âm thanh (không dùng tệp ngoài).

**Bằng chứng không phá phần lõi:** `npm run verify` đạt **24/24 test xanh**, mọi kịch bản headless Phase 3 pass, trọn Đêm 3 (`18.000 ticks`) chạy trong **179 ms** và giống hệt từng byte qua 2 lần chạy (`57.375 bytes`).
