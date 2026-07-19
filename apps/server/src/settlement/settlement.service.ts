import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { BandMember } from '../bands/band-member.entity';
import { BandsService } from '../bands/bands.service';
import { ScheduleProposal } from '../schedule/schedule-proposal.entity';
import { StudioCandidate } from '../studios/studio-candidate.entity';
import { Studio } from '../studios/studio.entity';
import { CompleteSettlementDto, UpdateSettlementDto } from './dto';
import { OutstandingPaymentHistoryItem, Settlement } from './settlement.entity';

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
    const [settlement, members, confirmedUsageHours] = await Promise.all([
      this.findOrCreate(membership),
      this.getMembers(bandId),
      this.getConfirmedUsageHours(bandId),
    ]);
    const memberIds = members.map((member) => member.user.id);
    let selectedStudioId = settlement.selectedStudioId;
    if (selectedStudioId && !(await this.hasStudio(bandId, selectedStudioId))) {
      selectedStudioId = null;
    }

    const participantUserIds = this.cleanIds(settlement.participantUserIds, memberIds);
    const nextParticipantUserIds = participantUserIds.length > 0 ? participantUserIds : memberIds;
    const paidUserIds = this.cleanIds(settlement.paidUserIds, memberIds);
    const outstandingAmountsByUserId = this.cleanAmounts(settlement.outstandingAmountsByUserId, memberIds);
    const outstandingPaymentHistory = this.cleanPaymentHistory(settlement.outstandingPaymentHistory);
    return {
      selectedStudioId,
      customTotalPrice: settlement.customTotalPrice,
      priceMode: settlement.priceMode ?? 'studio',
      manualHourlyPrice: settlement.manualHourlyPrice ?? null,
      usageHours: confirmedUsageHours !== null && !settlement.usageHoursOverridden
        ? confirmedUsageHours
        : settlement.usageHours,
      usageHoursFromSchedule: confirmedUsageHours !== null && !settlement.usageHoursOverridden,
      participantUserIds: nextParticipantUserIds,
      paidUserIds,
      outstandingAmountsByUserId,
      outstandingPaymentHistory,
      updatedAt: settlement.updatedAt.toISOString(),
    };
  }

  async update(userId: string, bandId: string, dto: UpdateSettlementDto) {
    const membership = await this.bandsService.requireMembership(userId, bandId);
    const [seedSettlement, members] = await Promise.all([
      this.findOrCreate(membership),
      this.getMembers(bandId),
    ]);
    const memberIds = members.map((member) => member.user.id);

    await this.settlementsRepository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Settlement);
      const settlement = await repository.findOne({
        where: { id: seedSettlement.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!settlement) {
        throw new BadRequestException('정산 정보를 찾지 못했어요.');
      }

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

      if (dto.priceMode !== undefined) {
        settlement.priceMode = dto.priceMode;
        if (dto.priceMode === 'studio') {
          settlement.manualHourlyPrice = null;
        }
      }

      if (Object.prototype.hasOwnProperty.call(dto, 'manualHourlyPrice')) {
        settlement.manualHourlyPrice = dto.manualHourlyPrice ?? null;
        if (settlement.manualHourlyPrice !== null) {
          settlement.priceMode = 'manual';
        }
      }

      if (dto.usageHours !== undefined) {
        settlement.usageHours = dto.usageHours;
        settlement.usageHoursOverridden = true;
      }

      if (dto.participantUserIds) {
        const participantUserIds = this.cleanIds(dto.participantUserIds, memberIds);
        settlement.participantUserIds = participantUserIds.length > 0 ? participantUserIds : [memberIds[0]].filter(Boolean);
        settlement.paidUserIds = this.cleanIds(settlement.paidUserIds, memberIds);
      }

      if (dto.paidUserIds) {
        settlement.paidUserIds = this.cleanIds(dto.paidUserIds, memberIds);
      }

      await repository.save(settlement);
    });

    return this.get(userId, bandId);
  }

  async complete(userId: string, bandId: string, dto: CompleteSettlementDto = {}) {
    const membership = await this.bandsService.requireMembership(userId, bandId);
    const [seedSettlement, members, defaultSelectedStudioId] = await Promise.all([
      this.findOrCreate(membership),
      this.getMembers(bandId),
      this.getDefaultStudioId(bandId),
    ]);
    const memberIds = members.map((member) => member.user.id);

    await this.settlementsRepository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Settlement);
      const settlement = await repository.findOne({
        where: { id: seedSettlement.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!settlement) {
        throw new BadRequestException('정산 정보를 찾지 못했어요.');
      }

      if (Object.prototype.hasOwnProperty.call(dto, 'customTotalPrice')) {
        settlement.customTotalPrice = dto.customTotalPrice ?? null;
      }
      if (dto.participantUserIds) {
        const participantUserIds = this.cleanIds(dto.participantUserIds, memberIds);
        settlement.participantUserIds = participantUserIds.length > 0 ? participantUserIds : [memberIds[0]].filter(Boolean);
      }
      if (dto.paidUserIds) {
        settlement.paidUserIds = this.cleanIds(dto.paidUserIds, memberIds);
      }

      const participantUserIds = this.cleanIds(settlement.participantUserIds, memberIds);
      const effectiveParticipantUserIds = participantUserIds.length > 0 ? participantUserIds : memberIds;
      const paidUserIds = new Set(this.cleanIds(settlement.paidUserIds, memberIds));
      const totalPrice = settlement.customTotalPrice;
      if (!totalPrice || totalPrice <= 0) {
        throw new BadRequestException('이번 정산 금액을 입력해주세요.');
      }
      if (effectiveParticipantUserIds.length === 0) {
        throw new BadRequestException('정산할 참여 멤버가 필요합니다.');
      }

      const participantSet = new Set(effectiveParticipantUserIds);
      const currentOutstanding = this.cleanAmounts(settlement.outstandingAmountsByUserId, memberIds);
      const perMemberPrice = Math.ceil(totalPrice / effectiveParticipantUserIds.length);
      const nextOutstanding: Record<string, number> = {};
      for (const memberId of memberIds) {
        const previousAmount = currentOutstanding[memberId] ?? 0;
        const currentAmount = participantSet.has(memberId) && !paidUserIds.has(memberId) ? perMemberPrice : 0;
        const nextAmount = previousAmount + currentAmount;
        if (nextAmount > 0) {
          nextOutstanding[memberId] = nextAmount;
        }
      }

      settlement.customTotalPrice = null;
      settlement.priceMode = 'studio';
      settlement.manualHourlyPrice = null;
      settlement.usageHours = 2;
      settlement.usageHoursOverridden = false;
      settlement.participantUserIds = memberIds;
      settlement.paidUserIds = [];
      settlement.outstandingAmountsByUserId = nextOutstanding;
      settlement.selectedStudioId = defaultSelectedStudioId;
      await repository.save(settlement);
    });

    return this.get(userId, bandId);
  }

  async markOutstandingPaid(userId: string, bandId: string, memberUserId: string, expectedAmount: number) {
    const membership = await this.bandsService.requireMembership(userId, bandId);
    if (userId !== memberUserId) {
      throw new ForbiddenException('이전 미납은 본인만 납부 완료로 처리할 수 있어요.');
    }
    const seedSettlement = await this.findOrCreate(membership);
    const members = await this.getMembers(bandId);
    const targetMember = members.find((member) => member.user.id === memberUserId);
    if (!targetMember) {
      throw new BadRequestException('현재 밴드 멤버의 미납만 처리할 수 있어요.');
    }

    await this.settlementsRepository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Settlement);
      const settlement = await repository.findOne({
        where: { id: seedSettlement.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!settlement) {
        throw new BadRequestException('정산 정보를 찾지 못했어요.');
      }

      const memberIds = members.map((member) => member.user.id);
      const outstandingAmounts = this.cleanAmounts(settlement.outstandingAmountsByUserId, memberIds);
      const currentAmount = outstandingAmounts[memberUserId] ?? 0;
      if (currentAmount <= 0) {
        throw new BadRequestException('이미 처리됐거나 남아 있는 미납이 없어요.');
      }
      if (currentAmount !== expectedAmount) {
        throw new BadRequestException('미납 금액이 변경됐어요. 화면을 확인한 뒤 다시 처리해주세요.');
      }

      delete outstandingAmounts[memberUserId];
      const history = this.cleanPaymentHistory(settlement.outstandingPaymentHistory);
      settlement.outstandingAmountsByUserId = outstandingAmounts;
      settlement.outstandingPaymentHistory = [
        {
          id: randomUUID(),
          userId: memberUserId,
          memberName: targetMember.user.name,
          amount: currentAmount,
          paidAt: new Date().toISOString(),
          markedByUserId: userId,
          markedByName: membership.user.name,
        },
        ...history,
      ].slice(0, 20);
      await repository.save(settlement);
    });

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
        priceMode: 'studio',
        manualHourlyPrice: null,
        usageHours: 2,
        usageHoursOverridden: false,
        participantUserIds: null,
        paidUserIds: null,
        outstandingAmountsByUserId: null,
        outstandingPaymentHistory: null,
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

  private async getConfirmedUsageHours(bandId: string) {
    const proposal = await this.scheduleProposalsRepository.findOne({
      where: { band: { id: bandId }, confirmed: true },
      order: { createdAt: 'DESC' },
    });
    if (!proposal) {
      return null;
    }

    const minutes = this.toMinute(proposal.endTime) - this.toMinute(proposal.startTime);
    return minutes > 0 ? minutes / 60 : null;
  }

  private toMinute(value: string) {
    const [hour, minute] = value.split(':').map(Number);
    return hour * 60 + minute;
  }

  private cleanIds(value: string[] | null | undefined, allowedIds: string[]) {
    const allowed = new Set(allowedIds);
    return Array.from(new Set(value ?? [])).filter((id) => allowed.has(id));
  }

  private cleanAmounts(value: Record<string, number> | null | undefined, allowedIds: string[]) {
    const allowed = new Set(allowedIds);
    return Object.entries(value ?? {}).reduce<Record<string, number>>((acc, [userId, amount]) => {
      const normalizedAmount = Math.max(0, Math.round(Number(amount) || 0));
      if (allowed.has(userId) && normalizedAmount > 0) {
        acc[userId] = normalizedAmount;
      }
      return acc;
    }, {});
  }

  private cleanPaymentHistory(value: OutstandingPaymentHistoryItem[] | null | undefined) {
    return (value ?? [])
      .filter((item) => item && item.id && item.userId && item.amount > 0 && item.paidAt)
      .slice(0, 20);
  }
}
