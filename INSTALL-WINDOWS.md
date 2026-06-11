# Hướng dẫn cài đặt ToolDownload trên Windows

Tài liệu này hướng dẫn từ đầu: clone project từ Git, cài phần mềm cần thiết, cấu hình VS Code / Cursor, và chạy ứng dụng trên **Windows 10 / 11**.

---

## Mục lục

1. [Yêu cầu hệ thống](#1-yêu-cầu-hệ-thống)
2. [Cài phần mềm nền tảng](#2-cài-phần-mềm-nền-tảng)
3. [Clone project từ Git](#3-clone-project-từ-git)
4. [Cài đặt & chạy project](#4-cài-đặt--chạy-project)
5. [Extension VS Code / Cursor (khuyến nghị)](#5-extension-vs-code--cursor-khuyến-nghị)
6. [Sử dụng giao diện web](#6-sử-dụng-giao-diện-web)
7. [Xử lý lỗi thường gặp trên Windows](#7-xử-lý-lỗi-thường-gặp-trên-windows)

---

## 1. Yêu cầu hệ thống

| Thành phần | Phiên bản tối thiểu | Ghi chú |
|---|---|---|
| Windows | 10 trở lên | 64-bit |
| Git | 2.x | Clone repo |
| Node.js | 18+ | Chạy server Express |
| yt-dlp | Mới nhất | Tải video YouTube |
| ffmpeg | Mới nhất | Gộp video + audio thành `.mp4` |
| Trình duyệt | Chrome / Edge / Firefox | Mở giao diện web |

---

## 2. Cài phần mềm nền tảng

Mở **PowerShell** hoặc **Terminal** (nhấn `Win + X` → chọn *Terminal* / *Windows PowerShell*).

### 2.1. Cài Git

**Cách 1 — winget (khuyến nghị):**

```powershell
winget install --id Git.Git -e
```

**Cách 2 — tải installer:** [https://git-scm.com/download/win](https://git-scm.com/download/win)

Sau khi cài, **đóng và mở lại** Terminal, kiểm tra:

```powershell
git --version
```

---

### 2.2. Cài Node.js

**Cách 1 — winget:**

```powershell
winget install OpenJS.NodeJS.LTS
```

**Cách 2 — tải installer:** [https://nodejs.org](https://nodejs.org) → chọn bản **LTS**

Kiểm tra:

```powershell
node -v
npm -v
```

Kết quả mong đợi: `node` ≥ v18, `npm` ≥ 9.

---

### 2.3. Cài yt-dlp

**Cách 1 — winget (dễ nhất):**

```powershell
winget install yt-dlp.yt-dlp
```

**Cách 2 — qua pip (nếu đã có Python):**

```powershell
pip install -U yt-dlp
```

**Cách 3 — tải file `.exe` thủ công:**

1. Tải `yt-dlp.exe` từ [https://github.com/yt-dlp/yt-dlp/releases](https://github.com/yt-dlp/yt-dlp/releases)
2. Đặt vào thư mục cố định, ví dụ: `C:\Tools\yt-dlp\`
3. Thêm thư mục đó vào **PATH** (xem mục [7.3](#73-yt-dlp-không-được-nhận--không-chạy-được-yt-dlp))

Kiểm tra:

```powershell
yt-dlp --version
```

---

### 2.4. Cài ffmpeg

ffmpeg cần thiết để yt-dlp gộp video và audio thành file `.mp4`.

**Cách 1 — winget:**

```powershell
winget install Gyan.FFmpeg
```

**Cách 2 — tải bản build:** [https://www.gyan.dev/ffmpeg/builds/](https://www.gyan.dev/ffmpeg/builds/) → chọn *ffmpeg-release-essentials.zip*, giải nén và thêm thư mục `bin` vào PATH.

Kiểm tra:

```powershell
ffmpeg -version
```

---

## 3. Clone project từ Git

Chọn thư mục bạn muốn lưu project (ví dụ `Documents`):

```powershell
cd $HOME\Documents
git clone https://github.com/<ten-user>/<ten-repo>.git ToolDownload
cd ToolDownload
```

> Thay `https://github.com/<ten-user>/<ten-repo>.git` bằng URL Git thực tế của bạn.

Nếu repo là **private**, Git sẽ hỏi đăng nhập GitHub (token hoặc Git Credential Manager).

---

## 4. Cài đặt & chạy project

### Bước 1 — Cài dependencies Node.js

```powershell
cd $HOME\Documents\ToolDownload
npm install
```

### Bước 2 — (Tùy chọn) Tạo file cấu hình `.env`

```powershell
echo PORT=3000 > .env
```

Hoặc tạo file `.env` bằng Notepad với nội dung:

```
PORT=3000
```

### Bước 3 — Khởi động server

```powershell
npm start
```

Khi thành công, terminal hiển thị:

```
Server đang chạy tại http://localhost:3000
Thư mục tải: C:\Users\<ten>\Documents\ToolDownload\downloads
```

### Bước 4 — Mở trình duyệt

Truy cập: **http://localhost:3000**

### Dừng server

Nhấn `Ctrl + C` trong cửa sổ Terminal đang chạy server.

### Chạy lại sau khi sửa code

Mỗi lần sửa `server.js`, cần **dừng server** (`Ctrl + C`) rồi chạy lại:

```powershell
npm start
```

---

## 5. Extension VS Code / Cursor (khuyến nghị)

Các extension giúp chỉnh sửa code dễ hơn khi mở project trên Windows.

### Cách cài extension

1. Mở **VS Code** hoặc **Cursor**
2. Nhấn `Ctrl + Shift + X` (mở Marketplace)
3. Gõ tên extension → bấm **Install**

### Danh sách khuyến nghị

| Extension | ID | Mục đích |
|---|---|---|
| **Tailwind CSS IntelliSense** | `bradlc.vscode-tailwindcss` | Gợi ý class Tailwind trong `index.html` |
| **Prettier** | `esbenp.prettier-vscode` | Format code tự động |
| **ESLint** | `dbaeumer.vscode-eslint` | Kiểm tra lỗi JavaScript |
| **GitLens** | `eamodio.gitlens` | Xem lịch sử Git trực quan |
| **DotENV** | `mikestead.dotenv` | Highlight file `.env` |

### Mở project trong Cursor / VS Code

```powershell
cd $HOME\Documents\ToolDownload
cursor .
```

Hoặc:

```powershell
code .
```

(Nếu lệnh `cursor` / `code` chưa có, mở app → **File → Open Folder** → chọn thư mục `ToolDownload`)

### Cài extension bằng dòng lệnh (tùy chọn)

**VS Code:**

```powershell
code --install-extension bradlc.vscode-tailwindcss
code --install-extension esbenp.prettier-vscode
code --install-extension dbaeumer.vscode-eslint
code --install-extension eamodio.gitlens
code --install-extension mikestead.dotenv
```

**Cursor:** dùng tương tự với lệnh `cursor --install-extension ...`

---

## 6. Sử dụng giao diện web

1. Dán **URL Playlist YouTube** vào ô đầu tiên
2. Nhập **Từ video thứ (X)** và **Đến video thứ (Y)** — đếm từ **1**
3. Chọn độ phân giải: **480p / 720p / 1080p**
4. *(Tùy chọn)* Nhập thư mục lưu, ví dụ:
   - `.\downloads` — thư mục mặc định trong project
   - `D:\Videos\YouTube` — ổ đĩa khác
5. Bấm **Bắt đầu tải hàng loạt**
6. Theo dõi log và thanh tiến trình

### Đổi giao diện Sáng / Tối

Bấm icon **Mặt trời / Mặt trăng** góc trên phải. Trạng thái được lưu tự động.

---

## 7. Xử lý lỗi thường gặp trên Windows

### 7.1. `npm : File cannot be loaded because running scripts is disabled`

PowerShell chặn script. Chạy **một lần** (PowerShell **Run as Administrator**):

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Sau đó thử lại `npm install`.

---

### 7.2. `HTTP 404` khi bấm tải

Server cũ vẫn chạy hoặc chưa khởi động lại sau khi sửa code.

```powershell
# Tìm process đang chiếm port 3000
netstat -ano | findstr :3000

# Dừng theo PID (thay 12345 bằng PID thực tế)
taskkill /PID 12345 /F

# Chạy lại
npm start
```

---

### 7.3. `yt-dlp` không được nhận / `Không chạy được yt-dlp`

1. Kiểm tra:

```powershell
where yt-dlp
```

2. Nếu không có kết quả → cài lại yt-dlp (mục [2.3](#23-cài-yt-dlp))
3. **Đóng và mở lại** Terminal sau khi cài
4. Nếu dùng file `.exe` thủ công, thêm vào PATH:
   - `Win + S` → gõ **Environment Variables**
   - *Edit the system environment variables* → **Environment Variables**
   - Trong *User variables* → chọn **Path** → **Edit** → **New**
   - Thêm đường dẫn chứa `yt-dlp.exe` (vd: `C:\Tools\yt-dlp`)
   - OK → mở Terminal mới

---

### 7.4. Video tải nhưng không có file `.mp4` / lỗi merge

Cài hoặc cập nhật **ffmpeg** (mục [2.4](#24-cài-ffmpeg)), kiểm tra:

```powershell
ffmpeg -version
```

---

### 7.5. Không ghi được vào thư mục lưu tùy chỉnh

- Dùng đường dẫn Windows: `D:\Videos\YouTube` hoặc `.\downloads`
- Tránh ký tự đặc biệt trong đường dẫn
- Đảm bảo bạn có quyền ghi vào ổ đĩa đó

---

### 7.6. Firewall hỏi khi chạy `npm start`

Chọn **Allow access** để trình duyệt trên cùng máy truy cập `localhost:3000`. Tool chỉ lắng nghe cục bộ, không cần mở port ra mạng ngoài.

---

## Tóm tắt nhanh (cheat sheet)

```powershell
# 1. Cài công cụ (chạy một lần)
winget install Git.Git
winget install OpenJS.NodeJS.LTS
winget install yt-dlp.yt-dlp
winget install Gyan.FFmpeg

# 2. Clone & chạy
cd $HOME\Documents
git clone https://github.com/<ten-user>/<ten-repo>.git ToolDownload
cd ToolDownload
npm install
npm start

# 3. Mở trình duyệt
# http://localhost:3000
```

---

## Tài liệu liên quan

- [README.md](./README.md) — Tổng quan, API, luồng hoạt động
- [yt-dlp Wiki](https://github.com/yt-dlp/yt-dlp/wiki)
- [Node.js Windows](https://nodejs.org/en/download)
