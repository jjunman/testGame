import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LEADER_START_POINTS, MEMBER_START_POINTS } from '../common/constants';
import { MemberRole, PositionType, PracticeAssignmentStatus, SongRoundStatus } from '../common/enums';
import { PracticeAssignment } from '../practice/practice-assignment.entity';
import { ScheduleAvailability } from '../schedule/schedule-availability.entity';
import { ScheduleProposal } from '../schedule/schedule-proposal.entity';
import { ScheduleSlot } from '../schedule/schedule-slot.entity';
import { SongCandidate } from '../songs/song-candidate.entity';
import { SongRound } from '../songs/song-round.entity';
import { StudioCandidate } from '../studios/studio-candidate.entity';
import { User } from '../users/user.entity';
import { BandMember } from './band-member.entity';
import { Band } from './band.entity';
import { CreateBandDto, JoinBandDto } from './dto';

@Injectable()
export class BandsService {
  constructor(
    @InjectRepository(Band)
    private readonly bandsRepository: Repository<Band>,
    @InjectRepository(BandMember)
    private readonly membersRepository: Repository<BandMember>,
    @InjectRepository(SongRound)
    private readonly roundsRepository: Repository<SongRound>,
    @InjectRepository(SongCandidate)
    private readonly candidatesRepository: Repository<SongCandidate>,
    @InjectRepository(PracticeAssignment)
    private readonly practiceRepository: Repository<PracticeAssignment>,
    @InjectRepository(ScheduleSlot)
    private readonly slotsRepository: Repository<ScheduleSlot>,
    @InjectRepository(ScheduleAvailability)
    private readonly availabilityRepository: Repository<ScheduleAvailability>,
    @InjectRepository(ScheduleProposal)
    private readonly scheduleProposalsRepository: Repository<ScheduleProposal>,
    @InjectRepository(StudioCandidate)
    private readonly studioCandidatesRepository: Repository<StudioCandidate>,
  ) {}

  async createBand(user: User, dto: CreateBandDto, thumbnailUrl?: string) {
    this.validatePosition(dto.positionType, dto.customPosition);

    const inviteCode = this.generateInviteCode();
    const band = await this.bandsRepository.save(
      this.bandsRepository.create({
        name: dto.name,
        thumbnailUrl: thumbnailUrl ?? dto.thumbnailUrl ?? null,
        inviteCode,
        owner: user,
      }),
    );

    await this.membersRepository.save(
      this.membersRepository.create({
        band,
        user,
        role: MemberRole.LEADER,
        positionType: dto.positionType,
        customPosition: dto.customPosition ?? null,
        volumePoints: LEADER_START_POINTS,
      }),
    );

    await this.roundsRepository.save(
      this.roundsRepository.create({
        band,
        status: SongRoundStatus.POSTED,
        createdByUser: user,
      }),
    );

    return band;
  }

  async joinBand(user: User, dto: JoinBandDto) {
    this.validatePosition(dto.positionType, dto.customPosition);
    const band = await this.bandsRepository.findOne({ where: { inviteCode: dto.inviteCode.trim().toUpperCase() } });
    if (!band) {
      throw new NotFoundException('초대코드에 해당하는 밴드를 찾을 수 없습니다.');
    }

    const existing = await this.membersRepository.findOne({
      where: { band: { id: band.id }, user: { id: user.id } },
    });
    if (existing) {
      throw new BadRequestException('이미 가입한 밴드입니다.');
    }

    await this.membersRepository.save(
      this.membersRepository.create({
        band,
        user,
        role: MemberRole.MEMBER,
        positionType: dto.positionType,
        customPosition: dto.customPosition ?? null,
        volumePoints: MEMBER_START_POINTS,
      }),
    );

    return band;
  }

  async leaveBand(userId: string, bandId: string) {
    const membership = await this.requireMembership(userId, bandId);
    if (membership.role === MemberRole.LEADER) {
      throw new BadRequestException('리더는 밴드 탈퇴 대신 밴드 삭제하기를 사용해 주세요.');
    }

    await this.membersRepository.delete({ id: membership.id });
    return { bandId, left: true };
  }

  async deleteBand(userId: string, bandId: string) {
    const membership = await this.requireLeader(userId, bandId);
    await this.bandsRepository.delete({ id: membership.band.id });
    return { bandId, deleted: true };
  }

  async transferLeader(userId: string, bandId: string, targetUserId: string) {
    const currentLeader = await this.requireLeader(userId, bandId);
    if (userId === targetUserId) {
      throw new BadRequestException('이미 리더인 멤버입니다.');
    }

    const targetMembership = await this.membersRepository.findOne({
      where: { band: { id: bandId }, user: { id: targetUserId } },
      relations: ['band', 'user'],
    });

    if (!targetMembership) {
      throw new NotFoundException('해당 멤버를 찾을 수 없습니다.');
    }

    currentLeader.role = MemberRole.MEMBER;
    targetMembership.role = MemberRole.LEADER;

    await this.membersRepository.save([currentLeader, targetMembership]);
    return { bandId, leaderUserId: targetUserId };
  }

  async listBands(userId: string) {
    const memberships = await this.membersRepository.find({
      where: { user: { id: userId } },
      relations: ['band'],
      order: { joinedAt: 'DESC' },
    });

    return Promise.all(
      memberships.map(async (membership) => ({
        id: membership.band.id,
        name: membership.band.name,
        thumbnailUrl: membership.band.thumbnailUrl,
        inviteCode: membership.band.inviteCode,
        myRole: membership.role,
        myPosition: this.positionLabel(membership.positionType, membership.customPosition),
        memberCount: await this.membersRepository.count({
          where: { band: { id: membership.band.id } },
        }),
      })),
    );
  }

  async getBandDetail(userId: string, bandId: string) {
    const membership = await this.requireMembership(userId, bandId);
    const latestRound = await this.roundsRepository.findOne({
      where: { band: { id: bandId } },
      order: { createdAt: 'DESC' },
      relations: ['finalCandidate', 'finalCandidate.songCatalog'],
    });

    const completedRounds = await this.roundsRepository.find({
      where: { band: { id: bandId }, status: SongRoundStatus.DONE },
      relations: ['finalCandidate', 'finalCandidate.songCatalog'],
      order: { updatedAt: 'DESC' },
      take: 6,
    });

    const practiceAssignments = await this.practiceRepository.find({
      where: { band: { id: bandId } },
      relations: ['songCandidate'],
      order: { dueAt: 'DESC' },
    });

    const latestAssignmentByCandidateId = new Map<string, PracticeAssignment>();
    for (const assignment of practiceAssignments) {
      const candidateId = assignment.songCandidate?.id;
      if (candidateId && !latestAssignmentByCandidateId.has(candidateId)) {
        latestAssignmentByCandidateId.set(candidateId, assignment);
      }
    }

    const songCards: Array<{
      id: string;
      title: string;
      artist: string;
      thumbnailUrl: string | null;
      practiceAssignmentId?: string | null;
      practiceDueAt?: string | null;
      kind: 'song' | 'picking';
    }> = completedRounds
      .filter((round) => round.finalCandidate?.songCatalog)
      .map((round) => {
        const practiceAssignment = latestAssignmentByCandidateId.get(round.finalCandidate!.id);

        return {
        id: round.finalCandidate!.id,
        title: round.finalCandidate!.songCatalog.title,
        artist: round.finalCandidate!.songCatalog.artist,
        thumbnailUrl: round.finalCandidate!.songCatalog.youtubeVideoId
          ? `https://img.youtube.com/vi/${round.finalCandidate!.songCatalog.youtubeVideoId}/hqdefault.jpg`
          : null,
        practiceAssignmentId: practiceAssignment?.id ?? null,
        practiceDueAt: practiceAssignment?.dueAt?.toISOString() ?? null,
        kind: 'song' as const,
      };
      });

    if (latestRound && latestRound.status === SongRoundStatus.VOTING) {
      songCards.unshift({
        id: `round-${latestRound.id}`,
        title: '합주곡 정하기 진행중',
        artist: '투표 단계',
        thumbnailUrl: membership.band.thumbnailUrl,
        practiceAssignmentId: null,
        practiceDueAt: latestRound.votingDeadlineAt?.toISOString() ?? null,
        kind: 'picking' as const,
      });
    }

    return {
      id: membership.band.id,
      name: membership.band.name,
      thumbnailUrl: membership.band.thumbnailUrl,
      inviteCode: membership.band.inviteCode,
      myMembership: {
        role: membership.role,
        positionLabel: this.positionLabel(membership.positionType, membership.customPosition),
        volumePoints: membership.volumePoints,
      },
      activeSongRound: latestRound
        ? {
            id: latestRound.id,
            status: latestRound.status,
            finalCandidateId: latestRound.finalCandidate?.id ?? null,
          }
        : null,
      openPracticeCount: await this.practiceRepository.count({
        where: { band: { id: bandId } },
      }),
      openScheduleSlotCount: await this.slotsRepository.count({
        where: { band: { id: bandId } },
      }),
        todos: await this.getTodos(userId, bandId),
        voteSummary: await this.getVoteSummary(userId, bandId),
        songCards,
      };
  }

  async getMembers(userId: string, bandId: string) {
    await this.requireMembership(userId, bandId);
    const members = await this.membersRepository.find({
      where: { band: { id: bandId } },
      order: { joinedAt: 'ASC' },
    });

    return members.map((member) => ({
      userId: member.user.id,
      name: member.user.name,
      role: member.role,
      positionLabel: this.positionLabel(member.positionType, member.customPosition),
      volumePoints: member.volumePoints,
      joinedAt: member.joinedAt.toISOString(),
    }));
  }

  async getPoints(userId: string, bandId: string) {
    return this.getMembers(userId, bandId);
  }

  async getTodos(userId: string, bandId: string) {
    const membership = await this.requireMembership(userId, bandId);
    const todos = [];

    const votingRound = await this.roundsRepository.findOne({
      where: { band: { id: bandId }, status: SongRoundStatus.VOTING },
      order: { createdAt: 'DESC' },
    });

    if (votingRound) {
      todos.push({
        type: 'vote_song',
        title: '합주곡 투표하기',
        description: '후보 곡 중 최대 2곡을 골라 제출해 주세요.',
        dueLabel: '투표 진행중',
        shortcut: 'song_round',
      });
    }

    const activeProposal = await this.scheduleProposalsRepository.findOne({
      where: { band: { id: bandId }, active: true },
      relations: ['votes', 'votes.user'],
      order: { createdAt: 'DESC' },
    });
    if (activeProposal && !activeProposal.votes?.some((vote) => vote.user.id === userId)) {
      todos.push({
        type: 'vote_schedule_proposal',
        title: '합주 시간 투표하기',
        description: '제안된 합주 시간이 괜찮은지 찬성 또는 반대로 응답해 주세요.',
        dueLabel: '찬반투표 진행중',
        shortcut: 'schedule',
      });
    }

    const studioCandidates = await this.studioCandidatesRepository.find({
      where: { band: { id: bandId }, status: 'open' },
      relations: ['votes', 'votes.user'],
      order: { createdAt: 'ASC' },
    });
    const activeStudioCandidates = studioCandidates.filter((candidate) => !this.isStudioVoteClosed(candidate));
    if (
      activeStudioCandidates.length > 0 &&
      !activeStudioCandidates.some((candidate) => candidate.votes?.some((vote) => vote.user.id === userId))
    ) {
      todos.push({
        type: 'vote_studio',
        title: '합주실 투표하기',
        description: '부원들이 올린 합주실 후보 중 하나를 선택해 주세요.',
        dueLabel: '투표 진행중',
        shortcut: 'studio',
      });
    }

    const openPracticeCount = await this.practiceRepository
      .createQueryBuilder('assignment')
      .leftJoin('assignment.submissions', 'submission', 'submission.userId = :userId', { userId })
      .where('assignment.bandId = :bandId', { bandId })
      .andWhere('assignment.status = :status', { status: PracticeAssignmentStatus.OPEN })
      .andWhere('assignment.dueAt >= :now', { now: new Date() })
      .andWhere('assignment.dueAt >= :joinedAt', { joinedAt: membership.joinedAt })
      .andWhere('submission.id IS NULL')
      .getCount();

    if (openPracticeCount > 0) {
      todos.push({
        type: 'submit_practice',
        title: '연습 제출하기',
        description: '마감 전까지 녹음본을 제출해 주세요.',
        dueLabel: '가능한 빨리',
        shortcut: 'practice',
      });
    }

    const hasSubmittedSchedule = (await this.availabilityRepository.count({
      where: { slot: { band: { id: bandId } }, user: { id: userId } },
    })) > 0;

    if (!hasSubmittedSchedule) {
      todos.push({
        type: 'submit_schedule',
        title: '일정 등록하기',
        description: '가능한 합주 시간대를 입력해 주세요.',
        dueLabel: '지금 가능',
        shortcut: 'schedule',
      });
    }

    return todos;
  }

  private async getVoteSummary(userId: string, bandId: string) {
    const activeSongRounds = await this.roundsRepository.find({
      where: { band: { id: bandId }, status: SongRoundStatus.VOTING },
      relations: ['candidates', 'candidates.votes', 'candidates.votes.user'],
      order: { createdAt: 'DESC' },
    });
    const completedSongRound = activeSongRounds.length === 0
      ? await this.roundsRepository.findOne({
          where: { band: { id: bandId }, status: SongRoundStatus.DONE },
          order: { createdAt: 'DESC' },
        })
      : null;
    const song = activeSongRounds.length > 0
      ? 'needed'
      : completedSongRound
        ? 'done'
        : 'none';

    const activeProposal = await this.scheduleProposalsRepository.findOne({
      where: { band: { id: bandId }, active: true },
      relations: ['votes', 'votes.user'],
      order: { createdAt: 'DESC' },
    });
    const confirmedProposal = activeProposal
      ? null
      : await this.scheduleProposalsRepository.findOne({
          where: { band: { id: bandId }, active: false, confirmed: true },
          order: { createdAt: 'DESC' },
        });
    const schedule = activeProposal
      ? 'needed'
      : confirmedProposal
        ? 'done'
        : 'none';

    const studioCandidates = await this.studioCandidatesRepository.find({
      where: { band: { id: bandId } },
      relations: ['votes', 'votes.user'],
      order: { createdAt: 'ASC' },
    });
    const confirmedStudio = studioCandidates.some((candidate) => candidate.status === 'confirmed');
    const openStudioCandidates = studioCandidates.filter((candidate) => candidate.status === 'open' && !this.isStudioVoteClosed(candidate));
    const studio = confirmedStudio
      ? 'done'
      : openStudioCandidates.length === 0
        ? 'none'
        : 'needed';

    return { song, schedule, studio };
  }

  private isStudioVoteClosed(candidate: StudioCandidate) {
    return candidate.voteDeadlineAt !== null && candidate.voteDeadlineAt.getTime() < Date.now();
  }

  async requireMembership(userId: string, bandId: string) {
    const membership = await this.membersRepository.findOne({
      where: { band: { id: bandId }, user: { id: userId } },
      relations: ['band', 'user'],
    });
    if (!membership) {
      throw new ForbiddenException('밴드 멤버만 접근할 수 있습니다.');
    }
    return membership;
  }

  async requireLeader(userId: string, bandId: string) {
    const membership = await this.requireMembership(userId, bandId);
    if (membership.role !== MemberRole.LEADER) {
      throw new ForbiddenException('리더만 수행할 수 있습니다.');
    }
    return membership;
  }

  private generateInviteCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  private validatePosition(positionType: PositionType, customPosition?: string) {
    if (positionType === PositionType.CUSTOM && !customPosition) {
      throw new BadRequestException('직접 입력 포지션을 작성해 주세요.');
    }
  }

  private positionLabel(positionType: PositionType, customPosition: string | null) {
    const labels = {
      lead_guitar: '리드기타',
      sub_guitar: '서브기타',
      bass: '베이스',
      drums: '드럼',
      piano: '피아노',
      vocal: '보컬',
    } as const;

    return positionType === PositionType.CUSTOM ? customPosition ?? '직접 입력' : labels[positionType];
  }
}
