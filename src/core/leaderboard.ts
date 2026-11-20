export interface LeaderboardEntry {
  name: string;
  score: number;
  nights_won: number;
  achieved_at: string;
  seed: number;
}

export interface LeaderboardData {
  entries: LeaderboardEntry[];
}

export const LEADERBOARD_MAX_ENTRIES = 10;

/**
 * Validates player name: 3–12 characters, ASCII [A-Za-z0-9_] or Unicode letters (supports Vietnamese).
 */
export function isValidLeaderboardName(name: string): boolean {
  if (typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (trimmed.length < 3 || trimmed.length > 12) return false;
  return /^[A-Za-z0-9_\p{L}]+$/u.test(trimmed);
}

/**
 * Sorts leaderboard entries by score DESC, tie-breaking by achieved_at ASC (earlier first),
 * and caps to top 10 entries.
 */
export function sortAndTrimLeaderboard(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const ta = Date.parse(a.achieved_at) || 0;
      const tb = Date.parse(b.achieved_at) || 0;
      return ta - tb;
    })
    .slice(0, LEADERBOARD_MAX_ENTRIES);
}

export function addLeaderboardEntry(
  current: LeaderboardEntry[],
  entry: LeaderboardEntry
): LeaderboardEntry[] {
  const cleanName = entry.name.trim();
  if (!isValidLeaderboardName(cleanName)) {
    throw new Error('Tên phải dài 3–12 ký tự (chữ cái, số hoặc dấu gạch dưới).');
  }
  const normalized: LeaderboardEntry = {
    name: cleanName,
    score: Math.max(0, Math.floor(entry.score)),
    nights_won: Math.max(0, Math.min(3, Math.floor(entry.nights_won))),
    achieved_at: entry.achieved_at || formatIsoWithOffset(new Date()),
    seed: Math.floor(entry.seed),
  };
  return sortAndTrimLeaderboard([...current, normalized]);
}

export function formatIsoWithOffset(date: Date): string {
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const absMin = Math.abs(offsetMin);
  const hh = String(Math.floor(absMin / 60)).padStart(2, '0');
  const mm = String(absMin % 60).padStart(2, '0');
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${hh}:${mm}`
  );
}
