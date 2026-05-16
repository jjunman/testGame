import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PracticeAssignment } from '../practice/practice-assignment.entity';
import { ScheduleAvailability } from '../schedule/schedule-availability.entity';
import { ScheduleProposal } from '../schedule/schedule-proposal.entity';
import { ScheduleSlot } from '../schedule/schedule-slot.entity';
import { SongCandidate } from '../songs/song-candidate.entity';
import { SongRound } from '../songs/song-round.entity';
import { SongVote } from '../songs/song-vote.entity';
import { StudioCandidate } from '../studios/studio-candidate.entity';
import { UsersModule } from '../users/users.module';
import { BandMember } from './band-member.entity';
import { Band } from './band.entity';
import { BandsController } from './bands.controller';
import { BandsService } from './bands.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Band,
      BandMember,
      SongRound,
      SongCandidate,
      SongVote,
      PracticeAssignment,
      ScheduleSlot,
      ScheduleAvailability,
      ScheduleProposal,
      StudioCandidate,
    ]),
    UsersModule,
  ],
  providers: [BandsService],
  controllers: [BandsController],
  exports: [BandsService, TypeOrmModule],
})
export class BandsModule {}
