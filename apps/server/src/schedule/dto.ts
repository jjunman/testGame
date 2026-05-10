import { IsDateString, IsEnum, IsString } from 'class-validator';
import { ScheduleAvailabilityType } from '../common/enums';

export class CreateScheduleSlotDto {
  @IsDateString()
  date: string;

  @IsString()
  startTime: string;

  @IsString()
  endTime: string;
}

export class UpsertAvailabilityDto {
  @IsString()
  slotId: string;

  @IsEnum(ScheduleAvailabilityType)
  availability: ScheduleAvailabilityType;
}

export class CreateScheduleProposalDto {
  @IsDateString()
  date: string;

  @IsString()
  startTime: string;

  @IsString()
  endTime: string;
}

export class VoteScheduleProposalDto {
  @IsString()
  proposalId: string;

  @IsEnum(ScheduleAvailabilityType)
  availability: ScheduleAvailabilityType;
}
