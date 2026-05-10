import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BandMember } from '../bands/band-member.entity';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [TypeOrmModule.forFeature([BandMember])],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
