import {
  LAST_GAMES,
  PERIOD_GAMES,
  type LastGameInfo,
  type PeriodAttendance,
  type PeriodCode,
  type PopulationFan,
} from "./mock-data";

export type GameFilter = "both" | "home" | "away";

/** The single most recent game that matches the venue filter. */
export function lastGameFor(filter: GameFilter): LastGameInfo {
  return LAST_GAMES[filter];
}

/**
 * Games played inside the period, per venue.
 * "Last game" means exactly one game — the most recent one that matches the
 * venue filter — so the other venue contributes zero games.
 */
export function periodGames(period: PeriodCode, filter: GameFilter): PeriodAttendance {
  if (period !== "lastGame") return PERIOD_GAMES[period];
  const venue = lastGameFor(filter).venue;
  return { home: venue === "home" ? 1 : 0, away: venue === "away" ? 1 : 0 };
}

/** A fan's attendance inside the period, restricted the same way as `periodGames`. */
export function attendanceIn(
  fan: PopulationFan,
  period: PeriodCode,
  filter: GameFilter,
): PeriodAttendance {
  const raw =
    period === "season"
      ? { home: fan.homeAttended, away: fan.awayAttended }
      : fan.periods[period];
  if (period !== "lastGame") return raw;
  const games = periodGames(period, filter);
  return {
    home: games.home ? Math.min(raw.home, 1) : 0,
    away: games.away ? Math.min(raw.away, 1) : 0,
  };
}

/** Number of games the venue filter covers in the period. */
export function gamesPlayed(period: PeriodCode, filter: GameFilter): number {
  return attendedIn(periodGames(period, filter), filter);
}

/** Games attended out of a per-venue count, according to the venue filter. */
export function attendedIn(att: PeriodAttendance, filter: GameFilter): number {
  if (filter === "home") return att.home;
  if (filter === "away") return att.away;
  return att.home + att.away;
}
