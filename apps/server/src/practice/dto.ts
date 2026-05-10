import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreatePracticeAssignmentDto {
  @IsOptional()
  @IsString()
  songCandidateId?: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  startSec?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  endSec?: number;

  @IsDateString()
  dueAt: string;
}
