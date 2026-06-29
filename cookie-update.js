const fs = require('fs');
const express = require('express');
const { getDefaultCookieFilePath, reloadFileCookies } = require('./ytdlp-cookies');

const NETSCAPE_HEADER = '# Netscape HTTP Cookie File';

function extractCookieContent(req) {
  if (typeof req.body === 'string' && req.body.trim()) {
    return req.body;
  }
  if (req.body && typeof req.body === 'object') {
    const value = req.body.cookie || req.body.cookies || req.body.content;
    return typeof value === 'string' ? value : '';
  }
  return '';
}

function ensureNetscapeHeader(content) {
  const trimmed = content.trim();
  if (!trimmed) return '';
  if (trimmed.includes(NETSCAPE_HEADER)) {
    return `${trimmed}\n`;
  }
  return `${NETSCAPE_HEADER}\n# File do Extension Đồng bộ Cookie Tool Tải Playlist YouTube tạo ra.\n\n${trimmed}\n`;
}

function countCookieLines(content) {
  return content
    .split('\n')
    .filter((line) => line && !line.startsWith('#') && line.includes('\t'))
    .length;
}

function saveCookiesFile(content) {
  const normalized = ensureNetscapeHeader(content);
  if (!normalized) {
    throw new Error('Nội dung cookie trống');
  }

  const cookieCount = countCookieLines(normalized);
  if (cookieCount === 0) {
    throw new Error('Không có dòng cookie hợp lệ (định dạng Netscape)');
  }

  const filePath = getDefaultCookieFilePath();
  fs.writeFileSync(filePath, normalized, 'utf8');
  const reload = reloadFileCookies();

  return { filePath, cookieCount, reload };
}

function registerCookieUpdateRoute(app) {
  app.options('/update-cookie', (_req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.sendStatus(204);
  });

  app.post(
    '/update-cookie',
    express.text({ type: ['text/*', 'application/octet-stream'], limit: '2mb' }),
    (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');

      try {
        const content = extractCookieContent(req);
        const { filePath, cookieCount, reload } = saveCookiesFile(content);

        res.json({
          ok: true,
          message: 'Cập nhật thành công!',
          path: filePath,
          cookieCount,
          ytDlpReloaded: reload.reloaded,
          ytDlpNote: reload.reloaded ? reload.desc : reload.message || null,
        });
      } catch (err) {
        res.status(400).json({
          ok: false,
          error: err.message,
        });
      }
    },
  );
}

module.exports = {
  registerCookieUpdateRoute,
  saveCookiesFile,
  getDefaultCookieFilePath,
};
