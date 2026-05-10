import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BandsService } from '../bands/bands.service';
import { ScheduleAvailabilityType } from '../common/enums';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import {
  CreateScheduleProposalDto,
  CreateScheduleSlotDto,
  UpsertAvailabilityDto,
  VoteScheduleProposalDto,
} from './dto';
import { ScheduleAvailability } from './schedule-availability.entity';
import { ScheduleProposalVote } from './schedule-proposal-vote.entity';
import { ScheduleProposal } from './schedule-proposal.entity';
import { ScheduleSlot } from './schedule-slot.entity';

@Injectable()
export class ScheduleService {
  constructor(
    @InjectRepository(ScheduleSlot)
    private readonly slotsRepository: Repository<ScheduleSlot>,
    @InjectRepository(ScheduleAvailability)
    private readonly availabilityRepository: Repository<ScheduleAvailability>,
    @InjectRepository(ScheduleProposal)
    private readonly proposalsRepository: Repository<ScheduleProposal>,
    @InjectRepository(ScheduleProposalVote)
    private readonly proposalVotesRepository: Repository<ScheduleProposalVote>,
    private readonly bandsService: BandsService,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
  ) {}

  async getSlots(userId: string, bandId: string) {
    await this.bandsService.requireMembership(userId, bandId);
    const slots = await this.slotsRepository.find({
      where: { band: { id: bandId } },
      order: { date: 'ASC', startTime: 'ASC' },
    });

    return Promise.all(
      slots.map(async (slot) => {
        const items = await this.availabilityRepository.find({ where: { slot: { id: slot.id } } });
        const mine = items.find((item) => item.user.id === userId);
        return {
          id: slot.id,
          date: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          yesCount: items.filter((item) => item.availability === ScheduleAvailabilityType.YES).length,
          noCount: items.filter((item) => item.availability === ScheduleAvailabilityType.NO).length,
          myAvailability: mine?.availability ?? null,
        };
      }),
    );
  }

  async createSlot(userId: string, bandId: string, dto: CreateScheduleSlotDto) {
    const membership = await this.bandsService.requireMembership(userId, bandId);
    const date = dto.date.slice(0, 10);
    let slot = await this.slotsRepository.findOne({
      where: {
        band: { id: bandId },
        date,
        startTime: dto.startTime,
        endTime: dto.endTime,
      },
    });

    slot ??= await this.slotsRepository.save(
      this.slotsRepository.create({
        band: membership.band,
        createdByUser: membership.user,
        date,
        startTime: dto.startTime,
        endTime: dto.endTime,
      }),
    );

    const existing = await this.availabilityRepository.findOne({
      where: { slot: { id: slot.id }, user: { id: userId } },
    });

    await this.availabilityRepository.save(
      this.availabilityRepository.create({
        id: existing?.id,
        slot,
        user: membership.user,
        availability: ScheduleAvailabilityType.YES,
      }),
    );

    return slot;
  }

  async upsertAvailability(userId: string, bandId: string, dto: UpsertAvailabilityDto) {
    await this.bandsService.requireMembership(userId, bandId);
    const slot = await this.slotsRepository.findOne({
      where: { id: dto.slotId },
      relations: ['band'],
    });
    if (!slot || slot.band.id !== bandId) {
      throw new NotFoundException('일정 후보를 찾을 수 없습니다.');
    }

    const user = await this.usersService.findById(userId);
    const existing = await this.availabilityRepository.findOne({
      where: { slot: { id: slot.id }, user: { id: userId } },
    });

    return this.availabilityRepository.save(
      this.availabilityRepository.create({
        id: existing?.id,
        slot,
        user: user!,
        availability: dto.availability,
      }),
    );
  }

  async getSummary(userId: string, bandId: string) {
    const members = await this.bandsService.getMembers(userId, bandId);
    const slots = await this.getSlots(userId, bandId);
    const currentUserName = members.find((member) => member.userId === userId)?.name;

    const summaries = await Promise.all(
      slots.map(async (slot) => {
        const items = await this.availabilityRepository.find({ where: { slot: { id: slot.id } } });
        const unavailableMemberNames = members
          .filter((member) => {
            const hit = items.find((item) => item.user.id === member.userId);
            return !hit || hit.availability === ScheduleAvailabilityType.NO;
          })
          .map((member) => member.name);
        const allAvailable = unavailableMemberNames.length === 0 && members.length > 0;
        const availableCount = members.length - unavailableMemberNames.length;
        const message = allAvailable
          ? '모두가 가능한 시간대예요'
          : unavailableMemberNames.includes(currentUserName ?? '')
            ? '내가 불가능한 시간대예요'
            : `${unavailableMemberNames.join(', ')}를 제외하고 가능한 시간대예요`;

        return {
          slotId: slot.id,
          date: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          allAvailable,
          availableCount,
          unavailableMemberNames,
          message,
        };
      }),
    );

    return summaries.sort((a, b) => {
      if (Number(b.allAvailable) !== Number(a.allAvailable)) {
        return Number(b.allAvailable) - Number(a.allAvailable);
      }
      if (b.availableCount !== a.availableCount) {
        return b.availableCount - a.availableCount;
      }
      return `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`);
    });
  }

  async createProposal(userId: string, bandId: string, dto: CreateScheduleProposalDto) {
    const membership = await this.bandsService.requireMembership(userId, bandId);

    const existingActive = await this.proposalsRepository.findOne({
      where: { band: { id: bandId }, active: true },
    });

    if (existingActive) {
      existingActive.active = false;
      existingActive.endedAt = new Date();
      await this.proposalsRepository.save(existingActive);
    }

    const proposal = await this.proposalsRepository.save(
      this.proposalsRepository.create({
        band: membership.band,
        createdByUser: membership.user,
        date: dto.date.slice(0, 10),
        startTime: dto.startTime,
        endTime: dto.endTime,
        active: true,
        confirmed: false,
        endedAt: null,
      }),
    );
    await this.notificationsService.notifyBandMembers(
      bandId,
      {
        title: membership.band.name,
        body: '합주 시간 투표가 열렸어요. 가능한지 확인해 주세요.',
        data: { type: 'schedule_vote', bandId, proposalId: proposal.id },
      },
    );
    return proposal;
  }

  async voteProposal(userId: string, bandId: string, dto: VoteScheduleProposalDto) {
    await this.bandsService.requireMembership(userId, bandId);
    const proposal = await this.proposalsRepository.findOne({
      where: { id: dto.proposalId },
      relations: ['band'],
    });

    if (!proposal || proposal.band.id !== bandId || !proposal.active) {
      throw new NotFoundException('진행 중인 일정 제안을 찾을 수 없습니다.');
    }

    const user = await this.usersService.findById(userId);
    const existing = await this.proposalVotesRepository.findOne({
      where: { proposal: { id: proposal.id }, user: { id: userId } },
    });

    if (existing) {
      throw new BadRequestException('찬반 응답은 한 번만 제출할 수 있습니다.');
    }

    const savedVote = await this.proposalVotesRepository.save(
      this.proposalVotesRepository.create({
        proposal,
        user: user!,
        availability: dto.availability,
      }),
    );

    const members = await this.bandsService.getMembers(userId, bandId);
    const votes = await this.proposalVotesRepository.find({
      where: { proposal: { id: proposal.id } },
    });
    const yesCount = votes.filter((vote) => vote.availability === ScheduleAvailabilityType.YES).length;
    if (yesCount === members.length && members.length > 0) {
      proposal.active = false;
      proposal.confirmed = true;
      proposal.endedAt = new Date();
      await this.proposalsRepository.save(proposal);
    }

    return savedVote;
  }

  async finalizeProposal(userId: string, bandId: string) {
    await this.bandsService.requireLeader(userId, bandId);
    const members = await this.bandsService.getMembers(userId, bandId);
    const proposal = await this.proposalsRepository.findOne({
      where: { band: { id: bandId }, active: true },
      relations: ['votes', 'votes.user'],
      order: { createdAt: 'DESC' },
    });

    if (!proposal) {
      throw new NotFoundException('진행 중인 일정 제안을 찾을 수 없습니다.');
    }

    const yesCount = proposal.votes.filter((vote) => vote.availability === ScheduleAvailabilityType.YES).length;
    proposal.active = false;
    proposal.confirmed = yesCount === members.length && members.length > 0;
    proposal.endedAt = new Date();

    await this.proposalsRepository.save(proposal);
    return this.getProposal(userId, bandId);
  }

  async getProposal(userId: string, bandId: string) {
    const members = await this.bandsService.getMembers(userId, bandId);
    const proposal = await this.proposalsRepository.findOne({
      where: { band: { id: bandId } },
      relations: ['votes', 'votes.user'],
      order: { createdAt: 'DESC' },
    });

    if (!proposal) {
      return null;
    }

    const myVote = proposal.votes.find((vote) => vote.user.id === userId);
    const yesCount = proposal.votes.filter((vote) => vote.availability === ScheduleAvailabilityType.YES).length;
    const noCount = proposal.votes.filter((vote) => vote.availability === ScheduleAvailabilityType.NO).length;
    const noNames = proposal.votes
      .filter((vote) => vote.availability === ScheduleAvailabilityType.NO)
      .map((vote) => vote.user.name);
    const currentUserName = members.find((member) => member.userId === userId)?.name;
    const allAgreed = yesCount === members.length && members.length > 0;
    const confirmed = proposal.confirmed || (proposal.active && allAgreed);
    const message = confirmed
      ? '모두가 찬성한 합주 시간이에요'
      : !proposal.active
        ? '찬반투표가 종료되었지만 모두 찬성하지 않아 확정되지 않았어요'
        : noNames.includes(currentUserName ?? '')
          ? '내가 불가능한 시간대예요'
          : noNames.length > 0
            ? `${noNames.join(', ')}를 제외하고 가능한 시간대예요`
            : '아직 모든 멤버의 응답이 모이지 않았어요';

    return {
      id: proposal.id,
      date: proposal.date,
      startTime: proposal.startTime,
      endTime: proposal.endTime,
      active: proposal.active,
      yesCount,
      noCount,
      myAvailability: myVote?.availability ?? null,
      allAgreed,
      confirmed,
      message,
    };
  }
}
