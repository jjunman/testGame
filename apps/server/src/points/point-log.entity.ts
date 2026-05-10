import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BandMember } from '../bands/band-member.entity';
import { PointLogReason, PointLogRelatedType } from '../common/enums';

@Entity('point_logs')
export class PointLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => BandMember, { eager: true, onDelete: 'CASCADE' })
  bandMember: BandMember;

  @Column({ name: 'change_amount' })
  changeAmount: number;

  @Column({ type: 'varchar' })
  reason: PointLogReason;

  @Column({ name: 'related_type', type: 'varchar' })
  relatedType: PointLogRelatedType;

  @Column({ name: 'related_id' })
  relatedId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
