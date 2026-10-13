import { describe, expect, it } from "vitest";
import { awayGames, fanPopulation, homeGames, LAST_GAMES } from "../mock-data";
import { attendanceIn, gamesPlayed, lastGameFor, periodGames } from "../periods";

describe("last game = the single most recent game", () => {
  it("picks the latest finished game per venue, and the later of the two for 'all games'", () => {
    const latest = (games: typeof homeGames) =>
      games.filter((g) => g.status === "finished").map((g) => g.date).sort().at(-1);
    expect(LAST_GAMES.home.date).toBe(latest(homeGames));
    expect(LAST_GAMES.away.date).toBe(latest(awayGames));
    expect(LAST_GAMES.both.date).toBe([LAST_GAMES.home.date, LAST_GAMES.away.date].sort().at(-1));
    expect(lastGameFor("both").venue).toBe(LAST_GAMES.both.venue);
  });

  it("counts exactly one game whatever the venue filter", () => {
    expect(gamesPlayed("lastGame", "both")).toBe(1);
    expect(gamesPlayed("lastGame", "home")).toBe(1);
    expect(gamesPlayed("lastGame", "away")).toBe(1);
    expect(periodGames("lastGame", "away")).toEqual({ home: 0, away: 1 });
  });

  it("zeroes the other venue's attendance so nobody exceeds 1/1", () => {
    const venue = LAST_GAMES.both.venue;
    const other = venue === "home" ? "away" : "home";
    for (const fan of fanPopulation) {
      const att = attendanceIn(fan, "lastGame", "both");
      expect(att[other]).toBe(0);
      expect(att[venue]).toBeLessThanOrEqual(1);
      expect(att[venue]).toBe(Math.min(fan.periods.lastGame[venue], 1));
    }
  });

  it("leaves the other periods untouched", () => {
    expect(periodGames("lastMonth", "both")).toEqual({ home: 2, away: 1 });
    expect(gamesPlayed("season", "both")).toBe(20);
    const fan = fanPopulation[0];
    expect(attendanceIn(fan, "season", "home")).toEqual({ home: fan.homeAttended, away: fan.awayAttended });
  });
});
