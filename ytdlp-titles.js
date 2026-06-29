const { execFile } = require('child_process');
const { promisify } = require('util');

const { getYtDlpCookieArgs, getYtDlpJsRuntimeArgs } = require('./ytdlp-cookies');

const execFileAsync = promisify(execFile);

const TITLE_CHUNK_SIZE = 50;
const TITLE_FETCH_TIMEOUT_MS = 120000;

const EXEC_OPTIONS = {
  maxBuffer: 10 * 1024 * 1024,
  timeout: TITLE_FETCH_TIMEOUT_MS,
  encoding: 'utf8',
  env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
};

function getTitleLang() {
  return (process.env.YTDLP_TITLE_LANG || '').trim();
}

function isValidTitle(title) {
  if (!title || typeof title !== 'string') return false;

  const trimmed = title.trim();
  if (!trimmed) return false;

  const replacementCount = (trimmed.match(/\uFFFD/g) || []).length;
  if (replacementCount > 0 && replacementCount >= trimmed.length / 2) {
    return false;
  }

  return true;
}

function pickBestTitle(fetched, fallback, videoId) {
  if (isValidTitle(fetched)) return fetched;
  if (isValidTitle(fallback)) return fallback;
  return videoId || 'video';
}

function cleanVideoTitle(title, videoId) {
  const cleaned = (title || '')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (isValidTitle(cleaned)) return cleaned;
  return videoId || 'video';
}

function buildTitleFetchArgs(entries, titleLang) {
  const urls = entries.map((entry) => `https://www.youtube.com/watch?v=${entry.id}`);

  if (titleLang) {
    return [
      ...getYtDlpCookieArgs(),
      ...getYtDlpJsRuntimeArgs(),
      '--extractor-args', `youtube:player_client=web,lang=${titleLang}`,
      '--no-download',
      '--ignore-errors',
      '-j',
      ...urls,
    ];
  }

  // Không dùng cookies: tránh YouTube trả tiêu đề dịch theo ngôn ngữ tài khoản.
  return [
    ...getYtDlpJsRuntimeArgs(),
    '--extractor-args', 'youtube:player_client=android',
    '--no-download',
    '--ignore-errors',
    '-j',
    ...urls,
  ];
}

function parseTitleOutput(stdout) {
  const titleMap = new Map();
  const text = typeof stdout === 'string' ? stdout : stdout.toString('utf8');

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;

    try {
      const data = JSON.parse(trimmed);
      if (data.id && isValidTitle(data.title)) {
        titleMap.set(data.id, data.title);
      }
    } catch {
      // Bỏ qua dòng không phải JSON hợp lệ
    }
  }

  return titleMap;
}

async function fetchTitleChunk(ytdlpCmd, entries, titleLang) {
  const { stdout } = await execFileAsync(
    ytdlpCmd,
    buildTitleFetchArgs(entries, titleLang),
    EXEC_OPTIONS,
  );

  return parseTitleOutput(stdout);
}

async function fetchOriginalVideoTitles(ytdlpCmd, entries) {
  if (!entries.length) return [];

  const titleLang = getTitleLang();
  const titleMap = new Map();

  for (let i = 0; i < entries.length; i += TITLE_CHUNK_SIZE) {
    const chunk = entries.slice(i, i + TITLE_CHUNK_SIZE);
    try {
      const chunkTitles = await fetchTitleChunk(ytdlpCmd, chunk, titleLang);
      for (const [id, title] of chunkTitles) {
        titleMap.set(id, title);
      }
    } catch {
      // Thử từng video trong chunk nếu batch lỗi
      for (const entry of chunk) {
        try {
          const singleTitles = await fetchTitleChunk(ytdlpCmd, [entry], titleLang);
          for (const [id, title] of singleTitles) {
            titleMap.set(id, title);
          }
        } catch {
          // Giữ tiêu đề từ flat-playlist
        }
      }
    }
  }

  const stillMissing = entries.filter(
    (entry) => !isValidTitle(titleMap.get(entry.id)) && !isValidTitle(entry.title),
  );

  for (const entry of stillMissing) {
    try {
      const singleTitles = await fetchTitleChunk(ytdlpCmd, [entry], titleLang);
      const fetched = singleTitles.get(entry.id);
      if (isValidTitle(fetched)) {
        titleMap.set(entry.id, fetched);
      }
    } catch {
      // Giữ tiêu đề từ flat-playlist hoặc fallback video id
    }
  }

  return entries.map((entry) => ({
    ...entry,
    title: pickBestTitle(titleMap.get(entry.id), entry.title, entry.id),
  }));
}

function describeTitleFetchMode() {
  const titleLang = getTitleLang();
  if (titleLang) {
    return `ngôn ngữ ${titleLang}`;
  }
  return 'tiêu đề gốc';
}

module.exports = {
  fetchOriginalVideoTitles,
  describeTitleFetchMode,
  getTitleLang,
  cleanVideoTitle,
};
