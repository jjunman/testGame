import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Band } from '../bands/band.entity';
import { User } from '../users/user.entity';
import { StudioVote } from './studio-vote.entity';
import { Studio } from './studio.entity';

export type StudioCandidateStatus = 'open' | 'confirmed';

@Entity('band_studio_candidates')
@Unique(['band', 'studio'])
export class StudioCandidate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Band, { onDelete: 'CASCADE' })
  band: Band;

  @ManyToOne(() => Studio, { eager: true, onDelete: 'CASCADE' })
  studio: Studio;

  @ManyToOne(() => User, { eager: true })
  createdByUser: User;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'varchar', default: 'open' })
  status: StudioCandidateStatus;

  @Column({ name: 'vote_deadline_at', type: 'timestamp', nullable: true })
  voteDeadlineAt: Date | null;

  @OneToMany(() => StudioVote, (vote) => vote.candidate)
  votes: StudioVote[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
