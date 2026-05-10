import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BandMember } from '../bands/band-member.entity';
import { BandsModule } from '../bands/bands.module';
import { PracticeAssignment } from '../practice/practice-assignment.entity';
import { UsersModule } from '../users/users.module';
import { SongCandidate } from './song-candidate.entity';
import { SongCatalog } from './song-catalog.entity';
import { SongRound } from './song-round.entity';
import { SongVote } from './song-vote.entity';
import { SongsController } from './songs.controller';
import { SongsService } from './songs.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SongCatalog, SongRound, SongCandidate, SongVote, BandMember, PracticeAssignment]),
    BandsModule,
    UsersModule,
  ],
  providers: [SongsService],
  controllers: [SongsController],
})
export class SongsModule {}
