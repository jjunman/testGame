import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { Band } from '../bands/band.entity';
import { BandMember } from '../bands/band-member.entity';
import { PointLog } from '../points/point-log.entity';
import { PracticeAssignment } from '../practice/practice-assignment.entity';
import { PracticeSubmission } from '../practice/practice-submission.entity';
import { ScheduleAvailability } from '../schedule/schedule-availability.entity';
import { ScheduleProposalVote } from '../schedule/schedule-proposal-vote.entity';
import { ScheduleProposal } from '../schedule/schedule-proposal.entity';
import { ScheduleSlot } from '../schedule/schedule-slot.entity';
import { StudioCandidate } from '../studios/studio-candidate.entity';
import { StudioVote } from '../studios/studio-vote.entity';
import { Studio } from '../studios/studio.entity';
import { SongCandidate } from '../songs/song-candidate.entity';
import { SongCatalog } from '../songs/song-catalog.entity';
import { SongRound } from '../songs/song-round.entity';
import { SongVote } from '../songs/song-vote.entity';
import { User } from '../users/user.entity';

export const typeOrmConfig = (databaseUrl: string): TypeOrmModuleOptions => ({
  type: 'postgres' as const,
  url: databaseUrl || undefined,
  host: databaseUrl ? undefined : process.env.DB_HOST ?? 'localhost',
  port: databaseUrl ? undefined : parseInt(process.env.DB_PORT ?? '5432', 10),
  username: databaseUrl ? undefined : process.env.DB_USERNAME ?? 'postgres',
  password: databaseUrl ? undefined : process.env.DB_PASSWORD ?? 'postgres',
  database: databaseUrl ? undefined : process.env.DB_NAME ?? 'band_management',
  synchronize: true,
  entities: [
    User,
    Band,
    BandMember,
    SongCatalog,
    SongRound,
    SongCandidate,
    SongVote,
    PracticeAssignment,
    PracticeSubmission,
    ScheduleSlot,
    ScheduleAvailability,
    ScheduleProposal,
    ScheduleProposalVote,
    Studio,
    StudioCandidate,
    StudioVote,
    PointLog,
  ],
});
