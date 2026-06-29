# Hướng dẫn cài đặt nhanh cho client mới (Windows)

Tài liệu tóm tắt tối thiểu để người dùng cuối cài và chạy tool. Chi tiết đầy đủ: [INSTALL-WINDOWS.md](./INSTALL-WINDOWS.md).

---

## Cần tải / cài (một lần)

| Thứ | Bắt buộc? | Cách lấy |
|-----|-----------|----------|
| **ffmpeg** | Có | `winget install Gyan.FFmpeg` |
| **yt-dlp.exe** | Có | [github.com/yt-dlp/yt-dlp/releases](https://github.com/yt-dlp/yt-dlp/releases) |
| **yt-playlist-harvester.exe** | Có | Nhận từ người phát hành, hoặc build từ source (mục B) |
| **.env** | Không | Copy từ `.env.example` nếu cần cấu hình |
| **Node.js** | Chỉ khi build từ source | `winget install OpenJS.NodeJS.LTS` |

Đặt **`yt-playlist-harvester.exe`** và **`yt-dlp.exe`** **cùng một thư mục**.

---

## Cách A — Dùng file `.exe` (khuyến nghị)

```powershell
cd D:\Tool\yt-playlist-harvester
.\yt-playlist-harvester.exe
```

- Server chạy tại **http://localhost:3000**
- Trình duyệt tự mở khi khởi động
- Giữ cửa sổ Terminal mở; đóng cửa sổ = dừng server
- Video tải về thư mục `downloads\` (cạnh file `.exe`)

---

## Cách B — Clone source & build `.exe`

Dành cho người có source code, tự build file thực thi:

```powershell
git clone https://github.com/kienpcdev-afk/yt-playlist-harvester.git
cd yt-playlist-harvester
```

Tải `yt-dlp.exe` vào thư mục project, rồi:

```powershell
npm install
npm run build:exe
.\yt-playlist-harvester.exe
```

Sau `npm run build:exe`, file `yt-playlist-harvester.exe` xuất hiện **ngay trong thư mục gốc project**.

---

## Cấu trúc thư mục khi chạy

```
yt-playlist-harvester/
├── yt-playlist-harvester.exe   ← chạy file này
├── yt-dlp.exe                  ← bắt buộc
├── .env                        ← tùy chọn
├── cookies.txt                 ← tự tạo (Extension / setup)
├── downloads/                  ← tự tạo khi tải video
└── chrome-extension/           ← cài vào Chrome nếu cần cookie
```

---

## Playlist > 100 video (cookie YouTube)

1. Cài Extension Chrome từ thư mục `chrome-extension\` (xem [extention.txt](./extention.txt) hoặc [INSTALL-WINDOWS.md — mục 6](./INSTALL-WINDOWS.md#6-cài-extension-chrome--đồng-bộ-cookie-tự-động))
2. Mở **https://www.youtube.com** (đã đăng nhập Google)
3. Bấm icon Extension → **Cập nhật Cookie về Tool**

---

## Checklist nhanh

```
□ ffmpeg đã cài (winget install Gyan.FFmpeg)
□ yt-dlp.exe + yt-playlist-harvester.exe cùng thư mục
□ Chạy .exe → mở http://localhost:3000
□ (Nếu playlist dài) cài Extension + đồng bộ cookie
```

---

## Xử lý lỗi thường gặp

| Triệu chứng | Cách xử lý |
|-------------|------------|
| `Không chạy được yt-dlp` | Đặt `yt-dlp.exe` cạnh file `.exe` |
| Tải 480p lỗi / không gộp được video | Cài ffmpeg: `winget install Gyan.FFmpeg` |
| Extension: *Không kết nối được Tool* | Chạy lại `.\yt-playlist-harvester.exe`, giữ cửa sổ mở |
| Chỉ thấy 100 video trong playlist | Đồng bộ cookie (mục trên) |

Chi tiết thêm: [INSTALL-WINDOWS.md — mục 10](./INSTALL-WINDOWS.md#10-xử-lý-lỗi-thường-gặp).
