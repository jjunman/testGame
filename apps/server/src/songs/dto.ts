import {
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { SongDifficulty, SongRoundStatus } from '../common/enums';

export class CreateSongCandidateDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  artist: string;

  @IsString()
  @IsNotEmpty()
  youtubeUrl: string;

  @IsOptional()
  @IsString()
  youtubeVideoId?: string;

  @IsOptional()
  @IsEnum(SongDifficulty)
  difficulty?: SongDifficulty;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  requiredInstruments: string[] = [];
}

export class UpdateSongRoundStatusDto {
  @IsEnum(SongRoundStatus)
  status: SongRoundStatus;
}

export class StartSongRoundDto {
  @IsDateString({}, { message: '투표 마감일을 올바르게 입력해 주세요.' })
  deadlineAt: string;
}

export class CreateSongVoteDto {
  @IsString()
  candidateId: string;
}
