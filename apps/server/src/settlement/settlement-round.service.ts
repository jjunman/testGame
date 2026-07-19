import { BadRequestException, ConflictException, Injectable, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, LessThanOrEqual, Repository } from 'typeorm';
import { BandMember } from '../bands/band-member.entity';
import { BandsService } from '../bands/bands.service';
import { CreateSettlementRoundDto, UpdateSettlementPaymentDto, UpdateSettlementRoundDto } from './dto';
import { SettlementParticipant, SettlementRound } from './settlement-round.entity';

@Injectable()
export class SettlementRoundService implements OnModuleInit, OnModuleDestroy {
  private expirationTimer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(SettlementRound) private readonly rounds: Repository<SettlementRound>,
    @InjectRepository(BandMember) private readonly members: Repository<BandMember>,
    private readonly bandsService: BandsService,
    private readonly dataSource: DataSource,
  ) {}

  onModuleInit() {
    this.expirationTimer = setInterval(() => void this.finalizeExpiredRounds().catch(() => undefined), 60_000);
    this.expirationTimer.unref();
  }

  onModuleDestroy() {
    if (this.expirationTimer) clearInterval(this.expirationTimer);
  }

  async getOverview(userId: string, bandId: string) {
    await this.bandsService.requireMembership(userId, bandId);
    await this.finalizeExpiredRounds(bandId);
    const [openRounds, recentCompleted] = await Promise.all([
      this.rounds.find({ where: { bandId, status: In(['active', 'outstanding']) }, order: { createdAt: 'DESC' } }),
      this.rounds.find({ where: { bandId, status: 'completed' }, order: { completedAt: 'DESC' }, take: 3 }),
    ]);
    const profileImagesByUserId = await this.getProfileImagesByUserId(bandId);
    const activeRounds = openRounds.filter((round) => round.status === 'active');
    const outstandingRounds = openRounds.filter((round) => round.status === 'outstanding');
    const unpaidParticipants = openRounds.flatMap((round) => round.participants.filter((participant) => !participant.paid));
    return {
      activeRounds: activeRounds.map((round) => this.toDto(round, profileImagesByUserId)),
      outstandingRounds: outstandingRounds.map((round) => this.toOutstandingDto(round, profileImagesByUserId)),
      outstandingSummary: {
        totalAmount: unpaidParticipants.reduce((sum, participant) => sum + participant.amount, 0),
        unpaidCount: unpaidParticipants.length,
        unpaidMemberCount: new Set(unpaidParticipants.map((participant) => participant.userId)).size,
      },
      recentCompleted: recentCompleted.map((round) => this.toDto(round, profileImagesByUserId)),
    };
  }

  async getHistory(userId: string, bandId: string) {
    await this.bandsService.requireMembership(userId, bandId);
    const rounds = await this.rounds.find({
      where: { bandId, status: 'completed' },
      order: { completedAt: 'DESC' },
      take: 50,
    });
    const profileImagesByUserId = await this.getProfileImagesByUserId(bandId);
    return rounds.map((round) => this.toDto(round, profileImagesByUserId));
  }

  async getOne(userId: string, bandId: string, settlementId: string) {
    await this.bandsService.requireMembership(userId, bandId);
    const round = await this.rounds.findOne({ where: { id: settlementId, bandId } });
    if (!round) throw new NotFoundException('정산 내역을 찾지 못했어요.');
    const profileImagesByUserId = await this.getProfileImagesByUserId(bandId);
    return this.toDto(round, profileImagesByUserId);
  }

  async create(userId: string, bandId: string, dto: CreateSettlementRoundDto) {
    const actor = await this.bandsService.requireMembership(userId, bandId);
    const participants = await this.makeParticipants(bandId, dto.participantUserIds, dto.totalAmount);
    const deadlineMs = dto.deadlineSeconds === 30
      ? 30_000
      : dto.deadlineDays * 24 * 60 * 60 * 1000;
    const deadlineAt = new Date(Date.now() + deadlineMs);
    const round = await this.rounds.save(this.rounds.create({
        bandId,
        status: 'active',
        totalAmount: dto.totalAmount,
        participants,
        createdByUserId: userId,
        createdByName: actor.user.name,
        updatedByUserId: userId,
        updatedByName: actor.user.name,
        completedAt: null,
        deadlineAt,
      }));
    return this.toDto(round);
  }

  async update(userId: string, bandId: string, settlementId: string, dto: UpdateSettlementRoundDto) {
    await this.finalizeExpiredRounds(bandId);
    const actor = await this.bandsService.requireMembership(userId, bandId);
    const participants = await this.makeParticipants(bandId, dto.participantUserIds, dto.totalAmount);
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(SettlementRound);
      const round = await repository.findOne({
        where: { id: settlementId, bandId },
        lock: { mode: 'pessimistic_write' },
      });
      this.assertEditable(round, dto.version);
      round.totalAmount = dto.totalAmount;
      round.participants = participants;
      round.updatedByUserId = userId;
      round.updatedByName = actor.user.name;
      return this.toDto(await repository.save(round));
    });
  }

  async updatePayment(
    userId: string,
    bandId: string,
    settlementId: string,
    memberUserId: string,
    dto: UpdateSettlementPaymentDto,
  ) {
    const actor = await this.bandsService.requireMembership(userId, bandId);
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(SettlementRound);
      const round = await repository.findOne({
        where: { id: settlementId, bandId },
        lock: { mode: 'pessimistic_write' },
      });
      this.assertVersion(round, dto.version);
      if (round.status === 'completed') throw new ConflictException('이미 완료된 정산이에요.');
      if (round.status === 'active' && round.deadlineAt.getTime() <= Date.now()) round.status = 'outstanding';
      if (round.status === 'outstanding' && !dto.paid) throw new ConflictException('마감된 미입금은 납부 완료로만 처리할 수 있어요.');
      const index = round.participants.findIndex((participant) => participant.userId === memberUserId);
      if (index < 0) throw new BadRequestException('정산 참여 멤버가 아니에요.');
      const now = new Date();
      round.participants = round.participants.map((participant, participantIndex) => participantIndex === index
        ? { ...participant, paid: dto.paid, paidAt: dto.paid ? now.toISOString() : null }
        : participant);
      round.updatedByUserId = userId;
      round.updatedByName = actor.user.name;
      if (round.participants.every((participant) => participant.paid)) {
        round.status = 'completed';
        round.completedAt = now;
      }
      return this.toDto(await repository.save(round));
    });
  }

  private async makeParticipants(bandId: string, requestedIds: string[], totalAmount: number) {
    if (requestedIds.length === 0) throw new BadRequestException('참여 멤버를 1명 이상 포함해주세요.');
    const members = await this.members.find({ where: { band: { id: bandId } }, order: { joinedAt: 'ASC' } });
    const requested = new Set(requestedIds);
    const selected = members.filter((member) => requested.has(member.user.id));
    if (selected.length !== requested.size) throw new BadRequestException('현재 밴드 멤버만 정산에 참여할 수 있어요.');
    const baseAmount = Math.floor(totalAmount / selected.length);
    const remainder = totalAmount % selected.length;
    return selected.map<SettlementParticipant>((member, index) => ({
      userId: member.user.id,
      memberName: member.user.name,
      profileImageUrl: member.profileImageUrl,
      amount: baseAmount + (index < remainder ? 1 : 0),
      paid: false,
      paidAt: null,
    }));
  }

  private async getProfileImagesByUserId(bandId: string) {
    const members = await this.members.find({ where: { band: { id: bandId } } });
    return new Map(members.map((member) => [member.user.id, member.profileImageUrl]));
  }

  private assertEditable(round: SettlementRound | null, version: number): asserts round is SettlementRound {
    this.assertVersion(round, version);
    if (round.status !== 'active') throw new ConflictException('마감된 정산은 수정할 수 없어요.');
  }

  private assertVersion(round: SettlementRound | null, version: number): asserts round is SettlementRound {
    if (!round) throw new NotFoundException('정산을 찾지 못했어요.');
    if (round.version !== version) throw new ConflictException('정산 내용이 변경됐어요. 새로고침 후 다시 시도해주세요.');
  }

  private toDto(round: SettlementRound, profileImagesByUserId?: Map<string, string | null>) {
    return {
      id: round.id,
      status: round.status,
      totalAmount: round.totalAmount,
      participants: round.participants.map((participant) => ({
        ...participant,
        profileImageUrl: profileImagesByUserId?.has(participant.userId)
          ? profileImagesByUserId.get(participant.userId) ?? null
          : participant.profileImageUrl,
      })),
      createdByUserId: round.createdByUserId,
      createdByName: round.createdByName,
      updatedByUserId: round.updatedByUserId,
      updatedByName: round.updatedByName,
      createdAt: round.createdAt.toISOString(),
      updatedAt: round.updatedAt.toISOString(),
      completedAt: round.completedAt?.toISOString() ?? null,
      deadlineAt: round.deadlineAt.toISOString(),
      version: round.version,
    };
  }

  private toOutstandingDto(round: SettlementRound, profileImagesByUserId?: Map<string, string | null>) {
    const dto = this.toDto(round, profileImagesByUserId);
    const participants = dto.participants.filter((participant) => !participant.paid);
    return { ...dto, totalAmount: participants.reduce((sum, participant) => sum + participant.amount, 0), participants };
  }

  private async finalizeExpiredRounds(bandId?: string) {
    const expired = await this.rounds.find({
      where: {
        ...(bandId ? { bandId } : {}),
        status: 'active',
        deadlineAt: LessThanOrEqual(new Date()),
      },
    });
    for (const candidate of expired) {
      await this.dataSource.transaction(async (manager) => {
        const repository = manager.getRepository(SettlementRound);
        const round = await repository.findOne({ where: { id: candidate.id }, lock: { mode: 'pessimistic_write' } });
        if (!round || round.status !== 'active' || round.deadlineAt.getTime() > Date.now()) return;
        if (round.participants.every((participant) => participant.paid)) {
          round.status = 'completed';
          round.completedAt = new Date();
        } else {
          round.status = 'outstanding';
        }
        await repository.save(round);
      });
    }
  }
}
