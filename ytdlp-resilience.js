const fs = require('fs');
const path = require('path');

function parsePositiveInt(raw, fallback, max) {
  const n = parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 1) return fallback;
  return max ? Math.min(n, max) : n;
}

function getYtDlpRetryArgs() {
  const retries = parsePositiveInt(process.env.YTDLP_RETRIES, 20, 100);
  const fragmentRetries = parsePositiveInt(process.env.YTDLP_FRAGMENT_RETRIES, 50, 200);
  const fileAccessRetries = parsePositiveInt(process.env.YTDLP_FILE_ACCESS_RETRIES, 10, 50);

  return [
    '--retries', String(retries),
    '--fragment-retries', String(fragmentRetries),
    '--file-access-retries', String(fileAccessRetries),
    '--retry-sleep', 'exp=1:8',
    '--concurrent-fragments', '1',
  ];
}

function getVideoRetryAttempts() {
  return parsePositiveInt(process.env.YTDLP_VIDEO_RETRY, 3, 5);
}

function getVideoRetryDelayMs(attempt) {
  const base = parsePositiveInt(process.env.YTDLP_VIDEO_RETRY_DELAY_SEC, 5, 60);
  return base * attempt * 1000;
}

function getGlobalDownloadConcurrency() {
  const raw = process.env.DOWNLOAD_GLOBAL_CONCURRENCY;
  if (raw === undefined || raw === '') return null;
  return parsePositiveInt(raw, 1, 4);
}

let activeDownloadSlots = 0;
const downloadSlotWaiters = [];

async function acquireDownloadSlot() {
  const limit = getGlobalDownloadConcurrency();
  if (limit === null) return;

  if (activeDownloadSlots < limit) {
    activeDownloadSlots += 1;
    return;
  }

  await new Promise((resolve) => {
    downloadSlotWaiters.push(resolve);
  });
  activeDownloadSlots += 1;
}

function releaseDownloadSlot() {
  const limit = getGlobalDownloadConcurrency();
  if (limit === null) return;

  activeDownloadSlots -= 1;
  const next = downloadSlotWaiters.shift();
  if (next) next();
}

function cleanupPartialDownload(outputPath) {
  const dir = path.dirname(outputPath);
  const base = path.basename(outputPath);
  if (!fs.existsSync(dir)) return;

  for (const file of fs.readdirSync(dir)) {
    if (!file.startsWith(base)) continue;
    if (file.includes('.part') || file.endsWith('.ytdl') || file.endsWith('.temp')) {
      fs.unlinkSync(path.join(dir, file));
    }
  }
}

function isTransientDownloadError(message) {
  const text = String(message || '').toLowerCase();
  return (
    text.includes('more expected')
    || text.includes('giving up after')
    || text.includes('connection reset')
    || text.includes('connection aborted')
    || text.includes('timed out')
    || text.includes('timeout')
    || text.includes('unable to download')
    || text.includes('http error 5')
    || text.includes('http error 429')
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  getYtDlpRetryArgs,
  getVideoRetryAttempts,
  getVideoRetryDelayMs,
  getGlobalDownloadConcurrency,
  acquireDownloadSlot,
  releaseDownloadSlot,
  cleanupPartialDownload,
  isTransientDownloadError,
  sleep,
};
