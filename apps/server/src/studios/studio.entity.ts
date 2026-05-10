import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('studios')
export class Studio {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ default: '안산' })
  region: string;

  @Column({ type: 'varchar', nullable: true })
  address: string | null;

  @Column({ type: 'float', nullable: true })
  latitude: number | null;

  @Column({ type: 'float', nullable: true })
  longitude: number | null;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ name: 'external_url', type: 'varchar', nullable: true })
  externalUrl: string | null;

  @Column({ name: 'source_url', type: 'varchar', nullable: true, unique: true })
  sourceUrl: string | null;

  @Column({ name: 'scraped_at', type: 'timestamp', nullable: true })
  scrapedAt: Date | null;

  @Column({ name: 'hourly_price', type: 'int', nullable: true })
  hourlyPrice: number | null;

  @Column({ name: 'price_note', type: 'text', nullable: true })
  priceNote: string | null;

  @Column({ name: 'amenities_note', type: 'text', nullable: true })
  amenitiesNote: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
