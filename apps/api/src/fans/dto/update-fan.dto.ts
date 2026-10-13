import { FanStatus } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export class UpdateFanDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(120)
  age?: number;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(FanStatus)
  status?: FanStatus;

  // Consent flags — changes are recorded in the ConsentLog automatically
  @IsOptional()
  @IsBoolean()
  emailOptIn?: boolean;

  @IsOptional()
  @IsBoolean()
  smsOptIn?: boolean;

  @IsOptional()
  @IsBoolean()
  whatsappOptIn?: boolean;

  @IsOptional()
  @IsBoolean()
  pushOptIn?: boolean;
}
