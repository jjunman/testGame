import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { PositionType } from '../common/enums';

export class CreateBandDto {
  @IsString({ message: '밴드 이름을 입력해 주세요.' })
  @Length(2, 50, { message: '밴드 이름은 2자 이상 50자 이하로 입력해 주세요.' })
  name: string;

  @IsOptional()
  @IsString({ message: '썸네일 주소 형식이 올바르지 않습니다.' })
  thumbnailUrl?: string;

  @IsEnum(PositionType, { message: '포지션을 선택해 주세요.' })
  positionType: PositionType;

  @IsOptional()
  @IsString({ message: '직접 입력 포지션은 글자로 입력해 주세요.' })
  customPosition?: string;
}

export class JoinBandDto {
  @IsString({ message: '초대코드를 입력해 주세요.' })
  inviteCode: string;

  @IsEnum(PositionType, { message: '포지션을 선택해 주세요.' })
  positionType: PositionType;

  @IsOptional()
  @IsString({ message: '직접 입력 포지션은 글자로 입력해 주세요.' })
  customPosition?: string;
}

export class TransferLeaderDto {
  @IsString({ message: '리더를 넘길 멤버를 선택해 주세요.' })
  targetUserId: string;
}
