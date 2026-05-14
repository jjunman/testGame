import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BandMember } from '../bands/band-member.entity';
import { BandsModule } from '../bands/bands.module';
import { PointsModule } from '../points/points.module';
import { SongCandidate } from '../songs/song-candidate.entity';
import { UsersModule } from '../users/users.module';
import { PracticeAssignment } from './practice-assignment.entity';
import { PracticeSubmission } from './practice-submission.entity';
import { PracticeController } from './practice.controller';
import { PracticeService } from './practice.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PracticeAssignment, PracticeSubmission, SongCandidate, BandMember]),
    BandsModule,
    UsersModule,
    PointsModule,
  ],
  providers: [PracticeService],
  controllers: [PracticeController],
})
export class PracticeModule {}
