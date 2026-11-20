# Đảo Đèn Lồng (Lantern Island) — Ba Hòn Đảo

> **Video demo:** *(Sẽ cập nhật link video `.mp4` tại Release `v1.0.0` ở Phase 4)*
>
> Game 3D góc nhìn thứ ba qua **3 Đêm (Đảo Bến · Đảo Cau · Đảo Chuông)**. Người chơi điều khiển **Mây**, người giữ đèn đội nón lá treo đèn lồng nhỏ, thu thập đom đóm, tận dụng Bùa Gió & bục nhảy, né Bóng Mực và Gió Lạc để thắp sáng toàn bộ Đèn Lồng Lớn trước bình minh.

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
| `E` | Nạp đom đóm vào Đèn Lồng Lớn chưa sáng gần nhất (trong `2.0m`, `10` đom đóm/đèn) |
| `F` | **Tỏa Sáng (Pulse)** (tốn `3` đom đóm, bán kính 3D `5m`, hồi `3s`, choáng `120 tick`, đẩy `4m`) |
| Kéo chuột trái hoặc `J` / `L` | Xoay camera quanh Mây (độ nhạy chỉnh được trong Cài đặt) |
| `Esc` hoặc `P` | Tạm dừng (dừng hoàn toàn logic, mở menu Tạm dừng / Cài đặt) |

---

## Cách tính điểm & Thông số chuẩn (`game.contract.json` v1.1)

| Sự kiện | Điểm | Ghi chú |
|---|---:|---|
| Nạp 1 đom đóm vào Đèn Lồng (`deposit`) | `+10` | Sức chứa tối đa `10` đom đóm; mỗi đèn cần `10` |
| Thắp sáng 1 Đèn Lồng Lớn (`lantern_lit`) | `+100` | Đêm 1: 5 đèn · Đêm 2: 6 đèn · Đêm 3: 7 đèn |
| Bóng Mực trúng Tỏa Sáng (`pulse`) | `+5` | Tính cho mỗi con mỗi lần trúng (kể cả đang choáng) |
| Thưởng thời gian còn lại khi thắng | `+2 / giây` | `Math.floor(time_left_s) * 2` |
| Thưởng Ngọn Lửa còn lại khi thắng | `+50 / lửa` | `flames * 50` (hồi đầy `3` lửa đầu mỗi Đêm) |

Tổng điểm hành trình là tổng điểm của các Đêm đã thắng.

---

## Kiểm thử & Chế độ Headless (Test Contract v1.1)

```bash
# Chạy build + 18 unit/contract/regression tests + 7 kịch bản headless + benchmark 21.600 ticks + determinism
npm run verify

# Chạy trực tiếp chế độ headless cho Đêm 1, 2 hoặc 3
node dist-headless/headless/cli.js --seed 42 --night 3 --ticks 1800 --snapshot-every 60 --out tmp/out.jsonl
```

- Hợp đồng chuẩn: [game.contract.json](game.contract.json) (`contract_version: "1.1"`)
- Đặc tả & tiêu chí nghiệm thu Phase 2: [docs/notes/phase-2-spec.md](docs/notes/phase-2-spec.md)
- Bằng chứng Phase 1 & 2: [docs/proof/phase-1/README.md](docs/proof/phase-1/README.md) · [docs/proof/phase-2/README.md](docs/proof/phase-2/README.md)
- Đánh giá & Nhật ký AI: [docs/notes/phase-2-eval.md](docs/notes/phase-2-eval.md) · [docs/notes/ai-log.md](docs/notes/ai-log.md)

---

## Sáng tạo của tôi

Mọi chi tiết sáng tạo đều được tách hoàn toàn ở tầng hiển thị/âm thanh (`src/client/`), **không** ảnh hưởng đến `src/core/` hay đầu ra headless:

1. **Mây với nón lá & đèn lồng treo vành nón + đom đóm bay quanh người:** Số đốm sáng bay quanh Mây phản ánh trực quan số đom đóm đang mang (`0..10`), kèm nhấp nháy bất tử sau khi bị đánh.
2. **Dấu ấn từng hòn đảo & hiệu ứng gió lá bay:** Bến gỗ & thuyền nhỏ ở Đảo Bến, chuông vàng trên đỉnh Tháp Chuông Đảo Chuông, hạt lá vàng bay theo đúng hướng gió trước 2 giây và trong cơn gió mạnh ở Đêm 3.
3. **Âm thanh Web Audio tự sinh hoàn toàn (không cần asset ngoài):** Nhạc nền ngũ cung ban đêm + đủ 10 hiệu ứng âm thanh (nhặt, bùa, nhảy, lướt, nạp, thắp đèn, tỏa sáng, bị đánh, Bóng Mực xuất hiện, đếm ngược 10 giây cuối, cảnh báo gió) kết nối với thanh âm lượng lưu `localStorage`.

**Bằng chứng không phá phần lõi:** `npm run verify` đạt 18/18 test xanh, 7 kịch bản headless pass, trọn Đêm 3 (`21.600 ticks`) chạy trong `85 ms` và giống hệt từng byte qua 2 lần chạy (`21.422 bytes`).
