const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const AUTO_BROWSERS = ['firefox', 'edge', 'chrome', 'brave', 'chromium'];
const COOKIE_PROBE_URL = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';
const PROBE_TIMEOUT_MS = 45000;
const CHROMIUM_COOKIE_FLAG = '--disable-features=LockProfileCookieDatabase';

let resolvedCookieArgs = null;
let resolvedCookieDesc = null;
let cookiesInitialized = false;
let cookiesInitWarning = null;

function resolveCookieFile(rawPath) {
  const trimmed = (rawPath || '').trim();
  if (!trimmed) return null;

  const resolved = path.isAbsolute(trimmed)
    ? path.resolve(trimmed)
    : path.resolve(__dirname, trimmed);

  return fs.existsSync(resolved) ? resolved : null;
}

function getYtDlpJsRuntimeValue() {
  const raw = (process.env.YTDLP_JS_RUNTIME ?? 'node').trim();
  if (!raw || raw === 'none' || raw === 'off') return null;
  return raw;
}

function getYtDlpJsRuntimeArgs() {
  const runtime = getYtDlpJsRuntimeValue();
  if (!runtime) return [];
  return ['--js-runtimes', runtime];
}

function describeYtDlpJsRuntime() {
  return getYtDlpJsRuntimeValue();
}

function getFileCookieArgs() {
  const envPath = process.env.YTDLP_COOKIES;
  const cookieFile = resolveCookieFile(envPath || 'cookies.txt');
  if (cookieFile) {
    return ['--cookies', cookieFile];
  }
  return [];
}

function describeFileCookies() {
  const envPath = process.env.YTDLP_COOKIES;
  const cookieFile = resolveCookieFile(envPath || 'cookies.txt');
  if (cookieFile) {
    return path.basename(cookieFile);
  }
  return null;
}

function getBrowserCookieArgs(browser) {
  return ['--cookies-from-browser', browser];
}

function getYtDlpCookieArgsSync() {
  const fromBrowser = (process.env.YTDLP_COOKIES_FROM_BROWSER || '').trim();
  if (fromBrowser && fromBrowser.toLowerCase() !== 'auto') {
    return getBrowserCookieArgs(fromBrowser);
  }

  return getFileCookieArgs();
}

function getYtDlpCookieArgs() {
  if (cookiesInitialized) {
    return resolvedCookieArgs || [];
  }
  return getYtDlpCookieArgsSync();
}

function describeYtDlpCookies() {
  if (cookiesInitialized) {
    return resolvedCookieDesc;
  }

  const fromBrowser = (process.env.YTDLP_COOKIES_FROM_BROWSER || '').trim();
  if (fromBrowser) {
    return fromBrowser.toLowerCase() === 'auto'
      ? 'trình duyệt (auto)'
      : `trình duyệt (${fromBrowser})`;
  }

  return describeFileCookies();
}

function hasYtDlpCookies() {
  return getYtDlpCookieArgs().length > 0;
}

function getCookiesInitWarning() {
  return cookiesInitWarning;
}

function getAutoBrowsers() {
  return [...AUTO_BROWSERS];
}

async function probeBrowserCookies(ytdlpCmd, browser) {
  try {
    await execFileAsync(
      ytdlpCmd,
      [
        ...getYtDlpJsRuntimeArgs(),
        '--cookies-from-browser',
        browser,
        '--no-download',
        '--print',
        'title',
        COOKIE_PROBE_URL,
      ],
      { timeout: PROBE_TIMEOUT_MS },
    );
    return true;
  } catch {
    return false;
  }
}

async function initYtDlpCookies(ytdlpCmd) {
  cookiesInitWarning = null;
  const fromBrowser = (process.env.YTDLP_COOKIES_FROM_BROWSER || '').trim();

  if (!fromBrowser) {
    resolvedCookieArgs = getFileCookieArgs();
    resolvedCookieDesc = describeFileCookies();
    cookiesInitialized = true;
    return {
      args: resolvedCookieArgs,
      desc: resolvedCookieDesc,
      warning: null,
    };
  }

  const tryFileFallback = () => {
    const fileArgs = getFileCookieArgs();
    if (fileArgs.length === 0) return false;
    resolvedCookieArgs = fileArgs;
    resolvedCookieDesc = `${describeFileCookies()} (dự phòng)`;
    return true;
  };

  if (fromBrowser.toLowerCase() === 'auto') {
    for (const browser of AUTO_BROWSERS) {
      if (await probeBrowserCookies(ytdlpCmd, browser)) {
        resolvedCookieArgs = getBrowserCookieArgs(browser);
        resolvedCookieDesc = `trình duyệt (${browser}, tự chọn)`;
        cookiesInitialized = true;
        return {
          args: resolvedCookieArgs,
          desc: resolvedCookieDesc,
          warning: null,
        };
      }
    }

    if (tryFileFallback()) {
      cookiesInitWarning =
        'Không đọc được cookies từ trình duyệt — dùng cookies.txt. Chạy: npm run setup:browser-cookies';
    } else {
      resolvedCookieArgs = [];
      resolvedCookieDesc = null;
      cookiesInitWarning =
        'Không lấy được cookies tự động. Đăng nhập YouTube trên trình duyệt, rồi chạy: npm run setup:cookies';
    }

    cookiesInitialized = true;
    return {
      args: resolvedCookieArgs,
      desc: resolvedCookieDesc,
      warning: cookiesInitWarning,
    };
  }

  if (await probeBrowserCookies(ytdlpCmd, fromBrowser)) {
    resolvedCookieArgs = getBrowserCookieArgs(fromBrowser);
    resolvedCookieDesc = `trình duyệt (${fromBrowser})`;
    cookiesInitialized = true;
    return {
      args: resolvedCookieArgs,
      desc: resolvedCookieDesc,
      warning: null,
    };
  }

  if (tryFileFallback()) {
    cookiesInitWarning =
      `Không đọc được cookies từ ${fromBrowser} — dùng cookies.txt. Chạy: npm run setup:browser-cookies`;
  } else {
    resolvedCookieArgs = getBrowserCookieArgs(fromBrowser);
    resolvedCookieDesc = `trình duyệt (${fromBrowser})`;
    cookiesInitWarning =
      `Không đọc được cookies từ ${fromBrowser}. Đóng trình duyệt hoặc chạy: npm run setup:browser-cookies`;
  }

  cookiesInitialized = true;
  return {
    args: resolvedCookieArgs,
    desc: resolvedCookieDesc,
    warning: cookiesInitWarning,
  };
}

function getDefaultCookieFilePath() {
  const envPath = process.env.YTDLP_COOKIES;
  const trimmed = (envPath || 'cookies.txt').trim();
  if (!trimmed) return path.join(__dirname, 'cookies.txt');
  return path.isAbsolute(trimmed) ? path.resolve(trimmed) : path.join(__dirname, trimmed);
}

function reloadFileCookies() {
  const fromBrowser = (process.env.YTDLP_COOKIES_FROM_BROWSER || '').trim();
  if (fromBrowser) {
    return {
      reloaded: false,
      message:
        'Đang dùng cookies từ trình duyệt — xóa YTDLP_COOKIES_FROM_BROWSER trong .env để dùng cookies.txt từ Extension.',
    };
  }

  resolvedCookieArgs = getFileCookieArgs();
  resolvedCookieDesc = describeFileCookies();
  cookiesInitialized = true;

  return {
    reloaded: resolvedCookieArgs.length > 0,
    desc: resolvedCookieDesc,
  };
}

module.exports = {
  getYtDlpCookieArgs,
  getYtDlpJsRuntimeArgs,
  describeYtDlpCookies,
  describeYtDlpJsRuntime,
  hasYtDlpCookies,
  initYtDlpCookies,
  getCookiesInitWarning,
  getAutoBrowsers,
  probeBrowserCookies,
  getDefaultCookieFilePath,
  reloadFileCookies,
  CHROMIUM_COOKIE_FLAG,
};
