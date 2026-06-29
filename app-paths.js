const path = require('path');

/**
 * Thư mục ghi/đọc dữ liệu runtime (cookies.txt, downloads, .env, yt-dlp.exe).
 * - Chạy từ .exe (pkg): thư mục chứa file .exe (click đúp hoặc terminal).
 * - Chạy node từ source: process.cwd() (thư mục làm việc hiện tại).
 */
function getDataDir() {
  if (process.pkg) {
    return path.dirname(process.execPath);
  }
  return process.cwd();
}

module.exports = { getDataDir };
