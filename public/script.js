const API_BASE = window.location.origin;
const THEME_KEY = 'theme';

const downloadForm = document.getElementById('downloadForm');
const playlistUrlInput = document.getElementById('playlistUrl');
const fromIndexInput = document.getElementById('fromIndex');
const toIndexInput = document.getElementById('toIndex');
const resolutionSelect = document.getElementById('resolution');
const downloadPathInput = document.getElementById('downloadPath');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const stopBtnText = document.getElementById('stopBtnText');
const btnIcon = document.getElementById('btnIcon');
const btnSpinner = document.getElementById('btnSpinner');
const btnText = document.getElementById('btnText');
const themeToggle = document.getElementById('themeToggle');
const iconSun = document.getElementById('iconSun');
const iconMoon = document.getElementById('iconMoon');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const logTerminal = document.getElementById('logTerminal');
const clearLogBtn = document.getElementById('clearLogBtn');
const syncCookieBtn = document.getElementById('syncCookieBtn');
const progressSection = document.getElementById('progressSection');
const progressBar = document.getElementById('progressBar');
const progressPercent = document.getElementById('progressPercent');
const progressDetail = document.getElementById('progressDetail');
const summaryBadge = document.getElementById('summaryBadge');
const summaryCount = document.getElementById('summaryCount');

let totalVideos = 0;
let completedVideos = 0;
let isDownloading = false;
let isStopPending = false;
let abortController = null;

function isDark() {
  return document.documentElement.classList.contains('dark');
}

function updateThemeIcons() {
  const dark = isDark();
  iconSun.classList.toggle('hidden', dark);
  iconMoon.classList.toggle('hidden', !dark);
}

function setTheme(theme) {
  const dark = theme === 'dark';
  document.documentElement.classList.toggle('dark', dark);
  localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
  updateThemeIcons();
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'dark';
  setTheme(saved);
}

function timestamp() {
  return new Date().toLocaleTimeString('vi-VN', { hour12: false });
}

function appendLog(text, className = 'text-green-400') {
  const line = document.createElement('p');
  line.className = `${className} break-all`;
  line.textContent = `[${timestamp()}] ${text}`;
  logTerminal.appendChild(line);
  logTerminal.scrollTop = logTerminal.scrollHeight;
}

function clearLog() {
  logTerminal.innerHTML = '';
}

function resetStopButton() {
  isStopPending = false;
  stopBtn.disabled = true;
  stopBtnText.textContent = 'Dừng tải';
}

function setDownloading(loading) {
  isDownloading = loading;
  startBtn.disabled = loading;
  stopBtn.disabled = loading ? isStopPending : true;
  playlistUrlInput.disabled = loading;
  fromIndexInput.disabled = loading;
  toIndexInput.disabled = loading;
  resolutionSelect.disabled = loading;
  downloadPathInput.disabled = loading;

  btnIcon.classList.toggle('hidden', loading);
  btnSpinner.classList.toggle('hidden', !loading);
  btnText.textContent = loading ? 'Đang tải...' : 'Bắt đầu tải hàng loạt';

  if (loading) {
    startBtn.classList.add('animate-pulse');
    progressBar.classList.remove('idle');
    if (!isStopPending) {
      stopBtn.disabled = false;
    }
  } else {
    startBtn.classList.remove('animate-pulse');
    resetStopButton();
    if (completedVideos >= totalVideos && totalVideos > 0) {
      progressBar.classList.add('idle');
    }
  }
}

function setStopPending() {
  isStopPending = true;
  stopBtn.disabled = true;
  stopBtnText.textContent = 'Đang đợi hoàn thành video cuối...';
}

function updateProgress() {
  if (totalVideos === 0) {
    progressBar.style.width = '0%';
    progressBar.classList.add('idle');
    progressPercent.textContent = '0%';
    progressDetail.textContent = 'Chưa bắt đầu';
    return;
  }

  const percent = Math.round((completedVideos / totalVideos) * 100);
  progressBar.style.width = `${percent}%`;
  progressPercent.textContent = `${percent}%`;
  progressDetail.textContent = `Đã tải xong ${completedVideos}/${totalVideos} video`;

  if (completedVideos >= totalVideos) {
    progressBar.classList.add('idle');
  } else {
    progressBar.classList.remove('idle');
  }
}

function resetProgress() {
  totalVideos = 0;
  completedVideos = 0;
  updateProgress();
  summaryBadge.classList.add('hidden');
  progressSection.classList.add('hidden');
}

async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    statusDot.className = 'h-2 w-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50';
    statusText.textContent = data.message || 'Server online';
  } catch {
    statusDot.className = 'h-2 w-2 rounded-full bg-red-500 shadow-sm shadow-red-500/50';
    statusText.textContent = 'Server offline';
  }
}

function parseSSEBlock(block) {
  let event = 'message';
  let data = '';

  for (const line of block.split('\n')) {
    if (line.startsWith('event: ')) event = line.slice(7).trim();
    else if (line.startsWith('data: ')) data = line.slice(6);
  }

  return { event, data: data ? JSON.parse(data) : {} };
}

function handleSSEEvent(event, data) {
  const msg = data.message || '';

  switch (event) {
    case 'info':
      appendLog(msg, 'text-zinc-300');
      break;

    case 'playlist':
      totalVideos = data.selected || 0;
      completedVideos = 0;
      progressSection.classList.remove('hidden');
      summaryBadge.classList.remove('hidden');
      summaryCount.textContent = totalVideos;
      updateProgress();
      appendLog(msg, 'text-emerald-400');
      break;

    case 'start':
      appendLog(msg, 'text-cyan-400');
      break;

    case 'progress':
      appendLog(`  ${msg}`, 'text-green-500/80');
      break;

    case 'video_done':
      appendLog(msg, 'text-emerald-300');
      break;

    case 'thumb_done':
      appendLog(msg, 'text-emerald-300/70');
      break;

    case 'thumb_error':
      appendLog(msg, 'text-yellow-500');
      break;

    case 'cleanup':
      appendLog(msg, 'text-zinc-400');
      break;

    case 'item_done':
      completedVideos = data.index || completedVideos + 1;
      updateProgress();
      appendLog(msg, 'text-emerald-400 font-bold');
      break;

    case 'skip':
      appendLog(msg, 'text-yellow-500 font-bold');
      break;

    case 'skipped':
      if (data.skipped?.length) {
        appendLog(msg, 'text-amber-400 font-bold');
      } else if (data.skippedItem?.videoUrl && msg.startsWith('  →')) {
        appendLog(msg, 'text-amber-200');
      } else {
        appendLog(msg, 'text-amber-300');
      }
      break;

    case 'done':
      completedVideos = data.results?.length ?? totalVideos;
      updateProgress();
      appendLog(msg, 'text-emerald-400');
      appendLog('✓ Hoàn thành toàn bộ quá trình tải.', 'text-white');
      break;

    case 'stopped_graceful': {
      appendLog(msg, 'text-amber-400 font-bold');
      if ((data.skippedCount ?? 0) > 0) {
        appendLog('→ Xem danh sách link tải tay ở các dòng "Đã bỏ qua" phía trên.', 'text-amber-300');
      }
      appendLog('✓ Đã dừng an toàn — các video đang tải đã hoàn thành.', 'text-white');
      break;
    }

    case 'error':
      appendLog(`✗ LỖI: ${msg}`, 'text-red-500 font-bold');
      break;

    default:
      if (msg) appendLog(msg, 'text-zinc-400');
  }
}

async function consumeSSEStream(readableStream) {
  const reader = readableStream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() || '';

    for (const block of blocks) {
      const trimmed = block.trim();
      if (!trimmed) continue;
      try {
        const { event, data } = parseSSEBlock(trimmed);
        handleSSEEvent(event, data);
      } catch (err) {
        appendLog(`Lỗi parse SSE: ${err.message}`, 'text-red-500');
      }
    }
  }

  if (buffer.trim()) {
    try {
      const { event, data } = parseSSEBlock(buffer.trim());
      handleSSEEvent(event, data);
    } catch {
      // bỏ qua phần dư không hoàn chỉnh
    }
  }
}

async function startPlaylistDownload(payload) {
  abortController = new AbortController();

  const res = await fetch(`${API_BASE}/api/playlist/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: abortController.signal,
  });

  const contentType = res.headers.get('Content-Type') || '';

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error('API không tồn tại (404). Hãy dừng server cũ và chạy lại: npm start');
    }
    if (contentType.includes('application/json')) {
      const err = await res.json();
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    throw new Error(`HTTP ${res.status}`);
  }

  if (!contentType.includes('text/event-stream')) {
    throw new Error('Server không trả về SSE stream');
  }

  await consumeSSEStream(res.body);
}

themeToggle.addEventListener('click', () => {
  setTheme(isDark() ? 'light' : 'dark');
});

stopBtn.addEventListener('click', async () => {
  if (!isDownloading || isStopPending) return;

  setStopPending();
  appendLog('Đang yêu cầu dừng tải — chờ video đang tải hoàn thành...', 'text-amber-400');

  try {
    const res = await fetch(`${API_BASE}/api/download/stop`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
  } catch (err) {
    appendLog(`✗ Không gửi được lệnh dừng: ${err.message}`, 'text-red-500 font-bold');
    isStopPending = false;
    if (isDownloading) {
      stopBtn.disabled = false;
      stopBtnText.textContent = 'Dừng tải';
    }
  }
});

downloadForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (isDownloading) return;

  const playlistUrl = playlistUrlInput.value.trim();
  const fromIndex = parseInt(fromIndexInput.value, 10);
  const toIndex = parseInt(toIndexInput.value, 10);
  const resolution = parseInt(resolutionSelect.value, 10);
  const downloadPath = downloadPathInput.value.trim();

  if (!playlistUrl) return;

  if (fromIndex < 1 || toIndex < fromIndex) {
    appendLog('✗ fromIndex phải >= 1 và toIndex phải >= fromIndex', 'text-red-500 font-bold');
    return;
  }

  clearLog();
  resetProgress();
  setDownloading(true);

  appendLog('Khởi động tải playlist...', 'text-zinc-300');
  appendLog(`URL: ${playlistUrl}`, 'text-zinc-500');
  appendLog(`Phạm vi: video #${fromIndex} → #${toIndex} | ${resolution}p`, 'text-zinc-500');
  appendLog(`Thư mục lưu: ${downloadPath || './downloads (mặc định)'}`, 'text-zinc-500');

  try {
    await startPlaylistDownload({
      playlistUrl,
      fromIndex,
      toIndex,
      resolution,
      downloadPath: downloadPath || undefined,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      appendLog('Đã hủy yêu cầu tải.', 'text-yellow-500');
    } else {
      appendLog(`✗ LỖI: ${err.message}`, 'text-red-500 font-bold');
    }
  } finally {
    abortController = null;
    setDownloading(false);
  }
});

clearLogBtn.addEventListener('click', () => {
  clearLog();
  appendLog('// Log đã được xóa.', 'text-zinc-600');
});

syncCookieBtn.addEventListener('click', () => {
  appendLog('→ Đồng bộ Cookie: cài Extension Chrome trong thư mục chrome-extension/', 'text-cyan-400');
  appendLog('  1. Mở youtube.com và đăng nhập Google', 'text-zinc-500');
  appendLog('  2. Nhấn icon Extension → "Cập nhật Cookie về Tool"', 'text-zinc-500');
  appendLog('  3. Cookie sẽ gửi về POST /update-cookie trên server này', 'text-zinc-500');
  appendLog('  Hoặc chạy: npm run setup:browser-cookies', 'text-zinc-500');
});

initTheme();
checkHealth();
