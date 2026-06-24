function getDownloadConcurrency() {
  const raw = parseInt(process.env.DOWNLOAD_CONCURRENCY, 10);
  if (!Number.isInteger(raw) || raw < 1) return 2;
  return Math.min(raw, 4);
}

async function runWithConcurrency(items, workerFn, concurrency, options = {}) {
  const { continueOnError = false } = options;
  if (items.length === 0) return { results: [], failures: [] };

  const results = new Array(items.length);
  const failures = [];
  let nextIndex = 0;
  let failed = null;

  async function runner() {
    while (!failed) {
      const i = nextIndex++;
      if (i >= items.length) break;
      try {
        results[i] = await workerFn(items[i], i);
      } catch (err) {
        if (continueOnError) {
          failures.push({ index: i, item: items[i], error: err });
        } else {
          failed = err;
          break;
        }
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, runner),
  );

  if (failed) throw failed;
  return { results: results.filter(Boolean), failures };
}

module.exports = { getDownloadConcurrency, runWithConcurrency };
