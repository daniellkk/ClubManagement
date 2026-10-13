import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ensureOptOut,
  InforuService,
  normalizeIsraeliPhone,
  renderTemplate,
  smsSegments,
} from "./inforu.service";

const ENV = ["INFORU_USERNAME", "INFORU_API_TOKEN", "INFORU_DRY_RUN", "INFORU_SENDER", "INFORU_OPT_OUT_TEXT"];

describe("phone / template helpers", () => {
  it("normalises Israeli numbers to E.164 and rejects everything else", () => {
    expect(normalizeIsraeliPhone("050-123 4567")).toBe("+972501234567");
    expect(normalizeIsraeliPhone("+972 50 1234567")).toBe("+972501234567");
    expect(normalizeIsraeliPhone("972501234567")).toBe("+972501234567");
    expect(normalizeIsraeliPhone("08-6412345")).toBe("+97286412345");
    expect(normalizeIsraeliPhone("12345")).toBeNull();
    expect(normalizeIsraeliPhone("")).toBeNull();
    expect(normalizeIsraeliPhone(null)).toBeNull();
  });

  it("renders {{placeholders}} and blanks unknown ones", () => {
    expect(renderTemplate("שלום {{firstName}} {{ lastName }}, {{nope}}!", { firstName: "דני", lastName: "כהן" })).toBe(
      "שלום דני כהן, !",
    );
  });

  it("counts SMS parts: Hebrew is UCS-2 (70 / 67), latin is GSM-7 (160 / 153)", () => {
    expect(smsSegments("")).toBe(0);
    expect(smsSegments("א".repeat(70))).toBe(1);
    expect(smsSegments("א".repeat(71))).toBe(2);
    expect(smsSegments("a".repeat(160))).toBe(1);
    expect(smsSegments("a".repeat(161))).toBe(2);
  });

  it("appends the opt-out line unless the text already has one", () => {
    expect(ensureOptOut("מבצע!", "להסרה השיבו הסר")).toBe("מבצע!\nלהסרה השיבו הסר");
    expect(ensureOptOut("מבצע! להסרה השיבו הסר", "x")).toBe("מבצע! להסרה השיבו הסר");
  });
});

describe("InforuService", () => {
  beforeEach(() => {
    for (const k of ENV) delete process.env[k];
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stays in dry-run without credentials, and even with them until INFORU_DRY_RUN=false", () => {
    expect(new InforuService().dryRun()).toBe(true);
    process.env.INFORU_USERNAME = "user";
    process.env.INFORU_API_TOKEN = "tok";
    expect(new InforuService().dryRun()).toBe(true);
    process.env.INFORU_DRY_RUN = "false";
    expect(new InforuService().dryRun()).toBe(false);
  });

  it("simulates sends in dry-run without touching the network", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await new InforuService().sendSms({ message: "hi", recipients: [{ phone: "+972501234567" }] });
    expect(res).toMatchObject({ ok: true, dryRun: true, accepted: 1 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts one batched SendSms with Basic auth when live", async () => {
    process.env.INFORU_USERNAME = "user";
    process.env.INFORU_API_TOKEN = "tok";
    process.env.INFORU_DRY_RUN = "false";
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ StatusId: 1, StatusDescription: "Success" }), { status: 200 }));
    const res = await new InforuService().sendSms({
      message: "שלום",
      recipients: [{ phone: "+972501234567", firstName: "דני" }, { phone: "+972521111111" }],
      sender: "Hapoel",
      batchId: "b1",
    });
    expect(res).toMatchObject({ ok: true, dryRun: false, accepted: 2, batchId: "b1" });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://capi.inforu.co.il/api/v2/SMS/SendSms");
    expect((init.headers as Record<string, string>).Authorization).toBe(`Basic ${Buffer.from("user:tok").toString("base64")}`);
    const body = JSON.parse(String(init.body)) as { Data: { Message: string; Recipients: unknown[]; Settings: Record<string, string> } };
    expect(body.Data.Message).toBe("שלום");
    expect(body.Data.Recipients).toEqual([{ Phone: "+972501234567", FirstName: "דני" }, { Phone: "+972521111111" }]);
    expect(body.Data.Settings).toMatchObject({ Sender: "Hapoel", CustomerMessageID: "b1" });
  });

  it("reports a rejected batch as failed instead of throwing", async () => {
    process.env.INFORU_USERNAME = "user";
    process.env.INFORU_API_TOKEN = "tok";
    process.env.INFORU_DRY_RUN = "false";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ StatusId: -1, StatusDescription: "Invalid credentials" }), { status: 200 }),
    );
    const res = await new InforuService().sendSms({ message: "x", recipients: [{ phone: "+972501234567" }] });
    expect(res).toMatchObject({ ok: false, accepted: 0, description: "Invalid credentials" });
  });
});
