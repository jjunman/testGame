import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BandMember } from '../bands/band-member.entity';
import { PointLogReason, PointLogRelatedType } from '../common/enums';
import { PointLog } from './point-log.entity';

@Injectable()
export class PointsService {
  constructor(
    @InjectRepository(BandMember)
    private readonly membersRepository: Repository<BandMember>,
    @InjectRepository(PointLog)
    private readonly pointLogRepository: Repository<PointLog>,
  ) {}

  async addPracticePoint(bandId: string, userId: string, assignmentId: string) {
    return this.applyPracticePointChange({
      bandId,
      userId,
      assignmentId,
      changeAmount: 1,
      reason: PointLogReason.PRACTICE_ON_TIME,
    });
  }

  async deductPracticePoint(bandId: string, userId: string, assignmentId: string) {
    return this.applyPracticePointChange({
      bandId,
      userId,
      assignmentId,
      changeAmount: -1,
      reason: PointLogReason.PRACTICE_MISSED,
    });
  }

  async getPracticePointStatus(bandId: string, userId: string, assignmentId: string) {
    const member = await this.membersRepository.findOne({
      where: { band: { id: bandId }, user: { id: userId } },
      relations: ['band', 'user'],
    });

    const logs = await this.pointLogRepository.find({
      where: {
        bandMember: { id: member?.id },
        relatedType: PointLogRelatedType.PRACTICE_ASSIGNMENT,
        relatedId: assignmentId,
      },
      order: { createdAt: 'DESC' },
    });

    const latest = logs[0] ?? null;

    return {
      currentVolumePoints: member?.volumePoints ?? null,
      applied: Boolean(latest),
      changeAmount: latest?.changeAmount ?? 0,
      reason: latest?.reason ?? null,
    };
  }

  private async applyPracticePointChange({
    bandId,
    userId,
    assignmentId,
    changeAmount,
    reason,
  }: {
    bandId: string;
    userId: string;
    assignmentId: string;
    changeAmount: number;
    reason: PointLogReason;
  }) {
    const member = await this.membersRepository.findOne({
      where: { band: { id: bandId }, user: { id: userId } },
      relations: ['band', 'user'],
    });
    if (!member) {
      return null;
    }

    const existingLog = await this.pointLogRepository.findOne({
      where: {
        bandMember: { id: member.id },
        reason,
        relatedType: PointLogRelatedType.PRACTICE_ASSIGNMENT,
        relatedId: assignmentId,
      },
    });

    if (existingLog) {
      return member;
    }

    member.volumePoints = Math.max(0, member.volumePoints + changeAmount);
    await this.membersRepository.save(member);
    await this.pointLogRepository.save(
      this.pointLogRepository.create({
        bandMember: member,
        changeAmount,
        reason,
        relatedType: PointLogRelatedType.PRACTICE_ASSIGNMENT,
        relatedId: assignmentId,
      }),
    );
    return member;
  }
}
