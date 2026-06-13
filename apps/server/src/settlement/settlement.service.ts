import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BandMember } from '../bands/band-member.entity';
import { BandsService } from '../bands/bands.service';
import { ScheduleProposal } from '../schedule/schedule-proposal.entity';
import { StudioCandidate } from '../studios/studio-candidate.entity';
import { Studio } from '../studios/studio.entity';
import { UpdateSettlementDto } from './dto';
import { Settlement } from './settlement.entity';

const DEFAULT_EXPECTED_HOURS = 2;

@Injectable()
export class SettlementService {
  constructor(
    @InjectRepository(Settlement)
    private readonly settlementsRepository: Repository<Settlement>,
    @InjectRepository(BandMember)
    private readonly membersRepository: Repository<BandMember>,
    @InjectRepository(ScheduleProposal)
    private readonly scheduleProposalsRepository: Repository<ScheduleProposal>,
    @InjectRepository(StudioCandidate)
    private readonly studioCandidatesRepository: Repository<StudioCandidate>,
    @InjectRepository(Studio)
    private readonly studiosRepository: Repository<Studio>,
    private readonly bandsService: BandsService,
  ) {}

  async get(userId: string, bandId: string) {
    const membership = await this.bandsService.requireMembership(userId, bandId);
    const [settlement, members, confirmedSchedule] = await Promise.all([
      this.findOrCreate(membership),
      this.getMembers(bandId),
      this.getConfirmedSchedule(bandId),
    ]);
    const memberIds = members.map((member) => member.user.id);
    let selectedStudioId = settlement.selectedStudioId;
    if (selectedStudioId && !(await this.hasStudio(bandId, selectedStudioId))) {
      selectedStudioId = null;
    }

    const participantUserIds = this.cleanIds(settlement.participantUserIds, memberIds);
    const nextParticipantUserIds = participantUserIds.length > 0 ? participantUserIds : memberIds;
    const paidUserIds = this.cleanIds(settlement.paidUserIds, nextParticipantUserIds);
    const expectedHours = confirmedSchedule?.expectedHours ?? settlement.expectedHours ?? DEFAULT_EXPECTED_HOURS;

    return {
      selectedStudioId,
      customTotalPrice: settlement.customTotalPrice,
      expectedHours,
      scheduleLocked: Boolean(confirmedSchedule),
      confirmedSchedule,
      participantUserIds: nextParticipantUserIds,
      paidUserIds,
      updatedAt: settlement.updatedAt.toISOString(),
    };
  }

  async update(userId: string, bandId: string, dto: UpdateSettlementDto) {
    const membership = await this.bandsService.requireMembership(userId, bandId);
    const [settlement, members, confirmedSchedule] = await Promise.all([
      this.findOrCreate(membership),
      this.getMembers(bandId),
      this.getConfirmedSchedule(bandId),
    ]);
    const memberIds = members.map((member) => member.user.id);

    if (Object.prototype.hasOwnProperty.call(dto, 'selectedStudioId')) {
      if (dto.selectedStudioId === null || dto.selectedStudioId === undefined || dto.selectedStudioId === '') {
        settlement.selectedStudioId = null;
      } else {
        if (!(await this.hasStudio(bandId, dto.selectedStudioId))) {
          throw new BadRequestException('선택할 수 없는 합주실입니다.');
        }
        settlement.selectedStudioId = dto.selectedStudioId;
      }
    }

    if (Object.prototype.hasOwnProperty.call(dto, 'customTotalPrice')) {
      settlement.customTotalPrice = dto.customTotalPrice ?? null;
    }

    if (!confirmedSchedule && dto.expectedHours !== undefined) {
      settlement.expectedHours = dto.expectedHours;
    }

    if (dto.participantUserIds) {
      const participantUserIds = this.cleanIds(dto.participantUserIds, memberIds);
      settlement.participantUserIds = participantUserIds.length > 0 ? participantUserIds : [memberIds[0]].filter(Boolean);
      settlement.paidUserIds = this.cleanIds(settlement.paidUserIds, settlement.participantUserIds ?? []);
    }

    if (dto.paidUserIds) {
      const participantUserIds = this.cleanIds(settlement.participantUserIds, memberIds);
      const effectiveParticipantUserIds = participantUserIds.length > 0 ? participantUserIds : memberIds;
      settlement.paidUserIds = this.cleanIds(dto.paidUserIds, effectiveParticipantUserIds);
    }

    await this.settlementsRepository.save(settlement);
    return this.get(userId, bandId);
  }

  private async findOrCreate(membership: BandMember) {
    const existing = await this.settlementsRepository.findOne({
      where: { band: { id: membership.band.id } },
      relations: ['band'],
    });
    if (existing) {
      return existing;
    }

    const defaultSelectedStudioId = await this.getDefaultStudioId(membership.band.id);
    return this.settlementsRepository.save(
      this.settlementsRepository.create({
        band: membership.band,
        selectedStudioId: defaultSelectedStudioId,
        customTotalPrice: null,
        expectedHours: DEFAULT_EXPECTED_HOURS,
        participantUserIds: null,
        paidUserIds: null,
      }),
    );
  }

  private async getMembers(bandId: string) {
    return this.membersRepository.find({
      where: { band: { id: bandId } },
      order: { joinedAt: 'ASC' },
    });
  }

  private async getDefaultStudioId(bandId: string) {
    const confirmed = await this.studioCandidatesRepository.findOne({
      where: { band: { id: bandId }, status: 'confirmed' },
      order: { createdAt: 'DESC' },
    });
    if (confirmed?.studio?.id) {
      return confirmed.studio.id;
    }

    const firstCandidate = await this.studioCandidatesRepository.findOne({
      where: { band: { id: bandId } },
      order: { createdAt: 'ASC' },
    });
    if (firstCandidate?.studio?.id) {
      return firstCandidate.studio.id;
    }

    const firstStudio = await this.studiosRepository.findOne({
      where: { region: '안산' },
      order: { name: 'ASC' },
    });
    return firstStudio?.id ?? null;
  }

  private async hasStudio(bandId: string, studioId: string) {
    const [studio, candidate] = await Promise.all([
      this.studiosRepository.findOne({ where: { id: studioId } }),
      this.studioCandidatesRepository.findOne({
        where: { band: { id: bandId }, studio: { id: studioId } },
      }),
    ]);
    return Boolean(studio || candidate);
  }

  private async getConfirmedSchedule(bandId: string) {
    const proposal = await this.scheduleProposalsRepository.findOne({
      where: { band: { id: bandId }, confirmed: true },
      order: { createdAt: 'DESC' },
    });
    if (!proposal) {
      return null;
    }

    return {
      id: proposal.id,
      date: proposal.date,
      startTime: proposal.startTime,
      endTime: proposal.endTime,
      expectedHours: this.toExpectedHours(proposal.startTime, proposal.endTime),
    };
  }

  private toExpectedHours(startTime: string, endTime: string) {
    const minutes = this.toMinute(endTime) - this.toMinute(startTime);
    return minutes > 0 ? Math.max(0.5, minutes / 60) : DEFAULT_EXPECTED_HOURS;
  }

  private toMinute(value: string) {
    const [hour, minute] = value.split(':').map(Number);
    return hour * 60 + minute;
  }

  private cleanIds(value: string[] | null | undefined, allowedIds: string[]) {
    const allowed = new Set(allowedIds);
    return Array.from(new Set(value ?? [])).filter((id) => allowed.has(id));
  }
}
