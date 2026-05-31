import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BandMember } from '../bands/band-member.entity';
import { MAX_VOTES_PER_USER } from '../common/constants';
import { SongRoundStatus } from '../common/enums';
import { BandsService } from '../bands/bands.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PracticeAssignment } from '../practice/practice-assignment.entity';
import { UsersService } from '../users/users.service';
import { CreateSongCandidateDto, UpdateSongCandidateDto, UpdateSongRoundStatusDto } from './dto';
import { SongCandidate } from './song-candidate.entity';
import { SongCatalog } from './song-catalog.entity';
import { SongRound } from './song-round.entity';
import { SongVote } from './song-vote.entity';

const DEFAULT_SONG_VOTE_DAYS = 7;

@Injectable()
export class SongsService {
  constructor(
    @InjectRepository(SongCatalog)
    private readonly catalogRepository: Repository<SongCatalog>,
    @InjectRepository(SongRound)
    private readonly roundsRepository: Repository<SongRound>,
    @InjectRepository(SongCandidate)
    private readonly candidatesRepository: Repository<SongCandidate>,
    @InjectRepository(SongVote)
    private readonly votesRepository: Repository<SongVote>,
    @InjectRepository(BandMember)
    private readonly membersRepository: Repository<BandMember>,
    @InjectRepository(PracticeAssignment)
    private readonly practiceAssignmentsRepository: Repository<PracticeAssignment>,
    private readonly bandsService: BandsService,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
  ) {}

  async getCurrentRound(userId: string, bandId: string) {
    const membership = await this.bandsService.requireMembership(userId, bandId);
    const round = await this.getLatestRoundForDisplay(bandId);
    if (!round) {
      return null;
    }

    const candidates = await this.candidatesRepository.find({
      where: { round: { id: round.id } },
      relations: ['votes', 'votes.user'],
    });
    const members = await this.membersRepository.find({
      where: { band: { id: bandId } },
    });
    const availableInstruments = new Set(
      members.flatMap((member) => this.normalizePosition(member.positionType, member.customPosition)),
    );

    return {
      id: round.id,
      status: round.status,
      finalCandidateId: round.finalCandidate?.id ?? null,
      myRole: membership.role,
      votingDeadlineAt: round.votingDeadlineAt?.toISOString() ?? null,
      candidates: candidates.map((candidate) => ({
        id: candidate.id,
        songCatalogId: candidate.songCatalog.id,
        title: candidate.songCatalog.title,
        artist: candidate.songCatalog.artist,
        youtubeVideoId: candidate.songCatalog.youtubeVideoId,
        thumbnailUrl: this.toYouTubeThumbnailUrl(candidate.songCatalog.youtubeVideoId),
        difficulty: candidate.songCatalog.difficulty,
        requiredInstruments: candidate.songCatalog.requiredInstruments ?? [],
        voteCount: candidate.votes?.length ?? 0,
        didVote: candidate.votes?.some((vote) => vote.user.id === userId) ?? false,
        createdByUserId: candidate.createdByUser.id,
        missingInstruments: this.findMissingInstruments(
          candidate.songCatalog.requiredInstruments ?? [],
          availableInstruments,
        ),
        warningMessage: this.toInstrumentWarning(
          this.findMissingInstruments(candidate.songCatalog.requiredInstruments ?? [], availableInstruments),
        ),
      })),
    };
  }

  async addCandidate(userId: string, bandId: string, dto: CreateSongCandidateDto) {
    const membership = await this.bandsService.requireMembership(userId, bandId);
    const round = await this.getOrCreateVotingRound(membership);
    if (round.status === SongRoundStatus.DONE) {
      throw new BadRequestException('완료된 라운드에는 후보곡을 추가할 수 없습니다.');
    }

    const normalizedTitle = dto.title.trim().toLowerCase();
    const normalizedArtist = dto.artist.trim().toLowerCase();
    const existingCandidate = await this.candidatesRepository.find({
      where: { round: { id: round.id } },
      relations: ['songCatalog', 'createdByUser'],
    });

    const alreadySubmittedByUser = existingCandidate.some((candidate) => candidate.createdByUser.id === userId);
    if (alreadySubmittedByUser) {
      throw new BadRequestException('후보곡은 한 사람당 한 곡만 올릴 수 있습니다.');
    }

    const duplicated = existingCandidate.some(
      (candidate) =>
        candidate.songCatalog.title.trim().toLowerCase() === normalizedTitle &&
        candidate.songCatalog.artist.trim().toLowerCase() === normalizedArtist,
    );

    if (duplicated) {
      throw new BadRequestException('이미 추가된 곡입니다.');
    }

    const youtubeVideoId = this.extractYouTubeVideoId(dto.youtubeUrl);
    if (!youtubeVideoId) {
      throw new BadRequestException('유효한 유튜브 링크를 입력해 주세요.');
    }

    const user = await this.usersService.findById(userId);
    const catalog = await this.catalogRepository.save(
      this.catalogRepository.create({
        title: dto.title.trim(),
        artist: dto.artist.trim(),
        youtubeVideoId,
        difficulty: dto.difficulty ?? null,
        requiredInstruments: dto.requiredInstruments ?? [],
      }),
    );

    return this.candidatesRepository.save(
      this.candidatesRepository.create({
        round,
        songCatalog: catalog,
        createdByUser: user!,
      }),
    );
  }

  async deleteCandidate(userId: string, bandId: string, candidateId: string) {
    await this.bandsService.requireMembership(userId, bandId);
    const candidate = await this.candidatesRepository.findOne({
      where: { id: candidateId },
      relations: ['createdByUser', 'round', 'round.band', 'round.finalCandidate'],
    });

    if (!candidate || candidate.round.band.id !== bandId) {
      throw new NotFoundException('삭제할 노래를 찾을 수 없습니다.');
    }

    if (candidate.round.status !== SongRoundStatus.DONE && candidate.createdByUser.id !== userId) {
      throw new ForbiddenException('직접 올린 후보곡만 삭제할 수 있습니다.');
    }

    const linkedAssignments = await this.practiceAssignmentsRepository.find({
      where: { songCandidate: { id: candidateId } },
    });
    if (linkedAssignments.length > 0) {
      await this.practiceAssignmentsRepository.save(
        linkedAssignments.map((assignment) => ({
          ...assignment,
          songCandidate: null,
        })),
      );
    }

    if (candidate.round.finalCandidate?.id === candidate.id && candidate.round.status === SongRoundStatus.DONE) {
      await this.roundsRepository.remove(candidate.round);
      return { deleted: true, roundDeleted: true };
    }

    await this.candidatesRepository.remove(candidate);
    return { deleted: true, roundDeleted: false };
  }

  async updateCandidate(userId: string, bandId: string, candidateId: string, dto: UpdateSongCandidateDto) {
    await this.bandsService.requireMembership(userId, bandId);
    const candidate = await this.candidatesRepository.findOne({
      where: { id: candidateId },
      relations: ['round', 'round.band', 'songCatalog'],
    });

    if (!candidate || candidate.round.band.id !== bandId) {
      throw new NotFoundException('수정할 노래를 찾을 수 없습니다.');
    }

    const youtubeVideoId = this.extractYouTubeVideoId(dto.youtubeUrl);
    if (!youtubeVideoId) {
      throw new BadRequestException('유효한 유튜브 링크를 입력해 주세요.');
    }

    const normalizedTitle = dto.title.trim().toLowerCase();
    const normalizedArtist = dto.artist.trim().toLowerCase();
    const candidates = await this.candidatesRepository.find({
      where: { round: { id: candidate.round.id } },
      relations: ['songCatalog'],
    });
    const duplicated = candidates.some(
      (item) =>
        item.id !== candidate.id &&
        item.songCatalog.title.trim().toLowerCase() === normalizedTitle &&
        item.songCatalog.artist.trim().toLowerCase() === normalizedArtist,
    );

    if (duplicated) {
      throw new BadRequestException('이미 추가된 곡입니다.');
    }

    candidate.songCatalog.title = dto.title.trim();
    candidate.songCatalog.artist = dto.artist.trim();
    candidate.songCatalog.youtubeVideoId = youtubeVideoId;
    await this.catalogRepository.save(candidate.songCatalog);

    return {
      id: candidate.id,
      title: candidate.songCatalog.title,
      artist: candidate.songCatalog.artist,
      youtubeVideoId,
    };
  }

  async deleteActiveRound(userId: string, bandId: string) {
    await this.bandsService.requireMembership(userId, bandId);
    const round = await this.roundsRepository.findOne({
      where: [
        { band: { id: bandId }, status: SongRoundStatus.VOTING },
        { band: { id: bandId }, status: SongRoundStatus.POSTED },
      ],
      relations: ['band'],
      order: { updatedAt: 'DESC' },
    });

    if (!round) {
      throw new NotFoundException('삭제할 곡 투표를 찾을 수 없습니다.');
    }

    await this.roundsRepository.remove(round);
    return { deleted: true };
  }

  async startRound(userId: string, bandId: string, deadlineAt: string) {
    const membership = await this.bandsService.requireMembership(userId, bandId);
    const existingRound = await this.getActiveRound(bandId);

    if (existingRound?.status === SongRoundStatus.VOTING) {
      throw new BadRequestException('이미 진행 중인 합주곡 투표가 있습니다.');
    }

    if (existingRound?.status === SongRoundStatus.POSTED) {
      existingRound.status = SongRoundStatus.VOTING;
      existingRound.votingDeadlineAt = new Date(deadlineAt);
      const savedRound = await this.roundsRepository.save(existingRound);
      await this.notificationsService.notifyBandMembers(
        bandId,
        {
          title: membership.band.name,
          body: '합주곡 투표가 열렸어요. 후보곡을 골라 주세요.',
          data: { type: 'song_vote', bandId, roundId: savedRound.id },
        },
      );
      return savedRound;
    }

    const savedRound = await this.roundsRepository.save(
      this.roundsRepository.create({
        band: membership.band,
        status: SongRoundStatus.VOTING,
        createdByUser: membership.user,
        votingDeadlineAt: new Date(deadlineAt),
      }),
    );
    await this.notificationsService.notifyBandMembers(
      bandId,
      {
        title: membership.band.name,
        body: '합주곡 투표가 열렸어요. 후보곡을 골라 주세요.',
        data: { type: 'song_vote', bandId, roundId: savedRound.id },
      },
    );
    return savedRound;
  }

  async updateRoundStatus(userId: string, bandId: string, dto: UpdateSongRoundStatusDto) {
    await this.bandsService.requireLeader(userId, bandId);
    if (dto.status === SongRoundStatus.DONE) {
      return this.finalize(userId, bandId);
    }

    const round = await this.getActiveRoundOrThrow(bandId);
    round.status = dto.status;
    return this.roundsRepository.save(round);
  }

  async vote(userId: string, bandId: string, candidateId: string) {
    await this.bandsService.requireMembership(userId, bandId);
    const candidate = await this.candidatesRepository.findOne({
      where: { id: candidateId },
      relations: ['round', 'round.band'],
    });
    if (!candidate || candidate.round.band.id !== bandId) {
      throw new NotFoundException('곡 후보를 찾을 수 없습니다.');
    }
    if (candidate.round.status !== SongRoundStatus.VOTING) {
      throw new BadRequestException('투표 단계에서만 투표할 수 있습니다.');
    }

    const count = await this.votesRepository.count({
      where: { user: { id: userId }, candidate: { round: { id: candidate.round.id } } },
    });
    if (count >= MAX_VOTES_PER_USER) {
      throw new BadRequestException(`최대 ${MAX_VOTES_PER_USER}곡까지 투표할 수 있습니다.`);
    }

    const existing = await this.votesRepository.findOne({
      where: { user: { id: userId }, candidate: { id: candidateId } },
    });
    if (existing) {
      throw new BadRequestException('이미 투표한 곡입니다.');
    }

    const user = await this.usersService.findById(userId);
    return this.votesRepository.save(
      this.votesRepository.create({
        candidate,
        user: user!,
      }),
    );
  }

  async unvote(userId: string, bandId: string, candidateId: string) {
    await this.bandsService.requireMembership(userId, bandId);
    const vote = await this.votesRepository.findOne({
      where: { user: { id: userId }, candidate: { id: candidateId } },
      relations: ['candidate', 'candidate.round', 'candidate.round.band'],
    });
    if (!vote || vote.candidate.round.band.id !== bandId) {
      throw new NotFoundException('투표 정보를 찾을 수 없습니다.');
    }
    if (vote.candidate.round.status !== SongRoundStatus.VOTING) {
      throw new BadRequestException('투표 단계에서만 취소할 수 있습니다.');
    }

    await this.votesRepository.remove(vote);
    return { deleted: true };
  }

  async finalize(userId: string, bandId: string) {
    await this.bandsService.requireLeader(userId, bandId);
    const members = await this.bandsService.getMembers(userId, bandId);
    const memberByUserId = new Map(members.map((member) => [member.userId, member]));
    const round = await this.getActiveRoundOrThrow(bandId);
    const candidates = await this.candidatesRepository.find({
      where: { round: { id: round.id } },
      relations: ['votes', 'votes.user'],
    });
    if (candidates.length === 0) {
      throw new BadRequestException('확정할 곡 후보가 없습니다.');
    }

    const ranked = await Promise.all(
      candidates.map(async (candidate) => {
        const voters = (candidate.votes ?? [])
          .map((vote) => memberByUserId.get(vote.user.id))
          .filter((member): member is NonNullable<typeof member> => Boolean(member));
        return {
          candidate,
          voteCount: voters.length,
          pointSum: voters.reduce((sum, member) => sum + member.volumePoints, 0),
          highestVoterPoint: voters.reduce((max, member) => Math.max(max, member.volumePoints), 0),
        };
      }),
    );

    ranked.sort((a, b) => {
      if (b.pointSum !== a.pointSum) {
        return b.pointSum - a.pointSum;
      }
      if (b.highestVoterPoint !== a.highestVoterPoint) {
        return b.highestVoterPoint - a.highestVoterPoint;
      }
      return b.voteCount - a.voteCount;
    });

    round.finalCandidate = ranked[0].candidate;
    round.status = SongRoundStatus.DONE;
    return this.roundsRepository.save(round);
  }

  async createNextRound(userId: string, bandId: string) {
    const membership = await this.bandsService.requireMembership(userId, bandId);
    const open = await this.getActiveRound(bandId);
    if (open) {
      throw new BadRequestException('이미 진행 중인 곡 선정 라운드가 있습니다.');
    }
    return this.roundsRepository.save(
      this.roundsRepository.create({
        band: membership.band,
        status: SongRoundStatus.POSTED,
        createdByUser: membership.user,
        votingDeadlineAt: null,
      }),
    );
  }

  private getActiveRound(bandId: string) {
    return this.roundsRepository.findOne({
      where: [
        { band: { id: bandId }, status: SongRoundStatus.POSTED },
        { band: { id: bandId }, status: SongRoundStatus.VOTING },
      ],
      order: { createdAt: 'DESC' },
    });
  }

  private getLatestRoundForDisplay(bandId: string) {
    return this.roundsRepository.findOne({
      where: { band: { id: bandId } },
      order: { createdAt: 'DESC' },
    });
  }

  private async getActiveRoundOrThrow(bandId: string) {
    const round = await this.getActiveRound(bandId);
    if (!round) {
      throw new NotFoundException('진행 중인 곡 선정 라운드가 없습니다.');
    }
    return round;
  }

  private async getOrCreateVotingRound(membership: BandMember) {
    const existingRound = await this.getActiveRound(membership.band.id);
    if (existingRound?.status === SongRoundStatus.VOTING) {
      return existingRound;
    }

    const deadlineAt = this.getDefaultVotingDeadline();
    if (existingRound?.status === SongRoundStatus.POSTED) {
      existingRound.status = SongRoundStatus.VOTING;
      existingRound.votingDeadlineAt = deadlineAt;
      const savedRound = await this.roundsRepository.save(existingRound);
      await this.notifySongVoteStarted(membership, savedRound.id);
      return savedRound;
    }

    const savedRound = await this.roundsRepository.save(
      this.roundsRepository.create({
        band: membership.band,
        status: SongRoundStatus.VOTING,
        createdByUser: membership.user,
        votingDeadlineAt: deadlineAt,
      }),
    );
    await this.notifySongVoteStarted(membership, savedRound.id);
    return savedRound;
  }

  private getDefaultVotingDeadline() {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + DEFAULT_SONG_VOTE_DAYS);
    deadline.setHours(23, 59, 0, 0);
    return deadline;
  }

  private notifySongVoteStarted(membership: BandMember, roundId: string) {
    return this.notificationsService.notifyBandMembers(
      membership.band.id,
      {
        title: membership.band.name,
        body: '합주곡 투표가 열렸어요. 후보곡을 골라 주세요.',
        data: { type: 'song_vote', bandId: membership.band.id, roundId },
      },
    );
  }

  private toYouTubeThumbnailUrl(videoId?: string | null) {
    return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
  }

  private extractYouTubeVideoId(url: string) {
    const trimmed = url.trim();
    try {
      const parsed = new URL(trimmed);
      const host = parsed.hostname.replace(/^www\./, '');

      if (host === 'youtu.be') {
        return parsed.pathname.split('/').filter(Boolean)[0] ?? null;
      }

      if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
        if (parsed.pathname === '/watch') {
          return parsed.searchParams.get('v');
        }

        const parts = parsed.pathname.split('/').filter(Boolean);
        if (parts[0] === 'shorts' || parts[0] === 'embed' || parts[0] === 'live') {
          return parts[1] ?? null;
        }
      }
    } catch {
      return null;
    }

    return null;
  }

  private findMissingInstruments(requiredInstruments: string[], availableInstruments: Set<string>) {
    return requiredInstruments.filter((instrument) => {
      const normalized = this.normalizeInstrumentName(instrument);
      return normalized.length > 0 && !availableInstruments.has(normalized);
    });
  }

  private toInstrumentWarning(missingInstruments: string[]) {
    if (missingInstruments.length === 0) {
      return null;
    }

    return `우리 밴드에 없는 ${missingInstruments.join(', ')} 파트가 필요한 곡입니다!`;
  }

  private normalizePosition(positionType: string, customPosition: string | null) {
    if (positionType === 'lead_guitar') {
      return ['기타', '리드기타'].map((item) => this.normalizeInstrumentName(item));
    }
    if (positionType === 'sub_guitar') {
      return ['기타', '서브기타'].map((item) => this.normalizeInstrumentName(item));
    }
    if (positionType === 'bass') {
      return ['베이스'].map((item) => this.normalizeInstrumentName(item));
    }
    if (positionType === 'drums') {
      return ['드럼'].map((item) => this.normalizeInstrumentName(item));
    }
    if (positionType === 'piano') {
      return ['피아노', '키보드'].map((item) => this.normalizeInstrumentName(item));
    }
    if (positionType === 'vocal') {
      return ['보컬'].map((item) => this.normalizeInstrumentName(item));
    }

    return customPosition ? [this.normalizeInstrumentName(customPosition)] : [];
  }

  private normalizeInstrumentName(value: string) {
    return value.replace(/\s+/g, '').toLowerCase();
  }
}
