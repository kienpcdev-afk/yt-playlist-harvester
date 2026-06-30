const { execFile } = require('child_process');
const { promisify } = require('util');

const { getYtDlpCookieArgs, getYtDlpJsRuntimeArgs, hasYtDlpCookies } = require('./ytdlp-cookies');

const execFileAsync = promisify(execFile);

const TITLE_FETCH_TIMEOUT_MS = 60000;
const TITLE_FETCH_RETRIES = 2;
const TITLE_FETCH_RETRY_DELAY_MS = 1500;

const EXEC_OPTIONS = {
  maxBuffer: 10 * 1024 * 1024,
  timeout: TITLE_FETCH_TIMEOUT_MS,
  encoding: 'utf8',
  env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
};

const titleCache = new Map();

function getTitleLang() {
  return (process.env.YTDLP_TITLE_LANG || '').trim();
}

function shouldTrustPlaylistFallback(titleLang) {
  if (titleLang) return false;
  return !hasYtDlpCookies();
}

function resetTitleCache() {
  titleCache.clear();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isValidTitle(title, videoId) {
  if (!title || typeof title !== 'string') return false;

  const trimmed = title.trim();
  if (!trimmed) return false;
  if (videoId && trimmed === videoId) return false;

  const replacementCount = (trimmed.match(/\uFFFD/g) || []).length;
  if (replacementCount > 0 && replacementCount >= trimmed.length / 2) {
    return false;
  }

  return true;
}

function pickBestTitle(fetched, fallback, videoId) {
  if (isValidTitle(fetched, videoId)) return fetched;
  // Playlist title tốt hơn video ID — kể cả khi có cookies (có thể đã dịch nhưng vẫn đọc được).
  if (isValidTitle(fallback, videoId)) return fallback;
  return videoId || 'video';
}

function cleanVideoTitle(title, videoId) {
  const cleaned = (title || '')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (isValidTitle(cleaned, videoId)) return cleaned;
  return videoId || 'video';
}

function buildTitleFetchStrategies(entry, titleLang) {
  const url = `https://www.youtube.com/watch?v=${entry.id}`;
  const base = ['--no-download', '--ignore-errors', '--no-warnings', '-j', url];

  if (titleLang) {
    return [[
      ...getYtDlpCookieArgs(),
      ...getYtDlpJsRuntimeArgs(),
      '--extractor-args', `youtube:player_client=web,lang=${titleLang}`,
      ...base,
    ]];
  }

  const strategies = [
  // Ưu tiên tiêu đề gốc — không cookies
    [
      ...getYtDlpJsRuntimeArgs(),
      '--extractor-args', 'youtube:player_client=android',
      ...base,
    ],
    [
      ...getYtDlpJsRuntimeArgs(),
      '--extractor-args', 'youtube:player_client=web',
      ...base,
    ],
    [
      ...getYtDlpJsRuntimeArgs(),
      '--extractor-args', 'youtube:player_client=tv',
      ...base,
    ],
  ];

  if (hasYtDlpCookies()) {
    strategies.push([
      ...getYtDlpCookieArgs(),
      ...getYtDlpJsRuntimeArgs(),
      '--extractor-args', 'youtube:player_client=web',
      ...base,
    ]);
  }

  return strategies;
}

async function runYtDlpForTitle(ytdlpCmd, args) {
  try {
    const { stdout } = await execFileAsync(ytdlpCmd, args, EXEC_OPTIONS);
    return typeof stdout === 'string' ? stdout : stdout.toString('utf8');
  } catch (err) {
    // yt-dlp thường exit 1 dù đã in metadata ra stdout
    if (err.stdout) {
      return typeof err.stdout === 'string' ? err.stdout : err.stdout.toString('utf8');
    }
    throw err;
  }
}

function parseTitleFromJson(stdout, videoId) {
  const text = typeof stdout === 'string' ? stdout : stdout.toString('utf8');

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;

    try {
      const data = JSON.parse(trimmed);
      if (data.id === videoId && isValidTitle(data.title, videoId)) {
        return data.title;
      }
    } catch {
      // Bỏ qua dòng không phải JSON hợp lệ
    }
  }

  return null;
}

async function fetchSingleTitle(ytdlpCmd, entry, titleLang) {
  const strategies = buildTitleFetchStrategies(entry, titleLang);

  for (let attempt = 1; attempt <= TITLE_FETCH_RETRIES; attempt++) {
    for (const args of strategies) {
      try {
        const stdout = await runYtDlpForTitle(ytdlpCmd, args);
        const title = parseTitleFromJson(stdout, entry.id);
        if (isValidTitle(title, entry.id)) return title;
      } catch {
        // Thử strategy tiếp theo
      }
    }

    if (attempt < TITLE_FETCH_RETRIES) {
      await sleep(TITLE_FETCH_RETRY_DELAY_MS);
    }
  }

  return null;
}

function createTitleResolver(ytdlpCmd) {
  const titleLang = getTitleLang();
  const trustPlaylistFallback = shouldTrustPlaylistFallback(titleLang);

  return async function resolveVideoTitle(entry) {
    const cached = titleCache.get(entry.id);
    if (cached) return cached;

    if (trustPlaylistFallback && isValidTitle(entry.title, entry.id)) {
      const title = cleanVideoTitle(entry.title, entry.id);
      titleCache.set(entry.id, title);
      return title;
    }

    const fetched = await fetchSingleTitle(ytdlpCmd, entry, titleLang);
    const title = cleanVideoTitle(
      pickBestTitle(fetched, entry.title, entry.id),
      entry.id,
    );
    titleCache.set(entry.id, title);
    return title;
  };
}

function describeTitleResolveMode() {
  const titleLang = getTitleLang();
  if (titleLang) {
    return `Tiêu đề (ngôn ngữ ${titleLang}) lấy khi bắt đầu tải từng video`;
  }
  if (hasYtDlpCookies()) {
    return 'Tiêu đề gốc lấy khi bắt đầu tải từng video (ưu tiên gốc, dự phòng từ playlist)';
  }
  return 'Tiêu đề từ playlist — không cần gọi yt-dlp thêm';
}

module.exports = {
  createTitleResolver,
  resetTitleCache,
  describeTitleResolveMode,
  getTitleLang,
  cleanVideoTitle,
  shouldTrustPlaylistFallback,
  pickBestTitle,
  isValidTitle,
};
