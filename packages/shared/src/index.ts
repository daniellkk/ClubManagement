// Shared enums & types — mirrored by the Prisma schema in apps/api.

export enum AdminRole {
  OWNER = "OWNER",
  ADMIN = "ADMIN",
  STAFF = "STAFF",
  VIEWER = "VIEWER",
}

export enum FanStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  ARCHIVED = "ARCHIVED",
}

export enum SubscriptionStatus {
  ACTIVE = "ACTIVE",
  PENDING = "PENDING",
  EXPIRED = "EXPIRED",
  CANCELLED = "CANCELLED",
}

export enum PaymentStatus {
  PAID = "PAID",
  PENDING = "PENDING",
  OVERDUE = "OVERDUE",
  REFUNDED = "REFUNDED",
}

export enum Venue {
  HOME = "HOME",
  AWAY = "AWAY",
}

export enum Competition {
  LEAGUE = "LEAGUE",
  CUP = "CUP",
  EUROPE = "EUROPE",
  FRIENDLY = "FRIENDLY",
  OTHER = "OTHER",
}

export enum GameStatus {
  SCHEDULED = "SCHEDULED",
  PLAYED = "PLAYED",
  POSTPONED = "POSTPONED",
  CANCELLED = "CANCELLED",
}

export enum TicketBuyerType {
  SUBSCRIBER = "SUBSCRIBER",
  NON_SUBSCRIBER = "NON_SUBSCRIBER",
  VIP = "VIP",
}

export enum Channel {
  EMAIL = "EMAIL",
  SMS = "SMS",
  WHATSAPP = "WHATSAPP",
  PUSH = "PUSH",
}

/**
 * Message categories drive compliance behavior (Israel PPL + Spam Law §30A):
 * - TRANSACTIONAL: service messages (receipts, ticket confirmations) — always allowed.
 * - GOODWILL: non-promotional relationship messages (birthday greeting, "we missed you"
 *   with no offer). Direct-mailing disclosure rules apply (source + removal option).
 * - MARKETING: any promotional content — requires prior opt-in for the channel and
 *   must honor unsubscribe immediately.
 */
export enum MessageCategory {
  TRANSACTIONAL = "TRANSACTIONAL",
  GOODWILL = "GOODWILL",
  MARKETING = "MARKETING",
}

export enum CampaignStatus {
  DRAFT = "DRAFT",
  SCHEDULED = "SCHEDULED",
  SENDING = "SENDING",
  SENT = "SENT",
  CANCELLED = "CANCELLED",
}

export enum MessageStatus {
  QUEUED = "QUEUED",
  SENT = "SENT",
  FAILED = "FAILED",
  /** Blocked before send — missing opt-in, unsubscribed, or suppressed fan. */
  SUPPRESSED = "SUPPRESSED",
}

export enum ConsentAction {
  OPT_IN = "OPT_IN",
  OPT_OUT = "OPT_OUT",
}

export enum ConsentSource {
  IMPORT = "IMPORT",
  ADMIN_UI = "ADMIN_UI",
  FAN_REQUEST = "FAN_REQUEST",
  SYSTEM = "SYSTEM",
}

export enum ImportStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

/** Engagement score tiers → UI badge colors (green/amber/red). */
export type ScoreTier = "high" | "medium" | "low";

export function scoreTier(score: number): ScoreTier {
  if (score >= 80) return "high";
  if (score >= 60) return "medium";
  return "low";
}
