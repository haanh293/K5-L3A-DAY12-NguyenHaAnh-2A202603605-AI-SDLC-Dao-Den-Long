import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const RELEASE_DIR = path.join(ROOT, 'release');
const STAGE_DIR = path.join(RELEASE_DIR, 'dao-den-long-v1.0.0');
const ZIP_PATH = path.join(RELEASE_DIR, 'dao-den-long-v1.0.0.zip');

fs.rmSync(STAGE_DIR, { recursive: true, force: true });
fs.mkdirSync(STAGE_DIR, { recursive: true });

const itemsToCopy = [
  'dist',
  'dist-headless',
  'scripts',
  'game.contract.json',
  'package.json',
  'README.md',
  'LICENSE',
  'CREDITS.md',
  'CHANGELOG.md',
];

for (const item of itemsToCopy) {
  const src = path.join(ROOT, item);
  const dst = path.join(STAGE_DIR, item);
  if (fs.existsSync(src)) {
    fs.cpSync(src, dst, { recursive: true });
  }
}

if (fs.existsSync(ZIP_PATH)) fs.unlinkSync(ZIP_PATH);

if (process.platform === 'win32') {
  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path '${STAGE_DIR}' -DestinationPath '${ZIP_PATH}' -Force"`,
    { stdio: 'inherit' }
  );
} else {
  execSync(`zip -r "${ZIP_PATH}" "dao-den-long-v1.0.0"`, { cwd: RELEASE_DIR, stdio: 'inherit' });
}

console.log(`Packaged Release v1.0.0 archive: ${ZIP_PATH}`);
