const { hasYtDlpCookies } = require('./ytdlp-cookies');

const PLAYLIST_WITH_COOKIES = 'web,android,mweb';
const PLAYLIST_WITHOUT_COOKIES = 'android,tvhtml5,mweb';

const FORMAT_UNAVAILABLE_PATTERNS = [
  /only images are available/i,
  /requested format is not available/i,
  /no video formats found/i,
];

function parsePlayerClientEnv() {
  const raw = (process.env.YTDLP_PLAYER_CLIENT || '').trim();
  if (!raw) return null;
  const clients = raw.split(',').map((c) => c.trim()).filter(Boolean);
  return clients.length > 0 ? clients : null;
}

function dedupeClients(clients) {
  const seen = new Set();
  const result = [];
  for (const client of clients) {
    if (seen.has(client)) continue;
    seen.add(client);
    result.push(client);
  }
  return result;
}

function getDownloadClientFallbackList() {
  const fromEnv = parsePlayerClientEnv();
  const base = fromEnv || (hasYtDlpCookies()
    ? ['android', 'mweb', 'web']
    : ['android', 'tvhtml5', 'mweb']);

  return dedupeClients(['default', ...base.filter((c) => c !== 'default')]);
}

function getPlaylistClientChain() {
  const fromEnv = parsePlayerClientEnv();
  if (fromEnv) return fromEnv.join(',');
  return hasYtDlpCookies() ? PLAYLIST_WITH_COOKIES : PLAYLIST_WITHOUT_COOKIES;
}

function buildExtractorArgs(playerClient) {
  return ['--extractor-args', `youtube:player_client=${playerClient}`];
}

function getYtDlpExtractorArgs(playerClient) {
  if (playerClient === 'default') return [];
  if (playerClient) return buildExtractorArgs(playerClient);
  return buildExtractorArgs(getPlaylistClientChain());
}

function isYtDlpFormatUnavailableError(message) {
  const text = message || '';
  return FORMAT_UNAVAILABLE_PATTERNS.some((pattern) => pattern.test(text));
}

function describePlayerClientLabel(client) {
  return client === 'default' ? '(mặc định yt-dlp)' : client;
}

function describeYtDlpPlayerClients() {
  const download = getDownloadClientFallbackList().map(describePlayerClientLabel).join(' → ');
  return `tải: ${download} | playlist: ${getPlaylistClientChain()}`;
}

module.exports = {
  getDownloadClientFallbackList,
  getYtDlpExtractorArgs,
  isYtDlpFormatUnavailableError,
  describePlayerClientLabel,
  describeYtDlpPlayerClients,
};
