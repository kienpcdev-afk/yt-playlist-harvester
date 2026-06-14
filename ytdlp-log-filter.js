const SKIP_PATTERNS = [
  /^\[youtube\]\s+Extracting URL:/i,
  /^\[youtube\][^:]*:\s+Downloading (webpage|web client config|web player API JSON|player|android|tv)/i,
  /^\[youtube\]\s+\[jsc:/i,
  /^\[download\]\s+Sleeping .* as required/i,
];

function parseDownloadPercent(line) {
  const match = line.match(/^\[download\]\s+(\d+(?:\.\d+)?)%\s+of/i);
  return match ? parseFloat(match[1]) : null;
}

function simplifyDestinationLine(line) {
  const match = line.match(/^\[download\]\s+Destination:\s+(.+)$/i);
  if (!match) return line;
  const filePath = match[1].trim();
  const parts = filePath.replace(/\\/g, '/').split('/');
  return `[download] Destination: ${parts[parts.length - 1]}`;
}

function simplifyDownloadLine(line) {
  const match = line.match(
    /^\[download\]\s+(\d+(?:\.\d+)?)%\s+of\s+([\d.]+\w+iB)(?:\s+at\s+([\d.]+\w+iB\/s))?(?:\s+ETA\s+([\d:]+))?/i,
  );
  if (!match) return line;

  const [, pct, size, speed, eta] = match;
  let summary = `[download] ${pct}% / ${size}`;
  if (speed) summary += ` @ ${speed}`;
  if (eta) summary += ` ETA ${eta}`;
  return summary;
}

function shouldSkipLine(line) {
  return SKIP_PATTERNS.some((pattern) => pattern.test(line));
}

function createYtDlpProgressLogger(onLog) {
  const state = { lastMilestone: -1, loggedDestination: false };

  return (line) => {
    const trimmed = line.trim();
    if (!trimmed || shouldSkipLine(trimmed)) return;

    const pct = parseDownloadPercent(trimmed);
    if (pct !== null) {
      if (pct >= 99.5) {
        if (state.lastMilestone < 100) {
          state.lastMilestone = 100;
          onLog(simplifyDownloadLine(trimmed));
        }
        return;
      }

      const milestone = Math.floor(pct / 25) * 25;
      if (milestone > state.lastMilestone) {
        state.lastMilestone = milestone;
        onLog(simplifyDownloadLine(trimmed));
      }
      return;
    }

    if (/^\[download\]\s+100%/i.test(trimmed) && /\s in \d/i.test(trimmed)) {
      onLog(trimmed);
      return;
    }

    if (/^\[download\]\s+Destination:/i.test(trimmed)) {
      if (state.loggedDestination) return;
      state.loggedDestination = true;
      onLog(simplifyDestinationLine(trimmed));
      return;
    }

    onLog(trimmed);
  };
}

module.exports = { createYtDlpProgressLogger };
