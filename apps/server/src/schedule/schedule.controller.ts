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
import {
  CreateScheduleProposalDto,
  CreateScheduleSlotDto,
  UpsertAvailabilityDto,
  VoteScheduleProposalDto,
} from './dto';
import { ScheduleService } from './schedule.service';

@UseGuards(JwtAuthGuard)
@Controller('bands/:bandId')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Get('schedule-slots')
  slots(
    @CurrentUser() user: { userId: string },
    @Param('bandId') bandId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '일정 후보 목록을 불러왔습니다.';
    return this.scheduleService.getSlots(user.userId, bandId);
  }

  @Post('schedule-slots')
  createSlot(
    @CurrentUser() user: { userId: string },
    @Param('bandId') bandId: string,
    @Body() dto: CreateScheduleSlotDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '일정 후보를 만들었습니다.';
    return this.scheduleService.createSlot(user.userId, bandId, dto);
  }

  @Post('schedule-availabilities')
  saveAvailability(
    @CurrentUser() user: { userId: string },
    @Param('bandId') bandId: string,
    @Body() dto: UpsertAvailabilityDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '가능 여부를 저장했습니다.';
    return this.scheduleService.upsertAvailability(user.userId, bandId, dto);
  }

  @Get('schedule-summary')
  summary(
    @CurrentUser() user: { userId: string },
    @Param('bandId') bandId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '일정 요약을 불러왔습니다.';
    return this.scheduleService.getSummary(user.userId, bandId);
  }

  @Get('schedule-proposal')
  proposal(
    @CurrentUser() user: { userId: string },
    @Param('bandId') bandId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '합주 시간 제안 상태를 불러왔습니다.';
    return this.scheduleService.getProposal(user.userId, bandId);
  }

  @Post('schedule-proposal')
  createProposal(
    @CurrentUser() user: { userId: string },
    @Param('bandId') bandId: string,
    @Body() dto: CreateScheduleProposalDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '합주 시간 제안을 시작했습니다.';
    return this.scheduleService.createProposal(user.userId, bandId, dto);
  }

  @Post('schedule-proposal-vote')
  voteProposal(
    @CurrentUser() user: { userId: string },
    @Param('bandId') bandId: string,
    @Body() dto: VoteScheduleProposalDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '찬반 응답을 저장했습니다.';
    return this.scheduleService.voteProposal(user.userId, bandId, dto);
  }

  @Post('schedule-proposal/finalize')
  finalizeProposal(
    @CurrentUser() user: { userId: string },
    @Param('bandId') bandId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '찬반투표를 종료했습니다.';
    return this.scheduleService.finalizeProposal(user.userId, bandId);
  }
}
