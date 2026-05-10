import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Band } from '../bands/band.entity';
import { User } from '../users/user.entity';

@Entity('schedule_slots')
export class ScheduleSlot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Band, { onDelete: 'CASCADE' })
  band: Band;

  @Column({ type: 'date' })
  date: string;

  @Column({ name: 'start_time' })
  startTime: string;

  @Column({ name: 'end_time' })
  endTime: string;

  @ManyToOne(() => User, { eager: true })
  createdByUser: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
