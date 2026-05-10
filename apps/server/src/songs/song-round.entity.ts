import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SongRoundStatus } from '../common/enums';
import { Band } from '../bands/band.entity';
import { User } from '../users/user.entity';
import { SongCandidate } from './song-candidate.entity';

@Entity('band_song_rounds')
export class SongRound {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Band, { onDelete: 'CASCADE' })
  band: Band;

  @Column({ type: 'varchar' })
  status: SongRoundStatus;

  @ManyToOne(() => User, { eager: true })
  createdByUser: User;

  @OneToOne(() => SongCandidate, { nullable: true, eager: true })
  @JoinColumn({ name: 'final_candidate_id' })
  finalCandidate: SongCandidate | null;

  @OneToMany(() => SongCandidate, (candidate) => candidate.round)
  candidates: SongCandidate[];

  @Column({ name: 'voting_deadline_at', type: 'timestamp', nullable: true })
  votingDeadlineAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
