import { Body, Controller, Get, Param, Patch, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateSettlementRoundDto, UpdateSettlementPaymentDto, UpdateSettlementRoundDto } from './dto';
import { SettlementRoundService } from './settlement-round.service';

@UseGuards(JwtAuthGuard)
@Controller('bands/:bandId/settlement')
export class SettlementRoundController {
  constructor(private readonly settlements: SettlementRoundService) {}

  @Get()
  getOverview(@CurrentUser() user: { userId: string }, @Param('bandId') bandId: string) {
    return this.settlements.getOverview(user.userId, bandId);
  }

  @Get('history')
  getHistory(@CurrentUser() user: { userId: string }, @Param('bandId') bandId: string) {
    return this.settlements.getHistory(user.userId, bandId);
  }

  @Get(':settlementId')
  getOne(
    @CurrentUser() user: { userId: string },
    @Param('bandId') bandId: string,
    @Param('settlementId') settlementId: string,
  ) {
    return this.settlements.getOne(user.userId, bandId, settlementId);
  }

  @Post()
  create(
    @CurrentUser() user: { userId: string },
    @Param('bandId') bandId: string,
    @Body() dto: CreateSettlementRoundDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '정산을 요청했어요.';
    return this.settlements.create(user.userId, bandId, dto);
  }

  @Patch(':settlementId')
  update(
    @CurrentUser() user: { userId: string },
    @Param('bandId') bandId: string,
    @Param('settlementId') settlementId: string,
    @Body() dto: UpdateSettlementRoundDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '정산을 수정했어요. 입금 상태가 초기화됐습니다.';
    return this.settlements.update(user.userId, bandId, settlementId, dto);
  }

  @Patch(':settlementId/participants/:memberUserId/payment')
  updatePayment(
    @CurrentUser() user: { userId: string },
    @Param('bandId') bandId: string,
    @Param('settlementId') settlementId: string,
    @Param('memberUserId') memberUserId: string,
    @Body() dto: UpdateSettlementPaymentDto,
  ) {
    return this.settlements.updatePayment(user.userId, bandId, settlementId, memberUserId, dto);
  }
}
