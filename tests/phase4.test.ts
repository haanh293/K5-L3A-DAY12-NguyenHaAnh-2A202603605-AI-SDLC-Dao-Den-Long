import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import {
  addLeaderboardEntry,
  isValidLeaderboardName,
  sortAndTrimLeaderboard,
  type LeaderboardEntry,
} from '../src/core/leaderboard.js';

const ROOT = path.resolve(import.meta.dirname, '..');

describe('Phase 4 features — Leaderboard, Export & Soak (Ticket-04 · Contract v1.3)', () => {
  it('validates leaderboard names (3–12 chars [A-Za-z0-9_] + Vietnamese)', () => {
    expect(isValidLeaderboardName('May_01')).toBe(true);
    expect(isValidLeaderboardName('HàAnh_12')).toBe(true);
    expect(isValidLeaderboardName('ab')).toBe(false); // < 3
    expect(isValidLeaderboardName('1234567890123')).toBe(false); // > 12
    expect(isValidLeaderboardName('May!@#')).toBe(false);
    expect(isValidLeaderboardName('May 01')).toBe(false);
  });

  it('sorts leaderboard by score DESC, tie-breaks by achieved_at ASC, and keeps top 10', () => {
    let list: LeaderboardEntry[] = [];
    for (let i = 0; i < 12; i++) {
      list = addLeaderboardEntry(list, {
        name: `User_${i}`,
        score: i === 5 || i === 8 ? 500 : i * 40,
        nights_won: 2,
        achieved_at: `2026-11-20T10:${String(i).padStart(2, '0')}:00+07:00`,
        seed: 100 + i,
      });
    }
    const sorted = sortAndTrimLeaderboard(list);
    expect(sorted.length).toBe(10);
    // User_5 and User_8 tied at 500 -> User_5 achieved earlier (10:05 < 10:08) ranks #1
    expect(sorted[0].name).toBe('User_5');
    expect(sorted[1].name).toBe('User_8');
    expect(sorted[2].score).toBe(440);
  });

  it('supports <run_cmd> --export-leaderboard out.json', () => {
    const outPath = path.join(ROOT, 'tmp', 'test-lb-export.json');
    execFileSync('node', [
      path.join(ROOT, 'scripts', 'run-app.mjs'),
      '--export-leaderboard',
      outPath,
    ]);
    const data = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
    expect(Array.isArray(data.entries)).toBe(true);
  });

  it('runs soak test cleanly with 0 crashes and bounded memory', () => {
    const outPath = path.join(ROOT, 'tmp', 'test-soak-unit.json');
    execFileSync('node', [
      '--expose-gc',
      path.join(ROOT, 'scripts', 'soak.mjs'),
      '--seed', '7',
      '--nights', '3',
      '--out', outPath,
    ]);
    const report = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
    expect(report.nights).toBe(3);
    expect(report.crashes).toBe(0);
    expect(report.results.length).toBe(3);
    expect(report.mem_end_mb).toBeLessThanOrEqual(report.mem_start_mb * 1.2);
  });
});
