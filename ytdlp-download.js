const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

/**
 * Format + merge args cho output MP4 tương thích Premiere (H.264 + AAC trong MP4).
 */

function resolveFfmpegCommand() {
  const fromEnv = (process.env.FFMPEG_PATH || '').trim();
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  return 'ffmpeg';
}

function buildFormatString(resolution) {
  const h = resolution;
  // Ưu tiên H.264 (avc1) + M4A/AAC — tránh VP9/AV1/Opus copy vào MP4 (Premiere chỉ nhận audio).
  return [
    `bestvideo[height<=${h}][vcodec^=avc1]+ba[ext=m4a]`,
    `bestvideo[height<=${h}][vcodec^=avc1]+bestaudio`,
    `bestvideo[height<=${h}]+ba[ext=m4a]`,
    `bestvideo[height<=${h}]+bestaudio`,
    `best[height<=${h}][ext=mp4]`,
    `best[height<=${h}]`,
  ].join('/');
}

function getYtDlpMergeArgs() {
  return [
    '--merge-output-format', 'mp4',
    // Encode lại video nếu codec không tương thích MP4 (VP9, AV1…).
    '--recode-video', 'mp4',
    // Ép AAC khi merge — tránh Opus trong MP4.
    '--postprocessor-args', 'FFmpegMerger:-c:a aac -b:a 192k',
    // H.264 yuv420p khi phải recode video (Premiere cần pixel format chuẩn).
    '--postprocessor-args', 'FFmpegVideoConvertor:-c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p',
  ];
}

/**
 * Viết lại container MP4 (copy stream, không encode) — sửa metadata/edit list
 * khiến Premiere 2022+ chỉ nhận audio sau yt-dlp merge.
 */
async function remuxMp4ForPremiere(inputPath, onLog) {
  if (process.env.SKIP_MP4_REMUX === '1') return;
  if (!inputPath || !fs.existsSync(inputPath)) return;
  if (path.extname(inputPath).toLowerCase() !== '.mp4') return;

  const ffmpeg = resolveFfmpegCommand();
  const tempPath = `${inputPath}.premiere-remux.tmp.mp4`;

  if (onLog) onLog('[info] Chuẩn hóa MP4 cho Premiere (remux, không encode lại)...');

  try {
    await execFileAsync(ffmpeg, [
      '-hide_banner',
      '-loglevel', 'error',
      '-i', inputPath,
      '-c', 'copy',
      '-movflags', '+faststart',
      '-y', tempPath,
    ]);

    try {
      fs.unlinkSync(inputPath);
    } catch {
      // Windows: thử ghi đè nếu unlink thất bại
    }
    fs.renameSync(tempPath, inputPath);
  } catch (err) {
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch { /* ignore */ }
    }
    const hint = err.code === 'ENOENT'
      ? ' (cài ffmpeg hoặc đặt FFMPEG_PATH trong .env)'
      : '';
    throw new Error(`Remux MP4 thất bại: ${err.message}${hint}`);
  }
}

module.exports = {
  buildFormatString,
  getYtDlpMergeArgs,
  remuxMp4ForPremiere,
};
