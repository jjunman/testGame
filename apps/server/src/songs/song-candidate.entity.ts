import {
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../users/user.entity';
import { SongCatalog } from './song-catalog.entity';
import { SongRound } from './song-round.entity';
import { SongVote } from './song-vote.entity';

@Entity('band_song_candidates')
@Unique(['round', 'songCatalog'])
export class SongCandidate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => SongRound, (round) => round.candidates, { onDelete: 'CASCADE' })
  round: SongRound;

  @ManyToOne(() => SongCatalog, { eager: true, onDelete: 'CASCADE' })
  songCatalog: SongCatalog;

  @ManyToOne(() => User, { eager: true })
  createdByUser: User;

  @OneToMany(() => SongVote, (vote) => vote.candidate)
  votes: SongVote[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
