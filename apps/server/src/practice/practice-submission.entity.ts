import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { PracticeSubmissionStatus } from '../common/enums';
import { User } from '../users/user.entity';
import { PracticeAssignment } from './practice-assignment.entity';

@Entity('practice_submissions')
@Unique(['assignment', 'user'])
export class PracticeSubmission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => PracticeAssignment, (assignment) => assignment.submissions, {
    onDelete: 'CASCADE',
  })
  assignment: PracticeAssignment;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  user: User;

  @Column({ name: 'audio_url' })
  audioUrl: string;

  @Column({ name: 'duration_sec', type: 'int', nullable: true })
  durationSec: number | null;

  @Column({ name: 'sync_offset_ms', type: 'int', default: 0 })
  syncOffsetMs: number;

  @CreateDateColumn({ name: 'submitted_at' })
  submittedAt: Date;

  @Column({ type: 'varchar', default: PracticeSubmissionStatus.SUBMITTED })
  status: PracticeSubmissionStatus;
}
