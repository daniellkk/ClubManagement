import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { describe, expect, it } from "vitest";
import { OnboardingDto } from "./onboarding.dto";

const PNG_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const base = {
  ownerName: "דניאל",
  clubName: "הפועל באר שבע",
  symbol: "HFS",
  primaryColor: "#dc2626",
};

const errorsOf = (input: unknown) =>
  validateSync(plainToInstance(OnboardingDto, input)).map((e) => e.property);

describe("OnboardingDto", () => {
  it("accepts the wizard payload with and without a logo", () => {
    expect(errorsOf(base)).toEqual([]);
    expect(errorsOf({ ...base, logoDataUrl: PNG_1PX })).toEqual([]);
    expect(errorsOf({ ...base, logoDataUrl: null })).toEqual([]);
  });

  it("only allows known team symbols", () => {
    expect(errorsOf({ ...base, symbol: "XYZ" })).toEqual(["symbol"]);
    expect(errorsOf({ ...base, symbol: "" })).toEqual(["symbol"]);
  });

  it("rejects logos that are not image data URLs", () => {
    expect(errorsOf({ ...base, logoDataUrl: "https://example.com/logo.png" })).toEqual(["logoDataUrl"]);
    expect(errorsOf({ ...base, logoDataUrl: "data:text/html;base64,PHNjcmlwdD4=" })).toEqual(["logoDataUrl"]);
  });

  it("still validates the basics", () => {
    expect(errorsOf({ ...base, ownerName: "א", primaryColor: "red" }).sort()).toEqual(["ownerName", "primaryColor"]);
  });
});
