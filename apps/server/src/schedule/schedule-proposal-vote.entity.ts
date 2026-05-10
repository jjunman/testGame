import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { ScheduleAvailabilityType } from '../common/enums';
import { User } from '../users/user.entity';
import { ScheduleProposal } from './schedule-proposal.entity';

@Entity('schedule_proposal_votes')
@Unique(['proposal', 'user'])
export class ScheduleProposalVote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ScheduleProposal, (proposal) => proposal.votes, { onDelete: 'CASCADE' })
  proposal: ScheduleProposal;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  user: User;

  @Column({ type: 'varchar' })
  availability: ScheduleAvailabilityType;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
