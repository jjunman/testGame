import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Band } from '../bands/band.entity';

@Entity('band_settlements')
@Unique(['band'])
export class Settlement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Band, { onDelete: 'CASCADE' })
  band: Band;

  @Column({ name: 'selected_studio_id', type: 'varchar', nullable: true })
  selectedStudioId: string | null;

  @Column({ name: 'custom_total_price', type: 'int', nullable: true })
  customTotalPrice: number | null;

  @Column({ name: 'usage_hours', type: 'float', default: 2 })
  usageHours: number;

  @Column({ name: 'usage_hours_overridden', default: false })
  usageHoursOverridden: boolean;

  @Column({ name: 'participant_user_ids', type: 'simple-json', nullable: true })
  participantUserIds: string[] | null;

  @Column({ name: 'paid_user_ids', type: 'simple-json', nullable: true })
  paidUserIds: string[] | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
