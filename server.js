require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { execFile, spawn } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

function findYtDlpInWinGetPackages() {
  const packagesDir = path.join(
    process.env.LOCALAPPDATA || '',
    'Microsoft', 'WinGet', 'Packages'
  );
  if (!packagesDir || !fs.existsSync(packagesDir)) return null;

  for (const entry of fs.readdirSync(packagesDir)) {
    if (!entry.startsWith('yt-dlp.yt-dlp')) continue;
    const exe = path.join(packagesDir, entry, 'yt-dlp.exe');
    if (fs.existsSync(exe)) return exe;
  }
  return null;
}

function resolveYtDlpCommand() {
  const fromEnv = (process.env.YTDLP_PATH || '').trim();
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

  if (process.platform === 'win32') {
    const winget = findYtDlpInWinGetPackages();
    if (winget) return winget;
  }

  return 'yt-dlp';
}

const YTDLP_CMD = resolveYtDlpCommand();

// Cookie YouTube — TÙY CHỌN, mặc định TẮT (không đặt YTDLP_COOKIES = chạy như cũ).
// Chỉ bật khi playlist >100 video mà yt-dlp chỉ lấy được 100 mục đầu.
// Xem .env.example để biết cách export cookies.txt từ trình duyệt.
function resolveYtDlpCookieArgs() {
  const raw = (process.env.YTDLP_COOKIES || '').trim();
  if (!raw) return [];

  const cookiePath = path.isAbsolute(raw) ? raw : path.resolve(__dirname, raw);
  if (!fs.existsSync(cookiePath)) {
    console.warn(`[yt-dlp] YTDLP_COOKIES không tìm thấy file: ${cookiePath}`);
    return [];
  }

  return ['--cookies', cookiePath];
}

const YTDLP_COOKIE_ARGS = resolveYtDlpCookieArgs();

const app = express();
const PORT = process.env.PORT || 3000;
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

function resolveDownloadPath(downloadPath) {
  const raw = (downloadPath || '').trim();
  const target = raw || path.join(__dirname, 'downloads');
  return path.isAbsolute(target) ? path.resolve(target) : path.resolve(__dirname, target);
}

function ensureDownloadDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function sendSSE(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function cleanTitle(title) {
  return (title || 'video')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatSTT(playlistPosition) {
  return String(playlistPosition).padStart(2, '0');
}

const YTDLP_EXTRACTOR_ARGS = ['--extractor-args', 'youtube:player_client=web'];

function cleanupLeftoverFiles(dirPath) {
  const allowed = new Set(['.mp4', '.jpg']);
  const removed = [];

  for (const file of fs.readdirSync(dirPath)) {
    const filePath = path.join(dirPath, file);
    if (!fs.statSync(filePath).isFile()) continue;

    const ext = path.extname(file).toLowerCase();
    if (!allowed.has(ext)) {
      fs.unlinkSync(filePath);
      removed.push(file);
    }
  }

  return removed;
}

function buildFilename(stt, title) {
  return `${stt} ${cleanTitle(title)}`;
}

function buildFormatString(resolution) {
  return `bestvideo[height<=${resolution}]+bestaudio/best[height<=${resolution}]`;
}

function runYtDlpFlatPlaylist(playlistUrl) {
  // flat-playlist trên URL playlist trả tiêu đề đã dịch — chỉ dùng để lấy id
  return execFileAsync(YTDLP_CMD, [
    ...YTDLP_COOKIE_ARGS,
    ...YTDLP_EXTRACTOR_ARGS,
    '--flat-playlist', '-J',
    playlistUrl,
  ], {
    maxBuffer: 50 * 1024 * 1024,
  });
}

async function fetchVideoTitle(videoUrl) {
  // yt-dlp 2026.06+ trả rỗng với %(title)s; %(title)j xuất JSON string an toàn với Unicode
  const { stdout } = await execFileAsync(YTDLP_CMD, [
    ...YTDLP_COOKIE_ARGS,
    ...YTDLP_EXTRACTOR_ARGS,
    '-q', '--no-warnings',
    '--print', '%(title)j',
    videoUrl,
  ], { maxBuffer: 10 * 1024 * 1024 });
  const raw = stdout.trim();
  if (!raw) return '';
  try {
    const title = JSON.parse(raw);
    return typeof title === 'string' ? title.trim() : '';
  } catch {
    return '';
  }
}

function downloadVideo(videoUrl, outputPath, resolution, onLog) {
  return new Promise((resolve, reject) => {
    const args = [
      ...YTDLP_COOKIE_ARGS,
      ...YTDLP_EXTRACTOR_ARGS,
      '-f', buildFormatString(resolution),
      '--merge-output-format', 'mp4',
      '--no-keep-video',
      '--newline',
      '--no-overwrites',
      '-o', outputPath,
      videoUrl,
    ];

    const proc = spawn(YTDLP_CMD, args);
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      const lines = chunk.toString().split('\n').filter(Boolean);
      for (const line of lines) onLog(line);
    });

    proc.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      const lines = text.split('\n').filter(Boolean);
      for (const line of lines) onLog(line);
    });

    proc.on('error', (err) => {
      const hint = err.code === 'ENOENT'
        ? ' (cài yt-dlp hoặc đặt biến YTDLP_PATH trỏ tới yt-dlp.exe)'
        : '';
      reject(new Error(`Không chạy được yt-dlp: ${err.message}${hint}`));
    });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `yt-dlp thoát với mã ${code}`));
    });
  });
}

async function downloadThumbnail(videoId, outputPath) {
  const urls = [
    `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;

      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length < 1000) continue;

      fs.writeFileSync(outputPath, buffer);
      return url;
    } catch {
      // thử URL tiếp theo
    }
  }

  throw new Error('Không tải được ảnh bìa');
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

app.post('/api/playlist/download', async (req, res) => {
  const { playlistUrl, fromIndex, toIndex, resolution, downloadPath } = req.body;

  if (!playlistUrl || typeof playlistUrl !== 'string') {
    return res.status(400).json({ error: 'Thiếu playlistUrl' });
  }

  const X = parseInt(fromIndex, 10);
  const Y = parseInt(toIndex, 10);
  const resHeight = parseInt(resolution, 10);

  if (!Number.isInteger(X) || !Number.isInteger(Y) || X < 1 || Y < X) {
    return res.status(400).json({ error: 'fromIndex và toIndex không hợp lệ (X >= 1, Y >= X)' });
  }

  if (!Number.isInteger(resHeight) || resHeight < 144) {
    return res.status(400).json({ error: 'resolution không hợp lệ (ví dụ: 480, 720)' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const log = (type, message, extra = {}) => {
    sendSSE(res, type, { message, ...extra });
  };

  try {
    const saveDir = resolveDownloadPath(downloadPath);
    ensureDownloadDir(saveDir);
    log('info', `Thư mục lưu: ${saveDir}`, { downloadDir: saveDir });
    log('info', 'Đang lấy danh sách playlist...', { playlistUrl });

    const { stdout } = await runYtDlpFlatPlaylist(playlistUrl);
    const playlistData = JSON.parse(stdout);
    const entries = (playlistData.entries || []).filter((e) => e && e.id);
    const playlistCount = Number(playlistData.playlist_count) || entries.length;

    if (entries.length === 0) {
      throw new Error('Playlist trống hoặc không lấy được video');
    }

    const startIdx = X - 1;
    const endIdx = Y;
    const selected = entries.slice(startIdx, endIdx);

    if (selected.length === 0) {
      const countHint = playlistCount > entries.length
        ? `${entries.length} (YouTube báo ~${playlistCount})`
        : `${entries.length}`;
      let msg = `Không có video nào trong khoảng ${X}–${Y} (playlist có ${countHint} video)`;
      if (Y > entries.length) {
        msg += YTDLP_COOKIE_ARGS.length
          ? '. Đã bật cookie nhưng vẫn thiếu video — thử cập nhật yt-dlp hoặc export lại cookies.txt'
          : '. Playlist >100 video: đặt YTDLP_COOKIES trong .env (xem .env.example)';
      }
      throw new Error(msg);
    }

    log('info', 'Đang lấy tiêu đề gốc từng video (tránh bản dịch tự động của playlist)...');

    const videos = [];
    for (let i = 0; i < selected.length; i++) {
      const entry = selected[i];
      const playlistPosition = startIdx + i + 1;
      const videoUrl = `https://www.youtube.com/watch?v=${entry.id}`;
      const title = await fetchVideoTitle(videoUrl);
      videos.push({ id: entry.id, title, playlistPosition, videoUrl });
    }

    log('playlist', `Đã lọc ${videos.length} video (từ #${X} đến #${Math.min(Y, entries.length)})`, {
      total: entries.length,
      selected: videos.length,
      videos: videos.map((v) => ({
        position: v.playlistPosition,
        id: v.id,
        title: v.title,
      })),
    });

    const results = [];

    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      const { playlistPosition, title, videoUrl } = video;
      const stt = formatSTT(playlistPosition);
      const baseName = buildFilename(stt, title);
      const videoPath = path.join(saveDir, `${baseName}.mp4`);
      const thumbPath = path.join(saveDir, `${baseName}.jpg`);

      log('start', `[${stt}] Bắt đầu tải: ${title}`, {
        stt,
        videoId: video.id,
        playlistPosition,
        title,
        index: i + 1,
        total: videos.length,
      });

      await downloadVideo(videoUrl, videoPath, resHeight, (line) => {
        log('progress', line, { stt, videoId: video.id });
      });

      log('video_done', `[${stt}] Đã tải video xong`, { stt, path: videoPath });

      try {
        const thumbUrl = await downloadThumbnail(video.id, thumbPath);
        log('thumb_done', `[${stt}] Đã tải ảnh bìa`, { stt, path: thumbPath, url: thumbUrl });
      } catch (thumbErr) {
        log('thumb_error', `[${stt}] Lỗi ảnh bìa: ${thumbErr.message}`, { stt });
      }

      results.push({
        stt,
        videoId: video.id,
        title,
        videoPath,
        thumbPath,
      });

      log('item_done', `[${stt}] Hoàn tất`, { stt, index: i + 1, total: videos.length });
    }

    const removed = cleanupLeftoverFiles(saveDir);
    if (removed.length > 0) {
      log('cleanup', `Đã dọn ${removed.length} file thừa (.webm, .part, ...)`, { removed });
    }

    log('done', `Tải xong ${results.length} video`, { results, downloadDir: saveDir });
    res.end();
  } catch (err) {
    log('error', err.message);
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
  console.log(`Thư mục tải: ${DOWNLOADS_DIR}`);
  console.log(`yt-dlp: ${YTDLP_CMD}`);
  console.log(`yt-dlp cookies: ${YTDLP_COOKIE_ARGS.length ? 'bật' : 'tắt (mặc định)'}`);
});
