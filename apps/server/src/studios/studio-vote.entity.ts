import {
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../users/user.entity';
import { StudioCandidate } from './studio-candidate.entity';

@Entity('studio_votes')
@Unique(['candidate', 'user'])
export class StudioVote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => StudioCandidate, (candidate) => candidate.votes, { onDelete: 'CASCADE' })
  candidate: StudioCandidate;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  user: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
