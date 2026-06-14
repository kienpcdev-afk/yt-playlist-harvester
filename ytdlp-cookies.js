const path = require('path');
const fs = require('fs');

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

function getYtDlpCookieArgs() {
  const fromBrowser = (process.env.YTDLP_COOKIES_FROM_BROWSER || '').trim();
  if (fromBrowser) {
    return ['--cookies-from-browser', fromBrowser];
  }

  const envPath = process.env.YTDLP_COOKIES;
  const cookieFile = resolveCookieFile(envPath || 'cookies.txt');
  if (cookieFile) {
    return ['--cookies', cookieFile];
  }

  return [];
}

function describeYtDlpCookies() {
  const fromBrowser = (process.env.YTDLP_COOKIES_FROM_BROWSER || '').trim();
  if (fromBrowser) {
    return `trình duyệt (${fromBrowser})`;
  }

  const envPath = process.env.YTDLP_COOKIES;
  const cookieFile = resolveCookieFile(envPath || 'cookies.txt');
  if (cookieFile) {
    return path.basename(cookieFile);
  }

  return null;
}

function hasYtDlpCookies() {
  return getYtDlpCookieArgs().length > 0;
}

module.exports = {
  getYtDlpCookieArgs,
  getYtDlpJsRuntimeArgs,
  describeYtDlpCookies,
  describeYtDlpJsRuntime,
  hasYtDlpCookies,
};
