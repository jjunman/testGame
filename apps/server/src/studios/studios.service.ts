import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BandMember } from '../bands/band-member.entity';
import { BandsService } from '../bands/bands.service';
import { ScheduleProposal } from '../schedule/schedule-proposal.entity';
import { UsersService } from '../users/users.service';
import { findAnsanLocation } from './ansan-locations';
import { CreateStudioCandidateDto, SaveStudioLocationDto } from './dto';
import { StudioCandidate } from './studio-candidate.entity';
import { StudioVote } from './studio-vote.entity';
import { Studio } from './studio.entity';

const ANSAN_REGION = '안산';
const DEFAULT_EXPECTED_HOURS = 2;
const ANSAN_STUDIO_SOURCE_URLS = [
  'https://omnispiano.com/service/rooms/1286/%EC%BD%94%EC%A7%80%EC%97%B0%EC%8A%B5%EC%8B%A4/',
];
const APP_PROVIDED_ANSAN_STUDIOS = [
  {
    name: '코지연습실',
    address: '경기도 안산시 단원구 고잔동 631-1 3층 301호',
    latitude: 37.3187,
    longitude: 126.8295,
    phone: '01020945177',
    externalUrl: 'https://omnispiano.com/service/rooms/1286/%EC%BD%94%EC%A7%80%EC%97%B0%EC%8A%B5%EC%8B%A4/',
    sourceUrl: 'https://omnispiano.com/service/rooms/1286/%EC%BD%94%EC%A7%80%EC%97%B0%EC%8A%B5%EC%8B%A4/',
    hourlyPrice: 10000,
    priceNote: '옴니스피아노 기준 10,000원/시간. 최신 요금은 외부 링크에서 확인해 주세요.',
    amenitiesNote: '합주, 악기 연습, 안무, 음향시설, 냉난방, 휴게실',
  },
  {
    name: '본피아노 입시 스튜디오 연습실',
    address: '경기 안산시 단원구 고잔동 727-3',
    latitude: 37.3138,
    longitude: 126.8285,
    phone: '010-3601-6553',
    externalUrl: 'https://omnispiano.com/service/rooms/395/%EB%B3%B8%ED%94%BC%EC%95%84%EB%85%B8-%EC%9E%85%EC%8B%9C-%EC%8A%A4%ED%8A%9C%EB%94%94%EC%98%A4-%EC%97%B0%EC%8A%B5%EC%8B%A4/',
    sourceUrl: 'https://omnispiano.com/service/rooms/395/%EB%B3%B8%ED%94%BC%EC%95%84%EB%85%B8-%EC%9E%85%EC%8B%9C-%EC%8A%A4%ED%8A%9C%EB%94%94%EC%98%A4-%EC%97%B0%EC%8A%B5%EC%8B%A4/',
    hourlyPrice: 6000,
    priceNote: '업라이트 피아노방 6,000원/시간부터. 룸별 요금은 외부 링크에서 확인해 주세요.',
    amenitiesNote: 'WIFI, 정수기, 도어락, 냉난방, 주차, 앙상블, 레슨',
  },
  {
    name: '유앤미피아노',
    address: '경기도 안산시 상록구 성포동 747 3층 유앤미피아노',
    latitude: 37.3185,
    longitude: 126.8494,
    phone: null,
    externalUrl: 'https://omnispiano.com/service/rooms/714/%EC%9C%A0%EC%95%A4%EB%AF%B8%ED%94%BC%EC%95%84%EB%85%B8/',
    sourceUrl: 'https://omnispiano.com/service/rooms/714/%EC%9C%A0%EC%95%A4%EB%AF%B8%ED%94%BC%EC%95%84%EB%85%B8/',
    hourlyPrice: 5000,
    priceNote: '업라이트 피아노방 5,000원/시간. 최신 요금은 외부 링크에서 확인해 주세요.',
    amenitiesNote: 'WIFI, 냉난방, 프린터, 주차',
  },
  {
    name: '푸른별 피아노연습실',
    address: '경기도 안산시 상록구 사동 1410-2 2층',
    latitude: 37.2952,
    longitude: 126.8523,
    phone: '01088659301',
    externalUrl: 'https://omnispiano.com/service/rooms/1340/%ED%91%B8%EB%A5%B8%EB%B3%84-%ED%94%BC%EC%95%84%EB%85%B8%EC%97%B0%EC%8A%B5%EC%8B%A4/',
    sourceUrl: 'https://omnispiano.com/service/rooms/1340/%ED%91%B8%EB%A5%B8%EB%B3%84-%ED%94%BC%EC%95%84%EB%85%B8%EC%97%B0%EC%8A%B5%EC%8B%A4/',
    hourlyPrice: null,
    priceNote: '등록된 가격 없음. 이용 전 요금 확인이 필요합니다.',
    amenitiesNote: '피아노 연습실, 앙상블, 레슨, 주차, 냉난방, CCTV',
  },
  {
    name: '아트콤마스튜디오 합주실호수점',
    address: '경기 안산시 단원구 광덕서로 44 B1층 102호',
    latitude: 37.3097,
    longitude: 126.8307,
    phone: '0507-1380-2815',
    externalUrl: 'https://busk.co.kr/practice_rooms.php?id=246&mode=view&name=%EC%95%84%ED%8A%B8%EC%BD%A4%EB%A7%88%EC%8A%A4%ED%8A%9C%EB%94%94%EC%98%A4+%ED%95%A9%EC%A3%BC%EC%8B%A4%ED%98%B8%EC%88%98%EC%A0%90',
    sourceUrl: 'https://busk.co.kr/practice_rooms.php?id=246&mode=view&name=%EC%95%84%ED%8A%B8%EC%BD%A4%EB%A7%88%EC%8A%A4%ED%8A%9C%EB%94%94%EC%98%A4+%ED%95%A9%EC%A3%BC%EC%8B%A4%ED%98%B8%EC%88%98%EC%A0%90',
    hourlyPrice: null,
    priceNote: '가격 업체 문의. 당근 등록 글에는 오픈이벤트 시간당 20,000원 정보가 있어 최신 요금 확인이 필요합니다.',
    amenitiesNote: '24시간 영업, 합주실',
  },
  {
    name: '아트콤마스튜디오 서울예대점',
    address: '경기 안산시 단원구 예술대학로 149 201호',
    latitude: 37.3173,
    longitude: 126.8379,
    phone: '0507-1393-2832',
    externalUrl: 'https://busk.co.kr/practice_rooms.php?id=252&mode=view&name=%EC%95%84%ED%8A%B8%EC%BD%A4%EB%A7%88%EC%8A%A4%ED%8A%9C%EB%94%94%EC%98%A4+%EC%84%9C%EC%9A%B8%EC%98%88%EB%8C%80%EC%A0%90',
    sourceUrl: 'https://busk.co.kr/practice_rooms.php?id=252&mode=view&name=%EC%95%84%ED%8A%B8%EC%BD%A4%EB%A7%88%EC%8A%A4%ED%8A%9C%EB%94%94%EC%98%A4+%EC%84%9C%EC%9A%B8%EC%98%88%EB%8C%80%EC%A0%90',
    hourlyPrice: null,
    priceNote: '가격 업체 문의. 최신 요금은 외부 링크에서 확인해 주세요.',
    amenitiesNote: '24시간 영업, 음악 연습공간',
  },
  {
    name: '아트콤마스튜디오 신길점',
    address: '경기도 안산시 단원구 신길로 85 303호',
    latitude: 37.3331,
    longitude: 126.7827,
    phone: null,
    externalUrl: 'https://studiofy.kr/studio-profile/fb8b3475-7445-466b-aa89-4d7098d4bb6c/',
    sourceUrl: 'https://studiofy.kr/studio-profile/fb8b3475-7445-466b-aa89-4d7098d4bb6c/',
    hourlyPrice: null,
    priceNote: '가격 확인 필요. 최신 요금은 외부 링크에서 확인해 주세요.',
    amenitiesNote: '안산역 인근, 관악기 연습',
  },
  {
    name: '아트콤마스튜디오 한양대점',
    address: '경기도 안산시 상록구 한양대학1길 61',
    latitude: 37.3024,
    longitude: 126.8372,
    phone: null,
    externalUrl: 'https://studiofy.kr/studio-profile/5bae1030-cb91-4ae3-85f2-621439e9e082/',
    sourceUrl: 'https://studiofy.kr/studio-profile/5bae1030-cb91-4ae3-85f2-621439e9e082/',
    hourlyPrice: null,
    priceNote: '가격 확인 필요. 최신 요금은 외부 링크에서 확인해 주세요.',
    amenitiesNote: '한대앞역 인근 음악 연습실',
  },
  {
    name: 'SYM음악연습실',
    address: '경기도 안산시 상록구 항가울로 282-1',
    latitude: 37.3053,
    longitude: 126.8567,
    phone: null,
    externalUrl: 'https://studiofy.kr/studio-profile/dd982a0b-4a6c-47d5-ba4d-456be37661eb/',
    sourceUrl: 'https://studiofy.kr/studio-profile/dd982a0b-4a6c-47d5-ba4d-456be37661eb/',
    hourlyPrice: null,
    priceNote: '가격 확인 필요. 최신 요금은 외부 링크에서 확인해 주세요.',
    amenitiesNote: '한대앞역 인근 음악 연습실',
  },
  {
    name: '안산예대연습실',
    address: '경기도 안산시 단원구 다리간2길 55 석정빌딩 2층',
    latitude: 37.3162,
    longitude: 126.8239,
    phone: null,
    externalUrl: 'https://studiofy.kr/studio-profile/c4643dd6-dce0-408c-832a-ad0020e8fa2d/',
    sourceUrl: 'https://studiofy.kr/studio-profile/c4643dd6-dce0-408c-832a-ad0020e8fa2d/',
    hourlyPrice: null,
    priceNote: '가격 확인 필요. 최신 요금은 외부 링크에서 확인해 주세요.',
    amenitiesNote: '고잔역 인근 음악 연습실',
  },
  {
    name: '뮤작스튜디오 음악연습실',
    address: '경기도 안산시 상록구 화랑로 501 예술프라자 301호',
    latitude: 37.3229,
    longitude: 126.8486,
    phone: null,
    externalUrl: 'https://studiofy.kr/studio-profile/f24f033d-4c19-481f-9ca1-258b9887d688/',
    sourceUrl: 'https://studiofy.kr/studio-profile/f24f033d-4c19-481f-9ca1-258b9887d688/',
    hourlyPrice: null,
    priceNote: '가격 확인 필요. 최신 요금은 외부 링크에서 확인해 주세요.',
    amenitiesNote: '중앙역 인근 음악 연습실',
  },
  {
    name: '에스엠 음악연습실/합주실/드럼연습실/밴드연습실',
    address: '경기도 안산시 단원구 민속공원로 80 301호, 401호',
    latitude: 37.3219,
    longitude: 126.8309,
    phone: null,
    externalUrl: 'https://studiofy.kr/studio-profile/5aad3758-4751-4c24-879a-d07ab365a1de',
    sourceUrl: 'https://studiofy.kr/studio-profile/5aad3758-4751-4c24-879a-d07ab365a1de',
    hourlyPrice: null,
    priceNote: '가격 확인 필요. 최신 요금은 외부 링크에서 확인해 주세요.',
    amenitiesNote: '중앙역 인근, 드럼 연습, 합주실',
  },
  {
    name: '당나귀음악연습실',
    address: '경기도 안산시 상록구 평안로3길 25 지하층',
    latitude: 37.2868,
    longitude: 126.8646,
    phone: null,
    externalUrl: 'https://studiofy.kr/studio-profile/02bbc7f7-0c13-40f4-9d5c-8602103a0c62/',
    sourceUrl: 'https://studiofy.kr/studio-profile/02bbc7f7-0c13-40f4-9d5c-8602103a0c62/',
    hourlyPrice: null,
    priceNote: '가격 확인 필요. 최신 요금은 외부 링크에서 확인해 주세요.',
    amenitiesNote: '사리역 인근, 드럼 연습',
  },
  {
    name: '드럼 스페이스 안산',
    address: '경기 안산시 단원구 예술대학로 82 B124호',
    latitude: 37.3187,
    longitude: 126.8295,
    phone: '0507-1493-0987',
    externalUrl: 'https://busk.co.kr/practice_rooms.php?id=254&mode=view',
    sourceUrl: 'https://busk.co.kr/practice_rooms.php?id=254&mode=view',
    hourlyPrice: null,
    priceNote: '가격 업체 문의. 최신 요금은 외부 링크에서 확인해 주세요.',
    amenitiesNote: '24시간 영업, 드럼 연습실',
  },
  {
    name: 'IN STUDIO 안산점',
    address: '경기 안산시 단원구 고잔2길 9 3층 304호',
    latitude: 37.3187,
    longitude: 126.8295,
    phone: '0507-1411-3909',
    externalUrl: 'https://busk.co.kr/practice_rooms.php?id=247&mode=view&name=IN+STUDIO+%EC%95%88%EC%82%B0%EC%A0%90',
    sourceUrl: 'https://busk.co.kr/practice_rooms.php?id=247&mode=view&name=IN+STUDIO+%EC%95%88%EC%82%B0%EC%A0%90',
    hourlyPrice: null,
    priceNote: '가격 업체 문의. 최신 요금은 외부 링크에서 확인해 주세요.',
    amenitiesNote: '24시간 영업, 음악 연습실',
  },
  {
    name: 'HENZ뮤직스튜디오 안산고잔점',
    address: '경기도 안산시 단원구 광덕2로 185-18',
    latitude: 37.3097,
    longitude: 126.8307,
    phone: null,
    externalUrl: 'https://studiofy.kr/studio-profile/f2b5216a-6347-4c60-94b1-b410874739d5/',
    sourceUrl: 'https://studiofy.kr/studio-profile/f2b5216a-6347-4c60-94b1-b410874739d5/',
    hourlyPrice: null,
    priceNote: '가격 확인 필요. 최신 요금은 외부 링크에서 확인해 주세요.',
    amenitiesNote: '중앙역 인근 음악 연습실',
  },
] satisfies Array<Partial<Studio> & { name: string; sourceUrl: string }>;

@Injectable()
export class StudiosService {
  constructor(
    @InjectRepository(Studio)
    private readonly studiosRepository: Repository<Studio>,
    @InjectRepository(StudioCandidate)
    private readonly candidatesRepository: Repository<StudioCandidate>,
    @InjectRepository(StudioVote)
    private readonly votesRepository: Repository<StudioVote>,
    @InjectRepository(ScheduleProposal)
    private readonly scheduleProposalsRepository: Repository<ScheduleProposal>,
    @InjectRepository(BandMember)
    private readonly membersRepository: Repository<BandMember>,
    private readonly bandsService: BandsService,
    private readonly usersService: UsersService,
  ) {}

  async listCandidates(userId: string, bandId: string) {
    await this.bandsService.requireMembership(userId, bandId);
    const [candidates, members, expectedHours] = await Promise.all([
      this.candidatesRepository.find({
        where: { band: { id: bandId } },
        relations: ['votes', 'votes.user', 'band'],
        order: { createdAt: 'ASC' },
      }),
      this.getBandMembers(bandId),
      this.getExpectedHours(bandId),
    ]);
    const memberCount = Math.max(1, members.length);
    const distanceStats = this.buildDistanceStats(candidates, members);

    return candidates
      .map((candidate) => this.toCandidateDto(candidate, userId, memberCount, expectedHours, distanceStats.get(candidate.id)))
      .sort((a, b) => {
        if (Number(b.status === 'confirmed') !== Number(a.status === 'confirmed')) {
          return Number(b.status === 'confirmed') - Number(a.status === 'confirmed');
        }
        if (a.recommendationRank !== null && b.recommendationRank !== null && a.recommendationRank !== b.recommendationRank) {
          return a.recommendationRank - b.recommendationRank;
        }
        if (a.recommendationRank !== null || b.recommendationRank !== null) {
          return a.recommendationRank === null ? 1 : -1;
        }
        if (b.voteCount !== a.voteCount) {
          return b.voteCount - a.voteCount;
        }
        return a.createdAt.localeCompare(b.createdAt);
      });
  }

  async listStudios(userId: string, bandId: string) {
    const membership = await this.bandsService.requireMembership(userId, bandId);
    await this.ensureAppProvidedStudios();
    const [studios, members] = await Promise.all([
      this.studiosRepository.find({
        where: { region: ANSAN_REGION },
        order: { name: 'ASC' },
      }),
      this.getBandMembers(bandId),
    ]);
    const distanceStats = this.buildStudioDistanceStats(studios, members, membership);

    return studios
      .map((studio) => this.toStudioDto(studio, distanceStats.get(studio.id)))
      .sort((a, b) => {
        if (a.distanceAverageKm !== null && b.distanceAverageKm !== null && a.distanceAverageKm !== b.distanceAverageKm) {
          return a.distanceAverageKm - b.distanceAverageKm;
        }
        if (a.distanceAverageKm !== null || b.distanceAverageKm !== null) {
          return a.distanceAverageKm === null ? 1 : -1;
        }
        return a.name.localeCompare(b.name);
      });
  }

  async getLocation(userId: string, bandId: string) {
    const membership = await this.bandsService.requireMembership(userId, bandId);
    return {
      label: membership.homeLocationLabel,
      latitude: membership.homeLatitude,
      longitude: membership.homeLongitude,
    };
  }

  async saveLocation(userId: string, bandId: string, dto: SaveStudioLocationDto) {
    const membership = await this.bandsService.requireMembership(userId, bandId);

    membership.homeLocationLabel = this.clean(dto.label) ?? '지도에서 선택한 위치';
    membership.homeLatitude = dto.latitude;
    membership.homeLongitude = dto.longitude;
    await this.membersRepository.save(membership);

    return {
      label: membership.homeLocationLabel,
      latitude: membership.homeLatitude,
      longitude: membership.homeLongitude,
    };
  }

  async createCandidate(userId: string, bandId: string, dto: CreateStudioCandidateDto) {
    const membership = await this.bandsService.requireMembership(userId, bandId);
    if (!dto.studioId) {
      throw new BadRequestException('앱에서 제공하는 합주실을 선택해 주세요.');
    }
    await this.ensureAppProvidedStudios();
    const studio = await this.getStudioOrThrow(dto.studioId);
    await this.clearConfirmedCandidates(bandId);

    const duplicated = await this.candidatesRepository.findOne({
      where: { band: { id: bandId }, studio: { id: studio.id } },
    });
    if (duplicated) {
      throw new BadRequestException('이미 후보로 등록된 합주실입니다.');
    }

    return this.candidatesRepository.save(
      this.candidatesRepository.create({
        band: membership.band,
        studio,
        createdByUser: membership.user,
        note: this.clean(dto.note),
        status: 'open',
        voteDeadlineAt: null,
      }),
    );
  }

  async vote(userId: string, bandId: string, candidateId: string) {
    await this.bandsService.requireMembership(userId, bandId);
    const candidate = await this.candidatesRepository.findOne({
      where: { id: candidateId },
      relations: ['band'],
    });
    if (!candidate || candidate.band.id !== bandId) {
      throw new NotFoundException('합주실 후보를 찾을 수 없습니다.');
    }
    const existingVotes = await this.votesRepository.find({
      where: { user: { id: userId } },
      relations: ['candidate', 'candidate.band'],
    });
    const bandVotes = existingVotes.filter((vote) => vote.candidate.band.id === bandId);
    if (bandVotes.length > 0) {
      await this.votesRepository.remove(bandVotes);
    }

    const user = await this.usersService.findById(userId);
    return this.votesRepository.save(
      this.votesRepository.create({
        candidate,
        user: user!,
      }),
    );
  }

  async finalize(userId: string, bandId: string) {
    await this.bandsService.requireLeader(userId, bandId);
    const candidates = await this.candidatesRepository.find({
      where: { band: { id: bandId } },
      relations: ['votes', 'band'],
      order: { createdAt: 'ASC' },
    });
    if (candidates.length === 0) {
      throw new BadRequestException('확정할 합주실 후보가 없습니다.');
    }

    const winner = [...candidates].sort((a, b) => {
      const voteDiff = (b.votes?.length ?? 0) - (a.votes?.length ?? 0);
      if (voteDiff !== 0) {
        return voteDiff;
      }
      const aPrice = a.studio.hourlyPrice ?? Number.MAX_SAFE_INTEGER;
      const bPrice = b.studio.hourlyPrice ?? Number.MAX_SAFE_INTEGER;
      if (aPrice !== bPrice) {
        return aPrice - bPrice;
      }
      return a.createdAt.getTime() - b.createdAt.getTime();
    })[0];

    winner.status = 'confirmed';
    await this.candidatesRepository.save(winner);

    const losers = candidates.filter((candidate) => candidate.id !== winner.id);
    if (losers.length > 0) {
      await this.candidatesRepository.remove(losers);
    }

    return this.candidatesRepository.findOne({
      where: { id: winner.id },
      relations: ['votes', 'votes.user', 'band'],
    });
  }

  async importAnsan(userId: string, bandId: string) {
    await this.bandsService.requireMembership(userId, bandId);
    await this.ensureAppProvidedStudios();
    const imported: Studio[] = [];

    for (const sourceUrl of ANSAN_STUDIO_SOURCE_URLS) {
      const response = await fetch(sourceUrl);
      if (!response.ok) {
        throw new BadRequestException('안산 합주실 정보를 가져오지 못했습니다.');
      }
      const html = await response.text();
      const parsed = this.parseStudioHtml(sourceUrl, html);
      const existing = await this.studiosRepository.findOne({ where: { sourceUrl } });
      imported.push(
        await this.studiosRepository.save(
          this.studiosRepository.create({
            id: existing?.id,
            ...parsed,
            scrapedAt: new Date(),
          }),
        ),
      );
    }

    return imported.map((studio) => this.toStudioDto(studio));
  }

  private async getStudioOrThrow(studioId: string) {
    const studio = await this.studiosRepository.findOne({ where: { id: studioId } });
    if (!studio) {
      throw new NotFoundException('합주실 정보를 찾을 수 없습니다.');
    }
    return studio;
  }

  private async clearConfirmedCandidates(bandId: string) {
    const confirmed = await this.candidatesRepository.find({
      where: { band: { id: bandId }, status: 'confirmed' },
      relations: ['band'],
    });
    if (confirmed.length > 0) {
      await this.candidatesRepository.remove(confirmed);
    }
  }

  private async getExpectedHours(bandId: string) {
    const proposal = await this.scheduleProposalsRepository.findOne({
      where: { band: { id: bandId }, confirmed: true },
      order: { createdAt: 'DESC' },
    });
    if (!proposal) {
      return DEFAULT_EXPECTED_HOURS;
    }
    const minutes = this.toMinute(proposal.endTime) - this.toMinute(proposal.startTime);
    return minutes > 0 ? Math.max(0.5, minutes / 60) : DEFAULT_EXPECTED_HOURS;
  }

  private async getMemberCount(userId: string, bandId: string) {
    const members = await this.bandsService.getMembers(userId, bandId);
    return Math.max(1, members.length);
  }

  private toCandidateDto(
    candidate: StudioCandidate,
    userId: string,
    memberCount: number,
    expectedHours: number,
    distance?: { total: number | null; average: number | null; missing: number; rank: number | null },
  ) {
    const total = candidate.studio.hourlyPrice === null
      ? null
      : Math.round(candidate.studio.hourlyPrice * expectedHours);
    return {
      id: candidate.id,
      studio: this.toStudioDto(candidate.studio),
      createdByUserId: candidate.createdByUser.id,
      createdByName: candidate.createdByUser.name,
      note: candidate.note,
      status: candidate.status,
      voteCount: candidate.votes?.length ?? 0,
      didVote: candidate.votes?.some((vote) => vote.user.id === userId) ?? false,
      expectedHours,
      estimatedTotalPrice: total,
      estimatedPerMemberPrice: total === null ? null : Math.ceil(total / memberCount),
      distanceTotalKm: distance?.total ?? null,
      distanceAverageKm: distance?.average ?? null,
      missingLocationCount: distance?.missing ?? memberCount,
      recommendationRank: distance?.rank ?? null,
      voteDeadlineAt: candidate.voteDeadlineAt?.toISOString() ?? null,
      voteClosed: false,
      createdAt: candidate.createdAt.toISOString(),
    };
  }

  private toStudioDto(studio: Studio, distance?: { average: number | null; mine: number | null }) {
    return {
      id: studio.id,
      name: studio.name,
      region: studio.region,
      address: studio.address,
      phone: studio.phone,
      externalUrl: studio.externalUrl,
      sourceUrl: studio.sourceUrl,
      scrapedAt: studio.scrapedAt?.toISOString() ?? null,
      hourlyPrice: studio.hourlyPrice,
      priceNote: studio.priceNote,
      amenitiesNote: studio.amenitiesNote,
      latitude: studio.latitude,
      longitude: studio.longitude,
      distanceAverageKm: distance?.average ?? null,
      myDistanceKm: distance?.mine ?? null,
    };
  }

  private parseStudioHtml(sourceUrl: string, html: string) {
    const text = this.htmlToText(html);
    const name = this.matchText(text, /#\s*([^\n]+)/) ?? '안산 합주실';
    const address = this.matchText(text, /주소\s+([^\n]+)/);
    const phone = this.matchText(text, /전화번호\s+([0-9-]+)/);
    const priceNote = this.matchText(text, /(요금[^\n]*|가격[^\n]*|[0-9,]+원[^\n]*)/);
    return {
      name,
      region: ANSAN_REGION,
      address,
      ...this.resolveStudioCoordinates(address, name),
      phone,
      externalUrl: sourceUrl,
      sourceUrl,
      hourlyPrice: this.parseHourlyPrice(priceNote ?? text),
      priceNote,
      amenitiesNote: this.matchText(text, /편의 정보\s+([\s\S]{0,160})/)?.replace(/\s+/g, ' ') ?? null,
    };
  }

  private htmlToText(html: string) {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, '\n')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\n{2,}/g, '\n')
      .trim();
  }

  private matchText(value: string, pattern: RegExp) {
    const match = value.match(pattern);
    return match?.[1]?.trim() || null;
  }

  private parseHourlyPrice(value: string) {
    const match = value.match(/([0-9][0-9,]{2,})\s*원/);
    return match ? Number(match[1].replace(/,/g, '')) : null;
  }

  private toMinute(value: string) {
    const [hour, minute] = value.split(':').map(Number);
    return hour * 60 + minute;
  }

  private clean(value?: string | null) {
    const cleaned = value?.trim();
    return cleaned ? cleaned : null;
  }

  private async getBandMembers(bandId: string) {
    return this.membersRepository.find({
      where: { band: { id: bandId } },
      relations: ['user'],
    });
  }

  private async ensureAppProvidedStudios() {
    await Promise.all(
      APP_PROVIDED_ANSAN_STUDIOS.map(async (provided) => {
        const existing = await this.studiosRepository.findOne({
          where: { sourceUrl: provided.sourceUrl },
        });
        await this.studiosRepository.save(
          this.studiosRepository.create({
            id: existing?.id,
            ...provided,
            region: ANSAN_REGION,
            scrapedAt: existing?.scrapedAt ?? null,
          }),
        );
      }),
    );
  }

  private buildDistanceStats(candidates: StudioCandidate[], members: BandMember[]) {
    const locatedMembers = members.filter(
      (member) => member.homeLatitude !== null && member.homeLongitude !== null,
    );
    const stats = new Map<string, { total: number | null; average: number | null; missing: number; rank: number | null }>();
    const ranked: Array<{ id: string; total: number }> = [];

    for (const candidate of candidates) {
      const studio = candidate.studio;
      const missing = members.length - locatedMembers.length + (studio.latitude === null || studio.longitude === null ? locatedMembers.length : 0);
      if (studio.latitude === null || studio.longitude === null || locatedMembers.length === 0) {
        stats.set(candidate.id, { total: null, average: null, missing, rank: null });
        continue;
      }

      const total = locatedMembers.reduce((sum, member) => {
        return sum + this.distanceKm(member.homeLatitude!, member.homeLongitude!, studio.latitude!, studio.longitude!);
      }, 0);
      const roundedTotal = Math.round(total * 10) / 10;
      stats.set(candidate.id, {
        total: roundedTotal,
        average: Math.round((total / locatedMembers.length) * 10) / 10,
        missing,
        rank: null,
      });
      ranked.push({ id: candidate.id, total: roundedTotal });
    }

    ranked.sort((a, b) => a.total - b.total);
    ranked.forEach((item, index) => {
      const current = stats.get(item.id);
      if (current) {
        current.rank = index + 1;
      }
    });

    return stats;
  }

  private buildStudioDistanceStats(studios: Studio[], members: BandMember[], membership: BandMember) {
    const locatedMembers = members.filter(
      (member) => member.homeLatitude !== null && member.homeLongitude !== null,
    );
    const hasMyLocation = membership.homeLatitude !== null && membership.homeLongitude !== null;
    const stats = new Map<string, { average: number | null; mine: number | null }>();

    for (const studio of studios) {
      if (studio.latitude === null || studio.longitude === null || locatedMembers.length === 0) {
        stats.set(studio.id, { average: null, mine: null });
        continue;
      }

      const total = locatedMembers.reduce((sum, member) => {
        return sum + this.distanceKm(member.homeLatitude!, member.homeLongitude!, studio.latitude!, studio.longitude!);
      }, 0);
      stats.set(studio.id, {
        average: Math.round((total / locatedMembers.length) * 10) / 10,
        mine: hasMyLocation
          ? Math.round(this.distanceKm(membership.homeLatitude!, membership.homeLongitude!, studio.latitude, studio.longitude) * 10) / 10
          : null,
      });
    }

    return stats;
  }

  private resolveStudioCoordinates(address?: string | null, label?: string | null) {
    const location = findAnsanLocation(`${address ?? ''} ${label ?? ''}`);
    return {
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
    };
  }

  private distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const radiusKm = 6371;
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private toRadians(value: number) {
    return (value * Math.PI) / 180;
  }
}
