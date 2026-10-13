import { Transform, Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

/** Columns the table can sort / filter / facet on (whitelist) */
export const FAN_COLUMNS = [
  "customerNumber",
  "name",
  "age",
  "city",
  "subType",
  "seat",
  "score",
  "status",
  "lastLogin",
  "lastActivity",
] as const;
export type FanColumn = (typeof FAN_COLUMNS)[number];

/** Excel-style value filters: { column: [valueKey, ...] } — sent as JSON */
export type FanFilters = Partial<Record<FanColumn, string[]>>;

function parseFilters(value: unknown): FanFilters | undefined {
  if (value === undefined || value === "") return undefined;
  const raw = typeof value === "string" ? (JSON.parse(value) as unknown) : value;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: FanFilters = {};
  for (const [key, vals] of Object.entries(raw as Record<string, unknown>)) {
    if (!(FAN_COLUMNS as readonly string[]).includes(key) || !Array.isArray(vals)) continue;
    out[key as FanColumn] = vals.slice(0, 200).map((v) => String(v));
  }
  return out;
}

export class QueryFansDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsIn(FAN_COLUMNS)
  sortKey?: FanColumn;

  @IsOptional()
  @IsIn(["asc", "desc"])
  sortDir?: "asc" | "desc";

  @IsOptional()
  @Transform(({ value }) => parseFilters(value))
  @IsObject()
  filters?: FanFilters;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 25;
}

export class FacetsQueryDto {
  @IsIn(FAN_COLUMNS)
  column!: FanColumn;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @Transform(({ value }) => parseFilters(value))
  @IsObject()
  filters?: FanFilters;
}
