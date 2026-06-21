import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdateSettlementDto {
  @IsOptional()
  @IsString()
  selectedStudioId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  customTotalPrice?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  usageHours?: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  participantUserIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  paidUserIds?: string[];
}
