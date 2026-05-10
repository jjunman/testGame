import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PracticeAssignmentStatus } from '../common/enums';
import { Band } from '../bands/band.entity';
import { SongCandidate } from '../songs/song-candidate.entity';
import { User } from '../users/user.entity';
import { PracticeSubmission } from './practice-submission.entity';

@Entity('practice_assignments')
export class PracticeAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Band, { onDelete: 'CASCADE' })
  band: Band;

  @ManyToOne(() => SongCandidate, { nullable: true, eager: true })
  songCandidate: SongCandidate | null;

  @Column()
  title: string;

  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  @Column({ name: 'start_sec', type: 'int', nullable: true })
  startSec: number | null;

  @Column({ name: 'end_sec', type: 'int', nullable: true })
  endSec: number | null;

  @Column({ name: 'due_at' })
  dueAt: Date;

  @Column({ type: 'varchar', default: PracticeAssignmentStatus.OPEN })
  status: PracticeAssignmentStatus;

  @Column({ name: 'mix_audio_url', type: 'varchar', nullable: true })
  mixAudioUrl: string | null;

  @Column({ name: 'mix_generated_at', type: 'timestamp', nullable: true })
  mixGeneratedAt: Date | null;

  @ManyToOne(() => User, { eager: true })
  createdByUser: User;

  @OneToMany(() => PracticeSubmission, (submission) => submission.assignment)
  submissions: PracticeSubmission[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
