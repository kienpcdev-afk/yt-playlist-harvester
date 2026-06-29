function getDownloadConcurrency() {
  const raw = parseInt(process.env.DOWNLOAD_CONCURRENCY, 10);
  if (!Number.isInteger(raw) || raw < 1) return 2;
  return Math.min(raw, 4);
}

async function runWithConcurrency(items, workerFn, concurrency, options = {}) {
  const {
    continueOnError = false,
    shouldStop,
    onItemStart,
    onItemEnd,
  } = options;
  if (items.length === 0) return { results: [], failures: [], stopped: false };

  const results = new Array(items.length);
  const failures = [];
  let nextIndex = 0;
  let failed = null;

  async function runner() {
    while (!failed) {
      if (shouldStop && shouldStop()) break;
      const i = nextIndex++;
      if (i >= items.length) break;
      onItemStart?.();
      try {
        results[i] = await workerFn(items[i], i);
      } catch (err) {
        if (continueOnError) {
          failures.push({ index: i, item: items[i], error: err });
        } else {
          failed = err;
          break;
        }
      } finally {
        onItemEnd?.();
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, runner),
  );

  if (failed) throw failed;
  return {
    results: results.filter(Boolean),
    failures,
    stopped: Boolean(shouldStop && shouldStop()),
  };
}

function buildSkippedSummary(failures, formatStt) {
  return failures.map((failure) => ({
    stt: formatStt(failure.item.playlistPosition),
    playlistPosition: failure.item.playlistPosition,
    videoId: failure.item.id,
    title: failure.item.title,
    videoUrl: failure.item.videoUrl,
  }));
}

function logSkippedSummary(log, failures, formatStt) {
  const skipped = buildSkippedSummary(failures, formatStt);
  if (skipped.length === 0) return skipped;

  log('skipped', `Đã bỏ qua ${skipped.length} video — tải tay bằng link bên dưới:`, { skipped });
  for (const item of skipped) {
    log('skipped', `[${item.stt}] #${item.playlistPosition} ${item.title}`, { skippedItem: item });
    log('skipped', `  → ${item.videoUrl}`, { skippedItem: item });
  }
  return skipped;
}

module.exports = {
  getDownloadConcurrency,
  runWithConcurrency,
  buildSkippedSummary,
  logSkippedSummary,
};
