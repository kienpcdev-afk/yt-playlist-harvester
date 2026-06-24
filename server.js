require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { execFile, spawn } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const {
  getYtDlpCookieArgs,
  getYtDlpJsRuntimeArgs,
  describeYtDlpCookies,
  describeYtDlpJsRuntime,
  hasYtDlpCookies,
} = require('./ytdlp-cookies');
const { createYtDlpProgressLogger } = require('./ytdlp-log-filter');
const { getDownloadConcurrency, runWithConcurrency } = require('./download-queue');
const {
  getYtDlpRetryArgs,
  getVideoRetryAttempts,
  getVideoRetryDelayMs,
  getGlobalDownloadConcurrency,
  acquireDownloadSlot,
  releaseDownloadSlot,
  cleanupPartialDownload,
  isTransientDownloadError,
  sleep,
} = require('./ytdlp-resilience');

function findYtDlpInWinGetPackages() {
  const packagesDir = path.join(
    process.env.LOCALAPPDATA || '',
    'Microsoft', 'WinGet', 'Packages',
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

function buildThumbFilename(stt) {
  return stt;
}

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

function runYtDlpFlatPlaylist(playlistUrl, playlistItems) {
  const args = [
    ...getYtDlpCookieArgs(),
    ...getYtDlpJsRuntimeArgs(),
    ...YTDLP_EXTRACTOR_ARGS,
    '--flat-playlist', '-J',
  ];
  if (playlistItems) {
    args.push('--playlist-items', String(playlistItems));
  }
  args.push(playlistUrl);

  return execFileAsync(YTDLP_CMD, args, {
    maxBuffer: 50 * 1024 * 1024,
  });
}

async function fetchPlaylistEntries(playlistUrl, fromIndex, toIndex) {
  const { stdout } = await runYtDlpFlatPlaylist(playlistUrl);
  const playlistData = JSON.parse(stdout);
  const entries = (playlistData.entries || []).filter((e) => e && e.id);
  const playlistCount = Number(playlistData.playlist_count) || entries.length;

  if (toIndex <= entries.length) {
    return {
      entries,
      selected: entries.slice(fromIndex - 1, toIndex),
      totalVisible: entries.length,
      playlistCount,
    };
  }

  try {
    const { stdout: rangeStdout } = await runYtDlpFlatPlaylist(
      playlistUrl,
      `${fromIndex}-${toIndex}`,
    );
    const rangeEntries = (JSON.parse(rangeStdout).entries || []).filter((e) => e && e.id);
    if (rangeEntries.length > 0) {
      return {
        entries,
        selected: rangeEntries,
        totalVisible: entries.length,
        playlistCount,
      };
    }
  } catch {
    // thử tiếp với danh sách đã có
  }

  return { entries, selected: [], totalVisible: entries.length, playlistCount };
}

async function downloadVideoAndThumbnail(videoUrl, videoPath, thumbPath, videoId, resolution, onLog, onVideoDone, onThumbDone, onThumbError) {
  const videoTask = downloadVideo(videoUrl, videoPath, resolution, onLog).then(() => {
    onVideoDone();
  });

  const thumbTask = downloadThumbnail(videoId, thumbPath)
    .then((url) => {
      onThumbDone(url);
      return url;
    })
    .catch((err) => {
      onThumbError(err);
      return null;
    });

  await Promise.all([videoTask, thumbTask]);
}

function runDownloadVideoOnce(videoUrl, outputPath, resolution, onLog) {
  return new Promise((resolve, reject) => {
    const logLine = createYtDlpProgressLogger(onLog);
    const args = [
      ...getYtDlpCookieArgs(),
      ...getYtDlpJsRuntimeArgs(),
      ...YTDLP_EXTRACTOR_ARGS,
      ...getYtDlpRetryArgs(),
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
      for (const line of lines) logLine(line);
    });

    proc.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      const lines = text.split('\n').filter(Boolean);
      for (const line of lines) logLine(line);
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

async function downloadVideo(videoUrl, outputPath, resolution, onLog) {
  const attempts = getVideoRetryAttempts();
  let lastErr;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (attempt > 1) {
      cleanupPartialDownload(outputPath);
      onLog(`[retry] Lỗi mạng — thử lại lần ${attempt}/${attempts}...`);
      await sleep(getVideoRetryDelayMs(attempt - 1));
    }

    await acquireDownloadSlot();
    try {
      await runDownloadVideoOnce(videoUrl, outputPath, resolution, onLog);
      return;
    } catch (err) {
      lastErr = err;
      if (attempt >= attempts || !isTransientDownloadError(err.message)) {
        throw err;
      }
    } finally {
      releaseDownloadSlot();
    }
  }

  throw lastErr;
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
    const cookieDesc = describeYtDlpCookies();
    if (cookieDesc) {
      log('info', `Cookies YouTube: ${cookieDesc}`);
    } else if (Y > 100) {
      log('info', 'Chưa cấu hình cookies — playlist >100 video thường cần cookies.txt hoặc YTDLP_COOKIES_FROM_BROWSER trong .env');
    }

    const { entries, selected, totalVisible, playlistCount } = await fetchPlaylistEntries(playlistUrl, X, Y);
    const countHint = playlistCount > totalVisible
      ? `${totalVisible} (YouTube báo ~${playlistCount})`
      : `${totalVisible}`;
    log('info', `yt-dlp thấy ${countHint} video trong playlist`);

    if (entries.length === 0 && selected.length === 0) {
      throw new Error('Playlist trống hoặc không lấy được video');
    }

    if (selected.length === 0) {
      let msg = `Không có video nào trong khoảng ${X}–${Y} (yt-dlp chỉ thấy ${countHint} video).`;
      if (Y > totalVisible) {
        msg += hasYtDlpCookies()
          ? ' Đã bật cookie nhưng vẫn thiếu video — thử cập nhật yt-dlp hoặc export lại cookies.'
          : ' Playlist >100 video: thêm YTDLP_COOKIES hoặc YTDLP_COOKIES_FROM_BROWSER vào .env (xem .env.example).';
      }
      throw new Error(msg);
    }

    const startIdx = X - 1;

    const videos = selected.map((entry, i) => {
      const playlistPosition = startIdx + i + 1;
      return {
        id: entry.id,
        title: cleanTitle(entry.title),
        playlistPosition,
        videoUrl: `https://www.youtube.com/watch?v=${entry.id}`,
      };
    });

    log('playlist', `Đã lọc ${videos.length} video (từ #${X} đến #${Math.min(Y, totalVisible || X + videos.length - 1)})`, {
      total: totalVisible || entries.length,
      selected: videos.length,
      videos: videos.map((v) => ({
        position: v.playlistPosition,
        id: v.id,
        title: v.title,
      })),
    });

    const concurrency = getDownloadConcurrency();
    log('info', `Tải song song: ${concurrency} video cùng lúc`);

    let completedCount = 0;

    const { results, failures } = await runWithConcurrency(videos, async (video, i) => {
      const { playlistPosition, title, videoUrl } = video;
      const stt = formatSTT(playlistPosition);
      const baseName = buildFilename(stt, title);
      const videoPath = path.join(saveDir, `${baseName}.mp4`);
      const thumbPath = path.join(saveDir, `${buildThumbFilename(stt)}.jpg`);

      log('start', `[${stt}] Bắt đầu tải: ${title}`, {
        stt,
        videoId: video.id,
        playlistPosition,
        title,
        index: i + 1,
        total: videos.length,
      });

      await downloadVideoAndThumbnail(
        videoUrl,
        videoPath,
        thumbPath,
        video.id,
        resHeight,
        (line) => log('progress', line, { stt, videoId: video.id }),
        () => log('video_done', `[${stt}] Đã tải video xong`, { stt, path: videoPath }),
        (url) => log('thumb_done', `[${stt}] Đã tải ảnh bìa`, { stt, path: thumbPath, url }),
        (err) => log('thumb_error', `[${stt}] Lỗi ảnh bìa: ${err.message}`, { stt }),
      );

      completedCount += 1;
      log('item_done', `[${stt}] Hoàn tất`, { stt, index: completedCount, total: videos.length });

      return {
        stt,
        videoId: video.id,
        title,
        videoPath,
        thumbPath,
      };
    }, concurrency, { continueOnError: true });

    for (const failure of failures) {
      const stt = formatSTT(failure.item.playlistPosition);
      log('error', `[${stt}] Lỗi: ${failure.error.message}`, {
        stt,
        videoId: failure.item.id,
        title: failure.item.title,
      });
    }

    const removed = cleanupLeftoverFiles(saveDir);
    if (removed.length > 0) {
      log('cleanup', `Đã dọn ${removed.length} file thừa (.webm, .part, ...)`, { removed });
    }

    const doneMsg = failures.length > 0
      ? `Tải xong ${results.length}/${videos.length} video (${failures.length} lỗi)`
      : `Tải xong ${results.length} video`;
    log('done', doneMsg, { results, failures: failures.map((f) => ({
      stt: formatSTT(f.item.playlistPosition),
      videoId: f.item.id,
      title: f.item.title,
      error: f.error.message,
    })), downloadDir: saveDir });
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
  const cookieDesc = describeYtDlpCookies();
  if (cookieDesc) {
    console.log(`Cookies YouTube: ${cookieDesc}`);
  } else {
    console.log('Cookies YouTube: chưa cấu hình (playlist >100 video cần cookies — xem .env.example)');
  }
  console.log(`Tải song song: ${getDownloadConcurrency()} video cùng lúc`);
  const globalLimit = getGlobalDownloadConcurrency();
  if (globalLimit !== null) {
    console.log(`Giới hạn tải toàn cục: ${globalLimit} video cùng lúc (mọi tab)`);
  }
  console.log(`Retry mạng: yt-dlp x${process.env.YTDLP_RETRIES || 20}, video x${getVideoRetryAttempts()}`);
  const jsRuntime = describeYtDlpJsRuntime();
  if (jsRuntime) {
    console.log(`YouTube JS runtime: ${jsRuntime}`);
  }
});
