import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BandMember } from '../bands/band-member.entity';
import { BandsModule } from '../bands/bands.module';
import { SettlementRoundController } from './settlement-round.controller';
import { SettlementRound } from './settlement-round.entity';
import { SettlementRoundService } from './settlement-round.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SettlementRound, BandMember]),
    BandsModule,
  ],
  providers: [SettlementRoundService],
  controllers: [SettlementRoundController],
})
export class SettlementModule {}
