// Mock data for UI development — replaced by API calls once endpoints land.
// V1 is a capabilities/design showcase, so everything renders from this file.
// All display strings are either translation codes (resolved via i18n keys)
// or bilingual L10n values; person names stay Hebrew like real club data.
import type { L10n } from "./i18n";

export type FanStatusCode = "active" | "inactive";
export type GameStatusCode = "finished" | "selling" | "planned";
export type CampaignStatusCode = "active" | "finished" | "draft";
export type PriorityCode = "high" | "medium" | "low";
export type ChannelCode = "email" | "sms" | "whatsapp";
export type SubTypeCode = "regular" | "silver" | "vip";
export type ProductCategory =
  | "jerseys"
  | "scarves"
  | "accessories"
  | "kids"
  | "other";

// ─────────────────────────────── Cities ──────────────────────────────────────

export interface City {
  id: string;
  name: L10n;
  lat: number;
  lng: number;
}

export const cityList: City[] = [
  { id: "beersheba", name: { he: "באר שבע", en: "Be'er Sheva" }, lat: 31.2518, lng: 34.7913 },
  { id: "ofakim", name: { he: "אופקים", en: "Ofakim" }, lat: 31.3141, lng: 34.6203 },
  { id: "dimona", name: { he: "דימונה", en: "Dimona" }, lat: 31.0684, lng: 35.0332 },
  { id: "netivot", name: { he: "נתיבות", en: "Netivot" }, lat: 31.4171, lng: 34.5886 },
  { id: "yeroham", name: { he: "ירוחם", en: "Yeroham" }, lat: 30.9877, lng: 34.9327 },
  { id: "sderot", name: { he: "שדרות", en: "Sderot" }, lat: 31.524, lng: 34.5964 },
  { id: "meitar", name: { he: "מיתר", en: "Meitar" }, lat: 31.323, lng: 34.9336 },
  { id: "omer", name: { he: "עומר", en: "Omer" }, lat: 31.2634, lng: 34.8467 },
  { id: "lehavim", name: { he: "להבים", en: "Lehavim" }, lat: 31.3743, lng: 34.8117 },
  { id: "arad", name: { he: "ערד", en: "Arad" }, lat: 31.2589, lng: 35.2128 },
  { id: "ashkelon", name: { he: "אשקלון", en: "Ashkelon" }, lat: 31.6688, lng: 34.5743 },
  { id: "ashdod", name: { he: "אשדוד", en: "Ashdod" }, lat: 31.8014, lng: 34.6435 },
  { id: "kiryatgat", name: { he: "קריית גת", en: "Kiryat Gat" }, lat: 31.61, lng: 34.7642 },
  { id: "rahat", name: { he: "רהט", en: "Rahat" }, lat: 31.3925, lng: 34.7544 },
  { id: "mitzpe", name: { he: "מצפה רמון", en: "Mitzpe Ramon" }, lat: 30.6103, lng: 34.8011 },
  { id: "eilat", name: { he: "אילת", en: "Eilat" }, lat: 29.5581, lng: 34.9482 },
];

export const cityById: Record<string, City> = Object.fromEntries(
  cityList.map((c) => [c.id, c]),
);

const UNKNOWN_CITY: L10n = { he: "לא ידוע", en: "Unknown" };

/** Safe city lookup — imported fans may have no (or an unknown) city. */
export function cityName(cityId: string | undefined | null): L10n {
  return (cityId && cityById[cityId]?.name) || UNKNOWN_CITY;
}

// ─────────────────────────────── Teams & stadiums ────────────────────────────

export const teams = {
  maccabiTA: { he: "מכבי תל אביב", en: "Maccabi Tel Aviv" },
  beitar: { he: 'בית"ר ירושלים', en: "Beitar Jerusalem" },
  kiryatShmona: { he: "עירוני קריית שמונה", en: "Ironi Kiryat Shmona" },
  hapoelHaifa: { he: "הפועל חיפה", en: "Hapoel Haifa" },
  maccabiNetanya: { he: "מכבי נתניה", en: "Maccabi Netanya" },
  maccabiHaifa: { he: "מכבי חיפה", en: "Maccabi Haifa" },
  hapoelTA: { he: "הפועל תל אביב", en: "Hapoel Tel Aviv" },
  sakhnin: { he: "בני סכנין", en: "Bnei Sakhnin" },
  petahTikva: { he: "מכבי פתח תקווה", en: "Maccabi Petah Tikva" },
} satisfies Record<string, L10n>;

export const stadiums = {
  turner: { he: "טרנר", en: "Turner" },
  sammyOfer: { he: "סמי עופר", en: "Sammy Ofer" },
  bloomfield: { he: "בלומפילד", en: "Bloomfield" },
  doha: { he: "דוחא", en: "Doha" },
  hamoshava: { he: "המושבה", en: "HaMoshava" },
} satisfies Record<string, L10n>;

// ─────────────────────────────── Curated fans ────────────────────────────────

export interface FanAppActivity {
  lastLogin: string | null;
  logins30d: number;
  avgSessionMin: number;
  pushEnabled: boolean;
}

export interface ReservedSeat {
  area: string;
  row: string;
  number: string;
}

export interface MockFan {
  id: string;
  customerNumber: string;
  firstName: string;
  lastName: string;
  age: number | null;
  cityId: string;
  phone: string;
  email: string;
  subscriptionType: SubTypeCode | null;
  score: number;
  status: FanStatusCode;
  lastActivity: string;
  memberSince: string;
  emailOptIn: boolean;
  smsOptIn: boolean;
  whatsappOptIn: boolean;
  pushOptIn: boolean;
  app: FanAppActivity;
  /** Subscriber's reserved seat (from the ticketing export) */
  seat?: ReservedSeat | null;
  /** Fields carried over from the previous CRM */
  legacyId?: string;
  oldEmail?: string;
  imported?: boolean;
}

export const fans: MockFan[] = [
  { id: "1", customerNumber: "10248", firstName: "יוסי", lastName: "כהן", age: 34, cityId: "beersheba", phone: "050-1234567", email: "yossi.c@gmail.com", subscriptionType: "vip", score: 92, status: "active", lastActivity: "2026-08-20", memberSince: "2018-07-01", emailOptIn: true, smsOptIn: true, whatsappOptIn: true, pushOptIn: true, app: { lastLogin: "2026-08-31", logins30d: 26, avgSessionMin: 11, pushEnabled: true } },
  { id: "2", customerNumber: "10315", firstName: "מיכל", lastName: "לוי", age: 28, cityId: "beersheba", phone: "052-2345678", email: "michal.levi@gmail.com", subscriptionType: "regular", score: 84, status: "active", lastActivity: "2026-08-22", memberSince: "2020-08-15", emailOptIn: true, smsOptIn: false, whatsappOptIn: true, pushOptIn: true, app: { lastLogin: "2026-08-30", logins30d: 19, avgSessionMin: 8, pushEnabled: true } },
  { id: "3", customerNumber: "10422", firstName: "אבי", lastName: "פרץ", age: 45, cityId: "ofakim", phone: "054-3456789", email: "avi.peretz@walla.co.il", subscriptionType: "silver", score: 77, status: "active", lastActivity: "2026-08-18", memberSince: "2015-06-20", emailOptIn: true, smsOptIn: true, whatsappOptIn: false, pushOptIn: false, app: { lastLogin: "2026-08-12", logins30d: 6, avgSessionMin: 5, pushEnabled: false } },
  { id: "4", customerNumber: "10518", firstName: "שרה", lastName: "ביטון", age: 31, cityId: "dimona", phone: "053-4567890", email: "sara.biton@gmail.com", subscriptionType: null, score: 58, status: "active", lastActivity: "2026-07-30", memberSince: "2022-09-01", emailOptIn: true, smsOptIn: false, whatsappOptIn: false, pushOptIn: true, app: { lastLogin: "2026-08-25", logins30d: 9, avgSessionMin: 6, pushEnabled: true } },
  { id: "5", customerNumber: "10620", firstName: "דוד", lastName: "אזולאי", age: 52, cityId: "netivot", phone: "050-5678901", email: "david.az@gmail.com", subscriptionType: "regular", score: 88, status: "active", lastActivity: "2026-08-21", memberSince: "2012-07-10", emailOptIn: false, smsOptIn: true, whatsappOptIn: true, pushOptIn: false, app: { lastLogin: "2026-08-19", logins30d: 12, avgSessionMin: 7, pushEnabled: false } },
  { id: "6", customerNumber: "10711", firstName: "רונית", lastName: "מלכה", age: 39, cityId: "beersheba", phone: "052-6789012", email: "ronit.m@gmail.com", subscriptionType: "regular", score: 65, status: "active", lastActivity: "2026-08-10", memberSince: "2019-08-05", emailOptIn: true, smsOptIn: true, whatsappOptIn: true, pushOptIn: false, app: { lastLogin: "2026-08-08", logins30d: 4, avgSessionMin: 4, pushEnabled: false } },
  { id: "7", customerNumber: "10809", firstName: "אלי", lastName: "דהן", age: 26, cityId: "yeroham", phone: "054-7890123", email: "eli.dahan@gmail.com", subscriptionType: null, score: 43, status: "inactive", lastActivity: "2026-05-14", memberSince: "2023-01-12", emailOptIn: true, smsOptIn: false, whatsappOptIn: false, pushOptIn: false, app: { lastLogin: "2026-05-14", logins30d: 0, avgSessionMin: 3, pushEnabled: false } },
  { id: "8", customerNumber: "10933", firstName: "נועה", lastName: "שטרית", age: 23, cityId: "beersheba", phone: "053-8901234", email: "noa.shitrit@gmail.com", subscriptionType: "regular", score: 81, status: "active", lastActivity: "2026-08-23", memberSince: "2024-08-01", emailOptIn: true, smsOptIn: true, whatsappOptIn: true, pushOptIn: true, app: { lastLogin: "2026-08-31", logins30d: 31, avgSessionMin: 14, pushEnabled: true } },
  { id: "9", customerNumber: "11047", firstName: "משה", lastName: "אוחיון", age: 61, cityId: "sderot", phone: "050-9012345", email: "moshe.o@walla.co.il", subscriptionType: "silver", score: 71, status: "active", lastActivity: "2026-08-15", memberSince: "2005-07-22", emailOptIn: false, smsOptIn: true, whatsappOptIn: false, pushOptIn: false, app: { lastLogin: null, logins30d: 0, avgSessionMin: 0, pushEnabled: false } },
  { id: "10", customerNumber: "11150", firstName: "תמר", lastName: "עמר", age: 35, cityId: "meitar", phone: "052-0123456", email: "tamar.amar@gmail.com", subscriptionType: null, score: 52, status: "inactive", lastActivity: "2026-06-02", memberSince: "2021-03-18", emailOptIn: true, smsOptIn: false, whatsappOptIn: true, pushOptIn: false, app: { lastLogin: "2026-06-02", logins30d: 1, avgSessionMin: 2, pushEnabled: false } },
];

// Reserved seats for the showcase subscribers
const reservedSeats: Record<string, ReservedSeat> = {
  "1": { area: "A", row: "12", number: "7" },
  "2": { area: "B", row: "4", number: "15" },
  "3": { area: "C", row: "20", number: "3" },
  "5": { area: "A", row: "9", number: "22" },
  "6": { area: "D", row: "15", number: "11" },
  "8": { area: "B", row: "2", number: "8" },
  "9": { area: "A", row: "1", number: "1" },
};
for (const fan of fans) fan.seat = reservedSeats[fan.id] ?? null;

export const tags = ["מנוי ותיק", "משפחה", "צפון", "אוהד שרוף", "סטודנט"];

// ─────────────────────────────── Main dashboard ──────────────────────────────

export const dashboardKpis = {
  totalFans: 18500,
  totalFansDeltaPct: 12,
  activeSubscribers: 8234,
  activeSubscribersDeltaPct: 5.2,
  notRenewed: 1456,
  activeInApp: 12340,
  activeCampaigns: 6,
};

// month is 1-based; rendered with locale-aware month names
export const fanGrowth = [
  { year: 2026, month: 3, fans: 15200 },
  { year: 2026, month: 4, fans: 15850 },
  { year: 2026, month: 5, fans: 16300 },
  { year: 2026, month: 6, fans: 16900 },
  { year: 2026, month: 7, fans: 17600 },
  { year: 2026, month: 8, fans: 18500 },
];

export const subscriberSplit = [
  { key: "splitActive", value: 8234, color: "#15803d" },
  { key: "splitNotRenewed", value: 1456, color: "#dc2626" },
  { key: "splitNoSub", value: 8810, color: "#9ca3af" },
] as const;

export const recentCampaigns: {
  id: string;
  name: string;
  status: CampaignStatusCode;
  reach: number;
  date: string;
}[] = [
  { id: "c1", name: "קמפיין חידוש מנויים 2026/27", status: "active", reach: 3420, date: "2026-08-18" },
  { id: "c2", name: "יום הולדת — אוגוסט", status: "active", reach: 512, date: "2026-08-01" },
  { id: "c3", name: "דרבי בתל אביב — מכירת כרטיסים", status: "finished", reach: 2011, date: "2026-07-25" },
  { id: "c4", name: "התעוררות אוהדים רדומים", status: "draft", reach: 0, date: "2026-08-24" },
];

// Feed items are translated via dashboard.activity{n} keys
export const activityFeed = [
  { id: "a1", key: "activity1", time: "2026-08-25T09:12:00" },
  { id: "a2", key: "activity2", time: "2026-08-24T18:40:00" },
  { id: "a3", key: "activity3", time: "2026-08-24T11:05:00" },
  { id: "a4", key: "activity4", time: "2026-08-23T20:18:00" },
  { id: "a5", key: "activity5", time: "2026-08-23T02:00:00" },
] as const;

// ─────────────────────────────── Subscriptions ───────────────────────────────

export const subscriptionKpis = {
  active: 8234,
  lastSeason: 9120,
  notRenewed: 1456,
  renewalPercent: 84,
  retentionPotential: 620,
};

export const seasonComparison = [
  { season: "2021/22", subscribers: 6100 },
  { season: "2022/23", subscribers: 6900 },
  { season: "2023/24", subscribers: 7800 },
  { season: "2024/25", subscribers: 9120 },
  { season: "2025/26", subscribers: 8234 },
];

export const renewalTrend = [
  { year: 2026, month: 3, active: 7200, renewed: 5400 },
  { year: 2026, month: 4, active: 7500, renewed: 6100 },
  { year: 2026, month: 5, active: 7800, renewed: 6800 },
  { year: 2026, month: 6, active: 8000, renewed: 7300 },
  { year: 2026, month: 7, active: 8150, renewed: 7700 },
  { year: 2026, month: 8, active: 8234, renewed: 7900 },
];

export interface ChurnedSubscriber {
  id: string;
  customerNumber: string;
  name: string;
  age: number;
  cityId: string;
  type: SubTypeCode;
  years: number;
  lastPayment: string;
  priority: PriorityCode;
  actionKey:
    | "actionCallVeteran"
    | "actionVisit"
    | "actionSmsReminder"
    | "actionPaymentPlan"
    | "actionStudentCampaign";
}

export const churnedSubscribers: ChurnedSubscriber[] = [
  { id: "1", customerNumber: "10422", name: "אבי פרץ", age: 45, cityId: "ofakim", type: "silver", years: 9, lastPayment: "2025-07-14", priority: "high", actionKey: "actionCallVeteran" },
  { id: "2", customerNumber: "11047", name: "משה אוחיון", age: 61, cityId: "sderot", type: "silver", years: 20, lastPayment: "2025-08-02", priority: "high", actionKey: "actionVisit" },
  { id: "3", customerNumber: "10518", name: "שרה ביטון", age: 31, cityId: "dimona", type: "regular", years: 3, lastPayment: "2025-06-30", priority: "medium", actionKey: "actionSmsReminder" },
  { id: "4", customerNumber: "11150", name: "תמר עמר", age: 35, cityId: "meitar", type: "regular", years: 4, lastPayment: "2025-07-22", priority: "medium", actionKey: "actionPaymentPlan" },
  { id: "5", customerNumber: "10809", name: "אלי דהן", age: 26, cityId: "yeroham", type: "regular", years: 2, lastPayment: "2025-08-10", priority: "low", actionKey: "actionStudentCampaign" },
];

// ─────────────────────────────── Games ───────────────────────────────────────

export interface MockGame {
  id: string;
  date: string;
  opponent: L10n;
  competition: "LEAGUE" | "CUP" | "EUROPE";
  stadium: L10n;
  subscribers: number;
  tickets: number;
  total: number;
  capacity: number;
  attended?: number;
  revenue: number;
  status: GameStatusCode;
}

export const homeGames: MockGame[] = [
  { id: "h1", date: "2026-08-16", opponent: teams.maccabiTA, competition: "LEAGUE", stadium: stadiums.turner, subscribers: 7900, tickets: 7400, total: 15300, capacity: 16126, revenue: 512000, status: "finished" },
  { id: "h2", date: "2026-08-02", opponent: teams.beitar, competition: "LEAGUE", stadium: stadiums.turner, subscribers: 7700, tickets: 6800, total: 14500, capacity: 16126, revenue: 448000, status: "finished" },
  { id: "h3", date: "2026-07-19", opponent: teams.kiryatShmona, competition: "LEAGUE", stadium: stadiums.turner, subscribers: 7100, tickets: 3900, total: 11000, capacity: 16126, revenue: 262000, status: "finished" },
  { id: "h4", date: "2026-07-05", opponent: teams.hapoelHaifa, competition: "CUP", stadium: stadiums.turner, subscribers: 6800, tickets: 3200, total: 10000, capacity: 16126, revenue: 231000, status: "finished" },
  { id: "h5", date: "2026-08-30", opponent: teams.maccabiNetanya, competition: "LEAGUE", stadium: stadiums.turner, subscribers: 0, tickets: 5200, total: 5200, capacity: 16126, revenue: 341000, status: "selling" },
];

export const awayGames: MockGame[] = [
  { id: "a1", date: "2026-08-09", opponent: teams.maccabiHaifa, competition: "LEAGUE", stadium: stadiums.sammyOfer, subscribers: 0, tickets: 1850, total: 1850, capacity: 2000, attended: 1710, revenue: 64000, status: "finished" },
  { id: "a2", date: "2026-07-26", opponent: teams.hapoelTA, competition: "LEAGUE", stadium: stadiums.bloomfield, subscribers: 0, tickets: 2011, total: 2011, capacity: 2200, attended: 1930, revenue: 71000, status: "finished" },
  { id: "a3", date: "2026-07-12", opponent: teams.sakhnin, competition: "LEAGUE", stadium: stadiums.doha, subscribers: 0, tickets: 950, total: 950, capacity: 1500, attended: 820, revenue: 29000, status: "finished" },
  { id: "a4", date: "2026-09-13", opponent: teams.petahTikva, competition: "CUP", stadium: stadiums.hamoshava, subscribers: 0, tickets: 620, total: 620, capacity: 1800, revenue: 21000, status: "selling" },
];

export interface LastGameInfo {
  venue: "home" | "away";
  opponent: L10n;
  date: string;
}

function latestFinished(games: MockGame[], venue: "home" | "away"): LastGameInfo {
  const game = games
    .filter((g) => g.status === "finished")
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  return { venue, opponent: game.opponent, date: game.date };
}

/**
 * The single most recent game played, per venue filter — the "last game"
 * period on the behavior page covers exactly this one game.
 */
export const LAST_GAMES: Record<"home" | "away" | "both", LastGameInfo> = (() => {
  const home = latestFinished(homeGames, "home");
  const away = latestFinished(awayGames, "away");
  return { home, away, both: home.date >= away.date ? home : away };
})();

export const awayKpis = {
  games: 8,
  gamesPlanned: 17,
  ticketBuyers: 2011,
  ticketBuyersDeltaPct: 11,
  attendees: 4460,
  arrivalPercent: 88.9,
  arrivalDeltaPct: 3.2,
  revenue: 201000,
  revenueDeltaPct: 14,
};

export const homeKpis = {
  games: 9,
  avgCrowd: 13200,
  subscriberUtilization: 91,
  ticketsSold: 26500,
  revenue: 1794000,
};

export const buyerSplit = [
  { key: "subscribers", value: 1180, color: "#1d4ed8" },
  { key: "nonSubscribers", value: 640, color: "#9ca3af" },
  { key: "vip", value: 191, color: "#7e22ce" },
] as const;

export interface TopFan {
  rank: number;
  fanId: string;
  name: string;
  games: number;
  tickets: number;
  appUsage: number;
  score: number;
}

export const topFans: TopFan[] = [
  { rank: 1, fanId: "1", name: "יוסי כהן", games: 8, tickets: 8, appUsage: 96, score: 92 },
  { rank: 2, fanId: "5", name: "דוד אזולאי", games: 7, tickets: 7, appUsage: 74, score: 88 },
  { rank: 3, fanId: "2", name: "מיכל לוי", games: 7, tickets: 6, appUsage: 88, score: 84 },
  { rank: 4, fanId: "8", name: "נועה שטרית", games: 6, tickets: 6, appUsage: 91, score: 81 },
  { rank: 5, fanId: "3", name: "אבי פרץ", games: 5, tickets: 5, appUsage: 42, score: 77 },
];

export const topHomeFans: TopFan[] = [
  { rank: 1, fanId: "1", name: "יוסי כהן", games: 9, tickets: 9, appUsage: 96, score: 92 },
  { rank: 2, fanId: "2", name: "מיכל לוי", games: 9, tickets: 8, appUsage: 88, score: 84 },
  { rank: 3, fanId: "8", name: "נועה שטרית", games: 8, tickets: 8, appUsage: 91, score: 81 },
  { rank: 4, fanId: "5", name: "דוד אזולאי", games: 8, tickets: 7, appUsage: 74, score: 88 },
  { rank: 5, fanId: "6", name: "רונית מלכה", games: 7, tickets: 7, appUsage: 52, score: 65 },
];

// ─────────────────────────────── Comparisons ─────────────────────────────────

export interface SeasonStats {
  season: string;
  subscribers: number;
  avgAttendance: number;
  tickets: number;
  revenue: number;
  homeGames: number;
  awayGames: number;
  occupancy: number;
  inProgress?: boolean;
}

export const seasonStats: SeasonStats[] = [
  { season: "2021/22", subscribers: 6100, avgAttendance: 9800, tickets: 61000, revenue: 4100000, homeGames: 17, awayGames: 17, occupancy: 61 },
  { season: "2022/23", subscribers: 6900, avgAttendance: 10900, tickets: 68000, revenue: 4700000, homeGames: 18, awayGames: 18, occupancy: 68 },
  { season: "2023/24", subscribers: 7800, avgAttendance: 12100, tickets: 74000, revenue: 5300000, homeGames: 18, awayGames: 18, occupancy: 75 },
  { season: "2024/25", subscribers: 9120, avgAttendance: 13400, tickets: 81000, revenue: 6100000, homeGames: 19, awayGames: 18, occupancy: 83 },
  { season: "2025/26", subscribers: 8234, avgAttendance: 13200, tickets: 26500, revenue: 1794000, homeGames: 9, awayGames: 8, occupancy: 82, inProgress: true },
];

export interface TeamStats {
  id: string;
  opponent: L10n;
  games: number;
  homeGames: number;
  awayGames: number;
  avgAttendance: number;
  tickets: number;
  revenue: number;
  wins: number;
  draws: number;
  losses: number;
}

// Last three seasons against each opponent
export const teamStats: TeamStats[] = [
  { id: "maccabiTA", opponent: teams.maccabiTA, games: 6, homeGames: 3, awayGames: 3, avgAttendance: 15100, tickets: 61000, revenue: 1650000, wins: 2, draws: 2, losses: 2 },
  { id: "beitar", opponent: teams.beitar, games: 6, homeGames: 3, awayGames: 3, avgAttendance: 14300, tickets: 55000, revenue: 1410000, wins: 3, draws: 1, losses: 2 },
  { id: "maccabiHaifa", opponent: teams.maccabiHaifa, games: 6, homeGames: 3, awayGames: 3, avgAttendance: 14800, tickets: 58000, revenue: 1520000, wins: 1, draws: 2, losses: 3 },
  { id: "hapoelTA", opponent: teams.hapoelTA, games: 5, homeGames: 2, awayGames: 3, avgAttendance: 12900, tickets: 41000, revenue: 1050000, wins: 2, draws: 2, losses: 1 },
  { id: "hapoelHaifa", opponent: teams.hapoelHaifa, games: 5, homeGames: 3, awayGames: 2, avgAttendance: 10200, tickets: 33000, revenue: 720000, wins: 3, draws: 1, losses: 1 },
  { id: "maccabiNetanya", opponent: teams.maccabiNetanya, games: 5, homeGames: 2, awayGames: 3, avgAttendance: 10900, tickets: 36000, revenue: 790000, wins: 2, draws: 2, losses: 1 },
  { id: "kiryatShmona", opponent: teams.kiryatShmona, games: 4, homeGames: 2, awayGames: 2, avgAttendance: 9800, tickets: 27000, revenue: 560000, wins: 3, draws: 0, losses: 1 },
  { id: "sakhnin", opponent: teams.sakhnin, games: 5, homeGames: 2, awayGames: 3, avgAttendance: 9500, tickets: 30000, revenue: 610000, wins: 2, draws: 1, losses: 2 },
  { id: "petahTikva", opponent: teams.petahTikva, games: 4, homeGames: 2, awayGames: 2, avgAttendance: 9900, tickets: 28000, revenue: 590000, wins: 2, draws: 1, losses: 1 },
];

export interface PotentialFan {
  fanId: string;
  name: string;
  lastGameOpponent: L10n;
  lastGameDate: string;
  previousAttendance: number;
  score: number;
  preferredChannel: ChannelCode;
}

export const potentialFans: PotentialFan[] = [
  { fanId: "6", name: "רונית מלכה", lastGameOpponent: teams.sakhnin, lastGameDate: "2026-07-12", previousAttendance: 5, score: 65, preferredChannel: "whatsapp" },
  { fanId: "9", name: "משה אוחיון", lastGameOpponent: teams.hapoelTA, lastGameDate: "2026-07-26", previousAttendance: 4, score: 71, preferredChannel: "sms" },
  { fanId: "4", name: "שרה ביטון", lastGameOpponent: teams.maccabiHaifa, lastGameDate: "2026-08-09", previousAttendance: 3, score: 58, preferredChannel: "email" },
  { fanId: "10", name: "תמר עמר", lastGameOpponent: teams.sakhnin, lastGameDate: "2026-07-12", previousAttendance: 2, score: 52, preferredChannel: "whatsapp" },
];

export const fanMatchHistory: {
  opponent: L10n;
  venue: "home" | "away";
  date: string;
  attended: boolean;
}[] = [
  { opponent: teams.maccabiTA, venue: "home", date: "2026-08-16", attended: true },
  { opponent: teams.maccabiHaifa, venue: "away", date: "2026-08-09", attended: true },
  { opponent: teams.beitar, venue: "home", date: "2026-08-02", attended: true },
  { opponent: teams.hapoelTA, venue: "away", date: "2026-07-26", attended: false },
  { opponent: teams.kiryatShmona, venue: "home", date: "2026-07-19", attended: true },
];

// ─────────────────────────────── Fan population ──────────────────────────────
// Deterministic synthetic population powering the behavior dashboard.
// Same seed → same data on every load (stable demo).

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const firstNames = ["יוסי", "מיכל", "אבי", "שרה", "דוד", "רונית", "אלי", "נועה", "משה", "תמר", "עומר", "יעל", "איתי", "שירה", "עידו", "הילה", "אורי", "מאיה", "נדב", "ליאור", "גיא", "דנה", "רועי", "אורטל"];
const lastNames = ["כהן", "לוי", "פרץ", "ביטון", "אזולאי", "מלכה", "דהן", "שטרית", "אוחיון", "עמר", "אברהם", "חדד", "גבאי", "בן דוד", "אלבז", "סבג", "אמסלם", "טל", "שרעבי", "מור"];

// Population weights: Be'er Sheva dominates, the region follows
const cityWeights: [string, number][] = [
  ["beersheba", 38], ["ofakim", 8], ["dimona", 8], ["netivot", 7],
  ["sderot", 6], ["arad", 5], ["yeroham", 4], ["meitar", 5], ["omer", 4],
  ["lehavim", 3], ["ashkelon", 4], ["ashdod", 3], ["kiryatgat", 3],
  ["rahat", 3], ["mitzpe", 2], ["eilat", 2],
];
const weightTotal = cityWeights.reduce((s, [, w]) => s + w, 0);

function pickCity(r: number): string {
  let acc = 0;
  const target = r * weightTotal;
  for (const [id, w] of cityWeights) {
    acc += w;
    if (target < acc) return id;
  }
  return "beersheba";
}

export type PeriodCode =
  | "season"
  | "prevSeason"
  | "last3Months"
  | "lastMonth"
  | "lastGame";

export interface PeriodAttendance {
  home: number;
  away: number;
}

export interface PopulationFan {
  id: string;
  name: string;
  age: number;
  cityId: string;
  subscriber: boolean;
  subscriptionType: SubTypeCode | null;
  score: number;
  /** games attended this season, out of HOME_GAMES_PLAYED / AWAY_GAMES_PLAYED */
  homeAttended: number;
  awayAttended: number;
  /** attendance in other windows; the short ones are always ≤ the season totals */
  periods: {
    prevSeason: PeriodAttendance; // full 2024/25 season
    last3Months: PeriodAttendance;
    lastMonth: PeriodAttendance;
    lastGame: PeriodAttendance; // 0/1 per venue type
  };
  appUser: boolean;
  appLastLogin: string | null;
  appLogins30d: number;
}

export const HOME_GAMES_PLAYED = 12;
export const AWAY_GAMES_PLAYED = 8;

/** Games played inside each period, per venue type. */
export const PERIOD_GAMES: Record<PeriodCode, PeriodAttendance> = {
  season: { home: HOME_GAMES_PLAYED, away: AWAY_GAMES_PLAYED },
  prevSeason: { home: 18, away: 18 },
  last3Months: { home: 6, away: 4 },
  lastMonth: { home: 2, away: 1 },
  lastGame: { home: 1, away: 1 },
};

function buildPopulation(count: number): PopulationFan[] {
  const rand = mulberry32(20260901);
  const result: PopulationFan[] = [];
  for (let i = 0; i < count; i++) {
    const score = Math.round(20 + rand() * 75);
    const subscriber = rand() < 0.25 + (score / 100) * 0.5;
    const subTypeRoll = rand();
    // Tiers: רגיל / כסף / VIP
    const subscriptionType: SubTypeCode | null = !subscriber
      ? null
      : subTypeRoll < 0.6
        ? "regular"
        : subTypeRoll < 0.85
          ? "silver"
          : "vip";
    const attendBias = subscriber ? 0.55 : 0.2;
    const homeAttended = Math.min(
      HOME_GAMES_PLAYED,
      Math.round(rand() * HOME_GAMES_PLAYED * (attendBias + score / 200)),
    );
    const awayAttended = Math.min(
      AWAY_GAMES_PLAYED,
      Math.round(rand() * AWAY_GAMES_PLAYED * (attendBias * 0.6 + score / 300)),
    );
    // Shorter windows are nested subsets of the season totals (monotone)
    const h3 = Math.min(
      PERIOD_GAMES.last3Months.home,
      homeAttended,
      Math.round(homeAttended * (0.35 + rand() * 0.3)),
    );
    const a3 = Math.min(
      PERIOD_GAMES.last3Months.away,
      awayAttended,
      Math.round(awayAttended * (0.3 + rand() * 0.3)),
    );
    const h1 = Math.min(
      PERIOD_GAMES.lastMonth.home,
      h3,
      Math.round(h3 * (0.25 + rand() * 0.35)),
    );
    const a1 = Math.min(PERIOD_GAMES.lastMonth.away, a3, rand() < a3 / 5 ? 1 : 0);
    const hLast = h1 > 0 && rand() < 0.6 ? 1 : 0;
    const aLast = a1 > 0 && rand() < 0.5 ? 1 : 0;
    // Previous season: most fans were already around; newcomers have no history
    const wasAroundLastSeason = rand() < 0.8;
    const prevHome = wasAroundLastSeason
      ? Math.min(
          PERIOD_GAMES.prevSeason.home,
          Math.round(rand() * PERIOD_GAMES.prevSeason.home * (attendBias + score / 200)),
        )
      : 0;
    const prevAway = wasAroundLastSeason
      ? Math.min(
          PERIOD_GAMES.prevSeason.away,
          Math.round(rand() * PERIOD_GAMES.prevSeason.away * (attendBias * 0.6 + score / 300)),
        )
      : 0;

    const appUser = rand() < 0.35 + score / 250;
    const daysSinceLogin = appUser ? Math.floor(rand() * 45) : 0;
    const lastLoginDate = new Date(2026, 7, 31);
    lastLoginDate.setDate(lastLoginDate.getDate() - daysSinceLogin);
    result.push({
      id: `p${i + 1}`,
      name: `${firstNames[Math.floor(rand() * firstNames.length)]} ${lastNames[Math.floor(rand() * lastNames.length)]}`,
      age: Math.round(16 + rand() * 55),
      cityId: pickCity(rand()),
      subscriber,
      subscriptionType,
      score,
      homeAttended,
      awayAttended,
      periods: {
        prevSeason: { home: prevHome, away: prevAway },
        last3Months: { home: h3, away: a3 },
        lastMonth: { home: h1, away: a1 },
        lastGame: { home: hLast, away: aLast },
      },
      appUser,
      appLastLogin: appUser ? lastLoginDate.toISOString().slice(0, 10) : null,
      appLogins30d: appUser ? Math.round(rand() * 30 * (score / 100)) : 0,
    });
  }
  return result;
}

export const fanPopulation: PopulationFan[] = buildPopulation(240);

// ─────────────────────────────── Store / merchandise ─────────────────────────

export interface Product {
  id: string;
  name: L10n;
  category: ProductCategory;
  price: number;
}

export const products: Product[] = [
  { id: "m1", name: { he: "חולצת בית 2025/26", en: "Home Jersey 2025/26" }, category: "jerseys", price: 299 },
  { id: "m2", name: { he: "חולצת חוץ 2025/26", en: "Away Jersey 2025/26" }, category: "jerseys", price: 299 },
  { id: "m3", name: { he: "צעיף אדום קלאסי", en: "Classic Red Scarf" }, category: "scarves", price: 79 },
  { id: "m4", name: { he: "צעיף דרבי מהדורה מוגבלת", en: "Limited Derby Scarf" }, category: "scarves", price: 99 },
  { id: "m5", name: { he: "כובע מצחייה", en: "Baseball Cap" }, category: "accessories", price: 89 },
  { id: "m6", name: { he: "קפוצ׳ון מועדון", en: "Club Hoodie" }, category: "jerseys", price: 249 },
  { id: "m7", name: { he: "דגל ענק ליציע", en: "Giant Stand Flag" }, category: "accessories", price: 129 },
  { id: "m8", name: { he: "ערכת ילדים", en: "Kids Kit" }, category: "kids", price: 199 },
  { id: "m9", name: { he: "כדור חתום", en: "Signed Ball" }, category: "other", price: 349 },
  { id: "m10", name: { he: "ספל קפה אדום", en: "Red Coffee Mug" }, category: "other", price: 45 },
];

export const productById: Record<string, Product> = Object.fromEntries(
  products.map((p) => [p.id, p]),
);

export interface Order {
  id: string;
  fanName: string;
  fanId: string | null; // links to a curated fan when relevant
  productId: string;
  qty: number;
  date: string; // ISO
}

function buildOrders(): Order[] {
  const rand = mulberry32(99120841);
  const orders: Order[] = [];
  let n = 0;
  // Population orders — heavier volume in jersey-launch months (Jul/Aug)
  const monthVolume: [number, number][] = [
    [3, 40], [4, 44], [5, 48], [6, 58], [7, 92], [8, 118],
  ];
  for (const [month, volume] of monthVolume) {
    for (let i = 0; i < volume; i++) {
      const fan = fanPopulation[Math.floor(rand() * fanPopulation.length)];
      // Higher-score fans skew to jerseys; others spread across the catalog
      const productPool =
        rand() < fan.score / 160
          ? products.filter((p) => p.category === "jerseys")
          : products;
      const product = productPool[Math.floor(rand() * productPool.length)];
      const day = 1 + Math.floor(rand() * 28);
      orders.push({
        id: `o${++n}`,
        fanName: fan.name,
        fanId: null,
        productId: product.id,
        qty: rand() < 0.15 ? 2 : 1,
        date: `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      });
    }
  }
  return orders;
}

export const orders: Order[] = buildOrders();

/** Hand-curated purchases for the profile pages of the 10 showcase fans. */
export const fanPurchases: Record<string, { productId: string; qty: number; date: string }[]> = {
  "1": [
    { productId: "m1", qty: 1, date: "2026-07-18" },
    { productId: "m4", qty: 1, date: "2026-08-05" },
    { productId: "m9", qty: 1, date: "2026-08-20" },
  ],
  "2": [
    { productId: "m1", qty: 1, date: "2026-07-22" },
    { productId: "m5", qty: 1, date: "2026-08-11" },
  ],
  "3": [{ productId: "m3", qty: 2, date: "2026-05-30" }],
  "5": [
    { productId: "m6", qty: 1, date: "2026-06-14" },
    { productId: "m8", qty: 1, date: "2026-08-01" },
  ],
  "8": [
    { productId: "m2", qty: 1, date: "2026-08-09" },
    { productId: "m10", qty: 1, date: "2026-08-09" },
  ],
  "9": [{ productId: "m3", qty: 1, date: "2026-04-12" }],
};
