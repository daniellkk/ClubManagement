import "reflect-metadata"; // @Type() needs the metadata polyfill Nest normally loads
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { describe, expect, it } from "vitest";
import { CampaignInputDto } from "./campaign.dto";

const base = {
  name: "חידוש מנויים",
  channel: "SMS",
  category: "MARKETING",
  body: "שלום {{firstName}}",
  segment: { segment: "subscribers", cities: ["באר שבע"] },
  scheduleType: "CRON",
  cronExpression: "0 10 * * 0",
  timezone: "Asia/Jerusalem",
};

const errorsOf = (input: unknown) => validateSync(plainToInstance(CampaignInputDto, input)).map((e) => e.property);

describe("CampaignInputDto", () => {
  it("accepts a valid recurring campaign", () => {
    expect(errorsOf(base)).toEqual([]);
  });

  it("rejects cron expressions the scheduler cannot run", () => {
    expect(errorsOf({ ...base, cronExpression: "every day" })).toEqual(["cronExpression"]);
    expect(errorsOf({ ...base, cronExpression: "* * * * * *" })).toEqual(["cronExpression"]);
  });

  it("validates the time zone, the sender id and the nested audience", () => {
    expect(errorsOf({ ...base, timezone: "Mars/Olympus" })).toEqual(["timezone"]);
    expect(errorsOf({ ...base, sender: "הפועל" })).toEqual(["sender"]);
    expect(errorsOf({ ...base, segment: { segment: "everyone" } })).toEqual(["segment"]);
  });
});
