import {
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUrl,
  Min,
} from 'class-validator';

export class CreateStudioCandidateDto {
  @IsOptional()
  @IsString()
  studioId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  externalUrl?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  sourceUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  hourlyPrice?: number;

  @IsOptional()
  @IsString()
  priceNote?: string;

  @IsOptional()
  @IsString()
  amenitiesNote?: string;

  @IsOptional()
  @IsString()
  note?: string;

}

export class VoteStudioCandidateDto {
  @IsString()
  candidateId: string;
}

export class SaveStudioLocationDto {
  @IsLatitude()
  latitude: number;

  @IsLongitude()
  longitude: number;

  @IsOptional()
  @IsString()
  label?: string;
}
