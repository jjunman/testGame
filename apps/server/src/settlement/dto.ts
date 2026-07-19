import {
  ArrayUnique,
  IsArray,
  IsIn,
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
  @IsIn(['studio', 'manual'])
  priceMode?: 'studio' | 'manual';

  @IsOptional()
  @IsInt()
  @Min(0)
  manualHourlyPrice?: number | null;

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

export class CompleteSettlementDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  customTotalPrice?: number | null;

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

export class MarkOutstandingPaidDto {
  @IsInt()
  @Min(1)
  amount: number;
}

export class CreateSettlementRoundDto {
  @IsInt()
  @Min(1)
  totalAmount: number;

  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  participantUserIds: string[];

  @IsIn([1, 3, 7])
  deadlineDays: 1 | 3 | 7;

  @IsOptional()
  @IsIn([30])
  deadlineSeconds?: 30;
}

export class UpdateSettlementRoundDto {
  @IsInt()
  @Min(1)
  totalAmount: number;

  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  participantUserIds: string[];

  @IsInt()
  @Min(1)
  version: number;
}

export class UpdateSettlementPaymentDto {
  @IsIn([true, false])
  paid: boolean;

  @IsInt()
  @Min(1)
  version: number;
}
