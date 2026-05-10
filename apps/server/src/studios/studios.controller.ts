import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateStudioCandidateDto, SaveStudioLocationDto, VoteStudioCandidateDto } from './dto';
import { StudiosService } from './studios.service';

@UseGuards(JwtAuthGuard)
@Controller('bands/:bandId')
export class StudiosController {
  constructor(private readonly studiosService: StudiosService) {}

  @Get('studio-candidates')
  listCandidates(
    @CurrentUser() user: { userId: string },
    @Param('bandId') bandId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '합주실 후보를 불러왔습니다.';
    return this.studiosService.listCandidates(user.userId, bandId);
  }

  @Get('studios')
  listStudios(
    @CurrentUser() user: { userId: string },
    @Param('bandId') bandId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '안산 합주실 목록을 불러왔습니다.';
    return this.studiosService.listStudios(user.userId, bandId);
  }

  @Get('studio-location')
  getLocation(
    @CurrentUser() user: { userId: string },
    @Param('bandId') bandId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '내 집 위치를 불러왔습니다.';
    return this.studiosService.getLocation(user.userId, bandId);
  }

  @Post('studio-location')
  saveLocation(
    @CurrentUser() user: { userId: string },
    @Param('bandId') bandId: string,
    @Body() dto: SaveStudioLocationDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '내 집 위치를 저장했습니다.';
    return this.studiosService.saveLocation(user.userId, bandId, dto);
  }

  @Post('studio-candidates')
  createCandidate(
    @CurrentUser() user: { userId: string },
    @Param('bandId') bandId: string,
    @Body() dto: CreateStudioCandidateDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '합주실 후보를 추가했습니다.';
    return this.studiosService.createCandidate(user.userId, bandId, dto);
  }

  @Post('studio-votes')
  vote(
    @CurrentUser() user: { userId: string },
    @Param('bandId') bandId: string,
    @Body() dto: VoteStudioCandidateDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '합주실 투표를 저장했습니다.';
    return this.studiosService.vote(user.userId, bandId, dto.candidateId);
  }

  @Post('studio-candidates/finalize')
  finalize(
    @CurrentUser() user: { userId: string },
    @Param('bandId') bandId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '합주실을 확정했습니다.';
    return this.studiosService.finalize(user.userId, bandId);
  }

  @Post('studios/import-ansan')
  importAnsan(
    @CurrentUser() user: { userId: string },
    @Param('bandId') bandId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '안산 합주실 정보를 가져왔습니다.';
    return this.studiosService.importAnsan(user.userId, bandId);
  }
}
