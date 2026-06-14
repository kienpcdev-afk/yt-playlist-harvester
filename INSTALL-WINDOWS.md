# Hướng dẫn cài đặt ToolDownload trên Windows

Tài liệu này hướng dẫn từ đầu: nhận source code, cài phần mềm cần thiết, cấu hình và chạy ứng dụng trên **Windows 10 / 11**.

---

## Mục lục

1. [Yêu cầu hệ thống](#1-yêu-cầu-hệ-thống)
2. [Cài phần mềm nền tảng](#2-cài-phần-mềm-nền-tảng)
3. [Lấy source code](#3-lấy-source-code)
4. [Cài đặt & chạy project](#4-cài-đặt--chạy-project)
5. [Cấu hình `.env`](#5-cấu-hình-env)
6. [Sử dụng giao diện web](#6-sử-dụng-giao-diện-web)
7. [Quy tắc đặt tên file](#7-quy-tắc-đặt-tên-file)
8. [Share source cho người khác](#8-share-source-cho-người-khác)
9. [Xử lý lỗi thường gặp](#9-xử-lý-lỗi-thường-gặp)

---

## 1. Yêu cầu hệ thống

| Thành phần | Phiên bản tối thiểu | Ghi chú |
|---|---|---|
| Windows | 10 trở lên | 64-bit |
| Node.js | 18+ | Chạy server Express |
| yt-dlp | Mới nhất | File `yt-dlp.exe` trong thư mục project |
| ffmpeg | Mới nhất | **Bắt buộc** — gộp video + audio thành `.mp4` (480p) |
| Trình duyệt | Chrome / Edge / Firefox | Mở giao diện web |
| Git | 2.x | Tùy chọn — dùng khi clone repo |

---

## 2. Cài phần mềm nền tảng

Mở **PowerShell** hoặc **Terminal** (`Win + X` → *Terminal*).

### 2.1. Cài Node.js

```powershell
winget install OpenJS.NodeJS.LTS
```

Hoặc tải bản **LTS** tại [https://nodejs.org](https://nodejs.org)

Kiểm tra:

```powershell
node -v    # ≥ v18
npm -v
```

---

### 2.2. Tải yt-dlp.exe

Project Windows dùng file **`yt-dlp.exe` đặt ngay trong thư mục project** (cùng cấp `windownserver.js`).

1. Tải từ [https://github.com/yt-dlp/yt-dlp/releases](https://github.com/yt-dlp/yt-dlp/releases)
2. Copy `yt-dlp.exe` vào thư mục project, ví dụ: `D:\Tool\yt-playlist-harvester\yt-dlp.exe`

Kiểm tra:

```powershell
cd D:\Tool\yt-playlist-harvester
.\yt-dlp.exe --version
```

> **Lưu ý:** Không bắt buộc cài yt-dlp vào PATH nếu đã có `yt-dlp.exe` trong thư mục project.

---

### 2.3. Cài ffmpeg

ffmpeg **bắt buộc** để tải 480p (gộp video + audio):

```powershell
winget install Gyan.FFmpeg
```

Kiểm tra:

```powershell
ffmpeg -version
```

---

### 2.4. (Tùy chọn) Cài Git

Chỉ cần nếu clone repo thay vì giải nén ZIP:

```powershell
winget install --id Git.Git -e
```

---

## 3. Lấy source code

### Cách A — Clone Git

```powershell
cd D:\Tool
git clone https://github.com/<ten-user>/<ten-repo>.git yt-playlist-harvester
cd yt-playlist-harvester
```

### Cách B — Giải nén ZIP

Giải nén vào ví dụ `D:\Tool\yt-playlist-harvester`.

### Cấu trúc thư mục sau khi có source

```
yt-playlist-harvester/
├── windownserver.js      # Server Windows — chạy file này
├── server.js             # Server macOS/Linux
├── ytdlp-cookies.js      # Hỗ trợ cookies YouTube
├── download-queue.js     # Tải song song nhiều video
├── ytdlp-log-filter.js   # Lọc log yt-dlp gọn hơn
├── yt-dlp.exe            # ← bạn tự tải và đặt vào đây
├── .env.example          # Mẫu cấu hình
├── package.json
├── public/               # Giao diện web
└── downloads/            # Thư mục tải mặc định (tự tạo)
```

---

## 4. Cài đặt & chạy project

### Bước 1 — Cài dependencies Node.js

```powershell
cd D:\Tool\yt-playlist-harvester
npm install
```

### Bước 2 — Đặt yt-dlp.exe

Đảm bảo file `yt-dlp.exe` nằm trong thư mục project (xem [mục 2.2](#22-tải-yt-dlpexe)).

### Bước 3 — (Khuyến nghị) Tạo file `.env`

```powershell
copy .env.example .env
```

Chỉnh `.env` nếu cần (xem [mục 5](#5-cấu-hình-env)).

### Bước 4 — Khởi động server

```powershell
npm run start:win
```

Hoặc:

```powershell
node windownserver.js
```

> **Quan trọng:** Trên Windows dùng `windownserver.js`, **không** dùng `npm start` (lệnh đó chạy `server.js` cho Mac/Linux).

Khi thành công, terminal hiển thị:

```
Server đang chạy tại http://localhost:3000
Thư mục tải: D:\Tool\yt-playlist-harvester\downloads
Cookies YouTube: chưa cấu hình (...)
Tải song song: 2 video cùng lúc
```

### Bước 5 — Mở trình duyệt

Truy cập: **http://localhost:3000**

### Dừng / chạy lại server

- Dừng: `Ctrl + C`
- Chạy lại sau khi sửa code: `npm run start:win`

---

## 5. Cấu hình `.env`

Copy từ `.env.example`:

```env
PORT=3000

# Số video tải song song (mặc định 2, tối đa 4)
DOWNLOAD_CONCURRENCY=2

# Playlist >100 video — chọn MỘT trong hai cách:

# Cách 1: lấy cookies từ trình duyệt đã đăng nhập YouTube
YTDLP_COOKIES_FROM_BROWSER=edge
# YTDLP_COOKIES_FROM_BROWSER=chrome

# Cách 2: file cookies.txt (Netscape) trong thư mục project
# YTDLP_COOKIES=cookies.txt
```

| Biến | Mặc định | Mô tả |
|---|---|---|
| `PORT` | `3000` | Cổng server |
| `DOWNLOAD_CONCURRENCY` | `2` | Số video tải đồng thời (1–4) |
| `YTDLP_COOKIES_FROM_BROWSER` | — | `edge`, `chrome`, `firefox`… |
| `YTDLP_COOKIES` | `cookies.txt` | Đường dẫn file cookies Netscape |

### Cookies cho playlist >100 video

YouTube thường chỉ cho yt-dlp xem **100 video đầu** nếu không có cookies.

**Cách 1 (dễ nhất):** Đăng nhập YouTube trên Edge/Chrome, thêm vào `.env`:

```
YTDLP_COOKIES_FROM_BROWSER=edge
```

**Cách 2:** Cài extension xuất cookies (Netscape), lưu `cookies.txt` vào thư mục project.

> **Không share** file `cookies.txt` hoặc `.env` — chứa thông tin đăng nhập cá nhân.

---

## 6. Sử dụng giao diện web

1. Dán **URL Playlist YouTube**
2. Nhập **Từ video thứ (X)** và **Đến video thứ (Y)** — đếm từ **1**
3. Chọn độ phân giải: **480p** (mặc định) / 720p / 1080p
4. *(Tùy chọn)* Thư mục lưu:
   - `.\downloads` — mặc định
   - `D:\Videos\YouTube` — ổ khác
5. Bấm **Bắt đầu tải hàng loạt**
6. Theo dõi log và thanh tiến trình

### Gợi ý tải batch lớn (50–100 video)

- Giữ `DOWNLOAD_CONCURRENCY=2`
- Chia nhỏ: #1–#25, #26–#50, …
- Bật cookies nếu vượt quá video #100
- Nếu hay thấy `Sleeping 5 seconds` → hạ `DOWNLOAD_CONCURRENCY=1`

---

## 7. Quy tắc đặt tên file

Ví dụ video #120, tiêu đề *"Anh cần em"*:

```
120.jpg                        ← ảnh bìa (chỉ số thứ tự)
120 Anh cần em.mp4             ← video (số thứ tự + tiêu đề)
```

| Quy tắc | Chi tiết |
|---|---|
| STT | Vị trí gốc trong playlist; `01`–`99` có 2 chữ số, `100+` giữ nguyên |
| Tiêu đề | Lấy từ playlist (nhanh); có thể là bản dịch tùy tài khoản YouTube |
| Ký tự bị xóa | `\ / : * ? " < > \|` |

---

## 8. Share source cho người khác

### Người share cần gửi

| Gửi | Không gửi |
|---|---|
| Toàn bộ source (trừ `node_modules/`, `downloads/`) | `node_modules/` |
| File `.env.example` | `.env`, `cookies.txt` |
| Hướng dẫn link tới file này | Video đã tải trong `downloads/` |

### Người nhận cần tự cài/tải

1. **Node.js** LTS
2. **ffmpeg**
3. **`yt-dlp.exe`** → đặt vào thư mục project
4. Chạy `npm install`
5. Copy `.env.example` → `.env` (tùy chọn)
6. Chạy `npm run start:win`

### Checklist nhanh cho người nhận

```powershell
# 1. Cài công cụ (một lần)
winget install OpenJS.NodeJS.LTS
winget install Gyan.FFmpeg

# 2. Giải nén / clone source, đặt yt-dlp.exe vào thư mục project

# 3. Cài & chạy
cd D:\Tool\yt-playlist-harvester
npm install
copy .env.example .env
npm run start:win

# 4. Mở trình duyệt: http://localhost:3000
```

---

## 9. Xử lý lỗi thường gặp

### Bảng tra nhanh

| Triệu chứng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| `'node' is not recognized` | Chưa cài Node.js hoặc chưa mở lại Terminal | Cài Node LTS, đóng/mở lại Terminal |
| `npm : running scripts is disabled` | PowerShell chặn script | [9.1](#91-npm--running-scripts-is-disabled) |
| `Cannot find module 'express'` | Chưa `npm install` | Chạy `npm install` trong thư mục project |
| `Cannot find module './ytdlp-cookies.js'` | Copy source thiếu file | Copy đủ toàn bộ file `.js` trong repo |
| Server chạy nhưng tải lỗi / 404 | Dùng nhầm `npm start` (Mac) | Dùng `npm run start:win` |
| `Không chạy được yt-dlp` | Thiếu `yt-dlp.exe` trong project | [9.3](#93-không-chạy-được-yt-dlp) |
| Có `.webm` nhưng không có `.mp4` | Thiếu ffmpeg | [9.6](#96-video-tải-nhưng-không-có-mp4--lỗi-merge) |
| Chỉ thấy 100 video / lỗi #101+ | Thiếu cookies YouTube | [9.5](#95-không-có-video-nào-trong-khoảng-101101-yt-dlp-chỉ-thấy-100-video) |
| File `01 video.mp4` | Playlist không trả tiêu đề | [9.4](#94-file-tên-01-videomp4-không-có-tiêu-đề) |
| `Sleeping 5.00 seconds` | YouTube rate limit | [9.7](#97-download-sleeping-500-seconds-as-required-by-the-site) |
| `n challenge solving failed` / `Only images are available` | yt-dlp thiếu JS runtime | [9.17](#917-n-challenge-solving-failed--only-images-are-available) |
| `EADDRINUSE :3000` | Port 3000 bị chiếm | [9.9](#99-port-3000-đã-bị-sử-dụng-eaddrinuse) |

---

### 9.1. `npm : running scripts is disabled`

PowerShell chặn script — chạy **một lần** (Administrator):

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

### 9.2. `HTTP 404` khi bấm tải

Server cũ vẫn chạy hoặc chưa restart:

```powershell
netstat -ano | findstr :3000
taskkill /PID <PID> /F
npm run start:win
```

---

### 9.3. `Không chạy được yt-dlp`

1. Kiểm tra `yt-dlp.exe` có trong thư mục project:

```powershell
dir yt-dlp.exe
.\yt-dlp.exe --version
```

2. Tải lại từ [releases](https://github.com/yt-dlp/yt-dlp/releases) nếu thiếu.

---

### 9.4. File tên `01 video.mp4` (không có tiêu đề)

Playlist không trả tiêu đề — thử bật cookies trong `.env`.

---

### 9.5. `Không có video nào trong khoảng 101–101 (yt-dlp chỉ thấy 100 video)`

Playlist >100 video cần cookies — xem [mục 5](#5-cấu-hình-env).

---

### 9.6. Video tải nhưng không có `.mp4` / lỗi merge

Cài ffmpeg:

```powershell
winget install Gyan.FFmpeg
ffmpeg -version
```

---

### 9.7. `[download] Sleeping 5.00 seconds as required by the site...`

YouTube rate limit. Hạ `DOWNLOAD_CONCURRENCY=1` trong `.env`, thêm cookies, nghỉ vài phút rồi thử lại.

---

### 9.8. Firewall hỏi khi chạy server

Chọn **Allow access** — tool chỉ lắng nghe `localhost`, không cần mở port ra internet.

---

### 9.9. Port 3000 đã bị sử dụng (`EADDRINUSE`)

Server cũ vẫn chạy ngầm hoặc app khác chiếm port:

```powershell
netstat -ano | findstr :3000
taskkill /PID <PID> /F
npm run start:win
```

Hoặc đổi port trong `.env`: `PORT=3001` rồi mở `http://localhost:3001`.

---

### 9.10. `'node' is not recognized` / `'npm' is not recognized`

Node.js chưa cài hoặc Terminal chưa nhận PATH:

1. Cài Node LTS: `winget install OpenJS.NodeJS.LTS`
2. **Đóng hết** cửa sổ Terminal/PowerShell
3. Mở Terminal mới, kiểm tra: `node -v`

---

### 9.11. Dùng nhầm `npm start` thay vì `npm run start:win`

| Lệnh | Chạy file | Dùng cho |
|---|---|---|
| `npm start` | `server.js` | macOS / Linux |
| `npm run start:win` | `windownserver.js` | **Windows** |

Triệu chứng: server báo chạy OK nhưng không tìm được `yt-dlp.exe`, hoặc tải lỗi lạ.

---

### 9.12. `Cannot find module 'express'` (hoặc module khác)

Chưa cài dependencies:

```powershell
cd D:\Tool\yt-playlist-harvester
npm install
```

---

### 9.13. `Cannot find module './ytdlp-cookies.js'` (hoặc file `.js` khác)

Copy source **thiếu file** khi share ZIP. Cần đủ các file:

- `windownserver.js`
- `ytdlp-cookies.js`
- `download-queue.js`
- `ytdlp-log-filter.js`
- `package.json`

---

### 9.14. Trang web trắng / không mở được `localhost:3000`

1. Kiểm tra server đang chạy (terminal không báo lỗi)
2. Thử `http://127.0.0.1:3000`
3. Tắt VPN/proxy nếu có
4. Kiểm tra firewall đã Allow

---

### 9.15. Lỗi cookies / `Sign in to confirm you're not a bot`

1. Đăng nhập YouTube trên Edge/Chrome
2. Thêm vào `.env`: `YTDLP_COOKIES_FROM_BROWSER=edge`
3. Khởi động lại server
4. Cập nhật yt-dlp: tải `yt-dlp.exe` mới nhất

---

### 9.16. Không ghi được thư mục lưu tùy chỉnh

- Dùng đường dẫn Windows: `D:\Videos\YouTube` hoặc `.\downloads`
- Tránh ký tự đặc biệt
- Đảm bảo có quyền ghi ổ đĩa đó

---

### 9.17. `n challenge solving failed` / `Only images are available`

YouTube yêu cầu yt-dlp giải JS challenge. Bản code mới tự truyền `--js-runtimes node` (dùng Node.js đã cài cho server).

**Nếu vẫn lỗi**, kiểm tra thủ công:

```powershell
.\yt-dlp.exe --js-runtimes node "https://www.youtube.com/watch?v=VIDEO_ID" --list-formats
```

Nếu lệnh trên OK nhưng tool vẫn lỗi → cập nhật source mới nhất và restart server (`npm run start:win`).

Tùy chọn trong `.env`:

```env
YTDLP_JS_RUNTIME=node
# hoặc: YTDLP_JS_RUNTIME=deno  (cài: winget install DenoLand.Deno)
```

---

## Tóm tắt nhanh (cheat sheet)

```powershell
winget install OpenJS.NodeJS.LTS
winget install Gyan.FFmpeg
# Tải yt-dlp.exe → đặt vào thư mục project

cd D:\Tool\yt-playlist-harvester
npm install
copy .env.example .env
npm run start:win
# http://localhost:3000
```

---

## Tài liệu liên quan

- [README.md](./README.md) — Tổng quan, API, luồng hoạt động
- [yt-dlp Wiki](https://github.com/yt-dlp/yt-dlp/wiki)
- [Node.js Windows](https://nodejs.org/en/download)
