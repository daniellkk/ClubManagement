import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  registerDecorator,
  ValidateNested,
  type ValidationOptions,
} from "class-validator";
import { validateCronExpression } from "cron";
import { SEGMENTS, TRIGGERS } from "../campaign.types";

export const CAMPAIGN_CHANNELS = ["SMS", "WHATSAPP", "EMAIL"] as const;
export const CAMPAIGN_CATEGORIES = ["TRANSACTIONAL", "GOODWILL", "MARKETING"] as const;
export const SCHEDULE_TYPES = ["MANUAL", "ONCE", "CRON"] as const;
export const CAMPAIGN_STATUSES = ["DRAFT", "SCHEDULED", "SENDING", "SENT", "CANCELLED", "PAUSED"] as const;

/** Standard 5-field cron (minute hour day month weekday), validated by the `cron` package. */
export function IsCronExpression(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: "isCronExpression",
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate: (value: unknown) =>
          typeof value === "string" && value.trim().split(/\s+/).length === 5 && validateCronExpression(value).valid,
        defaultMessage: () => "cronExpression must be a valid 5-field cron expression",
      },
    });
}

export function IsTimezone(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: "isTimezone",
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate: (value: unknown) => {
          if (typeof value !== "string") return false;
          try {
            new Intl.DateTimeFormat("en", { timeZone: value });
            return true;
          } catch {
            return false;
          }
        },
        defaultMessage: () => "timezone must be an IANA time zone",
      },
    });
}

export class SegmentQueryDto {
  @IsIn(SEGMENTS)
  segment!: (typeof SEGMENTS)[number];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  cities?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  subTypes?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  minScore?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  maxScore?: number;

  @IsOptional()
  @IsArray()
  @IsIn(["ACTIVE", "INACTIVE", "ARCHIVED"], { each: true })
  statuses?: ("ACTIVE" | "INACTIVE" | "ARCHIVED")[];

  @IsOptional()
  @IsBoolean()
  appUsersOnly?: boolean;

  @IsOptional()
  @IsIn(TRIGGERS)
  trigger?: (typeof TRIGGERS)[number];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  triggerValue?: number;
}

/** Full campaign definition — used for create and for update (full replace). */
export class CampaignInputDto {
  @IsString()
  @Length(2, 80)
  name!: string;

  @IsIn(CAMPAIGN_CHANNELS)
  channel!: (typeof CAMPAIGN_CHANNELS)[number];

  @IsIn(CAMPAIGN_CATEGORIES)
  category!: (typeof CAMPAIGN_CATEGORIES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(150)
  subject?: string;

  @IsString()
  @Length(1, 1000)
  body!: string;

  /** InforU sender id: up to 11 latin letters/digits */
  @IsOptional()
  @Matches(/^[A-Za-z0-9]{2,11}$/, { message: "sender must be 2–11 latin letters or digits" })
  sender?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  templateId?: string;

  @ValidateNested()
  @Type(() => SegmentQueryDto)
  segment!: SegmentQueryDto;

  @IsIn(SCHEDULE_TYPES)
  scheduleType!: (typeof SCHEDULE_TYPES)[number];

  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;

  @IsOptional()
  @IsCronExpression()
  cronExpression?: string;

  @IsOptional()
  @IsTimezone()
  timezone?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class QueryCampaignsDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsIn(CAMPAIGN_STATUSES)
  status?: (typeof CAMPAIGN_STATUSES)[number];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 25;
}

export class EstimateDto {
  @IsIn(CAMPAIGN_CHANNELS)
  channel!: (typeof CAMPAIGN_CHANNELS)[number];

  @IsIn(CAMPAIGN_CATEGORIES)
  category!: (typeof CAMPAIGN_CATEGORIES)[number];

  @ValidateNested()
  @Type(() => SegmentQueryDto)
  segment!: SegmentQueryDto;
}

export class TestSendDto {
  @IsOptional()
  @Matches(/^[+0-9()\-\s]{7,20}$/, { message: "phone must be a phone number" })
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

export class SetEnabledDto {
  @IsBoolean()
  enabled!: boolean;
}

export class PagedQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 25;
}
