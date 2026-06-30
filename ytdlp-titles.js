const fs = require('fs');
const path = require('path');

function isValidTitle(title, videoId) {
  if (!title || typeof title !== 'string') return false;

  const trimmed = title.trim();
  if (!trimmed) return false;
  if (videoId && trimmed === videoId) return false;
  if (/^\d{1,4}$/.test(trimmed)) return false;

  const replacementCount = (trimmed.match(/\uFFFD/g) || []).length;
  if (replacementCount > 0 && replacementCount >= trimmed.length / 2) {
    return false;
  }

  return true;
}

function cleanVideoTitle(title, videoId) {
  const cleaned = (title || '')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (isValidTitle(cleaned, videoId)) return cleaned;
  return videoId || 'video';
}

function buildVideoOutputTemplate(saveDir, stt) {
  const normalizedDir = path.resolve(saveDir).replace(/\\/g, '/');
  return `${normalizedDir}/${stt} %(title)s.%(ext)s`;
}

function findVideoFileByStt(saveDir, stt) {
  if (!fs.existsSync(saveDir)) return null;

  const prefix = `${stt} `;
  let newestPath = null;
  let newestMtime = 0;

  for (const file of fs.readdirSync(saveDir)) {
    if (!file.startsWith(prefix) || !file.toLowerCase().endsWith('.mp4')) continue;

    const filePath = path.join(saveDir, file);
    const { mtimeMs } = fs.statSync(filePath);
    if (mtimeMs >= newestMtime) {
      newestMtime = mtimeMs;
      newestPath = filePath;
    }
  }

  return newestPath;
}

function extractTitleFromVideoPath(filePath, stt, videoId) {
  if (!filePath) return null;

  const base = path.basename(filePath, path.extname(filePath));
  const prefix = `${stt} `;
  if (!base.startsWith(prefix)) return null;

  return cleanVideoTitle(base.slice(prefix.length), videoId);
}

function describeTitleNamingMode() {
  return 'Tên file: [STT] + tiêu đề từ yt-dlp khi tải (chính xác nhất)';
}

module.exports = {
  buildVideoOutputTemplate,
  findVideoFileByStt,
  extractTitleFromVideoPath,
  describeTitleNamingMode,
  cleanVideoTitle,
  isValidTitle,
};
