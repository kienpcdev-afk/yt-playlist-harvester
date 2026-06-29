const TOOL_URL = 'http://localhost:3000/update-cookie';

const syncBtn = document.getElementById('syncBtn');
const statusEl = document.getElementById('status');

function showStatus(type, message) {
  statusEl.className = `show ${type}`;
  statusEl.textContent = message;
}

function isYouTubeUrl(url) {
  try {
    const host = new URL(url).hostname;
    return host === 'youtube.com' || host.endsWith('.youtube.com');
  } catch {
    return false;
  }
}

function toNetscape(cookies) {
  const lines = [
    '# Netscape HTTP Cookie File',
    '# File do Extension Đồng bộ Cookie Tool Tải Playlist YouTube tạo ra.',
    '',
  ];

  for (const cookie of cookies) {
    const domain = cookie.domain || '';
    const includeSubdomains = domain.startsWith('.') ? 'TRUE' : 'FALSE';
    const cookiePath = cookie.path || '/';
    const secure = cookie.secure ? 'TRUE' : 'FALSE';
    const expiry = cookie.expirationDate ? Math.floor(cookie.expirationDate) : 0;

    lines.push(
      `${domain}\t${includeSubdomains}\t${cookiePath}\t${secure}\t${expiry}\t${cookie.name}\t${cookie.value}`,
    );
  }

  return `${lines.join('\n')}\n`;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function fetchYouTubeCookies() {
  return chrome.cookies.getAll({ domain: 'youtube.com' });
}

async function sendToTool(netscapeText) {
  const response = await fetch(TOOL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    body: netscapeText,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const detail = payload?.error || `HTTP ${response.status}`;
    throw new Error(detail);
  }

  return payload;
}

syncBtn.addEventListener('click', async () => {
  syncBtn.disabled = true;
  showStatus('info', 'Đang lấy Cookie...');

  try {
    const tab = await getActiveTab();
    if (!tab?.url || !isYouTubeUrl(tab.url)) {
      throw new Error('Hãy mở tab YouTube (đã đăng nhập) rồi thử lại.');
    }

    const cookies = await fetchYouTubeCookies();
    if (!cookies.length) {
      throw new Error('Không tìm thấy Cookie YouTube. Hãy đăng nhập tài khoản Google trên youtube.com trước.');
    }

    const netscapeText = toNetscape(cookies);
    const result = await sendToTool(netscapeText);

    let message = result.message || 'Cập nhật thành công!';
    if (typeof result.cookieCount === 'number') {
      message += ` (${result.cookieCount} Cookie)`;
    }
    if (result.ytDlpNote && !result.ytDlpReloaded) {
      message += `\n\nLưu ý: ${result.ytDlpNote}`;
    }

    showStatus('ok', message);
  } catch (err) {
    const msg = err.message || String(err);
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      showStatus(
        'err',
        'Không kết nối được Tool. Hãy chạy npm run start:win và thử lại.',
      );
    } else {
      showStatus('err', msg);
    }
  } finally {
    syncBtn.disabled = false;
  }
});
