import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BandMember } from '../bands/band-member.entity';
import { PointLog } from './point-log.entity';
import { PointsService } from './points.service';

@Module({
  imports: [TypeOrmModule.forFeature([BandMember, PointLog])],
  providers: [PointsService],
  exports: [PointsService],
})
export class PointsModule {}
