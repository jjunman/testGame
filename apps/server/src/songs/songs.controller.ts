import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  CreateSongCandidateDto,
  CreateSongVoteDto,
  StartSongRoundDto,
  UpdateSongCandidateDto,
  UpdateSongRoundStatusDto,
} from './dto';
import { SongsService } from './songs.service';

@UseGuards(JwtAuthGuard)
@Controller('bands/:bandId')
export class SongsController {
  constructor(private readonly songsService: SongsService) {}

  @Get('song-round')
  getRound(
    @CurrentUser() user: { userId: string },
    @Param('bandId') bandId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '현재 합주곡 정하기 라운드를 불러왔습니다.';
    return this.songsService.getCurrentRound(user.userId, bandId);
  }

  @Post('song-candidates')
  addCandidate(
    @CurrentUser() user: { userId: string },
    @Param('bandId') bandId: string,
    @Body() dto: CreateSongCandidateDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '후보곡을 추가했습니다.';
    return this.songsService.addCandidate(user.userId, bandId, dto);
  }

  @Delete('song-candidates/:candidateId')
  deleteCandidate(
    @CurrentUser() user: { userId: string },
    @Param('bandId') bandId: string,
    @Param('candidateId') candidateId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '노래를 삭제했습니다.';
    return this.songsService.deleteCandidate(user.userId, bandId, candidateId);
  }

  @Patch('song-candidates/:candidateId')
  updateCandidate(
    @CurrentUser() user: { userId: string },
    @Param('bandId') bandId: string,
    @Param('candidateId') candidateId: string,
    @Body() dto: UpdateSongCandidateDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '노래 정보를 수정했습니다.';
    return this.songsService.updateCandidate(user.userId, bandId, candidateId, dto);
  }

  @Post('song-round/start')
  startRound(
    @CurrentUser() user: { userId: string },
    @Param('bandId') bandId: string,
    @Body() dto: StartSongRoundDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '합주곡 투표를 시작했습니다.';
    return this.songsService.startRound(user.userId, bandId, dto.deadlineAt);
  }

  @Patch('song-round/status')
  updateStatus(
    @CurrentUser() user: { userId: string },
    @Param('bandId') bandId: string,
    @Body() dto: UpdateSongRoundStatusDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '합주곡 정하기 상태를 변경했습니다.';
    return this.songsService.updateRoundStatus(user.userId, bandId, dto);
  }

  @Delete('song-round')
  deleteRound(
    @CurrentUser() user: { userId: string },
    @Param('bandId') bandId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '진행 중인 곡 투표를 삭제했습니다.';
    return this.songsService.deleteActiveRound(user.userId, bandId);
  }

  @Post('song-round/finalize')
  finalize(
    @CurrentUser() user: { userId: string },
    @Param('bandId') bandId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '곡을 최종 확정했습니다.';
    return this.songsService.finalize(user.userId, bandId);
  }

  @Post('song-round')
  createNextRound(
    @CurrentUser() user: { userId: string },
    @Param('bandId') bandId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '새 합주곡 정하기 라운드를 만들었습니다.';
    return this.songsService.createNextRound(user.userId, bandId);
  }

  @Post('song-votes')
  vote(
    @CurrentUser() user: { userId: string },
    @Param('bandId') bandId: string,
    @Body() dto: CreateSongVoteDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '투표를 등록했습니다.';
    return this.songsService.vote(user.userId, bandId, dto.candidateId);
  }

  @Delete('song-votes/:candidateId')
  unvote(
    @CurrentUser() user: { userId: string },
    @Param('bandId') bandId: string,
    @Param('candidateId') candidateId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '투표를 취소했습니다.';
    return this.songsService.unvote(user.userId, bandId, candidateId);
  }
}
