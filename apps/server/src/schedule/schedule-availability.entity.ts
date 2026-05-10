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
import { ScheduleSlot } from './schedule-slot.entity';

@Entity('schedule_availabilities')
@Unique(['slot', 'user'])
export class ScheduleAvailability {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ScheduleSlot, { onDelete: 'CASCADE' })
  slot: ScheduleSlot;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  user: User;

  @Column({ type: 'varchar' })
  availability: ScheduleAvailabilityType;

  @CreateDateColumn({ name: 'submitted_at' })
  submittedAt: Date;
}
