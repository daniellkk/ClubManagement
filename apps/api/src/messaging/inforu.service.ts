import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";

/**
 * InforU messaging gateway (SMS / WhatsApp / Umail) — REST API v2.
 * Modelled on the Eventim ticketing integration, adapted for club campaigns:
 *  - credentials come from env (never hard-coded), Basic auth "username:token"
 *  - multi-recipient batches instead of one call per ticket
 *  - a dry-run mode that simulates sends until INFORU_DRY_RUN=false is set
 *
 * Env: INFORU_USERNAME, INFORU_API_TOKEN, INFORU_SENDER, INFORU_DRY_RUN (default true),
 *      INFORU_OPT_OUT_TEXT, INFORU_EMAIL_FROM, INFORU_EMAIL_FROM_NAME
 */

export type InforuChannel = "SMS" | "WHATSAPP" | "EMAIL";

export interface InforuRecipient {
  /** E.164 phone (see normalizeIsraeliPhone) for SMS / WhatsApp */
  phone?: string | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

export interface InforuResult {
  ok: boolean;
  dryRun: boolean;
  /** Our id for the batch — sent as CustomerMessageID so delivery reports can be matched */
  batchId: string;
  accepted: number;
  status: string;
  description: string;
}

interface InforuResponse {
  StatusId?: number;
  StatusDescription?: string;
  Data?: unknown;
}

export const INFORU_API_BASE = "https://capi.inforu.co.il/api/v2";
const TIMEOUT_MS = 20_000;
/** Recipients per SendSms request */
export const SMS_BATCH_SIZE = 100;
export const DEFAULT_OPT_OUT_TEXT = "להסרה השיבו הסר";

/** "050-123 4567" / "972501234567" / "+972 50 1234567" → "+972501234567"; null when not an Israeli number. */
export function normalizeIsraeliPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("972")) digits = digits.slice(3);
  else if (digits.startsWith("0")) digits = digits.slice(1);
  // mobile 5X-XXXXXXX, landline 2/3/4/8/9-XXXXXXX
  if (!/^(5\d{8}|[2-489]\d{7})$/.test(digits)) return null;
  return `+972${digits}`;
}

/** `{{firstName}}`-style placeholders; unknown keys render empty. */
export function renderTemplate(
  body: string,
  vars: Record<string, string | number | null | undefined>,
): string {
  return body.replace(/{{\s*(\w+)\s*}}/g, (_, key: string) => String(vars[key] ?? "").trim());
}

export function hasPlaceholders(body: string): boolean {
  return /{{\s*\w+\s*}}/.test(body);
}

/** Hebrew forces UCS-2: 70 chars per single SMS, 67 per part when concatenated (GSM-7: 160 / 153). */
export function smsSegments(text: string): number {
  const len = [...text].length;
  if (len === 0) return 0;
  const ucs2 = /[^\x00-\x7f]/.test(text);
  const single = ucs2 ? 70 : 160;
  const multi = ucs2 ? 67 : 153;
  return len <= single ? 1 : Math.ceil(len / multi);
}

/** Israeli spam law §30A: direct mailing must carry a removal option. */
export function ensureOptOut(body: string, optOutText: string): string {
  return /הסר|unsubscribe|\bstop\b/i.test(body) ? body : `${body}\n${optOutText}`;
}

export interface SendSmsInput {
  message: string;
  recipients: InforuRecipient[];
  sender?: string;
  batchId?: string;
}

export interface SendWhatsAppInput {
  templateId: string;
  /** Template placeholders, e.g. { name: "[#1#]", value: "…" } */
  parameters?: { name: string; value: string }[];
  recipients: InforuRecipient[];
  batchId?: string;
}

export interface SendEmailInput {
  subject: string;
  html: string;
  recipients: InforuRecipient[];
  campaignName?: string;
  batchId?: string;
}

@Injectable()
export class InforuService {
  private readonly logger = new Logger(InforuService.name);

  configured(): boolean {
    return Boolean(this.username() && this.token());
  }

  /** Real sends happen only with credentials AND an explicit INFORU_DRY_RUN=false. */
  dryRun(): boolean {
    if (!this.configured()) return true;
    return (process.env.INFORU_DRY_RUN ?? "true").trim().toLowerCase() !== "false";
  }

  defaultSender(): string {
    return process.env.INFORU_SENDER?.trim() || "HapoelBS";
  }

  optOutText(): string {
    return process.env.INFORU_OPT_OUT_TEXT?.trim() || DEFAULT_OPT_OUT_TEXT;
  }

  status() {
    return {
      configured: this.configured(),
      dryRun: this.dryRun(),
      sender: this.defaultSender(),
      optOutText: this.optOutText(),
    };
  }

  sendSms(input: SendSmsInput): Promise<InforuResult> {
    const batchId = input.batchId ?? randomUUID();
    const recipients = input.recipients
      .filter((r) => r.phone)
      .map((r) => ({
        Phone: r.phone,
        ...(r.firstName ? { FirstName: r.firstName } : {}),
        ...(r.lastName ? { LastName: r.lastName } : {}),
      }));
    return this.post(
      "/SMS/SendSms",
      {
        Message: input.message,
        Recipients: recipients,
        Settings: {
          Sender: input.sender?.trim() || this.defaultSender(),
          CustomerMessageID: batchId,
          CustomerParameter: batchId,
        },
      },
      recipients.length,
      batchId,
    );
  }

  sendWhatsApp(input: SendWhatsAppInput): Promise<InforuResult> {
    const batchId = input.batchId ?? randomUUID();
    const recipients = input.recipients
      .filter((r) => r.phone)
      .map((r) => ({
        Phone: r.phone,
        FirstName: r.firstName ?? "",
        LastName: r.lastName ?? "",
      }));
    return this.post(
      "/WhatsApp/SendWhatsApp",
      {
        TemplateId: input.templateId,
        TemplateParameters: (input.parameters ?? []).map((p) => ({
          Name: p.name,
          Type: "Custom",
          Value: p.value,
        })),
        Recipients: recipients,
        Settings: { CustomerMessageID: batchId, CustomerParameter: batchId },
      },
      recipients.length,
      batchId,
    );
  }

  sendEmail(input: SendEmailInput): Promise<InforuResult> {
    const batchId = input.batchId ?? randomUUID();
    const contacts = input.recipients
      .filter((r) => r.email)
      .map((r) => ({
        Email: r.email,
        FirstName: r.firstName ?? "",
        LastName: r.lastName ?? "",
      }));
    const from = process.env.INFORU_EMAIL_FROM?.trim() || "";
    return this.post(
      "/Umail/Message/Send",
      {
        CampaignName: input.campaignName ?? input.subject,
        FromAddress: from,
        ReplyAddress: process.env.INFORU_EMAIL_REPLY_TO?.trim() || from,
        FromName: process.env.INFORU_EMAIL_FROM_NAME?.trim() || this.defaultSender(),
        Subject: input.subject,
        Body: input.html,
        IncludeContacts: contacts,
      },
      contacts.length,
      batchId,
    );
  }

  /** Delivery reports queued by InforU (SMS or WhatsApp), oldest first. */
  async pullDeliveryNotifications(
    type: "DeliveryNotificationSms" | "DeliveryNotificationWhatsapp" = "DeliveryNotificationSms",
    batchSize = 500,
  ): Promise<unknown[]> {
    if (this.dryRun()) return [];
    const res = await this.request("/PullData", { Type: type, BatchSize: batchSize });
    const list = (res.body.Data as { List?: unknown[] } | undefined)?.List;
    return Array.isArray(list) ? list : [];
  }

  // ── transport ──────────────────────────────────────────────────────────────

  private username(): string | undefined {
    return process.env.INFORU_USERNAME?.trim() || undefined;
  }

  private token(): string | undefined {
    return process.env.INFORU_API_TOKEN?.trim() || undefined;
  }

  private headers(): Record<string, string> {
    const basic = Buffer.from(`${this.username()}:${this.token()}`).toString("base64");
    return {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Basic ${basic}`,
    };
  }

  private async request(
    path: string,
    data: unknown,
  ): Promise<{ ok: boolean; httpStatus: number; body: InforuResponse }> {
    const res = await fetch(`${INFORU_API_BASE}${path}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ Data: data }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = (await res.json().catch(() => ({}))) as InforuResponse;
    const ok = res.ok && (body.StatusId === 1 || body.StatusDescription === "Success");
    return { ok, httpStatus: res.status, body };
  }

  private async post(path: string, data: unknown, count: number, batchId: string): Promise<InforuResult> {
    if (count === 0) {
      return { ok: true, dryRun: this.dryRun(), batchId, accepted: 0, status: "empty", description: "no recipients" };
    }
    if (this.dryRun()) {
      // Counts only — never log addresses or message bodies
      this.logger.log(`[dry-run] ${path} → ${count} recipient(s), batch ${batchId}`);
      return { ok: true, dryRun: true, batchId, accepted: count, status: "DryRun", description: "Simulated (INFORU_DRY_RUN)" };
    }
    try {
      const { ok, httpStatus, body } = await this.request(path, data);
      if (!ok) this.logger.warn(`InforU ${path} rejected batch ${batchId}: HTTP ${httpStatus} ${body.StatusDescription ?? ""}`);
      return {
        ok,
        dryRun: false,
        batchId,
        accepted: ok ? count : 0,
        status: String(body.StatusId ?? httpStatus),
        description: body.StatusDescription ?? `HTTP ${httpStatus}`,
      };
    } catch (e) {
      const message = (e as Error).message;
      this.logger.error(`InforU ${path} error on batch ${batchId}: ${message}`);
      return { ok: false, dryRun: false, batchId, accepted: 0, status: "error", description: message };
    }
  }
}
