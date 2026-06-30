const path = require('path');
const { getDataDir } = require('./app-paths');

require('dotenv').config({ path: path.join(getDataDir(), '.env') });

const express = require('express');
const cors = require('cors');
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
  initYtDlpCookies,
  getCookiesInitWarning,
} = require('./ytdlp-cookies');
const { createYtDlpProgressLogger } = require('./ytdlp-log-filter');
const { getDownloadConcurrency, runWithConcurrency, logSkippedSummary } = require('./download-queue');
const {
  getYtDlpRetryArgs,
  getGlobalDownloadConcurrency,
  acquireDownloadSlot,
  releaseDownloadSlot,
  cleanupPartialDownloadByStt,
} = require('./ytdlp-resilience');
const {
  buildVideoOutputTemplate,
  findVideoFileByStt,
  extractTitleFromVideoPath,
  describeTitleNamingMode,
  cleanVideoTitle,
} = require('./ytdlp-titles');
const { registerCookieUpdateRoute } = require('./cookie-update');
const {
  resetStopState,
  requestStop,
  notifyGracefulStop,
  markDownloadStart,
  markDownloadEnd,
  shouldStopQueue,
  abortIfStopping,
  getActiveDownloads,
} = require('./download-stop-state');

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
const DATA_DIR = getDataDir();

const app = express();
const PORT = process.env.PORT || 3000;
const DOWNLOADS_DIR = path.join(DATA_DIR, 'downloads');

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

function resolveDownloadPath(downloadPath) {
  const raw = (downloadPath || '').trim();
  const target = raw || path.join(DATA_DIR, 'downloads');
  return path.isAbsolute(target) ? path.resolve(target) : path.resolve(DATA_DIR, target);
}

function ensureDownloadDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function sendSSE(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
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

function buildFilename(stt, title, videoId) {
  return `${stt} ${cleanVideoTitle(title, videoId)}`;
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
    encoding: 'utf8',
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
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
  const videoTask = downloadVideoWithSlot(videoUrl, videoPath, resolution, onLog).then(() => {
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

function downloadVideo(videoUrl, outputPath, resolution, onLog) {
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

async function downloadVideoWithSlot(videoUrl, outputPath, resolution, onLog) {
  await acquireDownloadSlot();
  try {
    await downloadVideo(videoUrl, outputPath, resolution, onLog);
  } finally {
    releaseDownloadSlot();
  }
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

registerCookieUpdateRoute(app);

app.post('/api/download/stop', (_req, res) => {
  requestStop();
  res.json({
    ok: true,
    message: 'Đang chờ các video đang tải hoàn thành...',
    activeDownloads: getActiveDownloads(),
  });
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

  resetStopState();

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
    if (abortIfStopping(log, res)) return;
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

    log('info', describeTitleNamingMode());

    const startIdx = X - 1;

    const videos = selected.map((entry, i) => ({
      id: entry.id,
      playlistTitle: entry.title,
      playlistPosition: startIdx + i + 1,
      videoUrl: `https://www.youtube.com/watch?v=${entry.id}`,
    }));

    log('playlist', `Đã lọc ${videos.length} video (từ #${X} đến #${Math.min(Y, totalVisible || X + videos.length - 1)})`, {
      total: totalVisible || entries.length,
      selected: videos.length,
    });

    const concurrency = getDownloadConcurrency();
    log('info', `Tải song song: ${concurrency} video cùng lúc`);

    let completedCount = 0;

    const { results, failures, stopped } = await runWithConcurrency(videos, async (video, i) => {
      const { playlistPosition, videoUrl } = video;
      const stt = formatSTT(playlistPosition);
      const outputTemplate = buildVideoOutputTemplate(saveDir, stt);
      const thumbPath = path.join(saveDir, `${buildThumbFilename(stt)}.jpg`);
      let videoPath = null;

      log('start', `[${stt}] Bắt đầu tải`, {
        stt,
        videoId: video.id,
        playlistPosition,
        index: i + 1,
        total: videos.length,
      });

      try {
        await downloadVideoAndThumbnail(
          videoUrl,
          outputTemplate,
          thumbPath,
          video.id,
          resHeight,
          (line) => log('progress', line, { stt, videoId: video.id }),
          () => {},
          (url) => log('thumb_done', `[${stt}] Đã tải ảnh bìa`, { stt, path: thumbPath, url }),
          (err) => log('thumb_error', `[${stt}] Lỗi ảnh bìa: ${err.message}`, { stt }),
        );

        videoPath = findVideoFileByStt(saveDir, stt);
        if (!videoPath) {
          throw new Error('Không tìm thấy file video sau khi tải');
        }

        const title = extractTitleFromVideoPath(videoPath, stt, video.id) || video.id;
        video.title = title;

        log('video_done', `[${stt}] Đã tải video xong: ${title}`, { stt, path: videoPath, title });
      } catch (err) {
        cleanupPartialDownloadByStt(saveDir, stt);
        log('skip', `[${stt}] Bỏ qua, chuyển sang video tiếp theo`, {
          stt,
          videoId: video.id,
          title: video.title || video.id,
          videoUrl,
        });
        throw err;
      }

      completedCount += 1;
      log('item_done', `[${stt}] Hoàn tất`, { stt, index: completedCount, total: videos.length });

      return {
        stt,
        videoId: video.id,
        title: video.title,
        videoPath,
        thumbPath,
      };
    }, concurrency, {
      continueOnError: true,
      shouldStop: shouldStopQueue,
      onItemStart: markDownloadStart,
      onItemEnd: markDownloadEnd,
    });

    const skipped = logSkippedSummary(log, failures, formatSTT);

    if (stopped) {
      notifyGracefulStop(log, { skippedCount: skipped.length });
      res.end();
      return;
    }

    const removed = cleanupLeftoverFiles(saveDir);
    if (removed.length > 0) {
      log('cleanup', `Đã dọn ${removed.length} file thừa (.webm, .part, ...)`, { removed });
    }

    const doneMsg = skipped.length > 0
      ? `Tải xong ${results.length}/${videos.length} video (${skipped.length} bỏ qua)`
      : `Tải xong ${results.length} video`;
    log('done', doneMsg, { results, skipped, downloadDir: saveDir });
    res.end();
  } catch (err) {
    log('error', err.message);
    res.end();
  }
});

async function startServer() {
  const cookieInit = await initYtDlpCookies(YTDLP_CMD);

  app.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
    console.log(`Thư mục tải: ${DOWNLOADS_DIR}`);
    console.log(`yt-dlp: ${YTDLP_CMD}`);
    const cookieDesc = cookieInit.desc || describeYtDlpCookies();
    if (cookieDesc) {
      console.log(`Cookies YouTube: ${cookieDesc}`);
    } else {
      console.log('Cookies YouTube: chưa cấu hình (playlist >100 video cần cookies — xem .env.example)');
    }
    const cookieWarning = cookieInit.warning || getCookiesInitWarning();
    if (cookieWarning) {
      console.warn(`Cookies cảnh báo: ${cookieWarning}`);
    }
    console.log(`Tải song song: ${getDownloadConcurrency()} video cùng lúc`);
    const globalLimit = getGlobalDownloadConcurrency();
    if (globalLimit !== null) {
      console.log(`Giới hạn tải toàn cục: ${globalLimit} video cùng lúc (mọi tab)`);
    }
    console.log(`yt-dlp retry: ${process.env.YTDLP_RETRIES || 10} lần/video, lỗi thì bỏ qua và tải tiếp`);
    const jsRuntime = describeYtDlpJsRuntime();
    if (jsRuntime) {
      console.log(`YouTube JS runtime: ${jsRuntime}`);
    }
  });
}

startServer().catch((err) => {
  console.error(`Không khởi động được server: ${err.message}`);
  process.exit(1);
});
