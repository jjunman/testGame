import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Band } from '../bands/band.entity';
import { User } from '../users/user.entity';
import { ScheduleProposalVote } from './schedule-proposal-vote.entity';

@Entity('schedule_proposals')
export class ScheduleProposal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Band, { onDelete: 'CASCADE' })
  band: Band;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  createdByUser: User;

  @Column({ type: 'date' })
  date: string;

  @Column({ name: 'start_time' })
  startTime: string;

  @Column({ name: 'end_time' })
  endTime: string;

  @Column({ default: true })
  active: boolean;

  @Column({ default: false })
  confirmed: boolean;

  @Column({ name: 'ended_at', type: 'timestamp', nullable: true })
  endedAt: Date | null;

  @OneToMany(() => ScheduleProposalVote, (vote) => vote.proposal)
  votes: ScheduleProposalVote[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
