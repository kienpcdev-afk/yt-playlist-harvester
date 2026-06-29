require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const {
  initYtDlpCookies,
  getAutoBrowsers,
  probeBrowserCookies,
  CHROMIUM_COOKIE_FLAG,
} = require('../ytdlp-cookies');

function resolveYtDlpCmd() {
  const fromEnv = (process.env.YTDLP_PATH || '').trim();
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;

  const localExe = path.join(__dirname, '..', 'yt-dlp.exe');
  if (process.platform === 'win32' && fs.existsSync(localExe)) return localExe;

  return 'yt-dlp';
}

function runPowerShellScript(scriptPath) {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      'powershell',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
      { stdio: 'inherit', shell: true },
    );
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`setup-browser-cookies.ps1 thoát với mã ${code}`));
    });
  });
}

async function main() {
  const ytdlpCmd = resolveYtDlpCmd();
  const fromBrowser = (process.env.YTDLP_COOKIES_FROM_BROWSER || '').trim();

  console.log('=== Kiểm tra cookies YouTube ===\n');
  console.log(`yt-dlp: ${ytdlpCmd}`);

  if (!fromBrowser) {
    console.log('\nChưa bật cookies tự động trong .env.');
    console.log('Thêm dòng sau vào .env rồi chạy lại:');
    console.log('  YTDLP_COOKIES_FROM_BROWSER=auto\n');
    process.exit(1);
  }

  if (fromBrowser.toLowerCase() === 'auto') {
    console.log('\nĐang thử lần lượt:', getAutoBrowsers().join(' → '));
    for (const browser of getAutoBrowsers()) {
      process.stdout.write(`  ${browser}... `);
      const ok = await probeBrowserCookies(ytdlpCmd, browser);
      console.log(ok ? 'OK' : 'lỗi');
      if (ok) {
        console.log(`\n✓ Dùng được: ${browser}`);
        console.log('\nKhởi động lại server: npm run start:win');
        return;
      }
    }
  } else {
    const result = await initYtDlpCookies(ytdlpCmd);
    if (result.desc && !result.warning) {
      console.log(`\n✓ ${result.desc}`);
      console.log('\nKhởi động lại server: npm run start:win');
      return;
    }
    if (result.warning) {
      console.log(`\n⚠ ${result.warning}`);
    }
  }

  if (process.platform !== 'win32') {
    console.log('\nTrên macOS/Linux, dùng cookies.txt hoặc --cookies-from-browser firefox.');
    process.exit(1);
  }

  console.log('\n--- Chromium (Chrome/Edge) trên Windows ---');
  console.log('Chrome/Edge khóa file cookie khi đang mở.');
  console.log('Cần thiết lập MỘT LẦN (khoảng 30 giây):\n');
  console.log('  npm run setup:browser-cookies\n');
  console.log('Script sẽ thêm flag vào shortcut Chrome/Edge:');
  console.log(`  ${CHROMIUM_COOKIE_FLAG}`);
  console.log('\nSau đó mở Chrome/Edge bằng shortcut trên Desktop, đăng nhập YouTube, chạy lại:');
  console.log('  npm run setup:cookies');

  const ps1 = path.join(__dirname, 'setup-browser-cookies.ps1');
  if (process.argv.includes('--fix')) {
    console.log('\nĐang chạy thiết lập shortcut...\n');
    await runPowerShellScript(ps1);
    console.log('\nThử lại cookies...\n');
    const retry = await initYtDlpCookies(ytdlpCmd);
    if (retry.desc && !retry.warning) {
      console.log(`✓ ${retry.desc}`);
      console.log('\nKhởi động lại server: npm run start:win');
      return;
    }
    if (retry.warning) console.log(`⚠ ${retry.warning}`);
  }

  process.exit(1);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
