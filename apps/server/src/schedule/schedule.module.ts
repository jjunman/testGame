import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BandsModule } from '../bands/bands.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { ScheduleAvailability } from './schedule-availability.entity';
import { ScheduleProposalVote } from './schedule-proposal-vote.entity';
import { ScheduleProposal } from './schedule-proposal.entity';
import { ScheduleSlot } from './schedule-slot.entity';
import { ScheduleController } from './schedule.controller';
import { ScheduleService } from './schedule.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ScheduleSlot, ScheduleAvailability, ScheduleProposal, ScheduleProposalVote]),
    BandsModule,
    NotificationsModule,
    UsersModule,
  ],
  providers: [ScheduleService],
  controllers: [ScheduleController],
})
export class ScheduleModule {}
