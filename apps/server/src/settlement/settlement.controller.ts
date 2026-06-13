import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UpdateSettlementDto } from './dto';
import { SettlementService } from './settlement.service';

@UseGuards(JwtAuthGuard)
@Controller('bands/:bandId')
export class SettlementController {
  constructor(private readonly settlementService: SettlementService) {}

  @Get('settlement')
  get(
    @CurrentUser() user: { userId: string },
    @Param('bandId') bandId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '정산 정보를 불러왔습니다.';
    return this.settlementService.get(user.userId, bandId);
  }

  @Patch('settlement')
  update(
    @CurrentUser() user: { userId: string },
    @Param('bandId') bandId: string,
    @Body() dto: UpdateSettlementDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.locals.message = '정산 정보를 저장했습니다.';
    return this.settlementService.update(user.userId, bandId, dto);
  }
}
