import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Band } from '../bands/band.entity';

export type OutstandingPaymentHistoryItem = {
  id: string;
  userId: string;
  memberName: string;
  amount: number;
  paidAt: string;
  markedByUserId: string;
  markedByName: string;
};

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

  @Column({ name: 'price_mode', type: 'varchar', default: 'studio' })
  priceMode: 'studio' | 'manual';

  @Column({ name: 'manual_hourly_price', type: 'int', nullable: true })
  manualHourlyPrice: number | null;

  @Column({ name: 'usage_hours', type: 'float', default: 2 })
  usageHours: number;

  @Column({ name: 'usage_hours_overridden', default: false })
  usageHoursOverridden: boolean;

  @Column({ name: 'participant_user_ids', type: 'simple-json', nullable: true })
  participantUserIds: string[] | null;

  @Column({ name: 'paid_user_ids', type: 'simple-json', nullable: true })
  paidUserIds: string[] | null;

  @Column({ name: 'outstanding_amounts_by_user_id', type: 'simple-json', nullable: true })
  outstandingAmountsByUserId: Record<string, number> | null;

  @Column({ name: 'outstanding_payment_history', type: 'simple-json', nullable: true })
  outstandingPaymentHistory: OutstandingPaymentHistoryItem[] | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
