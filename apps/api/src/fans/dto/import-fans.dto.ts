import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export class ImportRowDto {
  @IsString()
  @MaxLength(64)
  customerNumber!: string;

  @IsOptional() @IsString() @MaxLength(120) firstName?: string;
  @IsOptional() @IsString() @MaxLength(120) lastName?: string;
  // Kept loose on purpose: legacy exports contain messy addresses we still want to keep
  @IsOptional() @IsString() @MaxLength(254) email?: string;
  @IsOptional() @IsString() @MaxLength(254) oldEmail?: string;
  @IsOptional() @IsString() @MaxLength(64) legacyId?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(120) city?: string;
  /** "15/03/1988", ISO or an Excel serial — parsed server-side */
  @IsOptional() @IsString() @MaxLength(32) birthDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(120)
  age?: number;

  @IsOptional() @IsString() @MaxLength(32) seatArea?: string;
  @IsOptional() @IsString() @MaxLength(32) seatRow?: string;
  @IsOptional() @IsString() @MaxLength(32) seatNumber?: string;
}

/** One chunk of an import — the client splits large files into chunks */
export class ImportFansDto {
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => ImportRowDto)
  rows!: ImportRowDto[];
}

export class ExistsDto {
  @IsArray()
  @ArrayMaxSize(1000)
  @IsString({ each: true })
  customerNumbers!: string[];
}
