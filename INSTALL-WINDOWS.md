# Hướng dẫn cài đặt ToolDownload trên Windows

Tài liệu này hướng dẫn từ đầu: nhận source code, cài phần mềm cần thiết, cấu hình, chạy ứng dụng và **cài Extension Chrome** để tự động cập nhật cookie YouTube trên **Windows 10 / 11**.

---

## Mục lục

1. [Yêu cầu hệ thống](#1-yêu-cầu-hệ-thống)
2. [Cài phần mềm nền tảng](#2-cài-phần-mềm-nền-tảng)
3. [Lấy source code](#3-lấy-source-code)
4. [Cài đặt & chạy project](#4-cài-đặt--chạy-project)
5. [Cấu hình `.env`](#5-cấu-hình-env)
6. [Cài Extension Chrome — đồng bộ cookie tự động](#6-cài-extension-chrome--đồng-bộ-cookie-tự-động)
7. [Sử dụng giao diện web](#7-sử-dụng-giao-diện-web)
8. [Quy tắc đặt tên file](#8-quy-tắc-đặt-tên-file)
9. [Share source cho người khác](#9-share-source-cho-người-khác)
10. [Xử lý lỗi thường gặp](#10-xử-lý-lỗi-thường-gặp)

---

## 1. Yêu cầu hệ thống

| Thành phần | Phiên bản tối thiểu | Ghi chú |
|---|---|---|
| Windows | 10 trở lên | 64-bit |
| Node.js | 18+ | Chạy server Express |
| yt-dlp | Mới nhất | File `yt-dlp.exe` trong thư mục project |
| ffmpeg | Mới nhất | **Bắt buộc** — gộp video + audio thành `.mp4` (480p) |
| Trình duyệt | Chrome / Edge / Firefox | Mở giao diện web; Chrome/Edge cho Extension cookie |
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
├── cookie-update.js      # API nhận cookie từ Extension
├── ytdlp-cookies.js      # Hỗ trợ cookies YouTube
├── download-queue.js     # Tải song song nhiều video
├── ytdlp-log-filter.js   # Lọc log yt-dlp gọn hơn
├── yt-dlp.exe            # ← bạn tự tải và đặt vào đây
├── chrome-extension/     # Extension Chrome đồng bộ cookie (xem mục 6)
├── scripts/              # setup:cookies, setup:browser-cookies
├── .env.example          # Mẫu cấu hình
├── package.json
├── public/               # Giao diện web
├── cookies.txt           # Cookie YouTube (tự tạo — không share)
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

# File cookie (mặc định cookies.txt — Extension hoặc export thủ công ghi vào đây)
# YTDLP_COOKIES=./cookies.txt

# Hoặc đọc cookie trực tiếp từ trình duyệt (không dùng cùng lúc với Extension)
# YTDLP_COOKIES_FROM_BROWSER=auto
```

| Biến | Mặc định | Mô tả |
|---|---|---|
| `PORT` | `3000` | Cổng server (Extension gửi cookie tới cổng này) |
| `DOWNLOAD_CONCURRENCY` | `2` | Số video tải đồng thời (1–4) |
| `YTDLP_COOKIES` | `cookies.txt` | File cookie Netscape — Extension ghi vào đây |
| `YTDLP_COOKIES_FROM_BROWSER` | — | `auto`, `firefox`, `edge`, `chrome`… — **tắt** nếu dùng Extension |

### Cookies cho playlist >100 video

YouTube thường chỉ cho yt-dlp xem **100 video đầu** nếu không có cookies. Chọn **một** trong các cách sau:

| Cách | Phù hợp khi | Hướng dẫn |
|---|---|---|
| **Extension Chrome** *(khuyến nghị)* | Dùng Chrome/Edge, muốn một nút bấm | [Mục 6](#6-cài-extension-chrome--đồng-bộ-cookie-tự-động) |
| `YTDLP_COOKIES_FROM_BROWSER=auto` | Không muốn cài Extension | [6.6 — so sánh](#66-so-sánh-các-cách-lấy-cookie) bên dưới |
| Export `cookies.txt` thủ công | Extension và auto đều không được | Dùng extension export Netscape của bên thứ ba |

> **Quan trọng:** Không bật `YTDLP_COOKIES_FROM_BROWSER` khi dùng Extension — Tool sẽ ưu tiên đọc cookie từ trình duyệt và bỏ qua `cookies.txt` từ Extension.

> **Không share** file `cookies.txt` hoặc `.env` — chứa thông tin đăng nhập cá nhân.

---

## 6. Cài Extension Chrome — đồng bộ cookie tự động

Extension **Tool Tải Playlist YouTube — Đồng bộ Cookie** lấy cookie YouTube từ trình duyệt và gửi về Tool qua `http://localhost:3000/update-cookie`, lưu vào file `cookies.txt`. Không cần export thủ công hay đóng Chrome.

### 6.1. Khi nào nên dùng Extension?

- Tải playlist **quá 100 video** hoặc gặp lỗi bot / thiếu tiêu đề
- Dùng **Chrome hoặc Edge** và không muốn chạy `setup:browser-cookies`
- `YTDLP_COOKIES_FROM_BROWSER=auto` báo lỗi `Could not copy Chrome cookie database`
- Cần **cập nhật cookie nhanh** sau khi đăng nhập lại YouTube

### 6.2. Điều kiện trước khi cài

1. Tool đã cài xong và chạy được ([mục 4](#4-cài-đặt--chạy-project))
2. Đã **đăng nhập YouTube** trên Chrome/Edge (`youtube.com`)
3. Trong `.env`: **không** có dòng `YTDLP_COOKIES_FROM_BROWSER` (để comment hoặc xóa)

```env
PORT=3000
DOWNLOAD_CONCURRENCY=2
# YTDLP_COOKIES=./cookies.txt   ← mặc định, không cần sửa
```

### 6.3. Cài Extension (chế độ Developer)

**Chrome:**

1. Mở `chrome://extensions/`
2. Bật **Developer mode** (góc trên phải)
3. Bấm **Load unpacked** / **Tải extension đã giải nén**
4. Chọn thư mục `chrome-extension` trong project:

```
D:\Tool\yt-playlist-harvester\chrome-extension
```

**Microsoft Edge:**

1. Mở `edge://extensions/`
2. Bật **Developer mode**
3. Bấm **Load unpacked**
4. Chọn cùng thư mục `chrome-extension` như trên

Sau khi cài, icon Extension xuất hiện trên thanh công cụ. Nếu không thấy, bấm biểu tượng puzzle (Extensions) và ghim Extension lên thanh.

### 6.4. Đồng bộ cookie (mỗi lần cần cập nhật)

1. Chạy server (nếu chưa chạy):

```powershell
cd D:\Tool\yt-playlist-harvester
npm run start:win
```

2. Mở tab **youtube.com** — tab đang active phải là YouTube (đã đăng nhập)
3. Bấm icon Extension → **Cập nhật Cookie về Tool**
4. Đợi thông báo xanh: *Cập nhật thành công! (N Cookie)*

File `cookies.txt` được tạo/cập nhật ngay trong thư mục project. **Không cần restart server** — Tool nạp lại cookie tự động.

Kiểm tra nhanh: khi tải playlist, log hiển thị `Cookies YouTube: cookies.txt`.

### 6.5. Khi nào cần đồng bộ lại?

- **Lần đầu** trước khi tải playlist >100 video
- Lỗi `Sign in to confirm you're not a bot`
- Đổi tài khoản Google hoặc đăng xuất/đăng nhập lại YouTube
- Cookie hết hạn (thường vài tuần — đồng bộ lại một nút)

### 6.6. So sánh các cách lấy cookie

| Cách | Ưu điểm | Nhược điểm |
|---|---|---|
| **Extension Chrome** | Một nút bấm; Chrome không cần đóng; cập nhật nhanh | Cài Extension một lần; server phải chạy khi đồng bộ |
| `YTDLP_COOKIES_FROM_BROWSER=auto` | Tự động mỗi lần chạy server | Chrome/Edge cần `npm run setup:browser-cookies` một lần |
| Export `cookies.txt` thủ công | Không cần Extension | Thao tác phức tạp, dễ quên cập nhật |

**Dùng `YTDLP_COOKIES_FROM_BROWSER=auto` (không dùng Extension):**

1. Đăng nhập YouTube trên trình duyệt
2. Thêm vào `.env`: `YTDLP_COOKIES_FROM_BROWSER=auto`
3. **Một lần** trên Windows (Chrome/Edge):

```powershell
npm run setup:browser-cookies
npm run setup:cookies
```

4. Mở Chrome/Edge bằng **shortcut trên Desktop** (sau bước 3), rồi `npm run start:win`

`auto` thử lần lượt: Firefox → Edge → Chrome. Firefox thường hoạt động ngay cả khi trình duyệt đang mở.

### 6.7. Lưu ý bảo mật

- `cookies.txt` chứa phiên đăng nhập Google — **không** gửi cho người khác, không commit Git (đã có trong `.gitignore`)
- Extension chỉ gửi cookie tới `http://localhost:3000` trên máy của bạn

---

## 7. Sử dụng giao diện web

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
- Bật cookies nếu vượt quá video #100 — dùng Extension ([mục 6](#6-cài-extension-chrome--đồng-bộ-cookie-tự-động)) hoặc `YTDLP_COOKIES_FROM_BROWSER=auto`
- Nếu hay thấy `Sleeping 5 seconds` → hạ `DOWNLOAD_CONCURRENCY=1`

---

## 8. Quy tắc đặt tên file

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

## 9. Share source cho người khác

### Người share cần gửi

| Gửi | Không gửi |
|---|---|
| Toàn bộ source (trừ `node_modules/`, `downloads/`) | `node_modules/` |
| Thư mục `chrome-extension/` | `.env`, `cookies.txt` |
| File `.env.example` | Video đã tải trong `downloads/` |
| Hướng dẫn link tới file này | |

### Người nhận cần tự cài/tải

1. **Node.js** LTS
2. **ffmpeg**
3. **`yt-dlp.exe`** → đặt vào thư mục project
4. Chạy `npm install`
5. Copy `.env.example` → `.env` (tùy chọn)
6. Chạy `npm run start:win`
7. *(Nếu tải playlist >100 video)* Cài Extension trong `chrome-extension/` — xem [mục 6](#6-cài-extension-chrome--đồng-bộ-cookie-tự-động)

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

# 5. (Playlist >100 video) Cài Extension chrome-extension/ → đồng bộ cookie (mục 6)
```

---

## 10. Xử lý lỗi thường gặp

### Bảng tra nhanh

| Triệu chứng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| `'node' is not recognized` | Chưa cài Node.js hoặc chưa mở lại Terminal | Cài Node LTS, đóng/mở lại Terminal |
| `npm : running scripts is disabled` | PowerShell chặn script | [10.1](#101-npm--running-scripts-is-disabled) |
| `Cannot find module 'express'` | Chưa `npm install` | Chạy `npm install` trong thư mục project |
| `Cannot find module './ytdlp-cookies.js'` | Copy source thiếu file | Copy đủ toàn bộ file `.js` trong repo |
| Server chạy nhưng tải lỗi / 404 | Dùng nhầm `npm start` (Mac) | Dùng `npm run start:win` |
| `Không chạy được yt-dlp` | Thiếu `yt-dlp.exe` trong project | [10.3](#103-không-chạy-được-yt-dlp) |
| Có `.webm` nhưng không có `.mp4` | Thiếu ffmpeg | [10.6](#106-video-tải-nhưng-không-có-mp4--lỗi-merge) |
| Chỉ thấy 100 video / lỗi #101+ | Thiếu cookies YouTube | [mục 5–6](#5-cấu-hình-env) hoặc [10.5](#105-không-có-video-nào-trong-khoảng-101101-yt-dlp-chỉ-thấy-100-video) |
| Extension: *Không kết nối được Tool* | Server chưa chạy | `npm run start:win` rồi thử lại |
| Extension đồng bộ OK nhưng vẫn lỗi cookie | `YTDLP_COOKIES_FROM_BROWSER` đang bật | [10.18](#1018-extension-đồng-bộ-ok-nhưng-tool-vẫn-không-dùng-cookiestxt) |
| File `01 video.mp4` | Playlist không trả tiêu đề | [10.4](#104-file-tên-01-videomp4-không-có-tiêu-đề) |
| `Sleeping 5.00 seconds` | YouTube rate limit | [10.7](#107-download-sleeping-500-seconds-as-required-by-the-site) |
| `n challenge solving failed` / `Only images are available` | yt-dlp thiếu JS runtime | [10.17](#1017-n-challenge-solving-failed--only-images-are-available) |
| `EADDRINUSE :3000` | Port 3000 bị chiếm | [10.9](#109-port-3000-đã-bị-sử-dụng-eaddrinuse) |

---

### 10.1. `npm : running scripts is disabled`

PowerShell chặn script — chạy **một lần** (Administrator):

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

### 10.2. `HTTP 404` khi bấm tải

Server cũ vẫn chạy hoặc chưa restart:

```powershell
netstat -ano | findstr :3000
taskkill /PID <PID> /F
npm run start:win
```

---

### 10.3. `Không chạy được yt-dlp`

1. Kiểm tra `yt-dlp.exe` có trong thư mục project:

```powershell
dir yt-dlp.exe
.\yt-dlp.exe --version
```

2. Tải lại từ [releases](https://github.com/yt-dlp/yt-dlp/releases) nếu thiếu.

---

### 10.4. File tên `01 video.mp4` (không có tiêu đề)

Playlist không trả tiêu đề — thử bật cookies trong `.env`.

---

### 10.5. `Không có video nào trong khoảng 101–101 (yt-dlp chỉ thấy 100 video)`

Playlist >100 video cần cookies — xem [mục 5](#5-cấu-hình-env) và [mục 6](#6-cài-extension-chrome--đồng-bộ-cookie-tự-động).

---

### 10.6. Video tải nhưng không có `.mp4` / lỗi merge

Cài ffmpeg:

```powershell
winget install Gyan.FFmpeg
ffmpeg -version
```

---

### 10.7. `[download] Sleeping 5.00 seconds as required by the site...`

YouTube rate limit. Hạ `DOWNLOAD_CONCURRENCY=1` trong `.env`, thêm cookies, nghỉ vài phút rồi thử lại.

---

### 10.8. Firewall hỏi khi chạy server

Chọn **Allow access** — tool chỉ lắng nghe `localhost`, không cần mở port ra internet.

---

### 10.9. Port 3000 đã bị sử dụng (`EADDRINUSE`)

Server cũ vẫn chạy ngầm hoặc app khác chiếm port:

```powershell
netstat -ano | findstr :3000
taskkill /PID <PID> /F
npm run start:win
```

Hoặc đổi port trong `.env`: `PORT=3001` rồi mở `http://localhost:3001`.

---

### 10.10. `'node' is not recognized` / `'npm' is not recognized`

Node.js chưa cài hoặc Terminal chưa nhận PATH:

1. Cài Node LTS: `winget install OpenJS.NodeJS.LTS`
2. **Đóng hết** cửa sổ Terminal/PowerShell
3. Mở Terminal mới, kiểm tra: `node -v`

---

### 10.11. Dùng nhầm `npm start` thay vì `npm run start:win`

| Lệnh | Chạy file | Dùng cho |
|---|---|---|
| `npm start` | `server.js` | macOS / Linux |
| `npm run start:win` | `windownserver.js` | **Windows** |

Triệu chứng: server báo chạy OK nhưng không tìm được `yt-dlp.exe`, hoặc tải lỗi lạ.

---

### 10.12. `Cannot find module 'express'` (hoặc module khác)

Chưa cài dependencies:

```powershell
cd D:\Tool\yt-playlist-harvester
npm install
```

---

### 10.13. `Cannot find module './ytdlp-cookies.js'` (hoặc file `.js` khác)

Copy source **thiếu file** khi share ZIP. Cần đủ các file:

- `windownserver.js`
- `ytdlp-cookies.js`
- `download-queue.js`
- `ytdlp-log-filter.js`
- `package.json`

---

### 10.14. Trang web trắng / không mở được `localhost:3000`

1. Kiểm tra server đang chạy (terminal không báo lỗi)
2. Thử `http://127.0.0.1:3000`
3. Tắt VPN/proxy nếu có
4. Kiểm tra firewall đã Allow

---

### 10.15. Lỗi cookies / `Could not copy Chrome cookie database`

Chrome/Edge trên Windows **khóa file cookie** khi đang mở. Không phải lỗi của tool.

**Xử lý nhanh:**

```powershell
npm run setup:browser-cookies
npm run setup:cookies
```

Mở Chrome/Edge bằng shortcut Desktop (có flag đặc biệt), đăng nhập YouTube, restart server.

**Hoặc** dùng **Extension Chrome** ([mục 6](#6-cài-extension-chrome--đồng-bộ-cookie-tự-động)) — không cần đóng Chrome.

**Hoặc** dùng Firefox (không cần setup): `.env` → `YTDLP_COOKIES_FROM_BROWSER=firefox`

**Hoặc** đóng hết cửa sổ Chrome trong Task Manager rồi thử lại.

### 10.15b. Lỗi `Sign in to confirm you're not a bot`

1. Đăng nhập YouTube trên trình duyệt
2. Đồng bộ cookie qua Extension ([mục 6.4](#64-đồng-bộ-cookie-mỗi-lần-cần-cập-nhật)) **hoặc** bật `YTDLP_COOKIES_FROM_BROWSER=auto` và chạy `npm run setup:cookies`
3. Cập nhật yt-dlp: tải `yt-dlp.exe` mới nhất

---

### 10.16. Không ghi được thư mục lưu tùy chỉnh

- Dùng đường dẫn Windows: `D:\Videos\YouTube` hoặc `.\downloads`
- Tránh ký tự đặc biệt
- Đảm bảo có quyền ghi ổ đĩa đó

---

### 10.17. `n challenge solving failed` / `Only images are available`

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

### 10.18. Extension: đồng bộ OK nhưng Tool vẫn không dùng `cookies.txt`

Extension lưu vào `cookies.txt`, nhưng nếu `.env` có `YTDLP_COOKIES_FROM_BROWSER`, Tool **ưu tiên đọc cookie từ trình duyệt** và bỏ qua file từ Extension.

**Cách xử lý:**

1. Mở `.env`, comment hoặc xóa dòng `YTDLP_COOKIES_FROM_BROWSER=...`
2. Restart server: `Ctrl+C` → `npm run start:win`
3. Đồng bộ lại cookie từ Extension

Khi đúng, log tải playlist hiển thị: `Cookies YouTube: cookies.txt`.

---

### 10.19. Extension: *Hãy mở tab YouTube (đã đăng nhập)*

Extension chỉ hoạt động khi **tab đang active** là `youtube.com`.

1. Mở `https://www.youtube.com` trong tab hiện tại (không phải tab localhost:3000)
2. Đảm bảo đã đăng nhập tài khoản Google
3. Bấm lại **Cập nhật Cookie về Tool**

---

### 10.20. Extension: *Không kết nối được Tool*

Server chưa chạy hoặc đang dùng port khác.

```powershell
cd D:\Tool\yt-playlist-harvester
npm run start:win
```

Nếu đổi port trong `.env` (ví dụ `PORT=3001`), Extension mặc định gửi tới `localhost:3000` — cần sửa `TOOL_URL` trong `chrome-extension/popup.js` cho khớp, rồi tải lại Extension trên `chrome://extensions/`.

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

# Playlist >100 video: cài Extension chrome-extension/ (mục 6)
# → mở youtube.com → bấm "Cập nhật Cookie về Tool"
```

---

## Tài liệu liên quan

- [README.md](./README.md) — Tổng quan, API, luồng hoạt động
- [yt-dlp Wiki](https://github.com/yt-dlp/yt-dlp/wiki)
- [Node.js Windows](https://nodejs.org/en/download)
