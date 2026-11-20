import * as fs from 'node:fs';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const OUT_DIR = path.join(ROOT, 'docs', 'proof', 'phase-4');
fs.mkdirSync(OUT_DIR, { recursive: true });

const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' };
const srv = http.createServer((req, res) => {
  const rel = (req.url || '/').split('?')[0];
  const p = path.join(DIST, rel === '/' ? 'index.html' : rel);
  if (!fs.existsSync(p)) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { 'Content-Type': mime[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function takeShot(url, outFile, tmpProfile) {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      chrome,
      [
        '--headless=new',
        `--user-data-dir=${tmpProfile}`,
        '--window-size=1280,720',
        '--hide-scrollbars',
        '--no-first-run',
        '--enable-webgl',
        `--screenshot=${outFile}`,
        url,
      ],
      { stdio: 'ignore' }
    );
    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`Timeout capturing ${outFile}`));
    }, 15000);
    proc.on('exit', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`Chrome exited with ${code}`));
    });
  });
}

async function main() {
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  const tmpProfile = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-shot-'));
  try {
    await takeShot(
      `http://127.0.0.1:${port}/`,
      path.join(OUT_DIR, 'screenshot-menu.png'),
      tmpProfile
    );
    console.log('Captured screenshot-menu.png');
    await takeShot(
      `http://127.0.0.1:${port}/?bench=1&seed=42&duration=5`,
      path.join(OUT_DIR, 'screenshot-bench.png'),
      tmpProfile
    );
    console.log('Captured screenshot-bench.png');
  } finally {
    srv.close();
    fs.rmSync(tmpProfile, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
