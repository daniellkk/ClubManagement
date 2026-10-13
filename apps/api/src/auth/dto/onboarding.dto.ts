import {
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from "class-validator";
import { TEAM_SYMBOL_CODES } from "../team-symbols";

/** Inline logo: a base64 data URL of a small PNG / JPEG / WebP / SVG. */
export const LOGO_DATA_URL_RE =
  /^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/]+=*$/;
/** ≈ 500 KB of image data once base64-encoded */
export const LOGO_MAX_CHARS = 700_000;

export class OnboardingDto {
  @IsString()
  @Length(2, 80)
  ownerName!: string;

  @IsString()
  @Length(2, 80)
  clubName!: string;

  @IsIn(TEAM_SYMBOL_CODES, {
    message: "symbol must be one of the known team symbols",
  })
  symbol!: string;

  @Matches(/^#[0-9a-fA-F]{6}$/, { message: "primaryColor must be a hex color" })
  primaryColor!: string;

  /** Omitted = keep the current logo, null = remove it, string = replace it. */
  @IsOptional()
  @IsString()
  @MaxLength(LOGO_MAX_CHARS)
  @Matches(LOGO_DATA_URL_RE, {
    message: "logoDataUrl must be a PNG, JPEG, WebP or SVG data URL",
  })
  logoDataUrl?: string | null;
}
