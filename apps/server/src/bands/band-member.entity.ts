import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { MemberRole, PositionType } from '../common/enums';
import { User } from '../users/user.entity';
import { Band } from './band.entity';

@Entity('band_members')
@Unique(['band', 'user'])
export class BandMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Band, { onDelete: 'CASCADE' })
  band: Band;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  user: User;

  @Column({ type: 'varchar' })
  role: MemberRole;

  @Column({ name: 'position_type', type: 'varchar' })
  positionType: PositionType;

  @Column({ name: 'custom_position', type: 'varchar', nullable: true })
  customPosition: string | null;

  @Column({ name: 'volume_points', default: 20 })
  volumePoints: number;

  @Column({ name: 'home_location_label', type: 'varchar', nullable: true })
  homeLocationLabel: string | null;

  @Column({ name: 'home_latitude', type: 'float', nullable: true })
  homeLatitude: number | null;

  @Column({ name: 'home_longitude', type: 'float', nullable: true })
  homeLongitude: number | null;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt: Date;
}
