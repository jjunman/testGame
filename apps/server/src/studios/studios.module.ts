import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BandMember } from '../bands/band-member.entity';
import { BandsModule } from '../bands/bands.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ScheduleProposal } from '../schedule/schedule-proposal.entity';
import { UsersModule } from '../users/users.module';
import { StudioCandidate } from './studio-candidate.entity';
import { StudioVote } from './studio-vote.entity';
import { Studio } from './studio.entity';
import { StudiosController } from './studios.controller';
import { StudiosService } from './studios.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Studio, StudioCandidate, StudioVote, ScheduleProposal, BandMember]),
    BandsModule,
    NotificationsModule,
    UsersModule,
  ],
  providers: [StudiosService],
  controllers: [StudiosController],
})
export class StudiosModule {}
