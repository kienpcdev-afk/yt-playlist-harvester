let isStopping = false;
let activeDownloads = 0;
let gracefulStopNotified = false;

function resetStopState() {
  isStopping = false;
  activeDownloads = 0;
  gracefulStopNotified = false;
}

function requestStop() {
  isStopping = true;
}

function notifyGracefulStop(log, extra = {}) {
  if (gracefulStopNotified) return;
  gracefulStopNotified = true;
  isStopping = false;
  log('stopped_graceful', 'Đã dừng tool an toàn', { activeDownloads: 0, ...extra });
}

function markDownloadStart() {
  activeDownloads += 1;
}

function markDownloadEnd() {
  activeDownloads = Math.max(0, activeDownloads - 1);
}

function shouldStopQueue() {
  return isStopping;
}

function wasGracefullyStopped() {
  return gracefulStopNotified;
}

function abortIfStopping(log, res) {
  if (!isStopping && !gracefulStopNotified) return false;
  notifyGracefulStop(log);
  res.end();
  return true;
}

module.exports = {
  resetStopState,
  requestStop,
  notifyGracefulStop,
  markDownloadStart,
  markDownloadEnd,
  shouldStopQueue,
  wasGracefullyStopped,
  abortIfStopping,
  getActiveDownloads: () => activeDownloads,
};
