import {
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../users/user.entity';
import { SongCandidate } from './song-candidate.entity';

@Entity('song_votes')
@Unique(['candidate', 'user'])
export class SongVote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => SongCandidate, (candidate) => candidate.votes, { onDelete: 'CASCADE' })
  candidate: SongCandidate;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  user: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
