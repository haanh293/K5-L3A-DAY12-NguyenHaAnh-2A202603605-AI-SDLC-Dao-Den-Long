# Đảo Đèn Lồng (Lantern Island)

> **Video demo:** *(Sẽ cập nhật link video `.mp4` tại Release `v1.0.0` ở Phase 4)*
>
> Game 3D góc nhìn thứ ba — **Đêm 1: Đảo Bến**. Người chơi điều khiển **Mây**, người giữ đèn đội nón lá treo đèn lồng nhỏ, thu thập đom đóm để thắp sáng 5 Đèn Lồng Lớn và né/xua Bóng Mực trước khi bình minh tới.

---

## Cài đặt & Chạy (tối đa 3 lệnh)

Yêu cầu: **Node.js ≥ 20** (chạy tốt trên macOS, Linux và Windows).

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
| `W` `A` `S` `D` hoặc `↑` `↓` `←` `→` | Di chuyển theo góc nhìn camera |
| `Space` | Nhảy |
| `E` | Nạp đom đóm vào Đèn Lồng Lớn gần nhất (trong bán kính `2.5m`) |
| `F` hoặc `Shift` | Tỏa sáng (Pulse) xua & làm choáng Bóng Mực (tốn `1` đom đóm, hồi `2.0s`) |
| Kéo chuột trái hoặc `J` / `L` | Xoay camera quanh Mây |
| `R` (hoặc nút **Chơi lại**) | Chơi lại sau khi thắng hoặc thua |

---

## Cách tính điểm & Thông số (`game.contract.json`)

| Sự kiện | Điểm | Ghi chú |
|---|---:|---|
| Nhặt 1 đom đóm (`mote_picked`) | `+10` | Sức chứa tối đa `5` đom đóm |
| Thắp sáng 1 Đèn Lồng Lớn (`lantern_lit`) | `+100` | Cần nạp đủ `3` đom đóm mỗi đèn (tổng 5 đèn) |
| Làm choáng 1 Bóng Mực bằng Pulse (`pulse`) | `+25` | Tốn `1` đom đóm, đẩy lùi `4.0m`, choáng `3.0s` |
| Thưởng thời gian còn lại khi thắng | `+2 / giây` | `Math.floor(time_left_s) * 2` |
| Thưởng ngọn lửa còn lại khi thắng | `+50 / lửa` | `flames * 50` (khởi đầu `3` ngọn lửa) |

- **`fall_enabled: false`**: Đảo Bến là hòn đảo tròn bán kính `32m` có hàng rào cọc gỗ bao quanh nên nhân vật không thể rơi khỏi đảo.
- **Rơi đom đóm khi bị chạm (`hit_drop_ratio: 0.5`)**: Khi bị Bóng Mực chạm trong bán kính `1.2m` (và hết thời gian bất tử `1.5s`), Mây mất `1` ngọn lửa và đánh rơi `Math.round(carried * 0.5)` đom đóm.

---

## Kiểm thử & Chế độ Headless (Test Contract v1.0)

```bash
# Chạy toàn bộ build + unit test + scenario headless + kiểm tra tính tất định
npm run verify

# Chạy trực tiếp chế độ headless
node dist-headless/headless/cli.js --seed 42 --night 1 --ticks 300 --snapshot-every 30 --out tmp/out.jsonl
```

- Thông số chuẩn: [game.contract.json](game.contract.json)
- Bằng chứng Phase 1: [docs/proof/phase-1/README.md](docs/proof/phase-1/README.md)
- Giả định & tiêu chí nghiệm thu: [docs/notes/phase-1-assumptions.md](docs/notes/phase-1-assumptions.md)
- Đánh giá Phase 1 & Nhật ký AI: [docs/notes/phase-1-eval.md](docs/notes/phase-1-eval.md) · [docs/notes/ai-log.md](docs/notes/ai-log.md)

---

## Sáng tạo của tôi

Mọi yếu tố sáng tạo đều được tách hoàn toàn ở tầng hiển thị/âm thanh (`src/client/`), **không** tác động tới `src/core/` hay output headless:

1. **Mây với nón lá & đèn lồng treo vành nón + đom đóm bay quanh người:** Số đốm sáng bay quanh Mây phản ánh đúng số đom đóm đang mang (`0..5`).
2. **Bến gỗ & thuyền nhỏ của Đảo Bến + bầu trời sao sáng dần:** Khi thắp từ `0 → 5` Đèn Lồng Lớn, sương mù tím đen tan dần, ánh sáng môi trường chuyển ấm và sao trên trời sáng rõ hơn.
3. **Âm thanh Web Audio tự sinh (procedural SFX):** Hợp âm ngũ cung khi nhặt đom đóm, hợp âm ấm khi thắp đèn, tiếng sóng tỏa sáng và nút bật/tắt âm thanh trên HUD — không cần tải file ngoài.

**Bằng chứng không phá phần lõi:** Chạy `npm run verify` cho kết quả 10/10 unit & contract test xanh và output headless giống nhau từng byte qua 2 lần chạy (`seed=777`, `600 ticks`, `10566 bytes`).
