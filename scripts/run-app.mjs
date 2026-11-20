import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';
import {
  addLeaderboardEntry,
  sortAndTrimLeaderboard,
} from '../dist-headless/core/leaderboard.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist');
const DATA_DIR = path.join(ROOT, 'data');
const LB_PATH = path.join(DATA_DIR, 'leaderboard.json');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
};

function readLeaderboardFile() {
  try {
    if (!fs.existsSync(LB_PATH)) return { entries: [] };
    const raw = fs.readFileSync(LB_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.entries)) return { entries: [] };
    return { entries: sortAndTrimLeaderboard(parsed.entries) };
  } catch {
    return { entries: [] };
  }
}

function writeLeaderboardFile(entries) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const sorted = sortAndTrimLeaderboard(entries);
  fs.writeFileSync(LB_PATH, JSON.stringify({ entries: sorted }, null, 2) + '\n', 'utf-8');
  return sorted;
}

// Check for --export-leaderboard <out.json>
const argv = process.argv.slice(2);
const exportIdx = argv.indexOf('--export-leaderboard');
if (exportIdx !== -1) {
  const outPath = argv[exportIdx + 1];
  if (!outPath) {
    process.stderr.write('Missing file path after --export-leaderboard\n');
    process.exit(2);
  }
  const data = readLeaderboardFile();
  const resolvedOut = path.resolve(outPath);
  fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });
  fs.writeFileSync(resolvedOut, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  process.stdout.write(`Exported ${data.entries.length} leaderboard entries to ${resolvedOut}\n`);
  process.exit(0);
}

// Normal app server mode
if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
  process.stderr.write('dist/index.html not found. Please run "npm run build" first.\n');
  process.exit(1);
}

const PORT = Number(process.env.PORT) || 4173;

const server = http.createServer((req, res) => {
  const reqUrl = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);

  // Local disk leaderboard REST API
  if (reqUrl.pathname === '/api/leaderboard') {
    if (req.method === 'GET') {
      const data = readLeaderboardFile();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(data));
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > 65536) req.destroy();
      });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body);
          const current = readLeaderboardFile().entries;
          const updated = addLeaderboardEntry(current, payload);
          const saved = writeLeaderboardFile(updated);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ entries: saved }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Invalid entry' }));
        }
      });
      return;
    }
  }

  // Static files from dist/
  let relPath = reqUrl.pathname === '/' ? 'index.html' : reqUrl.pathname.replace(/^\/+/, '');
  relPath = path.normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, '');
  const fullPath = path.join(DIST_DIR, relPath);

  if (!fullPath.startsWith(DIST_DIR) || !fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  const ext = path.extname(fullPath).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
  fs.createReadStream(fullPath).pipe(res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Đảo Đèn Lồng v1.0.0 đang chạy tại: http://localhost:${PORT}`);
  console.log(`  Bảng xếp hạng cục bộ lưu tại: ${LB_PATH}\n`);
});
