import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SongDifficulty } from '../common/enums';

@Entity('song_catalog')
export class SongCatalog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column()
  artist: string;

  @Column({ name: 'youtube_video_id', type: 'varchar', nullable: true })
  youtubeVideoId: string | null;

  @Column({ type: 'varchar', nullable: true })
  difficulty: SongDifficulty | null;

  @Column({ name: 'required_instruments', type: 'simple-json', nullable: true, default: '[]' })
  requiredInstruments: string[] | null = [];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
