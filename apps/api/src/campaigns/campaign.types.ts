import type { FanStatus } from "@prisma/client";

export const SEGMENTS = ["all", "subscribers", "nonSubscribers"] as const;
export type Segment = (typeof SEGMENTS)[number];

/**
 * Behaviour triggers — "who should get this": evaluated at run time, so a
 * monthly cron sends birthday wishes to whoever has a birthday that month.
 */
export const TRIGGERS = ["birthdayMonth", "missedGames", "inactiveDays"] as const;
export type Trigger = (typeof TRIGGERS)[number];
export const TRIGGER_DEFAULTS: Record<Trigger, number> = { birthdayMonth: 0, missedGames: 2, inactiveDays: 30 };

/** Serialized audience definition stored on Campaign.segmentQuery (profiling transparency). */
export interface SegmentQuery {
  segment: Segment;
  cities?: string[];
  /** current-season subscription types, e.g. ["VIP", "כסף"] */
  subTypes?: string[];
  minScore?: number;
  maxScore?: number;
  statuses?: FanStatus[];
  appUsersOnly?: boolean;
  trigger?: Trigger;
  /** games for missedGames, days for inactiveDays */
  triggerValue?: number;
}

/** Live counts shown in the campaign settings: the base audience and how many of it match each trigger. */
export interface AudienceInsights {
  total: number;
  birthdayMonth: number;
  missedGames: number;
  inactiveDays: number;
  values: { missedGames: number; inactiveDays: number; month: number };
}

export const DEFAULT_TIMEZONE = "Asia/Jerusalem";

/** Presets offered in the UI; anything else is a free cron expression. */
export const CRON_PRESETS = [
  { key: "dailyMorning", expression: "0 10 * * *" },
  { key: "weeklySunday", expression: "0 10 * * 0" },
  { key: "monthlyFirst", expression: "0 10 1 * *" },
  { key: "hourly", expression: "0 * * * *" },
  { key: "everyMinute", expression: "* * * * *" },
] as const;

export interface RunSummary {
  campaignId: string;
  trigger: "manual" | "schedule";
  dryRun: boolean;
  audience: number;
  sent: number;
  failed: number;
  suppressed: number;
  startedAt: string;
  finishedAt: string;
  /** set when the run did not happen (already running / disabled) */
  skipped?: "running" | "disabled";
}
