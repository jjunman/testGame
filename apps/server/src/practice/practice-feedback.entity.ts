import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { PracticeSubmission } from './practice-submission.entity';

@Entity('practice_feedback')
export class PracticeFeedback {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => PracticeSubmission, (submission) => submission.feedback, {
    onDelete: 'CASCADE',
  })
  submission: PracticeSubmission;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  author: User;

  @Column({ type: 'varchar', length: 120 })
  content: string;

  @Column({ name: 'timestamp_ms', type: 'int' })
  timestampMs: number;

  @Column({ name: 'acknowledged_at', type: 'timestamp', nullable: true })
  acknowledgedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
