import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { Band } from '../bands/band.entity';

export type SettlementParticipant = {
  userId: string;
  memberName: string;
  profileImageUrl: string | null;
  amount: number;
  paid: boolean;
  paidAt: string | null;
};

@Entity('band_settlement_rounds')
export class SettlementRound {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'band_id', type: 'uuid' }) bandId: string;
  @ManyToOne(() => Band, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'band_id' }) band: Band;
  @Column({ type: 'varchar' }) status: 'active' | 'outstanding' | 'completed';
  @Column({ name: 'total_amount', type: 'int' }) totalAmount: number;
  @Column({ type: 'jsonb' }) participants: SettlementParticipant[];
  @Column({ name: 'created_by_user_id', type: 'uuid' }) createdByUserId: string;
  @Column({ name: 'created_by_name', type: 'varchar' }) createdByName: string;
  @Column({ name: 'updated_by_user_id', type: 'uuid' }) updatedByUserId: string;
  @Column({ name: 'updated_by_name', type: 'varchar' }) updatedByName: string;
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true }) completedAt: Date | null;
  @Column({ name: 'deadline_at', type: 'timestamptz', default: () => "CURRENT_TIMESTAMP + INTERVAL '3 days'" }) deadlineAt: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
  @VersionColumn() version: number;
}
