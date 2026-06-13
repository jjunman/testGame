import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BandMember } from '../bands/band-member.entity';
import { BandsModule } from '../bands/bands.module';
import { ScheduleProposal } from '../schedule/schedule-proposal.entity';
import { StudioCandidate } from '../studios/studio-candidate.entity';
import { Studio } from '../studios/studio.entity';
import { SettlementController } from './settlement.controller';
import { Settlement } from './settlement.entity';
import { SettlementService } from './settlement.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Settlement, BandMember, ScheduleProposal, StudioCandidate, Studio]),
    BandsModule,
  ],
  providers: [SettlementService],
  controllers: [SettlementController],
})
export class SettlementModule {}
