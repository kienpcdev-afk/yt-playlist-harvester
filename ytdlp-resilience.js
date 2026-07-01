function parsePositiveInt(raw, fallback, max) {
  const n = parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 1) return fallback;
  return max ? Math.min(n, max) : n;
}

function getYtDlpRetryArgs() {
  const retries = parsePositiveInt(process.env.YTDLP_RETRIES, 10, 20);
  return [
    '--retries', String(retries),
    '--fragment-retries', String(retries),
  ];
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
  const fs = require('fs');
  const path = require('path');
  const dir = path.dirname(outputPath);
  const base = path.basename(outputPath);
  if (!fs.existsSync(dir)) return;

  for (const file of fs.readdirSync(dir)) {
    if (!file.startsWith(base)) continue;
    if (
      file.includes('.part')
      || file.endsWith('.ytdl')
      || file.endsWith('.temp')
      || file.includes('.premiere-remux.tmp')
    ) {
      fs.unlinkSync(path.join(dir, file));
    }
  }
}

function cleanupPartialDownloadByStt(saveDir, stt) {
  const fs = require('fs');
  const path = require('path');
  if (!fs.existsSync(saveDir)) return;

  const prefix = `${stt} `;
  for (const file of fs.readdirSync(saveDir)) {
    if (!file.startsWith(prefix)) continue;
    if (/\.(part|ytdl|temp|mp4|webm)$/i.test(file)) {
      try {
        fs.unlinkSync(path.join(saveDir, file));
      } catch {
        // Bỏ qua file đang bị khóa
      }
    }
  }
}

module.exports = {
  getYtDlpRetryArgs,
  getGlobalDownloadConcurrency,
  acquireDownloadSlot,
  releaseDownloadSlot,
  cleanupPartialDownload,
  cleanupPartialDownloadByStt,
};
