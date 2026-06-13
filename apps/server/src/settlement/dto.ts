import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
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
  @IsNumber()
  @Min(0.5)
  expectedHours?: number;

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
