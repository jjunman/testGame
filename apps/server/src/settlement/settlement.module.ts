import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BandMember } from '../bands/band-member.entity';
import { BandsModule } from '../bands/bands.module';
import { StudioCandidate } from '../studios/studio-candidate.entity';
import { Studio } from '../studios/studio.entity';
import { SettlementController } from './settlement.controller';
import { Settlement } from './settlement.entity';
import { SettlementService } from './settlement.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Settlement, BandMember, StudioCandidate, Studio]),
    BandsModule,
  ],
  providers: [SettlementService],
  controllers: [SettlementController],
})
export class SettlementModule {}
