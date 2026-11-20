import * as fs from 'node:fs';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawn, execSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function parseArgs(argv) {
  let seed = 42;
  let duration = 30;
  let outPath = 'bench.json';
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const next = argv[i + 1];
    if (flag === '--seed' && next !== undefined) {
      seed = parseInt(next, 10);
      i++;
    } else if (flag === '--duration' && next !== undefined) {
      duration = parseFloat(next);
      i++;
    } else if (flag === '--out' && next !== undefined) {
      outPath = next;
      i++;
    }
  }
  return { seed, duration, outPath };
}

function findBrowserExecutable() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }

  const platform = process.platform;
  const candidates = [];

  if (platform === 'win32') {
    const pf = process.env.ProgramFiles || 'C:\\Program Files';
    const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    candidates.push(
      path.join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(pf86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(pf, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(pf86, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
    );
  } else if (platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'
    );
  } else {
    candidates.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium'
    );
  }

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }

  // Try PATH lookup on Linux/macOS
  if (platform !== 'win32') {
    for (const cmd of ['google-chrome', 'chromium', 'chromium-browser']) {
      try {
        const resolved = execSync(`which ${cmd}`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
        if (resolved) return resolved;
      } catch {
        // continue
      }
    }
  }
  return null;
}

function sampleProcessTreeRssMb(pid) {
  try {
    if (process.platform === 'win32') {
      const out = execSync(
        `powershell -NoProfile -Command "(Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -eq ${pid} -or $_.ParentProcessId -eq ${pid} } | Measure-Object -Property WorkingSetSize -Sum).Sum"`,
        { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }
      ).trim();
      const bytes = Number(out);
      if (Number.isFinite(bytes) && bytes > 0) return bytes / (1024 * 1024);
    } else {
      const out = execSync(`ps -o rss= -p ${pid}`, {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      const kb = Number(out);
      if (Number.isFinite(kb) && kb > 0) return kb / 1024;
    }
  } catch {
    // Ignore measurement failures
  }
  return null;
}

async function main() {
  const { seed, duration, outPath } = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
    process.stderr.write('dist/index.html not found. Please run "npm run build" first.\n');
    process.exit(1);
  }

  const browserPath = findBrowserExecutable();
  if (!browserPath) {
    process.stderr.write(
      'No Chrome/Chromium/Edge browser found. Set CHROME_PATH env variable to run bench.\n'
    );
    process.exit(1);
  }

  const processStartEpoch = Date.now();
  let peakMemMb = null;
  let browserProc = null;
  let memInterval = null;
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dao-den-long-bench-'));

  let resolveBench;
  let rejectBench;
  const benchPromise = new Promise((res, rej) => {
    resolveBench = res;
    rejectBench = rej;
  });

  const server = http.createServer((req, res) => {
    const reqUrl = new URL(req.url || '/', 'http://127.0.0.1');

    if (reqUrl.pathname === '/api/bench-result' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
        try {
          resolveBench(JSON.parse(body));
        } catch (err) {
          rejectBench(err);
        }
      });
      return;
    }

    let relPath = reqUrl.pathname === '/' ? 'index.html' : reqUrl.pathname.replace(/^\/+/, '');
    relPath = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, '');
    const fullPath = path.join(DIST_DIR, relPath);
    if (!fullPath.startsWith(DIST_DIR) || !fs.existsSync(fullPath)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(fullPath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    fs.createReadStream(fullPath).pipe(res);
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 4173;
  const benchUrl = `http://127.0.0.1:${port}/?bench=1&seed=${seed}&duration=${duration}&start=${processStartEpoch}`;

  const chromeArgs = [
    `--app=${benchUrl}`,
    '--window-size=1280,720',
    `--user-data-dir=${userDataDir}`,
    '--disable-frame-rate-limit',
    '--disable-gpu-vsync',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--autoplay-policy=no-user-gesture-required',
  ];

  browserProc = spawn(browserPath, chromeArgs, { stdio: 'ignore' });

  memInterval = setInterval(() => {
    if (browserProc && browserProc.pid) {
      const mb = sampleProcessTreeRssMb(browserProc.pid);
      if (mb !== null) {
        peakMemMb = peakMemMb === null ? mb : Math.max(peakMemMb, mb);
      }
    }
  }, 1500);

  const timeoutMs = (duration + 35) * 1000;
  const timeoutHandle = setTimeout(() => {
    rejectBench(new Error(`Benchmark timed out after ${timeoutMs / 1000}s`));
  }, timeoutMs);

  try {
    const metrics = await benchPromise;
    clearTimeout(timeoutHandle);
    clearInterval(memInterval);

    const report = {
      contract_version: '1.3',
      avg_fps: metrics.avg_fps,
      p1_low_fps: metrics.p1_low_fps,
      frame_ms_p95: metrics.frame_ms_p95,
      frames: metrics.frames,
      load_ms: metrics.load_ms,
      peak_mem_mb: peakMemMb !== null ? Math.round(peakMemMb) : null,
      vsync_off: true,
      renderer: metrics.renderer || 'Three.js 0.170.0 (WebGL2)',
      os: `${os.platform()} ${os.release()} (${os.arch()})`,
    };

    const resolvedOut = path.resolve(outPath);
    fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });
    fs.writeFileSync(resolvedOut, JSON.stringify(report, null, 2) + '\n', 'utf-8');

    console.log(
      `Benchmark complete (${duration}s): avg_fps=${report.avg_fps}, ` +
        `p1_low_fps=${report.p1_low_fps}, frame_ms_p95=${report.frame_ms_p95}ms, ` +
        `frames=${report.frames}, load_ms=${report.load_ms}ms, peak_mem_mb=${report.peak_mem_mb}`
    );
  } finally {
    clearTimeout(timeoutHandle);
    clearInterval(memInterval);
    if (browserProc && !browserProc.killed) {
      try {
        if (process.platform === 'win32') {
          execSync(`taskkill /PID ${browserProc.pid} /T /F`, { stdio: 'ignore' });
        } else {
          browserProc.kill('SIGTERM');
        }
      } catch {
        // ignore
      }
    }
    server.close();
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

main().catch((err) => {
  process.stderr.write(`Benchmark error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
